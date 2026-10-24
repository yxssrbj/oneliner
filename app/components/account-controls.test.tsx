// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import AccountControls from './account-controls'
const {onAuthStateChange, refresh} = vi.hoisted(() => ({onAuthStateChange: vi.fn(), refresh: vi.fn()}))
vi.mock('../../lib/supabase/client', () => ({isLocalSignOutPending: () => false, createSupabaseBrowserClient: () => ({auth: {onAuthStateChange}})}))
vi.mock('next/navigation', () => { const router = {refresh}; return {useRouter: () => router} })
beforeEach(() => {
  cleanup(); vi.clearAllMocks()
  onAuthStateChange.mockReturnValue({data: {subscription: {unsubscribe: vi.fn()}}})
})
function show() { return render(<AccountControls userId="one" displayName="River" profileError={false}/>) }
test.each([['SIGNED_OUT', null], ['SIGNED_IN', {user: {id: 'two'}}]])('external %s hides previous identity and refreshes', (event, session) => {
  const view = show()
  act(() => onAuthStateChange.mock.calls[0][0](event, session))
  expect(screen.queryByText('River')).not.toBeInTheDocument()
  expect(refresh).toHaveBeenCalled()
  view.rerender(<AccountControls userId="one" displayName="Stale response" profileError={false}/>)
  expect(screen.queryByText('Stale response')).not.toBeInTheDocument()
})
test('the profile row opens settings', () => {
  show()
  expect(screen.getByRole('link', { name: /River/ })).toHaveAttribute('href', '/settings')
})
test('settings marks the profile row current', () => {
  render(<AccountControls userId="one" displayName="River" profileError={false} current />)
  expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute('href', '/settings')
})

test('the sidebar leaves sign-out to settings', () => {
  show()
  expect(screen.queryByRole('button', {name: 'Sign out'})).not.toBeInTheDocument()
})
