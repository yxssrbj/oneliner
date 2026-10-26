import { expect, test, type Page, type APIRequestContext } from '@playwright/test'
import {registerAccount} from './account-helper'

async function signIn(page: Page, request: APIRequestContext, prefix: string) {
  await registerAccount(page,request,prefix)
  await expect(page.getByRole('heading', { name: 'Capture a trade', exact: true })).toBeVisible()
}

test('completes exits, reviews opening weeks, corrects fields and denies another account', async ({ page, request, browser }) => {
  const browserErrors: string[] = []
  page.on('pageerror', error => browserErrors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('503')) browserErrors.push(message.text()) })
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, request, 'outcomes')
  const trades = []
  for (const [symbol, openedAt] of [['ES', '2026-10-19T00:00:00Z'], ['NQ', '2026-10-20T10:00:00Z'], ['CL', '2026-10-21T10:00:00Z'], ['GC', '2026-10-22T10:00:00Z'], ['YM', '2026-10-18T23:59:59Z']]) {
    const response = await page.request.post('/api/trades', { headers: { 'Idempotency-Key': crypto.randomUUID() }, data: { originalNote: `${symbol} original private note`, symbol, side: 'long', entryPrice: '10', stopPrice: '9', setup: 'ORB', openedAt } })
    expect(response.status()).toBe(201)
    trades.push((await response.json()).trade)
  }
  await page.goto('/inbox')
  await expect(page.getByRole('heading', { name: 'Waiting for an exit (5)' })).toBeVisible()
  const es = page.locator('article').filter({ has: page.getByRole('heading', { name: 'ES long', exact: true }) })
  await expect(es.getByText('ES original private note')).toBeVisible()
  await es.getByRole('button', { name: 'Chart data' }).click()
  await es.getByLabel('TradingView chart-data CSV').setInputFiles({ name: 'es-chart.csv', mimeType: 'text/csv', buffer: Buffer.from('time,open,high,low,close,Volume\n2026-10-19T09:30:00Z,101,104,100,103,25\n2026-10-19T09:31:00Z,103,105,102,104,30') })
  await expect(es.getByText('Preview: 2 bars')).toBeVisible()
  await es.getByRole('button', { name: 'Save chart data' }).click()
  await expect(es.getByText('Chart data saved.')).toBeVisible()
  await es.getByText('Add exit', { exact: true }).click()
  await es.getByLabel('Exit price').fill('12')
  await page.route(`**/api/trades/${trades[0].id}`, route => route.fulfill({ status: 503, json: { error: 'Retry saving.' } }), { times: 1 })
  await es.getByRole('button', { name: 'Save exit' }).click()
  await expect(es.getByRole('alert')).toHaveText('Retry saving.')
  await expect(es.getByLabel('Exit price')).toHaveValue('12')
  await page.screenshot({ path: 'test-results/task-4-inbox-desktop.png', fullPage: true })
  await es.getByRole('button', { name: 'Save exit' }).click()
  await expect(page.getByText('ES: Win · +2.00R. Saved.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Waiting for an exit (4)' })).toBeVisible()
  for (const [index, exitPrice] of [[1, '9'], [2, '10'], [4, '12']] as const) {
    const response = await page.request.patch(`/api/trades/${trades[index].id}`, { data: { exitPrice } })
    expect(response.status()).toBe(200)
  }
  const week = await (await page.request.get('/api/trades?weekStart=2026-10-19')).json()
  expect(week.trades).toHaveLength(4)
  expect(week.summary).toEqual({ totalR: 1, wins: 1, completedCount: 3, unfinishedCount: 1, winRate: 1 / 3 })
  expect((await (await page.request.get('/api/trades?weekStart=2026-10-12')).json()).summary.totalR).toBe(2)
  await page.getByRole('complementary').getByRole('link', { name: 'Weekly review', exact: true }).click()
  // Navigate from the real current UTC week to the fixture opening week.
  while (await page.getByText('Week of 2026-10-19', { exact: true }).count() === 0) {
    const heading = await page.locator('.week-picker strong').innerText()
    await page.getByRole('button', { name: heading.slice(-10) > '2026-10-19' ? 'Previous week' : 'Next week', exact: true }).click()
  }
  await expect(page.getByRole('table', { name: 'Daily breakdown in UTC' })).toBeVisible()
  await expect(page.locator('.week-metrics')).toContainText('33.3%')
  await expect(page.locator('.week-metrics')).toContainText('+1.00R')
  const recent = page.getByRole('heading', { name: 'Trades opened this week' }).locator('..')
  const recentEs = recent.locator('article').filter({ has: page.getByRole('heading', { name: 'ES long', exact: true }) })
  await recentEs.getByText('Correct trade details', { exact: true }).click()
  await recentEs.getByLabel('Initial stop').fill('8')
  await recentEs.getByLabel('I reviewed these corrections').check()
  await recentEs.getByRole('button', { name: 'Save corrections' }).click()
  await expect(page.getByText('ES: Win · +1.00R. Saved.')).toBeVisible()
  await expect(page.locator('.week-metrics')).toContainText('0.00R')
  await page.reload()
  while (await page.getByText('Week of 2026-10-19', {exact:true}).count() === 0) {
    const heading=await page.locator('.week-picker strong').innerText()
    await page.getByRole('button',{name:heading.slice(-10) > '2026-10-19'?'Previous week':'Next week',exact:true}).click()
  }
  await expect(page.locator('.week-metrics')).toContainText('0.00R')
  await expect(page.getByText('ES original private note')).toBeVisible()
  const reloadedEs = page.locator('article').filter({ has: page.getByRole('heading', { name: 'ES long', exact: true }) })
  await reloadedEs.getByRole('button', { name: 'Chart data' }).click()
  await expect(reloadedEs.getByRole('img', { name: 'Close price chart for 2 bars' })).toBeVisible()
  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(page.getByRole('complementary')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/task-4-review-1280.png', fullPage: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.screenshot({ path: 'test-results/task-4-review-desktop.png', fullPage: true })
  const secondContext = await browser.newContext({ baseURL: test.info().project.use.baseURL! })
  const second = await secondContext.newPage()
  await signIn(second, request, 'outcomes-other')
  expect((await (await second.request.get('/api/trades')).json()).trades).toEqual([])
  expect((await second.request.get(`/api/trades/${trades[0].id}/chart-data`)).status()).toBe(404)
  expect((await second.request.patch(`/api/trades/${trades[0].id}`, { data: { exitPrice: '100' } })).status()).toBe(404)
  expect((await second.request.patch(`/api/trades/${trades[0].id}`, { data: { symbol: 'ES', side: 'long', entryPrice: '10', stopPrice: '8', setup: 'ORB', openedAt: '2026-10-19T00:00:00Z', confirmed: true } })).status()).toBe(404)
  await second.goto('/review')
  await expect(second.getByText('No trades opened this week.')).toBeVisible()
  await secondContext.close()
  expect(browserErrors).toEqual([])
})
