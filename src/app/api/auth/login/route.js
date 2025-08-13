// src/app/api/auth/login/route.js
import { connectDB } from '../../../../lib/mongoose';
import User from '../../../../models/User';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export async function POST(req) {
  const { email, password } = await req.json();
  await connectDB();
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return new Response('Credenciales inválidas', { status: 401 });
  }
  const token = jwt.sign({ sub: user._id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '8h' });
  // lo devolvemos en JSON; luego en el cliente lo guardas en cookie o localStorage
  return new Response(JSON.stringify({ token, role: user.role }), { status: 200 });
}
