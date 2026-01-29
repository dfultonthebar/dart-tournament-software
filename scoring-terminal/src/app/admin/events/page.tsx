'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Event, EventStatus, SportType } from '@shared/types'

// Helper to get API base URL
const getApiUrl = () => typeof window !== 'undefined' ? `http://${window.location.hostname}:8000/api` : 'http://localhost:8000/api'

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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getSportLabel(sport: SportType | undefined): string {
  switch (sport) {
    case SportType.DARTS: return 'Darts'
    case SportType.VOLLEYBALL: return 'Volleyball'
    default: return 'All Sports'
  }
}

function getSportIcon(sport: SportType | undefined): string {
  switch (sport) {
    case SportType.DARTS: return '🎯'
    case SportType.VOLLEYBALL: return '🏐'
    default: return '📋'
  }
}

function EventsListContent() {
  const searchParams = useSearchParams()
  const sportParam = searchParams.get('sport') as SportType | null

  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEvents()
  }, [sportParam])

  async function loadEvents() {
    try {
      const response = await fetch(`${getApiUrl()}/events`)
      const data = await response.json()

      // Filter by sport_type if provided
      const filteredEvents = sportParam
        ? data.filter((event: Event) => event.sport_type === sportParam)
        : data

      setEvents(filteredEvents)
    } catch (err) {
      console.error('Error loading events:', err)
    } finally {
      setLoading(false)
    }
  }

  const sportLabel = getSportLabel(sportParam || undefined)
  const sportIcon = getSportIcon(sportParam || undefined)

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="btn-touch btn-secondary px-4 py-2">
            &larr; Back
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{sportIcon}</span>
            <h1 className="text-4xl font-bold">{sportParam ? `${sportLabel} Events` : 'All Events'}</h1>
          </div>
        </div>
        <Link
          href={sportParam ? `/admin/events/new?sport=${sportParam}` : '/admin/events/new'}
          className="btn-touch btn-primary px-6 py-3"
        >
          + New {sportLabel} Event
        </Link>
      </div>

      {/* Sport Filter Tabs */}
      <div className="flex gap-2 mb-6">
        <Link
          href="/admin/events"
          className={`px-4 py-2 rounded-lg transition-colors ${
            !sportParam ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          All Sports
        </Link>
        <Link
          href="/admin/events?sport=darts"
          className={`px-4 py-2 rounded-lg transition-colors ${
            sportParam === 'darts' ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          🎯 Darts
        </Link>
        <Link
          href="/admin/events?sport=volleyball"
          className={`px-4 py-2 rounded-lg transition-colors ${
            sportParam === 'volleyball' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          🏐 Volleyball
        </Link>
      </div>

      {loading ? (
        <p>Loading events...</p>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="text-left p-4">Name</th>
                <th className="text-left p-4">Sport</th>
                <th className="text-left p-4">Location</th>
                <th className="text-left p-4">Dates</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Participants</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t border-gray-700 hover:bg-gray-750">
                  <td className="p-4 font-medium">{event.name}</td>
                  <td className="p-4">
                    <span className="flex items-center gap-2">
                      {getSportIcon(event.sport_type)}
                      <span className="text-gray-400">{getSportLabel(event.sport_type)}</span>
                    </span>
                  </td>
                  <td className="p-4 text-gray-400">{event.location || '-'}</td>
                  <td className="p-4 text-gray-400">
                    {formatDate(event.start_date)} - {formatDate(event.end_date)}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${getStatusColor(event.status)}`}>
                      {event.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 text-gray-400">
                    {event.max_participants ? `0 / ${event.max_participants}` : '-'}
                  </td>
                  <td className="p-4">
                    <Link
                      href={`/admin/events/${event.id}`}
                      className="text-blue-400 hover:underline"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {events.length === 0 && (
            <p className="p-8 text-center text-gray-400">
              {sportParam
                ? `No ${sportLabel.toLowerCase()} events created yet.`
                : 'No events created yet.'}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 text-gray-400">
        Total: {events.length} events
      </div>
    </main>
  )
}

export default function EventsListPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-8"><p>Loading...</p></div>}>
      <EventsListContent />
    </Suspense>
  )
}
