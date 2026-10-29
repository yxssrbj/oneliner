// @vitest-environment jsdom
import { Activity } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import SignOutButton from './sign-out-button'
import AccountControls, { AccountTheme } from './account-controls'
import SettingsClient from '../settings/settings-client'
const {signOut, onAuthStateChange, replace, refresh} = vi.hoisted(() => ({signOut: vi.fn(), onAuthStateChange: vi.fn(), replace: vi.fn(), refresh: vi.fn()}))
vi.mock('@supabase/ssr', () => ({createBrowserClient: () => ({auth: {signOut, onAuthStateChange}})}))
vi.mock('next/navigation', () => { const router = {replace, refresh}; return {useRouter: () => router} })
beforeEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); sessionStorage.clear()
  document.documentElement.dataset.theme = 'light'
  onAuthStateChange.mockImplementation(listener => {
    listener('INITIAL_SESSION', {user: {id: 'one'}})
    return {data: {subscription: {unsubscribe: vi.fn()}}}
  })
  signOut.mockResolvedValue({error: null})
})
function show() { return render(<SignOutButton userId="one"/>) }
test('signs out locally before redirecting and refreshing', async () => {
  show(); fireEvent.click(screen.getByRole('button', {name: 'Sign out'}))
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/sign-in'))
  expect(signOut).toHaveBeenCalledWith({scope: 'local'})
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  expect(refresh).toHaveBeenCalled()
})
test.each([false, true])('failed sign-out stays visible and retryable (throw=%s)', async throws => {
  if (throws) signOut.mockRejectedValueOnce(new Error('network'))
  else signOut.mockResolvedValueOnce({error: {message: 'network'}})
  show(); fireEvent.click(screen.getByRole('button', {name: 'Sign out'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign out. Try again.')
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  expect(replace).not.toHaveBeenCalled()
  expect(refresh).not.toHaveBeenCalled()
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
test('a pending sign-out response cannot redirect a replacement account', async () => {
  let finish!: (value: {error: null}) => void
  signOut.mockReturnValue(new Promise(resolve => { finish = resolve }))
  show(); fireEvent.click(screen.getByRole('button', {name: 'Sign out'}))
  act(() => onAuthStateChange.mock.calls[0][0]('SIGNED_IN', {user: {id: 'two'}}))
  await act(async () => finish({error: null}))
  expect(replace).not.toHaveBeenCalled()
})
test('SDK session removal on failed logout keeps retry without redirect', async () => {
  signOut.mockImplementationOnce(async () => {
    onAuthStateChange.mock.calls[0][0]('SIGNED_OUT', null)
    return {error: {message: 'unavailable'}}
  })
  show(); fireEvent.click(screen.getByRole('button', {name: 'Sign out'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign out. Try again.')
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  expect(refresh).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', {name: 'Sign out'}))
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/sign-in'))
})
test('ignores a sign-out completion after the sign-out button unmounts', async () => {
  let finish!: (value: {error: null}) => void
  signOut.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const view = show(); fireEvent.click(screen.getByRole('button', {name: 'Sign out'}))
  view.unmount()
  await act(async () => finish({error: null}))
  expect(replace).not.toHaveBeenCalled()
})


test('failed logout hides both identities without refreshing away the settings retry', async () => {
  signOut.mockImplementationOnce(async () => {
    for (const [listener] of onAuthStateChange.mock.calls) listener('SIGNED_OUT', null)
    return {error: {message: 'unavailable'}}
  })
  render(<AccountTheme userId="one" initialTheme="dark"><AccountControls userId="one" displayName="River" profileError={false}/><SettingsClient userId="one" email="one@example.test" initialDisplayName="River"/><SignOutButton userId="one"/></AccountTheme>)
  fireEvent.click(screen.getByRole('button', {name: 'Sign out'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign out. Try again.')
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  expect(screen.queryByDisplayValue('one@example.test')).not.toBeInTheDocument()
  expect(screen.queryAllByText('River')).toHaveLength(0)
  expect(screen.getByRole('button', {name: 'Sign out'})).toBeEnabled()
  expect(refresh).not.toHaveBeenCalled()
  expect(replace).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', {name: 'Sign out'}))
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/sign-in'))
})
test('waits for the browser owner before allowing sign-out', () => {
  onAuthStateChange.mockImplementation(() => ({data: {subscription: {unsubscribe: vi.fn()}}}))
  show()
  const button = screen.getByRole('button', {name: 'Sign out'})
  expect(button).toBeDisabled()
  fireEvent.click(button)
  expect(signOut).not.toHaveBeenCalled()
  act(() => onAuthStateChange.mock.calls[0][0]('INITIAL_SESSION', {user: {id: 'two'}}))
  expect(button).toBeDisabled()
  expect(refresh).toHaveBeenCalled()
})
test('a failed old logout cannot show a retry for a replacement account', async () => {
  let finish!: (value: {error: {message: string}}) => void
  signOut.mockReturnValue(new Promise(resolve => { finish = resolve }))
  show(); fireEvent.click(screen.getByRole('button', {name: 'Sign out'}))
  act(() => onAuthStateChange.mock.calls[0][0]('SIGNED_IN', {user: {id: 'two'}}))
  await act(async () => finish({error: {message: 'unavailable'}}))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('button', {name: 'Sign out'})).toBeDisabled()
  expect(replace).not.toHaveBeenCalled()
  expect(refresh).toHaveBeenCalledTimes(1)
})


test('a cached sign-out button waits for ownership and ignores an old completion', async () => {
  sessionStorage.setItem('oneliner:capture:one', 'old owner draft')
  sessionStorage.setItem('oneliner:capture:two', 'replacement owner draft')
  let finish!: (value: {error: null}) => void
  signOut.mockReturnValue(new Promise(resolve => {finish = resolve}))
  const button = <SignOutButton userId="one"/>
  const view = render(<Activity mode="visible">{button}</Activity>)
  fireEvent.click(screen.getByRole('button', {name: 'Sign out'}))
  view.rerender(<Activity mode="hidden">{button}</Activity>)
  onAuthStateChange.mockImplementation(() => ({data: {subscription: {unsubscribe: vi.fn()}}}))
  view.rerender(<Activity mode="visible">{button}</Activity>)
  await act(async () => finish({error: null}))
  expect(sessionStorage.getItem('oneliner:capture:one')).toBeNull()
  expect(sessionStorage.getItem('oneliner:capture:two')).toBe('replacement owner draft')
  expect(replace).not.toHaveBeenCalled()
  expect(refresh).not.toHaveBeenCalled()
  expect(screen.getByRole('button', {name: 'Sign out'})).toBeDisabled()
})


test('sign-out clears only its owner capture draft when capture is not mounted', async () => {
  sessionStorage.setItem('oneliner:capture:one', 'private draft')
  sessionStorage.setItem('oneliner:capture:two', 'other owner draft')
  show(); fireEvent.click(screen.getByRole('button', {name: 'Sign out'}))
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/sign-in'))
  expect(sessionStorage.getItem('oneliner:capture:one')).toBeNull()
  expect(sessionStorage.getItem('oneliner:capture:two')).toBe('other owner draft')
})

test('failed sign-out retains its owner capture draft for retry', async () => {
  sessionStorage.setItem('oneliner:capture:one', 'private draft')
  signOut.mockResolvedValueOnce({error: {message: 'network'}})
  show(); fireEvent.click(screen.getByRole('button', {name: 'Sign out'}))
  await screen.findByRole('alert')
  expect(sessionStorage.getItem('oneliner:capture:one')).toBe('private draft')
})

test('storage failure is reported without blocking successful sign-out', async () => {
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('storage denied') })
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
  show(); fireEvent.click(screen.getByRole('button', {name: 'Sign out'}))
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/sign-in'))
  expect(logged).toHaveBeenCalledWith('Could not clear capture draft during sign-out.')
})


test('local SIGNED_OUT clears its owner draft even when remote logout fails', async () => {
  sessionStorage.setItem('oneliner:capture:one', 'private draft')
  sessionStorage.setItem('oneliner:capture:two', 'other owner draft')
  signOut.mockImplementationOnce(async () => {
    onAuthStateChange.mock.calls[0][0]('SIGNED_OUT', null)
    return {error: {message: 'unavailable'}}
  })
  show(); fireEvent.click(screen.getByRole('button', {name: 'Sign out'}))
  await screen.findByRole('alert')
  expect(sessionStorage.getItem('oneliner:capture:one')).toBeNull()
  expect(sessionStorage.getItem('oneliner:capture:two')).toBe('other owner draft')
})
