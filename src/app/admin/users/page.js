"use client";
import React, { useState, useEffect } from "react";
import UsersTable from "@/components/admin/users/UsersTable";
import CreateUserModal from "@/components/admin/users/CreateUserModal";
import EditRoleModal from "@/components/admin/users/EditRoleModal";
import { useAuth } from "@/context/AuthContext";

export default function UsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  // 1) Traer usuarios
  useEffect(() => {
    if (!token) return;
    fetch("/api/admin/users", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => setUsers(data))
      .catch(console.error);
  }, [token]);

  // 2) Callbacks de los modales
  const handleNewUser = (newUser) => {
    setUsers((prev) => [...prev, newUser]);
  };

  const handleRoleUpdated = (updated) => {
    setUsers((prev) =>
      prev.map((u) => (u._id === updated._id ? updated : u))
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Gestión de usuarios</h1>

      <button
        onClick={() => setShowCreate(true)}
        className="mb-6 px-4 py-2 bg-green-600 text-white rounded"
      >
        Nuevo usuario
      </button>

      <UsersTable
        users={users}
        onEditRole={(u) => setEditingUser(u)}
      />

      <CreateUserModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleNewUser}
      />

      <EditRoleModal
        user={editingUser}
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        onRoleUpdated={handleRoleUpdated}
      />
    </div>
  );
}
