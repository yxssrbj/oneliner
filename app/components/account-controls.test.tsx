// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import AccountControls from './account-controls'
const {signOut, onAuthStateChange, replace, refresh} = vi.hoisted(() => ({signOut: vi.fn(), onAuthStateChange: vi.fn(), replace: vi.fn(), refresh: vi.fn()}))
vi.mock('../../lib/supabase/client', () => ({createSupabaseBrowserClient: () => ({auth: {signOut, onAuthStateChange}})}))
vi.mock('next/navigation', () => ({useRouter: () => ({replace, refresh})}))
beforeEach(() => {
  cleanup(); vi.clearAllMocks()
  onAuthStateChange.mockReturnValue({data: {subscription: {unsubscribe: vi.fn()}}})
  signOut.mockResolvedValue({error: null})
})
function show() { return render(<AccountControls userId="one" displayName="River" profileError={false}/>) }
test('signs out locally before redirecting and refreshing', async () => {
  show(); fireEvent.click(screen.getByRole('button', {name: 'Sign out'}))
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/sign-in'))
  expect(signOut).toHaveBeenCalledWith({scope: 'local'})
  expect(refresh).toHaveBeenCalled()
  expect(screen.queryByText('River')).not.toBeInTheDocument()
})
test.each([false, true])('failed sign-out stays visible and retryable (throw=%s)', async throws => {
  if (throws) signOut.mockRejectedValueOnce(new Error('network'))
  else signOut.mockResolvedValueOnce({error: {message: 'network'}})
  show(); fireEvent.click(screen.getByRole('button', {name: 'Sign out'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign out. Try again.')
  expect(screen.getByText('River')).toBeVisible()
  expect(replace).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', {name: 'Sign out'}))
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/sign-in'))
})
test('pending clicks send one request and do not redirect early', async () => {
  let finish!: (value: {error: null}) => void
  signOut.mockReturnValue(new Promise(resolve => { finish = resolve }))
  show(); const button = screen.getByRole('button', {name: 'Sign out'})
  fireEvent.click(button); fireEvent.click(button)
  expect(signOut).toHaveBeenCalledTimes(1)
  expect(button).toBeDisabled(); expect(replace).not.toHaveBeenCalled()
  await act(async () => finish({error: null}))
})
test.each([['SIGNED_OUT', null], ['SIGNED_IN', {user: {id: 'two'}}]])('external %s hides previous identity and refreshes', (event, session) => {
  const view = show()
  act(() => onAuthStateChange.mock.calls[0][0](event, session))
  expect(screen.queryByText('River')).not.toBeInTheDocument()
  expect(refresh).toHaveBeenCalled()
  view.rerender(<AccountControls userId="one" displayName="Stale response" profileError={false}/>)
  expect(screen.queryByText('Stale response')).not.toBeInTheDocument()
})
test('a pending sign-out response cannot redirect a replacement account', async () => {
  let finish!: (value: {error: null}) => void
  signOut.mockReturnValue(new Promise(resolve => { finish = resolve }))
  show(); fireEvent.click(screen.getByRole('button', {name: 'Sign out'}))
  act(() => onAuthStateChange.mock.calls[0][0]('SIGNED_IN', {user: {id: 'two'}}))
  await act(async () => finish({error: null}))
  expect(replace).not.toHaveBeenCalled()
  expect(screen.queryByText('River')).not.toBeInTheDocument()
})
test('SDK session removal on failed logout hides identity and keeps retry without redirect', async () => {
  signOut.mockImplementationOnce(async () => {
    onAuthStateChange.mock.calls[0][0]('SIGNED_OUT', null)
    return {error: {message: 'unavailable'}}
  })
  show(); fireEvent.click(screen.getByRole('button', {name: 'Sign out'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign out. Try again.')
  expect(screen.queryByText('River')).not.toBeInTheDocument()
  expect(refresh).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', {name: 'Sign out'}))
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/sign-in'))
})
test('ignores a sign-out completion after the account control unmounts', async () => {
  let finish!: (value: {error: null}) => void
  signOut.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const view = show(); fireEvent.click(screen.getByRole('button', {name: 'Sign out'}))
  view.unmount()
  await act(async () => finish({error: null}))
  expect(replace).not.toHaveBeenCalled()
})
