// PATCH /api/admin/products/:id/variants
// body: { items: [{ sku, idDataverse, color, size, material, stock }] }
export async function PATCH(req, { params }) {
  await connectDB();
  const { pathname } = new URL(req.url);
  if (!pathname.endsWith("/variants-bulk")) {
    // deja el resto de tu lógica existente
    return NextResponse.next();
  }

  const { id } = params;
  const { items = [] } = await req.json();
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items vacío" }, { status: 400 });
  }

  // Ejecuta updates por sku, uno por cada item (rápido y seguro)
  const ops = items.map((it) =>
    Product.updateOne(
      { _id: id },
      {
        $set: {
          ...(it.idDataverse != null ? { "products.$[v].idDataverse": it.idDataverse } : {}),
          ...(it.color != null ? { "products.$[v].color": it.color } : {}),
          ...(it.size != null ? { "products.$[v].size": it.size } : {}),
          ...(it.material != null ? { "products.$[v].material": it.material } : {}),
          ...(it.stock != null ? { "products.$[v].stock": Number(it.stock) } : {}),
        },
      },
      {
        arrayFilters: [{ "v.sku": it.sku }],
        runValidators: true,
      }
    )
  );

  const results = await Promise.all(ops);
  const matched = results.reduce((a, r) => a + (r.matchedCount || r.matched || 0), 0);
  const modified = results.reduce((a, r) => a + (r.modifiedCount || r.modified || 0), 0);

  const doc = await Product.findById(id).lean();
  return NextResponse.json({ ok: true, matched, modified, doc });
}
