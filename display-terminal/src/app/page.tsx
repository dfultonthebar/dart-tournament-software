'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import RegistrationQRCode from '@/components/RegistrationQRCode'

// Helper to get API base URL
const getApiUrl = () => typeof window !== 'undefined' ? `http://${window.location.hostname}:8000/api` : 'http://localhost:8000/api'

interface Tournament {
  id: string
  name: string
  game_type: string
  format: string
  status: string
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
  const [isPaused, setIsPaused] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showQRCode, setShowQRCode] = useState(false) // Track if QR code slide is active
  const [enableQRSlide, setEnableQRSlide] = useState(false) // QR disabled by default, admin controls it

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

    // Don't auto-advance if only one slide or paused
    if (totalSlides <= 1 || isPaused) return

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
  }, [tournaments.length, slideshowInterval, isPaused, enableQRSlide, showQRCode, currentIndex])

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
      const active = data.filter((t: Tournament) =>
        t.status === 'in_progress' || t.status === 'completed'
      )
      setTournaments(active)

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

  const getMatchesByRound = useMemo((): Map<number, Match[]> => {
    const rounds = new Map<number, Match[]>()
    matches.forEach(match => {
      const roundMatches = rounds.get(match.round_number) || []
      roundMatches.push(match)
      rounds.set(match.round_number, roundMatches)
    })
    rounds.forEach((roundMatches, round) => {
      rounds.set(round, roundMatches.sort((a, b) => a.match_number - b.match_number))
    })
    return rounds
  }, [matches])

  function getRoundName(round: number, totalRounds: number): string {
    const remaining = totalRounds - round + 1
    if (remaining === 1) return 'Final'
    if (remaining === 2) return 'Semi-Finals'
    if (remaining === 3) return 'Quarter-Finals'
    return `Round ${round}`
  }

  function saveInterval(seconds: number) {
    setSlideshowInterval(seconds)
    localStorage.setItem('slideshow_interval', seconds.toString())
  }

  // When admin disables QR and it's currently showing, switch back to tournaments
  useEffect(() => {
    if (!enableQRSlide && showQRCode) {
      setShowQRCode(false)
      setCurrentIndex(0)
    }
  }, [enableQRSlide])

  // Navigation handlers for slideshow controls
  function goToPrevSlide() {
    if (enableQRSlide) {
      if (showQRCode) {
        // From QR, go to last tournament
        setShowQRCode(false)
        setCurrentIndex(tournaments.length - 1)
      } else if (currentIndex === 0) {
        // From first tournament, go to QR
        setShowQRCode(true)
      } else {
        setCurrentIndex(prev => prev - 1)
      }
    } else {
      setCurrentIndex(prev => prev === 0 ? tournaments.length - 1 : prev - 1)
    }
  }

  function goToNextSlide() {
    if (enableQRSlide) {
      if (showQRCode) {
        // From QR, go to first tournament
        setShowQRCode(false)
        setCurrentIndex(0)
      } else if (currentIndex >= tournaments.length - 1) {
        // From last tournament, go to QR
        setShowQRCode(true)
      } else {
        setCurrentIndex(prev => prev + 1)
      }
    } else {
      setCurrentIndex(prev => (prev + 1) % tournaments.length)
    }
  }

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
  const roundsMap = getMatchesByRound
  const rounds = Array.from(roundsMap.keys()).sort((a, b) => a - b)

  // Calculate total rounds based on number of first-round matches
  // For single elimination: 2 matches in R1 = 2 rounds total, 4 matches = 3 rounds, etc.
  const firstRoundMatches = roundsMap.get(1)?.length || 1
  const calculatedTotalRounds = Math.ceil(Math.log2(firstRoundMatches * 2))
  const totalRounds = Math.max(calculatedTotalRounds, ...rounds, 1)

  return (
    <main className="min-h-screen p-4 relative">
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Display Settings</h2>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">
                Slideshow Interval (seconds)
              </label>
              <input
                type="number"
                min="5"
                max="120"
                value={slideshowInterval}
                onChange={(e) => saveInterval(parseInt(e.target.value) || 20)}
                className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600"
              />
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${enableQRSlide ? 'bg-green-500' : 'bg-gray-600'}`} />
                <span className="text-gray-300">
                  QR Registration: {enableQRSlide ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1 ml-6">
                Controlled from the admin dashboard
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          {totalSlides > 1 && (
            <>
              <button
                onClick={goToPrevSlide}
                className="px-4 py-3 min-h-[44px] min-w-[44px] bg-gray-700 rounded-lg hover:bg-gray-600"
              >
                &larr;
              </button>
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`px-4 py-3 min-h-[44px] min-w-[44px] rounded-lg ${isPaused ? 'bg-green-600' : 'bg-yellow-600'}`}
              >
                {isPaused ? 'Play' : 'Pause'}
              </button>
              <button
                onClick={goToNextSlide}
                className="px-4 py-3 min-h-[44px] min-w-[44px] bg-gray-700 rounded-lg hover:bg-gray-600"
              >
                &rarr;
              </button>
            </>
          )}
        </div>

        <div className="text-center flex-1">
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

        <button
          onClick={() => setShowSettings(true)}
          className="px-4 py-3 min-h-[44px] min-w-[44px] bg-gray-700 rounded-lg hover:bg-gray-600"
          title="Settings"
        >
          ⚙
        </button>
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
        <div className="bracket-container">
          <div className="bracket-wrapper">
            {rounds.map(round => (
              <div key={round} className="bracket-round">
                <div className="round-header">
                  {getRoundName(round, totalRounds)}
                </div>
                {roundsMap.get(round)?.map(match => {
                  const dartboard = match.dartboard_id ? dartboards[match.dartboard_id] : null
                  return (
                  <div
                    key={match.id}
                    className={`bracket-match ${match.status} ${round === totalRounds ? 'finals' : ''}`}
                  >
                    <div className="match-number">M{match.match_number}</div>
                    {match.status === 'in_progress' && (
                      <div className="absolute top-2 left-2">
                        <span className="live-badge">LIVE</span>
                      </div>
                    )}
                    {dartboard && (
                      <div className="absolute top-2 right-2">
                        <span className="board-badge" title={dartboard.name || undefined}>
                          Board {dartboard.number}
                        </span>
                      </div>
                    )}
                    {match.players.length === 0 ? (
                      <div className="awaiting-players">Awaiting players</div>
                    ) : match.players.some(mp => mp.team_id) ? (
                      // Team-based rendering
                      (() => {
                        const teamGroups: Record<string, MatchPlayer[]> = {}
                        match.players.forEach(mp => {
                          const key = mp.team_id || mp.player_id
                          if (!teamGroups[key]) teamGroups[key] = []
                          teamGroups[key].push(mp)
                        })
                        return Object.entries(teamGroups)
                          .sort((a, b) => (a[1][0]?.position ?? 0) - (b[1][0]?.position ?? 0))
                          .map(([tid, members]) => (
                            <div
                              key={tid}
                              className={`bracket-player ${
                                match.winner_team_id === tid ? 'winner' :
                                match.winner_team_id && match.winner_team_id !== tid ? 'loser' : ''
                              }`}
                            >
                              <span className="player-name">{teamMap[tid]?.name || members.map(m => getPlayerName(m.player_id)).join(' & ')}</span>
                              <span className="player-score">{members[0]?.legs_won ?? 0}</span>
                            </div>
                          ))
                      })()
                    ) : (
                      match.players
                        .sort((a, b) => a.position - b.position)
                        .map(mp => (
                          <div
                            key={mp.player_id}
                            className={`bracket-player ${
                              match.winner_id === mp.player_id ? 'winner' :
                              match.winner_id && match.winner_id !== mp.player_id ? 'loser' : ''
                            } ${getPlayerName(mp.player_id) === 'TBD' ? 'tbd' : ''}`}
                          >
                            <span className="player-name">{getPlayerName(mp.player_id)}</span>
                            <span className="player-score">{mp.legs_won}</span>
                          </div>
                        ))
                    )}
                  </div>
                  )
                })}
              </div>
            ))}
          </div>
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
          {!isPaused && totalSlides > 1 && (
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
