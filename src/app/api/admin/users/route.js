import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── CORS (ajustá el origen permitido si querés)
const CORS = {
  "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_STORE_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
// Preflight
export function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

// Helpers
function getTokenFromReq(req) {
  // 1) Authorization: Bearer <token>
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7).trim();

  // 2) X-Auth-Token (por si algún cliente lo manda así)
  const x = req.headers.get("x-auth-token");
  if (x) return x.trim();

  // 3) Cookie: token=<jwt> (puede venir URL-encoded)
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)token=([^;]+)/);
  if (m) {
    try { return decodeURIComponent(m[1]); } catch { return m[1]; }
  }
  return null;
}

function json(data, { status = 200 } = {}) {
  return NextResponse.json(data, { status, headers: CORS });
}

async function requireAdmin(req) {
  const token = getTokenFromReq(req);
  if (!token) return json({ error: "Unauthorized: no token" }, { status: 401 });

  const secret = process.env.JWT_SECRET;
  if (!secret) return json({ error: "Server misconfig: JWT_SECRET missing" }, { status: 500 });

  try {
    const payload = jwt.verify(token, secret);
    if (payload?.role !== "admin") return json({ error: "Forbidden" }, { status: 403 });
    return { payload }; // success
  } catch {
    return json({ error: "Invalid token" }, { status: 401 });
  }
}

// ── Handlers
export async function GET(req) {
  try {
    await connectDB();
    const guard = await requireAdmin(req);
    if (guard instanceof NextResponse) return guard;

    const users = await User.find().select("email role createdAt updatedAt").lean();
    return json(users);
  } catch (e) {
    console.error("[/api/admin/users GET] ", e);
    return json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await connectDB();
    const guard = await requireAdmin(req);
    if (guard instanceof NextResponse) return guard;

    const { email, password, role = "cliente" } = await req.json();
    if (!email || !password) return json({ error: "Email y password son obligatorios" }, { status: 400 });

    // Validación básica de rol
    const allowed = new Set(["admin", "cliente", "editor"]);
    if (!allowed.has(role)) return json({ error: "Rol inválido" }, { status: 400 });

    const created = await User.create({ email, password, role });
    return json({ _id: created._id, email: created.email, role: created.role }, { status: 201 });
  } catch (e) {
    console.error("[/api/admin/users POST] ", e);
    return json({ error: e?.code === 11000 ? "Email ya existe" : "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    await connectDB();
    const guard = await requireAdmin(req);
    if (guard instanceof NextResponse) return guard;

    const { id, role } = await req.json();
    if (!id || !role) return json({ error: "id y role son obligatorios" }, { status: 400 });

    const allowed = new Set(["admin", "cliente", "editor"]);
    if (!allowed.has(role)) return json({ error: "Rol inválido" }, { status: 400 });

    const updated = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true, runValidators: true, select: "email role" }
    ).lean();

    if (!updated) return json({ error: "Usuario no encontrado" }, { status: 404 });
    return json(updated);
  } catch (e) {
    console.error("[/api/admin/users PATCH] ", e);
    return json({ error: "Internal error" }, { status: 500 });
  }
}
