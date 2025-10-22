// src/components/admin/products/EditProductModal.js
"use client";
import React, { useEffect, useMemo, useState } from "react";

export default function EditProductModal({ product, onClose, onSave }) {
  const isBrandcaps = !!product?.brandcapsProduct;

  // ===== Helpers de prefill =====
  const tier = (min, max) =>
    (product?.priceTiers || []).find((t) => t.min === min && t.max === max)
      ?.price ?? "";

  const tier20_100 = useMemo(() => tier(20, 100), [product]);
  const tier100_plus = useMemo(() => tier(101, 499), [product]);
  const tier500_plus = useMemo(() => tier(500, null), [product]);

  const familiesPrefill = useMemo(
    () =>
      (product?.families || [])
        .map((f) => f?.description)
        .filter(Boolean)
        .join(", "),
    [product]
  );
  const subattrsPrefill = useMemo(
    () =>
      (product?.subattributes || [])
        .map((s) => s?.name)
        .filter(Boolean)
        .join(", "),
    [product]
  );
  const variantsPrefill = useMemo(
    () =>
      (product?.products || []).map((v) => ({
        sku: v?.sku || "",
        idDataverse: v?.idDataverse || "",
        color: v?.color || "",
        material: v?.material || "",
        size: v?.size || "",
        stock: v?.stock ?? "",
      })),
    [product]
  );

  // ===== Estado (mismos campos que Create) =====
  const [name, setName] = useState(product?.name || "");
  const [price, setPrice] = useState(product?.price ?? ""); // opcional
  const [section, setSection] = useState(product?.frontSection || "");
  const [description, setDescription] = useState(product?.description || "");
  const [isBrandcapsFlag] = useState(true); // fijo en edición Brandcaps
  const [marginPercentage, setMarginPercentage] = useState(
    product?.marginPercentage ?? ""
  );

  const [families, setFamilies] = useState(familiesPrefill);
  const [subattributes, setSubattributes] = useState(subattrsPrefill);

  const [minimumOrder, setMinimumOrder] = useState(
    product?.minimum_order_quantity ?? 20
  );
  const [price20_100, setPrice20_100] = useState(tier20_100 || "");
  const [price100_plus, setPrice100_plus] = useState(tier100_plus || "");
  const [price500_plus, setPrice500_plus] = useState(tier500_plus || "");

  const [variants, setVariants] = useState(variantsPrefill);
  //variantsPrefill.length ? variantsPrefill : [{  idDataverse:"", color: "", material: "", size: "", stock: "" }]
  const [dirty, setDirty] = useState({}); // { [sku]: true }
  const dirtySkus = useMemo(() => Object.keys(dirty).filter(Boolean), [dirty]);

  const [files, setFiles] = useState([]);
  const [replaceImages, setReplaceImages] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Si el modal recibe un producto distinto, reprefill
    setName(product?.name || "");
    setPrice(product?.price ?? "");
    setSection(product?.frontSection || "");
    setDescription(product?.description || "");
    setMarginPercentage(product?.marginPercentage ?? "");
    setFamilies(familiesPrefill);
    setSubattributes(subattrsPrefill);
    setMinimumOrder(product?.minimum_order_quantity ?? 20);
    setPrice20_100(tier20_100 || "");
    setPrice100_plus(tier100_plus || "");
    setPrice500_plus(tier500_plus || "");
    setVariants(variantsPrefill);
    setDirty({});
    setFiles([]);
    setReplaceImages(false);
  }, [product]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = useMemo(() => {
    return (
      name.trim() &&
      (price || price20_100 || price100_plus || price500_plus) &&
      Number(minimumOrder) > 0
    );
  }, [name, price, price20_100, price100_plus, price500_plus, minimumOrder]);

  const handleFileChange = (e) => setFiles(Array.from(e.target.files || []));

  const addVariant = () =>
    setVariants((v) => [
      ...v,
      { idDataverse: "", color: "", material: "", size: "", stock: "" },
    ]);

  const removeVariant = (idx) =>
    setVariants((v) => v.filter((_, i) => i !== idx));

  const updateVariant = (idx, field, value, row) => {
    setVariants((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
    setDirty((prev) => ({ ...prev, [row.sku]: true })); // <- marca dirty ya
  };

  // ====== SUBMIT (dos pasos si hay imágenes) ======
  const submitJsonPatch = async () => {
    // armo priceTiers como en Create
    const priceTiers = [
      price20_100 ? { min: 20, max: 100, price: Number(price20_100) } : null,
      price100_plus
        ? { min: 101, max: 499, price: Number(price100_plus) }
        : null,
      price500_plus
        ? { min: 500, max: null, price: Number(price500_plus) }
        : null,
    ].filter(Boolean);

    // const payloadVariants = variants.map((v) => ({
    //   sku: v?.sku || "",
    //   idDataverse: v.idDataverse || "",
    //   color: v.color || "",
    //   material: v.material || "",
    //   size: v.size || "",
    //   stock: Number(v.stock || 0),
    // }));

    // 👉 incluimos TODAS las variedades con su sku (clave de merge)
    const payloadVariants = variants.map((v) => ({
      sku: v?.sku || "", // ¡no lo omitas!
      idDataverse: v.idDataverse || "",
      color: v.color || "",
      material: v.material || "",
      size: v.size || "",
      stock: Number(v.stock || 0),
      achromatic: !!v.achromatic,
    }));

    const body = {
      id: product._id,
      name,
      price: Number(price || price20_100 || 0),
      marginPercentage: Number(marginPercentage || 0),
      section, // backend lo mapea a frontSection
      description,
      families: families
        ? families
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((description) => ({ description }))
        : [],
      subattributes: subattributes
        ? subattributes
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((name) => ({ name }))
        : [],
      minimum_order_quantity: Number(minimumOrder || 20),
      priceTiers,
      products: payloadVariants, // mismas claves que guarda la colección
      brandcapsProduct: true,
    };

    const res = await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const submitImagesPatch = async () => {
    if (!files.length) return null;
    const fd = new FormData();
    fd.append("id", product._id);
    fd.append("replaceImages", replaceImages ? "true" : "false");
    files.forEach((f) => fd.append("images", f, f.name));
    const res = await fetch("/api/admin/products", {
      method: "PATCH",
      body: fd,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || saving) return;

    setSaving(true);
    try {
      // 1) actualizo todos los campos por JSON (incluye tiers, variantes, mínimos, etc.)
      const updated = await submitJsonPatch();

      // 2) si hay imágenes, hago un segundo PATCH multipart para reemplazar/adjuntar
      // let updatedFinal = updated1;
      // if (files.length) {
      //   updatedFinal = await submitImagesPatch();
      // }
      // Imágenes, si hay:
      let finalDoc = updated;
      if (files.length) {
        const img = await submitImagesPatch();
        finalDoc = img || updated;
      }

      onSave?.(finalDoc);
      onClose?.();
    } catch (err) {
      console.error(err);
      alert("No se pudo actualizar el producto: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Si NO es brandcaps, muestro el modal simple de siempre
  if (!isBrandcaps) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSaving(true);
            Promise.resolve(
              onSave?.({
                _id: product._id,
                marginPercentage,
                frontSection: section,
              })
            )
              .then(() => onClose?.())
              .catch(() => alert("No se pudo actualizar"))
              .finally(() => setSaving(false));
          }}
          className="w-full max-w-md bg-white rounded-lg shadow-lg max-h-[90vh] flex flex-col overflow-hidden"
        >
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Editar {product?.name}</h2>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300"
            >
              X
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <label className="block">
              <span className="text-sm">Margen %</span>
              <input
                type="number"
                className="mt-1 w-full border rounded p-2"
                value={marginPercentage}
                onChange={(e) => setMarginPercentage(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="text-sm">Sección frontal</span>
              <input
                className="mt-1 w-full border rounded p-2"
                value={section}
                onChange={(e) => setSection(e.target.value)}
              />
            </label>
          </div>

          <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ====== BRANDCAPS: MISMA ESTÉTICA QUE CreateProductModal ======
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form
        onSubmit={handleSubmit}
        encType="multipart/form-data"
        className="w-full max-w-4xl mx-3 bg-white rounded-lg shadow-lg max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header sticky */}
        <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Editar producto Brandcaps</h2>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
          >
            X
          </button>
        </div>

        {/* Body con scroll (idéntico a Create) */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Básicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium">Nombre *</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full border p-2 rounded"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Sección (opcional)</span>
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="mt-1 w-full border p-2 rounded"
                placeholder="destacados / novedades / …"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Margen % (opcional)</span>
              <input
                type="number"
                value={marginPercentage}
                onChange={(e) => setMarginPercentage(e.target.value)}
                className="mt-1 w-full border p-2 rounded"
                placeholder="0"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Mínimo por pedido *</span>
              <input
                type="number"
                value={minimumOrder}
                onChange={(e) => setMinimumOrder(e.target.value)}
                className="mt-1 w-full border p-2 rounded"
                min={1}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">
                Precio base (opcional){" "}
                <span className="text-gray-500">
                  (si está vacío usamos 20–100)
                </span>
              </span>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-1 w-full border p-2 rounded"
                min={0}
                step="0.01"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Producto Brandcaps</span>
              <div className="mt-2">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked readOnly />
                  <span className="text-sm text-gray-700">Sí</span>
                </label>
              </div>
            </label>
          </div>
          {/* Descripción – NUEVO */}
          <div>
            <label className="block">
              <span className="text-sm font-medium">
                Descripción del producto
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full border p-2 rounded min-h-[120px]"
                placeholder="Detalles, materiales, cuidados, etc."
              />
            </label>
          </div>
          {/* Escalas */}
          <div>
            <h3 className="font-semibold mb-2">Precios por escala</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="block">
                <span className="text-sm">20–100 unid.</span>
                <input
                  type="number"
                  value={price20_100}
                  onChange={(e) => setPrice20_100(e.target.value)}
                  className="mt-1 w-full border p-2 rounded"
                  min={0}
                  step="0.01"
                  placeholder="Ej: 1200"
                />
              </label>
              <label className="block">
                <span className="text-sm">+100 unid.</span>
                <input
                  type="number"
                  value={price100_plus}
                  onChange={(e) => setPrice100_plus(e.target.value)}
                  className="mt-1 w-full border p-2 rounded"
                  min={0}
                  step="0.01"
                  placeholder="Ej: 1100"
                />
              </label>
              <label className="block">
                <span className="text-sm">+500 unid.</span>
                <input
                  type="number"
                  value={price500_plus}
                  onChange={(e) => setPrice500_plus(e.target.value)}
                  className="mt-1 w-full border p-2 rounded"
                  min={0}
                  step="0.01"
                  placeholder="Ej: 900"
                />
              </label>
            </div>
          </div>

          {/* Families & Subattributes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium">
                Families (coma-separadas)
              </span>
              <input
                type="text"
                value={families}
                onChange={(e) => setFamilies(e.target.value)}
                placeholder="Escritura, Camper…"
                className="mt-1 w-full border p-2 rounded"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">
                Subatributos (coma-separados)
              </span>
              <input
                type="text"
                value={subattributes}
                onChange={(e) => setSubattributes(e.target.value)}
                placeholder="Color, Material…"
                className="mt-1 w-full border p-2 rounded"
              />
            </label>
          </div>

          {/* Variantes (sin SKU) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Variantes</h3>
              <button
                type="button"
                onClick={addVariant}
                className="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
              >
                + Agregar variante
              </button>
            </div>

            <div className="hidden md:grid grid-cols-12 gap-2 p-2 text-sm font-medium bg-gray-50 rounded">
              <div className="col-span-2">Id</div>
              <div className="col-span-3">Color</div>
              <div className="col-span-3">Material</div>
              <div className="col-span-2">Talle / Medida</div>
              <div className="col-span-2 text-center">Stock</div>
            </div>

            {variants.map((v, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 border rounded md:border-0 md:border-t"
              >
                <div className="md:col-span-2">
                  <label className="md:hidden text-xs text-gray-600">
                    Id system
                  </label>
                  <input
                    className="w-full border rounded p-2"
                    placeholder="ID-1879"
                    value={v.idDataverse}
                    onChange={(e) =>
                      updateVariant(idx, "idDataverse", e.target.value, v)
                    }
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="md:hidden text-xs text-gray-600">
                    Color
                  </label>
                  <input
                    className="w-full border rounded p-2"
                    placeholder="Azul / Negro…"
                    value={v.color}
                    onChange={(e) =>
                      updateVariant(idx, "color", e.target.value, v)
                    }
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="md:hidden text-xs text-gray-600">
                    Material
                  </label>
                  <input
                    className="w-full border rounded p-2"
                    placeholder="Algodón / Metal…"
                    value={v.material}
                    onChange={(e) =>
                      updateVariant(idx, "material", e.target.value, v)
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="md:hidden text-xs text-gray-600">
                    Talle / Medida
                  </label>
                  <input
                    className="w-full border rounded p-2"
                    placeholder="M / 30x20…"
                    value={v.size}
                    onChange={(e) =>
                      updateVariant(idx, "size", e.target.value, v)
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="md:hidden text-xs text-gray-600">
                    Stock
                  </label>
                  <input
                    type="number"
                    className="w-full border rounded p-2 text-center"
                    placeholder="0"
                    min={0}
                    value={v.stock}
                    onChange={(e) =>
                      updateVariant(idx, "stock", e.target.value, v)
                    }
                  />
                </div>

                <div className="md:hidden">
                  <button
                    type="button"
                    onClick={() => removeVariant(idx)}
                    className="mt-2 w-full px-2 py-2 rounded bg-red-100 text-red-600 hover:bg-red-200"
                  >
                    Eliminar
                  </button>
                </div>
                <div className="hidden md:flex md:col-span-12 justify-end">
                  <button
                    type="button"
                    onClick={() => removeVariant(idx)}
                    className="px-2 py-2 rounded bg-red-100 text-red-600 hover:bg-red-200"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Imágenes */}
          <div>
            <h3 className="font-semibold mb-2">Imágenes</h3>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
            />
            {!!files.length && (
              <p className="text-xs text-gray-500 mt-1">
                {files.length} archivo(s)
              </p>
            )}

            <label className="mt-3 inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={replaceImages}
                onChange={(e) => setReplaceImages(e.target.checked)}
              />
              <span className="text-sm">Reemplazar imágenes existentes</span>
            </label>
          </div>
        </div>

        {/* Footer sticky */}
        <div className="sticky bottom-0 z-10 bg-white border-t px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!canSubmit || saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
