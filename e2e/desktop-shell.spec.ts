import { expect, test } from '@playwright/test'
import {registerAccount} from './account-helper'

for (const viewport of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
  test(`desktop shell at ${viewport.width}×${viewport.height}`, async ({ page, request }, testInfo) => {
    await page.setViewportSize(viewport)
    await registerAccount(page,request,`desktop-${viewport.width}`)
    const name = 'LongTraderIdentityWithoutSpaces'.repeat(2)
    expect((await page.request.put('/api/profile', { data: { displayName: name } })).ok()).toBeTruthy()

    async function fits() {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
      const account = page.locator('.account-profile:visible')
      const box = await account.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.y).toBeGreaterThanOrEqual(0)
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)
      // The Next development indicator is tooling, not part of the application layout.
      await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
      await account.click({ trial: true })
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      expect(Math.abs((await page.locator('.desktop-nav:visible').boundingBox())!.y)).toBeLessThan(1)
      await account.click({ trial: true })
      await page.evaluate(() => window.scrollTo(0, 0))
    }

    for (const [path, title] of [['/review', 'Weekly review'], ['/', 'Capture a trade'], ['/inbox', 'Unfinished'], ['/friends', 'Groups']]) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
      await expect(page.locator('.account-name:visible')).toHaveText(name)
      const navigation = page.getByRole('navigation', { name: 'Main navigation' })
      await expect(navigation.locator('[aria-current="page"]')).toHaveText(title)
      for (const link of await navigation.getByRole('link').all()) {
        await link.focus()
        await expect(link).toBeFocused()
        await expect(link).toHaveCSS('outline-style', 'solid')
        await expect(link).toHaveCSS('outline-color', 'rgb(197, 237, 136)')
      }
      await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(20, 22, 21)')
      await fits()
      await page.screenshot({ path: testInfo.outputPath(`${title.replaceAll(' ', '-')}.png`), fullPage: true })
    }
    await expect(page.getByText('No groups yet. Create one or open an invite link.')).toBeVisible()
    await page.getByRole('link', { name: 'Capture a trade', exact: true }).click()
    await expect(page.getByLabel('Trade note')).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('heading', { name: 'Groups', exact: true })).toBeVisible()
    await page.goForward()
    await expect(page.getByLabel('Trade note')).toBeVisible()
    await page.getByLabel('Trade note').fill('X'.repeat(1000))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(page.getByLabel('Trade note')).toHaveCSS('transition-duration', '0s')
    await fits()

    let finishParse!: () => void
    const parsing = new Promise<void>(resolve => { finishParse = resolve })
    await page.route('**/api/parse', async route => {
      await parsing
      await route.fulfill({ status: 503, json: { error: 'Parsing unavailable. ' + 'X'.repeat(500) } })
    })
    await page.getByRole('button', { name: 'Add' }).click()
    await expect(page.getByRole('button', { name: 'Reading note…' })).toBeDisabled()
    await fits()
    finishParse()
    await expect(page.locator('.capture-form [role=alert]')).toContainText('Parsing unavailable.')
    await expect(page.getByLabel('Trade note')).toHaveValue('X'.repeat(1000))
    await fits()
    await page.screenshot({ path: testInfo.outputPath('capture-error.png'), fullPage: true })

    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    await page.route('**/api/trades?*', async route => {
      await pending
      await route.fulfill({ status: 503, json: { error: 'Could not load trades. Retry. ' + 'X'.repeat(500) } })
    })
    await page.goto('/inbox')
    await expect(page.getByRole('status')).toHaveText('Loading trades…')
    await fits()
    release()
    await expect(page.locator('.trade-workspace [role=alert]')).toContainText('Could not load trades. Retry loading.')
    await fits()
    await page.getByRole('button', { name: 'Retry loading' }).click({ trial: true })
    await page.screenshot({ path: testInfo.outputPath('error-long-text.png'), fullPage: true })
    await page.unroute('**/api/trades?*')
    await page.getByRole('button', { name: 'Retry loading' }).click()
    await expect(page.getByText('All caught up. No trades are waiting for an exit.')).toBeVisible()
    expect((await page.request.post('/api/trades', { headers: { 'Idempotency-Key': crypto.randomUUID() }, data: { originalNote: 'X'.repeat(1000), symbol: 'ES', side: 'long', entryPrice: '100', stopPrice: '99', setup: 'breakout', openedAt: new Date().toISOString() } })).status()).toBe(201)
    await page.reload()
    await expect(page.locator('.trade-note')).toHaveText('X'.repeat(1000))
    await fits()
    await page.screenshot({ path: testInfo.outputPath('long-trade-note.png'), fullPage: true })
    await page.locator('.account-profile:visible').click()
    await expect(page).toHaveURL(/\/settings$/)
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page).toHaveURL(/\/sign-in$/)
  })
}
