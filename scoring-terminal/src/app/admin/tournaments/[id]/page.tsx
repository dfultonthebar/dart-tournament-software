'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Tournament, Player, TournamentStatus, TournamentFormat, Team, Event } from '@shared/types'
import { useAuth } from '@/contexts/AuthContext'

// Helper to get API base URL
const getApiUrl = () => typeof window !== 'undefined' ? `http://${window.location.hostname}:8000/api` : 'http://localhost:8000/api'

interface TournamentEntry {
  id: string
  tournament_id: string
  player_id: string
  seed: number | null
  checked_in: string | null
  paid: boolean
  created_at: string
}

export default function TournamentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { token, isAuthenticated } = useAuth()
  const tournamentId = params.id as string

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [event, setEvent] = useState<Event | null>(null)
  const [entries, setEntries] = useState<TournamentEntry[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    loadData()
  }, [tournamentId])

  async function loadData() {
    try {
      const [tournamentRes, entriesRes, teamsRes, playersRes] = await Promise.all([
        fetch(`${getApiUrl()}/tournaments/${tournamentId}`),
        fetch(`${getApiUrl()}/tournaments/${tournamentId}/entries`),
        fetch(`${getApiUrl()}/tournaments/${tournamentId}/teams`),
        fetch(`${getApiUrl()}/players`),
      ])

      const tournamentData = await tournamentRes.json()
      const entriesData = await entriesRes.json()
      const teamsData = await teamsRes.json()
      const playersData = await playersRes.json()

      setTournament(tournamentData)
      setEntries(entriesData)
      setTeams(teamsData)
      setAllPlayers(playersData)

      // Load the event if tournament has event_id
      if (tournamentData.event_id) {
        const eventRes = await fetch(`${getApiUrl()}/events/${tournamentData.event_id}`)
        if (eventRes.ok) {
          const eventData = await eventRes.json()
          setEvent(eventData)
        }
      }
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Failed to load tournament data')
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
    // Filter out admin accounts and already entered players
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
      // Use the new endpoint that accepts player_id
      const response = await fetch(`${getApiUrl()}/tournaments/${tournamentId}/entries/${selectedPlayer}`, {
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

  async function togglePaidStatus(entryId: string, currentPaid: boolean) {
    if (!token) {
      setError('Please login to update payment status')
      return
    }

    try {
      const response = await fetch(`${getApiUrl()}/tournaments/${tournamentId}/entries/${entryId}`, {
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

  async function startTournament() {
    if (entries.length < 2) {
      setError('Need at least 2 players to start')
      return
    }

    if (!token) {
      setError('Please login to start tournament')
      return
    }

    setActionLoading(true)
    setError('')

    try {
      // Auto-check-in all paid entries that aren't checked in yet
      const uncheckedPaid = entries.filter(e => e.paid && !e.checked_in)
      for (const entry of uncheckedPaid) {
        const checkInResp = await fetch(`${getApiUrl()}/tournaments/${tournamentId}/entries/${entry.id}/check-in`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        if (!checkInResp.ok) {
          const data = await checkInResp.json()
          console.warn(`Check-in warning for entry ${entry.id}:`, data.detail)
        }
      }

      // Generate bracket (starts the tournament)
      const response = await fetch(`${getApiUrl()}/tournaments/${tournamentId}/generate-bracket`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to start tournament')
      }

      loadData()
    } catch (err: any) {
      setError(err.message || 'Failed to start tournament')
    } finally {
      setActionLoading(false)
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
      const response = await fetch(`${getApiUrl()}/tournaments/${tournamentId}`, {
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

  async function deleteTournament() {
    if (!token) {
      setError('Please login to delete tournament')
      return
    }

    setActionLoading(true)
    setError('')

    try {
      const response = await fetch(`${getApiUrl()}/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to delete tournament')
      }

      // Navigate back to event if we have one, otherwise to tournaments list
      router.push(event ? `/admin/events/${event.id}` : '/admin/tournaments')
    } catch (err: any) {
      setError(err.message || 'Failed to delete tournament')
      setShowDeleteConfirm(false)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen p-8">
        <p>Loading tournament...</p>
      </main>
    )
  }

  if (!tournament) {
    return (
      <main className="min-h-screen p-8">
        <p>Tournament not found</p>
        <Link href="/admin" className="btn-touch btn-secondary mt-4">
          Back to Admin
        </Link>
      </main>
    )
  }

  function exportParticipantsToCSV() {
    const headers = ['Name', 'Email', 'Phone', 'Paid']
    const rows = entries.map(entry => {
      const player = allPlayers.find(p => p.id === entry.player_id)
      return [
        player?.name || 'Unknown',
        player?.email || '',
        player?.phone || '',
        entry.paid ? 'Yes' : 'No'
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    const tournamentName = tournament?.name.replace(/[^a-z0-9]/gi, '_') || 'tournament'
    link.setAttribute('href', url)
    link.setAttribute('download', `${tournamentName}_participants_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const availablePlayers = getAvailablePlayers()
  const paidCount = entries.filter(e => e.paid).length
  const allPaid = paidCount === entries.length && entries.length > 0
  const canStart = tournament.status === TournamentStatus.REGISTRATION && entries.length >= 2 && allPaid
  const canAddPlayers = tournament.status === TournamentStatus.DRAFT || tournament.status === TournamentStatus.REGISTRATION
  const isLuckyDraw = tournament.format === TournamentFormat.LUCKY_DRAW_DOUBLES

  const backUrl = event ? `/admin/events/${event.id}` : '/admin/tournaments'

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href={backUrl} className="btn-touch btn-secondary px-4 py-2">
          &larr; Back
        </Link>
        <div>
          <h1 className="text-4xl font-bold">{tournament.name}</h1>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {event && (
              <>
                <Link href={`/admin/events/${event.id}`} className="text-blue-400 hover:underline">
                  {event.name}
                </Link>
                <span className="text-gray-400">|</span>
              </>
            )}
            <span className="text-gray-400">{tournament.game_type.toUpperCase()}</span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-400">{tournament.format === 'lucky_draw_doubles' ? 'Lucky Draw Doubles' : tournament.format.replace('_', ' ')}</span>
            <span className="text-gray-400">|</span>
            <span className={`px-2 py-1 rounded text-xs ${
              tournament.status === TournamentStatus.IN_PROGRESS ? 'bg-green-600' :
              tournament.status === TournamentStatus.REGISTRATION ? 'bg-blue-600' :
              tournament.status === TournamentStatus.DRAFT ? 'bg-yellow-600' :
              'bg-gray-600'
            }`}>
              {tournament.status.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {!isAuthenticated && (
        <div className="bg-yellow-600 text-white p-4 rounded-lg mb-6">
          <Link href="/admin/login" className="underline font-bold">Login</Link> to manage this tournament.
        </div>
      )}

      {error && (
        <div className="bg-red-600 text-white p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Lucky Draw Teams Section */}
      {isLuckyDraw && (
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Lucky Draw Teams ({teams.length})</h2>
            {canAddPlayers && isAuthenticated && (
              <Link
                href={`/admin/tournaments/${tournamentId}/lucky-draw`}
                className="btn-touch btn-primary px-4 py-2"
              >
                {teams.length > 0 ? 'Manage Teams' : 'Generate Teams'}
              </Link>
            )}
          </div>

          {teams.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team, index) => (
                <div key={team.id} className="p-4 bg-gray-700 rounded-lg">
                  <div className="text-sm text-blue-400 font-medium mb-1">Team {index + 1}</div>
                  <div className="text-lg">
                    {team.player1_name || getPlayerName(team.player1_id)}
                    <span className="text-gray-400 mx-2">&</span>
                    {team.player2_name || getPlayerName(team.player2_id)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-400 mb-4">No teams generated yet</p>
              {entries.length >= 2 && entries.length % 2 === 0 ? (
                <p className="text-sm text-green-400">
                  {entries.length} players registered - ready to generate {entries.length / 2} teams
                </p>
              ) : entries.length >= 2 && entries.length % 2 !== 0 ? (
                <p className="text-sm text-orange-400">
                  {entries.length} players registered - need an even number to generate teams
                </p>
              ) : (
                <p className="text-sm text-yellow-400">
                  Add at least 2 players to generate teams
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Players Section */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">
              Players ({entries.length}{tournament.max_players ? `/${tournament.max_players}` : ''})
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
                className="btn-touch btn-primary px-4 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          )}

          <div className="space-y-2">
            {entries.map((entry, index) => (
              <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-700 rounded">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400">#{index + 1}</span>
                  <span>{getPlayerName(entry.player_id)}</span>
                </div>
                <div className="flex items-center gap-3">
                  {entry.seed && (
                    <span className="text-sm text-gray-400">Seed: {entry.seed}</span>
                  )}
                  {canAddPlayers && isAuthenticated && (
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
              <p className="text-gray-400 text-center py-4">No players added yet</p>
            )}
          </div>
        </div>

        {/* Actions Section */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Tournament Actions</h2>

          <div className="space-y-4">
            {tournament.status === TournamentStatus.DRAFT && isAuthenticated && (
              <button
                onClick={() => updateStatus('registration')}
                disabled={actionLoading}
                className="btn-touch w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold disabled:opacity-50"
              >
                Open Registration
              </button>
            )}

            {tournament.status === TournamentStatus.REGISTRATION && entries.length >= 2 && isAuthenticated && (
              <div className="space-y-2">
                <button
                  onClick={startTournament}
                  disabled={actionLoading || !allPaid}
                  className={`btn-touch w-full py-4 rounded-lg font-bold disabled:opacity-50 ${
                    allPaid ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600'
                  }`}
                >
                  Start Tournament ({entries.length} players)
                </button>
                <div className={`text-sm text-center ${allPaid ? 'text-green-400' : 'text-yellow-400'}`}>
                  {allPaid
                    ? 'All players have paid - ready to start!'
                    : `Payment: ${paidCount}/${entries.length} players paid`}
                </div>
              </div>
            )}

            {tournament.status === TournamentStatus.IN_PROGRESS && (
              <Link
                href={`/matches?tournament=${tournament.id}`}
                className="btn-touch block w-full py-4 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-center"
              >
                Go to Scoring
              </Link>
            )}

            <div className="pt-4 border-t border-gray-700">
              <h3 className="text-lg font-medium mb-2">Tournament Settings</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-400">Legs to win:</div>
                <div>{tournament.legs_to_win}</div>
                <div className="text-gray-400">Sets to win:</div>
                <div>{tournament.sets_to_win}</div>
                <div className="text-gray-400">Double In:</div>
                <div>{tournament.double_in ? 'Yes' : 'No'}</div>
                <div className="text-gray-400">Double Out:</div>
                <div>{tournament.double_out ? 'Yes' : 'No'}</div>
              </div>
            </div>

            {/* Archive/Complete & Delete Section */}
            {isAuthenticated && (
              <div className="pt-4 border-t border-gray-700 space-y-3">
                <h3 className="text-lg font-medium mb-2">Manage Tournament</h3>

                {tournament.status === TournamentStatus.IN_PROGRESS && (
                  <button
                    onClick={() => updateStatus('completed')}
                    disabled={actionLoading}
                    className="btn-touch w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold disabled:opacity-50"
                  >
                    Complete / Archive Tournament
                  </button>
                )}

                {tournament.status !== TournamentStatus.CANCELLED && tournament.status !== TournamentStatus.COMPLETED && (
                  <button
                    onClick={() => updateStatus('cancelled')}
                    disabled={actionLoading}
                    className="btn-touch w-full py-3 bg-orange-600 hover:bg-orange-700 rounded-lg font-bold disabled:opacity-50"
                  >
                    Cancel Tournament
                  </button>
                )}

                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="btn-touch w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold"
                  >
                    Delete Tournament
                  </button>
                ) : (
                  <div className="bg-red-900 p-4 rounded-lg">
                    <p className="text-white mb-3">Are you sure you want to delete this tournament? This cannot be undone.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={deleteTournament}
                        disabled={actionLoading}
                        className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded font-bold disabled:opacity-50"
                      >
                        Yes, Delete
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
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
