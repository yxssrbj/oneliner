// @vitest-environment jsdom
import { Activity } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import SettingsClient from './settings-client'

const {refresh, navigate, signInWithOtp, signInWithPassword, verifyOtp, updateUser, signOut, dispose, accountHasPassword, listeners, owner} = vi.hoisted(() => ({
  refresh: vi.fn(), navigate: vi.fn(), signInWithOtp: vi.fn(), signInWithPassword: vi.fn(), verifyOtp: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), dispose: vi.fn(), accountHasPassword: vi.fn(),
  listeners: new Set<(event: string, session: {user: {id: string}} | null) => void>(), owner: {id: 'one'},
}))
vi.mock('next/navigation', () => {const router = {refresh}; return {useRouter: () => router}})
vi.mock('../components/account-controls', () => ({useAccountTheme: () => ({theme: 'dark', ownerConfirmed: true, confirmTheme: () => true})}))
vi.mock('../../lib/supabase/client', () => ({
  isLocalSignOutPending: () => false,
  createSupabaseBrowserClient: () => ({auth: {onAuthStateChange: (listener: (event: string, session: {user: {id: string}} | null) => void) => {
    listeners.add(listener); listener('INITIAL_SESSION', {user: {id: owner.id}})
    return {data: {subscription: {unsubscribe: () => listeners.delete(listener)}}}
  }}}),
  createPasswordVerificationClient: () => ({auth: {signInWithOtp, signInWithPassword, verifyOtp, updateUser, signOut, dispose}, rpc: accountHasPassword}),
}))
const confirmed = () => ({data: {user: {id: owner.id}, session: {user: {id: owner.id}}}, error: null})
beforeEach(() => {
  cleanup(); vi.clearAllMocks(); listeners.clear(); owner.id = 'one'
  vi.stubGlobal('location', {replace: navigate})
  signInWithOtp.mockResolvedValue({error: null})
  signInWithPassword.mockResolvedValue(confirmed())
  verifyOtp.mockResolvedValue(confirmed())
  updateUser.mockResolvedValue({data: {user: {id: 'one'}}, error: null})
  signOut.mockResolvedValue({error: null})
  dispose.mockResolvedValue(undefined)
  accountHasPassword.mockResolvedValue({data: false, error: null})
})
afterEach(() => {cleanup(); vi.unstubAllGlobals()})
function show() {return render(<SettingsClient userId={owner.id} email={`${owner.id}@example.test`} initialDisplayName="River"/>)}
function fill(label: string, value: string) {fireEvent.change(screen.getByLabelText(label, {exact: true}), {target: {value}})}
function submit(name: string) {fireEvent.submit(screen.getByRole('button', {name}).closest('form')!)}
async function begin(emailMode = true) {
  if (emailMode) fireEvent.click(screen.getByRole('button', {name: 'Use email code instead'}))
  else fill('Current password', 'Old-example-pass-42!')
  fill('New password', 'New-example-pass-42!'); fill('Confirm new password', 'New-example-pass-42!')
  submit('Send verification code')
  await screen.findByLabelText('Verification code', {exact: true})
}
async function finish() {fill('Verification code', '123456'); submit('Update password')}

