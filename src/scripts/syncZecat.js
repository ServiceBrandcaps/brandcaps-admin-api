// scripts/syncZecat.js
// Sincroniza TODOS los campos de TODOS los generic_product usando el modelo Product
// Estrategia: 1) Lista IDs paginados 2) Trae detalle por ID 3) Upsert en Mongo

import fetch from 'node-fetch';
import { connectDB } from '../lib/mongoose.js'; 
import { Product } from '../models/Product.sync.model.js';

//const { Product } = genericModel; // el modelo exportado vía CommonJS

const BASE = process.env.ZECAT_BASE?.replace(/\/$/, '') || 'https://api.zecat.com/v1';
const TOKEN = process.env.ZECAT_TOKEN;
const PAGE_LIMIT = Number(process.env.ZECAT_PAGE_LIMIT || 500);
const CONCURRENCY = Number(process.env.CONCURRENCY || 6);

if (!TOKEN) {
  console.error('❌ Falta ZECAT_TOKEN en el .env');
  process.exit(1);
}

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText} → ${url} :: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function listAllGenericIds(limit = PAGE_LIMIT) {
  let page = 1;
  let totalPages = 1;
  const ids = [];
  do {
    const data = await fetchJSON(`${BASE}/generic_product?limit=${limit}&page=${page}`);
    totalPages = data.total_pages || 1;
    const arr = data.generic_products || [];
    ids.push(...arr.map((g) => g.id));
    console.log(`📄 Página ${page}/${totalPages} (+${arr.length})`);
    page++;
  } while (page <= totalPages);
  return ids;
}

async function fetchDetailDoc(id) {
  const payload = await fetchJSON(`${BASE}/generic_product/${id}`);
  // fromZecatResponse espera { generic_product: { ... } }
  const doc = Product.fromZecatResponse(payload);
  return doc; // objeto plano listo para $set
}

// async function upsertOne(doc) {
//   // Índice único: { id: 1 }
//   await Product.updateOne({ id: doc.id }, { $set: doc }, { upsert: true });
// }

// en scripts/syncZecat.js
async function upsertOne(doc) {
  // match por id o por tu campo viejo generic_id
  const filter = { $or: [{ id: doc.id }, { generic_id: doc.id }] };

  // aseguramos tener ambos campos (id y generic_id) por compatibilidad
  const setDoc = { ...doc, generic_id: doc.id };

  await Product.updateOne(
    filter,
    { $set: setDoc },
    { upsert: true, strict: false } // <-- clave: permite “nuevas columnas”
  );
}


async function main() {
  console.log('🔗 Conectando a Mongo…');
  await connectDB();
  await Product.init(); // asegura índices

  console.log('🧾 Listando IDs de product…');
  const ids = await listAllGenericIds();
  console.log(`🔎 Descargando detalles de ${ids.length} productos…`);

  // Pool de workers simple para concurrencia controlada
  let i = 0;
  const workers = Array.from({ length: CONCURRENCY }).map((_, worker) =>
    (async () => {
      while (true) {
        const idx = i++;
        if (idx >= ids.length) break;
        const id = ids[idx];
        try {
          const doc = await fetchDetailDoc(id);
          await upsertOne(doc);
          if ((idx + 1) % 25 === 0) console.log(`✔ ${idx + 1}/${ids.length}`);
        } catch (err) {
          console.error(`✖ Error con ID ${id}:`, err.message);
        }
      }
    })()
  );

  await Promise.all(workers);
  console.log('🎉 Sincronización completada');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
