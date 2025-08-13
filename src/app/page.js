'use client'

import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from 'next/navigation'

export default function HomeRoot() {
  const { user, loading, isAdmin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    if (!user) {
      // si no está autenticado, al login
      router.replace('/login')
    } else if (isAdmin) {
      // si es admin, al panel de admin
      router.replace('/admin')
    } else {
      // si es usuario normal, al dashboard
      router.replace('/dashboard')
    }
  }, [user, loading, isAdmin, router])

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-600">Redirigiendo…</p>
    </div>
  )
}
