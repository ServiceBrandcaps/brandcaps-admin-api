import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import Product from "@/models/Product";
import { uploadBufferToCloudinary } from "@/lib/uploads";
import { generateSku } from "@/lib/sku";
import {
  buildProductFilters,
  buildSortOptions,
  parsePaginationParams,
  buildFieldProjection,
  logQueryPerformance,
  validateQueryParams,
} from "@/lib/productQueryOptimizer";

export const runtime = "nodejs";

const norm = (s = "") =>
  s
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const slug = (s = "") =>
  norm(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function buildVarSku(product, v, idx) {
  const base =
    product.sku || product.external_id || String(product._id || "prd");
  const parts = [
    slug(v.color || ""),
    slug(v.material || ""),
    slug(v.size || ""),
  ].filter(Boolean);
  let draft = `${base}${parts.length ? "-" + parts.join("-") : ""}`;
  if (!parts.length) draft = `${base}-var-${idx + 1}`;
  return draft.toUpperCase();
}

function ensureVariantSkus(productDoc) {
  const seen = new Set();
  (productDoc.products || []).forEach((v, i) => {
    if (!v.sku || !v.sku.trim()) v.sku = buildVarSku(productDoc, v, i);
    let cand = v.sku,
      k = 1;
    while (seen.has(cand)) cand = `${v.sku}-${++k}`;
    v.sku = cand;
    seen.add(cand);
  });
}

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

// Helpers de parseo seguros ---------------------------------
function parseMaybeJSON(val, fallback) {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    const s = val.trim();
    if (!s) return fallback;
    try {
      return JSON.parse(s);
    } catch {
      return fallback;
    }
  }
  if (val && typeof val === "object") return val;
  return fallback;
}

function parseFamilies(input) {
  // Acepta: array objetos, array strings, string "A, B", string JSON '["A","B"]'
  const fromJson = parseMaybeJSON(input, null);
  if (fromJson) {
    return fromJson.map((f) =>
      typeof f === "string" ? { description: f } : f
    );
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((description) => ({ description }));
  }
  return [];
}

function parseSubattributes(input) {
  const fromJson = parseMaybeJSON(input, null);
  if (fromJson) {
    return fromJson.map((s) => (typeof s === "string" ? { name: s } : s));
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
  }
  return [];
}

function normalizeImages(input) {
  // Acepta: array de strings o array de objetos { image_url }/{ url }
  const arr = parseMaybeJSON(input, []);
  return arr
    .map((i) => {
      if (typeof i === "string") return { image_url: i };
      if (i?.image_url) return { image_url: i.image_url };
      if (i?.url) return { image_url: i.url };
      return null;
    })
    .filter(Boolean);
}

/**
 * GET /api/admin/products
 * Optimized endpoint with:
 * - Better query building and filtering
 * - Field projection for faster queries
 * - Improved pagination
 * - Text search support
 * - Performance logging
 */
