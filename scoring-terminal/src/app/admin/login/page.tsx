'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { getErrorMessage } from '@shared/lib/error-message'

export default function LoginPage() {
  const router = useRouter()
  const { login, loginWithPin, isLoading: authLoading } = useAuth()
  const [username, setUsername] = useState('')
  const [credential, setCredential] = useState('')
  const [usePin, setUsePin] = useState(true) // Default to PIN login
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (usePin) {
        // PIN login - use name directly
        await loginWithPin(username, credential)
      } else {
        // Password login - convert username to email
        let email = username
        if (!username.includes('@')) {
          email = `${username}@thebar.com`
        }
        await login(email, credential)
      }
      router.push('/admin')
    } catch (err) {
      setError(getErrorMessage(err) || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <main className="min-h-screen p-8 flex items-center justify-center">
        <p>Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-8 flex items-center justify-center">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold mb-8 text-center">Admin Login</h1>

        {error && (
          <div className="bg-red-600 text-white p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Login Type Toggle */}
        <div className="flex mb-6 bg-gray-800 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setUsePin(true)}
            className={`flex-1 py-2 rounded-md transition ${
              usePin ? 'bg-blue-600 text-white' : 'text-gray-400'
            }`}
          >
            PIN Login
          </button>
          <button
            type="button"
            onClick={() => setUsePin(false)}
            className={`flex-1 py-2 rounded-md transition ${
              !usePin ? 'bg-blue-600 text-white' : 'text-gray-400'
            }`}
          >
            Password Login
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              {usePin ? 'Name' : 'Username'}
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              placeholder={usePin ? 'Admin' : 'admin'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              {usePin ? '4-Digit PIN' : 'Password'}
            </label>
            <input
              type={usePin ? 'text' : 'password'}
              required
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              inputMode={usePin ? 'numeric' : 'text'}
              pattern={usePin ? '[0-9]{4}' : undefined}
              maxLength={usePin ? 4 : undefined}
              className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-center text-2xl tracking-widest"
              placeholder={usePin ? '••••' : 'Enter password'}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-touch btn-primary w-full py-4 text-xl font-bold disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/" className="text-blue-400 hover:underline">
            Back to Scoring Terminal
          </Link>
        </div>
      </div>
    </main>
  )
}
