import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import {execFileSync} from 'node:child_process'

async function signIn(page: Page, request: APIRequestContext, email: string, captureIdentity = false) {
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Send code', exact: true }).click()
  await expect(page.getByLabel('Code', { exact: true })).toBeVisible()
  let messageId = ''
  await expect.poll(async () => {
    const inbox = await (await request.get('http://127.0.0.1:54324/api/v1/messages')).json()
    messageId = inbox.messages.find((message: { To: { Address: string }[] }) => message.To.some(recipient => recipient.Address === email))?.ID ?? ''
    return messageId
  }).not.toBe('')
  const message = await (await request.get(`http://127.0.0.1:54324/api/v1/message/${messageId}`)).json()
  const code = /<strong>(\d{6})<\/strong>/.exec(message.HTML)?.[1]
  expect(code).toBeTruthy()
  await page.getByLabel('Code', { exact: true }).fill(code!)
  let userId = ''
  if (captureIdentity) await page.route('**/auth/v1/verify', async route => {
    const response = await route.fetch()
    userId = (await response.json()).user?.id ?? ''
    await route.fulfill({response})
  })
  await page.getByRole('button', { name: 'Verify code', exact: true }).click()
  await expect(page).toHaveURL('http://localhost:3012/')
  if (captureIdentity) {await page.unroute('**/auth/v1/verify'); expect(userId).not.toBe('')}
  return {userId, messageId}
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
  test(`settings saves own identity and separates accounts at ${viewport.width}×${viewport.height}`, async ({ page, request, browser }, testInfo) => {
    test.setTimeout(60_000)
    page.setDefaultTimeout(10_000)
    page.setDefaultNavigationTimeout(10_000)
    await page.setViewportSize(viewport)
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/sign-in$/)
    const email = `settings-${crypto.randomUUID()}@example.test`
    await signIn(page, request, email)
    await page.getByRole('link', { name: /Trader Personal workspace/ }).click()
    await expect(page).toHaveURL(/\/settings$/)
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
    await expect(page.getByLabel('Email address')).toHaveValue(email)
    await expect(page.getByLabel('Email address')).toHaveAttribute('readonly', '')
    await expect(page.getByRole('complementary')).not.toContainText(email)
    await expect(page.locator('.account-profile:visible')).toHaveAttribute('aria-current', 'page')
    await expect(page.getByLabel('Display name')).toHaveValue('')
    const signOut = page.getByRole('button', { name: 'Sign out', exact: true })
    await expect(signOut).toHaveCount(1)
    await expect(page.getByRole('complementary').getByRole('button', { name: 'Sign out' })).toHaveCount(0)
    expect(await signOut.evaluate(button => button.closest('.settings-panel'))).toBeNull()
    await page.getByLabel('Display name').fill('   ')
    await page.getByRole('button', { name: 'Save display name' }).click()
    await expect(page.locator('.settings-workspace:visible').getByRole('alert')).toContainText('1–80')

    await page.getByLabel('Display name').fill('Unsaved name')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.route('**/auth/v1/user*', route => route.request().method() === 'PUT' ? route.fulfill({status: 503, json: {message: 'Unavailable'}}) : route.continue())
    await page.getByRole('button', { name: 'Switch to light mode' }).click()
    await expect(page.locator('.settings-workspace:visible').getByRole('alert')).toHaveText('Could not save appearance. Try again.')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByLabel('Display name')).toHaveValue('Unsaved name')
    await page.unroute('**/auth/v1/user*')
    const update = page.waitForRequest(request => request.url().includes('/auth/v1/user') && request.method() === 'PUT')
    await page.getByRole('button', { name: 'Switch to light mode' }).click()
    expect((await update).postDataJSON().data).toMatchObject({email, oneliner_theme: 'light'})
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
    await expect(page.getByLabel('Display name')).toHaveValue('Unsaved name')
    await page.route('**/api/profile', route => route.fulfill({ status: 503, json: { error: 'Unavailable' } }))
    await page.getByRole('button', { name: 'Save display name' }).click()
    await expect(page.locator('.settings-workspace:visible').getByRole('alert')).toHaveText('Could not save display name. Try again.')
    await expect(page.getByLabel('Display name')).toHaveValue('Unsaved name')
    await expect(page.locator('.account-name:visible')).toHaveText('Trader')
    await page.unroute('**/api/profile')
    const name = 'River Trader ' + 'x'.repeat(65)
    await page.getByLabel('Display name').fill(name)
    await page.getByRole('button', { name: 'Save display name' }).click()
    await expect(page.locator('.settings-workspace:visible').getByRole('status')).toHaveText('Display name saved.')
    await expect(page.locator('.account-name:visible')).toHaveText(name)
    await page.reload()
    await expect(page.getByLabel('Display name')).toHaveValue(name)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    for (const theme of ['light', 'dark'] as const) {
      if (theme === 'dark') await page.getByRole('button', {name: 'Switch to dark mode'}).click()
      await expect(page.locator('html')).toHaveCSS('color-scheme', theme)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
      await page.getByLabel('Display name').focus()
      await expect(page.getByLabel('Display name')).toHaveCSS('outline-style', 'solid')
      await expect(page.getByLabel('Display name')).toHaveCSS('background-color', theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(23, 27, 23)')
      const contrast = await page.getByLabel('Display name').evaluate(input => {
        const style = getComputedStyle(input)
        const luminance = (color: string) => {
          const channels = color.match(/\d+/g)!.slice(0, 3).map(Number).map(value => { const s = value / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4 })
          return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
        }
        const ratio = (a: string, b: string) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05) }
        return {text: ratio(style.color, style.backgroundColor), focus: ratio(style.outlineColor, style.backgroundColor)}
      })
      expect(contrast.text).toBeGreaterThanOrEqual(4.5)
      expect(contrast.focus).toBeGreaterThanOrEqual(3)
      await page.getByRole('button', {name: `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}).focus()
      await expect(page.getByRole('button', {name: `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`})).toHaveCSS('outline-style', 'solid')
      await page.screenshot({ path: testInfo.outputPath(`settings-${theme}.png`), fullPage: true, animations: 'disabled' })
    }
    await page.getByRole('button', {name: 'Switch to light mode'}).click()
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
    for (const path of ['/review', '/', '/inbox', '/friends', `/friends/invite/${crypto.randomUUID()}`]) {
      await page.goto(path)
      await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    }
    await page.goto('/settings')

    const creation = await page.request.post('/api/groups', { data: { name: 'Settings test group' } })
    expect(creation.status()).toBe(201)
    const { groupId } = await creation.json()
    await page.goto(`/friends?group=${groupId}`)
    await expect(page.getByRole('table', { name: 'Weekly group comparison' })).toContainText(name)
    await expect(page.getByRole('table', { name: 'Weekly group comparison' })).not.toContainText(email)
    await page.getByRole('link', { name: /River Trader.*Personal workspace/ }).click()
    await expect(page).toHaveURL(/\/settings$/)
    await expect(page.getByLabel('Email address')).toHaveValue(email)
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page).toHaveURL(/\/sign-in$/)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await signIn(page, request, `settings-second-${crypto.randomUUID()}@example.test`)
    await page.goto('/settings')
    await expect(page.getByLabel('Display name')).toHaveValue('')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
    await page.getByRole('button', {name: 'Switch to light mode'}).click()
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
    await page.getByRole('button', {name: 'Switch to dark mode'}).click()
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
    await expect(page.getByLabel('Email address')).not.toHaveValue(email)
    await expect(page.locator('body')).not.toContainText(name)
    expect((await (await page.request.get('/api/profile')).json()).displayName).toBeNull()
    await page.goBack()
    await expect(page.locator('.account-name:visible')).toHaveText('Trader')
    await expect(page.locator('body')).not.toContainText(name)
    await page.goForward()
    await expect(page.getByLabel('Display name')).toHaveValue('')
    await expect(page.getByLabel('Email address')).not.toHaveValue(email)
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
    await page.getByRole('button', {name: 'Sign out', exact: true}).click()
    await expect(page).toHaveURL(/\/sign-in$/)
    const device = await browser.newContext({baseURL: 'http://localhost:3012', viewport})
    try {
      const devicePage = await device.newPage()
      await devicePage.goto('/sign-in')
      await signIn(devicePage, request, email)
      await devicePage.goto('/settings')
      await expect(devicePage.getByLabel('Display name')).toHaveValue(name)
      await expect(devicePage.locator('html')).toHaveAttribute('data-theme', 'light')
      await expect(devicePage.locator('html')).toHaveCSS('color-scheme', 'light')
    } finally { await device.close() }
    expect(errors).toEqual([])
  })
}

test('a delayed browser session cannot reveal the server account profile', async ({ browser, request }) => {
  test.setTimeout(60_000)
  const first = await browser.newContext({ baseURL: 'http://localhost:3012' })
  const second = await browser.newContext({ baseURL: 'http://localhost:3012' })
  let releaseScripts!: () => void
  const scriptsReady = new Promise<void>(resolve => { releaseScripts = resolve })
  try {
    const firstPage = await first.newPage()
    await firstPage.goto('/sign-in')
    const firstEmail = `settings-delayed-first-${crypto.randomUUID()}@example.test`
    await signIn(firstPage, request, firstEmail)
    expect((await firstPage.request.put('/api/profile', { data: { displayName: 'First private owner' } })).ok()).toBeTruthy()
    await firstPage.goto('/settings')
    await firstPage.getByRole('button', {name: 'Switch to light mode'}).click()
    await expect(firstPage.locator('html')).toHaveAttribute('data-theme', 'light')
    const secondPage = await second.newPage()
    await secondPage.goto('/sign-in')
    const secondEmail = `settings-delayed-second-${crypto.randomUUID()}@example.test`
    await signIn(secondPage, request, secondEmail)
    expect((await secondPage.request.put('/api/profile', { data: { displayName: 'Second owner' } })).ok()).toBeTruthy()
    const delayed = await first.newPage()
    // Hold browser startup so its session can change after the server response.
    await delayed.route('**/_next/static/**/*.js', async route => { await scriptsReady; await route.continue() })
    await delayed.goto('/settings', { waitUntil: 'commit' })
    await expect(delayed.getByRole('status')).toHaveText('Updating account…')
    await expect(delayed.locator('.account-name')).toHaveText('Trader')
    await expect(delayed.locator('html')).toHaveCSS('color-scheme', 'dark')
    await expect(delayed.getByLabel('Email address')).toHaveCount(0)
    await expect(delayed.locator('.settings-identity')).toHaveCount(0)
    await first.clearCookies()
    await first.addCookies(await second.cookies())
    releaseScripts()
    await expect(delayed.getByLabel('Email address')).toHaveValue(secondEmail)
    await expect(delayed.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(delayed.getByLabel('Display name')).toHaveValue('Second owner')
    await expect(delayed.getByLabel('Email address')).not.toHaveValue(firstEmail)
    await expect(delayed.locator('.settings-identity')).not.toContainText('First private owner')
  } finally {
    releaseScripts()
    await first.close()
    await second.close()
  }
})


test('a delayed appearance response cannot restore the signed-out cookie session', async ({page, request}) => {
  test.setTimeout(45_000)
  await page.goto('/sign-in')
  await signIn(page, request, `settings-delayed-save-${crypto.randomUUID()}@example.test`)
  await page.goto('/settings')
  let release!: () => void
  let started!: () => void
  const putStarted = new Promise<void>(resolve => {started = resolve})
  const responseReady = new Promise<void>(resolve => {release = resolve})
  await page.route('**/auth/v1/user*', async route => {
    if (route.request().method() !== 'PUT') { await route.continue(); return }
    const response = await route.fetch()
    started()
    await responseReady
    await route.fulfill({response})
  })
  try {
    await page.getByRole('button', {name: 'Switch to light mode'}).click()
    await putStarted
    await page.getByRole('button', {name: 'Sign out', exact: true}).click()
    await expect(page).toHaveURL(/\/sign-in$/)
    const completed = page.waitForResponse(response => response.url().includes('/auth/v1/user') && response.request().method() === 'PUT')
    release()
    await (await completed).finished()
    await page.waitForLoadState('networkidle')
    expect((await page.request.get('/api/profile')).status()).toBe(401)
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/sign-in$/)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  } finally { release() }
})


test('verified password access keeps the OTP account, trades, and group membership', async ({page, request}, testInfo) => {
  test.setTimeout(100_000)
  execFileSync('node', ['scripts/local-auth-password-policy.mjs', 'check'], {timeout: 10_000, killSignal: 'SIGTERM'})
  page.setDefaultTimeout(10_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/sign-in')
  const email = `settings-password-${crypto.randomUUID()}@example.test`
  const {userId, messageId} = await signIn(page, request, email, true)
  const seen = new Set([messageId])
  async function verificationCode() {
    let id = ''
    await expect.poll(async () => {
      const inbox = await (await request.get('http://127.0.0.1:54324/api/v1/messages')).json()
      id = inbox.messages.find((message: {ID: string; To: {Address: string}[]}) => !seen.has(message.ID) && message.To.some(recipient => recipient.Address === email))?.ID ?? ''
      return id
    }).not.toBe('')
    seen.add(id)
    const message = await (await request.get(`http://127.0.0.1:54324/api/v1/message/${id}`)).json()
    const code = /<strong>(\d{6,8})<\/strong>/.exec(message.HTML)?.[1]
    expect(code).toBeTruthy()
    return code!
  }
  const trade = await page.request.post('/api/trades', {headers: {'Idempotency-Key': crypto.randomUUID()}, data: {originalNote: 'Password continuity private trade', symbol: 'ES', side: 'long', entryPrice: '100', stopPrice: '99', setup: 'breakout', openedAt: new Date().toISOString()}})
  expect(trade.status()).toBe(201)
  const tradeId = (await trade.json()).trade.id
  expect((await page.request.put('/api/profile', {data: {displayName: 'Password continuity trader'}})).status()).toBe(200)
  const group = await page.request.post('/api/groups', {data: {name: 'Password continuity group'}})
  expect(group.status()).toBe(201)
  const {groupId} = await group.json()
  const password = `Example-${crypto.randomUUID()}-42!`
  await page.goto('/settings')
  const panel = page.getByRole('region', {name: 'Password', exact: true})
  async function requestVerification() {
    await expect.poll(async () => {
      if (await panel.getByLabel('Verification code').count()) return true
      const send = panel.getByRole('button', {name: 'Send verification code'})
      if (await send.isEnabled()) await send.click()
      return (await panel.getByLabel('Verification code').count()) > 0
    }, {intervals: [1100], timeout: 7000}).toBeTruthy()
  }
  await panel.getByRole('button', {name: 'Use email code instead'}).click()
  await panel.getByLabel('New password', {exact: true}).fill(password)
  await panel.getByLabel('Confirm new password', {exact: true}).fill('Different-password-42!')
  await panel.getByRole('button', {name: 'Send verification code'}).click()
  await expect(panel.getByRole('alert')).toHaveText('Passwords do not match.')
  await panel.getByLabel('Confirm new password', {exact: true}).fill(password)
  await page.route('**/auth/v1/otp', route => route.fulfill({status: 503, json: {message: 'Unavailable'}}))
  await panel.getByRole('button', {name: 'Send verification code'}).click()
  await expect(panel.getByRole('alert')).toHaveText('Could not send a verification code. Try again.')
  await page.unroute('**/auth/v1/otp')
  expect((await page.request.get('/api/trades')).status()).toBe(200)
  await requestVerification()
  const code = await verificationCode()
  await panel.getByLabel('Verification code').fill(code === '000000' ? '000001' : '000000')
  await panel.getByRole('button', {name: 'Update password', exact: true}).click()
  await expect(panel.getByRole('alert')).toHaveText('Could not verify the code. Check it or request a new one.')
  expect((await page.request.get('/api/trades')).status()).toBe(200)
  await page.route('**/auth/v1/user*', route => route.request().method() === 'PUT' ? route.fulfill({status: 422, headers: {'X-Supabase-Api-Version': '2024-01-01'}, json: {error_code: 'weak_password', msg: 'Password rejected'}}) : route.continue())
  await panel.getByLabel('Verification code').fill(code)
  await panel.getByRole('button', {name: 'Update password', exact: true}).click()
  await expect(panel.getByRole('alert')).toHaveText('Choose a stronger password that meets the account password policy.')
  await expect(panel.getByLabel('New password', {exact: true})).toHaveValue(password)
  await page.unroute('**/auth/v1/user*')
  expect((await page.request.get('/api/groups')).status()).toBe(200)
  await page.setViewportSize({width: 1280, height: 800})
  await page.screenshot({path: testInfo.outputPath('password-form-1280.png'), fullPage: true})
  await page.setViewportSize({width: 1440, height: 900})
  await page.screenshot({path: testInfo.outputPath('password-form-1440.png'), fullPage: true})
  await requestVerification()
  await panel.getByLabel('Verification code').fill(await verificationCode())
  await panel.getByRole('button', {name: 'Update password', exact: true}).click()
  await expect(page).toHaveURL(/\/sign-in\?password=updated$/)
  await expect(page.getByRole('status')).toHaveText('Password updated. Sign in with your new password.')
  expect((await page.request.get('/api/profile')).status()).toBe(401)
  expect((await page.request.get('/api/trades')).status()).toBe(401)
  expect((await page.request.get('/api/groups')).status()).toBe(401)
  const storedAuthValues = (await page.context().cookies()).filter(cookie => cookie.name.startsWith('sb-') && cookie.value).length
  expect(storedAuthValues).toBe(0)
  await page.getByLabel('Email', {exact: true}).fill(email)
  await page.getByLabel('Password', {exact: true}).fill('Wrong-password-42!')
  await page.getByRole('button', {name: 'Sign in', exact: true}).click()
  await expect(page.locator('.auth-form [role="alert"]')).toHaveText('Could not sign in. Check your email and password or use an email code.')
  await page.getByLabel('Password', {exact: true}).fill(password)
  let signedInId = ''
  await page.route('**/auth/v1/token*', async route => {
    const response = await route.fetch()
    const body = await response.json()
    signedInId = body.user?.id ?? ''
    await route.fulfill({response})
  })
  await page.getByRole('button', {name: 'Sign in', exact: true}).click()
  await expect(page).toHaveURL('http://localhost:3012/')
  expect(signedInId).toBe(userId)
  const trades = (await (await page.request.get('/api/trades')).json()).trades
  expect(trades).toEqual(expect.arrayContaining([expect.objectContaining({id: tradeId})]))
  const groups = (await (await page.request.get('/api/groups')).json()).groups
  expect(groups).toEqual(expect.arrayContaining([expect.objectContaining({id: groupId})]))
  await page.goto('/settings')
  let capability: unknown = 'not called'
  await page.route('**/rest/v1/rpc/account_has_password', async route => {
    const response = await route.fetch()
    capability = await response.json()
    await route.fulfill({response})
  })
  await panel.getByRole('button', {name: 'Use email code instead'}).click()
  await panel.getByLabel('New password', {exact: true}).fill(`Email-only-${password}`)
  await panel.getByLabel('Confirm new password', {exact: true}).fill(`Email-only-${password}`)
  await requestVerification()
  await panel.getByLabel('Verification code').fill(await verificationCode())
  await panel.getByRole('button', {name: 'Update password', exact: true}).click()
  await expect.poll(() => capability).toBe(true)
  await expect(panel.getByRole('alert')).toHaveText('Your account requires its current password. Enter it to change your password.')
  await expect(panel.getByLabel('Current password')).toBeVisible()
  await expect(panel.getByRole('button', {name: 'Use email code instead'})).toHaveCount(0)
  await page.getByLabel('Current password').fill('Wrong-current-password-42!')
  await page.getByLabel('New password', {exact: true}).fill(`Changed-${password}`)
  await page.getByLabel('Confirm new password', {exact: true}).fill(`Changed-${password}`)
  await page.getByRole('button', {name: 'Send verification code'}).click()
  await expect(panel.getByRole('alert')).toHaveText('Could not verify your current password. Check it and try again.')
  expect((await page.request.get('/api/trades')).status()).toBe(200)
  await page.getByLabel('Current password').fill(password)
  await requestVerification()
  await panel.getByLabel('Verification code').fill(await verificationCode())
  await panel.getByRole('button', {name: 'Update password', exact: true}).click()
  await expect(page).toHaveURL(/\/sign-in\?password=updated$/)
  expect((await page.request.get('/api/trades')).status()).toBe(401)
  await page.getByLabel('Email', {exact: true}).fill(email)
  await page.getByLabel('Password', {exact: true}).fill(`Changed-${password}`)
  await page.getByRole('button', {name: 'Sign in', exact: true}).click()
  await expect(page).toHaveURL('http://localhost:3012/')
  expect(signedInId).toBe(userId)
  await page.unroute('**/auth/v1/token*')
  await page.goto('/settings')
  await page.getByRole('button', {name: 'Sign out', exact: true}).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await signIn(page, request, email)
  expect((await (await page.request.get('/api/trades')).json()).trades).toEqual(expect.arrayContaining([expect.objectContaining({id: tradeId})]))
  expect(errors).toEqual([])
})

