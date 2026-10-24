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
