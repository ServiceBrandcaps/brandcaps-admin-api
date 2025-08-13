import mongoose from 'mongoose'

const DiscountRangeSchema = new mongoose.Schema({ genericId: String, maxPrice: Number, minPrice: Number }, { _id: false });
// ... (otras subesquemas como FamilySchema, ImageSchema, etc.)

const ImageSchema = new mongoose.Schema({
  image_url: { type: String, required: true },
  main: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

const ProductSchema = new mongoose.Schema({
  generic_id: String,
  external_id: String,
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  discountPrice: Number,
  families: [{ id: String, description: String }],
  subattributes: [{ id: Number, name: String, attribute_name: String }],
  images: [{ image_url: String }],
  products: [{ id: Number, sku: String, stock: Number }],
  // Campos para CRUD Front
  marginPercentage: { type: Number, default: 0 },
  frontSection: { type: String, default: 'default' },
  brandcapsProduct: {
    type: Boolean,
    required: true,
    default: false
  },
    // Nuevo campo para imágenes
  images: {
    type: [ImageSchema],
    default: []
  },
}, { timestamps: true })

export default mongoose.models.Product || mongoose.model('Product', ProductSchema)