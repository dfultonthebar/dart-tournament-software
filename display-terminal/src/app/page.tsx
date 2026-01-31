'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import RegistrationQRCode from '@/components/RegistrationQRCode'
import { getApiUrl } from '@shared/lib/api-url'

interface Tournament {
  id: string
  name: string
  game_type: string
  format: string
  status: string
  end_time?: string | null
  updated_at: string
}

interface Player {
  id: string
  name: string
}

interface MatchPlayer {
  player_id: string
  position: number
  legs_won: number
  team_id?: string
  team_position?: number
}

interface Dartboard {
  id: string
  number: number
  name: string | null
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

export default function Home() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [matches, setMatches] = useState<Match[]>([])
  const [players, setPlayers] = useState<Record<string, Player>>({})
  const [dartboards, setDartboards] = useState<Record<string, Dartboard>>({})
  const [teamMap, setTeamMap] = useState<Record<string, Team>>({})
  const [loading, setLoading] = useState(true)
  const [slideshowInterval, setSlideshowInterval] = useState(20) // seconds
  const [showQRCode, setShowQRCode] = useState(false) // Track if QR code slide is active
  const [enableQRSlide, setEnableQRSlide] = useState(false) // QR disabled by default, admin controls it
  const [scale, setScale] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const bracketRef = useRef<HTMLDivElement>(null)
  const lockedScaleRef = useRef<number | null>(null)

  // Auto-scale bracket to fit viewport.
  // Scale only decreases (zooms out) for the same tournament — never zooms in.
  const updateScale = useCallback(() => {
    if (!containerRef.current || !bracketRef.current) return
    const container = containerRef.current.getBoundingClientRect()
    const bracket = bracketRef.current
    // Reset scale to measure natural size
    bracket.style.transform = 'scale(1)'
    const natural = bracket.getBoundingClientRect()
    if (natural.width === 0 || natural.height === 0) return
    const scaleX = container.width / natural.width
    const scaleY = container.height / natural.height
    let newScale = Math.min(scaleX, scaleY, 1)
    newScale = Math.max(newScale, 0.1)

    // Lock: only allow scale to decrease for the same tournament
    if (lockedScaleRef.current !== null) {
      newScale = Math.min(newScale, lockedScaleRef.current)
    }
    lockedScaleRef.current = newScale
    setScale(newScale)
  }, [])

  // Reset locked scale when tournament changes
  useEffect(() => {
    lockedScaleRef.current = null
  }, [currentIndex])

