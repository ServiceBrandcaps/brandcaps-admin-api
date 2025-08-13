"use client";
import React, { useState, useEffect } from "react";

export default function EditRoleModal({
  user,
  isOpen,
  onClose,
  onRoleUpdated,
}) {
  const [role, setRole] = useState(user?.role || "cliente");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) setRole(user.role);
  }, [user]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({  id: user._id, role: role }),
      });
      if (!res.ok) throw new Error("Error al actualizar rol");
      const updated = await res.json();
      onRoleUpdated(updated);
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded shadow-md w-full max-w-sm"
      >
        <h2 className="text-xl mb-4">Editar rol de {user.email}</h2>
        <label className="block mb-4">
          Rol
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full border p-2 rounded mt-1"
          >
            <option value="cliente">Cliente</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 rounded"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
          >
            {loading ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
