"use client";
import React from "react";

export default function UsersTable({
  users = [],            // <-- valor por defecto
  onEditRole = () => {}, // callback cuando clickean “Editar rol”
}) {
  if (users.length === 0) {
    return (
      <p className="p-4 text-gray-600">
        No hay usuarios aún.
      </p>
    );
  }

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="bg-gray-100">
          <th className="p-3 text-left">Email</th>
          <th className="p-3 text-left">Rol</th>
          <th className="p-3">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u._id} className="border-t">
            <td className="p-3">{u.email}</td>
            <td className="p-3">{u.role}</td>
            <td className="p-3 text-center">
              <button
                onClick={() => onEditRole(u)}
                className="px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
              >
                Editar rol
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
