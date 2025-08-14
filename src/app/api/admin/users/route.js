import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
function getTokenFromReq(req) {
  // 1) Authorization: Bearer <token>
  const auth =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7);

  // 2) Cookie: token=<jwt>
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)token=([^;]+)/);
  if (m) return m[1];

  return null;
}

async function requireAdmin(req) {
  const token = getTokenFromReq(req);
  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized: no token" },
      { status: 401 }
    );
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // si todo ok devolvemos null (sin error) y el payload por si lo querés usar
    return { payload };
  } catch (err) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req) {
  await connectDB();

  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard; // devolvió error
  // guard = { payload }

  const users = await User.find()
    .select("email role createdAt updatedAt")
    .lean();
  return NextResponse.json(users);
}

export async function POST(req) {
  await connectDB();

  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const { email, password, role = "cliente" } = await req.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email y password son obligatorios" },
      { status: 400 }
    );
  }

  // El hash lo hace el pre('save') del modelo
  const created = await User.create({ email, password, role });
  return NextResponse.json(
    { _id: created._id, email: created.email, role: created.role },
    { status: 201 }
  );
}

export async function PATCH(req) {
  await connectDB();

  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const { id, role } = await req.json();
  if (!id || !role) {
    return NextResponse.json(
      { error: "id y role son obligatorios" },
      { status: 400 }
    );
  }

  const updated = await User.findByIdAndUpdate(
    id,
    { role },
    { new: true, runValidators: true, select: "email role" }
  ).lean();

  if (!updated) {
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json(updated);
}
