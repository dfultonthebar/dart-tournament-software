'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Tournament, TournamentStatus } from '@shared/types'

// Helper to get API base URL
const getApiUrl = () => typeof window !== 'undefined' ? `http://${window.location.hostname}:8000/api` : 'http://localhost:8000/api'

export default function BracketsListPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTournaments()
  }, [])

  async function loadTournaments() {
    try {
      const response = await fetch(`${getApiUrl()}/tournaments`)
      const data = await response.json()
      setTournaments(data.filter((t: Tournament) =>
        t.status === TournamentStatus.IN_PROGRESS || t.status === TournamentStatus.COMPLETED
      ))
    } catch (error) {
      console.error('Error loading tournaments:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/" className="btn-touch btn-secondary px-4 py-2">
          &larr; Back
        </Link>
        <h1 className="text-4xl font-bold">Tournament Brackets</h1>
      </div>

      {loading ? (
        <p>Loading tournaments...</p>
      ) : tournaments.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xl text-gray-400">No active tournaments with brackets</p>
          <p className="text-gray-500">Start a tournament to see brackets here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((tournament) => (
            <Link
              key={tournament.id}
              href={`/brackets/${tournament.id}`}
              className="block p-6 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors border-l-4 border-purple-500"
            >
              <div className="text-xl font-bold mb-2">{tournament.name}</div>
              <div className="text-gray-400 text-sm mb-3">
                {tournament.game_type.toUpperCase()} • {tournament.format.replace(/_/g, ' ')}
              </div>
              <span className={`px-2 py-1 rounded text-xs ${
                tournament.status === TournamentStatus.IN_PROGRESS ? 'bg-green-600' : 'bg-gray-600'
              }`}>
                {tournament.status === TournamentStatus.IN_PROGRESS ? 'LIVE' : 'COMPLETED'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