export async function GET(req) {
  const startTime = Date.now();
  
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    
    // Validate query parameters
    const validation = validateQueryParams(searchParams);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.errors },
        { status: 400 }
      );
    }

    // Build optimized filters using utility function
    const filters = buildProductFilters(searchParams);
    
    // Parse pagination parameters with limits
    const { page, limit, skip } = parsePaginationParams(searchParams, {
      defaultLimit: 50,
      maxLimit: 100,
    });
    
    // Build sort options
    const sortOptions = buildSortOptions(searchParams);
    
    // Build field projection for faster queries
    // Can be overridden with ?fields=list|admin|store
    const projectionType = searchParams.get('fields') || 'admin';
    const projection = buildFieldProjection(projectionType);

    // Execute count and find queries
    // Use countDocuments with same filters for accurate count
    const [totalCount, products] = await Promise.all([
      Product.countDocuments(filters),
      Product.find(filters, projection)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    // Log performance for monitoring
    logQueryPerformance('/api/admin/products', startTime, {
      totalCount,
      returnedCount: products.length,
      filters,
    });

    return NextResponse.json({
      success: true,
      items: products,
      products, // Keep for backward compatibility
      pagination: {
        page,
        limit,
        total: totalCount,
        totalCount, // Keep for backward compatibility
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      // Legacy fields for backward compatibility
      total: totalCount,
      totalCount,
      totalPages,
    });
  } catch (error) {
    console.error('[GET /api/admin/products] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch products',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/products
 * Soporta multipart/form-data o application/json
 * Optimized with:
 * - Better error handling
 * - Request validation
 * - Idempotency support
 * - Performance logging
 */
export async function POST(req) {
  const startTime = Date.now();
  
  try {
    await connectDB();
    await ensureIndexes();
    
    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    const idemKey = req.headers.get("x-idempotency-key")?.trim() || null;

    if (
      contentType.includes("multipart/form-data") ||
      contentType.includes("application/x-www-form-urlencoded")
    ) {
      const formData = await req.formData();
      const result = await createFromFormData(formData, idemKey);
      
      // Log performance
      const duration = Date.now() - startTime;
      console.log(`[POST /api/admin/products] Completed in ${duration}ms`);
      
      return result;
    }

    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => null);
      if (!body) {
        return NextResponse.json(
          { success: false, error: "JSON body vacío o inválido" },
          { status: 400 }
        );
      }
      
      const result = await createFromJson(body, idemKey);
      
      // Log performance
      const duration = Date.now() - startTime;
      console.log(`[POST /api/admin/products] Completed in ${duration}ms`);
      
      return result;
    }

    return NextResponse.json(
      { 
        success: false,
        error: `Unsupported Content-Type: ${contentType}`,
        message: 'Use multipart/form-data or application/json'
      },
      { status: 415 }
    );
  } catch (error) {
    console.error('[POST /api/admin/products] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create product',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/products
 * Optimized with:
 * - Better error handling
 * - Request validation
 * - Performance logging
 */
export async function PATCH(req) {
  const startTime = Date.now();
  
  try {
    await connectDB();
    
    const contentType = (req.headers.get("content-type") || "").toLowerCase();

    if (
      contentType.includes("multipart/form-data") ||
      contentType.includes("application/x-www-form-urlencoded")
    ) {
      const formData = await req.formData();
      const result = await patchFromFormData(formData);
      
      // Log performance
      const duration = Date.now() - startTime;
      console.log(`[PATCH /api/admin/products] Completed in ${duration}ms`);
      
      return result;
    }

    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => null);
      if (!body) {
        return NextResponse.json(
          { success: false, error: "JSON body vacío o inválido" },
          { status: 400 }
        );
      }
      
      const result = await patchFromJson(body);
      
      // Log performance
      const duration = Date.now() - startTime;
      console.log(`[PATCH /api/admin/products] Completed in ${duration}ms`);
      
      return result;
    }

    return NextResponse.json(
      {
        success: false,
        error: `Unsupported Content-Type: ${contentType}`,
        message: 'Use multipart/form-data or application/json'
      },
      { status: 415 }
    );
  } catch (error) {
    console.error('[PATCH /api/admin/products] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update product',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/* ===================== HELPERS ===================== */

async function createFromFormData(formData, idemKey) {
  try {
    const name = formData.get("name")?.toString().trim() ?? "";
    const priceStr = formData.get("price")?.toString() ?? "";
    const marginStr = formData.get("marginPercentage")?.toString() ?? "0";
    const section = formData.get("section")?.toString() ?? "";
    const frontSection = formData.get("frontSection")?.toString() ?? section;
    const description = formData.get("description")?.toString() ?? "";
    const isBrandcaps =
      (formData.get("isBrandcaps")?.toString() ?? "false") === "true";

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { success: false, error: "El nombre del producto es obligatorio" },
        { status: 400 }
      );
    }
    
    if (!priceStr || isNaN(priceStr)) {
      return NextResponse.json(
        { success: false, error: "El precio del producto es obligatorio y debe ser un número válido" },
        { status: 400 }
      );
    }

    // mínimo de pedido (default 20)
    const moq = num(formData.get("minimum_order_quantity"), 20);
    // escalas de precio
    const p20_100 = num(formData.get("price_20_100"), 0);
    const p100_plus = num(formData.get("price_100_plus"), 0);
    const p500_plus = num(formData.get("price_500_plus"), 0);

    const priceTiers = [
      { min: 20, max: 100, price: p20_100 },
      { min: 101, max: 499, price: p100_plus },
      { min: 500, max: null, price: p500_plus },
    ].filter((t) => t.price > 0);

    // variantes (puede venir JSON o vacío)
    const variantsInput = formData.get("variants") || "[]";
    const variantsIn = parseMaybeJSON(variantsInput, []);
    const variants = variantsIn.map((v) => ({
      idDataverse: v.idDataverse || "",
      id: v.id ?? undefined,
      sku:
        v.sku ||
        generateSku({
          name,
          color: v.color || "",
          size: v.size || "",
          material: v.material || "",
        }),
      stock: num(v.stock, 0),
      color: v.color || "",
      size: v.size || "",
      material: v.material || "",
      achromatic: !!v.achromatic,
    }));

    // families / subattributes (coma-separados o JSON)
    const families = parseFamilies(formData.get("families"));
    const subattributes = parseSubattributes(formData.get("subattributes"));

    // Imágenes -> Cloudinary
    const files = formData.getAll("images");
    const images = [];
    for (const file of files) {
      // En App Router los File vienen del Web API
      if (typeof File !== "undefined" && file instanceof File) {
        const buf = Buffer.from(await file.arrayBuffer());
        const url = await uploadBufferToCloudinary(buf, file.name);
        images.push({ image_url: url });
      }
    }

    const external_id = generateSku(name);

    const doc = {
      external_id,
      name,
      description,
      price: Number(priceStr),
      marginPercentage: Number(marginStr) || 0,
      frontSection,
      brandcapsProduct: isBrandcaps,
      minimum_order_quantity: moq,
      priceTiers,
      families,
      subattributes,
      images,
      products: variants,
    };

    return createOnce(doc, idemKey);
  } catch (error) {
    console.error('[createFromFormData] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al procesar los datos del formulario",
        message: error.message,
      },
      { status: 500 }
    );
  }
}

async function createFromJson(body, idemKey) {
  try {
    const {
      name = "",
      price,
      marginPercentage = 0,
      section,
      frontSection: fs,
      description = "",
      isBrandcaps = true,
      minimum_order_quantity = 20,
      price_20_100 = 0,
      price_100_plus = 0,
      price_500_plus = 0,
      images = [],
      families: famIn = [],
      subattributes: subIn = [],
      variants = [], // puede ser array o string JSON
    } = body || {};

    // Validate required fields
    if (!name.trim()) {
      return NextResponse.json(
        { success: false, error: "El nombre del producto es obligatorio" },
        { status: 400 }
      );
    }
    
    if (price == null || isNaN(price)) {
      return NextResponse.json(
        { success: false, error: "El precio del producto es obligatorio y debe ser un número válido" },
        { status: 400 }
      );
    }

    const priceTiers = [
      { min: 20, max: 100, price: price_20_100 },
      { min: 101, max: 499, price: price_100_plus },
      { min: 500, max: null, price: price_500_plus },
    ].filter((t) => t.price > 0);

    const families = parseFamilies(famIn);
    const subattributes = parseSubattributes(subIn);
    const variantsArr = parseMaybeJSON(variants, []);
    const imagesNorm = normalizeImages(images);

    const variantsMapped = variantsArr.map((v) => ({
      idDataverse: v.idDataverse || "",
      id: v.id ?? undefined,
      sku:
        v.sku ||
        generateSku({
          name,
          color: v.color || "",
          size: v.size || "",
          material: v.material || "",
        }),
      stock: num(v.stock, 0),
      color: v.color || "",
      size: v.size || "",
      material: v.material || "",
      achromatic: !!v.achromatic,
    }));

    const external_id = generateSku(name);

    const doc = {
      external_id,
      name: name.trim(),
      description,
      price: Number(price),
      marginPercentage: Number(marginPercentage) || 0,
      frontSection: fs ?? section ?? "",
      brandcapsProduct: !!isBrandcaps,
      minimum_order_quantity,
      priceTiers,
      images: imagesNorm,
      families,
      subattributes,
      products: variantsMapped,
    };

    return createOnce(doc, idemKey);
  } catch (error) {
    console.error('[createFromJson] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al procesar los datos JSON",
        message: error.message,
      },
      { status: 500 }
    );
  }
}

async function patchFromJson(body) {
  const {
    id,
    _id,
    marginPercentage,
    section,
    frontSection,
    description,
    ...rest
  } = body;
  const docId = id || _id;
  if (!docId)
    return NextResponse.json({ error: "id requerido" }, { status: 400 });

  // 1) actualizar campos simples
  const update = {};
  if (marginPercentage !== undefined)
    update.marginPercentage = Number(marginPercentage);
  if (frontSection !== undefined) update.frontSection = frontSection;
  if (section !== undefined) update.frontSection = section;
  if (description !== undefined) update.description = description;

  if (Object.keys(update).length) {
    await Product.findByIdAndUpdate(docId, update, {
      new: false,
      runValidators: true,
    });
  }

  // 2) mergear variantes por sku (y generar sku si falta)
  if (Array.isArray(rest.products)) {
    const incoming = rest.products.map((v) => ({
      sku: v.sku || v.SKU || "", // puede venir vacío (lo generamos)
      idDataverse: v.idDataverse ?? "",
      color: v.color ?? "",
      size: v.size ?? "",
      material: v.material ?? "",
      stock: Number(v.stock ?? 0),
      achromatic: !!v.achromatic,
    }));

    const doc = await Product.findById(docId);
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // merge por sku; si está vacío, lo agregamos igual y luego generamos sku
    const bySku = new Map((doc.products || []).map((v) => [v.sku, v]));
    for (const nv of incoming) {
      if (nv.sku && bySku.has(nv.sku)) {
        Object.assign(bySku.get(nv.sku), nv);
      } else {
        doc.products.push(nv); // nueva o “sin sku” (se completará más abajo)
      }
    }

    // genera sku faltantes y deduplica, luego guarda
    ensureVariantSkus(doc);
    await doc.save();
    const fresh = await Product.findById(docId).lean();
    return NextResponse.json(fresh);
  }

  // 3) sin variantes en el body -> devuelve doc actualizado
  const updated = await Product.findById(docId).lean();
  return NextResponse.json(updated);
}

async function patchFromFormData(formData) {
  const id = formData.get("id")?.toString();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const name = formData.get("name")?.toString();
  const price = formData.get("price")?.toString();
  const marginStr = formData.get("marginPercentage")?.toString();
  const section = formData.get("section")?.toString();
  const frontSection = formData.get("frontSection")?.toString();
  const description = formData.get("description")?.toString();

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
  if (description !== undefined) update.description = description;

  if (familiesStr !== undefined) {
    update.families = parseFamilies(familiesStr);
  }
  if (subattrsStr !== undefined) {
    update.subattributes = parseSubattributes(subattrsStr);
  }

  // Imágenes nuevas (Cloudinary)
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
    let updated = await Product.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).lean();
    if (!updated)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

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

/* ====== Idempotencia fuerte + upsert seguro ====== */
async function createOnce(doc, idemKey) {
  try {
    // Si viene clave de idempotencia, la “reservamos” (operación atómica)
    if (idemKey) {
      const coll = mongoose.connection.collection("idempotency_keys");
      const lock = await coll.findOneAndUpdate(
        { _id: idemKey },
        { $setOnInsert: { createdAt: new Date() } },
        { upsert: true, returnDocument: "after" }
      );
      const existed = lock?.lastErrorObject?.updatedExisting;

      if (existed) {
        // Ya hubo otro POST con la misma clave → devolvemos el producto si está
        const existing =
          (await Product.findOne({ external_id: doc.external_id }).lean()) ||
          (lock.value?.productId
            ? await Product.findById(lock.value.productId).lean()
            : null);

        if (existing) return NextResponse.json(existing, { status: 200 });

        // Si todavía está “en vuelo”, esperamos un poco
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 100));
          const k = await coll.findOne({ _id: idemKey });
          if (k?.productId) {
            const done = await Product.findById(k.productId).lean();
            if (done) return NextResponse.json(done, { status: 200 });
          }
        }
        return NextResponse.json(
          { error: "Solicitud duplicada en proceso" },
          { status: 409 }
        );
      }

      // Ganamos la llave → upsert por external_id que siempre devuelve doc
      const created = await Product.findOneAndUpdate(
        { external_id: doc.external_id },
        { $setOnInsert: doc },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).lean();

      if (!created) {
        // Defensa por si algo raro pasó
        const fallback = await Product.findOne({
          external_id: doc.external_id,
        }).lean();
        if (fallback) {
          await coll.updateOne(
            { _id: idemKey },
            { $set: { productId: fallback._id } }
          );
          return NextResponse.json(fallback, { status: 200 });
        }
        throw new Error("Upsert no devolvió documento");
      }

      await coll.updateOne(
        { _id: idemKey },
        { $set: { productId: created._id } }
      );
      return NextResponse.json(created, { status: 201 });
    }

    // Sin clave de idempotencia → igual hacemos upsert (dedupe por external_id)
    const created = await Product.findOneAndUpdate(
      { external_id: doc.external_id },
      { $setOnInsert: doc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    if (!created) {
      const fallback = await Product.findOne({
        external_id: doc.external_id,
      }).lean();
      if (fallback) return NextResponse.json(fallback, { status: 200 });
      throw new Error("Upsert no devolvió documento");
    }

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function ensureIndexes() {
  try {
    await Product.collection.createIndex({ external_id: 1 }, { unique: true });
  } catch (_) {}
}