  // Re-scale on window resize
  useEffect(() => {
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [updateScale])

  // Re-measure after matches load — wait for DOM to render first
  useEffect(() => {
    // Reset lock when match data changes (bracket may have grown)
    lockedScaleRef.current = null
    // Wait for React to render the new bracket DOM before measuring
    const timer = setTimeout(updateScale, 150)
    return () => clearTimeout(timer)
  }, [matches, updateScale])

  // Re-scale when slideshow advances to a different tournament
  useEffect(() => {
    lockedScaleRef.current = null
    const timer = setTimeout(updateScale, 150)
    return () => clearTimeout(timer)
  }, [currentIndex, updateScale])

  // Load slideshow settings from localStorage + API
  useEffect(() => {
    const saved = localStorage.getItem('slideshow_interval')
    if (saved) setSlideshowInterval(parseInt(saved))
    // Load QR setting from backend API (admin-controlled)
    fetchQRSetting()
    const qrPoll = setInterval(fetchQRSetting, 5000) // Poll every 5s for admin changes
    return () => clearInterval(qrPoll)
  }, [])

  async function fetchQRSetting() {
    try {
      const res = await fetch(`${getApiUrl()}/display-settings`)
      if (res.ok) {
        const data = await res.json()
        setEnableQRSlide(data.qr_code_enabled ?? false)
      }
    } catch {
      // Ignore fetch errors, keep current state
    }
  }

  // Load tournaments
  useEffect(() => {
    loadTournaments()
    const interval = setInterval(loadTournaments, 30000)
    return () => clearInterval(interval)
  }, [])

  // Auto-advance slideshow (includes QR code as extra slide when enabled)
  useEffect(() => {
    // Calculate total slides: tournaments + QR code (if enabled)
    const totalSlides = enableQRSlide ? tournaments.length + 1 : tournaments.length

    // Don't auto-advance if only one slide
    if (totalSlides <= 1) return

    const timer = setInterval(() => {
      if (enableQRSlide) {
        // If currently on QR code, go back to first tournament
        if (showQRCode) {
          setShowQRCode(false)
          setCurrentIndex(0)
        } else if (currentIndex >= tournaments.length - 1) {
          // If on last tournament, show QR code next
          setShowQRCode(true)
        } else {
          // Otherwise advance to next tournament
          setCurrentIndex(prev => prev + 1)
        }
      } else {
        // Standard tournament-only rotation
        setCurrentIndex(prev => (prev + 1) % tournaments.length)
      }
    }, slideshowInterval * 1000)

    return () => clearInterval(timer)
  }, [tournaments.length, slideshowInterval, enableQRSlide, showQRCode, currentIndex])

  // Load matches when tournament changes
  useEffect(() => {
    if (tournaments.length > 0) {
      loadMatches(tournaments[currentIndex].id)
    }
  }, [currentIndex, tournaments])

  async function loadTournaments() {
    try {
      const response = await fetch(`${getApiUrl()}/tournaments`)
      const data = await response.json()
      const now = Date.now()
      const ONE_HOUR_MS = 60 * 60 * 1000
      const active = data.filter((t: Tournament) => {
        if (t.status === 'in_progress') return true
        if (t.status === 'completed') {
          const completedAt = t.end_time || t.updated_at
          if (!completedAt) return false
          return (now - new Date(completedAt).getTime()) < ONE_HOUR_MS
        }
        return false
      })
      setTournaments(active)
      setCurrentIndex(prev => active.length > 0 ? Math.min(prev, active.length - 1) : 0)

      // Also load players and dartboards
      const [playersRes, dartboardsRes] = await Promise.all([
        fetch(`${getApiUrl()}/players`),
        fetch(`${getApiUrl()}/dartboards`),
      ])
      const playersData = await playersRes.json()
      const playerMap: Record<string, Player> = {}
      playersData.forEach((p: Player) => playerMap[p.id] = p)
      setPlayers(playerMap)

      const dartboardsData = await dartboardsRes.json()
      const dartboardMap: Record<string, Dartboard> = {}
      dartboardsData.forEach((d: Dartboard) => dartboardMap[d.id] = d)
      setDartboards(dartboardMap)
    } catch (error) {
      console.error('Error loading tournaments:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadMatches(tournamentId: string) {
    try {
      const [matchesRes, teamsRes] = await Promise.all([
        fetch(`${getApiUrl()}/matches?tournament_id=${tournamentId}`),
        fetch(`${getApiUrl()}/tournaments/${tournamentId}/teams`),
      ])
      setMatches(await matchesRes.json())
      const teamsData = teamsRes.ok ? await teamsRes.json() : []
      const tMap: Record<string, Team> = {}
      teamsData.forEach((t: Team) => { tMap[t.id] = t })
      setTeamMap(tMap)
    } catch (error) {
      console.error('Error loading matches:', error)
    }
  }

  function getPlayerName(playerId: string): string {
    return players[playerId]?.name || 'TBD'
  }

  // Parse bracket_position "R1M3" -> { round: 1, matchInRound: 3 }
  function parseBracketPosition(bp: string | null, fallbackRound: number, fallbackMatch: number) {
    if (!bp) return { round: fallbackRound, matchInRound: fallbackMatch }
    const m = bp.match(/R(\d+)M(\d+)/)
    if (!m) return { round: fallbackRound, matchInRound: fallbackMatch }
    return { round: parseInt(m[1]), matchInRound: parseInt(m[2]) }
  }

  const bracketData = useMemo(() => {
    if (matches.length === 0) return null

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
  }, [matches])

  function getRoundName(round: number, totalRounds: number): string {
    const remaining = totalRounds - round + 1
    if (remaining === 1) return 'Final'
    if (remaining === 2) return 'Semis'
    if (remaining === 3) return 'Quarters'
    return `R${round}`
  }

  // Determine if a match is a bye (completed with 0 or 1 players)
  function isBye(match: Match): boolean {
    return match.status === 'completed' && match.players.length <= 1
  }

  function renderMatch(match: Match, isFinal: boolean = false) {
    const dartboard = match.dartboard_id ? dartboards[match.dartboard_id] : null
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
        <div className="bk-round-matches" style={{ gap: `${Math.pow(2, roundNum - 1) * 12}px` }}>
          {roundMatches.map(m => renderMatch(m))}
        </div>
      </div>
    )
  }

  // When admin disables QR and it's currently showing, switch back to tournaments
  useEffect(() => {
    if (!enableQRSlide && showQRCode) {
      setShowQRCode(false)
      setCurrentIndex(0)
    }
  }, [enableQRSlide])

  // Calculate total slides for indicator
  const totalSlides = enableQRSlide ? tournaments.length + 1 : tournaments.length

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-2xl">Loading tournaments...</p>
      </main>
    )
  }

