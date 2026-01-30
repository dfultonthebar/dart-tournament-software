'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getApiUrl } from '@shared/lib/api-url'

interface FormData {
  name: string
  email: string
  phone: string
  nickname: string
  gender: '' | 'M' | 'F'
}

interface FormErrors {
  name?: string
  email?: string
  phone?: string
}

export default function RegisterPage() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    nickname: '',
    gender: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState('')

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

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError('')

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const payload: any = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
      }

      // Only include nickname if provided
      if (formData.nickname.trim()) {
        payload.nickname = formData.nickname.trim()
      }

      // Only include gender if selected
      if (formData.gender) {
        payload.gender = formData.gender
      }

      const response = await fetch(`${getApiUrl()}/players/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Registration failed. Please try again.')
      }

      setSuccess(true)
    } catch (err: any) {
      setServerError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleInputChange(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData({ ...formData, [field]: e.target.value })
      // Clear error when user starts typing
      if (errors[field as keyof FormErrors]) {
        setErrors({ ...errors, [field]: undefined })
      }
    }
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

          <p className="text-xl text-gray-300 mb-8">
            Check in at the scoring desk to complete your registration.
          </p>

          <div className="space-y-4">
            <button
              onClick={() => {
                setSuccess(false)
                setFormData({ name: '', email: '', phone: '', nickname: '', gender: '' })
              }}
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

          {/* Gender Field */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Gender <span className="text-gray-500">(optional)</span>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, gender: formData.gender === 'M' ? '' : 'M' })}
                className={`flex-1 p-4 rounded-lg border text-lg font-medium transition-colors ${
                  formData.gender === 'M'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                }`}
              >
                Male
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, gender: formData.gender === 'F' ? '' : 'F' })}
                className={`flex-1 p-4 rounded-lg border text-lg font-medium transition-colors ${
                  formData.gender === 'F'
                    ? 'bg-pink-600 border-pink-500 text-white'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                }`}
              >
                Female
              </button>
            </div>
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
              onChange={handleInputChange('phone')}
              className={`w-full p-4 bg-gray-700 rounded-lg border text-lg focus:outline-none ${
                errors.phone
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-gray-600 focus:border-blue-500'
              }`}
              placeholder="(555) 123-4567"
              autoComplete="tel"
              inputMode="tel"
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn-touch btn-primary w-full py-4 text-xl font-bold disabled:opacity-50 mt-6"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <Link href="/" className="text-blue-400 hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  )
}
