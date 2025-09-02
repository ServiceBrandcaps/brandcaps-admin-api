// src/app/api/store/products/[id]/route.js
import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/mongoose'
import Product from '@/models/Product'

function toNumOrNull(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Helpers comunes:
function hasLogo24Family(families = []) {
  return families.some(f => {
    const d = typeof f === 'string' ? f : f?.description;
    return /logo\s*24\s*hs/i.test(d || '');
  });
}

function stripLogo24Sentence(description = '') {
  if (!description) return description;

  // Remueve la leyenda de LOGO24 aunque tenga espacios o tildes variables.
  const re = /LOGO24:\s*Producto disponible.*?servicio\./i;
  const cleaned = description.replace(re, '').replace(/\s{2,}/g, ' ').trim();

  // Si quedó vacío, devuelvo string vacío para no romper serialización.
  return cleaned || '';
}

function sanitizeDoc(doc = {}) {
  if (hasLogo24Family(doc.families)) {
    doc.description = stripLogo24Sentence(doc.description);
  }
  return doc;
}


export async function GET(_req, context) {
  await connectDB()

  try {
    // ✅ En Next 15 params es una Promise
    const { id } = await context.params

    const projection =
      'name description price marginPercentage families subattributes images frontSection products ' +
      'height width length unit_weight units_per_box packaging supplementary_information_text printing_types ' +
      'tax minimum_order_quantity external_id priceTiers'

    let doc = null
    if (mongoose.isValidObjectId(id)) {
      doc = await Product.findById(id).select(projection).lean()
    }
    if (!doc) {
      doc = await Product.findOne({ externalId: id }).select(projection).lean()
    }
    if (!doc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    
    sanitizeDoc(doc);

    const base = Number(doc.price || 0)
    const m = Number(doc.marginPercentage || 0)
    const tax = Number(doc.tax || 0)
    const newBase = Math.round(base * (1 + m / 100) * 100) / 100
    const salePrice = Math.round(newBase * (1 + tax / 100) * 100 ) / 100

    const images = (doc.images || [])
      .map(i => i.image_url || i.url)
      .filter(Boolean)

    const variants = (doc.products || []).map(v => ({
      providerId: v.providerId ?? v.id ?? null,
      sku: v.sku,
      stock: Number(v.stock ?? 0),
      size: v.size || '',
      color: v.color || '',
      achromatic: !!v.achromatic,
    }))

    const priceTiers = (doc.priceTiers || []).map(p=> ({
      max: Number(p.max ?? 0),
      min: Number(p.min ?? 0),
      price: Number(p.price ?? 0),
    }))

    let printing_types = Array.isArray(doc.printing_types) ? doc.printing_types : []
    if (!printing_types.length) {
      printing_types = (doc.subattributes || [])
        .filter(s => {
          const a = (s.attribute_name || '').toLowerCase()
          return a.includes('técnica') || a.includes('impresión')
        })
        .map(s => (s.name || '').trim())
        .filter(Boolean)
    }

    //const dims = doc.dimensions || {}
    const dimensions = {
      height_cm:      toNumOrNull(doc.height),
      width_cm:       toNumOrNull(doc.width),
      length_cm:      toNumOrNull(doc.length),
      unit_weight_kg: toNumOrNull(doc.unit_weight),
    }

    return NextResponse.json({
      _id: doc._id,
      name: doc.name,
      description: doc.description || '',
      images,
      families: doc.families || [],
      subattributes: doc.subattributes || [],
      section: doc.frontSection || null,
      salePrice,
      priceTiers,
      products: variants,
      printing_types,
      dimensions,
      packaging: doc.packaging || '',
      units_per_box: doc.units_per_box ?? null,
      supplementary_information_text: doc.supplementary_information_text || '',
      minimum_order_quantity: doc.minimum_order_quantity || 0,
      sku: `${doc.external_id}` || null,
    })
  } catch (err) {
    console.error('STORE PRODUCT DETAIL ERROR:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
