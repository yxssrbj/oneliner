import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

test('email code signs in and opens the mobile shell', async ({ page, request }) => {
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
  await expect(page.getByRole('heading', { name: 'Capture' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).last()).toBeVisible()

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

  await page.getByRole('navigation', { name: 'Main navigation' }).last().getByRole('link', { name: 'Inbox' }).click()
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible()
  await page.setViewportSize({ width: 1100, height: 800 })
  await expect(page.getByRole('complementary')).toBeVisible()
  await expect(page.locator('.mobile-nav').last()).toBeHidden()
})
