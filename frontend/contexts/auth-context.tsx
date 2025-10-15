"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'
import { getApiUrl } from '@/lib/api-config'

interface AuthContextType {
  user: string | null
  token: string | null
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>
  logout: () => Promise<void>
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      const storedToken = localStorage.getItem('auth_token')
      if (!storedToken) {
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch(getApiUrl('/api/auth/session'), {
          headers: {
            'Authorization': `Bearer ${storedToken}`
          }
        })

        if (response.ok) {
          const data = await response.json()
          if (data.authenticated) {
            setToken(storedToken)
            setUser(data.username)
          } else {
            localStorage.removeItem('auth_token')
          }
        } else {
          localStorage.removeItem('auth_token')
        }
      } catch (error) {
        console.error('Session check failed:', error)
        localStorage.removeItem('auth_token')
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()
  }, [])

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      })

      const data = await response.json()

      if (data.success && data.token) {
        setToken(data.token)
        setUser(data.username)
        localStorage.setItem('auth_token', data.token)
        return { success: true }
      } else {
        return { success: false, message: data.message || 'Login failed' }
      }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, message: 'Network error' }
    }
  }

  const logout = async () => {
    if (token) {
      try {
        await fetch(getApiUrl('/api/auth/logout'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      } catch (error) {
        console.error('Logout error:', error)
      }
    }

    setToken(null)
    setUser(null)
    localStorage.removeItem('auth_token')
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
