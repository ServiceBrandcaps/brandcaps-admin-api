// middleware.js
import { NextResponse } from 'next/server'

export function middleware(req) {
  const { pathname } = req.nextUrl

  // Permitir acceso a archivos estáticos, APIs y _next
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    /\.(.*)$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  // Leer token JWT desde cookie `token`
  const token = req.cookies.get('token')?.value

  // Rutas públicas
  const publicRoutes = ['/login', '/register']

  // Si no hay token y no estamos en una ruta pública, redirigir a login
  if (!token && !publicRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Si hay token y accedemos a login o register, redirigir al dashboard
  if (token && publicRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  // En todos los demás casos, permitir
  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/((?!_next|api|static|favicon.ico).*)'],
}
