'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getApiUrl } from '@shared/lib/api-url'
import { getErrorMessage } from '@shared/lib/error-message'

export default function PlayerPortal() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [showLogin, setShowLogin] = useState(true)

  // Login form state
  const [loginName, setLoginName] = useState('')
  const [loginPin, setLoginPin] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('player_token')
    const name = localStorage.getItem('player_name')
    if (token && name) {
      setIsLoggedIn(true)
      setPlayerName(name)
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setLoginError('')

    try {
      const response = await fetch(`${getApiUrl()}/auth/pin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: loginName, pin: loginPin }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Login failed')
      }

      const data = await response.json()
      localStorage.setItem('player_token', data.access_token)
      localStorage.setItem('player_name', loginName)
      setIsLoggedIn(true)
      setPlayerName(loginName)
    } catch (err) {
      setLoginError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem('player_token')
    localStorage.removeItem('player_name')
    setIsLoggedIn(false)
    setPlayerName('')
  }

  if (isLoggedIn) {
    return (
      <main className="min-h-screen p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Welcome, {playerName}!</h1>
            <button
              onClick={handleLogout}
              className="text-red-400 hover:text-red-300"
            >
              Logout
            </button>
          </div>

          <div className="space-y-4">
            <Link
              href="/player/matches"
              className="block bg-green-600 hover:bg-green-700 p-6 rounded-lg text-center text-xl font-bold transition"
            >
              My Matches
            </Link>

            <Link
              href="/player/tournaments"
              className="block bg-blue-600 hover:bg-blue-700 p-6 rounded-lg text-center text-xl font-bold transition"
            >
              View Tournaments & Sign Up
            </Link>

            <Link
              href="/"
              className="block bg-gray-700 hover:bg-gray-600 p-4 rounded-lg text-center transition"
            >
              Back to Main Menu
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">Player Portal</h1>

        {/* Toggle between Login and Register */}
        <div className="flex mb-6 bg-gray-800 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setShowLogin(true)}
            className={`flex-1 py-3 rounded-md transition font-medium ${
              showLogin ? 'bg-blue-600 text-white' : 'text-gray-400'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setShowLogin(false)}
            className={`flex-1 py-3 rounded-md transition font-medium ${
              !showLogin ? 'bg-green-600 text-white' : 'text-gray-400'
            }`}
          >
            New Player
          </button>
        </div>

        {showLogin ? (
          <form onSubmit={handleLogin} className="bg-gray-800 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Player Login</h2>

            {loginError && (
              <div className="bg-red-600 text-white p-3 rounded-lg text-sm">
                {loginError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Your Name</label>
              <input
                type="text"
                required
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder="Enter your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">4-Digit PIN</label>
              <input
                type="text"
                required
                value={loginPin}
                onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                maxLength={4}
                className="w-full p-4 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-center text-2xl tracking-[0.5em]"
                placeholder="****"
              />
            </div>

            <button
              type="submit"
              disabled={loading || loginPin.length !== 4}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-lg disabled:opacity-50 transition"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        ) : (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">New Player Registration</h2>
            <p className="text-gray-400 mb-4">Create your account to sign up for tournaments.</p>
            <Link
              href="/register?mode=player"
              className="block w-full py-4 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-lg text-center transition"
            >
              Register Now
            </Link>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/" className="text-gray-400 hover:text-white">
            Back to Main Menu
          </Link>
        </div>
      </div>
    </main>
  )
}
