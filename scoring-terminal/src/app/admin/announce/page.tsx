'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'

const getApiUrl = () => typeof window !== 'undefined' ? `http://${window.location.hostname}:8000/api` : 'http://localhost:8000/api'

interface MatchPlayerInfo {
  player_id: string
  position: number
  sets_won: number
  legs_won: number
  arrived_at_board?: string | null
  reported_win?: boolean | null
  team_id?: string
  team_position?: number
}

interface MatchWithPlayers {
  id: string
  tournament_id: string
  round_number: number
  match_number: number
  bracket_position?: string
  status: string
  started_at?: string
  completed_at?: string
  winner_id?: string
  winner_team_id?: string
  dartboard_id?: string | null
  created_at: string
  updated_at: string
  players: MatchPlayerInfo[]
}

interface Team {
  id: string
  name: string
  tournament_id: string
  player1_id: string
  player2_id: string
  player1_name?: string
  player2_name?: string
}

interface Player {
  id: string
  name: string
}

interface Dartboard {
  id: string
  number: number
  name?: string | null
  is_available: boolean
}

interface Tournament {
  id: string
  name: string
}

export default function AnnouncerBoardPage() {
  const [matches, setMatches] = useState<MatchWithPlayers[]>([])
  const [playerMap, setPlayerMap] = useState<Record<string, Player>>({})
  const [dartboardMap, setDartboardMap] = useState<Record<string, Dartboard>>({})
  const [tournamentMap, setTournamentMap] = useState<Record<string, Tournament>>({})
  const [teamMap, setTeamMap] = useState<Record<string, Team>>({})
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [])

  async function loadData() {
    try {
      const [matchesRes, playersRes, dartboardsRes, tournamentsRes] = await Promise.all([
        fetch(`${getApiUrl()}/matches?limit=500`),
        fetch(`${getApiUrl()}/players?limit=500`),
        fetch(`${getApiUrl()}/dartboards`),
        fetch(`${getApiUrl()}/tournaments`),
      ])

      const matchesData: MatchWithPlayers[] = await matchesRes.json()
      const playersData: Player[] = await playersRes.json()
      const dartboardsData: Dartboard[] = await dartboardsRes.json()
      const tournamentsData: Tournament[] = await tournamentsRes.json()

      setMatches(matchesData)

      const pMap: Record<string, Player> = {}
      playersData.forEach(p => { pMap[p.id] = p })
      setPlayerMap(pMap)

      const dMap: Record<string, Dartboard> = {}
      dartboardsData.forEach(d => { dMap[d.id] = d })
      setDartboardMap(dMap)

      const tMap: Record<string, Tournament> = {}
      tournamentsData.forEach(t => { tMap[t.id] = t })
      setTournamentMap(tMap)

      // Load teams for all active tournaments (for doubles support)
      const allTeams: Record<string, Team> = {}
      for (const t of tournamentsData) {
        try {
          const teamsRes = await fetch(`${getApiUrl()}/tournaments/${t.id}/teams`)
          if (teamsRes.ok) {
            const teamsData: Team[] = await teamsRes.json()
            teamsData.forEach(team => { allTeams[team.id] = team })
          }
        } catch { /* ignore */ }
      }
      setTeamMap(allTeams)

      setLastUpdated(new Date())
    } catch (error) {
      console.error('Error loading announcer data:', error)
    } finally {
      setLoading(false)
    }
  }

  function getPlayerName(playerId: string): string {
    return playerMap[playerId]?.name || 'TBD'
  }

  function getMatchDisplayEntries(match: MatchWithPlayers): { id: string; name: string; isTeam: boolean; arrived: boolean; reported: boolean }[] {
    const isDoubles = match.players.some(mp => mp.team_id)
    if (!isDoubles) {
      return match.players
        .sort((a, b) => a.position - b.position)
        .map(mp => ({
          id: mp.player_id,
          name: getPlayerName(mp.player_id),
          isTeam: false,
          arrived: !!mp.arrived_at_board,
          reported: mp.reported_win !== null && mp.reported_win !== undefined,
        }))
    }
    // Group by team
    const teamGroups: Record<string, MatchPlayerInfo[]> = {}
    match.players.forEach(mp => {
      const key = mp.team_id || mp.player_id
      if (!teamGroups[key]) teamGroups[key] = []
      teamGroups[key].push(mp)
    })
    return Object.entries(teamGroups)
      .sort((a, b) => (a[1][0]?.position ?? 0) - (b[1][0]?.position ?? 0))
      .map(([tid, members]) => ({
        id: tid,
        name: teamMap[tid]?.name || members.map(m => getPlayerName(m.player_id)).join(' & '),
        isTeam: true,
        arrived: members.every(mp => !!mp.arrived_at_board),
        reported: members.some(mp => mp.reported_win !== null && mp.reported_win !== undefined),
      }))
  }

  function getBoardLabel(dartboardId: string): string {
    const board = dartboardMap[dartboardId]
    if (!board) return 'Board ?'
    return board.name || `Board ${board.number}`
  }

  function getBoardNumber(dartboardId: string | null | undefined): number {
    if (!dartboardId) return 999
    return dartboardMap[dartboardId]?.number ?? 999
  }

  function getTournamentName(tournamentId: string): string {
    return tournamentMap[tournamentId]?.name || ''
  }

  // Derive the three sections
  const disputed = useMemo(() =>
    matches
      .filter(m => m.status === 'disputed')
      .sort((a, b) => getBoardNumber(a.dartboard_id) - getBoardNumber(b.dartboard_id)),
    [matches, dartboardMap]
  )

  const onDeck = useMemo(() =>
    matches
      .filter(m =>
        m.dartboard_id &&
        (m.status === 'pending' || m.status === 'waiting_for_players')
      )
      .sort((a, b) => getBoardNumber(a.dartboard_id) - getBoardNumber(b.dartboard_id)),
    [matches, dartboardMap]
  )

  const inProgress = useMemo(() =>
    matches
      .filter(m => m.status === 'in_progress')
      .sort((a, b) => getBoardNumber(a.dartboard_id) - getBoardNumber(b.dartboard_id)),
    [matches, dartboardMap]
  )

  const hasContent = disputed.length > 0 || onDeck.length > 0 || inProgress.length > 0

  if (loading) {
    return <main className="min-h-screen p-8"><p>Loading announcer board...</p></main>
  }

  return (
    <main className="min-h-screen p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/admin/darts" className="btn-touch btn-secondary px-4 py-2">
            &larr; Dashboard
          </Link>
          <h1 className="text-4xl font-bold">Announcer Board</h1>
          <span className="flex items-center gap-2 text-green-400 text-sm font-medium">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            Live
          </span>
        </div>
        {lastUpdated && (
          <div className="text-gray-500 text-sm">
            Updated {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>

      {!hasContent && (
        <div className="text-center py-24">
          <p className="text-2xl text-gray-400">No active matches right now</p>
          <p className="text-gray-500 mt-2">Matches will appear here when boards are assigned or games begin.</p>
        </div>
      )}

      {/* Section 1: Needs Attention (Disputed) */}
      {disputed.length > 0 && (
        <section className="mb-10">
          <div className="bg-red-900/40 border border-red-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-red-400 mb-4 flex items-center gap-3">
              <span className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
              </span>
              Needs Attention
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {disputed.map(match => (
                <div key={match.id} className="bg-red-950/60 border border-red-800 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl font-bold text-red-400">
                      {match.dartboard_id ? getBoardLabel(match.dartboard_id) : 'No Board'}
                    </span>
                    <span className="px-3 py-1 rounded bg-red-600 text-white text-sm font-bold">
                      DISPUTED
                    </span>
                  </div>
                  <div className="space-y-1">
                    {getMatchDisplayEntries(match).map(entry => (
                      <div key={entry.id} className="text-xl text-white">
                        {entry.name}
                      </div>
                    ))}
                  </div>
                  {getTournamentName(match.tournament_id) && (
                    <div className="text-sm text-red-300/70 mt-2">
                      {getTournamentName(match.tournament_id)} &bull; Round {match.round_number}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Section 2: On Deck */}
      {onDeck.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-yellow-400 mb-4">
            On Deck &mdash; Report to Your Board
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {onDeck.map(match => (
              <div key={match.id} className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-4xl font-bold text-yellow-400">
                    {match.dartboard_id ? getBoardLabel(match.dartboard_id) : 'No Board'}
                  </span>
                </div>
                <div className="space-y-2">
                  {getMatchDisplayEntries(match).map(entry => (
                    <div key={entry.id} className="flex items-center gap-3">
                      <span className="text-2xl text-white">
                        {entry.name}
                      </span>
                      {entry.arrived ? (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-600 text-white">
                          ARRIVED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-600 text-white animate-pulse">
                          WAITING
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {getTournamentName(match.tournament_id) && (
                  <div className="text-sm text-gray-400 mt-3">
                    {getTournamentName(match.tournament_id)} &bull; Round {match.round_number}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 3: In Progress */}
      {inProgress.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-green-400 mb-4">
            In Progress
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inProgress.map(match => (
              <div key={match.id} className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl font-bold text-green-400">
                    {match.dartboard_id ? getBoardLabel(match.dartboard_id) : 'No Board'}
                  </span>
                  <span className="px-2 py-1 rounded text-xs font-bold bg-green-700 text-white">
                    PLAYING
                  </span>
                </div>
                <div className="space-y-2">
                  {getMatchDisplayEntries(match).map(entry => (
                    <div key={entry.id} className="flex items-center gap-3">
                      <span className="text-xl text-white">
                        {entry.name}
                      </span>
                      {entry.reported && (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-600 text-white">
                          REPORTED
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {getTournamentName(match.tournament_id) && (
                  <div className="text-sm text-gray-400 mt-3">
                    {getTournamentName(match.tournament_id)} &bull; Round {match.round_number}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
