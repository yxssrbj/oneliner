import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

async function enterCode(page: Page, request: APIRequestContext, prefix: string) {
  const email = `${prefix}-${crypto.randomUUID()}@example.test`
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
  const code = /<strong>(\d{6,8})<\/strong>/.exec(message.HTML)?.[1]
  expect(code).toBeTruthy()
  await page.getByLabel('Code', { exact: true }).fill(code!)
  await page.getByRole('button', { name: 'Verify code', exact: true }).click()
}

async function saveDisplayName(page: Page, name: string) {
  await page.getByLabel('Display name', { exact: true }).fill(name)
  const saved = page.waitForResponse(response => response.url().endsWith('/api/profile') && response.request().method() === 'PUT')
  await page.getByRole('button', { name: 'Save display name', exact: true }).click()
  expect((await saved).status()).toBe(200)
}

const tokenFromLink = (url: string) => new URL(url).pathname.split('/').at(-1)!

test('private groups share only weekly summaries and revoke former members', async ({ page, request, browser }) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1280, height: 900 })
  expect((await request.get('/api/groups')).status()).toBe(401)
  await page.goto('/sign-in')
  await enterCode(page, request, 'groups-owner')
  await expect(page.getByRole('heading', { name: 'Capture', exact: true })).toBeVisible()
  await page.goto('/friends')
  await saveDisplayName(page, 'Owner Trader')
  await page.getByLabel('Group name', { exact: true }).fill('Sunday Futures')
  const creation = page.waitForResponse(response => response.url().endsWith('/api/groups') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Create group', exact: true }).click()
  const created = await creation
  expect(created.status()).toBe(201)
  const { groupId } = await created.json()
  await expect(page.getByRole('table', { name: 'Weekly group comparison' })).toBeVisible()
  const originalInvite = await page.getByLabel('Invite link', { exact: true }).inputValue()

  const monday = new Date()
  monday.setUTCHours(0, 0, 0, 0)
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7)
  const weekStart = monday.toISOString().slice(0, 10)
  const previousWeek = new Date(monday.getTime() - 7 * 86400000).toISOString().slice(0, 10)
  const trades: { id: string }[] = []
  for (const [symbol, exit, openedAt] of [
    ['ES', '12', monday.toISOString()], ['NQ', '9', monday.toISOString()],
    ['CL', '10', monday.toISOString()], ['GC', null, monday.toISOString()],
    ['YM', '12', new Date(monday.getTime() - 1).toISOString()],
  ]) {
    const response = await page.request.post('/api/trades', { headers: { 'Idempotency-Key': crypto.randomUUID() }, data: {
      originalNote: `${symbol} PRIVATE OWNER NOTE`, symbol, side: 'long', entryPrice: '10', stopPrice: '9', setup: 'PRIVATE SETUP', openedAt,
    } })
    expect(response.status()).toBe(201)
    const { trade } = await response.json()
    trades.push(trade)
    if (exit) expect((await page.request.patch(`/api/trades/${trade.id}`, { data: { exitPrice: exit } })).status()).toBe(200)
  }
  await page.reload()
  await expect(page.getByText(`Week of ${weekStart}`, { exact: true })).toBeVisible()
  const summary = await page.request.get(`/api/groups/${groupId}/metrics?weekStart=${weekStart}`)
  expect(summary.status()).toBe(200)
  expect(summary.headers()['cache-control']).toContain('no-store')
  const { metrics } = await summary.json()
  expect(metrics).toHaveLength(1)
  expect(Object.keys(metrics[0]).sort()).toEqual(['completedCount', 'displayName', 'totalR', 'winRate'])
  expect(metrics[0]).toEqual({ displayName: 'Owner Trader', totalR: 1, completedCount: 3, winRate: 1 / 3 })
  const previous = await (await page.request.get(`/api/groups/${groupId}/metrics?weekStart=${previousWeek}`)).json()
  expect(previous.metrics[0].totalR).toBe(2)

  const memberContext = await browser.newContext({ baseURL: 'http://localhost:3012' })
  const member = await memberContext.newPage()
  member.on('pageerror', error => errors.push(error.message))
  await member.goto(originalInvite)
  await member.getByRole('link', { name: 'Sign in to join', exact: true }).click()
  await enterCode(member, request, 'groups-member')
  await expect(member).toHaveURL(new RegExp(`/friends/invite/${tokenFromLink(originalInvite)}$`))
  expect((await (await member.request.get('/api/groups')).json()).groups).toEqual([])
  await expect(member.getByText(/win rate/i)).toBeVisible()
  await saveDisplayName(member, 'Member Trader')
  await member.route('**/api/groups/join', route => route.fulfill({ status: 503, json: { error: 'Could not join. Try again.' } }), { times: 1 })
  await member.getByRole('button', { name: 'Join group', exact: true }).click()
  await expect(member.locator('main').getByRole('alert')).toContainText('Try again')
  await member.getByRole('button', { name: 'Join group', exact: true }).click()
  await expect(member).toHaveURL(new RegExp(`/friends\\?group=${groupId}$`))
  const table = member.getByRole('table', { name: 'Weekly group comparison' })
  await expect(table).toContainText('Owner Trader')
  await expect(table).toContainText('Member Trader')
  await expect(member.getByLabel('Invite link', { exact: true })).toHaveCount(0)
  const shared = await (await member.request.get(`/api/groups/${groupId}/metrics?weekStart=${weekStart}`)).json()
  expect(shared.metrics).toContainEqual({ displayName: 'Member Trader', totalR: 0, completedCount: 0, winRate: null })
  expect(JSON.stringify(shared)).not.toMatch(/PRIVATE|original_note|entry_price|chart_data|unfinished/)
  expect((await (await member.request.get('/api/trades')).json()).trades).toEqual([])
  expect((await member.request.patch(`/api/trades/${trades[0].id}`, { data: { exitPrice: '99' } })).status()).toBe(404)
  expect((await member.request.get(`/api/trades/${trades[0].id}/chart-data`)).status()).toBe(404)
  const detail = await (await member.request.get(`/api/groups/${groupId}`)).json()
  expect(detail.inviteToken).toBeNull()
  expect([403, 404]).toContain((await member.request.post(`/api/groups/${groupId}`, { data: { action: 'rotate-invite' } })).status())
  expect((await member.request.get(`/api/groups/${groupId}/metrics?weekStart=2026-02-30`)).status()).toBe(400)
  await page.reload()
  await expect(page.getByRole('table', { name: 'Weekly group comparison' })).toContainText('Member Trader')
  await page.screenshot({ path: 'test-results/task-5-groups-desktop.png', fullPage: true })
  await member.setViewportSize({ width: 390, height: 844 })
  expect(await member.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await member.screenshot({ path: 'test-results/task-5-groups-mobile.png', fullPage: true })

  const secondGroupResponse = await member.request.post('/api/groups', { data: { name: 'Practice Group' } })
  expect(secondGroupResponse.status()).toBe(201)
  const { groupId: secondGroupId } = await secondGroupResponse.json()
  page.once('dialog', dialog => dialog.accept())
  const removal = page.waitForResponse(response => response.url().endsWith(`/api/groups/${groupId}`) && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Remove Member Trader', exact: true }).click()
  expect((await removal).status()).toBe(200)
  expect((await member.request.get(`/api/groups/${groupId}/metrics?weekStart=${weekStart}`)).status()).toBe(404)
  expect((await member.request.get(`/api/groups/${groupId}`)).status()).toBe(404)
  expect((await (await member.request.get('/api/groups')).json()).groups).toEqual([
    expect.objectContaining({ id: secondGroupId, name: 'Practice Group' }),
  ])
  expect([400, 404]).toContain((await member.request.post('/api/groups/join', { data: { token: tokenFromLink(originalInvite) } })).status())
  await member.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(member.getByRole('heading', { name: 'Practice Group', exact: true })).toBeVisible()
  await expect(member.getByRole('table', { name: 'Weekly group comparison' })).not.toContainText('Owner Trader')
  const afterRemovalInvite = await page.getByLabel('Invite link', { exact: true }).inputValue()
  expect(afterRemovalInvite).not.toBe(originalInvite)
  await member.goto(afterRemovalInvite)
  await member.getByRole('button', { name: 'Join group', exact: true }).click()
  await expect(member.getByRole('table', { name: 'Weekly group comparison' })).toBeVisible()

  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Replace invite link', exact: true }).click()
  await expect(page.getByLabel('Invite link', { exact: true })).not.toHaveValue(afterRemovalInvite)
  const activeInvite = await page.getByLabel('Invite link', { exact: true }).inputValue()
  expect([400, 404]).toContain((await member.request.post('/api/groups/join', { data: { token: tokenFromLink(afterRemovalInvite) } })).status())
  member.once('dialog', dialog => dialog.accept())
  await member.getByRole('button', { name: 'Leave group', exact: true }).click()
  await expect(member.getByRole('heading', { name: 'Practice Group', exact: true })).toBeVisible()
  expect((await member.request.get(`/api/groups/${groupId}/metrics?weekStart=${weekStart}`)).status()).toBe(404)
  await member.goto(activeInvite)
  await member.getByRole('button', { name: 'Join group', exact: true }).click()
  await expect(member.getByRole('table', { name: 'Weekly group comparison' })).toBeVisible()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Close group', exact: true }).click()
  await expect(page.getByRole('table', { name: 'Weekly group comparison' })).toHaveCount(0)
  expect((await member.request.get(`/api/groups/${groupId}/metrics?weekStart=${weekStart}`)).status()).toBe(404)
  expect([400, 404]).toContain((await member.request.post('/api/groups/join', { data: { token: tokenFromLink(activeInvite) } })).status())
  expect((await (await page.request.get('/api/trades')).json()).trades).toHaveLength(trades.length)
  expect((await member.request.post(`/api/groups/${secondGroupId}`, { data: { action: 'close' } })).status()).toBe(200)
  const memberCookies = await memberContext.cookies()
  await memberContext.clearCookies()
  await memberContext.addCookies(await page.context().cookies())
  await member.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(member.getByLabel('Display name', { exact: true })).toHaveValue('Owner Trader')
  await member.goto(originalInvite)
  await expect(member.getByLabel('Display name', { exact: true })).toHaveValue('Owner Trader')
  await memberContext.clearCookies()
  await memberContext.addCookies(memberCookies)
  await member.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(member.getByLabel('Display name', { exact: true })).toHaveValue('Member Trader')
  await memberContext.close()
  expect(errors).toEqual([])
})
