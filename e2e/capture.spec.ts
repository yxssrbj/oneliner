import { expect, test } from '@playwright/test'
import {registerAccount} from './account-helper'

test.use({ viewport: { width: 1280, height: 800 } })

test('reviews uncertain suggestions, retains a failed save, and saves one private trade', async ({ page, request }) => {
  test.setTimeout(60_000)
  const account=await registerAccount(page,request,'capture')
  await expect(page.getByRole('heading', { name: 'Capture a trade', exact: true })).toBeVisible()

  await page.route('**/api/parse', (route) => route.fulfill({ json: { suggestion: { symbol: 'CL', side: 'short', entryPrice: '87.64', stopPrice: null, setup: 'ORB', clarifications: ['Please confirm the initial stop price.'] } } }))
  const note = '  CL short 87.64, ORB\n'
  await page.getByLabel('Trade note').fill(note)
  await page.getByRole('button', { name: 'Suggest fields' }).click()
  await expect(page.getByLabel('Initial stop')).toHaveValue('')
  await expect(page.getByText('Please confirm the initial stop price.')).toBeVisible()
  await page.getByLabel('Initial stop').fill('87.50')
  await page.getByRole('button', { name: 'Save trade' }).click()
  await expect(page.locator('.capture-form [role=alert]')).toContainText('above entry for a short')
  await page.getByLabel('Initial stop').fill('87.90')

  let saveKey = '', saveBody = ''
  await page.route('**/api/trades', async (route) => {
    if (route.request().method() === 'POST') {
      saveKey = route.request().headers()['idempotency-key']
      saveBody = route.request().postData()!
      await route.fulfill({ status: 503, json: { error: 'Could not save; retry.' } })
    } else await route.continue()
  }, { times: 1 })
  await page.getByRole('button', { name: 'Save trade' }).click()
  await expect(page.locator('.capture-form [role=alert]')).toContainText('retry')
  await expect(page.getByLabel('Trade note')).toHaveValue(note)
  await page.reload()
  await expect(page.getByLabel('Initial stop')).toHaveValue('87.90')
  await expect(page.getByLabel('Trade note')).toHaveValue(note)
  await page.getByRole('button', { name: 'Save trade' }).click()
  await expect(page.getByRole('status')).toHaveText('Trade saved.')

  const retry = await page.evaluate(async ({ saveKey, saveBody }) => {
    const response = await fetch('/api/trades', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': saveKey }, body: saveBody })
    return { status: response.status, body: await response.json() }
  }, { saveKey, saveBody })
  expect(retry.status).toBe(200)
  const trades = await page.evaluate(async () => (await (await fetch('/api/trades?inbox=true')).json()).trades)
  expect(trades).toHaveLength(1)
  expect(trades[0].original_note).toBe(note)
  expect(trades[0].entry_price).toBe('87.64')
  expect(trades[0].exit_price).toBeNull()
  expect(trades[0].id).toBe(retry.body.trade.id)
  await page.reload()
  await expect(page.getByLabel('Trade note')).toHaveValue('')
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith('oneliner:capture:')))).toEqual([])

  await page.getByLabel('Trade note').fill('private note before signing out')
  await page.getByRole('link', { name: 'Weekly review' }).click()
  await expect(page).toHaveURL(/\/review$/)
  await page.goBack()
  await expect(page.getByLabel('Trade note')).toHaveValue('private note before signing out')
  let releaseScripts!: () => void
  const scripts = new Promise<void>(resolve => { releaseScripts = resolve })
  let delayedScripts = 0
  await page.route('**/_next/static/**/*.js', async route => { delayedScripts += 1; await scripts; await route.continue() })
  try {
    await page.reload({ waitUntil: 'commit' })
    await expect.poll(() => delayedScripts).toBeGreaterThan(0)
    await expect(page.getByLabel('Trade note')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Save trade' })).toHaveCount(0)
  } finally { releaseScripts() }
  await expect(page.getByLabel('Trade note')).toHaveValue('private note before signing out')
  await page.unroute('**/_next/static/**/*.js')
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
  await page.getByRole('link', { name: `${account.username} Personal workspace` }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await page.goto('/')
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.getByLabel('Trade note')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Save trade' })).toHaveCount(0)
})
