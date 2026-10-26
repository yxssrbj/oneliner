import {expect,test} from '@playwright/test'
import {registerAccount} from './account-helper'

test.use({viewport:{width:1280,height:800}})

test('password accounts keep journals private across account switches',async({page,request})=>{
  const first=await registerAccount(page,request,'auth-first')
  const saved=await page.request.post('/api/trades',{
    headers:{'Idempotency-Key':crypto.randomUUID()},
    data:{originalNote:'First account private note',symbol:'ES',side:'long',entryPrice:'100',stopPrice:'99',setup:'breakout',openedAt:new Date().toISOString()}
  })
  expect(saved.status()).toBe(201)
  await page.goto('/settings')
  await expect(page.getByLabel('Display name')).toHaveValue(first.username)
  await page.getByRole('button',{name:'Sign out'}).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  expect((await page.request.get('/api/trades')).status()).toBe(401)
  const second=await registerAccount(page,request,'auth-second')
  await page.goto('/settings')
  await expect(page.getByLabel('Display name')).toHaveValue(second.username)
  expect((await(await page.request.get('/api/trades')).json()).trades).toEqual([])
  await page.goto('/inbox')
  await expect(page.getByText('First account private note',{exact:true})).toHaveCount(0)
  await page.goto('/settings')
  await page.getByRole('button',{name:'Sign out'}).click()
  await page.getByLabel('Email').fill(first.email)
  await page.getByLabel('Password').fill(first.password)
  await page.getByRole('button',{name:'Sign in',exact:true}).click()
  await expect(page).toHaveURL('/')
  expect((await(await page.request.get('/api/trades')).json()).trades).toEqual(expect.arrayContaining([expect.objectContaining({original_note:'First account private note'})]))
})

test('password sign-in uses generic errors and a validated invite destination',async({page,request})=>{
  const account=await registerAccount(page,request,'auth-invite')
  await page.goto('/settings')
  await page.getByRole('button',{name:'Sign out'}).click()
  const invite=crypto.randomUUID()
  await page.goto(`/sign-in?invite=${invite}`)
  const error='Could not sign in. Check your email and password.'
  await page.getByLabel('Email').fill(`missing-${crypto.randomUUID()}@example.test`)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button',{name:'Sign in',exact:true}).click()
  await expect(page.locator('.auth-form [role="alert"]')).toHaveText(error)
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill('Wrong-password-42!')
  await page.getByRole('button',{name:'Sign in',exact:true}).click()
  await expect(page.locator('.auth-form [role="alert"]')).toHaveText(error)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button',{name:'Sign in',exact:true}).click()
  await expect(page).toHaveURL(`/friends/invite/${invite}`)
})

test('sign-in blocks credential entry until its browser listeners are ready',async({page})=>{
  let release!:()=>void
  const scripts=new Promise<void>(resolve=>{release=resolve})
  await page.route('**/_next/static/**/*.js',async route=>{await scripts;await route.continue()})
  try{
    await page.goto('/sign-in?password=updated',{waitUntil:'commit'})
    await expect(page.getByLabel('Email')).toBeDisabled()
    await expect(page.getByLabel('Password')).toBeDisabled()
    release()
    await expect(page.getByLabel('Email')).toBeEnabled()
    await expect(page.getByLabel('Password')).toBeEnabled()
  }finally{release()}
})
