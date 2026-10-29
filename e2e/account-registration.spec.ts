import {expect,test,type APIRequestContext} from '@playwright/test'

test.use({viewport:{width:1280,height:800}})

async function emailCode(request:APIRequestContext,email:string,subject:string){
  let id=''
  await expect.poll(async()=>{
    const response=await request.get('http://127.0.0.1:54324/api/v1/messages')
    const inbox=await response.json()
    id=inbox.messages.find((message:{To:{Address:string}[];Subject:string})=>message.Subject===subject && message.To.some(recipient=>recipient.Address===email))?.ID??''
    return id
  }).not.toBe('')
  const message=await(await request.get(`http://127.0.0.1:54324/api/v1/message/${id}`)).json()
  const code=/<strong>(\d{6,8})<\/strong>/.exec(message.HTML)?.[1]
  expect(code).toMatch(/^\d{6,8}$/)
  return code!
}

test('register, confirm, sign in, and recover password',async({page,request})=>{
  test.setTimeout(90_000)
  expect(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname).toBe('127.0.0.1')
  const email=`journey-${crypto.randomUUID()}@example.test`,username=`trader_${crypto.randomUUID().slice(0,8)}`
  const password='Original-pass-42!',replacement='Replacement-pass-42!'
  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button',{name:'Create account'}).click()
  await expect(page.getByLabel('Verification code')).toBeVisible()
  expect((await page.request.get('/api/trades')).status()).toBe(401)
  const code=await emailCode(request,email,'Verify your Oneliner account')
  await page.getByLabel('Verification code').fill(code==='000000'?'000001':'000000')
  await page.getByRole('button',{name:'Verify email'}).click()
  await expect(page.locator('.auth-form [role="alert"]')).toContainText('Invalid or expired code')
  await page.getByLabel('Verification code').fill(code)
  await page.getByRole('button',{name:'Verify email'}).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading',{name:'Capture a trade'})).toBeVisible()
  await page.goto('/settings')
  await expect(page.getByLabel('Display name')).toHaveValue(username)
  await page.getByRole('button',{name:'Sign out'}).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  expect((await page.request.get('/api/trades')).status()).toBe(401)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button',{name:'Sign in'}).click()
  await expect(page).toHaveURL('/')
  await page.goto('/settings')
  await page.getByRole('button',{name:'Sign out'}).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await page.getByRole('link',{name:'Forgot password?'}).click()
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button',{name:'Send recovery code'}).click()
  await expect(page.getByLabel('Recovery code')).toBeVisible()
  const recovery=await emailCode(request,email,'Reset your Oneliner password')
  await page.getByLabel('Recovery code').fill(recovery)
  await page.getByLabel('New password').fill(replacement)
  await page.getByLabel('Confirm password').fill(replacement)
  await page.getByRole('button',{name:'Reset password'}).click()
  await expect(page).toHaveURL('/sign-in?password=updated')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button',{name:'Sign in'}).click()
  await expect(page.locator('.auth-form [role="alert"]')).toContainText('Could not sign in')
  await page.getByLabel('Password').fill(replacement)
  await page.getByRole('button',{name:'Sign in'}).click()
  await expect(page).toHaveURL('/')
})
