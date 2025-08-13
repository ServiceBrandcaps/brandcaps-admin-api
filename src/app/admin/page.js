// src/app/admin/page.js
"use client";
import { useAuth } from '../../context/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/NavBar'
import Footer from '../../components/Footer'

export default function AdminPage() {
  const { user, email, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (!isAdmin) {
        router.replace('/dashboard');
      }
    }
  }, [loading, user, isAdmin, router]);

  if (loading || !user || !isAdmin) {
    return <p className="p-4 text-center">Cargando panel de administración...</p>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Panel de Administración</h1>
      <p>Bienvenido, <strong>{email}</strong> (Administrador). Aquí puedes gestionar usuarios, productos y cotizaciones.</p>
      {/* Añade aquí widgets y enlaces del dashboard de admin */}
    </div>
  );
}