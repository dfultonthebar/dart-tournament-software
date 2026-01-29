'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Event, SportType } from '@shared/types'

// Helper to get API base URL
const getApiUrl = () => typeof window !== 'undefined' ? `http://${window.location.hostname}:8000/api` : 'http://localhost:8000/api'

const GAME_TYPES = [
  { value: '501', label: '501' },
  { value: '301', label: '301' },
  { value: 'cricket', label: 'Cricket' },
]

const FORMATS = [
  { value: 'single_elimination', label: 'Single Elimination' },
  { value: 'double_elimination', label: 'Double Elimination' },
  { value: 'round_robin', label: 'Round Robin' },
  { value: 'lucky_draw_doubles', label: 'Lucky Draw Doubles' },
]

function NewTournamentContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const eventIdParam = searchParams.get('event_id')
  const { token, isAuthenticated, isLoading: authLoading } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [event, setEvent] = useState<Event | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [loadingEvent, setLoadingEvent] = useState(true)

  const [formData, setFormData] = useState({
    event_id: eventIdParam || '',
    name: '',
    description: '',
    game_type: '501',
    format: 'single_elimination',
    max_players: 16,
    scheduled_date: '',
    scheduled_time: '',
    legs_to_win: 3,
    sets_to_win: 1,
    double_in: false,
    double_out: true,
    master_out: false,
    is_coed: false,
  })

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/admin/login')
    }
  }, [isAuthenticated, authLoading, router])

  useEffect(() => {
    loadEventData()
  }, [eventIdParam])

  async function loadEventData() {
    setLoadingEvent(true)
    try {
      // If we have an event_id param, load that specific event
      if (eventIdParam) {
        const response = await fetch(`${getApiUrl()}/events/${eventIdParam}`)
        if (response.ok) {
          const eventData = await response.json()
          setEvent(eventData)
          setFormData(prev => ({ ...prev, event_id: eventIdParam }))
        } else {
          setError('Event not found')
        }
      }

      // Also load all events for the dropdown (in case they want to change)
      const eventsResponse = await fetch(`${getApiUrl()}/events`)
      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json()
        // Only show active/registration events for darts
        const filteredEvents = eventsData.filter((e: Event) =>
          e.sport_type === SportType.DARTS &&
          (e.status === 'draft' || e.status === 'registration' || e.status === 'active')
        )
        setEvents(filteredEvents)
      }
    } catch (err) {
      console.error('Error loading event data:', err)
    } finally {
      setLoadingEvent(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.event_id) {
      setError('Please select an event for this tournament')
      return
    }

    setLoading(true)
    setError('')

    try {
      const submitData: Record<string, unknown> = { ...formData }
      // Only include date/time if set
      if (!submitData.scheduled_date) delete submitData.scheduled_date
      if (!submitData.scheduled_time) delete submitData.scheduled_time

      const response = await fetch(`${getApiUrl()}/tournaments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(submitData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to create tournament')
      }

      const tournament = await response.json()
      router.push(`/admin/tournaments/${tournament.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create tournament')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || loadingEvent) {
    return <main className="min-h-screen p-8"><p>Loading...</p></main>
  }

  if (!isAuthenticated) {
    return <main className="min-h-screen p-8"><p>Redirecting to login...</p></main>
  }

  // If no event_id and no events available, show a message
  if (!eventIdParam && events.length === 0) {
    return (
      <main className="min-h-screen p-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="btn-touch btn-secondary px-4 py-2">
            &larr; Back
          </Link>
          <h1 className="text-4xl font-bold">Create Tournament</h1>
        </div>

        <div className="bg-yellow-600 text-white p-6 rounded-lg max-w-2xl">
          <h2 className="text-xl font-bold mb-2">No Events Available</h2>
          <p className="mb-4">
            Tournaments must be created within an event. Please create a Darts event first.
          </p>
          <Link
            href="/admin/events/new?sport=darts"
            className="btn-touch btn-primary px-6 py-3 inline-block"
          >
            Create Darts Event
          </Link>
        </div>
      </main>
    )
  }

  const backUrl = event ? `/admin/events/${event.id}` : '/admin'

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href={backUrl} className="btn-touch btn-secondary px-4 py-2">
          &larr; Back
        </Link>
        <div>
          <h1 className="text-4xl font-bold">Create Tournament</h1>
          {event && (
            <p className="text-gray-400 mt-1">
              for event: <span className="text-white">{event.name}</span>
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-600 text-white p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        {/* Event Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">Event *</label>
          <select
            value={formData.event_id}
            onChange={(e) => setFormData({ ...formData, event_id: e.target.value })}
            className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
            required
          >
            <option value="">Select an event...</option>
            {events.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.name} ({evt.status})
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-400 mt-1">
            All tournaments must belong to an event
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Tournament Name *</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
            placeholder="e.g., 501 Singles Championship"
          />
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Scheduled Date</label>
            <input
              type="date"
              value={formData.scheduled_date}
              onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
              className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Scheduled Time</label>
            <input
              type="time"
              value={formData.scheduled_time}
              onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
              className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Game Type *</label>
            <select
              value={formData.game_type}
              onChange={(e) => setFormData({ ...formData, game_type: e.target.value })}
              className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
            >
              {GAME_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Format *</label>
            <select
              value={formData.format}
              onChange={(e) => setFormData({ ...formData, format: e.target.value })}
              className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
            >
              {FORMATS.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label}
                </option>
              ))}
            </select>
            {formData.format === 'lucky_draw_doubles' && (
              <p className="mt-2 text-sm text-yellow-400">
                Teams will be randomly assigned from registered players. Requires an even number of players.
              </p>
            )}
          </div>
        </div>

        {formData.format === 'lucky_draw_doubles' && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_coed}
                onChange={(e) => setFormData({ ...formData, is_coed: e.target.checked })}
                className="w-5 h-5 rounded"
              />
              <div>
                <span className="font-medium">Co-ed Teams</span>
                <p className="text-sm text-gray-400 mt-1">
                  Pair one male + one female per team. Players must have gender set during registration.
                </p>
              </div>
            </label>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Max Players</label>
            <input
              type="number"
              min="2"
              max="128"
              value={formData.max_players}
              onChange={(e) => setFormData({ ...formData, max_players: parseInt(e.target.value) })}
              className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Legs to Win</label>
            <input
              type="number"
              min="1"
              max="11"
              value={formData.legs_to_win}
              onChange={(e) => setFormData({ ...formData, legs_to_win: parseInt(e.target.value) })}
              className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Sets to Win</label>
            <input
              type="number"
              min="1"
              max="7"
              value={formData.sets_to_win}
              onChange={(e) => setFormData({ ...formData, sets_to_win: parseInt(e.target.value) })}
              className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium">Finish Rules</label>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.double_in}
                onChange={(e) => setFormData({ ...formData, double_in: e.target.checked })}
                className="w-5 h-5 rounded"
              />
              <span>Double In</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.double_out}
                onChange={(e) => setFormData({ ...formData, double_out: e.target.checked, master_out: false })}
                className="w-5 h-5 rounded"
              />
              <span>Double Out</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.master_out}
                onChange={(e) => setFormData({ ...formData, master_out: e.target.checked, double_out: false })}
                className="w-5 h-5 rounded"
              />
              <span>Master Out</span>
              <span className="text-xs text-gray-400">(double, triple, or bull)</span>
            </label>
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading || !formData.event_id}
            className="btn-touch btn-primary w-full py-4 text-xl font-bold disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Tournament'}
          </button>
        </div>
      </form>
    </main>
  )
}

export default function NewTournamentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-8"><p>Loading...</p></div>}>
      <NewTournamentContent />
    </Suspense>
  )
}
