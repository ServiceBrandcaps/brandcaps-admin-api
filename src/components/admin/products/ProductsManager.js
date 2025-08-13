// src/components/admin/products/ProductsManager.js
"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import FilterBar from "./FilterBar";
import ProductsTable from "./ProductsTable";
import EditProductModal from "./EditProductModal";
import BulkUpdateModal from "./BulkUpdateModal";
import CreateProductModal from "./CreateProductModal";
import { PlusIcon, Square2StackIcon } from "@heroicons/react/24/solid";

export default function ProductsManager() {
  const { token, loading: authLoading } = useAuth();

  // datos
  const [products, setProducts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // paginación
  const [page, setPage] = useState(1);

  // filtros
  const [filter, setFilter] = useState({
    name: "",
    family: "",
    subattribute: [],
  });

  // opciones dropdown
  const [families, setFamilies] = useState([]);
  const [subattributes, setSubattributes] = useState([]);

  const [loading, setLoading] = useState(false);

  // modales
  const [editProduct, setEditProduct] = useState(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // 1) Carga de options (leer TODOS los productos para poblar familias/subattrs)
  useEffect(() => {
    console.log("🔥 cargando opciones, token:", token);
    if (authLoading || !token) return;
    const loadOptions = async () => {
      try {
        const res = await fetch("/api/admin/products?page=1&limit=1000", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);

        const json = await res.json();
        console.log("⚙️ raw options response:", json);

        // 1) extraemos el array correcto (puede llamarse 'products' o 'items')
        const arr = Array.isArray(json.products)
          ? json.products
          : Array.isArray(json.items)
          ? json.items
          : [];

        // 2) recorremos con chequeo de tipo
        const fams = new Set();
        const subs = new Set();
        arr.forEach((p) => {
          if (Array.isArray(p.families)) {
            p.families.forEach((f) => {
              // algunos esquemas usan 'description', otros 'title'
              fams.add(f.description ?? f.title ?? "(sin nombre)");
            });
          }
          if (Array.isArray(p.subattributes)) {
            p.subattributes.forEach((s) => {
              subs.add(s.name ?? "(sin nombre)");
            });
          }
        });

        setFamilies([...fams]);
        setSubattributes([...subs]);
      } catch (err) {
        console.error("Error loading options:", err);
      }
    };

    loadOptions();
  }, [authLoading, token]);

  // 2) Carga de productos según page + filter
  const loadProducts = async () => {
    console.log("📦 cargando productos page", page, filter);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "100",
      });

      if (filter.name) params.set("name", filter.name);
      if (filter.family) params.set("family", filter.family);
      filter.subattribute.forEach((s) => params.append("subattribute", s));

      const res = await fetch(`/api/admin/products?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Prod status ${res.status}`);
      const json = await res.json();
      const items = Array.isArray(json.products) ? json.products : [];
      setProducts(items);
      setTotalCount(json.totalCount ?? 0);
      setTotalPages(json.totalPages ?? 1);
    } catch (err) {
      console.error("Error loading products:", err);
    } finally {
      setLoading(false);
    }
  };

  // dispara loadProducts cuando cambian page o filter
  useEffect(() => {
    if (authLoading || !token) return;
    loadProducts();
  }, [page, filter, authLoading, token]);

  // memoiza la función para que su identidad no cambie en cada render
  const onFilterChange = useCallback(
    (newFilter) => setFilter((f) => ({ ...f, ...newFilter })),
    []
  );

  // filtros
  const clearFilters = () =>
    setFilter({ name: "", family: "", subattribute: [] });

  // editar uno
  const handleSaveProduct = async ({ _id, marginPercentage, frontSection }) => {
    try {
      const res = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: _id,
          marginPercentage: Number(marginPercentage),
          frontSection,
        }),
      });

      if (!res.ok) {
        console.error("Error actualizando producto", await res.text());
        return;
      }

      const updated = await res.json();
      // Actualizamos localmente para ver el cambio sin tener que recargar toda la página:
      setProducts((prev) =>
        prev.map((p) => (p._id === updated._id ? updated : p))
      );
      setEditProduct(null);
    } catch (err) {
      console.error("Excepción actualizando producto", err);
    }
  };

  // bulk update
  const handleBulkUpdate = async ({ margin, section }) => {
    const res = await fetch("/api/admin/products/bulk-update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ filter, margin, section }),
    });
    if (!res.ok) return alert("Error al actualizar en bloque");
    const info = await res.json();
    alert(`Se actualizaron ${info.modified} de ${info.matched} productos`);
    setBulkModalOpen(false);
    loadProducts();
  };

  //Crear
  const handleCreateProduct = async (data) => {
    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      alert("Error al crear producto");
      return;
    }
    setCreateOpen(false);
    loadProducts();
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Gestión de Productos 👕🧢🧥</h1>
      <div className="space-x-2 flex flex-row items-start justify-start mb-4 bg-gray-200 p-4 rounded">
        <button
          onClick={() => setCreateOpen(true)}
          className=" bg-black hover:bg-gray-700 text-white px-4 py-2 rounded cursor-pointer transition duration-200 flex items-center "
        >
          <PlusIcon className="h-5 w-5 inline-block mr-1" />
          Nuevo
        </button>
        <button
          onClick={() => setBulkModalOpen(true)}
          className=" bg-black hover:bg-gray-700 text-white px-4 py-2 rounded cursor-pointer transition duration-200 flex items-center"
        >
          <Square2StackIcon className="h-5 w-5 inline-block mr-1" />
          Aplicar margen a todo
        </button>
      </div>
      <div className="flex items-center justify-between">
        <FilterBar
          filter={filter}
          families={families}
          subattributes={subattributes}
          onFilter={onFilterChange}
          onClear={clearFilters}
        />
      </div>

      <ProductsTable
        products={products}
        loading={loading}
        onEdit={(p) => setEditProduct(p)}
      />

      <div className="flex justify-between items-center">
        <span>
          Página {page} de {totalPages} — Total: {totalCount} productos
        </span>
        <div className="space-x-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            ‹ Anterior
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Siguiente ›
          </button>
        </div>
      </div>

      {editProduct && (
        <EditProductModal
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onSave={handleSaveProduct}
        />
      )}
      {bulkModalOpen && (
        <BulkUpdateModal
          filter={filter}
          onClose={() => setBulkModalOpen(false)}
          onBulkUpdate={handleBulkUpdate}
        />
      )}
      {createOpen && (
        <CreateProductModal
          onClose={() => setCreateOpen(false)}
          onCreate={handleCreateProduct}
        />
      )}
    </div>
  );
}