test('a delayed isolated password response cannot sign out a replacement browser account', async ({page, request, context}) => {
  test.setTimeout(60_000)
  page.setDefaultTimeout(10_000)
  await page.goto('/sign-in')
  const email = `password-delayed-${crypto.randomUUID()}@example.test`
  const {messageId} = await signIn(page, request, email)
  await page.goto('/settings')
  await page.getByRole('button', {name: 'Use email code instead'}).click()
  await page.getByLabel('New password', {exact: true}).fill(`Example-${crypto.randomUUID()}-42!`)
  const password = await page.getByLabel('New password', {exact: true}).inputValue()
  await page.getByLabel('Confirm new password', {exact: true}).fill(password)
  await expect.poll(async () => {
    if (await page.getByLabel('Verification code').count()) return true
    const send = page.getByRole('button', {name: 'Send verification code'})
    if (await send.isEnabled()) await send.click()
    return (await page.getByLabel('Verification code').count()) > 0
  }, {intervals: [1100], timeout: 7000}).toBeTruthy()
  let id = ''
  await expect.poll(async () => {
    const inbox = await (await request.get('http://127.0.0.1:54324/api/v1/messages')).json()
    id = inbox.messages.find((message: {ID: string; To: {Address: string}[]}) => message.ID !== messageId && message.To.some(recipient => recipient.Address === email))?.ID ?? ''
    return id
  }).not.toBe('')
  const message = await (await request.get(`http://127.0.0.1:54324/api/v1/message/${id}`)).json()
  const code = /<strong>(\d{6,8})<\/strong>/.exec(message.HTML)?.[1]
  expect(code).toBeTruthy()
  let release!: () => void
  let processed = false
  const ready = new Promise<void>(resolve => {release = resolve})
  await page.route('**/auth/v1/user*', async route => {
    if (route.request().method() !== 'PUT') {await route.continue(); return}
    const response = await route.fetch()
    expect(response.status()).toBe(200)
    processed = true
    await ready
    await route.fulfill({response})
  })
  try {
    await page.getByLabel('Verification code').fill(code!)
    await page.getByRole('button', {name: 'Update password', exact: true}).click()
    await expect.poll(() => processed).toBeTruthy()
    const replacement = await context.newPage()
    const replacementEmail = `password-replacement-${crypto.randomUUID()}@example.test`
    await replacement.goto('/sign-in')
    await signIn(replacement, request, replacementEmail)
    expect((await replacement.request.put('/api/profile', {data: {displayName: 'Replacement password owner'}})).status()).toBe(200)
    const received = page.waitForResponse(response => response.url().includes('/auth/v1/user') && response.request().method() === 'PUT')
    release()
    await (await received).finished()
    await page.goto('/settings')
    await expect(page.getByLabel('Email address')).toHaveValue(replacementEmail)
    await expect(page.getByLabel('Display name')).toHaveValue('Replacement password owner')
    expect((await page.request.get('/api/trades')).status()).toBe(200)
    expect((await (await page.request.get('/api/trades')).json()).trades).toEqual([])
    await expect(page.getByLabel('New password', {exact: true})).toHaveValue('')
    expect((await replacement.request.get('/api/profile')).status()).toBe(200)
    await replacement.close()
  } finally {release()}
})
