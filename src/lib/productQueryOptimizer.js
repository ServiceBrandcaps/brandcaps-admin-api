/**
 * Product Query Optimizer
 * Utilities for building optimized MongoDB queries for product endpoints
 */

/**
 * Build optimized filters from query parameters
 * @param {URLSearchParams} searchParams 
 * @returns {Object} MongoDB filter object
 */
export function buildProductFilters(searchParams) {
  const filters = {};
  
  // Text search - use MongoDB text index for better performance
  const searchText = searchParams.get('search') || searchParams.get('q');
  if (searchText) {
    // Use text search if available, fallback to regex for name
    filters.$text = { $search: searchText };
  } else {
    // Name filter with case-insensitive regex (only if no text search)
    const name = searchParams.get('name');
    if (name) {
      filters.name = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
  }
  
  // Family filters - support multiple families
  const families = searchParams.getAll('family');
  if (families.length > 0) {
    // Escape special regex characters and create regex patterns
    const familyRegexes = families.map(f => 
      new RegExp(`^${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    );
    filters['families.description'] = { $in: familyRegexes };
  }
  
  // Subattribute filters
  const subattrs = searchParams.getAll('subattribute');
  if (subattrs.length > 0) {
    const subattrRegexes = subattrs.map(s => 
      new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    );
    filters['subattributes.name'] = { $in: subattrRegexes };
  }
  
  // Section filters
  const sections = searchParams.getAll('section');
  if (sections.length > 0) {
    const sectionRegexes = sections.map(s => 
      new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    );
    filters.frontSection = { $in: sectionRegexes };
  }
  
  // Price range filter
  const minPrice = searchParams.get('minPrice');
  const maxPrice = searchParams.get('maxPrice');
  if (minPrice || maxPrice) {
    filters.price = {};
    if (minPrice) filters.price.$gte = Number(minPrice);
    if (maxPrice) filters.price.$lte = Number(maxPrice);
  }
  
  // Stock filter (minimum stock)
  const minStock = searchParams.get('minStock');
  if (minStock) {
    filters['products.stock'] = { $gte: Number(minStock) };
  }
  
  // Product source filter (brandcaps vs zecat)
  const isBrandcaps = searchParams.get('isBrandcaps');
  if (isBrandcaps !== null && isBrandcaps !== undefined) {
    filters.brandcapsProduct = isBrandcaps === 'true';
  }
  
  // Visibility filter
  const visibleFromDataverse = searchParams.get('visibleFromDataverse');
  if (visibleFromDataverse !== null && visibleFromDataverse !== undefined) {
    filters.visibleFromDataverse = visibleFromDataverse === 'true';
  }
  
  return filters;
}

/**
 * Build sort options from query parameters
 * @param {URLSearchParams} searchParams 
 * @returns {Object} MongoDB sort object
 */
export function buildSortOptions(searchParams) {
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;
  
  const validSortFields = [
    'name', 
    'price', 
    'createdAt', 
    'updatedAt',
    'marginPercentage',
    // Text search score
    ...(searchParams.get('search') || searchParams.get('q') ? ['score'] : [])
  ];
  
  // Default to createdAt if invalid field
  const field = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
  
  // For text search, add score sorting
  if (searchParams.get('search') || searchParams.get('q')) {
    return { score: { $meta: 'textScore' }, [field]: sortOrder };
  }
  
  return { [field]: sortOrder };
}

/**
 * Parse and validate pagination parameters
 * @param {URLSearchParams} searchParams 
 * @param {Object} options - { defaultLimit, maxLimit }
 * @returns {Object} { page, limit, skip }
 */
export function parsePaginationParams(searchParams, options = {}) {
  const { defaultLimit = 30, maxLimit = 100 } = options;
  
  let page = parseInt(searchParams.get('page') || '1', 10);
  let limit = parseInt(searchParams.get('limit') || String(defaultLimit), 10);
  
  // Validate and constrain values
  page = Math.max(1, page);
  limit = Math.min(Math.max(1, limit), maxLimit);
  
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
}

/**
 * Build field projection for optimized queries
 * @param {string} context - 'admin' | 'store' | 'list'
 * @returns {Object} MongoDB projection object
 */
export function buildFieldProjection(context = 'list') {
  const projections = {
    // Minimal fields for list views (fastest)
    list: {
      name: 1,
      price: 1,
      discountPrice: 1,
      'families.description': 1,
      'families.id': 1,
      'images.image_url': 1,
      'images.main': 1,
      frontSection: 1,
      brandcapsProduct: 1,
      createdAt: 1,
      'products.stock': 1,
      'products.sku': 1,
    },
    
    // Admin view with more fields but still optimized
    admin: {
      name: 1,
      price: 1,
      discountPrice: 1,
      marginPercentage: 1,
      description: 1,
      families: 1,
      subattributes: 1,
      images: 1,
      products: 1,
      frontSection: 1,
      brandcapsProduct: 1,
      minimum_order_quantity: 1,
      priceTiers: 1,
      createdAt: 1,
      updatedAt: 1,
      external_id: 1,
      visibleFromDataverse: 1,
    },
    
    // Store/public view
    store: {
      name: 1,
      price: 1,
      discountPrice: 1,
      marginPercentage: 1,
      description: 1,
      families: 1,
      subattributes: 1,
      images: 1,
      products: 1,
      variants: 1,
      frontSection: 1,
      minimum_order_quantity: 1,
      tax: 1,
      brandcapsProduct: 1,
    },
  };
  
  return projections[context] || projections.list;
}

/**
 * Log query performance for monitoring
 * @param {string} endpoint 
 * @param {number} startTime 
 * @param {Object} stats - { totalCount, returnedCount, filters }
 */
export function logQueryPerformance(endpoint, startTime, stats) {
  const duration = Date.now() - startTime;
  const { totalCount, returnedCount, filters } = stats;
  
  console.log(`[QUERY_PERF] ${endpoint}`, {
    duration: `${duration}ms`,
    totalCount,
    returnedCount,
    filterCount: Object.keys(filters).length,
    slow: duration > 1000 ? '⚠️ SLOW' : '✅',
  });
  
  // Log very slow queries with details
  if (duration > 2000) {
    console.warn(`[SLOW_QUERY] ${endpoint} took ${duration}ms`, {
      filters: JSON.stringify(filters),
      totalCount,
    });
  }
}

/**
 * Validate request parameters
 * @param {URLSearchParams} searchParams 
 * @returns {Object} { valid, errors }
 */
export function validateQueryParams(searchParams) {
  const errors = [];
  
  // Validate page number
  const page = searchParams.get('page');
  if (page && (isNaN(page) || parseInt(page) < 1)) {
    errors.push('Page must be a positive integer');
  }
  
  // Validate limit
  const limit = searchParams.get('limit');
  if (limit && (isNaN(limit) || parseInt(limit) < 1)) {
    errors.push('Limit must be a positive integer');
  }
  
  // Validate price range
  const minPrice = searchParams.get('minPrice');
  const maxPrice = searchParams.get('maxPrice');
  if (minPrice && isNaN(minPrice)) {
    errors.push('minPrice must be a number');
  }
  if (maxPrice && isNaN(maxPrice)) {
    errors.push('maxPrice must be a number');
  }
  if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
    errors.push('minPrice cannot be greater than maxPrice');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Build aggregation pipeline for complex queries (future use)
 * @param {Object} filters 
 * @param {Object} options 
 * @returns {Array} MongoDB aggregation pipeline
 */
export function buildAggregationPipeline(filters, options = {}) {
  const { sortOptions, skip, limit } = options;
  
  const pipeline = [];
  
  // Match stage
  if (Object.keys(filters).length > 0) {
    pipeline.push({ $match: filters });
  }
  
  // Sort stage
  if (sortOptions) {
    pipeline.push({ $sort: sortOptions });
  }
  
  // Pagination stages
  if (skip) {
    pipeline.push({ $skip: skip });
  }
  if (limit) {
    pipeline.push({ $limit: limit });
  }
  
  return pipeline;
}
