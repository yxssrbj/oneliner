import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

async function signIn(page: Page, request: APIRequestContext, email: string) {
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
  await page.getByRole('button', { name: 'Verify code', exact: true }).click()
  await expect(page).toHaveURL('http://localhost:3012/')
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
  test(`settings saves own identity and separates accounts at ${viewport.width}×${viewport.height}`, async ({ page, request }, testInfo) => {
    test.setTimeout(30_000)
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
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    await page.getByLabel('Display name').focus()
    await expect(page.getByLabel('Display name')).toHaveCSS('outline-style', 'solid')
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
    await page.screenshot({ path: testInfo.outputPath('settings-profile.png'), fullPage: true })

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
    await signIn(page, request, `settings-second-${crypto.randomUUID()}@example.test`)
    await page.goto('/settings')
    await expect(page.getByLabel('Display name')).toHaveValue('')
    await expect(page.getByLabel('Email address')).not.toHaveValue(email)
    await expect(page.locator('body')).not.toContainText(name)
    expect((await (await page.request.get('/api/profile')).json()).displayName).toBeNull()
    await page.goBack()
    await expect(page.locator('.account-name:visible')).toHaveText('Trader')
    await expect(page.locator('body')).not.toContainText(name)
    await page.goForward()
    await expect(page.getByLabel('Display name')).toHaveValue('')
    await expect(page.getByLabel('Email address')).not.toHaveValue(email)
    expect(errors).toEqual([])
  })
}

test('a delayed browser session cannot reveal the server account profile', async ({ browser, request }) => {
  test.setTimeout(30_000)
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
    await expect(delayed.getByLabel('Email address')).toHaveCount(0)
    await expect(delayed.locator('.settings-identity')).toHaveCount(0)
    await first.clearCookies()
    await first.addCookies(await second.cookies())
    releaseScripts()
    await expect(delayed.getByLabel('Email address')).toHaveValue(secondEmail)
    await expect(delayed.getByLabel('Display name')).toHaveValue('Second owner')
    await expect(delayed.getByLabel('Email address')).not.toHaveValue(firstEmail)
    await expect(delayed.locator('.settings-identity')).not.toContainText('First private owner')
  } finally {
    releaseScripts()
    await first.close()
    await second.close()
  }
})
