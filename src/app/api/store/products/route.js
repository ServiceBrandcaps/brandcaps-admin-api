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

function salePrice(p) {
  const base = Number(p?.price || 0);
  const margin = Number(p?.marginPercentage || 0);
  const tax = Number(p?.tax || 0);
  const newBase = Math.round(base * (1 + margin / 100));
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

  return mainImg;
}

export async function GET(req) {
  const startTime = Date.now();
  
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    
    // Validate query parameters
    const validation = validateQueryParams(searchParams);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: validation.errors },
        { status: 400 }
      );
    }

    // Build optimized filters using utility function
    const filters = buildProductFilters(searchParams);
    
    // Parse pagination parameters with limits
    const { page, limit, skip } = parsePaginationParams(searchParams, {
      defaultLimit: 30,
      maxLimit: 100,
    });
    
    // Build sort options
    const sortOptions = buildSortOptions(searchParams);
    
    // Build field projection for faster queries (store context)
    const projection = buildFieldProjection('store');

    // Execute count and find queries in parallel
    const [total, docs] = await Promise.all([
      Product.countDocuments(filters),
      Product.find(filters, projection)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
    ]);

    // Transform documents for client consumption
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

    // Log performance for monitoring
    logQueryPerformance('/api/store/products', startTime, {
      totalCount: total,
      returnedCount: items.length,
      filters,
    });

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
      // Legacy fields for backward compatibility
      total,
      totalPages,
    });
  } catch (error) {
    console.error('[GET /api/store/products] Error:', error);
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