  if (tournaments.length === 0) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl font-bold mb-2 text-center">Tournament Brackets</h1>
        <p className="text-xl text-gray-400 mb-8">No active tournaments - Register now!</p>
        <RegistrationQRCode size={260} />
        <p className="text-gray-500 mt-4 text-sm">Waiting for tournaments to start...</p>
      </main>
    )
  }

  const currentTournament = tournaments[currentIndex]

  return (
    <main className="h-screen p-2 relative flex flex-col overflow-hidden">
      {/* Header */}
      <div className="text-center mb-2">
        {showQRCode ? (
          <>
            <h1 className="text-3xl font-bold">Player Registration</h1>
            <div className="text-gray-400">
              Scan to join tournaments
            </div>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold">{currentTournament.name}</h1>
            <div className="text-gray-400">
              {currentTournament.game_type.toUpperCase()} • {currentTournament.format.replace(/_/g, ' ')}
              {currentTournament.status === 'in_progress' && (
                <span className="ml-2 px-2 py-1 bg-green-600 rounded text-xs">LIVE</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Slideshow indicator */}
      {totalSlides > 1 && (
        <div className="slideshow-indicator">
          {tournaments.map((t, i) => (
            <button
              key={t.id}
              onClick={() => { setShowQRCode(false); setCurrentIndex(i); }}
              className={`slideshow-dot ${!showQRCode && i === currentIndex ? 'active' : ''}`}
              title={t.name}
            />
          ))}
          {enableQRSlide && (
            <button
              onClick={() => setShowQRCode(true)}
              className={`slideshow-dot qr ${showQRCode ? 'active' : ''}`}
              title="Registration QR Code"
            />
          )}
        </div>
      )}

      {/* Main Content - QR Code or Bracket Display */}
      {showQRCode ? (
        <RegistrationQRCode size={280} />
      ) : matches.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xl text-gray-400">No matches yet</p>
        </div>
      ) : (
        <div className="bracket-container" ref={containerRef}>
          {bracketData && (() => {
            const { totalRounds, leftRounds, rightRounds, finals } = bracketData
            const leftRoundNums = Array.from(leftRounds.keys()).sort((a, b) => a - b)
            const rightRoundNums = Array.from(rightRounds.keys()).sort((a, b) => a - b)

            return (
              <div ref={bracketRef} className="bk-bracket" style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
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
            )
          })()}
        </div>
      )}

      {/* Status bar */}
      <div className="fixed bottom-4 left-4 right-4 flex justify-between text-sm text-gray-500">
        <div>
          {totalSlides > 1 && (
            <span>
              {showQRCode
                ? `Registration (${tournaments.length} tournament${tournaments.length !== 1 ? 's' : ''})`
                : `Tournament ${currentIndex + 1} of ${tournaments.length}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {totalSlides > 1 && (
            <>
              <span>Next in {slideshowInterval}s</span>
              <span>•</span>
            </>
          )}
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span>Live</span>
        </div>
      </div>
    </main>
  )
}
