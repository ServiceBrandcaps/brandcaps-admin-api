// models/Product.js
// Modelo Mongoose (ESM) para mapear el generic_product de ZECAT + helper fromZecatResponse

import mongoose from 'mongoose';
const { Schema } = mongoose;

// ---- Sub-esquemas reutilizables ----
const DiscountSchema = new Schema(
  {
    id: String,
    name: String,
    allPartners: Boolean,
    allFamilies: Boolean,
    discount: Number,
    enabled: Boolean,
    deleted: Boolean,
    description: String,
    isCumulative: Boolean,
    isRangeDiscount: Boolean,
    hasExpirationDate: Boolean,
    discountStartDate: Date,
    discountEndDate: Date,
    discountsLevels: { type: [Schema.Types.Mixed], default: [] },
  },
  { _id: false }
);

const DiscountRangeSchema = new Schema(
  {
    id: String,
    discountId: String,
    discountPercentage: Number,
    minQuantity: Number,
    maxQuantity: { type: Number, default: null },
    withOutLimit: Boolean,
    deleted: Boolean,
    createdAt: Date,
    updatedAt: Date,
    discount: { type: DiscountSchema, default: undefined },
  },
  { _id: false }
);

const DiscountRangeProductSchema = new Schema(
  {
    id: String,
    discountRangeId: String,
    productId: String,
    active: Boolean,
    createdAt: Date,
    updatedAt: Date,
    product_id: String, // duplicado en origen; lo mantenemos para compatibilidad
    discountRange: { type: DiscountRangeSchema, default: undefined },
  },
  { _id: false }
);

const ImageSchema = new Schema(
  {
    id: String,
    imageUrl: String,
    smallImageUrl: String,
    mediumImageUrl: String,
    difaproWordpressSku: String,
    colorId: { type: Schema.Types.Mixed },
    main: Boolean,
    mainIntegrator: Boolean,
    genericProductId: String,
    generic_product_id: String, // a veces llega en snake
    productId: String,
    createdAt: Date,
    updatedAt: Date,
    printingAreaId: Schema.Types.Mixed,
    complementaryWepod: Boolean,
    coverWepod: Boolean,
    order: Schema.Types.Mixed,
    variant: Schema.Types.Mixed,
  },
  { _id: false }
);

const PrintingTypeColorSchema = new Schema(
  {
    id: Schema.Types.Mixed,
    printing_type_id: Schema.Types.Mixed,
    product_id: Schema.Types.Mixed,
    printing_type_color: String,
    createdAt: Date,
    updatedAt: Date,
  },
  { _id: false }
);

const AttributeDescriptorSchema = new Schema(
  { description: String },
  { _id: false }
);

const VariantSchema = new Schema(
  {
    id: Schema.Types.Mixed,
    element1: String,
    element2: String,
    element3: String,
    attribute1: String,
    attribute2: String,
    attribute3: String,
    sku: String,
    externalProductId: String,
    genericProductId: String,
    GenericProductId: String, // algunas respuestas lo traen capitalizado
    generalDescription: String,
    elementDescription1: String,
    elementDescription2: String,
    elementDescription3: String,
    additionalDescription: String,
    stock: Number,
    reservedStock: { type: Number, set: v => (v === '' || v == null ? 0 : Number(v)) },
    active: Boolean,
    achromatic: Boolean,
    wepod: Boolean,
    createdAt: Date,
    updatedAt: Date,
    size: String,
    color: String,
    primaryColor: String,
    secondaryColor: String,

    attribute_one: { type: AttributeDescriptorSchema, default: undefined },
    attribute_two: { type: AttributeDescriptorSchema, default: undefined },
    attribute_three: { type: AttributeDescriptorSchema, default: undefined },

    discountRangeProduct: { type: [DiscountRangeProductSchema], default: [] },
    favorites: { type: [Schema.Types.Mixed], default: [] },
    images: { type: [ImageSchema], default: [] },
    images_wepod: { type: [ImageSchema], default: [] },

    printing_type_colors_wepod: { type: [PrintingTypeColorSchema], default: [] },
    printing_type_colors: { type: [PrintingTypeColorSchema], default: [] },

    product_stock_arrival: { type: [Schema.Types.Mixed], default: [] },
    genericPrintingTypeTemplate: { type: [Schema.Types.Mixed], default: [] },
  },
  { _id: false }
);

const VariantsSchema = new Schema(
  {
    // La API entrega { colors: { "": [Variant] }, sizes: { "": [Variant] } }
    // Normalizamos a arrays simples
    colors: { type: [VariantSchema], default: [] },
    sizes: { type: [VariantSchema], default: [] },
  },
  { _id: false }
);

