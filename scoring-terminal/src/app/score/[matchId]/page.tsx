'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

const getApiUrl = () => typeof window !== 'undefined' ? `http://${window.location.hostname}:8000/api` : 'http://localhost:8000/api'

interface Player {
  id: string
  name: string
}

interface MatchPlayer {
  player_id: string
  position: number
  sets_won: number
  legs_won: number
}

interface Match {
  id: string
  tournament_id: string
  round_number: number
  match_number: number
  status: string
  winner_id: string | null
  players: MatchPlayer[]
}

interface Tournament {
  id: string
  name: string
}

export default function ScoreMatchPage() {
  const params = useParams()
  const router = useRouter()
  const matchId = params.matchId as string
  const { token, isAuthenticated, isLoading: authLoading } = useAuth()

  const [match, setMatch] = useState<Match | null>(null)
  const [players, setPlayers] = useState<Record<string, Player>>({})
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && matchId) {
      loadMatchData()
    }
  }, [matchId, authLoading])

  async function loadMatchData() {
    try {
      setLoading(true)
      setError('')

      // Fetch match data
      const matchResponse = await fetch(`${getApiUrl()}/matches/${matchId}`)
      if (!matchResponse.ok) {
        throw new Error('Failed to load match')
      }
      const matchData: Match = await matchResponse.json()
      setMatch(matchData)

      // Fetch players
      const playersResponse = await fetch(`${getApiUrl()}/players`)
      if (!playersResponse.ok) {
        throw new Error('Failed to load players')
      }
      const playersData: Player[] = await playersResponse.json()
      const playerMap: Record<string, Player> = {}
      playersData.forEach(p => playerMap[p.id] = p)
      setPlayers(playerMap)

      // Fetch tournament name
      const tournamentResponse = await fetch(`${getApiUrl()}/tournaments/${matchData.tournament_id}`)
      if (tournamentResponse.ok) {
        const tournamentData: Tournament = await tournamentResponse.json()
        setTournament(tournamentData)
      }
    } catch (err: any) {
      console.error('Error loading match data:', err)
      setError(err.message || 'Failed to load match data')
    } finally {
      setLoading(false)
    }
  }

  function getPlayerName(playerId: string): string {
    return players[playerId]?.name || 'Unknown Player'
  }

  function handleSelectWinner(playerId: string) {
    setSelectedWinner(playerId)
    setShowConfirm(true)
  }

  function handleCancelConfirm() {
    setSelectedWinner(null)
    setShowConfirm(false)
  }

  async function handleConfirmWinner() {
    if (!selectedWinner || !match) return

    setSaving(true)
    setError('')

    try {
      const response = await fetch(`${getApiUrl()}/matches/${matchId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          winner_id: selectedWinner,
          status: 'completed',
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to save match result')
      }

      // Redirect back to matches list
      router.push(`/matches?tournament=${match.tournament_id}`)
    } catch (err: any) {
      console.error('Error saving match result:', err)
      setError(err.message || 'Failed to save match result')
      setSaving(false)
      setShowConfirm(false)
    }
  }

  // Show loading while auth is loading
  if (authLoading || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-2xl mb-4">Loading match...</div>
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
        </div>
      </main>
    )
  }

  if (!match) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Match Not Found</h1>
          <Link href="/" className="btn-touch bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg text-lg">
            Back to Home
          </Link>
        </div>
      </main>
    )
  }

  // Match already completed
  if (match.status === 'completed') {
    return (
      <main className="min-h-screen p-6 bg-gray-900 text-white">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <Link
              href={`/matches?tournament=${match.tournament_id}`}
              className="inline-flex items-center text-blue-400 hover:text-blue-300"
            >
              <span className="mr-2">&larr;</span> Back to Matches
            </Link>
          </div>

          <div className="text-center bg-gray-800 rounded-xl p-8">
            <h1 className="text-2xl font-bold mb-2">{tournament?.name || 'Tournament'}</h1>
            <p className="text-gray-400 mb-6">Round {match.round_number} - Match {match.match_number}</p>

            <div className="bg-green-600/20 border border-green-500 rounded-lg p-6 mb-6">
              <div className="text-green-400 text-lg mb-2">Match Complete</div>
              <div className="text-3xl font-bold">
                Winner: {match.winner_id ? getPlayerName(match.winner_id) : 'Unknown'}
              </div>
            </div>

            <Link
              href={`/matches?tournament=${match.tournament_id}`}
              className="btn-touch bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-lg text-xl font-semibold inline-block"
            >
              Back to Matches
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const player1 = match.players.find(p => p.position === 1)
  const player2 = match.players.find(p => p.position === 2)

  return (
    <main className="min-h-screen p-6 bg-gray-900 text-white">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/matches?tournament=${match.tournament_id}`}
            className="inline-flex items-center text-blue-400 hover:text-blue-300 mb-4"
          >
            <span className="mr-2">&larr;</span> Back to Matches
          </Link>

          <div className="text-center">
            <h1 className="text-2xl font-bold mb-1">{tournament?.name || 'Tournament'}</h1>
            <p className="text-gray-400">Round {match.round_number} - Match {match.match_number}</p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-600/20 border border-red-500 text-red-400 p-4 rounded-lg mb-6 text-center">
            {error}
          </div>
        )}

        {/* Instructions */}
        <div className="text-center mb-8">
          <h2 className="text-xl text-gray-300">Tap the winner to record the match result</h2>
        </div>

        {/* Player Selection Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Player 1 Button */}
          {player1 && (
            <button
              onClick={() => handleSelectWinner(player1.player_id)}
              disabled={saving}
              className="btn-touch bg-gray-800 hover:bg-blue-700 active:bg-blue-600 border-2 border-gray-700 hover:border-blue-500 rounded-2xl p-8 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-h-[200px] flex flex-col items-center justify-center"
            >
              <div className="text-3xl md:text-4xl font-bold mb-4">
                {getPlayerName(player1.player_id)}
              </div>
              <div className="text-gray-400 text-lg">
                Tap to select as winner
              </div>
            </button>
          )}

          {/* Player 2 Button */}
          {player2 && (
            <button
              onClick={() => handleSelectWinner(player2.player_id)}
              disabled={saving}
              className="btn-touch bg-gray-800 hover:bg-blue-700 active:bg-blue-600 border-2 border-gray-700 hover:border-blue-500 rounded-2xl p-8 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-h-[200px] flex flex-col items-center justify-center"
            >
              <div className="text-3xl md:text-4xl font-bold mb-4">
                {getPlayerName(player2.player_id)}
              </div>
              <div className="text-gray-400 text-lg">
                Tap to select as winner
              </div>
            </button>
          )}
        </div>

        {/* VS Divider - visible on larger screens */}
        <div className="hidden md:block absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="text-4xl font-bold text-gray-600">VS</div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && selectedWinner && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-center mb-6">Confirm Winner</h2>

            <div className="text-center mb-8">
              <div className="text-gray-400 mb-2">Set match winner as:</div>
              <div className="text-3xl font-bold text-green-400">
                {getPlayerName(selectedWinner)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleCancelConfirm}
                disabled={saving}
                className="btn-touch bg-gray-700 hover:bg-gray-600 py-4 rounded-xl text-xl font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmWinner}
                disabled={saving}
                className="btn-touch bg-green-600 hover:bg-green-500 py-4 rounded-xl text-xl font-semibold disabled:opacity-50 flex items-center justify-center"
              >
                {saving ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Saving...
                  </>
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
