import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          const priorResponse = response
          response = NextResponse.next({ request })
          priorResponse.cookies.getAll().forEach(({ name, value, ...options }) => response.cookies.set(name, value, options))
          for (const name of ['Cache-Control', 'Expires', 'Pragma']) {
            const value = priorResponse.headers.get(name)
            if (value) response.headers.set(name, value)
          }
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
          Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value))
        },
      },
    },
  )
  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: ['/((?!_next/|favicon.ico|preview.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
