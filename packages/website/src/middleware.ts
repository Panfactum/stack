import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export function middleware (request: NextRequest) {
  const cspHeader = `
    default-src 'self' https://pagesense-collect.zoho.com https://cdn.pagesense.io https://crm.zoho.com https://crm.zohopublic.com;
    script-src 'self' 'unsafe-inline' https://pagesense-collect.zoho.com https://cdn.pagesense.io https://static.zohocdn.com https://crm.zohopublic.com ${process.env.NODE_ENV === 'production' ? '' : '\'unsafe-eval\''};
    style-src 'self' 'unsafe-inline';
    img-src 'self' https://pagesense-collect.zoho.com https://crm.zohopublic.com blob: data:;
    font-src 'self' https:;
    object-src 'none';
    base-uri 'self';
    form-action 'self' https://crm.zoho.com;
    frame-ancestors 'none';
    upgrade-insecure-requests;
`
  // Replace newline characters and spaces
  const contentSecurityPolicyHeaderValue = cspHeader
    .replace(/\s{2,}/g, ' ')
    .trim()

  const requestHeaders = new Headers(request.headers)

  requestHeaders.set(
    'Content-Security-Policy',
    contentSecurityPolicyHeaderValue
  )

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  })
  response.headers.set(
    'Content-Security-Policy',
    contentSecurityPolicyHeaderValue
  )

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' }
      ]
    }
  ]
}
