"use client";
// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react'

// Decodifica JWT sin librerías externas
function parseJwt(token) {
  try {
    const base64 = token.split('.')[1]
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decodeURIComponent(
      json.split('').map(c => '%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join('')
    ))
  } catch {
    return {}
  }
}

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState(null)
  const [role, setRole] = useState(null)
  const [token, setToken] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('token')
    if (stored) {
      const { sub, email: e, role: r } = parseJwt(stored)
      if (sub && r) {
        setUser(sub)
        setEmail(e)
        setRole(r)
        setIsAdmin(r === 'admin')
        setToken(stored)
      } else {
        localStorage.removeItem('token')
      }
    }
    setLoading(false)
  }, [])

const login = async (email, password) => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    // aquí podrías parsear un mensaje más concreto
    throw new Error('Credenciales inválidas');
  }

  const { token: jwt } = await res.json();

  // 1) Guarda en cookie para que el middleware la reconozca
  document.cookie = [
    `token=${jwt}`,
    'path=/',
    // max-age en segundos, aquí 1 día:
    `max-age=${60 * 60 * 24}`,
    // en producción querrás:
    // 'secure',
    // 'SameSite=Strict'
  ].join('; ');

  // 2) Guarda en localStorage para que useAuth siga funcionando en el cliente
  localStorage.setItem('token', jwt);

  // 3) Decodifica y actualiza el contexto
  const { sub, email: e, role: r } = parseJwt(jwt);
  setUser(sub);
  setEmail(e);
  setRole(r);
  setIsAdmin(r === 'admin');
  setToken(jwt);
};

const logout = () => {
  // Borra la cookie del token
  document.cookie = [
    'token=',
    'path=/',
    'max-age=0'
  ].join('; ');

  // Borra el storage cliente
  localStorage.removeItem('token');

  // Limpia el estado de AuthContext
  setUser(null);
  setEmail(null);
  setRole(null);
  setIsAdmin(false);
  setToken(null);
};

  return (
    <AuthContext.Provider value={{ user, email, role, token, isAdmin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
