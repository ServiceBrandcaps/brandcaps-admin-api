// src/app/api/admin/users/route.js
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";        // Ajusta tu helper de conexión
import User from "@/models/User";                  // Tu modelo de Mongoose
import jwt from "jsonwebtoken";

// Middleware muy básico que extrae y valida el JWT de la cookie
async function requireAdmin(req) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/token=([^;]+)/);
  if (!match) throw new Error("No token");

  const token = match[1];
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new Error("Invalid token");
  }
  if (payload.role !== "admin") throw new Error("Not admin");
}

export async function GET(req) {
  try {
    // 1) Conectar a la DB
    await connectDB();

    // 2) Verificar que sea admin
    await requireAdmin(req);

    // 3) Obtener usuarios (solo email y role)
    const users = await User.find().select("email role");

    // 4) Responder
    return NextResponse.json(users);
  } catch (err) {
    console.error("API /admin/users error:", err);
    const status = err.message === "Not admin" ? 403
                  : err.message === "No token" || err.message === "Invalid token" ? 401
                  : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
export async function POST(request) {
  const { email, password, role } = await request.json();

  // validaciones básicas
  if (!email || !password || !role) {
    return NextResponse.json(
      { error: "Faltan datos obligatorios" },
      { status: 400 }
    );
  }

  await connectDB();

  // evitar duplicados
  if (await User.findOne({ email })) {
    return NextResponse.json(
      { error: "El email ya está registrado" },
      { status: 409 }
    );
  }

  try {
    const u = new User({ email, password, role });
    await u.save();

    // devuelve sólo lo necesario
    return NextResponse.json(
      { _id: u._id, email: u.email, role: u.role },
      { status: 201 }
    );
  } catch (e) {
    console.error("Error al crear usuario:", e);
    return NextResponse.json(
      { error: "Error interno al crear usuario" },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  const { id, role } = await request.json()

  if (!id || !role) {
    return NextResponse.json({ error: 'ID o rol faltante' }, { status: 400 })
  }

  await connectDB()
  const u = await User.findByIdAndUpdate(
    id,
    { role },
    { new: true, runValidators: true }
  ).select('email role')

  if (!u) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  return NextResponse.json(
    { _id: u._id, email: u.email, role: u.role },
    { status: 200 }
  )
}