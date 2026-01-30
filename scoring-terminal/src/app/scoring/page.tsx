'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { MatchWithPlayers, MatchPlayerInfo, Player, Game, MatchStatus } from '@shared/types'

interface GameState {
  id: string
  match_id: string
  status: string
  current_player_id: string | null
  game_data: {
    scores?: Record<string, number>
    starting_score?: number
  }
}

function ScoringContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const matchId = searchParams.get('match')

  const [match, setMatch] = useState<MatchWithPlayers | null>(null)
  const [players, setPlayers] = useState<Record<string, Player>>({})
  const [games, setGames] = useState<Game[]>([])
  const [currentGame, setCurrentGame] = useState<GameState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [scoreInput, setScoreInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (matchId) {
      loadMatch()
    }
  }, [matchId])

  async function loadMatch() {
    try {
      const [matchData, playersData] = await Promise.all([
        api.getMatch(matchId!),
        api.getPlayers(),
      ])

      setMatch(matchData)

      const playerMap: Record<string, Player> = {}
      playersData.forEach(p => playerMap[p.id] = p)
      setPlayers(playerMap)

      // Load games for this match
      const gamesData = await api.getMatchGames(matchId!)
      setGames(gamesData)

      // Get current game state if there's an active game
      if (gamesData.length > 0) {
        const activeGame = gamesData.find(g => g.status === 'in_progress') || gamesData[gamesData.length - 1]
        if (activeGame) {
          const gameState = await api.getGameState(activeGame.id)
          setCurrentGame(gameState as GameState)
        }
      }
    } catch (err: any) {
      console.error('Error loading match:', err)
      setError(err.message || 'Failed to load match')
    } finally {
      setLoading(false)
    }
  }

  async function startMatch() {
    if (!matchId) return
    setSubmitting(true)
    setError('')

    try {
      await api.startMatch(matchId)
      await loadMatch()
    } catch (err: any) {
      setError(err.message || 'Failed to start match')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitScore(score: number) {
    if (!currentGame || !currentGame.current_player_id) {
      setError('No active game or player')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await api.submitScore({
        game_id: currentGame.id,
        player_id: currentGame.current_player_id,
        throw: {
          scores: [score],
        },
      })
      setScoreInput('')
      await loadMatch()
    } catch (err: any) {
      setError(err.message || 'Failed to submit score')
    } finally {
      setSubmitting(false)
    }
  }

  function handleScoreSubmit(e: React.FormEvent) {
    e.preventDefault()
    const score = parseInt(scoreInput)
    if (!isNaN(score) && score >= 0 && score <= 180) {
      submitScore(score)
    }
  }

  function handleQuickScore(score: number) {
    submitScore(score)
  }

  function getPlayerName(playerId: string): string {
    return players[playerId]?.name || 'Unknown'
  }

  function getPlayerScore(playerId: string): number {
    if (!currentGame?.game_data?.scores) return currentGame?.game_data?.starting_score || 501
    return currentGame.game_data.scores[playerId] ?? (currentGame.game_data.starting_score || 501)
  }

  // Doubles detection: check if any player has a team_id set
  const isDoubles = match ? match.players.some(p => !!p.team_id) : false

  // Group players by team_id for doubles matches
  function getTeams(): { teamId: string; players: MatchPlayerInfo[] }[] {
    if (!match) return []
    const teamMap = new Map<string, MatchPlayerInfo[]>()
    for (const p of match.players) {
      if (p.team_id) {
        if (!teamMap.has(p.team_id)) {
          teamMap.set(p.team_id, [])
        }
        teamMap.get(p.team_id)!.push(p)
      }
    }
    const teams: { teamId: string; players: MatchPlayerInfo[] }[] = []
    teamMap.forEach((teamPlayers, teamId) => {
      teamPlayers.sort((a, b) => (a.team_position || 0) - (b.team_position || 0))
      teams.push({ teamId, players: teamPlayers })
    })
    return teams
  }

  function getTeamDisplayName(teamPlayers: MatchPlayerInfo[]): string {
    return teamPlayers.map(p => getPlayerName(p.player_id)).join(' & ')
  }

  if (!matchId) {
    return (
      <main className="min-h-screen p-8">
        <h1 className="text-4xl font-bold mb-4">No Match Selected</h1>
        <Link href="/" className="btn-touch btn-primary">
          Select a Tournament
        </Link>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="min-h-screen p-8">
        <p className="text-xl">Loading match...</p>
      </main>
    )
  }

  if (!match) {
    return (
      <main className="min-h-screen p-8">
        <h1 className="text-4xl font-bold mb-4">Match Not Found</h1>
        <Link href="/" className="btn-touch btn-primary">
          Back to Tournaments
        </Link>
      </main>
    )
  }

  const player1 = match.players.find(p => p.position === 1)
  const player2 = match.players.find(p => p.position === 2)
  const teams = isDoubles ? getTeams() : []

  return (
    <main className="min-h-screen p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link href={`/matches?tournament=${match.tournament_id}`} className="btn-touch btn-secondary px-4 py-2">
          &larr; Back
        </Link>
        <div className="text-center">
          <div className="text-sm text-gray-400">Round {match.round_number} - Match {match.match_number}</div>
          <div className={`text-xs px-2 py-1 rounded inline-block mt-1 ${
            match.status === MatchStatus.IN_PROGRESS ? 'bg-green-600' :
            match.status === MatchStatus.COMPLETED ? 'bg-gray-600' :
            'bg-yellow-600'
          }`}>
            {match.status.toUpperCase()}
          </div>
        </div>
        <div className="w-20"></div>
      </div>

      {error && (
        <div className="bg-red-600 text-white p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Players and Scores */}
      {isDoubles ? (
        /* Doubles: show team panels */
        <div className="grid grid-cols-2 gap-4 mb-6">
          {teams.map((team, teamIndex) => (
            <div
              key={team.teamId}
              className={`bg-gray-800 rounded-lg p-4 text-center ${
                team.players.some(p => currentGame?.current_player_id === p.player_id) ? 'ring-2 ring-yellow-500' : ''
              }`}
            >
              <div className="text-lg font-bold mb-2">
                {getTeamDisplayName(team.players)}
              </div>
              {team.players.map(p => (
                <div key={p.player_id} className="mb-1">
                  <div className="text-3xl font-bold text-green-400">
                    {getPlayerScore(p.player_id)}
                  </div>
                  <div className="text-xs text-gray-500">{getPlayerName(p.player_id)}</div>
                </div>
              ))}
              <div className="text-gray-400 mt-1">
                Legs: {team.players[0]?.legs_won || 0}
              </div>
              {team.players.some(p => currentGame?.current_player_id === p.player_id) && (
                <div className="text-yellow-400 text-sm mt-2">
                  {teamIndex === 0 ? '\u25C0 Throwing' : 'Throwing \u25B6'}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Singles: show individual player panels */
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Player 1 */}
          <div className={`bg-gray-800 rounded-lg p-4 text-center ${
            currentGame?.current_player_id === player1?.player_id ? 'ring-2 ring-yellow-500' : ''
          }`}>
            <div className="text-lg font-bold mb-2">
              {player1 ? getPlayerName(player1.player_id) : 'TBD'}
            </div>
            <div className="text-5xl font-bold text-green-400 mb-2">
              {player1 ? getPlayerScore(player1.player_id) : '-'}
            </div>
            <div className="text-gray-400">
              Legs: {player1?.legs_won || 0}
            </div>
            {currentGame?.current_player_id === player1?.player_id && (
              <div className="text-yellow-400 text-sm mt-2">{'\u25C0'} Throwing</div>
            )}
          </div>

          {/* Player 2 */}
          <div className={`bg-gray-800 rounded-lg p-4 text-center ${
            currentGame?.current_player_id === player2?.player_id ? 'ring-2 ring-yellow-500' : ''
          }`}>
            <div className="text-lg font-bold mb-2">
              {player2 ? getPlayerName(player2.player_id) : 'TBD'}
            </div>
            <div className="text-5xl font-bold text-green-400 mb-2">
              {player2 ? getPlayerScore(player2.player_id) : '-'}
            </div>
            <div className="text-gray-400">
              Legs: {player2?.legs_won || 0}
            </div>
            {currentGame?.current_player_id === player2?.player_id && (
              <div className="text-yellow-400 text-sm mt-2">Throwing {'\u25B6'}</div>
            )}
          </div>
        </div>
      )}

      {/* Match Controls */}
      {match.status === MatchStatus.PENDING && (
        <div className="text-center mb-6">
          <button
            onClick={startMatch}
            disabled={submitting}
            className="btn-touch btn-primary px-8 py-4 text-xl font-bold disabled:opacity-50"
          >
            {submitting ? 'Starting...' : 'Start Match'}
          </button>
        </div>
      )}

      {/* Scoring Interface */}
      {match.status === MatchStatus.IN_PROGRESS && currentGame && (
        <div className="space-y-4">
          {/* Score Input */}
          <form onSubmit={handleScoreSubmit} className="flex gap-2">
            <input
              type="number"
              min="0"
              max="180"
              value={scoreInput}
              onChange={(e) => setScoreInput(e.target.value)}
              placeholder="Enter score (0-180)"
              className="flex-1 p-4 text-2xl bg-gray-800 rounded-lg border border-gray-700 text-center"
              disabled={submitting}
            />
            <button
              type="submit"
              disabled={submitting || !scoreInput}
              className="btn-touch btn-primary px-8 text-xl disabled:opacity-50"
            >
              OK
            </button>
          </form>

          {/* Quick Score Buttons */}
          <div className="grid grid-cols-6 gap-2">
            {[0, 26, 41, 45, 60, 81, 85, 100, 121, 140, 180].map(score => (
              <button
                key={score}
                onClick={() => handleQuickScore(score)}
                disabled={submitting}
                className="btn-touch py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-lg font-bold disabled:opacity-50"
              >
                {score}
              </button>
            ))}
          </div>

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '⌫'].map(key => (
              <button
                key={key}
                onClick={() => {
                  if (key === 'C') setScoreInput('')
                  else if (key === '⌫') setScoreInput(prev => prev.slice(0, -1))
                  else setScoreInput(prev => prev + key)
                }}
                className="btn-touch py-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-2xl font-bold"
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Match Completed */}
      {match.status === MatchStatus.COMPLETED && (
        <div className="text-center py-8">
          <div className="text-2xl font-bold text-green-400 mb-4">Match Complete!</div>
          <div className="text-xl">
            Winner: {(() => {
              if (isDoubles && match.winner_team_id) {
                const winningTeam = teams.find(t => t.teamId === match.winner_team_id)
                if (winningTeam) return getTeamDisplayName(winningTeam.players)
              }
              return match.winner_id ? getPlayerName(match.winner_id) : 'Unknown'
            })()}
          </div>
          <Link href={`/matches?tournament=${match.tournament_id}`} className="btn-touch btn-primary mt-6 inline-block px-6 py-3">
            Back to Matches
          </Link>
        </div>
      )}
    </main>
  )
}

export default function ScoringPage() {
  return (
    <Suspense fallback={<main className="min-h-screen p-8"><p>Loading scoring...</p></main>}>
      <ScoringContent />
    </Suspense>
  )
}
