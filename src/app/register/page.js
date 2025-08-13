"use client";
// src/app/register/page.js
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '../../components/NavBar'
import Footer from '../../components/Footer'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!email || !password) {
      setError('Email y contraseña son requeridos')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      if (!res.ok) {
        const { message } = await res.json()
        throw new Error(message || 'Error al registrar usuario')
      }
      // Si todo va bien, redirigimos al login
      router.push('/login')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded shadow-md w-full max-w-sm"
      >
        <h2 className="text-2xl mb-4">Crear cuenta</h2>
        {error && <p className="text-red-600 mb-2">{error}</p>}

        <label className="block mb-4">
          <span className="block text-sm font-medium text-gray-700">Email</span>
          <input
            type="email"
            className="mt-1 block w-full border p-2 rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="block mb-6">
          <span className="block text-sm font-medium text-gray-700">Contraseña</span>
          <input
            type="password"
            className="mt-1 block w-full border p-2 rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white py-2 rounded hover:bg-gray-700 disabled:opacity-50 cursor-pointer transition"
        >
          {loading ? 'Registrando...' : 'Crear cuenta'}
        </button>

        <p className="mt-4 text-sm text-center">
          ¿Ya tenés cuenta?{' '}
          <a href="/login" className="text-blue-600 hover:underline">
            Iniciar sesión
          </a>
        </p>
      </form>
    </div>
  )
}
