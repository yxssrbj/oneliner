// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import AppShell from './app-shell'

const { getAuthenticatedUser } = vi.hoisted(() => ({ getAuthenticatedUser: vi.fn() }))
vi.mock('../../lib/supabase/server', () => ({ getAuthenticatedUser }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`) } }))

const destinations = [
  { title: 'Review', label: 'Weekly review', href: '/review' },
  { title: 'Capture', label: 'Capture a trade', href: '/' },
  { title: 'Inbox', label: 'Unfinished', href: '/inbox' },
  { title: 'Friends', label: 'Groups', href: '/friends' },
]

beforeEach(() => {
  cleanup()
  getAuthenticatedUser.mockResolvedValue({ user: { id: 'trader-id' } })
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
