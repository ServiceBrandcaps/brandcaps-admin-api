"use client";
import React, { useState } from "react";

export default function CreateProductModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [section, setSection] = useState("");
  const [isBrandcaps, setIsBrandcaps] = useState(false);
  const [marginPercentage, setMarginPercentage] = useState("");
  const [families, setFamilies] = useState("");
  const [subattributes, setSubattributes] = useState("");
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    // Validar campos obligatorios
    if (!name.trim() || !price) {
      alert("Nombre y precio son obligatorios");
      setSaving(false);
      return;
    }

    // Construir FormData
    const body = new FormData();
    body.append("name", name);
    body.append("price", price);
    body.append("marginPercentage", marginPercentage || "0");
    body.append("section", section);
    body.append("families", families);
    body.append("subattributes", subattributes);
    body.append("isBrandcaps", isBrandcaps ? "true" : "false");
    files.forEach((file) => {
      body.append("images", file, file.name);
    });

    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        body, // multipart/form-data auto
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Error ${res.status}`);
      }
      const created = await res.json();
      // Llama al callback y cierra el modal
      await onCreate(created);
      onClose();
    } catch (err) {
      console.error(err);
      alert("No se pudo crear el producto: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmit}
        encType="multipart/form-data"
        className="bg-white p-6 rounded-lg w-full max-w-md space-y-4"
      >
        <h2 className="text-xl font-bold">Nuevo producto Brandcaps</h2>

        <label className="block">
          Nombre *
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />
        </label>

        <label className="block">
          Precio *
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />
        </label>

        <label className="block">
          Margen % (opcional)
          <input
            type="number"
            value={marginPercentage}
            onChange={(e) => setMarginPercentage(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </label>

        <label className="block">
          Sección frontal (opcional)
          <input
            type="text"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </label>

        <label className="block">
          Families (coma-separadas)
          <input
            type="text"
            value={families}
            onChange={(e) => setFamilies(e.target.value)}
            placeholder="Escritura, Camper..."
            className="w-full border p-2 rounded"
          />
        </label>

        <label className="block">
          Subatributos (coma-separados)
          <input
            type="text"
            value={subattributes}
            onChange={(e) => setSubattributes(e.target.value)}
            placeholder="Color, Material..."
            className="w-full border p-2 rounded"
          />
        </label>

        <label className="block">
          Imágenes
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            className="w-full"
          />
        </label>

        <div className="flex justify-end space-x-2">
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
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Creando…" : "Crear producto"}
          </button>
        </div>
      </form>
    </div>
  );
}
