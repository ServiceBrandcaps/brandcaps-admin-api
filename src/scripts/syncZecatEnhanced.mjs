// scripts/syncZecatEnhanced.mjs (Enhanced Version v2.0)
// Sincroniza TODOS los campos de TODOS los generic_product usando el modelo Product
// Mejoras v2.0:
// - Retry logic con exponential backoff
// - Rate limiting básico
// - Failed sync tracking
// - Sync metadata tracking
// - Incremental sync con change detection
// - Mejor logging y estadísticas
// Estrategia: 1) Lista IDs paginados 2) Trae detalle por ID 3) Upsert en Mongo

import fetch from "node-fetch";
import { connectDB } from "../lib/mongoose.js";
import { Product } from "../models/Product.sync.model.js";
import SyncMetadata from "../models/SyncMetadata.js";
import FailedSync from "../models/FailedSync.js";

const BASE =
  process.env.ZECAT_BASE?.replace(/\/$/, "") || "https://api.zecat.com/v1";
const TOKEN = process.env.ZECAT_TOKEN;
const PAGE_LIMIT = Number(process.env.ZECAT_PAGE_LIMIT || 500);
const CONCURRENCY = Number(process.env.ZECAT_CONCURRENCY || 3); // Reduced from 6 for better rate limiting
const MAX_RETRIES = Number(process.env.ZECAT_MAX_RETRIES || 3);
const INCREMENTAL_SYNC = process.env.ZECAT_INCREMENTAL_SYNC === 'true';
const RATE_LIMIT_DELAY = Number(process.env.ZECAT_RATE_LIMIT_DELAY || 100); // ms between requests

// Statistics
const stats = {
  total: 0,
  updated: 0,
  created: 0,
  skipped: 0,
  failed: 0,
  startTime: null,
  endTime: null,
};

if (!TOKEN) {
  console.error("❌ Falta ZECAT_TOKEN en el .env");
  process.exit(1);
}

// Utility: sleep for rate limiting
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch JSON with retry logic and rate limiting
 */
async function fetchJSON(url, retries = MAX_RETRIES) {
  let lastError;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Rate limiting: add delay between requests
      if (attempt > 0 || RATE_LIMIT_DELAY > 0) {
        await sleep(RATE_LIMIT_DELAY * (attempt + 1));
      }

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: "application/json",
        },
      });

      // Handle rate limiting (429)
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After') || 60;
        console.warn(`⚠️  Rate limited. Waiting ${retryAfter}s... (attempt ${attempt + 1}/${retries})`);
        await sleep(retryAfter * 1000);
        continue; // Retry
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `HTTP ${res.status} ${res.statusText} → ${url} :: ${text.slice(0, 300)}`
        );
      }

      return await res.json();
    } catch (err) {
      lastError = err;
      
      if (attempt < retries - 1) {
        const backoffTime = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.warn(
          `⚠️  Request failed (attempt ${attempt + 1}/${retries}): ${err.message}. Retrying in ${backoffTime}ms...`
        );
        await sleep(backoffTime);
      }
    }
  }

  // All retries exhausted
  throw lastError;
}

/**
 * List all generic product IDs from Zecat API with pagination
 */
async function listAllGenericIds(limit = PAGE_LIMIT) {
  let page = 1;
  let totalPages = 1;
  const ids = [];
  
  do {
    try {
      const data = await fetchJSON(
        `${BASE}/generic_product?limit=${limit}&page=${page}`
      );
      totalPages = data.total_pages || 1;
      const arr = data.generic_products || [];
      ids.push(...arr.map((g) => g.id));
      console.log(`📄 Página ${page}/${totalPages} (+${arr.length} IDs)`);
      page++;
    } catch (err) {
      console.error(`❌ Error fetching page ${page}:`, err.message);
      throw err;
    }
  } while (page <= totalPages);
  
  return ids;
}

/**
 * Fetch detailed product information
 */
async function fetchDetailDoc(id) {
  const payload = await fetchJSON(`${BASE}/generic_product/${id}`);
  const doc = Product.fromZecatResponse(payload);
  return doc;
}

/**
 * Fetch detailed product information with retry tracking
 */
async function fetchDetailDocWithRetry(id, maxRetries = MAX_RETRIES) {
  try {
    return await fetchDetailDoc(id);
  } catch (err) {
    // Log failed fetch for tracking
    await FailedSync.findOneAndUpdate(
      { type: 'zecat', entityType: 'product', entityId: String(id) },
      {
        $set: {
          error: {
            message: err.message,
            statusCode: err.statusCode || null,
            stack: err.stack,
          },
          lastAttempt: new Date(),
        },
        $inc: { attemptCount: 1 },
      },
      { upsert: true, new: true }
    );
    throw err;
  }
}

/**
 * Check if product has changed (for incremental sync)
 */
async function hasProductChanged(id, newData) {
  const existing = await Product.findOne({ id }).lean();
  if (!existing) return true; // New product
  
  // Compare critical fields that frequently change
  const criticalFields = ['price', 'products', 'name', 'description', 'minimum_order_quantity'];
  
  for (const field of criticalFields) {
    if (JSON.stringify(existing[field]) !== JSON.stringify(newData[field])) {
      return true;
    }
  }
  
  return false;
}

/**
 * Upsert product with change detection
 */
