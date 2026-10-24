// @vitest-environment jsdom
import {afterEach, beforeEach, expect, test, vi} from 'vitest'
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import PasswordForm from './password-form'
import {createSupabaseBrowserClient, signOutLocally} from '../../lib/supabase/client'

let client: ReturnType<typeof createSupabaseBrowserClient>
let started!: () => void
let finish!: (response: Response) => void
let pendingUpdate: Promise<void>
const navigate = vi.fn()
const user = (id: string) => ({id, aud: 'authenticated', role: 'authenticated', email: `${id}@example.test`, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z'})
const session = (id: string, verified = false) => ({access_token: `token-${verified ? 'verified-' : ''}${id}`, refresh_token: `refresh-${verified ? 'verified-' : ''}${id}`, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: user(id)})
beforeEach(async () => {
  cleanup(); vi.clearAllMocks()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://auth.test')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test-key')
  vi.stubGlobal('BroadcastChannel', undefined)
  vi.stubGlobal('location', {replace: navigate})
  for (const cookie of document.cookie.split(';')) document.cookie = `${cookie.split('=')[0].trim()}=; Max-Age=0; Path=/`
  localStorage.clear()
  pendingUpdate = new Promise(resolve => {started = resolve})
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/verify')) {const body = JSON.parse(init!.body as string); return Response.json(session(body.email.split('@')[0], body.token === '123456'))}
    if (url.endsWith('/otp')) return Response.json({})
    if (url.endsWith('/user') && init?.method === 'PUT') {started(); return await new Promise<Response>(resolve => {finish = resolve})}
    if (url.includes('/logout')) return new Response(null, {status: 204})
    if (url.endsWith('/user')) return Response.json(user('one'))
    throw new Error(`Unexpected test request: ${init?.method} ${url}`)
  }))
  client = createSupabaseBrowserClient()
  await client.auth.verifyOtp({email: 'one@example.test', token: 'seed-code', type: 'email'})
})
afterEach(async () => {cleanup(); await client.auth.stopAutoRefresh(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks()})
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), {target: {value}})
async function beginUpdate() {
  render(<PasswordForm userId="one" email="one@example.test"/>)
  await screen.findByRole('button', {name: 'Use email code instead'})
  fireEvent.click(screen.getByRole('button', {name: 'Use email code instead'}))
  fill('New password', 'Example-new-pass-42!'); fill('Confirm new password', 'Example-new-pass-42!')
  fireEvent.click(screen.getByRole('button', {name: 'Send verification code'}))
  await screen.findByLabelText('Verification code')
  fill('Verification code', '123456')
  fireEvent.click(screen.getByRole('button', {name: 'Update password'}))
  await pendingUpdate
}

test('isolated verification uses its own bearer without cookie, storage, or shared event writes', async () => {
  const before = document.cookie
  const events: string[] = []
  const {data: {subscription}} = client.auth.onAuthStateChange(event => events.push(event))
  await beginUpdate()
  const put = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'PUT')!
  expect(new Headers(put[1]!.headers).get('Authorization')).toBe('Bearer token-verified-one')
  expect(JSON.parse(put[1]!.body as string)).toMatchObject({password: 'Example-new-pass-42!'})
  expect(document.cookie).toBe(before)
  expect(localStorage.length).toBe(0)
  await act(async () => finish(Response.json(user('one'))))
  expect(navigate).toHaveBeenCalledWith('/sign-in?password=updated')
  expect(document.cookie).toBe(before)
  expect(events.filter(event => event !== 'INITIAL_SESSION')).toEqual([])
  const logouts = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes('/logout'))
  expect(logouts).toHaveLength(1)
  expect(new Headers(logouts[0][1]!.headers).get('Authorization')).toBe('Bearer token-verified-one')
  subscription.unsubscribe()
})
test('a real replacement account keeps its session after an old isolated password response', async () => {
  await beginUpdate()
  await act(async () => {await client.auth.verifyOtp({email: 'two@example.test', token: 'seed-code', type: 'email'})})
  const replacementCookies = document.cookie
  await act(async () => finish(Response.json(user('one'))))
  expect((await client.auth.getSession()).data.session?.user.id).toBe('two')
  expect(document.cookie).toBe(replacementCookies)
  expect(navigate).not.toHaveBeenCalled()
  expect(screen.queryByDisplayValue('Example-new-pass-42!')).not.toBeInTheDocument()
})
test('a real local logout stays signed out after an old isolated password response', async () => {
  await beginUpdate()
  await act(async () => {expect((await signOutLocally()).error).toBeNull()})
  await act(async () => finish(Response.json(user('one'))))
  expect((await client.auth.getSession()).data.session).toBeNull()
  expect(document.cookie).toBe('')
  expect(navigate).not.toHaveBeenCalled()
})
test('verification clients do not share the active account storage key or each other’s lock', async () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  await beginUpdate()
  await act(async () => finish(Response.json(user('one'))))
  await waitFor(() => expect(navigate).toHaveBeenCalled())
  expect(warning).not.toHaveBeenCalled()
})
