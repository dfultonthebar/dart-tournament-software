'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { SportType } from '@shared/types'
import { getApiUrl } from '@shared/lib/api-url'

function getSportLabel(sport: SportType | undefined): string {
  switch (sport) {
    case SportType.DARTS: return 'Darts'
    case SportType.VOLLEYBALL: return 'Volleyball'
    default: return ''
  }
}

function getSportIcon(sport: SportType | undefined): string {
  switch (sport) {
    case SportType.DARTS: return '🎯'
    case SportType.VOLLEYBALL: return '🏐'
    default: return ''
  }
}

function NewEventContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sportParam = searchParams.get('sport') as SportType | null
  const { token, isAuthenticated, isLoading: authLoading } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    start_date: '',
    end_date: '',
    max_participants: 0,
    sport_type: sportParam || SportType.DARTS,
  })

  useEffect(() => {
    if (sportParam) {
      setFormData(prev => ({ ...prev, sport_type: sportParam }))
    }
  }, [sportParam])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/admin/login')
    }
  }, [isAuthenticated, authLoading, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const payload = {
        ...formData,
        max_participants: formData.max_participants > 0 ? formData.max_participants : undefined,
        location: formData.location || undefined,
        description: formData.description || undefined,
      }

      const response = await fetch(`${getApiUrl()}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to create event')
      }

      const event = await response.json()
      router.push(`/admin/events/${event.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create event')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return <main className="min-h-screen p-8"><p>Loading...</p></main>
  }

  if (!isAuthenticated) {
    return <main className="min-h-screen p-8"><p>Redirecting to login...</p></main>
  }

  const sportLabel = getSportLabel(formData.sport_type as SportType)
  const sportIcon = getSportIcon(formData.sport_type as SportType)
  const backUrl = sportParam ? `/admin/events?sport=${sportParam}` : '/admin/events'

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href={backUrl} className="btn-touch btn-secondary px-4 py-2">
          &larr; Back
        </Link>
        <div className="flex items-center gap-3">
          {sportIcon && <span className="text-3xl">{sportIcon}</span>}
          <h1 className="text-4xl font-bold">Create {sportLabel} Event</h1>
        </div>
      </div>

      {error && (
        <div className="bg-red-600 text-white p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Event Name *</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
            placeholder={`e.g., Friday Night ${sportLabel || 'Tournament'}`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Sport Type *</label>
          <select
            value={formData.sport_type}
            onChange={(e) => setFormData({ ...formData, sport_type: e.target.value as SportType })}
            className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
          >
            <option value={SportType.DARTS}>🎯 Darts</option>
            <option value={SportType.VOLLEYBALL}>🏐 Volleyball</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
            rows={3}
            placeholder="Optional description..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Location</label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
            placeholder="e.g., The Sports Bar, 123 Main St"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Start Date *</label>
            <input
              type="date"
              required
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">End Date *</label>
            <input
              type="date"
              required
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Max Participants</label>
          <input
            type="number"
            min="0"
            max="1000"
            value={formData.max_participants}
            onChange={(e) => setFormData({ ...formData, max_participants: parseInt(e.target.value) || 0 })}
            className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
            placeholder="Leave at 0 for unlimited"
          />
          <p className="text-sm text-gray-400 mt-1">Leave at 0 for unlimited participants</p>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="btn-touch btn-primary w-full py-4 text-xl font-bold disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Event'}
          </button>
        </div>
      </form>
    </main>
  )
}

export default function NewEventPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-8"><p>Loading...</p></div>}>
      <NewEventContent />
    </Suspense>
  )
}