async function upsertOne(doc, checkChanges = INCREMENTAL_SYNC) {
  const filter = { $or: [{ id: doc.id }, { generic_id: doc.id }] };
  
  // Check if product exists before update (to track created vs updated)
  const exists = await Product.exists(filter);
  
  // Incremental sync: skip if no changes
  if (checkChanges && exists) {
    const changed = await hasProductChanged(doc.id, doc);
    if (!changed) {
      stats.skipped++;
      return 'skipped';
    }
  }
  
  const setDoc = { ...doc, generic_id: doc.id };
  
  await Product.updateOne(
    filter,
    { $set: setDoc },
    { upsert: true, strict: false }
  );
  
  if (exists) {
    stats.updated++;
    return 'updated';
  } else {
    stats.created++;
    return 'created';
  }
}

/**
 * Update sync metadata
 */
async function updateSyncMetadata(status, error = null) {
  const duration = stats.endTime ? stats.endTime - stats.startTime : 0;
  
  const update = {
    lastAttemptedSync: new Date(),
    status,
    stats: {
      total: stats.total,
      updated: stats.updated,
      created: stats.created,
      skipped: stats.skipped,
      failed: stats.failed,
      duration,
    },
  };
  
  if (status === 'completed') {
    update.lastSuccessfulSync = new Date();
  }
  
  if (error) {
    update.error = {
      message: error.message,
      timestamp: new Date(),
      details: error.stack,
    };
  }
  
  await SyncMetadata.updateOne(
    { type: 'zecat_sync' },
    { $set: update },
    { upsert: true }
  );
}

/**
 * Main sync function
 */
async function main() {
  stats.startTime = Date.now();
  
  console.log("=".repeat(60));
  console.log("🔄 ZECAT SYNC SCRIPT - Enhanced v2.0");
  console.log("=".repeat(60));
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`🔧 Config:`);
  console.log(`   - Base URL: ${BASE}`);
  console.log(`   - Concurrency: ${CONCURRENCY}`);
  console.log(`   - Max Retries: ${MAX_RETRIES}`);
  console.log(`   - Incremental Sync: ${INCREMENTAL_SYNC ? 'ENABLED' : 'DISABLED'}`);
  console.log(`   - Rate Limit Delay: ${RATE_LIMIT_DELAY}ms`);
  console.log("=".repeat(60));
  
  try {
    console.log("\n🔗 Conectando a MongoDB...");
    await connectDB();
    console.log("✅ MongoDB conectado");
    
    // Update sync status to running
    await updateSyncMetadata('running');
    
    console.log("\n🧾 Listando IDs de productos desde Zecat API...");
    const ids = await listAllGenericIds();
    stats.total = ids.length;
    console.log(`✅ ${ids.length} productos encontrados`);
    
    console.log(`\n🔎 Descargando detalles y sincronizando productos...`);
    console.log(`   (usando ${CONCURRENCY} workers concurrentes)`);
    
    // Pool de workers con concurrencia controlada
    let i = 0;
    const progressInterval = Math.max(Math.floor(ids.length / 20), 10); // Show progress every 5%
    
    const workers = Array.from({ length: CONCURRENCY }).map((_, workerNum) =>
      (async () => {
        while (true) {
          const idx = i++;
          if (idx >= ids.length) break;
          
          const id = ids[idx];
          
          try {
            const doc = await fetchDetailDocWithRetry(id);
            const result = await upsertOne(doc);
            
            // Show progress
            if ((idx + 1) % progressInterval === 0 || idx === ids.length - 1) {
              const progress = ((idx + 1) / ids.length * 100).toFixed(1);
              console.log(
                `📊 Progreso: ${idx + 1}/${ids.length} (${progress}%) | ` +
                `✅ ${stats.created} creados | 🔄 ${stats.updated} actualizados | ` +
                `⏭️  ${stats.skipped} sin cambios | ❌ ${stats.failed} fallidos`
              );
            }
          } catch (err) {
            stats.failed++;
            console.error(`❌ Error con producto ID ${id}:`, err.message);
          }
        }
      })()
    );
    
    await Promise.all(workers);
    
    stats.endTime = Date.now();
    const durationSec = ((stats.endTime - stats.startTime) / 1000).toFixed(2);
    
    console.log("\n" + "=".repeat(60));
    console.log("🎉 SINCRONIZACIÓN COMPLETADA");
    console.log("=".repeat(60));
    console.log(`📊 Estadísticas:`);
    console.log(`   - Total procesados: ${stats.total}`);
    console.log(`   - ✅ Creados: ${stats.created}`);
    console.log(`   - 🔄 Actualizados: ${stats.updated}`);
    console.log(`   - ⏭️  Sin cambios: ${stats.skipped}`);
    console.log(`   - ❌ Fallidos: ${stats.failed}`);
    console.log(`   - ⏱️  Duración: ${durationSec}s`);
    console.log(`   - 📅 Finalizado: ${new Date().toISOString()}`);
    
    // Check for failed syncs
    if (stats.failed > 0) {
      const failedSyncs = await FailedSync.find({
        type: 'zecat',
        resolved: false
      }).limit(10);
      
      console.log(`\n⚠️  ${stats.failed} productos fallaron. Primeros 10 errores:`);
      failedSyncs.forEach((f, i) => {
        console.log(`   ${i + 1}. ID: ${f.entityId} - ${f.error.message}`);
      });
      console.log(`   💡 Revisa la colección 'failed_syncs' para ver todos los errores`);
      
      // Update metadata with partial status
      await updateSyncMetadata('partial');
    } else {
      await updateSyncMetadata('completed');
    }
    
    console.log("=".repeat(60) + "\n");
    
    process.exit(0);
  } catch (err) {
    stats.endTime = Date.now();
    console.error("\n" + "=".repeat(60));
    console.error("❌ ERROR FATAL EN SINCRONIZACIÓN");
    console.error("=".repeat(60));
    console.error(err);
    console.error("=".repeat(60) + "\n");
    
    await updateSyncMetadata('failed', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Unhandled error:", err);
  process.exit(1);
});
