'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { MatchWithPlayers, MatchStatus, MatchPlayerInfo, Player, Tournament, Team } from '@shared/types'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { getApiUrl } from '@shared/lib/api-url'

interface Dartboard {
  id: string
  number: number
  name: string | null
  is_available: boolean
}

interface MatchWithDartboard extends MatchWithPlayers {
  dartboard_id?: string | null
}

type FilterTab = 'all' | 'pending' | 'in_progress' | 'completed' | 'disputed'
type SortOption = 'round' | 'board' | 'status'

function MatchesContent() {
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

  // Filter & sort state
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [sortBy, setSortBy] = useState<SortOption>('round')

  // Dispute resolution state
  const [showDisputeModal, setShowDisputeModal] = useState<string | null>(null)
  const [disputeWinner, setDisputeWinner] = useState('')
  const [disputeNote, setDisputeNote] = useState('')
  const [resolvingDispute, setResolvingDispute] = useState(false)

  // Auto-assign state
  const [autoAssigning, setAutoAssigning] = useState(false)

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

      // Fetch match details to get dartboard_id
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

      const playerMap: Record<string, Player> = {}
      playersData.forEach(p => playerMap[p.id] = p)
      setPlayers(playerMap)

      await loadDartboards()

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
      const allResponse = await fetch(`${getApiUrl()}/dartboards`)
      if (allResponse.ok) {
        const all = await allResponse.json()
        setAllDartboards(all)
      }

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
      case MatchStatus.WAITING_FOR_PLAYERS: return 'bg-yellow-600'
      case MatchStatus.IN_PROGRESS: return 'bg-green-500'
      case MatchStatus.COMPLETED: return 'bg-gray-500'
      case MatchStatus.DISPUTED: return 'bg-red-500'
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

  // Filtering
  function getFilteredMatches(): MatchWithDartboard[] {
    let filtered = [...matches]

    switch (activeFilter) {
      case 'pending':
        filtered = filtered.filter(m => m.status === MatchStatus.PENDING || m.status === MatchStatus.WAITING_FOR_PLAYERS)
        break
      case 'in_progress':
        filtered = filtered.filter(m => m.status === MatchStatus.IN_PROGRESS)
        break
      case 'completed':
        filtered = filtered.filter(m => m.status === MatchStatus.COMPLETED)
        break
      case 'disputed':
        filtered = filtered.filter(m => m.status === MatchStatus.DISPUTED)
        break
    }

    // Sorting
    switch (sortBy) {
      case 'round':
        filtered.sort((a, b) => {
          if (a.round_number !== b.round_number) return a.round_number - b.round_number
          return a.match_number - b.match_number
        })
        break
      case 'board':
        filtered.sort((a, b) => {
          const boardA = a.dartboard_id ? allDartboards.find(d => d.id === a.dartboard_id)?.number ?? 999 : 999
          const boardB = b.dartboard_id ? allDartboards.find(d => d.id === b.dartboard_id)?.number ?? 999 : 999
          return boardA - boardB
        })
        break
      case 'status': {
        const statusOrder: Record<string, number> = {
          [MatchStatus.DISPUTED]: 0,
          [MatchStatus.IN_PROGRESS]: 1,
          [MatchStatus.WAITING_FOR_PLAYERS]: 2,
          [MatchStatus.PENDING]: 3,
          [MatchStatus.COMPLETED]: 4,
          [MatchStatus.CANCELLED]: 5,
        }
        filtered.sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99))
        break
      }
    }

    return filtered
  }

  // Filter tab counts
  const filterCounts = {
    all: matches.length,
    pending: matches.filter(m => m.status === MatchStatus.PENDING || m.status === MatchStatus.WAITING_FOR_PLAYERS).length,
    in_progress: matches.filter(m => m.status === MatchStatus.IN_PROGRESS).length,
    completed: matches.filter(m => m.status === MatchStatus.COMPLETED).length,
    disputed: matches.filter(m => m.status === MatchStatus.DISPUTED).length,
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

      setMatches(prev => prev.map(m =>
        m.id === matchId ? { ...m, dartboard_id: dartboardId } : m
      ))

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

      setMatches(prev => prev.map(m =>
        m.id === matchId ? { ...m, dartboard_id: null } : m
      ))

      await loadDartboards()
    } catch (error) {
      console.error('Error releasing board:', error)
      alert(error instanceof Error ? error.message : 'Failed to release board')
    } finally {
      setAssigningBoard(null)
    }
  }

  // Auto-assign boards to pending matches
  async function autoAssignBoards() {
    if (!token || autoAssigning) return

    setAutoAssigning(true)

    try {
      // Get pending/waiting matches sorted by round number
      const pendingMatches = matches
        .filter(m =>
          (m.status === MatchStatus.PENDING || m.status === MatchStatus.WAITING_FOR_PLAYERS || m.status === MatchStatus.IN_PROGRESS) &&
          !m.dartboard_id
        )
        .sort((a, b) => {
          if (a.round_number !== b.round_number) return a.round_number - b.round_number
          return a.match_number - b.match_number
        })

      // Refresh available boards
      const boardsRes = await fetch(`${getApiUrl()}/dartboards/available`)
      let availableBoards: Dartboard[] = []
      if (boardsRes.ok) {
        availableBoards = await boardsRes.json()
      }

      if (availableBoards.length === 0) {
        alert('No boards available to assign')
        return
      }

      let assigned = 0
      for (const match of pendingMatches) {
        if (assigned >= availableBoards.length) break

        // Only assign if the match has players (not TBD)
        const hasPlayers = match.players && match.players.length >= 2
        if (!hasPlayers) continue

        const board = availableBoards[assigned]
        try {
          const response = await fetch(`${getApiUrl()}/dartboards/matches/${match.id}/assign-board/${board.id}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          })

          if (response.ok) {
            assigned++
          }
        } catch {
          // Continue to next match
        }
      }

      // Reload all data
      await loadData()

      if (assigned > 0) {
        alert(`Auto-assigned ${assigned} board${assigned !== 1 ? 's' : ''} to matches`)
      } else {
        alert('No matches available for board assignment')
      }
    } catch (error) {
      console.error('Error auto-assigning boards:', error)
      alert('Failed to auto-assign boards')
    } finally {
      setAutoAssigning(false)
    }
  }

  // Dispute resolution
  async function resolveDispute() {
    if (!showDisputeModal || !disputeWinner || !token) return

    setResolvingDispute(true)

    try {
      // Find the match
      const match = matches.find(m => m.id === showDisputeModal)
      if (!match) throw new Error('Match not found')

      // Determine if this is a team match
      const isTeamMatch = match.players.some(mp => mp.team_id)

      const body: Record<string, unknown> = {
        status: 'completed',
      }

      if (isTeamMatch) {
        body.winner_team_id = disputeWinner
      } else {
        body.winner_id = disputeWinner
      }

      if (disputeNote.trim()) {
        body.dispute_resolution = disputeNote.trim()
      }

      const response = await fetch(`${getApiUrl()}/matches/${showDisputeModal}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to resolve dispute')
      }

      setShowDisputeModal(null)
      setDisputeWinner('')
      setDisputeNote('')

      // Reload data
      await loadData()
    } catch (error) {
      console.error('Error resolving dispute:', error)
      alert(error instanceof Error ? error.message : 'Failed to resolve dispute')
    } finally {
      setResolvingDispute(false)
    }
  }

  function getDisputeParticipants(match: MatchWithDartboard): { id: string; name: string }[] {
    const isTeamMatch = match.players.some(mp => mp.team_id)

    if (isTeamMatch) {
      const teamGroups: Record<string, MatchPlayerInfo[]> = {}
      match.players.forEach(mp => {
        const key = mp.team_id || mp.player_id
        if (!teamGroups[key]) teamGroups[key] = []
        teamGroups[key].push(mp)
      })

      return Object.entries(teamGroups).map(([tid, members]) => ({
        id: tid,
        name: teamMap[tid]?.name || members.map(m => getPlayerName(m.player_id)).join(' & '),
      }))
    }

    return match.players.map(mp => ({
      id: mp.player_id,
      name: getPlayerName(mp.player_id),
    }))
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

  const filteredMatches = getFilteredMatches()

  return (
    <main className="min-h-screen p-6 lg:p-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/" className="btn-touch btn-secondary px-4 py-2">
          &larr; Back
        </Link>
        <h1 className="text-3xl font-bold">
          {tournament?.name || 'Matches'}
        </h1>
      </div>

      {loading ? (
        <p>Loading matches...</p>
      ) : matches.length === 0 ? (
        <p>No matches found for this tournament.</p>
      ) : (
        <>
          {/* Action Bar */}
          {isAuthenticated && (
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <button
                onClick={autoAssignBoards}
                disabled={autoAssigning}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {autoAssigning ? 'Assigning...' : 'Auto-Assign Boards'}
              </button>

              {/* Sort dropdown */}
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm text-gray-400">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="round">By Round</option>
                  <option value="board">By Board</option>
                  <option value="status">By Status</option>
                </select>
              </div>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-1 mb-6 bg-gray-800 rounded-lg p-1">
            {([
              { key: 'all', label: 'All' },
              { key: 'pending', label: 'Pending' },
              { key: 'in_progress', label: 'In Progress' },
              { key: 'completed', label: 'Completed' },
              { key: 'disputed', label: 'Disputed' },
            ] as { key: FilterTab; label: string }[]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeFilter === tab.key
                    ? tab.key === 'disputed'
                      ? 'bg-red-600 text-white'
                      : 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {tab.label}
                {filterCounts[tab.key] > 0 && (
                  <span className="ml-1.5 text-xs opacity-75">({filterCounts[tab.key]})</span>
                )}
              </button>
            ))}
          </div>

          {/* Match Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMatches.map((match) => (
              <div
                key={match.id}
                className={`p-6 bg-gray-800 rounded-lg ${
                  match.status === MatchStatus.DISPUTED ? 'border-2 border-red-500' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="text-sm text-gray-400">
                    {(() => {
                      const bp = match.bracket_position || ''
                      const wrM = bp.match(/^WR(\d+)M(\d+)$/)
                      const lrM = bp.match(/^LR(\d+)M(\d+)$/)
                      if (wrM) return `WB Round ${wrM[1]} - Match ${wrM[2]}`
                      if (lrM) return `LB Round ${lrM[1]} - Match ${lrM[2]}`
                      if (bp === 'GF1') return 'Grand Final'
                      if (bp === 'GF2') return 'Grand Final (Reset)'
                      return `Round ${match.round_number} - Match ${match.match_number}`
                    })()}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs ${getStatusColor(match.status)}`}>
                    {match.status.toUpperCase().replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  {match.players.some(mp => mp.team_id) ? (
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

                {/* Score Button or Dispute Resolution */}
                {match.status === MatchStatus.DISPUTED && isAuthenticated ? (
                  <button
                    onClick={() => {
                      setShowDisputeModal(match.id)
                      setDisputeWinner('')
                      setDisputeNote('')
                    }}
                    className="btn-touch block w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg text-center font-semibold transition-colors"
                  >
                    Resolve Dispute
                  </button>
                ) : match.status !== MatchStatus.COMPLETED && match.status !== MatchStatus.CANCELLED ? (
                  <Link
                    href={`/score/${match.id}`}
                    className="btn-touch block w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg text-center font-semibold transition-colors no-underline text-white"
                  >
                    {match.status === MatchStatus.PENDING ? 'Start Scoring' : 'Continue Scoring'}
                  </Link>
                ) : match.status === MatchStatus.COMPLETED ? (
                  <div className="text-center text-gray-500 py-3">
                    Match Completed
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {filteredMatches.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-400">No matches match the current filter</p>
            </div>
          )}
        </>
      )}

      {/* Dispute Resolution Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Resolve Disputed Match</h2>

            {(() => {
              const match = matches.find(m => m.id === showDisputeModal)
              if (!match) return <p>Match not found</p>

              const participants = getDisputeParticipants(match)

              return (
                <div className="space-y-4">
                  {/* Show player reports */}
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Player Reports</h3>
                    {match.players.map(mp => (
                      <div key={mp.player_id} className="flex justify-between items-center py-1">
                        <span>{getPlayerName(mp.player_id)}</span>
                        <span className={`text-sm ${mp.reported_win === true ? 'text-green-400' : mp.reported_win === false ? 'text-red-400' : 'text-gray-500'}`}>
                          {mp.reported_win === true ? 'Reported Win' : mp.reported_win === false ? 'Reported Loss' : 'No Report'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Select winner */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Select Correct Winner</label>
                    <select
                      value={disputeWinner}
                      onChange={(e) => setDisputeWinner(e.target.value)}
                      className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Choose winner...</option>
                      {participants.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Optional note */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Resolution Note (optional)</label>
                    <textarea
                      value={disputeNote}
                      onChange={(e) => setDisputeNote(e.target.value)}
                      className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                      rows={2}
                      placeholder="Why this player/team is the winner..."
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={resolveDispute}
                      disabled={!disputeWinner || resolvingDispute}
                      className="flex-1 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold disabled:opacity-50"
                    >
                      {resolvingDispute ? 'Resolving...' : 'Confirm Winner'}
                    </button>
                    <button
                      onClick={() => setShowDisputeModal(null)}
                      className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </main>
  )
}

export default function MatchesPage() {
  return (
    <Suspense fallback={<main className="min-h-screen p-8"><p>Loading matches...</p></main>}>
      <MatchesContent />
    </Suspense>
  )
}
