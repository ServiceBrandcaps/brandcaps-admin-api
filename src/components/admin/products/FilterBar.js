// src/components/admin/products/FilterBar.js
'use client'

import { useState, useEffect } from 'react'
import { FunnelIcon } from "@heroicons/react/24/solid";

/**
 * Props:
 * - filter: { name: string, family: string, subattribute: string[] }
 * - families: string[]
 * - subattributes: string[]
 * - onFilter: (newFilter) => void
 * - onClear: () => void
 */
export default function FilterBar({
  filter,
  families = [],
  subattributes = [],
  onFilter,
  onClear
}) {
  const [name, setName] = useState(filter.name || '')
  const [family, setFamily] = useState(filter.family || '')
  const [selectedSubattrs, setSelectedSubattrs] = useState(
    filter.subattribute || []
  )

  // Sincroniza estado local al cambiar prop `filter` (por ejemplo tras un clearFilters)
  useEffect(() => {
    setName(filter.name || '')
    setFamily(filter.family || '')
    setSelectedSubattrs(filter.subattribute || [])
  }, [filter])

  // Llama a onFilter sólo cuando cambie cualquiera de los 3 valores
  useEffect(() => {
    onFilter({ name, family, subattribute: selectedSubattrs })
  }, [name, family, selectedSubattrs, onFilter])

  const handleClear = () => {
    onClear()
    // onClear normalmente resetea `filter` en el padre, 
    // lo que disparará el useEffect de arriba y pondrá estos estados en ''
  }

  return (
    <div className="flex flex-wrap gap-4 mb-4 items-end">
      {/* Búsqueda por nombre */}
      <div className="flex flex-col">
        <label className="text-sm mb-1">Buscar nombre</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Buscar nombre"
          className="border p-2 rounded w-64"
        />
      </div>

      {/* Combo de familias */}
      <div className="flex flex-col">
        <label className="text-sm mb-1">Familia</label>
        <select
          value={family}
          onChange={e => setFamily(e.target.value)}
          className="border p-2 rounded w-48"
        >
          <option value="">-- Todas las familias --</option>
          {families.map(f => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      {/* Multi-select de subatributos */}
      <div className="flex flex-col">
        <label className="text-sm mb-1">Subatributos</label>
        <select
          multiple
          value={selectedSubattrs}
          onChange={e =>
            setSelectedSubattrs(
              Array.from(e.target.selectedOptions, o => o.value)
            )
          }
          className="border p-2 rounded h-32 w-48"
        >
          {subattributes.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Botón limpiar */}
      <button
        onClick={handleClear}
        className="mt-6 border-black border-1  bg-white hover:bg-gray-200 text-black px-4 py-2 rounded cursor-pointer transition duration-200 flex items-center "
      >
        <FunnelIcon className="h-5 w-5 inline-block mr-1" />
      </button>
    </div>
  )
}
