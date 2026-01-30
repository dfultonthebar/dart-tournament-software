'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Tournament, TournamentStatus } from '@shared/types'
import Link from 'next/link'

export default function Home() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTournaments()
  }, [])

  async function loadTournaments() {
    try {
      const data = await api.getTournaments()
      setTournaments(data.filter(t => t.status === TournamentStatus.IN_PROGRESS))
    } catch (error) {
      console.error('Error loading tournaments:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-8">Select Tournament</h1>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tournaments.map((tournament) => (
            <Link
              key={tournament.id}
              href={`/matches?tournament=${tournament.id}`}
              className="btn-touch btn-primary block text-center"
            >
              <div className="font-bold text-xl">{tournament.name}</div>
              <div className="text-sm opacity-90">{tournament.game_type}</div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
