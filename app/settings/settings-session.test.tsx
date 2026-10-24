// @vitest-environment jsdom
import { Activity } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { createSupabaseBrowserClient, saveAccountMetadata, signOutLocally } from '../../lib/supabase/client'
import SettingsClient from './settings-client'
import { AccountTheme } from '../components/account-controls'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => { const router = { refresh }; return { useRouter: () => router } })
const user = (id: string, theme = 'dark') => ({ id, aud: 'authenticated', role: 'authenticated', email: `${id}@example.test`, app_metadata: {}, user_metadata: { oneliner_theme: theme, other: 'keep' }, created_at: '2026-01-01T00:00:00Z' })
const session = (id: string) => ({ access_token: `token-${id}`, refresh_token: `refresh-${id}`, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: user(id) })
let started!: () => void
let finish!: (response: Response) => void
let rejectPut!: (error: Error) => void
let pendingPut: Promise<void>
let client: ReturnType<typeof createSupabaseBrowserClient>

beforeEach(async () => {
  cleanup(); vi.clearAllMocks()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://auth.test')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test-publishable-key')
  vi.stubGlobal('BroadcastChannel', undefined)
  for (const cookie of document.cookie.split(';')) document.cookie = `${cookie.split('=')[0].trim()}=; Max-Age=0; Path=/`
  document.documentElement.dataset.theme = 'dark'
  pendingPut = new Promise(resolve => { started = resolve })
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/verify')) return Response.json(session(JSON.parse(init!.body as string).email.split('@')[0]))
    if (url.endsWith('/user') && init?.method === 'PUT') { started(); return await new Promise<Response>((resolve, reject) => { finish = resolve; rejectPut = reject }) }
    if (url.includes('/token?grant_type=refresh_token')) return Response.json({...session('one'), user: user('one', 'light')})
    if (url.includes('/logout')) return new Response(null, {status: 204})
    if (url.endsWith('/user')) return Response.json(user(new Headers(init?.headers).get('Authorization')!.replace('Bearer token-', '')))
    throw new Error(`Unexpected test request: ${init?.method} ${url}`)
  }))
  client = createSupabaseBrowserClient()
  await client.auth.verifyOtp({email: 'one@example.test', token: '123456', type: 'email'})
})
afterEach(async () => { cleanup(); await client.auth.stopAutoRefresh(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

async function beginSave() {
  render(<AccountTheme userId="one" initialTheme="dark"><SettingsClient userId="one" email="one@example.test" initialDisplayName="River" /></AccountTheme>)
  await screen.findByRole('button', {name: 'Switch to light mode'})
  fireEvent.click(screen.getByRole('button', {name: 'Switch to light mode'}))
  await pendingPut
}

test('a real SDK account replacement remains in cookie storage after an old metadata response', async () => {
  await beginSave()
  await act(async () => { await client.auth.verifyOtp({email: 'two@example.test', token: '123456', type: 'email'}) })
  expect((await client.auth.getSession()).data.session?.user.id).toBe('two')
  const secondCookies = document.cookie
  const oldEvents: string[] = []
  const {data: {subscription}} = client.auth.onAuthStateChange(event => { if (event === 'USER_UPDATED') oldEvents.push(event) })
  await act(async () => finish(Response.json(user('one', 'light'))))
  expect((await client.auth.getSession()).data.session?.user.id).toBe('two')
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  expect(document.cookie).toBe(secondCookies)
  expect(oldEvents).toEqual([])
  subscription.unsubscribe()
})

test('a real SDK local sign-out stays signed out after an old metadata response', async () => {
  await beginSave()
  await act(async () => { expect((await signOutLocally()).error).toBeNull() })
  expect((await client.auth.getSession()).data.session).toBeNull()
  await act(async () => finish(Response.json(user('one', 'light'))))
  await waitFor(async () => expect((await client.auth.getSession()).data.session).toBeNull())
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  expect(document.cookie).toBe('')
})


test('confirmed preference writes preserve metadata without changing the real SDK session cookie', async () => {
  const beforeCookies = document.cookie
  await beginSave()
  const put = vi.mocked(fetch).mock.calls.find(([url, init]) => String(url).endsWith('/user') && init?.method === 'PUT')!
  expect(JSON.parse(put[1]!.body as string)).toEqual({data: {other: 'keep', oneliner_theme: 'light'}})
  expect(new Headers(put[1]!.headers).get('Authorization')).toBe('Bearer token-one')
  expect(put[1]!.credentials).toBe('omit')
  await act(async () => finish(Response.json(user('one', 'light'))))
  await screen.findByRole('button', {name: 'Switch to dark mode'})
  expect(document.cookie).toBe(beforeCookies)
  expect((await client.auth.getSession()).data.session?.user.id).toBe('one')
})

test.each(['http', 'network', 'json', 'wrong-owner', 'wrong-theme', 'malformed-metadata', 'missing-user'])('a real %s preference failure preserves session, input, and retry', async failure => {
  const beforeCookies = document.cookie
  await beginSave()
  fireEvent.change(screen.getByLabelText('Display name'), {target: {value: 'Unsaved name'}})
  await act(async () => {
    if (failure === 'network') { rejectPut(new Error('Offline')); return }
    if (failure === 'http') { finish(Response.json({message: 'Unavailable'}, {status: 503})); return }
    if (failure === 'json') { finish(new Response('{', {headers: {'Content-Type': 'application/json'}})); return }
    if (failure === 'wrong-owner') { finish(Response.json(user('two', 'light'))); return }
    if (failure === 'wrong-theme') { finish(Response.json(user('one', 'dark'))); return }
    if (failure === 'malformed-metadata') { finish(Response.json({...user('one'), user_metadata: null})); return }
    finish(Response.json({}))
  })
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save appearance. Try again.')
  expect(screen.getByLabelText('Display name')).toHaveValue('Unsaved name')
  expect(screen.getByRole('button', {name: 'Switch to light mode'})).toBeEnabled()
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  expect(document.cookie).toBe(beforeCookies)
})

test.each(['replacement', 'signed-out'])('metadata writes reject a %s SDK session before making a request', async state => {
  if (state === 'replacement') await client.auth.verifyOtp({email: 'two@example.test', token: '123456', type: 'email'})
  else await signOutLocally()
  await expect(saveAccountMetadata('one', {oneliner_theme: 'light'})).rejects.toThrow('Account session changed')
  expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(0)
})


test('real same-account metadata updates synchronize a resumed settings page and refreshed props', async () => {
  const content = (mode: 'visible' | 'hidden', theme: 'dark' | 'light') => <AccountTheme userId="one" initialTheme={theme}><Activity mode={mode}><SettingsClient userId="one" email="one@example.test" initialDisplayName="River"/></Activity></AccountTheme>
  const view = render(content('visible', 'dark'))
  await screen.findByRole('button', {name: 'Switch to light mode'})
  fireEvent.change(screen.getByLabelText('Display name'), {target: {value: 'Unsaved name'}})
  view.rerender(content('hidden', 'dark'))
  const update = client.auth.updateUser({data: {oneliner_theme: 'light'}})
  await pendingPut
  await act(async () => { finish(Response.json(user('one', 'light'))); await update })
  expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  view.rerender(content('visible', 'dark'))
  expect(await screen.findByRole('button', {name: 'Switch to dark mode'})).toBeEnabled()
  expect(screen.getByLabelText('Display name')).toHaveValue('Unsaved name')
  view.rerender(content('visible', 'light'))
  expect(screen.getByRole('button', {name: 'Switch to dark mode'})).toBeEnabled()
  expect(screen.getByLabelText('Display name')).toHaveValue('Unsaved name')
})


test('a real SDK token refresh synchronizes document and action from the same snapshot', async () => {
  render(<AccountTheme userId="one" initialTheme="dark"><SettingsClient userId="one" email="one@example.test" initialDisplayName="River"/></AccountTheme>)
  await screen.findByRole('button', {name: 'Switch to light mode'})
  fireEvent.change(screen.getByLabelText('Display name'), {target: {value: 'Unsaved name'}})
  await act(async () => { expect((await client.auth.refreshSession()).error).toBeNull() })
  expect(screen.getByRole('button', {name: 'Switch to dark mode'})).toBeEnabled()
  expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  expect(screen.getByLabelText('Display name')).toHaveValue('Unsaved name')
})

test('a real SDK update followed by a stateless return to dark reconciles a fresh server revision', async () => {
  const content = (revision: string, mode: 'visible' | 'hidden' = 'visible') => <AccountTheme userId="one" initialTheme="dark" themeRevision={revision}><Activity mode={mode}><SettingsClient userId="one" email="one@example.test" initialDisplayName="River"/></Activity></AccountTheme>
  const view = render(content('first'))
  await screen.findByRole('button', {name: 'Switch to light mode'})
  fireEvent.change(screen.getByLabelText('Display name'), {target: {value: 'Unsaved name'}})
  view.rerender(content('first', 'hidden'))
  const update = client.auth.updateUser({data: {oneliner_theme: 'light'}})
  await pendingPut
  await act(async () => { finish(Response.json(user('one', 'light'))); await update })
  expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  const confirmation = saveAccountMetadata('one', {oneliner_theme: 'dark'})
  await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(2))
  await act(async () => { finish(Response.json(user('one', 'dark'))); await confirmation })
  expect((await client.auth.getSession()).data.session?.user.user_metadata.oneliner_theme).toBe('light')
  view.rerender(content('later', 'hidden'))
  view.rerender(content('later'))
  await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'dark'))
  expect(await screen.findByRole('button', {name: 'Switch to light mode'})).toBeEnabled()
  expect(screen.getByLabelText('Display name')).toHaveValue('Unsaved name')
})
