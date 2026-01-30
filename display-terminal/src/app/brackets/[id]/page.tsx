'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getApiUrl } from '@shared/lib/api-url'

interface Player {
  id: string
  name: string
}

interface MatchPlayer {
  player_id: string
  position: number
  sets_won: number
  legs_won: number
  team_id?: string
  team_position?: number
}

interface Dartboard {
  id: string
  number: number
  name: string
  is_available: boolean
}

interface Match {
  id: string
  tournament_id: string
  round_number: number
  match_number: number
  bracket_position: string | null
  status: string
  winner_id: string | null
  winner_team_id: string | null
  dartboard_id: string | null
  players: MatchPlayer[]
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

interface Tournament {
  id: string
  name: string
  game_type: string
  format: string
  status: string
  legs_to_win: number
  sets_to_win: number
}

export default function BracketPage() {
  const params = useParams()
  const tournamentId = params.id as string

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [players, setPlayers] = useState<Record<string, Player>>({})
  const [dartboards, setDartboards] = useState<Record<string, Dartboard>>({})
  const [teamMap, setTeamMap] = useState<Record<string, Team>>({})
  const [loading, setLoading] = useState(true)
  const [scale, setScale] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const bracketRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [tournamentId])

  // Auto-scale bracket to fit viewport
  const updateScale = useCallback(() => {
    if (!containerRef.current || !bracketRef.current) return
    const container = containerRef.current.getBoundingClientRect()
    const bracket = bracketRef.current
    // Reset scale to measure natural size
    bracket.style.transform = 'scale(1)'
    const natural = bracket.getBoundingClientRect()
    const scaleX = (container.width - 32) / natural.width
    const scaleY = (container.height - 32) / natural.height
    const newScale = Math.min(scaleX, scaleY, 1)
    setScale(Math.max(newScale, 0.2))
  }, [])

