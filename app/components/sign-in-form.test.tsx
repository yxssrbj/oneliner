// @vitest-environment jsdom
import {afterEach,beforeEach,expect,test,vi} from 'vitest'
import {cleanup,render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import SignInForm from './sign-in-form'
const signInWithPassword=vi.fn(),onAuthStateChange=vi.fn(),navigate=vi.fn()
vi.mock('../../lib/supabase/client',()=>({createSupabaseBrowserClient:()=>({auth:{signInWithPassword,onAuthStateChange}})}))
beforeEach(()=>{cleanup();vi.clearAllMocks();vi.stubGlobal('location',{replace:navigate});onAuthStateChange.mockImplementation(listener=>{listener('INITIAL_SESSION',null);return {data:{subscription:{unsubscribe:vi.fn()}}}});signInWithPassword.mockResolvedValue({data:{user:{id:'one'},session:{user:{id:'one'}}},error:null})})
afterEach(()=>vi.unstubAllGlobals())
async function fill(){await userEvent.type(screen.getByLabelText('Email'),'trader@example.test');await userEvent.type(screen.getByLabelText('Password'),'Example-pass-42!')}
test('password is the only sign-in method and clears itself on success',async()=>{render(<SignInForm/>);await fill();await userEvent.click(screen.getByRole('button',{name:'Sign in'}));expect(signInWithPassword).toHaveBeenCalledWith({email:'trader@example.test',password:'Example-pass-42!'});expect(navigate).toHaveBeenCalledWith('/');expect(screen.queryByRole('button',{name:/email code/i})).not.toBeInTheDocument();expect(screen.getByLabelText('Password')).toHaveValue('')})
test('failed sign-in gives a generic recoverable error',async()=>{signInWithPassword.mockResolvedValue({data:{user:null,session:null},error:new Error('secret')});render(<SignInForm/>);await fill();await userEvent.click(screen.getByRole('button',{name:'Sign in'}));expect(await screen.findByRole('alert')).toHaveTextContent('Check your email and password');expect(navigate).not.toHaveBeenCalled()})
test('only UUID invites can direct a successful sign-in',async()=>{render(<SignInForm invite="https://evil.example"/>);await fill();await userEvent.click(screen.getByRole('button',{name:'Sign in'}));expect(navigate).toHaveBeenCalledWith('/')})