// ---- Esquema principal ----
const ProductSchema = new Schema(
  {
    // Identificación
    id: String, // id de ZECAT (string numérico)
    external_id: String,

    // Descripciones
    name: String,
    description: String,
    description_wepod: String,
    type: String,

    // Cantidades mínimas
    minimum_order_quantity: Number,
    minimum_application_quantity: Number,
    minimum_application_quantity_kits: Number,

    // Precios / impuestos
    price: Number,
    unit_price: Number,
    total_price: Number,
    total_taxes: Number,
    total_with_taxes: Number,
    price_wepod: Number,
    currency: String,
    tax: Number,

    // Flags / publicación
    allow_simple_buy: Boolean,
    published: Boolean,
    published_at: Date,
    featured: Boolean,
    on_demand: Boolean,
    wepod: Boolean,
    metric_system: Boolean,
    buyBySize: Boolean,

    // Dimensiones / logística
    unit_weight: Schema.Types.Mixed,
    height: Schema.Types.Mixed,
    length: Schema.Types.Mixed,
    width: Schema.Types.Mixed,
    units_per_box: Schema.Types.Mixed,

    // Marketing / metadata
    datasheet_url: String,
    qrUrl: String,
    downloadbleMaterialUrl: String,
    downloadableMaterialUrl: String, // mantener ambas por si viene typo
    supplementary_information_text: String,
    tag: String,

    // Variantes
    variants: { type: VariantsSchema, default: {} },

    // Guardamos payload crudo para auditoría / diffs
    zecatRaw: { type: Schema.Types.Mixed },
  },
  {
    collection: 'products',
    timestamps: true,
    minimize: false,
    versionKey: false,
    strict: true,
  }
);

// ---- Índices útiles ----
ProductSchema.index({ name: 'text', description: 'text', tag: 'text' });
// ✅ Índice único para evitar duplicados del admin
ProductSchema.index({ external_id: 1 }, { unique: true, name: "external_id_1" });

// ✅ Índice único “sparse” para los docs que vienen de Zecat
// (sparse permite que otros docs sin 'id' no violen el índice)
ProductSchema.index({ id: 1 }, { unique: true, sparse: true, name: "id_1" });

ProductSchema.index({ 'variants.colors.sku': 1 });
ProductSchema.index({ 'variants.sizes.sku': 1 });
ProductSchema.index({ 'variants.colors.stock': -1 });

// ---- Helpers ----
function normalizeVariants(v) {
  if (!v || typeof v !== 'object') return { colors: [], sizes: [] };
  const unwrap = (maybeGroup) => {
    if (Array.isArray(maybeGroup)) return maybeGroup;
    if (maybeGroup && typeof maybeGroup === 'object') {
      if (Array.isArray(maybeGroup[''])) return maybeGroup['']; // { "": [...] }
      const firstKey = Object.keys(maybeGroup)[0];
      if (firstKey && Array.isArray(maybeGroup[firstKey])) return maybeGroup[firstKey];
    }
    return [];
  };
  return {
    colors: unwrap(v.colors),
    sizes: unwrap(v.sizes),
  };
}

// Static: construir documento a partir del JSON de la API
ProductSchema.statics.fromZecatResponse = function fromZecatResponse(payload) {
  if (!payload || !payload.generic_product) {
    throw new Error('Payload sin product');
  }
  const gp = payload.generic_product;

  return {
    id: gp.id,
    external_id: gp.external_id,
    name: gp.name,
    description: gp.description,
    description_wepod: gp.description_wepod,
    type: gp.type,
    minimum_order_quantity: gp.minimum_order_quantity,
    minimum_application_quantity: gp.minimum_application_quantity,
    minimum_application_quantity_kits: gp.minimum_application_quantity_kits,
    price: gp.price,
    unit_price: gp.unit_price,
    total_price: gp.total_price,
    total_taxes: gp.total_taxes,
    total_with_taxes: gp.total_with_taxes,
    price_wepod: gp.price_wepod,
    currency: gp.currency,
    allow_simple_buy: gp.allow_simple_buy,
    unit_weight: gp.unit_weight,
    height: gp.height,
    published: gp.published,
    published_at: gp.published_at ? new Date(gp.published_at) : undefined,
    featured: gp.featured,
    on_demand: gp.on_demand,
    length: gp.length,
    width: gp.width,
    units_per_box: gp.units_per_box,
    tag: gp.tag,
    tax: gp.tax,
    qrUrl: gp.qrUrl,
    downloadableMaterialUrl: gp.downloadableMaterialUrl,
    supplementary_information_text: gp.supplementary_information_text,
    buyBySize: gp.buyBySize,
    wepod: gp.wepod,
    metric_system: gp.metric_system,
    variants: normalizeVariants(gp.variants),
    zecatRaw: gp, // trazabilidad
  };
};

// Método de instancia: todas las variantes en un array
ProductSchema.methods.allVariants = function allVariants() {
  const v = this.variants || {};
  return [
    ...(Array.isArray(v.colors) ? v.colors : []),
    ...(Array.isArray(v.sizes) ? v.sizes : []),
  ];
};

// Virtual: stock total
ProductSchema.virtual('totalStock').get(function totalStock() {
  return this.allVariants().reduce((sum, x) => sum + (Number(x.stock) || 0), 0);
});

// Normalización al validar/guardar
ProductSchema.pre('validate', function () {
  if (this.variants && (this.variants.colors || this.variants.sizes)) {
    this.variants = normalizeVariants(this.variants);
  }
});

// ---- Exportaciones (ESM) ----
export const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
export default Product;
