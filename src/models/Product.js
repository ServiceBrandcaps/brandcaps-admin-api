import mongoose from "mongoose";

const DiscountRangeSchema = new mongoose.Schema(
  { genericId: String, maxPrice: Number, minPrice: Number },
  { _id: false }
);

const ProductVariantSchema = new mongoose.Schema(
  {
    providerId: {
      // antes "id" en Zecat
      type: Number,
      required: false,
      index: true,
    },
    sku: {
      // "00140160911001000500"
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    stock: {
      // 81
      type: Number,
      default: 0,
      min: 0,
    },
    size: {
      // "" (puede venir vacío)
      type: String,
      default: "",
      trim: true,
    },
    color: {
      // "" (puede venir vacío)
      type: String,
      default: "",
      trim: true,
    },
    material: {
      type: String,
      default: "",
      trim: true,
    },
    achromatic: {
      // false
      type: Boolean,
      default: false,
    },
  },
  { _id: false } // no generes _id para cada variante
);

const VariantSchema = new mongoose.Schema(
  {
    providerId: {
      // antes "id" en Zecat
      type: Number,
      required: false,
      index: true,
    },
    element1: {
      // "" (puede venir vacío)
      type: String,
      default: "",
      trim: true,
    },
    element2: {
      // "" (puede venir vacío)
      type: String,
      default: "",
      trim: true,
    },
    element3: {
      // "" (puede venir vacío)
      type: String,
      default: "",
      trim: true,
    },
    attribute1: {
      // "" (puede venir vacío)
      type: String,
      default: "",
      trim: true,
    },
    attribute2: {
      // "" (puede venir vacío)
      type: String,
      default: "",
      trim: true,
    },
    attribute3: {
      // "" (puede venir vacío)
      type: String,
      default: "",
      trim: true,
    },
    sku: {
      // "" (puede venir vacío)
      type: String,
      default: "",
      trim: true,
    },
    externalProductId: {
      // "" (puede venir vacío)
      type: String,
      default: "",
      trim: true,
    },
    genericProductId: {
      // "" (puede venir vacío)
      type: String,
      default: "",
      trim: true,
    },
    GenericProductId: {
      // "" (puede venir vacío)
      type: String,
      default: "",
      trim: true,
    }, // algunas respuestas lo traen capitalizado
    generalDescription: {
      // "" (puede venir vacío)
      type: String,
      default: "",
      trim: true,
    },
    elementDescription1: {
      // "" (puede venir vacío)
      type: String,
      default: "",
      trim: true,
    },
    elementDescription2: {
      // "" (puede venir vacío)
      type: String,
      default: "",
      trim: true,
    },
    elementDescription3: {
      // "" (puede venir vacío)
      type: String,
      default: "",
      trim: true,
    },
    additionalDescription: {
      // "" (puede venir vacío)
      type: String,
      default: "",
      trim: true,
    },
    stock: {
      // "" (puede venir vacío)
      type: String,
      default: "",
      trim: true,
    },
    reservedStock: {
      type: Number,
      set: (v) => (v === "" || v == null ? 0 : Number(v)),
    },
    active: { type: Boolean, default: true },
    achromatic: { type: Boolean, default: false },
    wepod: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    size: {
      // "" (puede venir vacío)
      type: String,
      default: "",
      trim: true,
    },
    color: {
      // "" (puede venir vacío)
      type: String,
      default: "",
      trim: true,
    },
    // primaryColor: String,
    // secondaryColor: String,

    // attribute_one: { type: AttributeDescriptorSchema, default: undefined },
    // attribute_two: { type: AttributeDescriptorSchema, default: undefined },
    // attribute_three: { type: AttributeDescriptorSchema, default: undefined },

    // discountRangeProduct: { type: [DiscountRangeProductSchema], default: [] },
    // favorites: { type: [Schema.Types.Mixed], default: [] },
    // images: { type: [ImageSchema], default: [] },
    // images_wepod: { type: [ImageSchema], default: [] },

    // printing_type_colors_wepod: { type: [PrintingTypeColorSchema], default: [] },
    // printing_type_colors: { type: [PrintingTypeColorSchema], default: [] },

    // product_stock_arrival: { type: [Schema.Types.Mixed], default: [] },
    // genericPrintingTypeTemplate: { type: [Schema.Types.Mixed], default: [] },
  },
  { _id: false }
);

const VariantsSchema = new mongoose.Schema(
  {
    // La API entrega { colors: { "": [Variant] }, sizes: { "": [Variant] } }
    // Normalizamos a arrays simples
    colors: { type: [VariantSchema], default: [] },
    sizes: { type: [VariantSchema], default: [] },
  },
  { _id: false }
);

// Escalas de precio. Usamos un arreglo flexible: [ { min, max, price } ]
const PriceTierSchema = new mongoose.Schema(
  {
    min: { type: Number, required: true },
    max: { type: Number, default: null }, // null => sin tope
    price: { type: Number, required: true },
  },
  { _id: false }
);

const ImageSchema = new mongoose.Schema({
  image_url: { type: String, required: true },
  main: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
});

const ProductSchema = new mongoose.Schema(
  {
    generic_id: String,
    external_id: { type: String, required: true, trim: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    discountPrice: Number,
    families: [{ id: String, description: String }],
    subattributes: [{ id: Number, name: String, attribute_name: String }],
    images: [{ image_url: String }],
    products: [{ id: Number, sku: String, stock: Number }],
    // Variantes
    variants: { type: VariantsSchema, default: {} },
    // Campos para CRUD Front
    marginPercentage: { type: Number, default: 0 },
    frontSection: { type: String, default: "default" },
    brandcapsProduct: {
      type: Boolean,
      required: true,
      default: false,
    },
    // Nuevo campo para imágenes
    images: {
      type: [ImageSchema],
      default: [],
    },
    products: {
      type: [ProductVariantSchema],
      default: [],
    },
    discountRanges: {
      type: [DiscountRangeSchema],
      default: [],
    },
    printing_types: { type: [String], default: [] }, // p.ej. ['Tampografía', 'Serigrafía']

    dimensions: {
      height_cm: { type: Number, default: null }, // Alto
      width_cm: { type: Number, default: null }, // Ancho
      length_cm: { type: Number, default: null }, // Largo
      unit_weight_kg: { type: Number, default: null }, // Peso unidad
    },

    packaging: { type: String, default: "" }, // Empaque (texto)
    units_per_box: { type: Number, default: null }, // Unidades por caja
    supplementary_information_text: { type: String, default: "" }, // Información complementaria
    minimum_order_quantity: { type: Number, default: 20 },
    external_id: { type: String, default: null },
    // NUEVO: escalas de precio
    priceTiers: { type: [PriceTierSchema], default: [] },
  },
  { timestamps: true }
);

// Por si preferís índices fuera de la definición de campos:
ProductSchema.index({ external_id: 1 }, { unique: true });
ProductSchema.index({ "products.sku": 1 }, { unique: true, sparse: true });

export default mongoose.models.Product ||
  mongoose.model("Product", ProductSchema);