test('the settings password card collects current password and keeps email verification available', () => {
  show()
  expect(screen.getByRole('heading', {name: 'Password'})).toBeVisible()
  expect(screen.getByLabelText('Current password')).toHaveAttribute('autocomplete', 'current-password')
  expect(screen.getByLabelText('New password')).toHaveAttribute('autocomplete', 'new-password')
  expect(screen.getByLabelText('Confirm new password')).toHaveAttribute('autocomplete', 'new-password')
})
test.each(['mismatch', 'short'])('rejects %s before sending verification email', failure => {
  show(); fireEvent.click(screen.getByRole('button', {name: 'Use email code instead'}))
  fill('New password', failure === 'short' ? 'short' : 'New-example-pass-42!')
  fill('Confirm new password', failure === 'short' ? 'short' : 'different')
  submit('Send verification code')
  expect(screen.getByRole('alert')).toHaveTextContent(failure === 'short' ? 'at least 8 characters' : 'Passwords do not match')
  expect(signInWithOtp).not.toHaveBeenCalled(); expect(updateUser).not.toHaveBeenCalled()
})
test('wrong current password never sends a code or updates the account', async () => {
  signInWithPassword.mockResolvedValue({data: {user: null, session: null}, error: new Error('private password diagnostic')})
  show(); fill('Current password', 'Wrong-example-pass-42!'); fill('New password', 'New-example-pass-42!'); fill('Confirm new password', 'New-example-pass-42!'); submit('Send verification code')
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not verify your current password. Check it or use an email code.')
  expect(signInWithOtp).not.toHaveBeenCalled(); expect(updateUser).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled()
})
test('a verified current password is checked independently and forwarded to the provider update', async () => {
  show(); await begin(false); await finish()
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/sign-in?password=updated'))
  expect(signInWithPassword).toHaveBeenCalledWith({email: 'one@example.test', password: 'Old-example-pass-42!'})
  expect(signInWithOtp).toHaveBeenCalledWith({email: 'one@example.test', options: {shouldCreateUser: false}})
  expect(updateUser).toHaveBeenCalledWith({password: 'New-example-pass-42!', current_password: 'Old-example-pass-42!'})
})
test.each(['provider', 'network'])('a %s email-send failure leaves the password unchanged and permits retry', async failure => {
  if (failure === 'network') signInWithOtp.mockRejectedValue(new Error('private request diagnostic'))
  else signInWithOtp.mockResolvedValue({error: new Error('private email diagnostic')})
  show(); fireEvent.click(screen.getByRole('button', {name: 'Use email code instead'})); fill('New password', 'New-example-pass-42!'); fill('Confirm new password', 'New-example-pass-42!'); submit('Send verification code')
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not send a verification code. Try again.')
  expect(screen.getByRole('button', {name: 'Send verification code'})).toBeEnabled()
  expect(screen.queryByLabelText('Verification code')).not.toBeInTheDocument()
  expect(updateUser).not.toHaveBeenCalled()
})
test.each(['wrong', 'expired', 'network', 'wrong-owner', 'missing-session'])('a %s code never updates the password', async failure => {
  if (failure === 'network') verifyOtp.mockRejectedValue(new Error('private request diagnostic'))
  else if (failure === 'wrong-owner') verifyOtp.mockResolvedValue({data: {user: {id: 'two'}, session: {user: {id: 'two'}}}, error: null})
  else if (failure === 'missing-session') verifyOtp.mockResolvedValue({data: {user: {id: 'one'}, session: null}, error: null})
  else verifyOtp.mockResolvedValue({data: {user: null, session: null}, error: new Error(failure)})
  show(); await begin(); await finish()
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not verify the code. Check it or request a new one.')
  expect(screen.getByRole('button', {name: 'Update password'})).toBeEnabled()
  expect(updateUser).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled()
})
test.each(['weak', 'provider', 'network', 'wrong-owner', 'unconfirmed'])('a %s update failure never reports success and permits corrected details', async failure => {
  if (failure === 'network') updateUser.mockRejectedValue(new Error('private request diagnostic'))
  else if (failure === 'weak') updateUser.mockResolvedValue({data: {user: null}, error: {code: 'weak_password', message: 'private password'}})
  else if (failure === 'wrong-owner') updateUser.mockResolvedValue({data: {user: {id: 'two'}}, error: null})
  else if (failure === 'unconfirmed') updateUser.mockResolvedValue({data: {user: null}, error: null})
  else updateUser.mockResolvedValue({data: {user: null}, error: new Error('private provider diagnostic')})
  show(); await begin(); await finish()
  expect(await screen.findByRole('alert')).toHaveTextContent(failure === 'weak' ? 'Choose a stronger password that meets the account password policy.' : 'Could not update password. Check the details and try again.')
  expect(screen.getByRole('alert')).not.toHaveTextContent('private')
  expect(screen.queryByRole('status')).not.toHaveTextContent('Password updated')
  expect(screen.getByLabelText('New password')).toHaveValue('New-example-pass-42!')
  expect(screen.getByRole('button', {name: 'Send verification code'})).toBeEnabled()
  expect(navigate).not.toHaveBeenCalled()
})
test('OTP-only password setup skips a nonexistent current password and succeeds only after confirmed update', async () => {
  let complete!: (value: unknown) => void
  updateUser.mockReturnValue(new Promise(resolve => {complete = resolve}))
  show(); await begin(); await finish()
  expect(screen.getByRole('button', {name: 'Updating password…'})).toBeDisabled()
  expect(navigate).not.toHaveBeenCalled()
  await waitFor(() => expect(updateUser).toHaveBeenCalledWith({password: 'New-example-pass-42!'}))
  expect(signInWithPassword).not.toHaveBeenCalled()
  await act(async () => complete({data: {user: {id: 'one'}}, error: null}))
  expect(navigate).toHaveBeenCalledWith('/sign-in?password=updated')
  expect(screen.getByLabelText('New password')).toHaveValue('')
  expect(screen.getByLabelText('Confirm new password')).toHaveValue('')
  expect(screen.queryByDisplayValue('123456')).not.toBeInTheDocument()
  expect(signOut).toHaveBeenCalledWith({scope: 'local'})
})
test.each(['configured', 'unavailable'])('email-only update fails closed when password capability is %s', async state => {
  accountHasPassword.mockResolvedValue(state === 'configured' ? {data: true, error: null} : {data: null, error: new Error('private database diagnostic')})
  show(); await begin(); await finish()
  expect(await screen.findByRole('alert')).toHaveTextContent(state === 'configured' ? 'Your account requires its current password.' : 'Could not confirm password access.')
  expect(updateUser).not.toHaveBeenCalled()
  expect(navigate).not.toHaveBeenCalled()
  expect(screen.getByLabelText('New password')).toHaveValue('New-example-pass-42!')
})
test('a replaced account cannot update after its password capability response', async () => {
  let answer!: (value: unknown) => void
  accountHasPassword.mockReturnValue(new Promise(resolve => {answer = resolve}))
  show(); await begin(); await finish()
  await waitFor(() => expect(accountHasPassword).toHaveBeenCalled())
  act(() => {owner.id = 'two'; for (const listener of listeners) listener('SIGNED_IN', {user: {id: 'two'}})})
  await act(async () => answer({data: false, error: null}))
  expect(updateUser).not.toHaveBeenCalled()
  expect(navigate).not.toHaveBeenCalled()
})
test('pending code requests and updates submit only once', async () => {
  let sent!: (value: unknown) => void
  signInWithOtp.mockReturnValue(new Promise(resolve => {sent = resolve}))
  show(); fireEvent.click(screen.getByRole('button', {name: 'Use email code instead'})); fill('New password', 'New-example-pass-42!'); fill('Confirm new password', 'New-example-pass-42!'); submit('Send verification code'); submit('Sending code…')
  expect(signInWithOtp).toHaveBeenCalledTimes(1)
  await act(async () => sent({error: null}))
  let updated!: (value: unknown) => void
  updateUser.mockReturnValue(new Promise(resolve => {updated = resolve}))
  await finish(); await waitFor(() => expect(updateUser).toHaveBeenCalledOnce()); submit('Updating password…')
  expect(updateUser).toHaveBeenCalledTimes(1)
  await act(async () => updated({data: {user: {id: 'one'}}, error: null}))
})
test.each(['SIGNED_OUT', 'SIGNED_IN'])('account %s clears credentials and ignores an old password response', async event => {
  let complete!: (value: unknown) => void
  updateUser.mockReturnValue(new Promise(resolve => {complete = resolve}))
  show(); await begin(false); await finish(); await waitFor(() => expect(updateUser).toHaveBeenCalledOnce())
  act(() => {owner.id = event === 'SIGNED_IN' ? 'two' : ''; for (const listener of listeners) listener(event, owner.id ? {user: {id: owner.id}} : null)})
  expect(screen.queryByDisplayValue('Old-example-pass-42!')).not.toBeInTheDocument()
  expect(screen.queryByDisplayValue('New-example-pass-42!')).not.toBeInTheDocument()
  expect(screen.queryByDisplayValue('123456')).not.toBeInTheDocument()
  await act(async () => complete({data: {user: {id: 'one'}}, error: null}))
  expect(navigate).not.toHaveBeenCalled()
})
test('an old code response cannot enable a resumed cached page', async () => {
  let complete!: (value: unknown) => void
  signInWithOtp.mockReturnValue(new Promise(resolve => {complete = resolve}))
  const content = (mode: 'visible' | 'hidden') => <Activity mode={mode}><SettingsClient userId="one" email="one@example.test" initialDisplayName="River"/></Activity>
  const view = render(content('visible'))
  fireEvent.click(screen.getByRole('button', {name: 'Use email code instead'})); fill('New password', 'New-example-pass-42!'); fill('Confirm new password', 'New-example-pass-42!'); submit('Send verification code')
  view.rerender(content('hidden')); view.rerender(content('visible'))
  await act(async () => complete({error: null}))
  expect(screen.queryByLabelText('Verification code')).not.toBeInTheDocument()
  expect(screen.getByLabelText('New password')).toHaveValue('')
  expect(navigate).not.toHaveBeenCalled()
})

test.each(['current_password_required', 'current_password_invalid'])('provider %s restores the current-password step without losing new-password details', async code => {
  updateUser.mockResolvedValue({data: {user: null}, error: {code, message: 'Private provider diagnostic'}})
  show(); await begin(); await finish()
  expect(await screen.findByRole('alert')).toHaveTextContent('Your account requires its current password. Enter it to change your password.')
  expect(screen.getByLabelText('Current password')).toHaveValue('')
  expect(screen.getByLabelText('New password')).toHaveValue('New-example-pass-42!')
  expect(screen.getByLabelText('Confirm new password')).toHaveValue('New-example-pass-42!')
  expect(screen.queryByLabelText('Verification code')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', {name: 'Use email code instead'})).not.toBeInTheDocument()
  expect(screen.getByRole('button', {name: 'Send verification code'})).toBeEnabled()
  expect(navigate).not.toHaveBeenCalled()
})
