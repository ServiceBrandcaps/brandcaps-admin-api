// app/api/health/route.js
import { NextResponse, NextResponse as NR } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";

export const dynamic = "force-dynamic"; // no cache

// util pequeño de timeout sobre una promesa
function withTimeout(promise, ms, onTimeoutMsg = "timeout") {
  let id;
  const t = new Promise((_, rej) => (id = setTimeout(() => rej(new Error(onTimeoutMsg)), ms)));
  return Promise.race([promise.finally(() => clearTimeout(id)), t]);
}

function makeBase(status = "ok") {
  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0",
  };
}

export async function GET(req) {
  const started = Date.now();
  const url = new URL(req.url);
  const lite = url.searchParams.get("lite") === "1"; // health lite (sin DB)
  const health = makeBase("ok");

  // Si lite=1, devolvemos rápido sin tocar DB (ideal p/Render)
  if (lite) {
    health.mode = "lite";
    health.responseTime = `${Date.now() - started}ms`;
    return NextResponse.json(health, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Health-Check": "true",
      },
    });
  }

  // Modo completo: chequea DB con timeout corto
  try {
    // conecta con timeout (p.ej. 1500ms)
    await withTimeout(connectDB(), 1500, "db connect timeout");

    const state = mongoose.connection.readyState; // 0=disc,1=conn,2=conn-ing,3=disc-ing
    const dbStates = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };

    // ping con timeout independiente (p.ej. 1200ms)
    let pingStatus = "skip";
    try {
      // usar comando ping nativo del driver
      await withTimeout(mongoose.connection.db.command({ ping: 1 }), 1200, "db ping timeout");
      pingStatus = "ok";
    } catch (e) {
      pingStatus = `error: ${e.message}`;
    }

    health.database = {
      status: state === 1 && pingStatus === "ok" ? "healthy" : "degraded",
      state: dbStates[state],
      name: mongoose.connection.name || "unknown",
      ping: pingStatus,
    };

    if (!(state === 1 && pingStatus === "ok")) {
      health.status = "degraded";
    }
  } catch (err) {
    // jamás tiramos error; devolvemos 503 con detalle
    health.status = "degraded";
    health.database = { status: "unhealthy", error: err.message || "db error" };
  }

  health.responseTime = `${Date.now() - started}ms`;

  if (process.env.NODE_ENV === "production") {
    const m = process.memoryUsage();
    health.memory = {
      heapUsed: `${Math.round(m.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(m.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(m.rss / 1024 / 1024)}MB`,
    };
  }

  const statusCode = health.status === "ok" ? 200 : 503;
  return NextResponse.json(health, {
    status: statusCode,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Health-Check": "true",
    },
  });
}

// HEAD ultrarrápido: no toca DB, ideal para pings
export async function HEAD() {
  return new NR(null, {
    status: 204,
    headers: {
      "X-Health-Check": "true",
      "Cache-Control": "no-store",
    },
  });
}
