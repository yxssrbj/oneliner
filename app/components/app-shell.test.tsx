// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import AppShell from './app-shell'

const { getAuthenticatedUser, single, eq, select, from } = vi.hoisted(() => ({ getAuthenticatedUser: vi.fn(), single: vi.fn(), eq: vi.fn(), select: vi.fn(), from: vi.fn() }))
vi.mock('../../lib/supabase/server', () => ({ getAuthenticatedUser }))
vi.mock('./account-controls', () => ({ default: ({displayName, profileError, current}: {displayName: string | null; profileError: boolean; current: boolean}) => <div><a href="/settings" aria-current={current ? 'page' : undefined}>Settings</a>{displayName ?? 'Trader'}{profileError && <p role="alert">Could not load display name.</p>}</div> }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`) } }))

const destinations = [
  { title: 'Review', label: 'Weekly review', href: '/review' },
  { title: 'Capture', label: 'Capture a trade', href: '/' },
  { title: 'Inbox', label: 'Unfinished', href: '/inbox' },
  { title: 'Friends', label: 'Groups', href: '/friends' },
]

beforeEach(() => {
  cleanup()
  single.mockResolvedValue({ data: null, error: null })
  eq.mockReturnValue({single}); select.mockReturnValue({eq}); from.mockReturnValue({select})
  getAuthenticatedUser.mockResolvedValue({ user: { id: 'trader-id', email: 'private@example.test' }, supabase: {from} })
})

test.each(destinations)('shows the desktop navigation and header for $title', async ({ title, label }) => {
  render(await AppShell({ title, children: <p>Page content</p> }))
  const nav = screen.getByRole('navigation', { name: 'Main navigation' })
  expect(within(nav).getAllByRole('link')).toHaveLength(4)
  for (const destination of destinations) {
    expect(within(nav).getByRole('link', { name: destination.label })).toHaveAttribute('href', destination.href)
  }
  expect(within(nav).getAllByRole('link', { current: 'page' })).toHaveLength(1)
  expect(within(nav).getByRole('link', { current: 'page' })).toHaveTextContent(label)
  expect(within(screen.getByRole('banner')).getByRole('heading', { level: 1 })).toHaveTextContent(label)
  expect(within(screen.getByRole('main')).getByText('Page content')).toBeVisible()
})

test('redirects a missing user before rendering private content', async () => {
  getAuthenticatedUser.mockResolvedValue(null)
  await expect(AppShell({ title: 'Capture', children: <p>Private content</p> })).rejects.toThrow('redirect:/sign-in')
})

test('reads only the signed-in profile name', async () => {
  single.mockResolvedValue({data: {display_name: 'River'}, error: null})
  render(await AppShell({title: 'Capture', children: null}))
  expect(screen.getByText('River')).toBeVisible()
  expect(from).toHaveBeenCalledWith('profiles')
  expect(select).toHaveBeenCalledWith('display_name')
  expect(eq).toHaveBeenCalledWith('id', 'trader-id')
})
test.each([null, {code: 'PGRST116'}])('uses a neutral name for an absent profile (%s)', async error => {
  single.mockResolvedValue({data: null, error})
  render(await AppShell({title: 'Capture', children: null}))
  expect(screen.getByText('Trader')).toBeVisible()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByText('private@example.test')).not.toBeInTheDocument()
})
test('shows a neutral name and readable profile error', async () => {
  single.mockResolvedValue({data: null, error: {code: 'broken'}})
  render(await AppShell({title: 'Capture', children: null}))
  expect(screen.getByText('Trader')).toBeVisible()
  expect(screen.getByRole('alert')).toHaveTextContent('Could not load display name.')
})

test('settings keeps four destinations and marks only the profile row current', async () => {
  render(await AppShell({ title: 'Settings', children: null }))
  const nav = screen.getByRole('navigation', { name: 'Main navigation' })
  expect(within(nav).getAllByRole('link')).toHaveLength(4)
  expect(within(nav).queryByRole('link', { current: 'page' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute('href', '/settings')
  expect(screen.getByRole('banner')).toHaveTextContent('Workspace / Settings')
  expect(within(screen.getByRole('banner')).queryByRole('heading')).not.toBeInTheDocument()
})
