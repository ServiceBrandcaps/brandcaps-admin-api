import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongoose'
import Product from '@/models/Product'
import mongoose from 'mongoose'

function salePrice(p) {
  const base = Number(p?.price || 0)
  const margin = Number(p?.marginPercentage || 0)
  return Math.round(base * (1 + margin / 100))
}

export async function GET(_req, { params }) {
  await connectDB()
  const { id } = params
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const p = await Product
    .findById(id)
    .select('name description price marginPercentage families subattributes images frontSection')
    .lean()

  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    _id: p._id,
    name: p.name,
    description: p.description || '',
    images: (p.images || []).map(i => i.image_url || i.url).filter(Boolean),
    families: p.families || [],
    subattributes: p.subattributes || [],
    section: p.frontSection || null,
    salePrice: salePrice(p),
  })
}
