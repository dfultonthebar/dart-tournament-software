'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Event, EventStatus, Tournament, TournamentStatus, SportType } from '@shared/types'
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

function getTournamentStatusColor(status: string): string {
  switch (status) {
    case 'draft': return 'bg-yellow-600'
    case 'registration': return 'bg-blue-600'
    case 'in_progress': return 'bg-green-600'
    case 'completed': return 'bg-purple-600'
    case 'cancelled': return 'bg-gray-600'
    default: return 'bg-gray-600'
  }
}

export default function DartsDashboardPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading, logout } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [serverIp, setServerIp] = useState<string>('Loading...')
  const [qrCodeEnabled, setQrCodeEnabled] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/admin/login')
    }
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    loadData()
    loadServerInfo()
    loadDisplaySettings()
  }, [])

  async function loadServerInfo() {
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/health`)
      const data = await res.json()
      if (data.ip_addresses && data.ip_addresses.length > 0) {
        setServerIp(data.ip_addresses[0])
      } else {
        setServerIp(window.location.hostname)
      }
    } catch {
      setServerIp(window.location.hostname)
    }
  }

  async function loadData() {
    try {
      const [eventsRes, tournamentsRes] = await Promise.all([
        fetch(`${getApiUrl()}/events`),
        fetch(`${getApiUrl()}/tournaments`),
      ])

      const eventsData = await eventsRes.json()
      const tournamentsData = await tournamentsRes.json()

      // Filter for darts only
      const dartsEvents = eventsData.filter((e: Event) => e.sport_type === SportType.DARTS)
      setEvents(dartsEvents)
      setTournaments(tournamentsData)
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadDisplaySettings() {
    try {
      const res = await fetch(`${getApiUrl()}/display-settings`)
      if (res.ok) {
        const data = await res.json()
        setQrCodeEnabled(data.qr_code_enabled ?? false)
      }
    } catch {
      // ignore
    }
  }

  async function toggleQRCode() {
    const newValue = !qrCodeEnabled
    try {
      const res = await fetch(`${getApiUrl()}/display-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_code_enabled: newValue }),
      })
      if (res.ok) {
        setQrCodeEnabled(newValue)
      }
    } catch {
      // ignore
    }
  }

  if (isLoading || loading) {
    return <main className="min-h-screen p-8"><p>Loading...</p></main>
  }

  if (!isAuthenticated) {
    return <main className="min-h-screen p-8"><p>Redirecting to login...</p></main>
  }

  const activeEvents = events.filter(e => e.status === EventStatus.ACTIVE || e.status === EventStatus.REGISTRATION)
  const activeTournaments = tournaments.filter(t => t.status === 'in_progress')
  const recentEvents = events.slice(0, 5)

  return (
    <main className="min-h-screen p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="btn-touch btn-secondary px-4 py-2">
            &larr; Sports
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-4xl">🎯</span>
            <h1 className="text-4xl font-bold">Darts Dashboard</h1>
          </div>
        </div>
        <button onClick={logout} className="btn-touch btn-secondary px-4 py-2">
          Logout
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-4xl font-bold text-orange-400">{events.length}</div>
          <div className="text-gray-400">Total Events</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-4xl font-bold text-green-400">{activeEvents.length}</div>
          <div className="text-gray-400">Active Events</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-4xl font-bold text-blue-400">{tournaments.length}</div>
          <div className="text-gray-400">Tournaments</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-4xl font-bold text-purple-400">{activeTournaments.length}</div>
          <div className="text-gray-400">In Progress</div>
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
                href="/admin/events/new?sport=darts"
                className="btn-touch block w-full py-4 bg-orange-600 hover:bg-orange-700 rounded-lg font-bold text-center"
              >
                + Create New Event
              </Link>
              <Link
                href="/admin/players"
                className="btn-touch block w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-center"
              >
                Manage Players
              </Link>
              <Link
                href="/admin/dartboards"
                className="btn-touch block w-full py-3 bg-teal-600 hover:bg-teal-700 rounded-lg font-bold text-center"
              >
                Manage Dartboards
              </Link>
              <Link
                href="/"
                className="btn-touch block w-full py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-bold text-center"
              >
                Scoring Terminal
              </Link>
            </div>
          </div>

          {/* Server Info */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Server Info</h2>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-gray-400 mb-1">Scoring Terminal:</div>
                <code className="bg-gray-700 px-2 py-1 rounded text-green-400">
                  http://{serverIp}:3001
                </code>
              </div>
              <div>
                <div className="text-gray-400 mb-1">Bracket Display:</div>
                <code className="bg-gray-700 px-2 py-1 rounded text-purple-400">
                  http://{serverIp}:3002
                </code>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Column - Events */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Recent Events</h2>
            <Link href="/admin/events?sport=darts" className="text-blue-400 text-sm hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-3">
            {recentEvents.map((event) => (
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
              <div className="text-center py-8">
                <p className="text-gray-400 mb-4">No darts events yet</p>
                <Link
                  href="/admin/events/new?sport=darts"
                  className="btn-touch btn-primary px-6 py-2 inline-block"
                >
                  Create First Event
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Active Tournaments */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Active Tournaments</h2>
            <Link href="/admin/tournaments" className="text-blue-400 text-sm hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-3">
            {activeTournaments.length > 0 ? (
              activeTournaments.map((tournament) => (
                <Link
                  key={tournament.id}
                  href={`/admin/tournaments/${tournament.id}`}
                  className="block p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium">{tournament.name}</div>
                    <span className={`px-2 py-1 rounded text-xs ${getTournamentStatusColor(tournament.status)}`}>
                      {tournament.status.toUpperCase().replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400">
                    {tournament.game_type.toUpperCase()} &bull; {tournament.format.replace(/_/g, ' ')}
                  </div>
                  <Link
                    href={`/matches?tournament=${tournament.id}`}
                    className="mt-2 inline-block text-green-400 text-sm hover:underline"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    Go to Scoring &rarr;
                  </Link>
                </Link>
              ))
            ) : tournaments.length > 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">No tournaments currently in progress</p>
                <p className="text-sm text-gray-500 mt-2">
                  {tournaments.length} total tournaments
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-4">No tournaments yet</p>
                <p className="text-sm text-gray-500">
                  Create an event first, then add tournaments
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Display Controls */}
      <div className="mt-8 bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold mb-1">Display Terminal</h2>
            <p className="text-gray-400 text-sm">Control what shows on the big screen</p>
          </div>
          <a
            href={`http://${serverIp}:3002`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-touch btn-primary px-6 py-3"
          >
            Open Display
          </a>
        </div>
        <div className="flex items-center gap-4 pt-4 border-t border-gray-700">
          <button
            onClick={toggleQRCode}
            className={`px-5 py-3 rounded-lg font-bold transition-colors ${
              qrCodeEnabled
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-600 hover:bg-gray-500'
            }`}
          >
            QR Registration: {qrCodeEnabled ? 'ON' : 'OFF'}
          </button>
          <span className="text-gray-400 text-sm">
            {qrCodeEnabled
              ? 'QR code is showing on the display between bracket slides'
              : 'QR code is hidden on the display'}
          </span>
        </div>
      </div>
    </main>
  )
}
