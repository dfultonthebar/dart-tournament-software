'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getApiUrl } from '@shared/lib/api-url'
import { getErrorMessage } from '@shared/lib/error-message'

interface FormData {
  name: string
  email: string
  phone: string
  nickname: string
  gender: '' | 'M' | 'F'
  pin: string
  confirmPin: string
}

interface FormErrors {
  name?: string
  email?: string
  phone?: string
  gender?: string
  pin?: string
}

function RegisterContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') // 'player' mode shows PIN fields by default

  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    nickname: '',
    gender: '',
    pin: '',
    confirmPin: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState('')
  const [showPinFields, setShowPinFields] = useState(mode === 'player')
  const [marketingOptIn, setMarketingOptIn] = useState(false)

  // If mode=player, auto-show PIN fields
  useEffect(() => {
    if (mode === 'player') {
      setShowPinFields(true)
    }
  }, [mode])

  function formatPhone(value: string) {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`
  }

  function validateForm(): boolean {
    const newErrors: FormErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required'
    }

    if (!formData.gender) {
      newErrors.gender = 'Gender is required for co-ed tournament pairings'
    }

    if (showPinFields) {
      if (formData.pin.length !== 4) {
        newErrors.pin = 'PIN must be exactly 4 digits'
      } else if (formData.pin !== formData.confirmPin) {
        newErrors.pin = 'PINs do not match'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError('')

    if (!validateForm()) return

    setLoading(true)

    try {
      if (showPinFields && formData.pin) {
        // Register with PIN via player-register endpoint
        const response = await fetch(`${getApiUrl()}/auth/player-register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name.trim(),
            email: formData.email.trim().toLowerCase(),
            phone: formData.phone.replace(/\D/g, ''),
            pin: formData.pin,
            marketing_opt_in: marketingOptIn,
            ...(formData.gender && { gender: formData.gender }),
            ...(formData.nickname.trim() && { nickname: formData.nickname.trim() }),
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.detail || 'Registration failed. Please try again.')
        }

        // Auto-login after PIN registration
        const loginResponse = await fetch(`${getApiUrl()}/auth/pin-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formData.name.trim(), pin: formData.pin }),
        })

        if (loginResponse.ok) {
          const loginData = await loginResponse.json()
          localStorage.setItem('player_token', loginData.access_token)
          localStorage.setItem('player_name', formData.name.trim())
        }
      } else {
        // Register without PIN via basic registration
        const payload: Record<string, unknown> = {
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
        }

        if (formData.nickname.trim()) {
          payload.nickname = formData.nickname.trim()
        }

        if (formData.gender) {
          payload.gender = formData.gender
        }

        const response = await fetch(`${getApiUrl()}/players/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.detail || 'Registration failed. Please try again.')
        }
      }

      setSuccess(true)
    } catch (err) {
      setServerError(getErrorMessage(err) || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleInputChange(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData({ ...formData, [field]: e.target.value })
      if (errors[field as keyof FormErrors]) {
        setErrors({ ...errors, [field]: undefined })
      }
    }
  }

  function resetForm() {
    setSuccess(false)
    setFormData({ name: '', email: '', phone: '', nickname: '', gender: '', pin: '', confirmPin: '' })
    setShowPinFields(mode === 'player')
    setMarketingOptIn(false)
  }

  // Success screen
  if (success) {
    return (
      <main className="min-h-screen p-6 flex items-center justify-center">
        <div className="w-full max-w-md text-center">
          <div className="bg-green-600 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold mb-4">You&apos;re Registered!</h1>

          {showPinFields ? (
            <div className="space-y-4 mb-8">
              <p className="text-xl text-gray-300">
                Your account has been created with a PIN for mobile access.
              </p>

              <div className="bg-gray-800 rounded-lg p-6 space-y-4">
                <h2 className="text-lg font-bold">How It Works</h2>
                <div className="flex gap-3 text-left">
                  <div className="flex-shrink-0 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center font-bold text-sm">1</div>
                  <div>
                    <p className="font-medium">Sign Up for Tournaments</p>
                    <p className="text-sm text-gray-400">Browse and tap &quot;Sign Up&quot; to enter.</p>
                  </div>
                </div>
                <div className="flex gap-3 text-left">
                  <div className="flex-shrink-0 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center font-bold text-sm">2</div>
                  <div>
                    <p className="font-medium">Check Your Matches</p>
                    <p className="text-sm text-gray-400">See your board and opponent in &quot;My Matches&quot;.</p>
                  </div>
                </div>
                <div className="flex gap-3 text-left">
                  <div className="flex-shrink-0 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center font-bold text-sm">3</div>
                  <div>
                    <p className="font-medium">Report Your Result</p>
                    <p className="text-sm text-gray-400">After your match, tap &quot;I Won&quot; or &quot;I Lost&quot;.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Link
                  href="/player/tournaments"
                  className="flex-1 block py-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-center font-bold no-underline text-white transition"
                >
                  View Tournaments
                </Link>
                <Link
                  href="/player/matches"
                  className="flex-1 block py-4 bg-green-600 hover:bg-green-700 rounded-lg text-center font-bold no-underline text-white transition"
                >
                  My Matches
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4 mb-8">
              <p className="text-xl text-gray-300">
                Check in at the scoring desk to complete your registration.
              </p>

              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm">
                  Want to check your matches from your phone?
                </p>
                <Link
                  href="/register?mode=player"
                  className="inline-block mt-2 text-blue-400 hover:underline font-medium"
                >
                  Set Up PIN for Mobile Access &rarr;
                </Link>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={resetForm}
              className="btn-touch btn-primary w-full py-4 text-lg"
            >
              Register Another Player
            </button>

            <Link href="/" className="block text-blue-400 hover:underline py-2">
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-6 flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Player Registration</h1>
          <p className="text-gray-400">Sign up to join the tournament</p>
        </div>

        {/* Server Error */}
        {serverError && (
          <div className="bg-red-600 text-white p-4 rounded-lg mb-6 text-center">
            {serverError}
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-6 space-y-5">
          {/* Name Field */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={handleInputChange('name')}
              className={`w-full p-4 bg-gray-700 rounded-lg border text-lg focus:outline-none ${
                errors.name
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-gray-600 focus:border-blue-500'
              }`}
              placeholder="Your full name"
              autoComplete="name"
              autoCapitalize="words"
            />
            {errors.name && (
              <p className="text-red-400 text-sm mt-1">{errors.name}</p>
            )}
          </div>

          {/* Gender Field — required for co-ed lucky draw pairings */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Gender <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setFormData({ ...formData, gender: 'M' })
                  if (errors.gender) setErrors({ ...errors, gender: undefined })
                }}
                className={`flex-1 p-4 rounded-lg border text-lg font-medium transition-colors ${
                  formData.gender === 'M'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : errors.gender
                    ? 'bg-gray-700 border-red-500 text-gray-300'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                }`}
              >
                Male
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormData({ ...formData, gender: 'F' })
                  if (errors.gender) setErrors({ ...errors, gender: undefined })
                }}
                className={`flex-1 p-4 rounded-lg border text-lg font-medium transition-colors ${
                  formData.gender === 'F'
                    ? 'bg-pink-600 border-pink-500 text-white'
                    : errors.gender
                    ? 'bg-gray-700 border-red-500 text-gray-300'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                }`}
              >
                Female
              </button>
            </div>
            {errors.gender && (
              <p className="text-red-400 text-sm mt-1">{errors.gender}</p>
            )}
          </div>

          {/* Email Field */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={handleInputChange('email')}
              className={`w-full p-4 bg-gray-700 rounded-lg border text-lg focus:outline-none ${
                errors.email
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-gray-600 focus:border-blue-500'
              }`}
              placeholder="your@email.com"
              autoComplete="email"
              autoCapitalize="none"
              inputMode="email"
            />
            {errors.email && (
              <p className="text-red-400 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          {/* Phone Field */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Phone <span className="text-red-400">*</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => {
                setFormData({ ...formData, phone: formatPhone(e.target.value) })
                if (errors.phone) setErrors({ ...errors, phone: undefined })
              }}
              className={`w-full p-4 bg-gray-700 rounded-lg border text-lg focus:outline-none ${
                errors.phone
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-gray-600 focus:border-blue-500'
              }`}
              placeholder="555-123-4567"
              autoComplete="tel"
              inputMode="tel"
              maxLength={12}
            />
            {errors.phone && (
              <p className="text-red-400 text-sm mt-1">{errors.phone}</p>
            )}
          </div>

          {/* Nickname Field (Optional) */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Nickname <span className="text-gray-500">(optional)</span>
            </label>
            <input
              type="text"
              value={formData.nickname}
              onChange={handleInputChange('nickname')}
              className="w-full p-4 bg-gray-700 rounded-lg border border-gray-600 text-lg focus:outline-none focus:border-blue-500"
              placeholder="Display name for tournaments"
              autoCapitalize="words"
            />
          </div>

          {/* PIN Toggle */}
          <div className="border-t border-gray-700 pt-4">
            <button
              type="button"
              onClick={() => setShowPinFields(!showPinFields)}
              className={`w-full p-4 rounded-lg border text-left transition-colors ${
                showPinFields
                  ? 'bg-blue-900/30 border-blue-600'
                  : 'bg-gray-700 border-gray-600 hover:border-gray-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">Set Up Mobile PIN</span>
                  <p className="text-sm text-gray-400 mt-1">
                    Create a 4-digit PIN to check matches from your phone
                  </p>
                </div>
                <span className={`text-sm font-medium ${showPinFields ? 'text-blue-400' : 'text-gray-500'}`}>
                  {showPinFields ? 'ON' : 'OFF'}
                </span>
              </div>
            </button>
          </div>

          {/* PIN Fields */}
          {showPinFields && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Create 4-Digit PIN <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.pin}
                  onChange={(e) => {
                    setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })
                    if (errors.pin) setErrors({ ...errors, pin: undefined })
                  }}
                  inputMode="numeric"
                  maxLength={4}
                  className="w-full p-4 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-center text-2xl tracking-[0.5em]"
                  placeholder="****"
                />
                <p className="text-xs text-gray-500 mt-1">You&apos;ll use this PIN to log in from your phone</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Confirm PIN <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.confirmPin}
                  onChange={(e) => setFormData({ ...formData, confirmPin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  inputMode="numeric"
                  maxLength={4}
                  className={`w-full p-4 bg-gray-700 rounded-lg border focus:outline-none text-center text-2xl tracking-[0.5em] ${
                    formData.confirmPin && formData.confirmPin !== formData.pin
                      ? 'border-red-500'
                      : formData.confirmPin && formData.confirmPin === formData.pin
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
                      Receive messages about upcoming tournaments and events.
                    </p>
                  </div>
                </label>
              </div>

              {errors.pin && (
                <p className="text-red-400 text-sm">{errors.pin}</p>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || (showPinFields && (formData.pin.length !== 4 || formData.pin !== formData.confirmPin))}
            className="btn-touch btn-primary w-full py-4 text-xl font-bold disabled:opacity-50 mt-6"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        {/* Back Link */}
        <div className="mt-6 text-center space-y-2">
          {mode === 'player' ? (
            <Link href="/player" className="text-blue-400 hover:underline">
              Already have an account? Login here
            </Link>
          ) : (
            <Link href="/" className="text-blue-400 hover:underline">
              Back to Home
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-6 flex items-center justify-center"><p>Loading...</p></div>}>
      <RegisterContent />
    </Suspense>
  )
}
