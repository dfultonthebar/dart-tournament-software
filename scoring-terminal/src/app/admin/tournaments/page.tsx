'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Tournament, TournamentStatus } from '@shared/types'
import { getApiUrl } from '@shared/lib/api-url'
import Breadcrumbs from '@/components/Breadcrumbs'

export default function TournamentsListPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTournaments()
  }, [])

  async function loadTournaments() {
    try {
      const response = await fetch(`${getApiUrl()}/tournaments`)
      const data = await response.json()
      setTournaments(data)
    } catch (err) {
      console.error('Error loading tournaments:', err)
    } finally {
      setLoading(false)
    }
  }

  function getStatusColor(status: TournamentStatus): string {
    switch (status) {
      case TournamentStatus.DRAFT: return 'bg-yellow-600'
      case TournamentStatus.REGISTRATION: return 'bg-blue-600'
      case TournamentStatus.IN_PROGRESS: return 'bg-green-600'
      case TournamentStatus.COMPLETED: return 'bg-gray-600'
      case TournamentStatus.CANCELLED: return 'bg-red-600'
      default: return 'bg-gray-600'
    }
  }

  return (
    <main className="min-h-screen p-6 lg:p-8">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/admin/darts' },
        { label: 'Tournaments' },
      ]} />

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">All Tournaments</h1>
        <Link href="/admin/tournaments/new" className="btn-touch btn-primary px-6 py-3">
          + New Tournament
        </Link>
      </div>

      {loading ? (
        <p>Loading tournaments...</p>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="text-left p-4">Name</th>
                <th className="text-left p-4">Game Type</th>
                <th className="text-left p-4">Format</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tournaments.map((tournament) => (
                <tr key={tournament.id} className="border-t border-gray-700 hover:bg-gray-750">
                  <td className="p-4 font-medium">{tournament.name}</td>
                  <td className="p-4 text-gray-400">{tournament.game_type.toUpperCase()}</td>
                  <td className="p-4 text-gray-400">{tournament.format.replace(/_/g, ' ')}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${getStatusColor(tournament.status)}`}>
                      {tournament.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4">
                    <Link
                      href={`/admin/tournaments/${tournament.id}`}
                      className="text-blue-400 hover:underline mr-4"
                    >
                      Manage
                    </Link>
                    {tournament.status === TournamentStatus.IN_PROGRESS && (
                      <Link
                        href={`/matches?tournament=${tournament.id}`}
                        className="text-green-400 hover:underline"
                      >
                        Score
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {tournaments.length === 0 && (
            <p className="p-8 text-center text-gray-400">No tournaments created yet.</p>
          )}
        </div>
      )}

      <div className="mt-4 text-gray-400">
        Total: {tournaments.length} tournaments
      </div>
    </main>
  )
}
