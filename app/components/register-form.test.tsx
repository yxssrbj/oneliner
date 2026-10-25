// @vitest-environment jsdom
import {afterEach,beforeEach,expect,test,vi} from 'vitest'
import {cleanup,render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import RegisterForm from './register-form'

const signUp=vi.fn(),verifyOtp=vi.fn(),navigate=vi.fn()
vi.mock('../../lib/supabase/client',()=>({createSupabaseBrowserClient:()=>({auth:{signUp,verifyOtp}})}))
beforeEach(()=>{cleanup();vi.clearAllMocks();vi.stubGlobal('location',{replace:navigate});signUp.mockResolvedValue({data:{user:{id:'one'},session:null},error:null});verifyOtp.mockResolvedValue({data:{user:{id:'one'},session:{user:{id:'one'}}},error:null})})
afterEach(()=>vi.unstubAllGlobals())

async function register(){
  await userEvent.type(screen.getByLabelText('Email'),'trader@example.test')
  await userEvent.type(screen.getByLabelText('Username'),'Trader_One')
  await userEvent.type(screen.getByLabelText('Password'),'Example-pass-42!')
  await userEvent.click(screen.getByRole('button',{name:'Create account'}))
}

test('creates an account with a normalized username and waits for confirmation',async()=>{
  render(<RegisterForm/>);await register()
  expect(signUp).toHaveBeenCalledWith({email:'trader@example.test',password:'Example-pass-42!',options:{data:{username:'trader_one'}}})
  expect(await screen.findByLabelText('Verification code')).toHaveAttribute('maxlength','8')
  expect(navigate).not.toHaveBeenCalled()
})
test('rejects an invalid username before signup',async()=>{
  render(<RegisterForm/>);await userEvent.type(screen.getByLabelText('Username'),'bad name');await userEvent.click(screen.getByRole('button',{name:'Create account'}))
  expect(signUp).not.toHaveBeenCalled()
})
test('keeps the confirmation form on an invalid code',async()=>{
  verifyOtp.mockResolvedValue({data:{user:null,session:null},error:new Error('expired')})
  render(<RegisterForm/>);await register();await userEvent.type(await screen.findByLabelText('Verification code'),'12345678');await userEvent.click(screen.getByRole('button',{name:'Verify email'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid or expired code')
  expect(navigate).not.toHaveBeenCalled()
})
test('verified signup follows only a valid invite',async()=>{
  render(<RegisterForm invite="https://evil.example"/>);await register();await userEvent.type(await screen.findByLabelText('Verification code'),'12345678');await userEvent.click(screen.getByRole('button',{name:'Verify email'}))
  expect(verifyOtp).toHaveBeenCalledWith({email:'trader@example.test',token:'12345678',type:'email'})
  expect(navigate).toHaveBeenCalledWith('/')
})
