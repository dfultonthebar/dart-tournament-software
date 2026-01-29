'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

export default function AdminPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // If not authenticated and not loading, redirect to login
    if (!isLoading && !isAuthenticated) {
      router.push('/admin/login')
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-xl">Loading...</p>
      </main>
    )
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-xl">Redirecting to login...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-8">
      <h1 className="text-4xl font-bold mb-4">Select Your Sport</h1>
      <p className="text-gray-400 mb-12 text-center max-w-md">
        Choose which sport you want to manage. Each sport has its own events, tournaments, and settings.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
        <Link
          href="/admin/darts"
          className="btn-touch block p-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl hover:from-orange-600 hover:to-red-700 transition-all shadow-xl hover:scale-105 text-center"
        >
          <div className="text-6xl mb-4">🎯</div>
          <div className="text-4xl font-bold mb-3">Darts</div>
          <div className="text-lg opacity-90">501, 301, Cricket, and more</div>
          <div className="mt-4 text-sm opacity-75">Manage dart tournaments and scoring</div>
        </Link>

        <Link
          href="/admin/volleyball"
          className="btn-touch block p-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all shadow-xl hover:scale-105 text-center"
        >
          <div className="text-6xl mb-4">🏐</div>
          <div className="text-4xl font-bold mb-3">Volleyball</div>
          <div className="text-lg opacity-90">Beach and indoor volleyball</div>
          <div className="mt-4 text-sm opacity-75">Event management (scoring coming soon)</div>
        </Link>
      </div>

      <div className="mt-12 text-gray-500 text-sm">
        <Link href="/admin/login" className="hover:text-white">
          Switch Account
        </Link>
      </div>
    </main>
  )
}
