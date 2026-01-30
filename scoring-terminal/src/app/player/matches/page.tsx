'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const getApiUrl = () => typeof window !== 'undefined' ? `http://${window.location.hostname}:8000/api` : 'http://localhost:8000/api'

interface MatchPlayer {
  player_id: string
  position: number
  sets_won: number
  legs_won: number
  arrived_at_board: string | null
  reported_win: boolean | null
}

interface Match {
  id: string
  tournament_id: string
  round_number: number
  match_number: number
  status: string
  started_at: string | null
  completed_at: string | null
  winner_id: string | null
  dartboard_id: string | null
  players: MatchPlayer[]
}

interface Tournament {
  id: string
  name: string
  game_type: string
}

interface Dartboard {
  id: string
  name: string
}

interface PlayerInfo {
  id: string
  name: string
}

export default function PlayerMatches() {
  const router = useRouter()
  const [matches, setMatches] = useState<Match[]>([])
  const [tournaments, setTournaments] = useState<Record<string, Tournament>>({})
  const [dartboards, setDartboards] = useState<Record<string, Dartboard>>({})
  const [players, setPlayers] = useState<Record<string, PlayerInfo>>({})
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [playerName, setPlayerName] = useState('')

  const loadData = useCallback(async (token: string, myId: string) => {
    try {
      const headers = { Authorization: `Bearer ${token}` }

      // Load my tournament entries to find which tournaments I'm in
      const tournamentsRes = await fetch(`${getApiUrl()}/tournaments`, { headers })
      const tournamentsData = await tournamentsRes.json()

      const tournamentMap: Record<string, Tournament> = {}
      const activeTournaments = tournamentsData.filter(
        (t: Tournament & { status?: string }) => t.status === 'in_progress' || t.status === 'completed'
      )
      activeTournaments.forEach((t: Tournament) => { tournamentMap[t.id] = t })

      const matchResults = await Promise.all(
        activeTournaments.map((t: Tournament) =>
          fetch(`${getApiUrl()}/matches?tournament_id=${t.id}`, { headers })
            .then(r => r.ok ? r.json() : [])
            .catch(() => [])
        )
      )

      const allMatches: Match[] = []
      matchResults.forEach((matchesData: Match[]) => {
        for (const m of matchesData) {
          const isMyMatch = m.players.some((p: MatchPlayer) => p.player_id === myId)
          if (isMyMatch) {
            allMatches.push(m)
          }
        }
      })

      setTournaments(tournamentMap)

      // Sort: active first, then by round
      allMatches.sort((a, b) => {
        const statusOrder: Record<string, number> = {
          waiting_for_players: 0,
          in_progress: 1,
          pending: 2,
          disputed: 3,
          completed: 4,
          cancelled: 5,
        }
        const aOrder = statusOrder[a.status] ?? 99
        const bOrder = statusOrder[b.status] ?? 99
        if (aOrder !== bOrder) return aOrder - bOrder
        return a.round_number - b.round_number
      })

      setMatches(allMatches)

      // Load dartboards
      const boardsRes = await fetch(`${getApiUrl()}/dartboards`, { headers })
      const boardsData = await boardsRes.json()
      const boardMap: Record<string, Dartboard> = {}
      boardsData.forEach((b: Dartboard) => boardMap[b.id] = b)
      setDartboards(boardMap)

      // Collect all player IDs from matches
      const playerIds = new Set<string>()
      allMatches.forEach(m => m.players.forEach(p => playerIds.add(p.player_id)))

      // Load player names
      const playersRes = await fetch(`${getApiUrl()}/players?limit=500`, { headers })
      const playersData = await playersRes.json()
      const playerMap: Record<string, PlayerInfo> = {}
      playersData.forEach((p: PlayerInfo) => playerMap[p.id] = p)
      setPlayers(playerMap)
    } catch (err) {
      console.error('Error loading matches:', err)
      setError('Failed to load matches')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('player_token')
    const name = localStorage.getItem('player_name')

    if (!token) {
      router.push('/player')
      return
    }

    setPlayerName(name || '')

    // Get my player ID
    fetch(`${getApiUrl()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setPlayerId(data.id)
        loadData(token, data.id)
      })
      .catch(() => {
        router.push('/player')
      })
  }, [router, loadData])

  // Auto-refresh every 15 seconds
  useEffect(() => {
    if (!playerId) return
    const interval = setInterval(() => {
      const token = localStorage.getItem('player_token')
      if (token) loadData(token, playerId)
    }, 15000)
    return () => clearInterval(interval)
  }, [playerId, loadData])

  async function handleArrive(matchId: string) {
    const token = localStorage.getItem('player_token')
    if (!token) return

    setActionLoading(matchId)
    setError('')
    setSuccessMsg('')

    try {
      const response = await fetch(`${getApiUrl()}/matches/${matchId}/arrive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to mark arrival')
      }

      setSuccessMsg('Marked as arrived! Waiting for your opponent...')
      // Reload data
      loadData(token, playerId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReportResult(matchId: string, iWon: boolean) {
    const token = localStorage.getItem('player_token')
    if (!token) return

    const label = iWon ? 'won' : 'lost'
    if (!confirm(`Are you sure you want to report that you ${label} this match?`)) return

    setActionLoading(matchId)
    setError('')
    setSuccessMsg('')

    try {
      const response = await fetch(`${getApiUrl()}/matches/${matchId}/report-result?i_won=${iWon}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to report result')
      }

      setSuccessMsg('Result reported! Waiting for your opponent to confirm...')
      loadData(token, playerId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  function getMyMatchPlayer(match: Match): MatchPlayer | undefined {
    return match.players.find(p => p.player_id === playerId)
  }

  function getOpponent(match: Match): MatchPlayer | undefined {
    return match.players.find(p => p.player_id !== playerId)
  }

  function getPlayerName(id: string): string {
    return players[id]?.name || 'TBD'
  }

  function getBoardName(id: string | null): string {
    if (!id) return 'Not assigned'
    return dartboards[id]?.name || 'Board'
  }

  function getStatusBadge(match: Match) {
    const colors: Record<string, string> = {
      pending: 'bg-gray-600',
      waiting_for_players: 'bg-yellow-600',
      in_progress: 'bg-blue-600',
      completed: 'bg-green-600',
      disputed: 'bg-red-600',
      cancelled: 'bg-gray-500',
    }
    const labels: Record<string, string> = {
      pending: 'Upcoming',
      waiting_for_players: 'Go to Board',
      in_progress: 'In Progress',
      completed: 'Completed',
      disputed: 'Disputed',
      cancelled: 'Cancelled',
    }
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[match.status] || 'bg-gray-600'}`}>
        {labels[match.status] || match.status}
      </span>
    )
  }

  if (loading) {
    return (
      <main className="min-h-screen p-6 flex items-center justify-center">
        <p className="text-xl">Loading your matches...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">My Matches</h1>
            <p className="text-gray-400">{playerName}</p>
          </div>
          <Link href="/player" className="text-gray-400 hover:text-white">
            &larr; Back
          </Link>
        </div>

        {error && (
          <div className="bg-red-600 text-white p-4 rounded-lg mb-4">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="bg-green-600 text-white p-4 rounded-lg mb-4">
            {successMsg}
          </div>
        )}

        {matches.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-xl text-gray-400">No active matches</p>
            <p className="text-gray-500 mt-2">Sign up for tournaments to see your matches here.</p>
            <Link href="/player/tournaments" className="inline-block mt-4 px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition">
              Browse Tournaments
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => {
              const me = getMyMatchPlayer(match)
              const opponent = getOpponent(match)
              const tournamentName = tournaments[match.tournament_id]?.name || 'Tournament'
              const isActive = ['pending', 'waiting_for_players', 'in_progress'].includes(match.status)

              return (
                <div
                  key={match.id}
                  className={`bg-gray-800 rounded-lg p-5 border-2 transition ${
                    match.status === 'waiting_for_players' ? 'border-yellow-500' :
                    match.status === 'in_progress' ? 'border-blue-500' :
                    match.status === 'disputed' ? 'border-red-500' :
                    match.status === 'completed' && match.winner_id === playerId ? 'border-green-500' :
                    'border-transparent'
                  }`}
                >
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-sm text-gray-400">{tournamentName}</p>
                      <p className="text-xs text-gray-500">Round {match.round_number} - Match {match.match_number}</p>
                    </div>
                    {getStatusBadge(match)}
                  </div>

                  {/* Board Assignment */}
                  {match.dartboard_id && (
                    <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 mb-3 text-center">
                      <p className="text-sm text-blue-300">Your Board</p>
                      <p className="text-2xl font-bold text-blue-400">{getBoardName(match.dartboard_id)}</p>
                    </div>
                  )}

                  {/* Matchup */}
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="text-center flex-1">
                      <p className="font-bold text-green-400">You</p>
                      <p className="text-sm text-gray-400">{playerName}</p>
                      {me?.arrived_at_board && (
                        <p className="text-xs text-green-500 mt-1">At board</p>
                      )}
                    </div>
                    <div className="text-2xl font-bold text-gray-500">vs</div>
                    <div className="text-center flex-1">
                      <p className="font-bold">{opponent ? getPlayerName(opponent.player_id) : 'TBD'}</p>
                      {opponent?.arrived_at_board && (
                        <p className="text-xs text-green-500 mt-1">At board</p>
                      )}
                    </div>
                  </div>

                  {/* Result for completed matches */}
                  {match.status === 'completed' && (
                    <div className={`text-center py-2 rounded-lg mb-3 ${
                      match.winner_id === playerId ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                    }`}>
                      <p className="font-bold text-lg">
                        {match.winner_id === playerId ? 'You Won!' : 'You Lost'}
                      </p>
                    </div>
                  )}

                  {/* Disputed */}
                  {match.status === 'disputed' && (
                    <div className="bg-red-900/50 text-red-400 p-3 rounded-lg mb-3 text-center">
                      <p className="font-bold">Result Disputed</p>
                      <p className="text-sm">Both players reported conflicting results. Please see the tournament admin.</p>
                    </div>
                  )}

                  {/* Actions */}
                  {isActive && (
                    <div className="space-y-2">
                      {/* Arrive at board button */}
                      {match.dartboard_id && !me?.arrived_at_board && (match.status === 'pending' || match.status === 'waiting_for_players') && (
                        <button
                          onClick={() => handleArrive(match.id)}
                          disabled={actionLoading === match.id}
                          className="w-full py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-bold disabled:opacity-50 transition"
                        >
                          {actionLoading === match.id ? 'Checking in...' : "I'm at the Board"}
                        </button>
                      )}

                      {/* Already arrived, waiting for opponent */}
                      {me?.arrived_at_board && match.status === 'waiting_for_players' && (
                        <div className="py-3 bg-yellow-900/30 text-yellow-400 rounded-lg text-center">
                          Waiting for opponent to arrive...
                        </div>
                      )}

                      {/* Report result buttons */}
                      {match.status === 'in_progress' && me?.reported_win === null && (
                        <div>
                          <p className="text-sm text-gray-400 text-center mb-2">Match finished? Report your result:</p>
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleReportResult(match.id, true)}
                              disabled={actionLoading === match.id}
                              className="flex-1 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold disabled:opacity-50 transition"
                            >
                              I Won
                            </button>
                            <button
                              onClick={() => handleReportResult(match.id, false)}
                              disabled={actionLoading === match.id}
                              className="flex-1 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold disabled:opacity-50 transition"
                            >
                              I Lost
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Already reported, waiting for opponent */}
                      {me?.reported_win !== null && me?.reported_win !== undefined && match.status === 'in_progress' && (
                        <div className="py-3 bg-blue-900/30 text-blue-400 rounded-lg text-center">
                          Result reported. Waiting for opponent to confirm...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-gray-800 rounded-lg p-5">
          <h3 className="font-bold mb-3">How Matches Work</h3>
          <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
            <li>When your match is ready, you&apos;ll see your assigned board number above.</li>
            <li>Go to your board and tap <span className="text-yellow-400 font-medium">&quot;I&apos;m at the Board&quot;</span> to check in.</li>
            <li>The match begins when both players check in.</li>
            <li>After playing, both players report the result by tapping <span className="text-green-400 font-medium">&quot;I Won&quot;</span> or <span className="text-red-400 font-medium">&quot;I Lost&quot;</span>.</li>
            <li>When both players agree, the winner advances automatically.</li>
          </ol>
        </div>
      </div>
    </main>
  )
}
