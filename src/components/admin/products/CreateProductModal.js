"use client";
import React, { useMemo, useState } from "react";

export default function CreateProductModal({ onClose, onCreate }) {
  // Básicos
  const [name, setName] = useState("");
  const [price, setPrice] = useState(""); // opcional; backend puede usar price_20_100 si no viene
  const [section, setSection] = useState("");
  const [description, setDescription] = useState("");
  const [isBrandcaps, setIsBrandcaps] = useState(true);
  const [marginPercentage, setMarginPercentage] = useState("");
  const [families, setFamilies] = useState("");
  const [subattributes, setSubattributes] = useState("");

  // Mínimos y escalas
  const [minimumOrder, setMinimumOrder] = useState(20);
  const [price20_100, setPrice20_100] = useState("");
  const [price100_plus, setPrice100_plus] = useState("");
  const [price500_plus, setPrice500_plus] = useState("");

  // Variantes (sin SKU: color/material/size/stock)
  const [variants, setVariants] = useState([
    { color: "", material: "", size: "", stock: "" },
  ]);

  // Imágenes
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);

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
      { color: "", material: "", size: "", stock: "" },
    ]);

  const removeVariant = (idx) =>
    setVariants((v) => v.filter((_, i) => i !== idx));

  const updateVariant = (idx, field, value) => {
    setVariants((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    try {
      const body = new FormData();
      body.append("name", name);
      body.append("price", String(price || price20_100 || 0)); // compat
      body.append("marginPercentage", String(marginPercentage || 0));
      body.append("section", section);
      body.append("description", description || "");
      body.append("families", families); // backend puede parsear coma-separado
      body.append("subattributes", subattributes); // idem
      body.append("isBrandcaps", isBrandcaps ? "true" : "false");

      // mínimos + escalas
      body.append("minimum_order_quantity", String(minimumOrder || 20));
      body.append("price_20_100", String(price20_100 || 0));
      body.append("price_100_plus", String(price100_plus || 0));
      body.append("price_500_plus", String(price500_plus || 0));

      // Variantes SIN sku
      const payloadVariants = variants.map((v) => ({
        color: v.color || "",
        material: v.material || "",
        size: v.size || "",
        stock: Number(v.stock || 0),
      }));
      body.append("variants", JSON.stringify(payloadVariants));

      // Imágenes
      files.forEach((file) => body.append("images", file, file.name));

      const key =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;

      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "X-Idempotency-Key": key },
        body,
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `Error ${res.status}`);
      }
      const created = await res.json();
      onCreate?.(created);
      onClose?.();
    } catch (err) {
      console.error(err);
      alert("No se pudo crear el producto: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      {/* Contenedor del modal con layout flexible y scroll interno */}
      <form
        onSubmit={handleSubmit}
        encType="multipart/form-data"
        className="w-full max-w-4xl mx-3 bg-white rounded-lg shadow-lg max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header sticky */}
        <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Nuevo producto Brandcaps</h2>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
          >
            X
          </button>
        </div>

        {/* Body con scroll */}
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
                  <input
                    type="checkbox"
                    checked={isBrandcaps}
                    onChange={(e) => setIsBrandcaps(e.target.checked)}
                  />
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

            {/* Header Desktop */}
            <div className="hidden md:grid grid-cols-12 gap-2 p-2 text-sm font-medium bg-gray-50 rounded">
              <div className="col-span-3">Color</div>
              <div className="col-span-3">Material</div>
              <div className="col-span-4">Talle / Medida</div>
              <div className="col-span-2 text-center">Stock</div>
            </div>

            {/* Filas */}
            {variants.map((v, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 border rounded md:border-0 md:border-t"
              >
                {/* Color */}
                <div className="md:col-span-3">
                  <label className="md:hidden text-xs text-gray-600">
                    Color
                  </label>
                  <input
                    className="w-full border rounded p-2"
                    placeholder="Azul / Negro…"
                    value={v.color}
                    onChange={(e) =>
                      updateVariant(idx, "color", e.target.value)
                    }
                  />
                </div>
                {/* Material */}
                <div className="md:col-span-3">
                  <label className="md:hidden text-xs text-gray-600">
                    Material
                  </label>
                  <input
                    className="w-full border rounded p-2"
                    placeholder="Algodón / Metal…"
                    value={v.material}
                    onChange={(e) =>
                      updateVariant(idx, "material", e.target.value)
                    }
                  />
                </div>
                {/* Size */}
                <div className="md:col-span-4">
                  <label className="md:hidden text-xs text-gray-600">
                    Talle / Medida
                  </label>
                  <input
                    className="w-full border rounded p-2"
                    placeholder="M / 30x20…"
                    value={v.size}
                    onChange={(e) => updateVariant(idx, "size", e.target.value)}
                  />
                </div>
                {/* Stock */}
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
                      updateVariant(idx, "stock", e.target.value)
                    }
                  />
                </div>

                {/* Acción (solo mobile: botón eliminar abajo) */}
                <div className="md:hidden">
                  <button
                    type="button"
                    onClick={() => removeVariant(idx)}
                    className="mt-2 w-full px-2 py-2 rounded bg-red-100 text-red-600 hover:bg-red-200"
                  >
                    Eliminar
                  </button>
                </div>

                {/* Acción (desktop: a la derecha) */}
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
            {saving ? "Creando…" : "Crear producto"}
          </button>
        </div>
      </form>
    </div>
  );
}
