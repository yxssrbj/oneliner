import { expect, test, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from './proxy'

vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, options: {
    cookies: {
      setAll: (cookies: { name: string; value: string; options: { path: string; sameSite: 'lax' | 'strict' } }[], headers: Record<string, string>) => void
    }
  }) => ({
    auth: {
      getUser: async () => {
        options.cookies.setAll([
          { name: 'access', value: 'first', options: { path: '/', sameSite: 'lax' } },
          { name: 'refresh', value: 'keep-me', options: { path: '/', sameSite: 'strict' } },
        ], {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
          Expires: '0',
          Pragma: 'no-cache',
        })
        options.cookies.setAll([
          { name: 'access', value: 'newer', options: { path: '/journal', sameSite: 'strict' } },
        ], {})
        return { data: { user: { id: 'user-1' } }, error: null }
      },
    },
  }),
}))

test('refresh keeps cache protections and all current cookies across writes', async () => {
  const request = new NextRequest('http://localhost:3012/inbox')
  const response = await proxy(request)
  expect(request.cookies.get('access')?.value).toBe('newer')
  expect(request.cookies.get('refresh')?.value).toBe('keep-me')
  expect(response.cookies.get('access')).toMatchObject({ value: 'newer', path: '/journal', sameSite: 'strict' })
  expect(response.cookies.get('refresh')).toMatchObject({ value: 'keep-me', path: '/', sameSite: 'strict' })
  expect(response.headers.get('cache-control')).toBe('private, no-cache, no-store, must-revalidate, max-age=0')
  expect(response.headers.get('expires')).toBe('0')
  expect(response.headers.get('pragma')).toBe('no-cache')
})
