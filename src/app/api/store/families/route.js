// app/api/store/families/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_STORE_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

/* ======================= Helpers de normalización ======================= */

const _normalize = (s = "") =>
  s.toString().trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const _slugify = (s = "") =>
  _normalize(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function hideFamily(titleOrSlug = "") {
  const n = _normalize(titleOrSlug);
  const sl = _slugify(titleOrSlug);
  return (
    n.includes("logo 24") ||
    n.includes("logo24") ||
    sl === "logo-24" ||
    sl === "logo-24hs" ||
    sl === "logo24" ||
    sl.startsWith("logo-24")
  );
}

// Activa solo si show === true (vos lo pediste así)
const isActiveFamily = (f = {}) => f?.show === true;

const pickFamily = (f = {}) => {
  const id =
    f.id ?? f.familyId ?? f.family_id ?? f._id ??
    String(f.slug || f.name || f.title || "");
  const title = f.title ?? f.name ?? f.description ?? "";
  const slug = f.slug ?? _slugify(title);
  const icon_url =
    f.icon_url ?? f.iconActiveUrl ?? f.icon_active_url ?? f.icon ?? f.image ?? null;

  return {
    id: String(id),
    title: String(title),
    description: f.description || "",
    url: f.url || "",
    icon_url,
    slug,
    show: f.show === true,
  };
};

/* ======================= Autenticación flexible ======================== */

function buildAuthHeaders(variant = 0) {
  const key = process.env.ZECAT_TOKEN || "";
  const cookie = process.env.ZECAT_SESSION_COOKIE || "";
  const headers = { "Content-Type": "application/json" };

  if (key) {
    if (variant === 0) headers.Authorization = `Bearer ${key}`;
    if (variant === 1) headers["x-api-key"] = key;
    if (variant === 2) headers.apikey = key;
  }
  if (cookie) headers.Cookie = cookie;

  return headers;
}

async function tryFetch(url, variant = 0, addQueryApiKey = false) {
  const u = new URL(url);
  const key = process.env.ZECAT_TOKEN || "";
  if (addQueryApiKey && key) u.searchParams.set("api_key", key);

  const res = await fetch(u.toString(), {
    method: "GET",
    headers: buildAuthHeaders(variant),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });

  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* texto plano */ }

  return { ok: res.ok, status: res.status, json, text };
}

/* ======================= Extractor robusto de lista ===================== */

function extractList(j) {
  // Orden de prueba de formatos conocidos
  const candidates = [
    j,
    j?.families,
    j?.families?.items,
    j?.items,
    j?.data,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  // Si es un objeto tipo indexado (ej: { "123": {...}, "456": {...} })
  for (const c of candidates) {
    if (c && typeof c === "object" && !Array.isArray(c)) {
      const vals = Object.values(c);
      if (vals.length && vals.every((v) => v && typeof v === "object")) {
        return vals;
      }
    }
  }
  return [];
}

/* ======================= Fetch a Zecat /family ========================= */

async function fetchAllFamilies() {
  const base = (process.env.ZECAT_API_BASE || "https://api.zecat.com/v1").replace(/\/+$/, "");
  const pagedUrl = `${base}/family?page=1&limit=200`;
  const plainUrl = `${base}/family`;

  // 1) Intento con paginado
  for (let v = 0; v < 4; v++) {
    const r = await tryFetch(pagedUrl, v, v === 3);
    if (r.ok) return extractList(r.json);
    if (r.status === 401) {
      const msg = r.json?.message || r.text || "Unauthorized";
      const err = new Error(`Zecat /family 401: ${msg}`);
      err.status = 401;
      throw err;
    }
  }

  // 2) Fallback sin paginado
  for (let v = 0; v < 4; v++) {
    const r = await tryFetch(plainUrl, v, v === 3);
    if (r.ok) return extractList(r.json);
    if (r.status === 401) {
      const msg = r.json?.message || r.text || "Unauthorized";
      const err = new Error(`Zecat /family 401: ${msg}`);
      err.status = 401;
      throw err;
    }
  }

  const e = new Error("Zecat /family unreachable");
  e.status = 502;
  throw e;
}

/* ============================== Handler ================================ */

export async function GET() {
  try {
    const raw = await fetchAllFamilies();

    const families = raw
      .map(pickFamily)
      .filter((f) => f.show && !hideFamily(f.title) && !hideFamily(f.slug));

    // dedup + orden
    const seen = new Set();
    const out = [];
    for (const f of families) {
      const key = f.id || `${f.slug}::${f.title}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const { slug, show, ...rest } = f;
      out.push(rest);
    }
    out.sort((a, b) => String(a.title).localeCompare(String(b.title), "es"));

    return NextResponse.json(out, { headers: CORS });
  } catch (err) {
    const status = err?.status === 401 ? 401 : 502;
    console.error("[/api/store/families] zecat error:", err?.message || err);
    return NextResponse.json(
      {
        error:
          status === 401
            ? "No autorizado a Zecat (/family)"
            : "No se pudieron cargar las categorías",
      },
      { status, headers: CORS }
    );
  }
}
