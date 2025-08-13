// src/app/admin/products/page.js
import ProductsManager from "@/components/admin/products/ProductsManager";

export default function ProductsPage() {
  console.log("✅ mount Manager");
  return <ProductsManager />;
}

// "use client";

// import { useState, useEffect, useCallback  } from "react";
// import { useAuth } from "@/context/AuthContext";
// import FilterBar from "@/components/admin/products/FilterBar";
// import ProductsTable from "@/components/admin/products/ProductsTable";
// import EditProductModal from "@/components/admin/products/EditProductModal";
// import BulkUpdateModal from "@/components/admin/products/BulkUpdateModal";

// export default function ProductsPage() {
//   const { token, loading: authLoading } = useAuth();

//   // datos
//   const [products, setProducts] = useState([]);
//   const [totalCount, setTotalCount] = useState(0);
//   const [totalPages, setTotalPages] = useState(1);

//   // paginación
//   const [page, setPage] = useState(1);

//   // filtros
//   const [filter, setFilter] = useState({
//     name: "",
//     family: "",
//     subattribute: [],
//   });

//   // opciones dropdown
//   const [families, setFamilies] = useState([]);
//   const [subattributes, setSubattributes] = useState([]);

//   const [loading, setLoading] = useState(false);

//   // modales
//   const [editProduct, setEditProduct] = useState(null);
//   const [bulkModalOpen, setBulkModalOpen] = useState(false);

//   // 1) Carga de options (leer TODOS los productos para poblar familias/subattrs)
//    useEffect(() => {
//     if (authLoading || !token) return

//     const loadOptions = async () => {
//       try {
//         const res = await fetch('/api/admin/products?page=1&limit=1000', {
//           headers: { Authorization: `Bearer ${token}` }
//         })
//         if (!res.ok) throw new Error(`Status ${res.status}`)

//         const json = await res.json()
//         console.log('⚙️ raw options response:', json)

//         // 1) extraemos el array correcto (puede llamarse 'products' o 'items')
//         const arr = Array.isArray(json.products)
//           ? json.products
//           : Array.isArray(json.items)
//           ? json.items
//           : []

//         // 2) recorremos con chequeo de tipo
//         const fams = new Set()
//         const subs = new Set()
//         arr.forEach(p => {
//           if (Array.isArray(p.families)) {
//             p.families.forEach(f => {
//               // algunos esquemas usan 'description', otros 'title'
//               fams.add(f.description ?? f.title ?? '(sin nombre)')
//             })
//           }
//           if (Array.isArray(p.subattributes)) {
//             p.subattributes.forEach(s => {
//               subs.add(s.name ?? '(sin nombre)')
//             })
//           }
//         })

//         setFamilies([...fams])
//         setSubattributes([...subs])
//       } catch (err) {
//         console.error('Error loading options:', err)
//       }
//     }

//     loadOptions()
//   }, [authLoading, token]);

//   // 2) Carga de productos según page + filter
//   const loadProducts = async () => {
//     setLoading(true);
//     try {
//       const params = new URLSearchParams({
//         page: page.toString(),
//         limit: "100",
//       });

//       if (filter.name) params.set("name", filter.name);
//       if (filter.family) params.set("family", filter.family);
//       filter.subattribute.forEach((s) => params.append("subattribute", s));

//       const res = await fetch(`/api/admin/products?${params.toString()}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       if (!res.ok) throw new Error(`Prod status ${res.status}`);
//       const json = await res.json();
//       const items = Array.isArray(json.products) ? json.products : [];
//       setProducts(items);
//       setTotalCount(json.totalCount ?? 0);
//       setTotalPages(json.totalPages ?? 1);
//     } catch (err) {
//       console.error("Error loading products:", err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // dispara loadProducts cuando cambian page o filter
//   useEffect(() => {
//     if (authLoading || !token) return;
//     loadProducts();
//   }, [page, filter, authLoading, token]);

//   // memoiza la función para que su identidad no cambie en cada render
//   const onFilterChange = useCallback(
//     (newFilter) => setFilter((f) => ({ ...f, ...newFilter })),
//     []
//   );

//   // filtros
//   const clearFilters = () =>
//     setFilter({ name: "", family: "", subattribute: [] });

//   // editar uno
//   const handleSaveProduct = async (updated) => {
//     await fetch(`/api/admin/products`, {
//       method: "PATCH",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${token}`,
//       },
//       body: JSON.stringify({
//         id: updated._id,
//         marginPercentage: updated.marginPercentage,
//         frontSection: updated.frontSection,
//       }),
//     });
//     setEditProduct(null);
//     loadProducts();
//   };

//   // bulk update
//   const handleBulkUpdate = async ({ margin, section }) => {
//     await fetch(`/api/admin/products/bulk-update`, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${token}`,
//       },
//       body: JSON.stringify({ filter, margin, section }),
//     });
//     setBulkModalOpen(false);
//     loadProducts();
//   };

//   return (
//     <div className="p-6 space-y-6">
//       <h1 className="text-2xl font-bold">Gestión de Productos</h1>

//       <div className="flex items-center justify-between">
//         <FilterBar
//           filter={filter}
//           families={families}
//           subattributes={subattributes}
//           onFilter={onFilterChange}
//           onClear={clearFilters}
//         />
//         <button
//           onClick={() => setBulkModalOpen(true)}
//           className="bg-blue-600 text-white px-4 py-2 rounded"
//         >
//           Aplicar margen a filtrados
//         </button>
//       </div>

//       <ProductsTable
//         products={products}
//         loading={loading}
//         onEdit={(p) => setEditProduct(p)}
//       />

//       <div className="flex justify-between items-center">
//         <span>
//           Página {page} de {totalPages} — Total: {totalCount} productos
//         </span>
//         <div className="space-x-2">
//           <button
//             disabled={page <= 1}
//             onClick={() => setPage(page - 1)}
//             className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
//           >
//             ‹ Anterior
//           </button>
//           <button
//             disabled={page >= totalPages}
//             onClick={() => setPage(page + 1)}
//             className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
//           >
//             Siguiente ›
//           </button>
//         </div>
//       </div>

//       {editProduct && (
//         <EditProductModal
//           product={editProduct}
//           onClose={() => setEditProduct(null)}
//           onSave={handleSaveProduct}
//         />
//       )}
//       {bulkModalOpen && (
//         <BulkUpdateModal
//           filter={filter}
//           onClose={() => setBulkModalOpen(false)}
//           onBulkUpdate={handleBulkUpdate}
//         />
//       )}
//     </div>
//   );
// }

