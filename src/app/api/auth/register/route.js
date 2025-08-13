// src/app/api/auth/register/route.js
import { NextResponse } from 'next/server'
import { connectDB } from '../../../../lib/mongoose'
import User from '../../../../models/User'
import bcrypt from 'bcrypt'

export async function POST(req) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json(
      { message: 'Email y contraseña son requeridos' },
      { status: 400 }
    )
  }

  await connectDB()

  if (await User.findOne({ email })) {
    return NextResponse.json({ message: 'El usuario ya existe' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const newUser = await User.create({ email, password: passwordHash, role: 'cliente' })

  // esto SÍ devuelve JSON
  return NextResponse.json(
    { id: newUser._id, email: newUser.email, role: newUser.role },
    { status: 201 }
  )
}
