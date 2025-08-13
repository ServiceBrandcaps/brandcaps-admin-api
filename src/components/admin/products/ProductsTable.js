// --- src/components/ProductsTable.js ---
"use client";
import React from "react";
import { PencilIcon } from "@heroicons/react/24/solid";

export default function ProductsTable({ products = [], onEdit }) {
  return (
    <table className="w-full table-auto border-collapse">
      <thead>
        <tr className="bg-gray-100">
          <th className="p-2">Nombre</th>
          <th className="p-2">Familias</th>
          <th className="p-2">Atributos</th>
          <th className="p-2">Margen %</th>
          <th className="p-2">Sección</th>
          <th className="p-2">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {products.map((p) => (
          <tr key={p._id} className="border-t">
            <td className="p-2">{p.name}</td>
            <td className="p-2">
              {p.families?.map((f) => f.description).join(", ")}
            </td>
            <td className="p-2">
              {p.subattributes?.map((s) => s.name).join(", ")}
            </td>
            <td className="p-2">{p.marginPercentage}%</td>
            <td className="p-2">{p.frontSection}</td>
            <td className="p-2">
              <button onClick={() => onEdit(p)} className="border-black border-1  bg-white hover:bg-gray-200 text-black px-2 py-1 rounded cursor-pointer transition duration-200 flex items-center">
                <PencilIcon className="h-5 w-5 inline-block" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
