import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Product from "@/models/Product";

function salePrice(p) {
  const base = Number(p?.price || 0);
  const margin = Number(p?.marginPercentage || 0);
  const tax = Number(p?.tax || 0)
  const newBase = Math.round(base * (1 + margin / 100))
  return Math.round(newBase * (1 + tax / 100));
}

function searchMainImage(p) {
  const product = p;
  if (!product) return null;
  //console.log(product);
  // Normalizamos imágenes: array => ok, string "image" => [{url}], main_image_url => [{url}]
  const images =
    (Array.isArray(product.images) &&
      product.images.length > 0 &&
      product.images) ||
    (product.image ? [{ url: product.image }] : null) ||
    (product.main_image_url ? [{ url: product.main_image_url }] : []);

  // Elegimos la principal
  const mainImg =
    images.find?.((i) => i.main_integrator) ||
    images.find?.((i) => i.main) ||
    images[0];

  return mainImg
}

export async function GET(req) {
  await connectDB();

  const url = new URL(req.url);
  //const q = url.searchParams.get("q") || "";
  const q = url.searchParams.get("q") || url.searchParams.get("name");
  const family = url.searchParams.getAll("family") || [];
  const subattrs = url.searchParams.getAll("sub") || [];
  const sections = url.searchParams.getAll("section");
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "30", 10);
  const skip = (page - 1) * limit;

  const filters = {};
  if (q) filters.name = new RegExp(q, "i");
  //if (family) filters["families.description"] = new RegExp(family, "i");
    if (family.length) {
    const regexes = family.map(f => new RegExp(f, 'i'));

    // Soporta dos formas de guardar familias:
    // - como subdocs: [{ description }]
    // - como array de strings: ["Escritura", ...]
    filters.$or = [
      { 'families.description': { $in: regexes } },
      { families: { $in: regexes } },
    ];
  }
  if (subattrs.length) {
    filters["subattributes.name"] = {
      $in: subattrs.map((s) => new RegExp(s, "i")),
    };
  }
  if (sections.length) {
    filters.frontSection = {
      $in: sections.map((s) => new RegExp(`^${s}$`, "i")),
    };
  }

  const total = await Product.countDocuments(filters);
  const docs = await Product.find(filters)
    .select(
      "name price marginPercentage families subattributes images frontSection products tax"
    )
    .skip(skip)
    .limit(limit)
    .lean();

  const items = docs.map((d) => ({
    _id: d._id,
    name: d.name,
    image:  searchMainImage(d) ,//d.images?.[0]?.image_url || d.images?.[0]?.url || null,
    images: d.images || [],
    families: d.families || [],
    subattributes: d.subattributes || [],
    section: d.frontSection || null,
    // lo que consume el front:
    salePrice: salePrice(d),
    products: (d.products || []).map((v) => ({
      providerId: v.providerId ?? v.id ?? null,
      sku: v.sku,
      stock: Number(v.stock ?? 0),
      size: v.size || "",
      color: v.color || "",
      achromatic: !!v.achromatic,
    })),
  }));

  //console.log(items[0]);

  return NextResponse.json({
    items,
    total,
    totalPages: Math.ceil(total / limit),
    page,
  });
}
