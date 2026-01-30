'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getApiUrl } from '@shared/lib/api-url'
import { getErrorMessage } from '@shared/lib/error-message'

interface Tournament {
  id: string
  name: string
  game_type: string
  format: string
  status: string
  max_players?: number
  legs_to_win: number
  sets_to_win: number
  start_time?: string
  event_id?: string
}

interface TournamentEntry {
  id: string
  tournament_id: string
  player_id: string
  paid: boolean
  checked_in?: string
}

interface Event {
  id: string
  name: string
}

export default function PlayerTournaments() {
  const router = useRouter()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [myEntries, setMyEntries] = useState<TournamentEntry[]>([])
  const [events, setEvents] = useState<Record<string, Event>>({})
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [playerName, setPlayerName] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('player_token')
    const name = localStorage.getItem('player_name')

    if (!token) {
      router.push('/player')
      return
    }

    setPlayerName(name || '')
    loadData(token)
  }, [router])

  async function loadData(token: string) {
    try {
      const headers = { Authorization: `Bearer ${token}` }

      // Load tournaments open for registration
      const [tournamentsRes, eventsRes] = await Promise.all([
        fetch(`${getApiUrl()}/tournaments?status_filter=registration`, { headers }),
        fetch(`${getApiUrl()}/events`, { headers }),
      ])

      const tournamentsData = await tournamentsRes.json()
      const eventsData = await eventsRes.json()

      // Build events map
      const eventsMap: Record<string, Event> = {}
      eventsData.forEach((e: Event) => eventsMap[e.id] = e)
      setEvents(eventsMap)

      // Filter to only registration-open tournaments
      const openTournaments = Array.isArray(tournamentsData)
        ? tournamentsData.filter((t: Tournament) => t.status === 'registration')
        : []
      setTournaments(openTournaments)

      // Load my entries for these tournaments
      const entriesPromises = openTournaments.map((t: Tournament) =>
        fetch(`${getApiUrl()}/tournaments/${t.id}/entries`, { headers })
          .then(res => res.json())
          .then(entries => entries.filter((e: any) => e.player_id))
      )

      // Get current player info
      const meRes = await fetch(`${getApiUrl()}/auth/me`, { headers })
      if (meRes.ok) {
        const meData = await meRes.json()
        const allEntries = await Promise.all(entriesPromises)
        const myEntriesList = allEntries.flat().filter((e: TournamentEntry) =>
          e.player_id === meData.id
        )
        setMyEntries(myEntriesList)
      }
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Failed to load tournaments')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignUp(tournamentId: string) {
    const token = localStorage.getItem('player_token')
    if (!token) return

    setActionLoading(tournamentId)
    setError('')

    try {
      const response = await fetch(`${getApiUrl()}/tournaments/${tournamentId}/entries`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to sign up')
      }

      const entry = await response.json()
      setMyEntries([...myEntries, entry])
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setActionLoading(null)
    }
  }

  async function handleWithdraw(tournamentId: string) {
    const token = localStorage.getItem('player_token')
    if (!token) return

    const entry = myEntries.find(e => e.tournament_id === tournamentId)
    if (!entry) return

    if (!confirm('Are you sure you want to withdraw from this tournament?')) return

    setActionLoading(tournamentId)
    setError('')

    try {
      const response = await fetch(`${getApiUrl()}/tournaments/${tournamentId}/entries/${entry.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to withdraw')
      }

      setMyEntries(myEntries.filter(e => e.id !== entry.id))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setActionLoading(null)
    }
  }

  function isSignedUp(tournamentId: string): boolean {
    return myEntries.some(e => e.tournament_id === tournamentId)
  }

  function getEntryStatus(tournamentId: string): TournamentEntry | undefined {
    return myEntries.find(e => e.tournament_id === tournamentId)
  }

  function formatGameType(type: string): string {
    const types: Record<string, string> = {
      '501': '501',
      '301': '301',
      'cricket': 'Cricket',
      'cricket_cutthroat': 'Cut-throat Cricket',
      'round_the_clock': 'Round the Clock',
      'killer': 'Killer',
      'shanghai': 'Shanghai',
      'baseball': 'Baseball',
    }
    return types[type] || type
  }

  function formatFormat(format: string): string {
    const formats: Record<string, string> = {
      'single_elimination': 'Single Elimination',
      'double_elimination': 'Double Elimination',
      'round_robin': 'Round Robin',
      'lucky_draw_doubles': 'Lucky Draw Doubles',
    }
    return formats[format] || format
  }

  if (loading) {
    return (
      <main className="min-h-screen p-6 flex items-center justify-center">
        <p className="text-xl">Loading tournaments...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Tournament Sign-Up</h1>
            <p className="text-gray-400">Welcome, {playerName}</p>
          </div>
          <Link href="/player" className="text-gray-400 hover:text-white">
            &larr; Back
          </Link>
        </div>

        {error && (
          <div className="bg-red-600 text-white p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {tournaments.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-xl text-gray-400">No tournaments open for registration</p>
            <p className="text-gray-500 mt-2">Check back later for upcoming tournaments!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tournaments.map((tournament) => {
              const entry = getEntryStatus(tournament.id)
              const signedUp = !!entry

              return (
                <div
                  key={tournament.id}
                  className={`bg-gray-800 rounded-lg p-5 border-2 transition ${
                    signedUp ? 'border-green-600' : 'border-transparent'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h2 className="text-xl font-bold">{tournament.name}</h2>
                      {tournament.event_id && events[tournament.event_id] && (
                        <p className="text-sm text-gray-400">{events[tournament.event_id].name}</p>
                      )}
                    </div>
                    {signedUp && (
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        entry?.paid
                          ? 'bg-green-600 text-white'
                          : 'bg-yellow-600 text-white'
                      }`}>
                        {entry?.paid ? 'Paid' : 'Payment Pending'}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-400 mb-4">
                    <div>Game: <span className="text-white">{formatGameType(tournament.game_type)}</span></div>
                    <div>Format: <span className="text-white">{formatFormat(tournament.format)}</span></div>
                    <div>Best of: <span className="text-white">{tournament.legs_to_win} legs</span></div>
                    {tournament.max_players && (
                      <div>Max Players: <span className="text-white">{tournament.max_players}</span></div>
                    )}
                  </div>

                  {signedUp ? (
                    <div className="flex gap-3">
                      <div className="flex-1 py-3 bg-green-900/50 text-green-400 rounded-lg text-center font-medium">
                        You&apos;re signed up!
                      </div>
                      {!entry?.paid && (
                        <button
                          onClick={() => handleWithdraw(tournament.id)}
                          disabled={actionLoading === tournament.id}
                          className="px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-medium disabled:opacity-50 transition"
                        >
                          {actionLoading === tournament.id ? '...' : 'Withdraw'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSignUp(tournament.id)}
                      disabled={actionLoading === tournament.id}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold disabled:opacity-50 transition"
                    >
                      {actionLoading === tournament.id ? 'Signing up...' : 'Sign Up'}
                    </button>
                  )}

                  {signedUp && !entry?.paid && (
                    <p className="text-sm text-yellow-400 mt-3 text-center">
                      Please pay at the registration desk to confirm your spot
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>After signing up, please pay at the registration desk.</p>
          <p>Your spot is confirmed once payment is received.</p>
        </div>
      </div>
    </main>
  )
}
