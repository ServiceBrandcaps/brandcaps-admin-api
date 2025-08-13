"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/solid";

export default function Navbar() {
  const { email, loading, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Barra fija superior */}
      <nav className="bg-black shadow fixed w-full z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            {/* Solo muestra botón hamburguesa si hay usuario */}
            {email && !loading && (
              <button
                onClick={() => setOpen(!open)}
                className="text-white focus:outline-none mr-3"
              >
                {open ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
              </button>
            )}
            <Link href="/" className="text-xl font-bold text-white">
              Brandcaps
            </Link>
          </div>

          {/* Saludo y logout solo si usuario autenticado */}
          {!loading && email && (
            <div className="flex items-center space-x-4">
              <span className="text-white">Bienvenido, {email}</span>
              <button
                onClick={logout}
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded"
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Menú lateral solo para usuarios autenticados */}
      {email && !loading && (
        <aside
          className={`fixed top-16 left-0 h-full w-64 bg-white shadow transform transition-transform duration-300 z-40 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Menú</h2>
            <ul className="space-y-3">
              {isAdmin ? (
                <>
                  <li>
                    <Link href="/admin/users" onClick={() => setOpen(false)} className="text-gray-800 hover:text-black">
                      Gestión de usuarios
                    </Link>
                  </li>
                  <li>
                    <Link href="/admin/products" onClick={() => setOpen(false)} className="text-gray-800 hover:text-black">
                      Productos
                    </Link>
                  </li>
                  <li>
                    <Link href="/admin/quotes" onClick={() => setOpen(false)} className="text-gray-800 hover:text-black">
                      Cotizaciones
                    </Link>
                  </li>
                </>
              ) : (
                <li>
                  <Link href="/quotes" onClick={() => setOpen(false)} className="text-gray-800 hover:text-black">
                    Mis cotizaciones
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </aside>
      )}

      {/* Espacio para no tapar contenido debajo de la barra */}
      <div className="pt-16" />
    </>
  );
}
