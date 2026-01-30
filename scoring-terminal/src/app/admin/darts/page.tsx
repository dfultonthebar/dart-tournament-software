'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Breadcrumbs from '@/components/Breadcrumbs'
import { Event, EventStatus, Tournament, TournamentStatus, MatchStatus, MatchWithPlayers, SportType } from '@shared/types'
import { getApiUrl } from '@shared/lib/api-url'

interface Dartboard {
  id: string
  number: number
  name: string | null
  is_available: boolean
  current_match_id?: string | null
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'draft': return 'bg-yellow-600'
    case 'registration': return 'bg-blue-600'
    case 'active': case 'in_progress': return 'bg-green-600'
    case 'completed': return 'bg-purple-600'
    case 'cancelled': return 'bg-red-600'
    case 'disputed': return 'bg-red-600'
    case 'pending': return 'bg-yellow-500'
    default: return 'bg-gray-600'
  }
}

export default function DartsDashboardPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [matches, setMatches] = useState<MatchWithPlayers[]>([])
  const [dartboards, setDartboards] = useState<Dartboard[]>([])
  const [loading, setLoading] = useState(true)
  const [serverIp, setServerIp] = useState<string>('Loading...')
  const [qrCodeEnabled, setQrCodeEnabled] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/admin/login')
    }
  }, [isAuthenticated, isLoading, router])

  const loadData = useCallback(async () => {
    try {
      const [eventsRes, tournamentsRes, dartboardsRes] = await Promise.all([
        fetch(`${getApiUrl()}/events`),
        fetch(`${getApiUrl()}/tournaments`),
        fetch(`${getApiUrl()}/dartboards`),
      ])

      const eventsData = await eventsRes.json()
      const tournamentsData = await tournamentsRes.json()
      const dartboardsData = await dartboardsRes.json()

      const dartsEvents = eventsData.filter((e: Event) => e.sport_type === SportType.DARTS)
      setEvents(dartsEvents)
      setTournaments(tournamentsData)
      setDartboards(dartboardsData)

      // Load matches for all in-progress tournaments
      const activeTournaments = tournamentsData.filter((t: Tournament) => t.status === 'in_progress')
      if (activeTournaments.length > 0) {
        const matchPromises = activeTournaments.map((t: Tournament) =>
          fetch(`${getApiUrl()}/matches?tournament_id=${t.id}`).then(r => r.ok ? r.json() : [])
        )
        const allMatchArrays = await Promise.all(matchPromises)
        const allMatches = allMatchArrays.flat()
        setMatches(allMatches)
      } else {
        setMatches([])
      }
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    loadServerInfo()
    loadDisplaySettings()

    // Poll every 10 seconds
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [loadData])

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
  const liveMatches = matches.filter(m => m.status === MatchStatus.IN_PROGRESS)
  const boardsInUse = dartboards.filter(d => !d.is_available)
  const disputedMatches = matches.filter(m => m.status === MatchStatus.DISPUTED)
  const pendingMatches = matches.filter(m => m.status === MatchStatus.PENDING || m.status === MatchStatus.WAITING_FOR_PLAYERS)
  const recentEvents = events.slice(0, 5)

  return (
    <main className="min-h-screen p-6 lg:p-8">
      <Breadcrumbs items={[{ label: 'Dashboard' }]} />

      <h1 className="text-3xl font-bold mb-6">Darts Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg p-5 text-center">
          <div className="text-3xl font-bold text-orange-400">{activeEvents.length}</div>
          <div className="text-gray-400 text-sm mt-1">Active Events</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-5 text-center">
          <div className="text-3xl font-bold text-green-400">{activeTournaments.length}</div>
          <div className="text-gray-400 text-sm mt-1">Live Tournaments</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-5 text-center">
          <div className="text-3xl font-bold text-blue-400">{liveMatches.length}</div>
          <div className="text-gray-400 text-sm mt-1">Matches In Progress</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-5 text-center">
          <div className="text-3xl font-bold text-teal-400">{boardsInUse.length}/{dartboards.length}</div>
          <div className="text-gray-400 text-sm mt-1">Boards In Use</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Link
          href="/admin/events/new?sport=darts"
          className="btn-touch block py-4 bg-orange-600 hover:bg-orange-700 rounded-lg font-bold text-center no-underline text-white"
        >
          + Create Event
        </Link>
        <Link
          href="/admin/tournaments/new"
          className="btn-touch block py-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-center no-underline text-white"
        >
          + Create Tournament
        </Link>
        <Link
          href="/admin/players"
          className="btn-touch block py-4 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-center no-underline text-white"
        >
          Manage Players
        </Link>
        <Link
          href="/brackets"
          className="btn-touch block py-4 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold text-center no-underline text-white"
        >
          View Brackets
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Attention Required */}
        {(disputedMatches.length > 0 || pendingMatches.length > 0) && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              Attention Required
            </h2>
            <div className="space-y-3">
              {disputedMatches.map((match) => (
                <Link
                  key={match.id}
                  href={`/matches?tournament=${match.tournament_id}`}
                  className="block p-3 bg-red-900/40 border border-red-700 rounded-lg hover:bg-red-900/60 transition-colors no-underline"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-red-300 font-medium">Disputed Match</span>
                    <span className="px-2 py-1 rounded text-xs bg-red-600">DISPUTED</span>
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    Round {match.round_number}, Match {match.match_number}
                  </div>
                </Link>
              ))}
              {pendingMatches.slice(0, 5).map((match) => (
                <Link
                  key={match.id}
                  href={`/matches?tournament=${match.tournament_id}`}
                  className="block p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg hover:bg-yellow-900/50 transition-colors no-underline"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-yellow-300 font-medium">Waiting for Board</span>
                    <span className="px-2 py-1 rounded text-xs bg-yellow-600">{match.status.toUpperCase().replace(/_/g, ' ')}</span>
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    Round {match.round_number}, Match {match.match_number}
                  </div>
                </Link>
              ))}
              {pendingMatches.length > 5 && (
                <p className="text-sm text-gray-500 text-center">
                  +{pendingMatches.length - 5} more pending matches
                </p>
              )}
            </div>
          </div>
        )}

        {/* Live Matches */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Live Matches</h2>
          {liveMatches.length > 0 ? (
            <div className="space-y-3">
              {liveMatches.slice(0, 8).map((match) => {
                const board = dartboards.find(d => d.id === match.dartboard_id)
                return (
                  <Link
                    key={match.id}
                    href={`/score/${match.id}`}
                    className="block p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors no-underline"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        {match.players.map((mp, i) => (
                          <span key={mp.player_id}>
                            {i > 0 && <span className="text-gray-500 mx-2">vs</span>}
                            <span className="text-white font-medium">{mp.legs_won}L</span>
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        {board && (
                          <span className="text-teal-400 text-sm">
                            Board {board.number}
                          </span>
                        )}
                        <span className="px-2 py-1 rounded text-xs bg-green-600">LIVE</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {match.bracket_position || `R${match.round_number} M${match.match_number}`}
                    </div>
                  </Link>
                )
              })}
              {liveMatches.length > 8 && (
                <p className="text-sm text-gray-500 text-center">
                  +{liveMatches.length - 8} more live matches
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">No matches currently in progress</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Active Tournaments */}
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
                <div
                  key={tournament.id}
                  className="p-4 bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Link href={`/admin/tournaments/${tournament.id}`} className="font-medium hover:underline">
                      {tournament.name}
                    </Link>
                    <span className={`px-2 py-1 rounded text-xs ${getStatusColor(tournament.status)}`}>
                      {tournament.status.toUpperCase().replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400 mb-2">
                    {tournament.game_type.toUpperCase()} &bull; {tournament.format.replace(/_/g, ' ')}
                  </div>
                  <Link
                    href={`/matches?tournament=${tournament.id}`}
                    className="inline-block text-green-400 text-sm hover:underline"
                  >
                    Go to Scoring &rarr;
                  </Link>
                </div>
              ))
            ) : tournaments.length > 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-400">No tournaments currently in progress</p>
                <p className="text-sm text-gray-500 mt-2">
                  {tournaments.length} total tournaments
                </p>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-400 mb-3">No tournaments yet</p>
                <Link
                  href="/admin/tournaments/new"
                  className="btn-touch btn-primary px-6 py-2 inline-block no-underline text-white"
                >
                  Create First Tournament
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Events */}
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
                className="block p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors no-underline"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-white">{event.name}</span>
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
              <div className="text-center py-6">
                <p className="text-gray-400 mb-3">No darts events yet</p>
                <Link
                  href="/admin/events/new?sport=darts"
                  className="btn-touch btn-primary px-6 py-2 inline-block no-underline text-white"
                >
                  Create First Event
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Display Controls & Server Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold mb-1">Display Terminal</h2>
              <p className="text-gray-400 text-sm">Control what shows on the big screen</p>
            </div>
            <a
              href={`http://${serverIp}:3002`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-touch btn-primary px-4 py-2 no-underline text-white"
            >
              Open Display
            </a>
          </div>
          <div className="flex items-center gap-4 pt-4 border-t border-gray-700">
            <button
              onClick={toggleQRCode}
              className={`px-4 py-2 rounded-lg font-bold transition-colors ${
                qrCodeEnabled
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              QR Registration: {qrCodeEnabled ? 'ON' : 'OFF'}
            </button>
            <span className="text-gray-400 text-sm">
              {qrCodeEnabled
                ? 'QR code showing between bracket slides'
                : 'QR code is hidden'}
            </span>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Server Info</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
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
    </main>
  )
}
