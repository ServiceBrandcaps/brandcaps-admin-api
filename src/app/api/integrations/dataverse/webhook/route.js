import crypto from "node:crypto";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongo";
import Product from "@/models/Product";
import DvEvent from "@/models/DvEvent";

// helpers de tu modelo
const norm = s => (s ?? "").toString().trim();
const nowSec = () => Math.floor(Date.now()/1000);

// HMAC check
function verifySignature(rawBody, timestamp, signature) {
  const secret = process.env.DATAVERSE_WEBHOOK_SECRET || "";
  if (!secret) return false;
  const h = crypto.createHmac("sha256", secret);
  h.update(timestamp + "." + rawBody);
  const expected = "sha256=" + h.digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ""));
}

export async function POST(req) {
  await connectDB();

  // 1) raw body + headers
  const raw = await req.text();
  const ts = req.headers.get("x-timestamp");
  const sig = req.headers.get("x-signature");

  // 2) seguridad: timestamp window 5 min y HMAC
  if (!ts || Math.abs(nowSec() - Number(ts)) > 300) {
    return NextResponse.json({ error: "stale timestamp" }, { status: 401 });
  }
  if (!verifySignature(raw, ts, sig)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // 3) parse
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // payload esperado
  // {
  //   "event": "publish" | "unpublish" | "sync",
  //   "product": {
  //     "idDataverse": "GUID-DV-PRODUCT",
  //     "name": "Mate Stanley",
  //     "description": "…",
  //     "visible": true,
  //     "price": 1234.56 // opcional
  //   },
  //   "variants": [
  //     { "idDataverse": "GUID-DV-VAR-1", "sku": "MS-NEG-500", "color": "Negro", "size": "500 ml", "stock": 7, "visible": true, "achromatic": false },
  //     …
  //   ]
  // }

  const eventType = norm(body?.event) || "sync";
  const p = body?.product || {};
  const vArr = Array.isArray(body?.variants) ? body.variants : [];

  const pIdDv  = norm(p?.idDataverse);
  const pName  = norm(p?.name);
  const pDesc  = norm(p?.description);
  const pVis   = !!p?.visible;
  const pPrice = Number.isFinite(+p?.price) ? +p.price : undefined;

  if (!pIdDv) {
    return NextResponse.json({ error: "product.idDataverse required" }, { status: 400 });
  }

  try {
    // 4) buscar o crear producto por idDataverse
    let doc = await Product.findOne({ idDataverse: pIdDv });
    if (!doc && !pVis) {
      // Si viene invisible y no existe, sólo registrar evento
      await DvEvent.create({
        eventType, idDataverse: pIdDv, payload: { product: p, variants: vArr }, status: "ok",
        message: "Invisible; producto no creado."
      });
      return NextResponse.json({ ok: true, created: false, idMongo: null });
    }
    if (!doc) {
      doc = new Product({ idDataverse: pIdDv, name: pName, description: pDesc });
    }

    // Campos base del producto
    if (pName) doc.name = pName;
    if (typeof pDesc === "string") doc.description = pDesc;
    if (typeof pVis === "boolean") doc.visibleFromDataverse = pVis;
    if (pPrice !== undefined) doc.price = pPrice;

    // 5) merge de variantes
    const byVarId = new Map((doc.products || []).map(v => [norm(v.idDataverse), v]));
    const bySku   = new Map((doc.products || []).map(v => [norm(v.sku), v]));

    for (const nv of vArr) {
      const idDv = norm(nv?.idDataverse);
      const sku  = norm(nv?.sku);
      const vis  = !!nv?.visible;

      // Si la variante viene invisible y no existe, la salteamos
      if (!idDv && !sku) continue;

      let target =
        (idDv && byVarId.get(idDv)) ||
        (sku  && bySku.get(sku)) ||
        null;

      if (!target) {
        // crear
        target = {
          idDataverse: idDv || undefined,
          sku: sku || "", // será autogenerado si queda vacío
          color: nv?.color || "",
          size: nv?.size || "",
          material: nv?.material || "",
          stock: Number(nv?.stock ?? 0),
          achromatic: !!nv?.achromatic,
          visibleFromDataverse: vis,
        };
        doc.products.push(target);
        // actualizar mapas para próximos matches
        if (target.idDataverse) byVarId.set(norm(target.idDataverse), target);
        if (target.sku) bySku.set(norm(target.sku), target);
      } else {
        // actualizar
        if (idDv) target.idDataverse = idDv; // asegurar vínculo
        if (sku)  target.sku = sku || target.sku;
        if (nv?.color !== undefined) target.color = nv.color || "";
        if (nv?.size !== undefined)  target.size = nv.size || "";
        if (nv?.material !== undefined) target.material = nv.material || "";
        if (nv?.stock !== undefined) target.stock = Number(nv.stock || 0);
        if (nv?.achromatic !== undefined) target.achromatic = !!nv.achromatic;
        target.visibleFromDataverse = vis;
      }
    }

    // 6) generar SKUs faltantes y deduplicar como ya hacés
    if (typeof doc.ensureVariantSkus === "function") {
      doc.ensureVariantSkus(); // si lo expusiste en el schema
    }

    await doc.save();

    await DvEvent.create({
      eventType,
      productId: doc._id,
      idDataverse: pIdDv,
      dvVariantIds: vArr.map(x => norm(x?.idDataverse)).filter(Boolean),
      payload: { product: { idDataverse: pIdDv, visible: pVis }, variants: vArr.map(x => ({ idDataverse: x.idDataverse, visible: x.visible, sku: x.sku, stock: x.stock })) },
      status: "ok",
      message: "Sync OK",
    });

    // 7) devolvemos idMongo para que Dv guarde el vínculo
    return NextResponse.json({
      ok: true,
      idMongo: String(doc._id),
      product: { idDataverse: doc.idDataverse, visible: doc.visibleFromDataverse },
      variants: (doc.products || []).map(v => ({
        idDataverse: v.idDataverse,
        sku: v.sku,
        stock: v.stock,
        visible: v.visibleFromDataverse
      }))
    });
  } catch (err) {
    console.error("DV webhook error:", err);
    try {
      await DvEvent.create({
        eventType,
        idDataverse: pIdDv,
        payload: { product: p, variants: vArr },
        status: "error",
        message: String(err?.message || err),
      });
    } catch {}
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
