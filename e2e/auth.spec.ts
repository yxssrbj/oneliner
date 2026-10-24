import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1280, height: 800 } })

test('email code signs in and opens the desktop shell', async ({ page, request }) => {
  const email = `oneliner-${Date.now()}@example.test`
  expect((await request.get('http://localhost:3012/api/profile')).status()).toBe(401)
  await page.goto('http://localhost:3012/')
  await expect(page).toHaveURL(/\/sign-in$/)
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Send code' }).click()
  await expect(page.getByLabel('Code')).toBeVisible()

  let messageId = ''
  await expect.poll(async () => {
    const response = await request.get('http://127.0.0.1:54324/api/v1/messages')
    const inbox = await response.json()
    messageId = inbox.messages.find((message: { To: { Address: string }[] }) => message.To.some((recipient) => recipient.Address === email))?.ID ?? ''
    return messageId
  }).not.toBe('')

  const message = await (await request.get(`http://127.0.0.1:54324/api/v1/message/${messageId}`)).json()
  const code = /Enter this code in Oneliner:\s*<strong>(\d{6})<\/strong>/.exec(message.HTML)?.[1]
  expect(code).toMatch(/^\d{6}$/)
  await page.getByLabel('Code').fill(code === '000000' ? '000001' : '000000')
  await page.getByRole('button', { name: 'Verify code' }).click()
  await expect(page.locator('.auth-form [role="alert"]')).toContainText('Invalid or expired')

  await page.getByLabel('Code').fill(code!)
  await page.getByRole('button', { name: 'Verify code' }).click()
  await expect(page).toHaveURL('http://localhost:3012/')
  await expect(page.getByRole('heading', { name: 'Capture a trade' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).last()).toBeVisible()

  await page.goto('/review?demo=1')
  await expect(page.getByRole('note')).toHaveText('Demo preview — sample data only. Nothing is saved.')
  await expect(page.locator('.week-metrics')).toContainText('+2.50R')
  await expect(page.locator('.week-metrics')).toContainText('50.0%')
  await page.getByRole('button', { name: 'Previous week' }).click()
  await expect(page.locator('.week-metrics')).toContainText('25.0%')
  await expect(page.locator('.week-metrics')).toContainText('0.00R')
  await page.getByRole('button', { name: 'Previous week' }).click()
  await expect(page.locator('.week-metrics')).toContainText('60.0%')
  await expect(page.locator('.week-metrics')).toContainText('+2.00R')
  await page.getByRole('button', { name: 'Previous week' }).click()
  await expect(page.getByText('No trades opened this week.')).toBeVisible()
  expect((await (await page.request.get('/api/trades')).json()).trades).toEqual([])

  const before = await page.evaluate(async () => {
    const response = await fetch('/api/profile')
    return { status: response.status, body: await response.json() }
  })
  expect(before).toEqual({ status: 200, body: { displayName: null } })
  const saved = await page.evaluate(async () => {
    const response = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: 'A trader', id: 'another-user' }) })
    return { status: response.status, body: await response.json() }
  })
  expect(saved).toEqual({ status: 200, body: { displayName: 'A trader' } })

  await page.goto('/friends')
  await expect(page.getByLabel('Display name')).toHaveValue('A trader')
  await page.getByLabel('Display name').fill('River trader')
  await page.getByRole('button', { name: 'Save display name' }).click()
  await expect(page.locator('.account-name:visible')).toHaveText('River trader')

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Unfinished' }).click()
  await expect(page.getByRole('heading', { name: 'Unfinished' })).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.getByRole('complementary')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(1)
  const privateSave = await page.request.post('/api/trades', {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    data: { originalNote: 'First account private note', symbol: 'ES', side: 'long', entryPrice: '100', stopPrice: '99', setup: 'breakout', openedAt: new Date().toISOString() },
  })
  expect(privateSave.status()).toBe(201)

  await page.getByRole('link', {name: /River trader Personal workspace/}).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByRole('complementary').getByRole('button', {name: 'Sign out'})).toHaveCount(0)
  await expect(page.getByRole('button', {name: 'Sign out', exact: true})).toHaveCount(1)
  await page.route('**/auth/v1/logout*', route => route.fulfill({status: 503, contentType: 'application/json', body: JSON.stringify({message: 'Try again'})}))
  await page.getByRole('button', {name: 'Sign out'}).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.settings-sign-out [role="alert"]')).toHaveText('Could not sign out. Try again.')
  await expect(page.locator('.account-name:visible')).toHaveText('Trader')
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByLabel('Email address')).toHaveCount(0)
  await expect(page.getByRole('button', {name: 'Sign out'})).toBeEnabled()
  await page.unroute('**/auth/v1/logout*')
  await page.getByRole('button', {name: 'Sign out'}).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/sign-in$/)
  expect((await page.request.get('/api/profile')).status()).toBe(401)
  expect((await page.request.get('/api/trades')).status()).toBe(401)
  await page.goto('/settings')
  await expect(page).toHaveURL(/\/sign-in$/)

  const secondEmail = `second-${Date.now()}@example.test`
  await page.getByLabel('Email').fill(secondEmail)
  await page.getByRole('button', {name: 'Send code'}).click()
  let secondId = ''
  await expect.poll(async () => {
    const inbox = await (await request.get('http://127.0.0.1:54324/api/v1/messages')).json()
    secondId = inbox.messages.find((item: {To: {Address: string}[]}) => item.To.some(recipient => recipient.Address === secondEmail))?.ID ?? ''
    return secondId
  }).not.toBe('')
  const secondMessage = await (await request.get(`http://127.0.0.1:54324/api/v1/message/${secondId}`)).json()
  const secondCode = /Enter this code in Oneliner:\s*<strong>(\d{6})<\/strong>/.exec(secondMessage.HTML)?.[1]
  expect(secondCode).toMatch(/^\d{6}$/)
  await page.getByLabel('Code').fill(secondCode!)
  await page.getByRole('button', {name: 'Verify code'}).click()
  await expect(page).toHaveURL('http://localhost:3012/')
  await expect(page.locator('.account-name:visible')).toHaveText('Trader')
  await expect(page.locator('.account-name:visible').filter({hasText: 'River trader'})).toHaveCount(0)
  expect((await (await page.request.get('/api/profile')).json()).displayName).toBeNull()
  expect((await (await page.request.get('/api/trades')).json()).trades).toEqual([])
  await page.goBack()
  await expect(page.locator('.account-name:visible')).toHaveText('Trader')
  await expect(page.getByText('River trader', {exact: true})).toHaveCount(0)
  await page.goForward()
  await expect(page.locator('.account-name:visible')).toHaveText('Trader')
  await expect(page.getByText('River trader', {exact: true})).toHaveCount(0)
  await page.goto('/inbox')
  await expect(page.getByText('First account private note', {exact: true})).toHaveCount(0)
})

