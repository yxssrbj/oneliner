// @vitest-environment jsdom
import { Activity } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import AccountControls, { AccountTheme } from './account-controls'
const {onAuthStateChange, refresh} = vi.hoisted(() => ({onAuthStateChange: vi.fn(), refresh: vi.fn()}))
vi.mock('../../lib/supabase/client', () => ({isLocalSignOutPending: () => false, createSupabaseBrowserClient: () => ({auth: {onAuthStateChange}})}))
vi.mock('next/navigation', () => { const router = {refresh}; return {useRouter: () => router} })
beforeEach(() => {
  cleanup(); vi.clearAllMocks()
  document.documentElement.dataset.theme = 'light'
  onAuthStateChange.mockImplementation(listener => { listener('INITIAL_SESSION', {user: {id: 'one'}}); return {data: {subscription: {unsubscribe: vi.fn()}}} })
})
function show() { return render(<AccountControls userId="one" displayName="River" profileError={false}/>) }
test.each([['SIGNED_OUT', null], ['SIGNED_IN', {user: {id: 'two'}}]])('external %s hides previous identity and refreshes', (event, session) => {
  const view = show()
  act(() => onAuthStateChange.mock.calls[0][0](event, session))
  expect(screen.queryByText('River')).not.toBeInTheDocument()
  expect(refresh).toHaveBeenCalled()
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  view.rerender(<AccountControls userId="one" displayName="Stale response" profileError={false}/>)
  expect(screen.queryByText('Stale response')).not.toBeInTheDocument()
})
test('the profile row opens settings', () => {
  show()
  expect(screen.getByRole('link', { name: /River/ })).toHaveAttribute('href', '/settings')
})
test('the profile avatar uses the confirmed visible name', () => {
  render(<AccountControls userId="one" displayName="Alex Lee" profileError={false}/>)
  expect(screen.getByText('AL')).toBeVisible()
})
test('settings marks the profile row current', () => {
  render(<AccountControls userId="one" displayName="River" profileError={false} current />)
  expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute('href', '/settings')
})

test('the sidebar leaves sign-out to settings', () => {
  show()
  expect(screen.queryByRole('button', {name: 'Sign out'})).not.toBeInTheDocument()
})


test('a matching browser owner activates only the server-confirmed theme', () => {
  render(<AccountTheme userId="one" initialTheme="light" />)
  expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  expect(document.documentElement).toHaveAttribute('data-theme-ready', 'true')
  act(() => onAuthStateChange.mock.calls[0][0]('SIGNED_IN', {user: {id: 'two'}}))
  act(() => onAuthStateChange.mock.calls[0][0]('USER_UPDATED', {user: {id: 'one', user_metadata: {oneliner_theme: 'light'}}}))
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
})
test('holds sidebar identity and theme until the browser confirms the server owner', () => {
  onAuthStateChange.mockImplementation(() => ({data: {subscription: {unsubscribe: vi.fn()}}}))
  show()
  expect(screen.queryByText('River')).not.toBeInTheDocument()
  expect(screen.getByText('Trader')).toBeVisible()
})

test('a signed-out document never activates the previous account theme', () => {
  onAuthStateChange.mockImplementation(listener => { listener('INITIAL_SESSION', null); return {data: {subscription: {unsubscribe: vi.fn()}}} })
  render(<AccountTheme userId={null} initialTheme="dark" />)
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
})


test('a cached sidebar hides identity again while browser ownership is rechecked', () => {
  const profile = <AccountControls userId="one" displayName="River" profileError={false}/>
  const view = render(<Activity mode="visible">{profile}</Activity>)
  expect(screen.getByText('River')).toBeVisible()
  view.rerender(<Activity mode="hidden">{profile}</Activity>)
  onAuthStateChange.mockImplementation(() => ({data: {subscription: {unsubscribe: vi.fn()}}}))
  view.rerender(<Activity mode="visible">{profile}</Activity>)
  expect(screen.queryByText('River')).not.toBeInTheDocument()
  expect(screen.getByText('Trader')).toBeVisible()
})

test('the document adopts a matching confirmed user update', () => {
  render(<AccountTheme userId="one" initialTheme="dark" />)
  act(() => onAuthStateChange.mock.calls[0][0]('USER_UPDATED', {user: {id: 'one', user_metadata: {oneliner_theme: 'light'}}}))
  expect(document.documentElement).toHaveAttribute('data-theme', 'light')
})

test('matching token refresh metadata updates the initialized document palette', () => {
  render(<AccountTheme userId="one" initialTheme="dark" />)
  act(() => onAuthStateChange.mock.calls[0][0]('TOKEN_REFRESHED', {user: {id: 'one', user_metadata: {oneliner_theme: 'light'}}}))
  expect(document.documentElement).toHaveAttribute('data-theme', 'light')
})

test('a new verified revision reconciles the document back to its original theme', () => {
  const view = render(<AccountTheme userId="one" initialTheme="dark" themeRevision="first" />)
  act(() => onAuthStateChange.mock.calls[0][0]('USER_UPDATED', {user: {id: 'one', user_metadata: {oneliner_theme: 'light'}}}))
  expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  view.rerender(<AccountTheme userId="one" initialTheme="dark" themeRevision="later" />)
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
})
