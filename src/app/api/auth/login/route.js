// src/app/api/auth/login/route.js
import { connectDB } from '../../../../lib/mongoose';
import User from '../../../../models/User';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export async function POST(req) {
  await connectDB()

  // 1) Leer body con seguridad
  let email = ''
  let password = ''
  try {
    const data = await req.json()
    email = (data?.email || '').trim()
    password = data?.password || ''
  } catch {
    return new Response('Body inválido', { status: 400 })
  }

  if (!email || !password) {
    return new Response('Email y password requeridos', { status: 400 })
  }

  // 2) Traer siempre el password (por si en el schema está select:false)
  const user = await User.findOne({ email }).select('+password email role')
  // Si no existe o no tiene password almacenado -> credenciales inválidas
  if (!user || !user.password) {
    return new Response('Credenciales inválidas', { status: 401 })
  }

  // 3) Comparar hash
  const ok = await bcrypt.compare(password, user.password)
  if (!ok) {
    return new Response('Credenciales inválidas', { status: 401 })
  }

  // 4) Firmar JWT
  const token = jwt.sign(
    { sub: user._id.toString(), email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  )

  // 5) Responder con token + cookie (útil para middleware)
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Set-Cookie': [
      `token=${token}`,
      'Path=/',
      'HttpOnly',          // quítalo si necesitas acceder desde JS del cliente
      'SameSite=Lax',
      `Max-Age=${60 * 60 * 8}`,
    ].join('; ')
  })

  return new Response(JSON.stringify({ token }), { status: 200, headers })
}
