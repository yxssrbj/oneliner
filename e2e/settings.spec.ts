import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import {emailCode,registerAccount,signInPassword} from './account-helper'

const accounts=new Map<string,{password:string;username:string}>()

async function signIn(page:Page,request:APIRequestContext,email:string){
  const existing=accounts.get(email)
  if(existing){await signInPassword(page,email,existing.password);return existing}
  const account=await registerAccount(page,request,'settings',undefined,email)
  accounts.set(email,{password:account.password,username:account.username})
  return account
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
    const account=await signIn(page, request, email)
    await page.locator('.account-profile:visible').click()
    await expect(page).toHaveURL(/\/settings$/)
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
    await expect(page.getByLabel('Email address')).toHaveValue(email)
    await expect(page.getByLabel('Email address')).toHaveAttribute('readonly', '')
    await expect(page.getByRole('complementary')).not.toContainText(email)
    await expect(page.locator('.account-profile:visible')).toHaveAttribute('aria-current', 'page')
    await expect(page.getByLabel('Display name')).toHaveValue(account.username)
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
    await expect(page.locator('.account-name:visible')).toHaveText(account.username)
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
    const second=await signIn(page, request, `settings-second-${crypto.randomUUID()}@example.test`)
    await page.goto('/settings')
    await expect(page.getByLabel('Display name')).toHaveValue(second.username)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
    await page.getByRole('button', {name: 'Switch to light mode'}).click()
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
    await page.getByRole('button', {name: 'Switch to dark mode'}).click()
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
    await expect(page.getByLabel('Email address')).not.toHaveValue(email)
    await expect(page.locator('body')).not.toContainText(name)
    expect((await (await page.request.get('/api/profile')).json()).displayName).toBe(second.username)
    await page.goBack()
    await expect(page.locator('.account-name:visible')).toHaveText(second.username)
    await expect(page.locator('body')).not.toContainText(name)
    await page.goForward()
    await expect(page.getByLabel('Display name')).toHaveValue(second.username)
    await expect(page.getByLabel('Email address')).not.toHaveValue(email)
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
    await page.getByRole('button', {name: 'Sign out', exact: true}).click()
    await expect(page).toHaveURL(/\/sign-in$/)
    const device = await browser.newContext({baseURL: test.info().project.use.baseURL!, viewport})
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
  const first = await browser.newContext({ baseURL: test.info().project.use.baseURL! })
  const second = await browser.newContext({ baseURL: test.info().project.use.baseURL! })
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

test('settings password change preserves the account and its private data',async({page,request})=>{
  test.setTimeout(90_000)
  const account=await registerAccount(page,request,'settings-password')
  const trade=await page.request.post('/api/trades',{
    headers:{'Idempotency-Key':crypto.randomUUID()},
    data:{originalNote:'Password continuity private trade',symbol:'ES',side:'long',entryPrice:'100',stopPrice:'99',setup:'breakout',openedAt:new Date().toISOString()}
  })
  expect(trade.status()).toBe(201)
  const tradeId=(await trade.json()).trade.id
  const group=await page.request.post('/api/groups',{data:{name:'Password continuity group'}})
  expect(group.status()).toBe(201)
  const {groupId}=await group.json()
  await page.goto('/settings')
  const panel=page.getByRole('region',{name:'Password',exact:true})
  const replacement='Replacement-example-pass-42!'
  await panel.getByLabel('Current password').fill('Wrong-current-password-42!')
  await panel.getByLabel('New password',{exact:true}).fill(replacement)
  await panel.getByLabel('Confirm new password').fill(replacement)
  await panel.getByRole('button',{name:'Send verification code'}).click()
  await expect(panel.getByRole('alert')).toHaveText('Could not verify your current password. Check it and try again.')
  expect((await page.request.get('/api/trades')).status()).toBe(200)
  await panel.getByLabel('Current password').fill(account.password)
  await panel.getByRole('button',{name:'Send verification code'}).click()
  await expect(panel.getByLabel('Verification code')).toBeVisible()
  const {code}=await emailCode(request,account.email,'Reset your Oneliner password')
  await panel.getByLabel('Verification code').fill(code==='000000'?'000001':'000000')
  await panel.getByRole('button',{name:'Update password'}).click()
  await expect(panel.getByRole('alert')).toContainText('Could not verify the code')
  expect((await page.request.get('/api/trades')).status()).toBe(200)
  await panel.getByLabel('Verification code').fill(code)
  await panel.getByRole('button',{name:'Update password'}).click()
  await expect(page).toHaveURL(/\/sign-in\?password=updated$/)
  expect((await page.request.get('/api/trades')).status()).toBe(401)
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button',{name:'Sign in',exact:true}).click()
  await expect(page.locator('.auth-form [role="alert"]')).toContainText('Could not sign in')
  await page.getByLabel('Password').fill(replacement)
  await page.getByRole('button',{name:'Sign in',exact:true}).click()
  await expect(page).toHaveURL('/')
  expect((await(await page.request.get('/api/trades')).json()).trades).toEqual(expect.arrayContaining([expect.objectContaining({id:tradeId})]))
  expect((await(await page.request.get('/api/groups')).json()).groups).toEqual(expect.arrayContaining([expect.objectContaining({id:groupId})]))
})
