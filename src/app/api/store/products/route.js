import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Product from "@/models/Product";
import {
  buildProductFilters,
  buildSortOptions,
  parsePaginationParams,
  buildFieldProjection,
  logQueryPerformance,
  validateQueryParams,
} from "@/lib/productQueryOptimizer";

/* ========================= Helpers locales ========================= */

function salePrice(p) {
  const base = Number(p?.price || 0);
  const margin = Number(p?.marginPercentage || 0);
  const tax = Number(p?.tax || 0);
  const newBase = Math.round(base * (1 + margin / 100));
  return Math.round(newBase * (1 + tax / 100));
}

function searchMainImage(p) {
  if (!p) return null;
  const images =
    (Array.isArray(p.images) && p.images.length > 0 && p.images) ||
    (p.image ? [{ url: p.image }] : null) ||
    (p.main_image_url ? [{ url: p.main_image_url }] : []);
  const mainImg =
    images?.find?.((i) => i.main_integrator) ||
    images?.find?.((i) => i.main) ||
    images?.[0];
  return mainImg || null;
}

const norm = (s = "") =>
  s.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const esc = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Filtro por familia:
 * - NO parte por comas; acepta múltiples ?family=A&family=B
 * - Tolerante a espacios alrededor (^\\s*valor\\s*$), case-insensitive
 * - Cubre string, array de strings y arrays de objetos {title,slug,description}
 * - Variantes con $elemMatch+$regex para arrays
 * - Fallback con $expr+$trim sobre strings
 */
const buildFamilyOr = (values = []) => {
  if (!values.length) return null;

  const vals = values.map((v) => String(v).trim()).filter(Boolean);
  const regs = vals.map((v) => new RegExp(`^\\s*${esc(v)}\\s*$`, "i"));
  const patts = vals.map((v) => `^\\s*${esc(v)}\\s*$`);

  const ors = [
    // strings / arrays de strings ($in con RegExp)
    { family: { $in: regs } },
    { categories: { $in: regs } },
    { "meta.family": { $in: regs } },
    { "zecat.family": { $in: regs } },
    { families: { $in: regs } },
    { "zecat.families": { $in: regs } },

    // arrays de objetos { title / slug / description }
    {
      families: {
        $elemMatch: {
          $or: [{ title: { $in: regs } }, { slug: { $in: regs } }, { description: { $in: regs } }],
        },
      },
    },
    {
      categories: {
        $elemMatch: {
          $or: [{ title: { $in: regs } }, { slug: { $in: regs } }, { description: { $in: regs } }],
        },
      },
    },
    {
      "zecat.families": {
        $elemMatch: {
          $or: [{ title: { $in: regs } }, { slug: { $in: regs } }, { description: { $in: regs } }],
        },
      },
    },

    // frontSection (string u objeto/array)
    { frontSection: { $in: regs } },
    {
      frontSection: {
        $elemMatch: {
          $or: [{ title: { $in: regs } }, { slug: { $in: regs } }, { description: { $in: regs } }],
        },
      },
    },
    { "frontSection.title": { $in: regs } },
    { "frontSection.slug": { $in: regs } },
    { "frontSection.description": { $in: regs } },
  ];

  // variantes con $elemMatch + $regex para arrays de strings
  for (const p of patts) {
    ors.push({ families: { $elemMatch: { $regex: p, $options: "i" } } });
    ors.push({ categories: { $elemMatch: { $regex: p, $options: "i" } } });
    ors.push({ "zecat.families": { $elemMatch: { $regex: p, $options: "i" } } });
    ors.push({ frontSection: { $elemMatch: { $regex: p, $options: "i" } } });
    // y frontSection como string simple
    ors.push({ frontSection: { $regex: p, $options: "i" } });
  }

  // fallback server-side con $expr + $trim en strings
  for (const p of patts) {
    ors.push({
      $expr: {
        $regexMatch: { input: { $trim: { input: "$family" } }, regex: p, options: "i" },
      },
    });
    ors.push({
      $expr: {
        $regexMatch: { input: { $trim: { input: "$meta.family" } }, regex: p, options: "i" },
      },
    });
    ors.push({
      $expr: {
        $regexMatch: { input: { $trim: { input: "$zecat.family" } }, regex: p, options: "i" },
      },
    });
    ors.push({
      $expr: {
        $regexMatch: { input: { $trim: { input: "$frontSection" } }, regex: p, options: "i" },
      },
    });
  }

  return { $or: ors };
};

