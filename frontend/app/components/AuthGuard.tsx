'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    // Public routes that don't require authentication
    const publicRoutes = ['/login', '/register']
    
    // Allow public routes immediately
    if (publicRoutes.includes(pathname)) {
      setIsAuthenticated(true)
      return
    }

    // For protected routes, check authentication

    const token = localStorage.getItem('token')
    
    if (!token) {
      router.push('/login')
      return
    }

    // Verify token
    axios
      .get(`${API_URL}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(() => {
        setIsAuthenticated(true)
      })
      .catch(() => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        router.push('/login')
      })
  }, [pathname, router])

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return <>{children}</>
}