  useEffect(() => {
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [updateScale, matches])

  // Re-measure after render with matches
  useEffect(() => {
    const timeout = setTimeout(updateScale, 100)
    return () => clearTimeout(timeout)
  }, [matches, updateScale])

  async function loadData() {
    try {
      const [tournamentRes, matchesRes, playersRes, dartboardsRes, teamsRes] = await Promise.all([
        fetch(`${getApiUrl()}/tournaments/${tournamentId}`),
        fetch(`${getApiUrl()}/matches?tournament_id=${tournamentId}&limit=500`),
        fetch(`${getApiUrl()}/players?limit=500`),
        fetch(`${getApiUrl()}/dartboards`),
        fetch(`${getApiUrl()}/tournaments/${tournamentId}/teams`),
      ])

      if (!tournamentRes.ok || !matchesRes.ok || !playersRes.ok) {
        console.error('Failed to load bracket data')
        setLoading(false)
        return
      }

      const tournamentData = await tournamentRes.json()
      const matchesData = await matchesRes.json()
      const playersData = await playersRes.json()
      const dartboardsData = dartboardsRes.ok ? await dartboardsRes.json() : []
      const teamsData = teamsRes.ok ? await teamsRes.json() : []

      setTournament(tournamentData)
      setMatches(matchesData)

      const playerMap: Record<string, Player> = {}
      playersData.forEach((p: Player) => playerMap[p.id] = p)
      setPlayers(playerMap)

      const dartboardMap: Record<string, Dartboard> = {}
      dartboardsData.forEach((d: Dartboard) => dartboardMap[d.id] = d)
      setDartboards(dartboardMap)

      const tMap: Record<string, Team> = {}
      teamsData.forEach((t: Team) => { tMap[t.id] = t })
      setTeamMap(tMap)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  function getPlayerName(playerId: string): string {
    return players[playerId]?.name || 'TBD'
  }

  function getDartboard(dartboardId: string | null): Dartboard | null {
    if (!dartboardId) return null
    return dartboards[dartboardId] || null
  }

  // Parse bracket_position "R1M3" -> { round: 1, matchInRound: 3 }
  function parseBracketPosition(bp: string | null, fallbackRound: number, fallbackMatch: number) {
    if (!bp) return { round: fallbackRound, matchInRound: fallbackMatch }
    const m = bp.match(/R(\d+)M(\d+)/)
    if (!m) return { round: fallbackRound, matchInRound: fallbackMatch }
    return { round: parseInt(m[1]), matchInRound: parseInt(m[2]) }
  }

  // Detect double elimination: check for WR/LR/GF prefixes
  const isDoubleElim = useMemo(() => {
    return matches.some(m => {
      const bp = m.bracket_position || ''
      return bp.startsWith('WR') || bp.startsWith('LR') || bp.startsWith('GF')
    })
  }, [matches])

  // Double elimination bracket data
  const doubleElimData = useMemo(() => {
    if (!isDoubleElim || matches.length === 0) return null

    // Group WB matches by round
    const wbRounds: Map<number, Match[]> = new Map()
    const lbRounds: Map<number, Match[]> = new Map()
    let gf1: Match | null = null
    let gf2: Match | null = null

    for (const match of matches) {
      const bp = match.bracket_position || ''
      const wrMatch = bp.match(/^WR(\d+)M(\d+)$/)
      const lrMatch = bp.match(/^LR(\d+)M(\d+)$/)

      if (wrMatch) {
        const round = parseInt(wrMatch[1])
        const list = wbRounds.get(round) || []
        list.push(match)
        wbRounds.set(round, list)
      } else if (lrMatch) {
        const round = parseInt(lrMatch[1])
        const list = lbRounds.get(round) || []
        list.push(match)
        lbRounds.set(round, list)
      } else if (bp === 'GF1') {
        gf1 = match
      } else if (bp === 'GF2') {
        gf2 = match
      }
    }

    // Sort each round by match index
    const sortByIndex = (a: Match, b: Match) => {
      const aM = (a.bracket_position || '').match(/M(\d+)/)
      const bM = (b.bracket_position || '').match(/M(\d+)/)
      return (aM ? parseInt(aM[1]) : 0) - (bM ? parseInt(bM[1]) : 0)
    }
    wbRounds.forEach((v, k) => wbRounds.set(k, v.sort(sortByIndex)))
    lbRounds.forEach((v, k) => lbRounds.set(k, v.sort(sortByIndex)))

    const wbRoundNums = Array.from(wbRounds.keys()).sort((a, b) => a - b)
    const lbRoundNums = Array.from(lbRounds.keys()).sort((a, b) => a - b)

    return { wbRounds, lbRounds, gf1, gf2, wbRoundNums, lbRoundNums }
  }, [matches, isDoubleElim])

  // Single elimination bracket data (original logic)
  const bracketData = useMemo(() => {
    if (isDoubleElim || matches.length === 0) return null

    const totalRounds = Math.max(...matches.map(m => m.round_number))

    // Group by round and sort by within-round index
    const rounds: Map<number, Match[]> = new Map()
    for (const match of matches) {
      const list = rounds.get(match.round_number) || []
      list.push(match)
      rounds.set(match.round_number, list)
    }
    // Sort each round by bracket position
    rounds.forEach((roundMatches, round) => {
      rounds.set(round, roundMatches.sort((a, b) => {
        const aPos = parseBracketPosition(a.bracket_position, a.round_number, a.match_number)
        const bPos = parseBracketPosition(b.bracket_position, b.round_number, b.match_number)
        return aPos.matchInRound - bPos.matchInRound
      }))
    })

    // Split each round in half for left/right bracket sides
    const leftRounds: Map<number, Match[]> = new Map()
    const rightRounds: Map<number, Match[]> = new Map()

    for (let r = 1; r <= totalRounds; r++) {
      const roundMatches = rounds.get(r) || []
      if (r === totalRounds) {
        // Finals - center, don't split
        continue
      }
      const half = Math.ceil(roundMatches.length / 2)
      leftRounds.set(r, roundMatches.slice(0, half))
      rightRounds.set(r, roundMatches.slice(half))
    }

    const finals = rounds.get(totalRounds)?.[0] || null

    return { totalRounds, leftRounds, rightRounds, finals, rounds }
  }, [matches, isDoubleElim])

  function getRoundName(round: number, totalRounds: number): string {
    const remaining = totalRounds - round + 1
    if (remaining === 1) return 'Final'
    if (remaining === 2) return 'Semis'
    if (remaining === 3) return 'Quarters'
    return `R${round}`
  }

  function getWBRoundName(round: number, totalWBRounds: number): string {
    if (round === totalWBRounds) return 'WB Final'
    if (round === totalWBRounds - 1) return 'WB Semis'
    return `WB R${round}`
  }

  function getLBRoundName(round: number, totalLBRounds: number): string {
    if (round === totalLBRounds) return 'LB Final'
    return `LB R${round}`
  }

  // Determine if a match is a bye (completed with 0 or 1 players)
  function isBye(match: Match): boolean {
    return match.status === 'completed' && match.players.length <= 1
  }

  function renderMatch(match: Match, isFinal: boolean = false) {
    const dartboard = getDartboard(match.dartboard_id)
    const bye = isBye(match)
    const isDoubles = match.players.some(mp => mp.team_id)

    return (
      <div
        key={match.id}
        className={`bk-match ${match.status} ${isFinal ? 'finals' : ''} ${bye ? 'bye' : ''}`}
      >
        {match.status === 'in_progress' && (
          <div className="bk-badge-left">
            <span className="live-badge">LIVE</span>
          </div>
        )}
        {dartboard && (
          <div className="bk-badge-right">
            <span className="board-badge">B{dartboard.number}</span>
          </div>
        )}
        {bye ? (
          <div className="bk-bye-label">BYE</div>
        ) : match.players.length === 0 ? (
          <>
            <div className="bk-player tbd"><span className="bk-name">TBD</span></div>
            <div className="bk-divider" />
            <div className="bk-player tbd"><span className="bk-name">TBD</span></div>
          </>
        ) : isDoubles ? (
          // Team-based rendering: group by team_id
          (() => {
            const teamGroups: Record<string, MatchPlayer[]> = {}
            match.players.forEach(mp => {
              const key = mp.team_id || mp.player_id
              if (!teamGroups[key]) teamGroups[key] = []
              teamGroups[key].push(mp)
            })
            const teams = Object.entries(teamGroups).sort(
              (a, b) => (a[1][0]?.position ?? 0) - (b[1][0]?.position ?? 0)
            )
            return teams.map(([tid, members], i) => (
              <div key={tid}>
                {i > 0 && <div className="bk-divider" />}
                <div
                  className={`bk-player ${
                    match.winner_team_id === tid ? 'winner' :
                    match.winner_team_id && match.winner_team_id !== tid ? 'loser' : ''
                  }`}
                >
                  <span className="bk-name">{teamMap[tid]?.name || members.map(m => getPlayerName(m.player_id)).join(' & ')}</span>
                  <span className="bk-score">{members[0]?.legs_won ?? 0}</span>
                </div>
              </div>
            ))
          })()
        ) : (
          match.players
            .sort((a, b) => a.position - b.position)
            .map((mp, i) => (
              <div key={mp.player_id}>
                {i > 0 && <div className="bk-divider" />}
                <div
                  className={`bk-player ${
                    match.winner_id === mp.player_id ? 'winner' :
                    match.winner_id && match.winner_id !== mp.player_id ? 'loser' : ''
                  }`}
                >
                  <span className="bk-name">{getPlayerName(mp.player_id)}</span>
                  <span className="bk-score">{mp.legs_won}</span>
                </div>
              </div>
            ))
        )}
      </div>
    )
  }

  function renderRoundColumn(roundNum: number, roundMatches: Match[], totalRounds: number, side: 'left' | 'right') {
    return (
      <div key={`${side}-${roundNum}`} className="bk-round" data-round={roundNum}>
        <div className="bk-round-header">{getRoundName(roundNum, totalRounds)}</div>
        <div className="bk-round-matches" style={{ gap: `${Math.pow(2, roundNum - 1) * 4}px` }}>
          {roundMatches.map(m => renderMatch(m))}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-2xl">Loading bracket...</p>
      </main>
    )
  }

  if (!tournament || (!bracketData && !doubleElimData)) {
    return (
      <main className="min-h-screen p-8">
        <p className="text-xl">Tournament not found</p>
        <Link href="/" className="text-blue-400 hover:underline mt-4 block">
          Back to tournaments
        </Link>
      </main>
    )
  }

  // Determine champion for double elimination
  const getDoubleElimChampion = (): string | null => {
    if (!doubleElimData) return null
    const { gf1, gf2 } = doubleElimData
    // If GF2 is completed, its winner is champion
    if (gf2 && gf2.status === 'completed' && gf2.winner_id) {
      return getPlayerName(gf2.winner_id)
    }
    // If GF1 completed and GF2 is cancelled, GF1 winner is champion
    if (gf1 && gf1.status === 'completed' && gf1.winner_id) {
      if (gf2 && gf2.status === 'cancelled') {
        return getPlayerName(gf1.winner_id)
      }
    }
    return null
  }

  // ===== Double Elimination Rendering =====
  if (isDoubleElim && doubleElimData) {
    const { wbRounds, lbRounds, gf1, gf2, wbRoundNums, lbRoundNums } = doubleElimData
    const totalWBRounds = wbRoundNums.length
    const totalLBRounds = lbRoundNums.length
    const champion = getDoubleElimChampion()

    return (
      <main className="bracket-page" ref={containerRef}>
        <div className="bk-header">
          <Link href="/" className="text-blue-400 hover:underline text-sm">&larr; Back</Link>
          <div className="text-center">
            <h1 className="text-2xl font-bold">{tournament.name}</h1>
            <div className="text-gray-400 text-sm">
              {tournament.game_type.toUpperCase()} &bull; Double Elimination
              {tournament.status === 'in_progress' && (
                <span className="ml-2 px-2 py-0.5 bg-green-600 rounded text-xs">LIVE</span>
              )}
            </div>
          </div>
          <div className="text-sm text-gray-500">Best of {tournament.legs_to_win} legs</div>
        </div>

        {matches.length === 0 ? (
          <div className="text-center py-12"><p className="text-xl text-gray-400">No matches yet</p></div>
        ) : (
          <div className="bk-viewport" style={{ alignItems: 'flex-start', overflowY: 'auto' }}>
            <div ref={bracketRef} className="bk-double-bracket" style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>

              {/* Winners Bracket */}
              <div className="bk-section">
                <div className="bk-section-header">Winners Bracket</div>
                <div className="bk-bracket-row">
                  {wbRoundNums.map(r => (
                    <div key={`wb-${r}`} className="bk-round" data-round={r}>
                      <div className="bk-round-header">{getWBRoundName(r, totalWBRounds)}</div>
                      <div className="bk-round-matches" style={{ gap: `${Math.pow(2, r - 1) * 4}px` }}>
                        {(wbRounds.get(r) || []).map(m => renderMatch(m))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grand Final */}
              <div className="bk-section bk-gf-section">
                <div className="bk-section-header" style={{ color: '#fbbf24' }}>Grand Final</div>
                <div className="bk-bracket-row" style={{ justifyContent: 'center' }}>
                  {gf1 && (
                    <div className="bk-round">
                      <div className="bk-round-header bk-final-header">GF1</div>
                      <div className="bk-round-matches">{renderMatch(gf1, true)}</div>
                    </div>
                  )}
                  {gf2 && gf2.status !== 'cancelled' && (
                    <div className="bk-round">
                      <div className="bk-round-header bk-final-header">
                        GF2 <span className="bk-reset-label">(Reset)</span>
                      </div>
                      <div className="bk-round-matches">{renderMatch(gf2, true)}</div>
                    </div>
                  )}
                </div>
                {champion && (
                  <div className="bk-champion">
                    <div className="bk-champion-label">CHAMPION</div>
                    <div className="bk-champion-name">{champion}</div>
                  </div>
                )}
              </div>

              {/* Losers Bracket */}
              <div className="bk-section">
                <div className="bk-section-header bk-lb-header">Losers Bracket</div>
                <div className="bk-bracket-row">
                  {lbRoundNums.map(r => (
                    <div key={`lb-${r}`} className="bk-round" data-round={r}>
                      <div className="bk-round-header">{getLBRoundName(r, totalLBRounds)}</div>
                      <div className="bk-round-matches" style={{ gap: `${Math.pow(2, Math.floor((r - 1) / 2)) * 4}px` }}>
                        {(lbRounds.get(r) || []).map(m => renderMatch(m))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {tournament.status === 'in_progress' && (
          <div className="fixed bottom-2 right-4 flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Live
          </div>
        )}
      </main>
    )
  }

  // ===== Single Elimination Rendering (unchanged) =====
  if (!bracketData) {
    return (
      <main className="min-h-screen p-8">
        <p className="text-xl">No bracket data available</p>
        <Link href="/" className="text-blue-400 hover:underline mt-4 block">Back to tournaments</Link>
      </main>
    )
  }

  const { totalRounds, leftRounds, rightRounds, finals } = bracketData
  const leftRoundNums = Array.from(leftRounds.keys()).sort((a, b) => a - b)
  const rightRoundNums = Array.from(rightRounds.keys()).sort((a, b) => a - b)

  return (
    <main className="bracket-page" ref={containerRef}>
      {/* Header */}
      <div className="bk-header">
        <Link href="/" className="text-blue-400 hover:underline text-sm">
          &larr; Back
        </Link>
        <div className="text-center">
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <div className="text-gray-400 text-sm">
            {tournament.game_type.toUpperCase()} &bull; {tournament.format.replace(/_/g, ' ')}
            {tournament.status === 'in_progress' && (
              <span className="ml-2 px-2 py-0.5 bg-green-600 rounded text-xs">LIVE</span>
            )}
          </div>
        </div>
        <div className="text-sm text-gray-500">
          Best of {tournament.legs_to_win} legs
        </div>
      </div>

      {/* Bracket */}
      {matches.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xl text-gray-400">No matches yet</p>
        </div>
      ) : (
        <div className="bk-viewport">
          <div
            ref={bracketRef}
            className="bk-bracket"
            style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
          >
            {/* Left half */}
            <div className="bk-half bk-left">
              {leftRoundNums.map(r =>
                renderRoundColumn(r, leftRounds.get(r) || [], totalRounds, 'left')
              )}
            </div>

            {/* Finals center */}
            {finals && (
              <div className="bk-center">
                <div className="bk-round">
                  <div className="bk-round-header bk-final-header">FINAL</div>
                  <div className="bk-round-matches">
                    {renderMatch(finals, true)}
                  </div>
                  {(finals.winner_id || finals.winner_team_id) && (
                    <div className="bk-champion">
                      <div className="bk-champion-label">CHAMPION</div>
                      <div className="bk-champion-name">
                        {finals.winner_team_id
                          ? (teamMap[finals.winner_team_id]?.name || 'Team')
                          : getPlayerName(finals.winner_id!)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Right half (mirrored) */}
            <div className="bk-half bk-right">
              {rightRoundNums.map(r =>
                renderRoundColumn(r, rightRounds.get(r) || [], totalRounds, 'right')
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live indicator */}
      {tournament.status === 'in_progress' && (
        <div className="fixed bottom-2 right-4 flex items-center gap-2 text-xs text-gray-500">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Live
        </div>
      )}
    </main>
  )
}
