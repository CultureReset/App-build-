import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { legacyPlatformEnabled, retiredRedirect } from '@/lib/legacy'
import { GATE_MESSAGES, gateConfig, gateDecision, isBuilderPath, resolveOperator } from '@/lib/paperclip-session'

/**
 * Keeps the app builder (/build*) behind a Paperclip instance-admin session
 * (DECISIONS #50): the browser's Paperclip cookie is forwarded to
 * ${PAPERCLIP_URL}/api/auth/get-session and /api/cli-auth/me; a signed-out
 * page request goes to PAPERCLIP_LOGIN_URL, anything else gets 401/403.
 *
 * With the retired platform on, also refreshes its auth session on every
 * request and keeps its dashboard behind its login. Public pages under /u/*
 * are intentionally left open.
 */
export async function proxy(request: NextRequest) {
  if (isBuilderPath(request.nextUrl.pathname)) {
    const config = gateConfig()
    const operator = await resolveOperator({ cookie: request.headers.get('cookie'), config })
    const html = (request.headers.get('accept') ?? '').includes('text/html')
    const decision = gateDecision({ operator, config, html, url: request.nextUrl.toString() })
    if (decision.kind === 'redirect') return NextResponse.redirect(decision.to)
    if (decision.kind === 'refuse') return new NextResponse(GATE_MESSAGES[decision.status], { status: decision.status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    return NextResponse.next()
  }

  // The retired login, dashboard, store and public pages are off unless the
  // legacy switch is on (src/lib/legacy.ts).
  if (!legacyPlatformEnabled()) {
    const target = retiredRedirect(request.nextUrl.pathname)

    if (target) {
      const redirect = request.nextUrl.clone()
      redirect.pathname = target
      redirect.search = ''
      return NextResponse.redirect(redirect)
    }

    return NextResponse.next()
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }

          response = NextResponse.next({ request })

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && pathname.startsWith('/dashboard')) {
    const redirect = request.nextUrl.clone()
    redirect.pathname = '/login'
    redirect.searchParams.set('next', pathname)
    return NextResponse.redirect(redirect)
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const redirect = request.nextUrl.clone()
    redirect.pathname = '/dashboard'
    redirect.search = ''
    return NextResponse.redirect(redirect)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
