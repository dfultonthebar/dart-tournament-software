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
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Select Tournament</h1>
        <Link href="/admin" className="btn-touch btn-secondary px-4 py-2">
          Admin
        </Link>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : tournaments.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xl text-gray-400 mb-4">No active tournaments</p>
          <Link href="/admin/tournaments/new" className="btn-touch btn-primary px-6 py-3">
            Create Tournament
          </Link>
        </div>
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
