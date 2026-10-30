import {expect,type APIRequestContext,type Page} from '@playwright/test'

export async function emailCode(request:APIRequestContext,email:string,subject:string,seen=new Set<string>()){
  let id=''
  await expect.poll(async()=>{
    const inbox=await(await request.get('http://127.0.0.1:54324/api/v1/messages')).json()
    id=inbox.messages.find((message:{ID:string;Subject:string;To:{Address:string}[]})=>
      message.Subject===subject && !seen.has(message.ID) && message.To.some(recipient=>recipient.Address===email))?.ID??''
    return id
  }).not.toBe('')
  const message=await(await request.get(`http://127.0.0.1:54324/api/v1/message/${id}`)).json()
  const code=/<strong\b[^>]*>(\d{6,8})<\/strong>/.exec(message.HTML)?.[1]
  expect(code).toMatch(/^\d{6,8}$/)
  return {code:code!,id}
}

export async function registerAccount(page:Page,request:APIRequestContext,prefix:string,invite?:string,email=`${prefix}-${crypto.randomUUID()}@example.test`){
  const username=`user_${crypto.randomUUID().slice(0,8)}`
  const password=`Example-${crypto.randomUUID()}-42!`
  await page.goto(invite?`/register?invite=${invite}`:'/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button',{name:'Create account'}).click()
  await expect(page.getByLabel('Verification code')).toBeVisible()
  const {code,id}=await emailCode(request,email,'Confirm your Oneliner email')
  await page.getByLabel('Verification code').fill(code)
  await page.getByRole('button',{name:'Verify email'}).click()
  await expect(page).toHaveURL(invite?new RegExp(`/friends/invite/${invite}$`):'/')
  return {email,username,password,messageId:id}
}

export async function signInPassword(page:Page,email:string,password:string){
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button',{name:'Sign in',exact:true}).click()
  await expect(page).toHaveURL('/')
}
