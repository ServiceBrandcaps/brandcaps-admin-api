// src/app/login/page.js
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useRouter } from 'next/navigation'
import Navbar from '../../components/NavBar'
import Footer from '../../components/Footer'

export default function LoginPage() {
  const { login, user, loading, isAdmin } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // Si ya está logueado, redirijo automáticamente
  useEffect(() => {
    if (!loading && user) {
      router.replace(isAdmin ? '/admin' : '/dashboard')
    }
  }, [user, loading, isAdmin, router])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await login(email, password)
      // el useEffect hará la redirección
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className=" flex items-center justify-center">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow">
        <h1 className="text-2xl font-bold text-center mb-6">Iniciar sesión</h1>

        {error && <p className="text-red-500 mb-4 text-center">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-300"
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-300"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-2 rounded hover:bg-gray-700 disabled:opacity-50 cursor-pointer transition"
          >
            {loading ? 'Cargando…' : 'Ingresar'}
          </button>
        </form>

        {/* enlace estilo register */}
        <p className="mt-6 text-center text-gray-600">
          ¿No tenés usuario?{' '}
          <a href="/register" className="text-blue-600 hover:underline">
            Crear cuenta
          </a>
        </p>
      </div>
       
    </div> 
  )
}
