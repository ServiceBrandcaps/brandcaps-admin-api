import mongoose from "mongoose";

function flattenGroup(group, keyName) {
  if (!group) return [];
  // Si ya es array, devuélvelo rellenando el campo por si falta
  if (Array.isArray(group)) {
    return group.map((v) => ({ ...v, [keyName]: v?.[keyName] ?? null }));
  }
  // Si es objeto: juntar todas las claves (Rojo, Negro, "", XL, etc.)
  if (typeof group === "object") {
    return Object.entries(group).flatMap(([bucketKey, arr]) => {
      if (!Array.isArray(arr)) return [];
      return arr.map((v) => ({
        ...v,
        [keyName]: v?.[keyName] ?? (bucketKey === "" ? null : bucketKey),
      }));
    });
  }
  return [];
}

function normalizeVariants(v) {
  const colors = flattenGroup(v?.colors, "color");
  const sizes = flattenGroup(v?.sizes, "size");
  return { colors, sizes };
}

const DiscountRangeSchema = new mongoose.Schema(
  { genericId: String, maxPrice: Number, minPrice: Number },
  { _id: false }
);

const ProductVariantSchema = new mongoose.Schema(
  {
    idDataverse: {
      // "" (puede venir vacío)
      type: String,
      default: "",
      trim: true,
    },
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
    visibleFromDataverse: { type: Boolean, default: false },
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
    idDataverse: {
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
    idDataverse: { type: String, unique: true, sparse: true },
    generic_id: String,
    external_id: { type: String, required: true, trim: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    discountPrice: Number,
    families: [
      {
        id: String,
        description: String,
        icon_url: String,
        icon_active_url: String,
        title: String,
        show: Boolean,
      },
    ],
    subattributes: [{ id: Number, name: String, attribute_name: String }],
    // images: [{ image_url: String }],
    // products: [
    //   {
    //     id: Number,
    //     sku: String,
    //     stock: Number,
    //   },
    // ],
    // Variantes
    //variants: { type: VariantsSchema, default: {} },
    variants: {
      type: VariantsSchema,
      default: {},
      set: (v) => normalizeVariants(v || {}),
    },
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
    // external_id: { type: String, default: null },
    // NUEVO: escalas de precio
    priceTiers: { type: [PriceTierSchema], default: [] },
    visibleFromDataverse: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Helpers locales
const _norm = (s = "") =>
  s
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const _slug = (s = "") =>
  _norm(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function _buildVarSkuModel(product, v, idx) {
  const base =
    product.sku || product.external_id || String(product._id || "prd");
  const parts = [
    _slug(v.color || ""),
    _slug(v.material || ""),
    _slug(v.size || ""),
  ].filter(Boolean);
  let draft = `${base}${parts.length ? "-" + parts.join("-") : ""}`;
  if (!parts.length) draft = `${base}-var-${idx + 1}`;
  return draft.toUpperCase();
}

function _ensureSkusModel(doc) {
  const seen = new Set();
  (doc.products || []).forEach((v, i) => {
    if (!v.sku || !v.sku.trim()) v.sku = _buildVarSkuModel(doc, v, i);
    let c = v.sku;
    let k = 1;
    while (seen.has(c)) c = `${v.sku}-${++k}`;
    v.sku = c;
    seen.add(c);
  });
}

ProductSchema.pre("validate", function () {
  _ensureSkusModel(this);
});

// ✅ Índice único para evitar duplicados del admin
ProductSchema.index(
  { external_id: 1 },
  { unique: true, name: "external_id_1" }
);

// ✅ Índice único “sparse” para los docs que vienen de Zecat
// (sparse permite que otros docs sin 'id' no violen el índice)
ProductSchema.index({ id: 1 }, { unique: true, sparse: true, name: "id_1" });

// ✅ Opcional: si tu SKU de variante debe ser único globalmente
ProductSchema.index(
  { "products.sku": 1 },
  { unique: true, sparse: true, name: "products.sku_1" }
);

// Performance indexes for common queries
ProductSchema.index({ name: 1 }, { name: "name_1" }); // For name searches
ProductSchema.index({ "families.description": 1 }, { name: "families_description_1" }); // For family filters
ProductSchema.index({ "families.id": 1 }, { name: "families_id_1" }); // For family filters
ProductSchema.index({ frontSection: 1 }, { name: "frontSection_1" }); // For section filtering
ProductSchema.index({ "subattributes.name": 1 }, { name: "subattributes_name_1" }); // For subattribute filters
ProductSchema.index({ price: 1 }, { name: "price_1" }); // For price sorting
ProductSchema.index({ createdAt: -1 }, { name: "createdAt_desc" }); // For "new arrivals"
ProductSchema.index({ updatedAt: -1 }, { name: "updatedAt_desc" }); // For sync optimization
ProductSchema.index({ brandcapsProduct: 1 }, { name: "brandcapsProduct_1" }); // For filtering by source

// Text index for search functionality (weighted for relevance)
ProductSchema.index(
  { 
    name: "text", 
    description: "text",
    "families.description": "text",
    "subattributes.name": "text"
  },
  {
    name: "product_search_text",
    weights: {
      name: 10,
      "families.description": 5,
      "subattributes.name": 3,
      description: 1
    }
  }
);

// Compound indexes for common filter combinations
ProductSchema.index(
  { frontSection: 1, "families.description": 1, price: 1 },
  { name: "section_family_price" }
); // Filter by section + family + sort by price

ProductSchema.index(
  { brandcapsProduct: 1, frontSection: 1, createdAt: -1 },
  { name: "source_section_recent" }
); // For filtering by source + section with recent first

// ⚠️ Forzar recompilación del modelo en hot-reload:
if (mongoose.models.Product) {
  delete mongoose.models.Product; // (Mongoose < 7)
  // en Mongoose 7 también sirve: mongoose.deleteModel('Product');
}

export default mongoose.models.Product ||
  mongoose.model("Product", ProductSchema);