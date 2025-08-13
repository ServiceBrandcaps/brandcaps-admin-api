// src/app/api/admin/products/route.js
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Product from "@/models/Product";
import { uploadBufferToCloudinary } from "@/lib/uploads";

export const runtime = "nodejs";

/**
 * GET /api/admin/products
 * Filtros:
 *  - name: string (contains, i)
 *  - family: multi ?family=Escritura&family=Drinkware  (filtra por families.description)
 *  - subattribute: multi ?subattribute=Metal&subattribute=Algodón (filtra por subattributes.name)
 * Paginación:
 *  - page (default 1)
 *  - limit (default 100)
 * Devuelve: { items, total, totalPages, page }
 */
export async function GET(req) {
  await connectDB();
  const { searchParams } = new URL(req.url);

  const filters = {};

  // name (contains)
  if (searchParams.has("name")) {
    filters.name = new RegExp(searchParams.get("name"), "i");
  }

  // families (multi)
  const fams = searchParams.getAll("family");
  if (fams.length) {
    filters["families.description"] = {
      $in: fams.map((f) => new RegExp(f, "i")),
    };
  }

  // subattributes (multi)
  const subs = searchParams.getAll("subattribute");
  if (subs.length) {
    filters["subattributes.name"] = {
      $in: subs.map((s) => new RegExp(s, "i")),
    };
  }

  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "100", 10);
  const skip = (page - 1) * limit;

  const total = await Product.countDocuments(filters);
  const items = await Product.find(filters).skip(skip).limit(limit).lean();
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return NextResponse.json({ items, total, totalPages, page });
}

/**
 * POST /api/admin/products
 * Crea producto. Soporta:
 *  - multipart/form-data (con imágenes -> Cloudinary)
 *  - application/json (sin archivos, images opcionales como [{image_url}] o URLs)
 */
export async function POST(req) {
  await connectDB();
  const contentType = req.headers.get("content-type") || "";

  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    const formData = await req.formData();
    return createFromFormData(formData);
  }

  if (contentType.includes("application/json")) {
    const body = await req.json();
    return createFromJson(body);
  }

  return NextResponse.json(
    { error: `Unsupported Content-Type: ${contentType}` },
    { status: 415 }
  );
}

/**
 * PATCH /api/admin/products
 * Edita producto. Soporta:
 *  - multipart/form-data (con opción replaceImages=true/false e imágenes nuevas)
 *  - application/json (margen, sección u otros campos simples)
 */
export async function PATCH(req) {
  await connectDB();
  const contentType = req.headers.get("content-type") || "";

  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    const formData = await req.formData();
    return patchFromFormData(formData);
  }

  if (contentType.includes("application/json")) {
    const body = await req.json();
    return patchFromJson(body);
  }

  return NextResponse.json(
    { error: `Unsupported Content-Type: ${contentType}` },
    { status: 415 }
  );
}

/* ===================== HELPERS ===================== */

async function createFromFormData(formData) {
  const name = formData.get("name")?.toString().trim() ?? "";
  const priceStr = formData.get("price")?.toString() ?? "";
  const marginStr = formData.get("marginPercentage")?.toString() ?? "0";
  const section = formData.get("section")?.toString() ?? "";
  const frontSection = formData.get("frontSection")?.toString() ?? section;
  const isBrandcaps = (formData.get("isBrandcaps")?.toString() ?? "false") === "true";

  if (!name || !priceStr) {
    return NextResponse.json(
      { error: "Nombre y precio son obligatorios" },
      { status: 400 }
    );
  }

  // families / subattributes coma-separados
  const familiesStr = formData.get("families")?.toString() ?? "";
  const subattrsStr = formData.get("subattributes")?.toString() ?? "";

  const families = familiesStr
    ? familiesStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((description) => ({ description }))
    : [];

  const subattributes = subattrsStr
    ? subattrsStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => ({ name }))
    : [];

  // Imágenes -> Cloudinary
  const files = formData.getAll("images");
  const images = [];
  for (const file of files) {
    if (typeof File !== "undefined" && file instanceof File) {
      const buf = Buffer.from(await file.arrayBuffer());
      const url = await uploadBufferToCloudinary(buf, file.name);
      images.push({ image_url: url });
    }
  }

  try {
    const created = await Product.create({
      name,
      price: Number(priceStr),
      marginPercentage: Number(marginStr) || 0,
      frontSection,
      brandcapsProduct: isBrandcaps,
      families,
      subattributes,
      images,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function createFromJson(body) {
  const {
    name,
    price,
    marginPercentage = 0,
    section,
    frontSection: fs,
    isBrandcaps = true,
    images = [],
    families = [],
    subattributes = [],
  } = body;

  if (!name || price == null) {
    return NextResponse.json(
      { error: "Nombre y precio son obligatorios" },
      { status: 400 }
    );
  }

  // Normalizar imágenes: permitir strings o objetos { image_url }
  const imagesNorm = (images || []).map((img) =>
    typeof img === "string" ? { image_url: img } : img
  );

  try {
    const created = await Product.create({
      name,
      price: Number(price),
      marginPercentage: Number(marginPercentage) || 0,
      frontSection: fs ?? section ?? "",
      brandcapsProduct: !!isBrandcaps,
      images: imagesNorm,
      families,
      subattributes,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function patchFromJson(body) {
  const { id, _id, marginPercentage, section, frontSection, ...rest } = body;
  const docId = id || _id;
  if (!docId) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  const update = { ...rest };
  if (marginPercentage !== undefined)
    update.marginPercentage = Number(marginPercentage);
  if (frontSection !== undefined) update.frontSection = frontSection;
  if (section !== undefined) update.frontSection = section;

  try {
    const updated = await Product.findByIdAndUpdate(docId, update, {
      new: true,
    }).lean();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function patchFromFormData(formData) {
  const id = formData.get("id")?.toString();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const name = formData.get("name")?.toString();
  const price = formData.get("price")?.toString();
  const marginStr = formData.get("marginPercentage")?.toString();
  const section = formData.get("section")?.toString();
  const frontSection = formData.get("frontSection")?.toString();

  const familiesStr = formData.get("families")?.toString();
  const subattrsStr = formData.get("subattributes")?.toString();
  const replaceImages =
    (formData.get("replaceImages")?.toString() ?? "false") === "true";

  const update = {};
  if (name !== undefined) update.name = name;
  if (price !== undefined) update.price = Number(price);
  if (marginStr !== undefined) update.marginPercentage = Number(marginStr) || 0;
  if (frontSection !== undefined) update.frontSection = frontSection;
  if (section !== undefined) update.frontSection = section;

  if (familiesStr !== undefined) {
    update.families = familiesStr
      ? familiesStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((description) => ({ description }))
      : [];
  }
  if (subattrsStr !== undefined) {
    update.subattributes = subattrsStr
      ? subattrsStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((name) => ({ name }))
      : [];
  }

  // Procesar imágenes nuevas (Cloudinary)
  const files = formData.getAll("images");
  const newImages = [];
  for (const file of files) {
    if (typeof File !== "undefined" && file instanceof File) {
      const buf = Buffer.from(await file.arrayBuffer());
      const url = await uploadBufferToCloudinary(buf, file.name);
      newImages.push({ image_url: url });
    }
  }

  try {
    let updated = await Product.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (newImages.length) {
      if (replaceImages) {
        updated = await Product.findByIdAndUpdate(
          id,
          { $set: { images: newImages } },
          { new: true }
        ).lean();
      } else {
        updated = await Product.findByIdAndUpdate(
          id,
          { $push: { images: { $each: newImages } } },
          { new: true }
        ).lean();
      }
    }

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
