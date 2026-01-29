'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const getApiUrl = () => typeof window !== 'undefined' ? `http://${window.location.hostname}:8000/api` : 'http://localhost:8000/api'

export default function PlayerRegister() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [marketingOptIn, setMarketingOptIn] = useState(false)

  function formatPhone(value: string) {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Validation
    if (pin !== confirmPin) {
      setError('PINs do not match')
      return
    }

    if (pin.length !== 4) {
      setError('PIN must be exactly 4 digits')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${getApiUrl()}/auth/player-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone: phone.replace(/\D/g, ''), // Send just numbers
          pin,
          marketing_opt_in: marketingOptIn,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Registration failed')
      }

      setSuccess(true)

      // Auto-login after registration
      const loginResponse = await fetch(`${getApiUrl()}/auth/pin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pin }),
      })

      if (loginResponse.ok) {
        const loginData = await loginResponse.json()
        localStorage.setItem('player_token', loginData.access_token)
        localStorage.setItem('player_name', name)

        // Redirect to tournaments after short delay
        setTimeout(() => {
          router.push('/player/tournaments')
        }, 2000)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <main className="min-h-screen p-6">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2 text-green-400">Registration Successful!</h1>
            <p className="text-gray-400">Welcome, {name}!</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 space-y-6">
            <h2 className="text-xl font-bold text-center">How It Works</h2>

            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold">1</div>
                <div>
                  <p className="font-medium">Sign Up for Tournaments</p>
                  <p className="text-sm text-gray-400">Browse open tournaments and tap &quot;Sign Up&quot; to enter. Pay at the registration desk to confirm your spot.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold">2</div>
                <div>
                  <p className="font-medium">Check Your Matches</p>
                  <p className="text-sm text-gray-400">Once the tournament starts, check &quot;My Matches&quot; to see your board assignment and opponent.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold">3</div>
                <div>
                  <p className="font-medium">Arrive at Your Board</p>
                  <p className="text-sm text-gray-400">When you get to your assigned dartboard, tap &quot;I&apos;m Here&quot; to let the system know. The match starts when both players arrive.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold">4</div>
                <div>
                  <p className="font-medium">Report Your Result</p>
                  <p className="text-sm text-gray-400">After your match, both players report the result. When both agree, you automatically advance to the next round.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 mb-4">Redirecting to tournaments...</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-center">Player Registration</h1>
        <p className="text-gray-400 text-center mb-6">Create your account to join tournaments</p>

        {error && (
          <div className="bg-red-600 text-white p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Full Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              placeholder="John Smith"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Email Address <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              placeholder="john@example.com"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Phone Number <span className="text-red-400">*</span>
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              placeholder="555-123-4567"
              maxLength={12}
            />
          </div>

          {/* PIN */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Create 4-Digit PIN <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              maxLength={4}
              className="w-full p-4 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-center text-2xl tracking-[0.5em]"
              placeholder="****"
            />
            <p className="text-xs text-gray-500 mt-1">You'll use this PIN to log in</p>
          </div>

          {/* Confirm PIN */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Confirm PIN <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              maxLength={4}
              className={`w-full p-4 bg-gray-700 rounded-lg border focus:outline-none text-center text-2xl tracking-[0.5em] ${
                confirmPin && confirmPin !== pin
                  ? 'border-red-500'
                  : confirmPin && confirmPin === pin
                  ? 'border-green-500'
                  : 'border-gray-600 focus:border-blue-500'
              }`}
              placeholder="****"
            />
          </div>

          {/* Marketing Opt-in */}
          <div className="bg-gray-700 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={marketingOptIn}
                onChange={(e) => setMarketingOptIn(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-medium">Keep me informed!</span>
                <p className="text-sm text-gray-400 mt-1">
                  Yes, I'd like to receive text messages and emails about upcoming tournaments,
                  special events, and promotions.
                </p>
              </div>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || pin.length !== 4 || pin !== confirmPin}
            className="w-full py-4 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-lg disabled:opacity-50 transition"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/player" className="text-gray-400 hover:text-white">
            Already have an account? Login here
          </Link>
        </div>
      </div>
    </main>
  )
}
