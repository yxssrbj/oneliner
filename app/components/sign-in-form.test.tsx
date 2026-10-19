// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import SignInForm from './sign-in-form'

const signInWithOtp = vi.fn()
const verifyOtp = vi.fn()
const replace = vi.fn()
const refresh = vi.fn()

vi.mock('../../lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithOtp, verifyOtp } }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh }) }))

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  signInWithOtp.mockResolvedValue({ error: null })
  verifyOtp.mockResolvedValue({ error: null })
})

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
  expect(replace).not.toHaveBeenCalled()
})

test('successful verification navigates to the signed-in shell', async () => {
  render(<SignInForm />)
  await userEvent.type(screen.getByLabelText(/email/i), 'trader@example.com')
  await userEvent.click(screen.getByRole('button', { name: /send code/i }))
  await userEvent.type(await screen.findByLabelText(/code/i), '12345678')
  await userEvent.click(screen.getByRole('button', { name: /verify code/i }))
  expect(verifyOtp).toHaveBeenCalledWith({ email: 'trader@example.com', token: '12345678', type: 'email' })
  expect(replace).toHaveBeenCalledWith('/')
  expect(refresh).toHaveBeenCalled()
})
