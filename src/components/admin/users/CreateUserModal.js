"use client";
import React, { useState } from "react";

export default function CreateUserModal({ isOpen, onClose, onCreated }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("cliente"); // <-- rol por defecto
  const [loading, setLoading] = useState(false);

async function handleSubmit(e) {
  e.preventDefault();
  setLoading(true);

  try {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    });

    // intenta leer el cuerpo JSON *antes* de chequear res.ok
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("Error creating user response:", res.status, body);
      // muestra error específico si viene en body.message o body.error
      throw new Error(body.message || body.error || "Error creando usuario");
    }

    // OK!
    const newUser = body;
    onCreated(newUser);
    onClose();
    setEmail("");
    setPassword("");
    setRole("cliente");
  } catch (err) {
    console.error("Excepción creando usuario:", err);
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
        <h2 className="text-xl mb-4">Nuevo usuario</h2>

        <label className="block mb-2">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border p-2 rounded mt-1"
          />
        </label>

        <label className="block mb-2">
          Contraseña
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border p-2 rounded mt-1"
          />
        </label>

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
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Creando…" : "Crear"}
          </button>
        </div>
      </form>
    </div>
  );
}
