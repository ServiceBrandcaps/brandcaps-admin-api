// pages/api/auth/users/[id]/role.js
import { connectDB } from '../../../../lib/mongoose'
import User from '../../../../models/User'
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {
  if (req.method !== 'PATCH')
    return res.status(405).json({ message: 'Método no permitido' })

  // 1. Verificamos que venga el JWT en Authorization header
  const auth = req.headers.authorization?.split(' ')[1]
  if (!auth) return res.status(401).json({ message: 'No autorizado' })

  let payload
  try {
    payload = jwt.verify(auth, process.env.JWT_SECRET)
  } catch {
    return res.status(401).json({ message: 'Token inválido' })
  }

  // 2. Sólo admins pueden cambiar roles
  if (payload.role !== 'admin')
    return res.status(403).json({ message: 'Acceso denegado' })

  const { id } = req.query
  const { role } = req.body

  // 3. Validar rol recibido
  if (!['cliente','admin'].includes(role))
    return res.status(400).json({ message: 'Rol no válido' })

  await connectDB()
  const user = await User.findByIdAndUpdate(id, { role }, { new: true })
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' })

  return res.json({ id: user._id, email: user.email, role: user.role })
}
