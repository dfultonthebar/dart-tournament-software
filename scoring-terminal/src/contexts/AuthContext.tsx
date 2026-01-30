'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getApiUrl } from '@shared/lib/api-url'

interface AuthContextType {
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithPin: (name: string, pin: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Load token from localStorage on mount
    const storedToken = localStorage.getItem('admin_token')
    if (storedToken) {
      setToken(storedToken)
    }
    setIsLoading(false)
  }, [])

  async function login(email: string, password: string) {
    const response = await fetch(`${getApiUrl()}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.detail || 'Login failed')
    }

    const data = await response.json()
    setToken(data.access_token)
    localStorage.setItem('admin_token', data.access_token)
  }

  async function loginWithPin(name: string, pin: string) {
    // Use admin-login endpoint for admin authentication
    const response = await fetch(`${getApiUrl()}/auth/admin-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, pin }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.detail || 'Admin login failed')
    }

    const data = await response.json()
    setToken(data.access_token)
    localStorage.setItem('admin_token', data.access_token)
  }

  function logout() {
    setToken(null)
    localStorage.removeItem('admin_token')
  }

  return (
    <AuthContext.Provider value={{
      token,
      isAuthenticated: !!token,
      isLoading,
      login,
      loginWithPin,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
