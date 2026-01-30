'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Tournament, Player, TournamentStatus, Team } from '@shared/types'
import { useAuth } from '@/contexts/AuthContext'
import { getApiUrl } from '@shared/lib/api-url'
import Breadcrumbs from '@/components/Breadcrumbs'

interface TournamentEntry {
  id: string
  tournament_id: string
  player_id: string
  seed: number | null
  checked_in: string | null
  paid: boolean
  created_at: string
}

export default function LuckyDrawPage() {
  const params = useParams()
  const router = useRouter()
  const { token, isAuthenticated } = useAuth()
  const tournamentId = params.id as string

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [entries, setEntries] = useState<TournamentEntry[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadData()
  }, [tournamentId])

  async function loadData() {
    try {
      const [tournamentRes, entriesRes, teamsRes, playersRes] = await Promise.all([
        fetch(`${getApiUrl()}/tournaments/${tournamentId}`),
        fetch(`${getApiUrl()}/tournaments/${tournamentId}/entries`),
        fetch(`${getApiUrl()}/tournaments/${tournamentId}/teams`),
        fetch(`${getApiUrl()}/players`),
      ])

      const tournamentData = await tournamentRes.json()
      const entriesData = await entriesRes.json()
      const teamsData = await teamsRes.json()
      const playersData = await playersRes.json()

      setTournament(tournamentData)
      setEntries(entriesData)
      setTeams(teamsData)
      setAllPlayers(playersData)
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Failed to load tournament data')
    } finally {
      setLoading(false)
    }
  }

  function getPlayerName(playerId: string): string {
    const player = allPlayers.find(p => p.id === playerId)
    return player?.name || 'Unknown'
  }

  function getPlayerGender(playerId: string): string | undefined {
    const player = allPlayers.find(p => p.id === playerId)
    return player?.gender
  }

  function GenderBadge({ playerId }: { playerId: string }) {
    const gender = getPlayerGender(playerId)
    if (!gender) return null
    return (
      <span className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded ${
        gender === 'M' ? 'bg-blue-600 text-white' : 'bg-pink-600 text-white'
      }`}>
        {gender}
      </span>
    )
  }

  async function generateTeams() {
    if (!token) {
      setError('Please login to generate teams')
      return
    }

    setGenerating(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`${getApiUrl()}/tournaments/${tournamentId}/lucky-draw`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to generate teams')
      }

      const newTeams = await response.json()
      setTeams(newTeams)
      setSuccess('Teams generated successfully!')
    } catch (err: any) {
      setError(err.message || 'Failed to generate teams')
    } finally {
      setGenerating(false)
    }
  }

  async function clearTeams() {
    if (!token) {
      setError('Please login to clear teams')
      return
    }

    setGenerating(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`${getApiUrl()}/tournaments/${tournamentId}/teams`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to clear teams')
      }

      setTeams([])
      setSuccess('Teams cleared. You can now generate new teams.')
    } catch (err: any) {
      setError(err.message || 'Failed to clear teams')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen p-8">
        <p>Loading tournament...</p>
      </main>
    )
  }

  if (!tournament) {
    return (
      <main className="min-h-screen p-8">
        <p>Tournament not found</p>
        <Link href="/admin" className="btn-touch btn-secondary mt-4">
          Back to Admin
        </Link>
      </main>
    )
  }

  if (tournament.format !== 'lucky_draw_doubles') {
    return (
      <main className="min-h-screen p-8">
        <p>This page is only available for Lucky Draw Doubles tournaments.</p>
        <Link href={`/admin/tournaments/${tournamentId}`} className="btn-touch btn-secondary mt-4">
          Back to Tournament
        </Link>
      </main>
    )
  }

  const playerCount = entries.length
  const isEvenNumber = playerCount % 2 === 0
  const canGenerate = playerCount >= 2 && isEvenNumber &&
    (tournament.status === TournamentStatus.DRAFT || tournament.status === TournamentStatus.REGISTRATION)
  const canProceed = teams.length > 0

  return (
    <main className="min-h-screen p-6 lg:p-8">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/admin/darts' },
        { label: 'Tournaments', href: '/admin/tournaments' },
        { label: tournament.name, href: `/admin/tournaments/${tournamentId}` },
        { label: 'Lucky Draw Teams' },
      ]} />

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Lucky Draw Teams</h1>
        <p className="text-gray-400 mt-1">{tournament.name}</p>
      </div>

      {!isAuthenticated && (
        <div className="bg-yellow-600 text-white p-4 rounded-lg mb-6">
          <Link href="/admin/login" className="underline font-bold">Login</Link> to generate teams.
        </div>
      )}

      {error && (
        <div className="bg-red-600 text-white p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-600 text-white p-4 rounded-lg mb-6">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Registered Players */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Registered Players ({playerCount})</h2>

          {!isEvenNumber && playerCount > 0 && (
            <div className="bg-orange-600 text-white p-3 rounded mb-4">
              Odd number of players. Lucky Draw requires an even number of players to form teams.
            </div>
          )}

          {tournament.is_coed && playerCount > 0 && (() => {
            const maleCount = entries.filter(e => getPlayerGender(e.player_id) === 'M').length
            const femaleCount = entries.filter(e => getPlayerGender(e.player_id) === 'F').length
            const unsetCount = playerCount - maleCount - femaleCount
            const imbalance = Math.abs(maleCount - femaleCount)
            return (
              <>
                <div className="bg-gray-600 text-white p-3 rounded mb-4 text-sm">
                  Co-ed mode: <span className="text-blue-300 font-bold">{maleCount}M</span> / <span className="text-pink-300 font-bold">{femaleCount}F</span>
                  {unsetCount > 0 && <span className="text-yellow-300"> / {unsetCount} unset</span>}
                </div>
                {imbalance > 2 && (
                  <div className="bg-yellow-600 text-white p-3 rounded mb-4 text-sm">
                    Gender imbalance detected ({imbalance} difference). Some same-gender teams will be created.
                  </div>
                )}
                {unsetCount > 0 && (
                  <div className="bg-yellow-600 text-white p-3 rounded mb-4 text-sm">
                    {unsetCount} player(s) have no gender set. They will not be paired in co-ed pairs.
                  </div>
                )}
              </>
            )
          })()}

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {entries.map((entry, index) => (
              <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-700 rounded">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400">#{index + 1}</span>
                  <GenderBadge playerId={entry.player_id} />
                  <span>{getPlayerName(entry.player_id)}</span>
                </div>
                <span className={`text-sm ${entry.paid ? 'text-green-400' : 'text-red-400'}`}>
                  {entry.paid ? 'Paid' : 'Unpaid'}
                </span>
              </div>
            ))}

            {entries.length === 0 && (
              <p className="text-gray-400 text-center py-4">No players registered yet</p>
            )}
          </div>

          {playerCount < 2 && (
            <p className="text-yellow-400 mt-4 text-sm">
              Need at least 2 players to generate teams.
            </p>
          )}
        </div>

        {/* Teams Section */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Generated Teams ({teams.length})</h2>

          {teams.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">No teams generated yet</p>
              {isAuthenticated && canGenerate && (
                <button
                  onClick={generateTeams}
                  disabled={generating}
                  className="btn-touch btn-primary px-8 py-4 text-xl font-bold disabled:opacity-50"
                >
                  {generating ? 'Generating...' : 'Generate Random Teams'}
                </button>
              )}
              {!canGenerate && playerCount >= 2 && !isEvenNumber && (
                <p className="text-orange-400 text-sm mt-2">
                  Add one more player or remove one to have an even number.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3 max-h-72 overflow-y-auto mb-4">
                {teams.map((team, index) => (
                  <div key={team.id} className="p-4 bg-gray-700 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-blue-400">Team {index + 1}</span>
                    </div>
                    <div className="mt-2 text-xl flex items-center gap-1 flex-wrap">
                      <GenderBadge playerId={team.player1_id} />
                      <span>{team.player1_name || getPlayerName(team.player1_id)}</span>
                      <span className="text-gray-400 mx-1">&</span>
                      <GenderBadge playerId={team.player2_id} />
                      <span>{team.player2_name || getPlayerName(team.player2_id)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {isAuthenticated && (tournament.status === TournamentStatus.DRAFT || tournament.status === TournamentStatus.REGISTRATION) && (
                <div className="flex gap-4">
                  <button
                    onClick={generateTeams}
                    disabled={generating}
                    className="flex-1 btn-touch bg-yellow-600 hover:bg-yellow-700 px-4 py-3 rounded-lg font-bold disabled:opacity-50"
                  >
                    {generating ? 'Generating...' : 'Re-shuffle Teams'}
                  </button>
                  <button
                    onClick={clearTeams}
                    disabled={generating}
                    className="btn-touch bg-red-600 hover:bg-red-700 px-4 py-3 rounded-lg font-bold disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {canProceed && (
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Ready to Start</h2>
          <p className="text-gray-400 mb-4">
            {teams.length} teams have been created. You can now open registration or start the tournament.
          </p>
          <Link
            href={`/admin/tournaments/${tournamentId}`}
            className="btn-touch btn-primary px-8 py-4 text-xl font-bold inline-block"
          >
            Go to Tournament Management
          </Link>
        </div>
      )}
    </main>
  )
}
