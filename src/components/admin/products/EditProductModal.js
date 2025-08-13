"use client";
import { useEffect, useMemo, useState } from "react";

export default function EditProductModal({ product, onClose, onSave }) {
  const isBrandcaps = !!product.brandcapsProduct;

  // Campos comunes
  const [marginPercentage, setMarginPercentage] = useState(
    product.marginPercentage ?? 0
  );
  const [frontSection, setFrontSection] = useState(product.frontSection ?? "");

  // Campos extra para Brandcaps
  const [name, setName] = useState(product.name || "");
  const [price, setPrice] = useState(product.price ?? "");
  const [familiesStr, setFamiliesStr] = useState("");
  const [subattrsStr, setSubattrsStr] = useState("");
  const [files, setFiles] = useState([]);
  const [replaceImages, setReplaceImages] = useState(false);

  const [saving, setSaving] = useState(false);

  // Prefill de familias y subatributos en Brandcaps
  useEffect(() => {
    if (isBrandcaps) {
      const fam = (product.families || [])
        .map((f) => f.description)
        .filter(Boolean)
        .join(", ");
      const sub = (product.subattributes || [])
        .map((s) => s.name)
        .filter(Boolean)
        .join(", ");
      setFamiliesStr(fam);
      setSubattrsStr(sub);
    }
  }, [isBrandcaps, product]);

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files || []));
  };

  const handleSubmitBrandcaps = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Validar mínimos
      if (!name.trim() || price === "" || price === null) {
        alert("Nombre y precio son obligatorios");
        setSaving(false);
        return;
      }

      // Construir FormData (PATCH)
      const body = new FormData();
      body.append("id", product._id);
      body.append("name", name);
      body.append("price", String(price));
      body.append("marginPercentage", String(marginPercentage ?? 0));
      // Aceptamos ambos por compatibilidad, el backend mapeará a frontSection
      body.append("section", frontSection);
      body.append("frontSection", frontSection);
      body.append("families", familiesStr);
      body.append("subattributes", subattrsStr);
      body.append("replaceImages", replaceImages ? "true" : "false");

      files.forEach((file) => body.append("images", file, file.name));

      const res = await fetch("/api/admin/products", {
        method: "PATCH",
        body, // multipart
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const updated = await res.json();
      // notificar al padre y cerrar
      onSave?.(updated);
      onClose();
    } catch (err) {
      console.error(err);
      alert("No se pudo actualizar el producto: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitSupplier = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // delega en tu handler existente del padre
      await onSave?.({
        _id: product._id,
        marginPercentage,
        frontSection,
      });
      onClose();
    } catch (err) {
      console.error(err);
      alert("No se pudo actualizar el producto");
    } finally {
      setSaving(false);
    }
  };

  // Render condicional
  if (isBrandcaps) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <form
          onSubmit={handleSubmitBrandcaps}
          encType="multipart/form-data"
          className="bg-white p-6 rounded-lg w-full max-w-lg space-y-4"
        >
          <h2 className="text-xl font-bold">Editar (Brandcaps)</h2>

          <label className="block">
            Nombre *
            <input
              className="w-full border p-2 rounded"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <label className="block">
            Precio *
            <input
              type="number"
              className="w-full border p-2 rounded"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </label>

          <label className="block">
            Margen %
            <input
              type="number"
              className="w-full border p-2 rounded"
              value={marginPercentage}
              onChange={(e) => setMarginPercentage(e.target.value)}
            />
          </label>

          <label className="block">
            Sección frontal
            <input
              className="w-full border p-2 rounded"
              value={frontSection}
              onChange={(e) => setFrontSection(e.target.value)}
            />
          </label>

          <label className="block">
            Familias (coma-separadas)
            <input
              className="w-full border p-2 rounded"
              value={familiesStr}
              onChange={(e) => setFamiliesStr(e.target.value)}
            />
          </label>

          <label className="block">
            Subatributos (coma-separados)
            <input
              className="w-full border p-2 rounded"
              value={subattrsStr}
              onChange={(e) => setSubattrsStr(e.target.value)}
            />
          </label>

          <label className="block">
            Imágenes (añadir nuevas)
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="w-full"
            />
          </label>

          <label className="inline-flex items-center space-x-2">
            <input
              type="checkbox"
              checked={replaceImages}
              onChange={(e) => setReplaceImages(e.target.checked)}
            />
            <span>Reemplazar imágenes existentes</span>
          </label>

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-gray-200 rounded"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Modal simple (proveedor)
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmitSupplier}
        className="bg-white p-6 rounded-lg w-full max-w-md space-y-4"
      >
        <h2 className="text-xl font-bold">Editar {product.name}</h2>

        <label className="block">
          Margen %
          <input
            type="number"
            className="w-full border p-2 rounded"
            value={marginPercentage}
            onChange={(e) => setMarginPercentage(e.target.value)}
          />
        </label>

        <label className="block">
          Sección frontal
          <input
            className="w-full border p-2 rounded"
            value={frontSection}
            onChange={(e) => setFrontSection(e.target.value)}
          />
        </label>

        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-gray-200 rounded"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
