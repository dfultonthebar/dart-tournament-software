'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { MatchWithPlayers, MatchStatus, MatchPlayerInfo, Player, Tournament, Team } from '@shared/types'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

// Helper to get API base URL
const getApiUrl = () => typeof window !== 'undefined' ? `http://${window.location.hostname}:8000/api` : 'http://localhost:8000/api'

interface Dartboard {
  id: string
  number: number
  name: string | null
  is_available: boolean
}

// Extended match type with dartboard info
interface MatchWithDartboard extends MatchWithPlayers {
  dartboard_id?: string | null
}

export default function MatchesPage() {
  const searchParams = useSearchParams()
  const tournamentId = searchParams.get('tournament')
  const { token, isAuthenticated } = useAuth()

  const [matches, setMatches] = useState<MatchWithDartboard[]>([])
  const [players, setPlayers] = useState<Record<string, Player>>({})
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [dartboards, setDartboards] = useState<Dartboard[]>([])
  const [allDartboards, setAllDartboards] = useState<Dartboard[]>([])
  const [teamMap, setTeamMap] = useState<Record<string, Team>>({})
  const [loading, setLoading] = useState(true)
  const [assigningBoard, setAssigningBoard] = useState<string | null>(null)

  useEffect(() => {
    if (tournamentId) {
      loadData()
    }
  }, [tournamentId])

  async function loadData() {
    try {
      const [matchesData, playersData, tournamentData] = await Promise.all([
        api.getMatches(tournamentId!),
        api.getPlayers(),
        api.getTournament(tournamentId!)
      ])

      // Fetch match details to get dartboard_id (if not in the default response)
      const matchDetails = await Promise.all(
        matchesData.map(match =>
          fetch(`${getApiUrl()}/matches/${match.id}`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        )
      )

      const matchesWithBoards: MatchWithDartboard[] = matchesData.map((match, i) => ({
        ...match,
        dartboard_id: matchDetails[i]?.dartboard_id ?? match.dartboard_id
      }))

      setMatches(matchesWithBoards)
      setTournament(tournamentData)

      // Create a lookup map for players
      const playerMap: Record<string, Player> = {}
      playersData.forEach(p => playerMap[p.id] = p)
      setPlayers(playerMap)

      // Load dartboards
      await loadDartboards()

      // Load teams for this tournament (doubles support)
      try {
        const teamsRes = await fetch(`${getApiUrl()}/tournaments/${tournamentId}/teams`)
        if (teamsRes.ok) {
          const teamsData: Team[] = await teamsRes.json()
          const tMap: Record<string, Team> = {}
          teamsData.forEach(t => { tMap[t.id] = t })
          setTeamMap(tMap)
        }
      } catch { /* ignore */ }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadDartboards() {
    try {
      // Load all dartboards
      const allResponse = await fetch(`${getApiUrl()}/dartboards`)
      if (allResponse.ok) {
        const all = await allResponse.json()
        setAllDartboards(all)
      }

      // Load available dartboards
      const response = await fetch(`${getApiUrl()}/dartboards/available`)
      if (response.ok) {
        const available = await response.json()
        setDartboards(available)
      }
    } catch (error) {
      console.error('Error loading dartboards:', error)
    }
  }

  function getPlayerName(playerId: string): string {
    return players[playerId]?.name || 'Unknown Player'
  }

  function getStatusColor(status: MatchStatus): string {
    switch (status) {
      case MatchStatus.PENDING: return 'bg-yellow-500'
      case MatchStatus.IN_PROGRESS: return 'bg-green-500'
      case MatchStatus.COMPLETED: return 'bg-gray-500'
      case MatchStatus.CANCELLED: return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  function getDartboardName(dartboardId: string | null | undefined): string {
    if (!dartboardId) return 'No Board'
    const board = allDartboards.find(d => d.id === dartboardId)
    if (!board) return 'Unknown Board'
    return board.name ? `Board ${board.number} (${board.name})` : `Board ${board.number}`
  }

  async function assignBoard(matchId: string, dartboardId: string) {
    if (!token) return

    setAssigningBoard(matchId)

    try {
      const response = await fetch(`${getApiUrl()}/dartboards/matches/${matchId}/assign-board/${dartboardId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to assign board')
      }

      // Update local state
      setMatches(prev => prev.map(m =>
        m.id === matchId ? { ...m, dartboard_id: dartboardId } : m
      ))

      // Refresh dartboards
      await loadDartboards()
    } catch (error) {
      console.error('Error assigning board:', error)
      alert(error instanceof Error ? error.message : 'Failed to assign board')
    } finally {
      setAssigningBoard(null)
    }
  }

  async function releaseBoard(matchId: string) {
    if (!token) return

    setAssigningBoard(matchId)

    try {
      const response = await fetch(`${getApiUrl()}/dartboards/matches/${matchId}/release-board`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to release board')
      }

      // Update local state
      setMatches(prev => prev.map(m =>
        m.id === matchId ? { ...m, dartboard_id: null } : m
      ))

      // Refresh dartboards
      await loadDartboards()
    } catch (error) {
      console.error('Error releasing board:', error)
      alert(error instanceof Error ? error.message : 'Failed to release board')
    } finally {
      setAssigningBoard(null)
    }
  }

  if (!tournamentId) {
    return (
      <main className="min-h-screen p-8">
        <h1 className="text-4xl font-bold mb-8">No Tournament Selected</h1>
        <Link href="/" className="btn-touch btn-secondary">
          Back to Tournaments
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/" className="btn-touch btn-secondary px-4 py-2">
          &larr; Back
        </Link>
        <h1 className="text-4xl font-bold">
          {tournament?.name || 'Matches'}
        </h1>
      </div>

      {loading ? (
        <p>Loading matches...</p>
      ) : matches.length === 0 ? (
        <p>No matches found for this tournament.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matches.map((match) => (
            <div
              key={match.id}
              className="p-6 bg-gray-800 rounded-lg"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="text-sm text-gray-400">
                  Round {match.round_number} - Match {match.match_number}
                </span>
                <span className={`px-2 py-1 rounded text-xs ${getStatusColor(match.status)}`}>
                  {match.status.toUpperCase()}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                {match.players.some(mp => mp.team_id) ? (
                  // Team-based rendering
                  (() => {
                    const teamGroups: Record<string, MatchPlayerInfo[]> = {}
                    match.players.forEach(mp => {
                      const key = mp.team_id || mp.player_id
                      if (!teamGroups[key]) teamGroups[key] = []
                      teamGroups[key].push(mp)
                    })
                    return Object.entries(teamGroups)
                      .sort((a, b) => (a[1][0]?.position ?? 0) - (b[1][0]?.position ?? 0))
                      .map(([tid, members]) => (
                        <div key={tid} className="flex justify-between items-center">
                          <span className="font-bold text-lg">
                            {teamMap[tid]?.name || members.map(m => getPlayerName(m.player_id)).join(' & ')}
                          </span>
                          <span className="text-gray-400">
                            {members[0]?.legs_won ?? 0} legs
                          </span>
                        </div>
                      ))
                  })()
                ) : (
                  match.players.map((mp) => (
                    <div key={mp.player_id} className="flex justify-between items-center">
                      <span className="font-bold text-lg">
                        {getPlayerName(mp.player_id)}
                      </span>
                      <span className="text-gray-400">
                        {mp.legs_won} legs
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Board Assignment Section */}
              <div className="border-t border-gray-700 pt-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${match.dartboard_id ? 'bg-teal-500' : 'bg-gray-500'}`}></span>
                    <span className="text-sm text-gray-400">
                      {getDartboardName(match.dartboard_id)}
                    </span>
                  </div>

                  {isAuthenticated && match.status !== MatchStatus.COMPLETED && match.status !== MatchStatus.CANCELLED && (
                    <div className="flex items-center gap-2">
                      {match.dartboard_id ? (
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            releaseBoard(match.id)
                          }}
                          disabled={assigningBoard === match.id}
                          className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs disabled:opacity-50"
                        >
                          {assigningBoard === match.id ? 'Releasing...' : 'Release'}
                        </button>
                      ) : dartboards.length > 0 ? (
                        <select
                          onChange={(e) => {
                            e.preventDefault()
                            if (e.target.value) {
                              assignBoard(match.id, e.target.value)
                            }
                          }}
                          disabled={assigningBoard === match.id}
                          className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-sm focus:border-teal-500 focus:outline-none disabled:opacity-50"
                          value=""
                        >
                          <option value="">Assign Board</option>
                          {dartboards.map((board) => (
                            <option key={board.id} value={board.id}>
                              Board {board.number}{board.name ? ` (${board.name})` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-gray-500">No boards available</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Score Button */}
              {match.status !== MatchStatus.COMPLETED && match.status !== MatchStatus.CANCELLED && (
                <Link
                  href={`/score/${match.id}`}
                  className="btn-touch block w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg text-center font-semibold transition-colors"
                >
                  {match.status === MatchStatus.PENDING ? 'Start Scoring' : 'Continue Scoring'}
                </Link>
              )}

              {match.status === MatchStatus.COMPLETED && (
                <div className="text-center text-gray-500 py-3">
                  Match Completed
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
