// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import SignInForm from './sign-in-form'

const signInWithOtp = vi.fn()
const verifyOtp = vi.fn()
const signInWithPassword = vi.fn()
const onAuthStateChange = vi.fn()
const navigate = vi.fn()

vi.mock('../../lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithOtp, verifyOtp, signInWithPassword, onAuthStateChange } }),
}))

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  onAuthStateChange.mockImplementation(listener => {listener('INITIAL_SESSION', null); return {data: {subscription: {unsubscribe: vi.fn()}}}})
  vi.stubGlobal('location', { replace: navigate })
  signInWithOtp.mockResolvedValue({ error: null })
  verifyOtp.mockResolvedValue({ error: null })
  signInWithPassword.mockResolvedValue({data: {user: {id: 'one'}, session: {user: {id: 'one'}}}, error: null})
})

afterEach(() => vi.unstubAllGlobals())

test('requires an email before requesting a code', async () => {
  render(<SignInForm />)
  await userEvent.click(screen.getByRole('button', { name: /send code/i }))
  expect(screen.getByLabelText(/email/i)).toBeInvalid()
  expect(signInWithOtp).not.toHaveBeenCalled()
})

test('requests a code and accepts the configured eight-digit token', async () => {
  render(<SignInForm />)
  await userEvent.type(screen.getByLabelText(/email/i), 'trader@example.com')
  await userEvent.click(screen.getByRole('button', { name: /send code/i }))
  expect(await screen.findByLabelText(/code/i)).toBeInTheDocument()
  expect(screen.getByText(/enter the code sent to/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/code/i)).toHaveAttribute('maxlength', '8')
  expect(signInWithOtp).toHaveBeenCalledWith({ email: 'trader@example.com' })
})

