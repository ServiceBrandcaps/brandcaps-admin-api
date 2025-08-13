import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongoose'
import Product from '@/models/Product'

export async function POST(req) {
  await connectDB()
  const { filter, margin, section } = await req.json()
  
  // Reconstruimos los mismos filtros que en GET
  const mongoFilter = {}
  if (filter.name) {
    mongoFilter.name = new RegExp(filter.name, 'i')
  }
  if (filter.family) {
    mongoFilter['families.description'] = new RegExp(filter.family, 'i')
  }
  if (filter.subattribute?.length) {
    mongoFilter['subattributes.name'] = {
      $in: filter.subattribute.map(s => new RegExp(s, 'i'))
    }
  }

  const result = await Product.updateMany(
    mongoFilter,
    { marginPercentage: margin, frontSection: section }
  )

  return NextResponse.json({
    matched: result.matchedCount,
    modified: result.modifiedCount
  })
}