/* ============================= Handler ============================= */

export async function GET(req) {
  const startTime = Date.now();

  try {
    await connectDB();

    const { searchParams } = new URL(req.url);

    // Validación de query
    const validation = validateQueryParams(searchParams);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: "Invalid query parameters", details: validation.errors },
        { status: 400 }
      );
    }

    /* ---------- Filtros base ---------- */
    const filtersBase = buildProductFilters(searchParams);

    // Collation consistente para búsquedas insensibles a mayúsculas/acentos
    const collation = { locale: "es", strength: 1 };

    // Si hay término de búsqueda y existe un match exacto, priorizarlo
    const rawSearch =
      searchParams.get("search") || searchParams.get("q") || searchParams.get("name");
    const searchTerm = rawSearch?.trim();

    let filters = { ...filtersBase };

    if (searchTerm) {
      const exactNameRegex = new RegExp(`^\\s*${esc(searchTerm)}\\s*$`, "i");
      const hasExactName = await Product.exists({ name: exactNameRegex }).collation(collation);

      if (hasExactName) {
        filters = { ...filters, name: exactNameRegex };
        if (filters.$text) delete filters.$text;
      }
    }

    // FIX: si el optimizador metió un filtro genérico sobre families.description, lo quitamos
    if (Object.prototype.hasOwnProperty.call(filtersBase, "families.description")) {
      delete filtersBase["families.description"];
      delete filters["families.description"];
    }

    // Exclusión robusta de LOGO 24 sin romper otras familias (se puede forzar incluir con ?includeLogo24=1)
    const includeLogo24 = searchParams.get("includeLogo24") === "1";
    let logo24Exclusion = null;
    if (!includeLogo24) {
      const logo24Patts = [
        "^\\s*logo\\s*24\\s*hs?\\s*$",
        "^\\s*logo\\s*24\\s*$",
        "^\\s*logo-?24\\s*hs?\\s*$",
        "^\\s*logo24\\s*hs?\\s*$",
        "^\\s*logo-?24",
      ].map((p) => new RegExp(p, "i"));

      logo24Exclusion = {
        $nor: [
          {
            families: {
              $elemMatch: {
                $or: [
                  { title: { $in: logo24Patts } },
                  { description: { $in: logo24Patts } },
                  { slug: { $in: logo24Patts } },
                ],
              },
            },
          },
          {
            categories: {
              $elemMatch: {
                $or: [
                  { title: { $in: logo24Patts } },
                  { description: { $in: logo24Patts } },
                  { slug: { $in: logo24Patts } },
                ],
              },
            },
          },
          {
            "zecat.families": {
              $elemMatch: {
                $or: [
                  { title: { $in: logo24Patts } },
                  { description: { $in: logo24Patts } },
                  { slug: { $in: logo24Patts } },
                ],
              },
            },
          },
          { family: { $in: logo24Patts } },
          { "meta.family": { $in: logo24Patts } },
          { "zecat.family": { $in: logo24Patts } },
          { frontSection: { $in: logo24Patts } },
        ],
      };
    }

    // Familias (siempre como array, con trim)
    const familiesFilter = searchParams
      .getAll("family")
      .map((v) => String(v).trim())
      .filter(Boolean);

    // Armado final de filtros: base -> excl LOGO24 -> familia

    if (logo24Exclusion) {
      filters = Object.keys(filters).length ? { $and: [filters, logo24Exclusion] } : logo24Exclusion;
    }

    const famOr = buildFamilyOr(familiesFilter);
    if (famOr) {
      filters = Object.keys(filters).length ? { $and: [filters, famOr] } : famOr;
    }

    // Paginación / orden / proyección
    const { page, limit, skip } = parsePaginationParams(searchParams, {
      defaultLimit: 30,
      maxLimit: 100,
    });
    const sortOptions = buildSortOptions(searchParams);
    const projection = buildFieldProjection("store");

    // Queries
    const [total, docs] = await Promise.all([
      Product.countDocuments(filters).collation(collation),
      Product.find(filters, projection)
        .collation(collation)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
    ]);

    // Transformación
    const items = docs.map((d) => ({
      _id: d._id,
      name: d.name,
      image: searchMainImage(d),
      images: d.images || [],
      families: d.families || [],
      subattributes: d.subattributes || [],
      section: d.frontSection || null,
      salePrice: salePrice(d),
      products: (d.products || []).map((v) => ({
        providerId: v.providerId ?? v.id ?? null,
        sku: v.sku,
        stock: Number(v.stock ?? 0),
        size: v.size || "",
        color: v.color || "",
        achromatic: !!v.achromatic,
      })),
      minimum_order_quantity: d.minimum_order_quantity,
      variants: (d?.variants?.colors || d?.variants?.sizes || []).map((v) => ({
        providerId: v.providerId ?? v.id ?? null,
        sku: v.sku,
        generalDescription: v.generalDescription || "",
        elementDescription1: v.elementDescription1 || "",
        elementDescription2: v.elementDescription2 || "",
        elementDescription3: v.elementDescription3 || "",
        additionalDescription: v.additionalDescription || "",
        stock: Number(v.stock ?? 0),
        size: v.size || "",
        color: v.color || "",
        active: v.active || true,
        achromatic: !!v.achromatic,
      })),
      tax: d.tax,
      brandcapsProduct: d.brandcapsProduct || false,
    }));

    const totalPages = Math.ceil(total / limit);

    /* ---------- Diagnóstico: _explain=1 ---------- */
    if (searchParams.get("_explain") === "1") {
      const hits = {};
      for (const p of items) {
        const pool = [p.families, p.section].flat(Infinity).filter(Boolean).map(String);
        for (const f of pool) {
          const k = norm(f);
          hits[k] = (hits[k] || 0) + 1;
        }
      }
      return NextResponse.json({
        success: true,
        appliedFamilies: familiesFilter,
        normalizedApplied: familiesFilter.map(norm),
        sampleFamilyHits: hits,
        page,
        limit,
        returnedCount: items.length,
        totalEstimate: total,
      });
    }

    /* ---------- Diagnóstico: _explain=2 (top familias) ---------- */
    if (searchParams.get("_explain") === "2") {
      const agg = await Product.aggregate([
        {
          $project: {
            fams: {
              $setUnion: [
                { $cond: [{ $isArray: "$families" }, "$families", []] },
                { $cond: [{ $isArray: "$categories" }, "$categories", []] },
                [{ $ifNull: ["$family", null] }],
                [{ $ifNull: ["$meta.family", null] }],
                [{ $ifNull: ["$zecat.family", null] }],
                { $cond: [{ $isArray: "$zecat.families" }, "$zecat.families", []] },
                [{ $ifNull: ["$frontSection", null] }],
              ],
            },
          },
        },
        { $unwind: "$fams" },
        {
          $project: {
            f: {
              $cond: [
                { $eq: [{ $type: "$fams" }, "object"] },
                {
                  $ifNull: [
                    "$fams.title",
                    { $ifNull: ["$fams.slug", { $ifNull: ["$fams.description", null] }] },
                  ],
                },
                "$fams",
              ],
            },
          },
        },
        { $match: { f: { $ne: null } } },
        { $group: { _id: { $toLower: "$f" }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 100 },
      ]);
      return NextResponse.json({
        success: true,
        appliedFamilies: familiesFilter,
        topFamiliesSample: agg,
      });
    }

    /* ---------- Diagnóstico: _explain=3 ---------- */
    if (searchParams.get("_explain") === "3") {
      const famOnly = buildFamilyOr(familiesFilter) || {};
      const famOnlyCount = await Product.countDocuments(famOnly);
      const famOnlySample = await Product.find(famOnly, {
        name: 1,
        family: 1,
        families: 1,
        categories: 1,
        frontSection: 1,
        meta: 1,
        zecat: 1,
      })
        .limit(5)
        .lean();

      return NextResponse.json({
        success: true,
        appliedFamilies: familiesFilter,
        famOnlyCount,
        famOnlySample,
        withAllFiltersCount: total,
        filtersBaseApplied: Object.keys(filtersBase),
      });
    }

    // Log
    logQueryPerformance("/api/store/products", startTime, {
      totalCount: total,
      returnedCount: items.length,
      filters,
    });

    // Respuesta normal
    return NextResponse.json({
      success: true,
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      total,
      totalPages,
    });
  } catch (error) {
    console.error("[GET /api/store/products] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch products", message: error.message },
      { status: 500 }
    );
  }
}