test('invalid code keeps the form available with a recoverable error', async () => {
  verifyOtp.mockResolvedValue({ error: new Error('Invalid token') })
  render(<SignInForm />)
  await userEvent.type(screen.getByLabelText(/email/i), 'trader@example.com')
  await userEvent.click(screen.getByRole('button', { name: /send code/i }))
  await userEvent.type(await screen.findByLabelText(/code/i), '123456')
  await userEvent.click(screen.getByRole('button', { name: /verify code/i }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/invalid or expired/i)
  expect(screen.getByRole('button', { name: /verify code/i })).toBeEnabled()
  expect(navigate).not.toHaveBeenCalled()
})

test('successful verification starts a fresh document to clear previous session routes', async () => {
  render(<SignInForm />)
  await userEvent.type(screen.getByLabelText(/email/i), 'trader@example.com')
  await userEvent.click(screen.getByRole('button', { name: /send code/i }))
  await userEvent.type(await screen.findByLabelText(/code/i), '12345678')
  await userEvent.click(screen.getByRole('button', { name: /verify code/i }))
  expect(verifyOtp).toHaveBeenCalledWith({ email: 'trader@example.com', token: '12345678', type: 'email' })
  expect(navigate).toHaveBeenCalledWith('/')
})

test.each(['50000000-0000-0000-0000-000000000001','https://evil.example'])('invite continuation accepts only a UUID: %s',async(invite)=>{
  render(<SignInForm invite={invite} />)
  await userEvent.type(screen.getByLabelText(/email/i),'trader@example.com')
  await userEvent.click(screen.getByRole('button',{name:/send code/i}))
  await userEvent.type(await screen.findByLabelText(/code/i),'12345678')
  await userEvent.click(screen.getByRole('button',{name:/verify code/i}))
  expect(navigate).toHaveBeenCalledWith(invite.startsWith('https')?'/':`/friends/invite/${invite}`)
})

async function enterPassword() {
  await userEvent.click(screen.getByRole('button', {name: 'Use password instead'}))
  await userEvent.type(screen.getByLabelText('Email'), 'trader@example.com')
  await userEvent.type(screen.getByLabelText('Password', {exact: true}), 'Example-long-pass-42!')
}

test.each(['50000000-0000-0000-0000-000000000001', 'https://evil.example', undefined])('password sign-in starts a fresh document with a validated invite: %s', async invite => {
  render(<SignInForm invite={invite}/>)
  await enterPassword()
  await userEvent.click(screen.getByRole('button', {name: 'Sign in'}))
  expect(signInWithPassword).toHaveBeenCalledWith({email: 'trader@example.com', password: 'Example-long-pass-42!'})
  expect(navigate).toHaveBeenCalledWith(invite?.startsWith('5000') ? `/friends/invite/${invite}` : '/')
  expect(screen.getByLabelText('Password', {exact: true})).toHaveValue('')
})

test.each(['unknown-account', 'wrong-password', 'network', 'unconfirmed'])('password sign-in gives the same generic recoverable error for %s', async failure => {
  if (failure === 'network') signInWithPassword.mockRejectedValue(new Error('Secret provider diagnostic'))
  else if (failure === 'unconfirmed') signInWithPassword.mockResolvedValue({data: {user: null, session: null}, error: null})
  else signInWithPassword.mockResolvedValue({data: {user: null, session: null}, error: new Error(`${failure}: trader@example.com`)})
  render(<SignInForm/>)
  await enterPassword()
  await userEvent.click(screen.getByRole('button', {name: 'Sign in'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign in. Check your email and password or use an email code.')
  expect(screen.getByRole('alert')).not.toHaveTextContent('trader@example.com')
  expect(screen.getByRole('button', {name: 'Sign in'})).toBeEnabled()
  expect(navigate).not.toHaveBeenCalled()
})

test('password sign-in stays pending and prevents duplicate submissions', async () => {
  let finish!: (value: unknown) => void
  signInWithPassword.mockReturnValue(new Promise(resolve => {finish = resolve}))
  render(<SignInForm/>)
  await enterPassword()
  await userEvent.dblClick(screen.getByRole('button', {name: 'Sign in'}))
  expect(screen.getByRole('button', {name: 'Please wait…'})).toBeDisabled()
  expect(screen.getByRole('button', {name: 'Use email code instead'})).toBeDisabled()
  expect(signInWithPassword).toHaveBeenCalledTimes(1)
  expect(navigate).not.toHaveBeenCalled()
  finish({data: {user: {id: 'one'}, session: {user: {id: 'one'}}}, error: null})
  await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/'))
})

test('switching to email code clears the password and preserves OTP sign-in', async () => {
  render(<SignInForm/>)
  await enterPassword()
  await userEvent.click(screen.getByRole('button', {name: 'Use email code instead'}))
  expect(screen.queryByLabelText('Password', {exact: true})).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', {name: 'Send code'}))
  await userEvent.type(await screen.findByLabelText('Code'), '123456')
  await userEvent.click(screen.getByRole('button', {name: 'Verify code'}))
  expect(verifyOtp).toHaveBeenCalledWith({email: 'trader@example.com', token: '123456', type: 'email'})
  expect(navigate).toHaveBeenCalledWith('/')
  expect(signInWithPassword).not.toHaveBeenCalled()
})

test('a completed password update opens password sign-in with a clear confirmation', () => {
  render(<SignInForm passwordUpdated/>)
  expect(screen.getByRole('status')).toHaveTextContent('Password updated. Sign in with your new password.')
  expect(screen.getByLabelText('Password', {exact: true})).toBeVisible()
  expect(screen.getByRole('button', {name: 'Use email code instead'})).toBeEnabled()
})

test('sign-in disables credential entry until browser authentication initializes', async () => {
  let initialize!: () => void
  onAuthStateChange.mockImplementation(listener => {initialize = () => listener('INITIAL_SESSION', null); return {data: {subscription: {unsubscribe: vi.fn()}}}})
  render(<SignInForm passwordUpdated/>)
  expect(screen.getByLabelText('Email')).toBeDisabled()
  expect(screen.getByLabelText('Password', {exact: true})).toBeDisabled()
  expect(screen.getByRole('button', {name: 'Sign in'})).toBeDisabled()
  await userEvent.click(screen.getByRole('button', {name: 'Sign in'}))
  expect(signInWithPassword).not.toHaveBeenCalled()
  act(() => initialize())
  await vi.waitFor(() => expect(screen.getByLabelText('Email')).toBeEnabled())
})
