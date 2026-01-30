'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Event, EventEntry, EventStatus, Tournament, Player, SportType } from '@shared/types'
import { useAuth } from '@/contexts/AuthContext'
import { getApiUrl } from '@shared/lib/api-url'
import Breadcrumbs from '@/components/Breadcrumbs'

type TabType = 'overview' | 'players' | 'tournaments' | 'dartboards'

export default function EventDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { token, isAuthenticated } = useAuth()
  const eventId = params.id as string

  const [event, setEvent] = useState<Event | null>(null)
  const [entries, setEntries] = useState<EventEntry[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  useEffect(() => {
    loadData()
  }, [eventId])

  async function loadData() {
    try {
      const [eventRes, entriesRes, tournamentsRes, playersRes] = await Promise.all([
        fetch(`${getApiUrl()}/events/${eventId}`),
        fetch(`${getApiUrl()}/events/${eventId}/entries`),
        fetch(`${getApiUrl()}/events/${eventId}/tournaments`),
        fetch(`${getApiUrl()}/players`),
      ])

      const eventData = await eventRes.json()
      const entriesData = await entriesRes.json()
      const tournamentsData = await tournamentsRes.json()
      const playersData = await playersRes.json()

      setEvent(eventData)
      setEntries(entriesData)
      setTournaments(tournamentsData)
      setAllPlayers(playersData)
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Failed to load event data')
    } finally {
      setLoading(false)
    }
  }

  function getPlayerName(playerId: string): string {
    const player = allPlayers.find(p => p.id === playerId)
    return player?.name || 'Unknown'
  }

  function getAvailablePlayers(): Player[] {
    const enteredPlayerIds = entries.map(e => e.player_id)
    return allPlayers.filter(p =>
      !enteredPlayerIds.includes(p.id) &&
      p.is_active &&
      !p.email?.endsWith('@thebar.com')
    )
  }

  async function addPlayer() {
    if (!selectedPlayer || !token) {
      if (!token) setError('Please login to add players')
      return
    }

    setActionLoading(true)
    setError('')

    try {
      const response = await fetch(`${getApiUrl()}/events/${eventId}/entries/${selectedPlayer}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to add player')
      }

      setSelectedPlayer('')
      loadData()
    } catch (err: any) {
      setError(err.message || 'Failed to add player')
    } finally {
      setActionLoading(false)
    }
  }

  async function removePlayer(entryId: string) {
    if (!token) {
      setError('Please login to remove players')
      return
    }

    setActionLoading(true)
    setError('')

    try {
      const response = await fetch(`${getApiUrl()}/events/${eventId}/entries/${entryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to remove player')
      }

      loadData()
    } catch (err: any) {
      setError(err.message || 'Failed to remove player')
    } finally {
      setActionLoading(false)
    }
  }

  async function togglePaidStatus(entryId: string, currentPaid: boolean) {
    if (!token) {
      setError('Please login to update payment status')
      return
    }

    try {
      const response = await fetch(`${getApiUrl()}/events/${eventId}/entries/${entryId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ paid: !currentPaid }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to update payment status')
      }

      loadData()
    } catch (err: any) {
      setError(err.message || 'Failed to update payment status')
    }
  }

  async function updateStatus(status: string) {
    if (!token) {
      setError('Please login to update status')
      return
    }

    setActionLoading(true)
    setError('')

    try {
      const response = await fetch(`${getApiUrl()}/events/${eventId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to update status')
      }

      loadData()
    } catch (err: any) {
      setError(err.message || 'Failed to update status')
    } finally {
      setActionLoading(false)
    }
  }

  async function deleteEvent() {
    if (!token) {
      setError('Please login to delete event')
      return
    }

    setActionLoading(true)
    setError('')

    try {
      const response = await fetch(`${getApiUrl()}/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to delete event')
      }

      router.push('/admin/events')
    } catch (err: any) {
      setError(err.message || 'Failed to delete event')
      setShowDeleteConfirm(false)
    } finally {
      setActionLoading(false)
    }
  }

  function exportParticipantsToCSV() {
    const headers = ['Name', 'Email', 'Phone', 'Paid', 'Notes']
    const rows = entries.map(entry => {
      const player = allPlayers.find(p => p.id === entry.player_id)
      return [
        player?.name || 'Unknown',
        player?.email || '',
        player?.phone || '',
        entry.paid ? 'Yes' : 'No',
        entry.notes || ''
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    const eventName = event?.name.replace(/[^a-z0-9]/gi, '_') || 'event'
    link.setAttribute('href', url)
    link.setAttribute('download', `${eventName}_participants_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  function getStatusColor(status: EventStatus): string {
    switch (status) {
      case EventStatus.DRAFT: return 'bg-yellow-600'
      case EventStatus.REGISTRATION: return 'bg-blue-600'
      case EventStatus.ACTIVE: return 'bg-green-600'
      case EventStatus.COMPLETED: return 'bg-purple-600'
      case EventStatus.CANCELLED: return 'bg-gray-600'
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

  function getSportIcon(sportType: SportType): string {
    switch (sportType) {
      case SportType.DARTS: return '🎯'
      case SportType.VOLLEYBALL: return '🏐'
      default: return '📋'
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen p-8">
        <p>Loading event...</p>
      </main>
    )
  }

  if (!event) {
    return (
      <main className="min-h-screen p-8">
        <p>Event not found</p>
        <Link href="/admin/events" className="btn-touch btn-secondary mt-4">
          Back to Events
        </Link>
      </main>
    )
  }

  const availablePlayers = getAvailablePlayers()
  const paidCount = entries.filter(e => e.paid).length
  const canAddPlayers = event.status === EventStatus.DRAFT || event.status === EventStatus.REGISTRATION
  const isDarts = event.sport_type === SportType.DARTS

  return (
    <main className="min-h-screen p-6 lg:p-8">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/admin/darts' },
        { label: 'Events', href: `/admin/events?sport=${event.sport_type}` },
        { label: event.name },
      ]} />

      {/* Header Section */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{getSportIcon(event.sport_type)}</span>
            <h1 className="text-3xl font-bold">{event.name}</h1>
            <span className={`px-3 py-1 rounded text-sm ${getStatusColor(event.status)}`}>
              {event.status.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-4 text-gray-400 flex-wrap">
            {event.location && <span>{event.location}</span>}
            {event.location && <span>|</span>}
            <span>{formatDate(event.start_date)} - {formatDate(event.end_date)}</span>
          </div>
        </div>
      </div>

      {!isAuthenticated && (
        <div className="bg-yellow-600 text-white p-4 rounded-lg mb-6">
          <Link href="/admin/login" className="underline font-bold">Login</Link> to manage this event.
        </div>
      )}

      {error && (
        <div className="bg-red-600 text-white p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-blue-400">{entries.length}</div>
          <div className="text-gray-400 text-sm">Participants</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-green-400">{paidCount}</div>
          <div className="text-gray-400 text-sm">Paid</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-purple-400">{tournaments.length}</div>
          <div className="text-gray-400 text-sm">Tournaments</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-orange-400">
            {tournaments.filter(t => t.status === 'in_progress').length}
          </div>
          <div className="text-gray-400 text-sm">Active</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-gray-700 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            activeTab === 'overview' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('players')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            activeTab === 'players' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Players ({entries.length})
        </button>
        <button
          onClick={() => setActiveTab('tournaments')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            activeTab === 'tournaments' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Tournaments ({tournaments.length})
        </button>
        {isDarts && (
          <button
            onClick={() => setActiveTab('dartboards')}
            className={`px-4 py-2 rounded-t-lg transition-colors ${
              activeTab === 'dartboards' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Dartboards
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {event.description && (
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-medium mb-2">Description</h3>
                  <p className="text-gray-300">{event.description}</p>
                </div>
              )}

              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-medium mb-4">Event Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-gray-400">Sport:</div>
                  <div>{getSportIcon(event.sport_type)} {event.sport_type === SportType.DARTS ? 'Darts' : 'Volleyball'}</div>
                  <div className="text-gray-400">Start Date:</div>
                  <div>{formatDate(event.start_date)}</div>
                  <div className="text-gray-400">End Date:</div>
                  <div>{formatDate(event.end_date)}</div>
                  {event.location && (
                    <>
                      <div className="text-gray-400">Location:</div>
                      <div>{event.location}</div>
                    </>
                  )}
                  {event.max_participants && (
                    <>
                      <div className="text-gray-400">Max Participants:</div>
                      <div>{event.max_participants}</div>
                    </>
                  )}
                  <div className="text-gray-400">Registered:</div>
                  <div>{entries.length} participants</div>
                  <div className="text-gray-400">Paid:</div>
                  <div>{paidCount} / {entries.length}</div>
                </div>
              </div>

              {/* Recent Tournaments */}
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Recent Tournaments</h3>
                  <button
                    onClick={() => setActiveTab('tournaments')}
                    className="text-blue-400 text-sm hover:underline"
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-2">
                  {tournaments.slice(0, 3).map((tournament) => (
                    <Link
                      key={tournament.id}
                      href={`/admin/tournaments/${tournament.id}`}
                      className="flex items-center justify-between p-3 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
                    >
                      <div>
                        <div className="font-medium">{tournament.name}</div>
                        <div className="text-sm text-gray-400">
                          {tournament.game_type.toUpperCase()} - {tournament.format.replace(/_/g, ' ')}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${getTournamentStatusColor(tournament.status)}`}>
                        {tournament.status.toUpperCase().replace(/_/g, ' ')}
                      </span>
                    </Link>
                  ))}
                  {tournaments.length === 0 && (
                    <p className="text-gray-400 text-center py-4">No tournaments yet</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Players Tab */}
          {activeTab === 'players' && (
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">
                  Participants ({entries.length}{event.max_participants ? `/${event.max_participants}` : ''})
                </h2>
                {entries.length > 0 && (
                  <button
                    onClick={exportParticipantsToCSV}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm"
                  >
                    Export CSV
                  </button>
                )}
              </div>

              <div className="text-sm text-gray-400 mb-4">
                Payment: {paidCount}/{entries.length} paid
              </div>

              {canAddPlayers && isAuthenticated && availablePlayers.length > 0 && (
                <div className="flex gap-2 mb-4">
                  <select
                    value={selectedPlayer}
                    onChange={(e) => setSelectedPlayer(e.target.value)}
                    className="flex-1 p-3 bg-gray-700 rounded-lg border border-gray-600"
                  >
                    <option value="">Select a player...</option>
                    {availablePlayers.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={addPlayer}
                    disabled={!selectedPlayer || actionLoading}
                    className="btn-touch btn-primary px-6 disabled:opacity-50"
                  >
                    Add Player
                  </button>
                </div>
              )}

              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {entries.map((entry, index) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-700 rounded">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 w-8">#{index + 1}</span>
                      <span className="font-medium">{getPlayerName(entry.player_id)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {canAddPlayers && isAuthenticated && (
                        <>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={entry.paid}
                              onChange={() => togglePaidStatus(entry.id, entry.paid)}
                              className="w-5 h-5 accent-green-500"
                            />
                            <span className={`text-sm ${entry.paid ? 'text-green-400' : 'text-red-400'}`}>
                              {entry.paid ? 'Paid' : 'Unpaid'}
                            </span>
                          </label>
                          <button
                            onClick={() => removePlayer(entry.id)}
                            disabled={actionLoading}
                            className="text-red-400 hover:text-red-300 px-2 py-1 disabled:opacity-50"
                            title="Remove player"
                          >
                            X
                          </button>
                        </>
                      )}
                      {!canAddPlayers && (
                        <span className={`text-sm ${entry.paid ? 'text-green-400' : 'text-red-400'}`}>
                          {entry.paid ? 'Paid' : 'Unpaid'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {entries.length === 0 && (
                  <p className="text-gray-400 text-center py-8">No participants registered yet</p>
                )}
              </div>
            </div>
          )}

          {/* Tournaments Tab */}
          {activeTab === 'tournaments' && (
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Tournaments ({tournaments.length})</h2>
                {isAuthenticated && (
                  <Link
                    href={`/admin/tournaments/new?event_id=${eventId}`}
                    className="btn-touch btn-primary px-4 py-2"
                  >
                    + New Tournament
                  </Link>
                )}
              </div>

              <div className="space-y-3">
                {tournaments.map((tournament) => (
                  <Link
                    key={tournament.id}
                    href={`/admin/tournaments/${tournament.id}`}
                    className="block p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-bold text-lg">{tournament.name}</div>
                      <span className={`px-2 py-1 rounded text-xs ${getTournamentStatusColor(tournament.status)}`}>
                        {tournament.status.toUpperCase().replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>{tournament.game_type.toUpperCase()}</span>
                      <span>|</span>
                      <span>{tournament.format.replace(/_/g, ' ')}</span>
                      <span>|</span>
                      <span>Best of {tournament.legs_to_win} legs</span>
                    </div>
                  </Link>
                ))}

                {tournaments.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-400 mb-4">No tournaments in this event yet</p>
                    {isAuthenticated && (
                      <Link
                        href={`/admin/tournaments/new?event_id=${eventId}`}
                        className="btn-touch btn-primary px-6 py-3"
                      >
                        Create First Tournament
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dartboards Tab */}
          {activeTab === 'dartboards' && isDarts && (
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Dartboards</h2>
                <Link
                  href="/admin/dartboards"
                  className="btn-touch btn-secondary px-4 py-2"
                >
                  Manage All Boards
                </Link>
              </div>
              <p className="text-gray-400 mb-4">
                Dartboards are managed globally and shared across all events.
                When starting matches, you can assign them to available boards.
              </p>
              <Link
                href="/admin/dartboards"
                className="btn-touch btn-primary px-6 py-3 inline-block"
              >
                Go to Dartboard Management
              </Link>
            </div>
          )}
        </div>

        {/* Sidebar - Actions */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium mb-4">Quick Actions</h3>

            <div className="space-y-3">
              {event.status === EventStatus.DRAFT && isAuthenticated && (
                <button
                  onClick={() => updateStatus('registration')}
                  disabled={actionLoading}
                  className="btn-touch w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold disabled:opacity-50"
                >
                  Open Registration
                </button>
              )}

              {event.status === EventStatus.REGISTRATION && isAuthenticated && (
                <button
                  onClick={() => updateStatus('active')}
                  disabled={actionLoading}
                  className="btn-touch w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold disabled:opacity-50"
                >
                  Start Event
                </button>
              )}

              {event.status === EventStatus.ACTIVE && isAuthenticated && (
                <button
                  onClick={() => updateStatus('completed')}
                  disabled={actionLoading}
                  className="btn-touch w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold disabled:opacity-50"
                >
                  Complete Event
                </button>
              )}

              {isAuthenticated && (
                <Link
                  href={`/admin/tournaments/new?event_id=${eventId}`}
                  className="btn-touch w-full py-3 bg-orange-600 hover:bg-orange-700 rounded-lg font-bold text-center block"
                >
                  + Add Tournament
                </Link>
              )}

              {isAuthenticated && canAddPlayers && (
                <button
                  onClick={() => setActiveTab('players')}
                  className="btn-touch w-full py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-bold"
                >
                  + Add Players
                </button>
              )}
            </div>
          </div>

          {/* Manage Event */}
          {isAuthenticated && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Manage Event</h3>

              <div className="space-y-3">
                {event.status !== EventStatus.CANCELLED && event.status !== EventStatus.COMPLETED && (
                  <button
                    onClick={() => updateStatus('cancelled')}
                    disabled={actionLoading}
                    className="btn-touch w-full py-3 bg-orange-600 hover:bg-orange-700 rounded-lg font-bold disabled:opacity-50"
                  >
                    Cancel Event
                  </button>
                )}

                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="btn-touch w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold"
                  >
                    Delete Event
                  </button>
                ) : (
                  <div className="bg-red-900 p-4 rounded-lg">
                    <p className="text-white mb-3 text-sm">
                      Delete this event and all associated tournaments? This cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={deleteEvent}
                        disabled={actionLoading}
                        className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded font-bold disabled:opacity-50"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 rounded font-bold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
