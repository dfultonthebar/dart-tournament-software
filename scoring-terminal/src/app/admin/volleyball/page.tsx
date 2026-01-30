'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Event, EventStatus, SportType } from '@shared/types'
import { getApiUrl } from '@shared/lib/api-url'

function getStatusColor(status: EventStatus): string {
  switch (status) {
    case EventStatus.DRAFT: return 'bg-yellow-600'
    case EventStatus.REGISTRATION: return 'bg-blue-600'
    case EventStatus.ACTIVE: return 'bg-green-600'
    case EventStatus.COMPLETED: return 'bg-gray-600'
    case EventStatus.CANCELLED: return 'bg-red-600'
    default: return 'bg-gray-600'
  }
}

export default function VolleyballDashboardPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading, logout } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/admin/login')
    }
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const eventsRes = await fetch(`${getApiUrl()}/events`)
      const eventsData = await eventsRes.json()

      // Filter for volleyball only
      const volleyballEvents = eventsData.filter((e: Event) => e.sport_type === SportType.VOLLEYBALL)
      setEvents(volleyballEvents)
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  if (isLoading || loading) {
    return <main className="min-h-screen p-8"><p>Loading...</p></main>
  }

  if (!isAuthenticated) {
    return <main className="min-h-screen p-8"><p>Redirecting to login...</p></main>
  }

  const activeEvents = events.filter(e => e.status === EventStatus.ACTIVE || e.status === EventStatus.REGISTRATION)

  return (
    <main className="min-h-screen p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="btn-touch btn-secondary px-4 py-2">
            &larr; Sports
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-4xl">🏐</span>
            <h1 className="text-4xl font-bold">Volleyball Dashboard</h1>
          </div>
        </div>
        <button onClick={logout} className="btn-touch btn-secondary px-4 py-2">
          Logout
        </button>
      </div>

      {/* Coming Soon Notice */}
      <div className="bg-blue-900 border border-blue-700 rounded-lg p-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="text-3xl">🚧</div>
          <div>
            <h2 className="text-xl font-bold mb-2">Scoring Coming Soon</h2>
            <p className="text-gray-300">
              Volleyball match scoring and tournament brackets are under development.
              For now, you can manage events and player registrations.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-4xl font-bold text-blue-400">{events.length}</div>
          <div className="text-gray-400">Total Events</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-4xl font-bold text-green-400">{activeEvents.length}</div>
          <div className="text-gray-400">Active Events</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-4xl font-bold text-gray-500">-</div>
          <div className="text-gray-400">Tournaments (Coming Soon)</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Quick Actions */}
        <div className="space-y-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link
                href="/admin/events/new?sport=volleyball"
                className="btn-touch block w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-center"
              >
                + Create New Event
              </Link>
              <Link
                href="/admin/players"
                className="btn-touch block w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-center"
              >
                Manage Players
              </Link>
            </div>
          </div>

          {/* Planned Features */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Planned Features</h2>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-yellow-500">○</span>
                Match scoring (sets and points)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-yellow-500">○</span>
                Tournament brackets
              </li>
              <li className="flex items-center gap-2">
                <span className="text-yellow-500">○</span>
                Team management
              </li>
              <li className="flex items-center gap-2">
                <span className="text-yellow-500">○</span>
                Pool play support
              </li>
              <li className="flex items-center gap-2">
                <span className="text-yellow-500">○</span>
                Live score display
              </li>
            </ul>
          </div>
        </div>

        {/* Right Columns - Events */}
        <div className="lg:col-span-2 bg-gray-800 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Volleyball Events</h2>
            <Link href="/admin/events?sport=volleyball" className="text-blue-400 text-sm hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-3">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/admin/events/${event.id}`}
                className="block p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium">{event.name}</div>
                  <span className={`px-2 py-1 rounded text-xs ${getStatusColor(event.status)}`}>
                    {event.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-sm text-gray-400">
                  {event.location || 'No location'} &bull; {new Date(event.start_date).toLocaleDateString()}
                </div>
              </Link>
            ))}

            {events.length === 0 && (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">🏐</div>
                <p className="text-gray-400 mb-4">No volleyball events yet</p>
                <Link
                  href="/admin/events/new?sport=volleyball"
                  className="btn-touch btn-primary px-6 py-3 inline-block"
                >
                  Create First Event
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
