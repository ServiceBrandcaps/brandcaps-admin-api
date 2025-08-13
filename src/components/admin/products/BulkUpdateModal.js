// src/components/admin/products/BulkUpdateModal.js
'use client'
import { useState } from 'react'

export default function BulkUpdateModal({ filter, onClose, onBulkUpdate }) {
  const [margin, setMargin] = useState('')
  const [section, setSection] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    // Validaciones mínimas
    if (!margin) return alert('Indica un margen %')
    onBulkUpdate({
      margin: Number(margin),
      section: section.trim(),
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg w-full max-w-md space-y-4"
      >
        <h2 className="text-xl font-bold">Aplicar margen a filtrados</h2>
        <p className="text-sm text-gray-600">
          Se van a actualizar todos los productos que cumplan el filtro:
          <br />
          <code>{JSON.stringify(filter)}</code>
        </p>
        <div>
          <label className="block mb-1">Margen %</label>
          <input
            type="number"
            value={margin}
            onChange={e => setMargin(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block mb-1">Sección frontal</label>
          <input
            type="text"
            value={section}
            onChange={e => setSection(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>
        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded"
          >
            Cancelar
          </button>
          <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">
            Aplicar
          </button>
        </div>
      </form>
    </div>
  )
}