test('password sign-in keeps generic errors and the validated invitation destination', async ({page, request}) => {
  test.setTimeout(45_000)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  expect(new URL(url).hostname).toBe('127.0.0.1')
  const headers = {apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!}
  const email = `password-invite-${crypto.randomUUID()}@example.test`
  const password = `Example-${crypto.randomUUID()}-42!`
  expect((await request.post(`${url}/auth/v1/otp`, {headers, data: {email}})).ok()).toBeTruthy()
  let messageId = ''
  await expect.poll(async () => {
    const inbox = await (await request.get('http://127.0.0.1:54324/api/v1/messages')).json()
    messageId = inbox.messages.find((message: {To: {Address: string}[]}) => message.To.some(recipient => recipient.Address === email))?.ID ?? ''
    return messageId
  }).not.toBe('')
  const message = await (await request.get(`http://127.0.0.1:54324/api/v1/message/${messageId}`)).json()
  const token = /<strong>(\d{6,8})<\/strong>/.exec(message.HTML)?.[1]
  expect(token).toBeTruthy()
  const verified = await request.post(`${url}/auth/v1/verify`, {headers, data: {email, token, type: 'email'}})
  expect(verified.ok()).toBeTruthy()
  const session = await verified.json()
  expect((await request.put(`${url}/auth/v1/user`, {headers: {...headers, Authorization: `Bearer ${session.access_token}`}, data: {password}})).ok()).toBeTruthy()
  expect((await request.post(`${url}/auth/v1/logout?scope=local`, {headers: {...headers, Authorization: `Bearer ${session.access_token}`}})).ok()).toBeTruthy()
  const invite = crypto.randomUUID()
  await page.goto(`/sign-in?invite=${invite}`)
  await page.getByRole('button', {name: 'Use password instead'}).click()
  const error = 'Could not sign in. Check your email and password or use an email code.'
  await page.getByLabel('Email', {exact: true}).fill(`missing-${crypto.randomUUID()}@example.test`)
  await page.getByLabel('Password', {exact: true}).fill(password)
  await page.getByRole('button', {name: 'Sign in', exact: true}).click()
  await expect(page.locator('.auth-form [role="alert"]')).toHaveText(error)
  await page.getByLabel('Email', {exact: true}).fill(email)
  await page.getByLabel('Password', {exact: true}).fill('Wrong-password-42!')
  await page.getByRole('button', {name: 'Sign in', exact: true}).click()
  await expect(page.locator('.auth-form [role="alert"]')).toHaveText(error)
  await page.getByLabel('Password', {exact: true}).fill(password)
  await page.getByRole('button', {name: 'Sign in', exact: true}).click()
  await expect(page).toHaveURL(`/friends/invite/${invite}`)
  await expect(page.getByRole('heading', {name: 'Join a private group'})).toBeVisible()
})

test('sign-in blocks credential entry until its browser listeners are ready', async ({page}) => {
  test.setTimeout(20_000)
  let release!: () => void
  const scripts = new Promise<void>(resolve => {release = resolve})
  await page.route('**/_next/static/**/*.js', async route => {await scripts; await route.continue()})
  try {
    await page.goto('/sign-in?password=updated', {waitUntil: 'commit'})
    await expect(page.getByLabel('Email', {exact: true})).toBeDisabled()
    await expect(page.getByLabel('Password', {exact: true})).toBeDisabled()
    await expect(page.getByRole('button', {name: 'Sign in', exact: true})).toBeDisabled()
    release()
    await expect(page.getByLabel('Email', {exact: true})).toBeEnabled()
    await expect(page.getByLabel('Password', {exact: true})).toBeEnabled()
    await page.getByLabel('Email', {exact: true}).fill('ready@example.test')
    await page.getByLabel('Password', {exact: true}).fill('Ready-example-pass-42!')
    await expect(page.getByLabel('Email', {exact: true})).toHaveValue('ready@example.test')
  } finally {release()}
})
