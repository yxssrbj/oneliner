// @vitest-environment jsdom
import {afterEach,beforeEach,expect,test,vi} from 'vitest'
import {cleanup,render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import RecoverForm from './recover-form'
const resetPasswordForEmail=vi.fn(),verifyOtp=vi.fn(),updateUser=vi.fn(),signOut=vi.fn(),navigate=vi.fn()
vi.mock('../../lib/supabase/client',()=>({createSupabaseBrowserClient:()=>({auth:{resetPasswordForEmail,verifyOtp,updateUser,signOut}})}))
beforeEach(()=>{cleanup();vi.clearAllMocks();vi.stubGlobal('location',{replace:navigate});resetPasswordForEmail.mockResolvedValue({error:null});verifyOtp.mockResolvedValue({data:{user:{id:'one'},session:{user:{id:'one'}}},error:null});updateUser.mockResolvedValue({data:{user:{id:'one'}},error:null});signOut.mockResolvedValue({error:null})})
afterEach(()=>vi.unstubAllGlobals())
async function send(){render(<RecoverForm/>);await userEvent.type(screen.getByLabelText('Email'),'trader@example.test');await userEvent.click(screen.getByRole('button',{name:'Send recovery code'}));await screen.findByLabelText('Recovery code')}
async function fill(){await userEvent.type(screen.getByLabelText('Recovery code'),'12345678');await userEvent.type(screen.getByLabelText('New password'),'New-example-pass-42!');await userEvent.type(screen.getByLabelText('Confirm password'),'New-example-pass-42!')}
test('requests a recovery code without exposing account existence',async()=>{await send();expect(resetPasswordForEmail).toHaveBeenCalledWith('trader@example.test');expect(screen.getByText(/If an account exists/i)).toBeInTheDocument()})
test('wrong code keeps the password unchanged',async()=>{verifyOtp.mockResolvedValue({data:{user:null,session:null},error:new Error('expired')});await send();await fill();await userEvent.click(screen.getByRole('button',{name:'Reset password'}));expect(await screen.findByRole('alert')).toHaveTextContent('Invalid or expired code');expect(updateUser).not.toHaveBeenCalled()})
test('mismatched passwords do not verify the code',async()=>{await send();await userEvent.type(screen.getByLabelText('Recovery code'),'12345678');await userEvent.type(screen.getByLabelText('New password'),'New-example-pass-42!');await userEvent.type(screen.getByLabelText('Confirm password'),'different-pass');await userEvent.click(screen.getByRole('button',{name:'Reset password'}));expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match');expect(verifyOtp).not.toHaveBeenCalled()})
test('verified recovery updates the password and returns to sign-in',async()=>{await send();await fill();await userEvent.click(screen.getByRole('button',{name:'Reset password'}));expect(verifyOtp).toHaveBeenCalledWith({email:'trader@example.test',token:'12345678',type:'recovery'});expect(updateUser).toHaveBeenCalledWith({password:'New-example-pass-42!'});expect(signOut).toHaveBeenCalled();expect(navigate).toHaveBeenCalledWith('/sign-in?password=updated')})
