import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongoose'
import Product from '@/models/Product'

function salePrice(p) {
  const base = Number(p?.price || 0)
  const margin = Number(p?.marginPercentage || 0)
  return Math.round(base * (1 + margin / 100))
}

export async function GET(req) {
  await connectDB()

  const url = new URL(req.url)
  const q        = url.searchParams.get('q') || ''
  const family   = url.searchParams.get('family') || ''
  const subattrs = url.searchParams.getAll('sub') || []
  const section  = url.searchParams.get('section') || ''
  const page     = parseInt(url.searchParams.get('page') || '1', 10)
  const limit    = parseInt(url.searchParams.get('limit') || '30', 10)
  const skip     = (page - 1) * limit

  const filters = {}
  if (q)       filters.name = new RegExp(q, 'i')
  if (family)  filters['families.description'] = new RegExp(family, 'i')
  if (subattrs.length) {
    filters['subattributes.name'] = { $in: subattrs.map(s => new RegExp(s, 'i')) }
  }
  if (section) filters.frontSection = section

  const total = await Product.countDocuments(filters)
  const docs  = await Product
    .find(filters)
    .select('name price marginPercentage families subattributes images frontSection')
    .skip(skip)
    .limit(limit)
    .lean()

  const items = docs.map(d => ({
    _id: d._id,
    name: d.name,
    image: d.images?.[0]?.image_url || d.images?.[0]?.url || null,
    families: d.families || [],
    subattributes: d.subattributes || [],
    section: d.frontSection || null,
    // lo que consume el front:
    salePrice: salePrice(d),
  }))

  return NextResponse.json({
    items,
    total,
    totalPages: Math.ceil(total / limit),
    page,
  })
}
