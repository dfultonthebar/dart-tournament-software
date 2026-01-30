'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { getApiUrl } from '@shared/lib/api-url'
import Breadcrumbs from '@/components/Breadcrumbs'
import { getErrorMessage } from '@shared/lib/error-message'

interface Dartboard {
  id: string
  number: number
  name: string | null
  is_available: boolean
  created_at: string
}

interface Match {
  id: string
  round_number: number
  match_number: number
  tournament_id: string
  dartboard_id: string | null
}

interface MatchWithTournament extends Match {
  tournament_name?: string
}

export default function DartboardsPage() {
  const { token, isAuthenticated } = useAuth()
  const [dartboards, setDartboards] = useState<Dartboard[]>([])
  const [matchesByBoard, setMatchesByBoard] = useState<Record<string, MatchWithTournament>>({})
  const [loading, setLoading] = useState(true)
  const [newBoardNumber, setNewBoardNumber] = useState('')
  const [newBoardName, setNewBoardName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    loadDartboards()
    loadActiveMatches()
  }, [])

  async function loadDartboards() {
    try {
      const response = await fetch(`${getApiUrl()}/dartboards`)
      if (!response.ok) throw new Error('Failed to load dartboards')
      const data = await response.json()
      setDartboards(data)
    } catch (err) {
      setError(getErrorMessage(err) || 'Failed to load dartboards')
    } finally {
      setLoading(false)
    }
  }

  async function loadActiveMatches() {
    try {
      // Load all matches to find which boards are in use
      const response = await fetch(`${getApiUrl()}/matches`)
      if (!response.ok) return

      const matches = await response.json()
      const boardToMatch: Record<string, MatchWithTournament> = {}

      // Get active matches (pending or in_progress) with dartboard assignments
      for (const match of matches) {
        if (match.dartboard_id && (match.status === 'pending' || match.status === 'in_progress')) {
          // Try to get tournament name
          try {
            const tournamentResponse = await fetch(`${getApiUrl()}/tournaments/${match.tournament_id}`)
            if (tournamentResponse.ok) {
              const tournament = await tournamentResponse.json()
              boardToMatch[match.dartboard_id] = {
                ...match,
                tournament_name: tournament.name
              }
            } else {
              boardToMatch[match.dartboard_id] = match
            }
          } catch {
            boardToMatch[match.dartboard_id] = match
          }
        }
      }

      setMatchesByBoard(boardToMatch)
    } catch (err) {
      console.error('Error loading matches:', err)
    }
  }

  async function handleAddDartboard(e: React.FormEvent) {
    e.preventDefault()
    if (!token) {
      setError('Please login to add dartboards')
      return
    }

    setFormLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`${getApiUrl()}/dartboards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          number: parseInt(newBoardNumber),
          name: newBoardName || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to create dartboard')
      }

      setNewBoardNumber('')
      setNewBoardName('')
      setSuccess('Dartboard added successfully!')
      loadDartboards()
    } catch (err) {
      setError(getErrorMessage(err) || 'Failed to create dartboard')
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDeleteDartboard(dartboardId: string) {
    if (!token) {
      setError('Please login to delete dartboards')
      return
    }

    try {
      const response = await fetch(`${getApiUrl()}/dartboards/${dartboardId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to delete dartboard')
      }

      setDeleteConfirm(null)
      setSuccess('Dartboard deleted successfully!')
      loadDartboards()
    } catch (err) {
      setError(getErrorMessage(err) || 'Failed to delete dartboard')
    }
  }

  return (
    <main className="min-h-screen p-6 lg:p-8">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/admin/darts' },
        { label: 'Dartboards' },
      ]} />

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Dartboards</h1>
      </div>

      {!isAuthenticated && (
        <div className="bg-yellow-600 text-white p-4 rounded-lg mb-6">
          You need to <Link href="/admin/login" className="underline font-bold">login</Link> to manage dartboards.
        </div>
      )}

      {error && (
        <div className="bg-red-600 text-white p-4 rounded-lg mb-6">
          {error}
          <button onClick={() => setError('')} className="ml-4 text-white underline">
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-600 text-white p-4 rounded-lg mb-6">
          {success}
          <button onClick={() => setSuccess('')} className="ml-4 text-white underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Add New Dartboard Form */}
      {isAuthenticated && (
        <div className="bg-gray-800 rounded-lg p-6 mb-8 max-w-xl">
          <h2 className="text-2xl font-bold mb-4">Add New Dartboard</h2>

          <form onSubmit={handleAddDartboard} className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Board Number *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newBoardNumber}
                  onChange={(e) => setNewBoardNumber(e.target.value)}
                  className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-teal-500 focus:outline-none text-lg"
                  placeholder="1"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Name (Optional)</label>
                <input
                  type="text"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-teal-500 focus:outline-none text-lg"
                  placeholder="Main Stage"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={formLoading || !newBoardNumber}
              className="btn-touch bg-teal-600 hover:bg-teal-700 w-full py-3 font-bold disabled:opacity-50 rounded-lg"
            >
              {formLoading ? 'Adding...' : '+ Add Dartboard'}
            </button>
          </form>
        </div>
      )}

      {/* Dartboards List */}
      {loading ? (
        <p>Loading dartboards...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dartboards.map((board) => {
            const activeMatch = matchesByBoard[board.id]
            return (
              <div
                key={board.id}
                className={`p-6 rounded-lg border-2 ${
                  board.is_available
                    ? 'bg-gray-800 border-green-500'
                    : 'bg-gray-800 border-red-500'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-3xl font-bold">Board {board.number}</div>
                    {board.name && (
                      <div className="text-gray-400 text-lg">{board.name}</div>
                    )}
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      board.is_available
                        ? 'bg-green-600 text-white'
                        : 'bg-red-600 text-white'
                    }`}
                  >
                    {board.is_available ? 'Available' : 'In Use'}
                  </div>
                </div>

                {activeMatch && (
                  <div className="bg-gray-700 rounded-lg p-3 mb-4">
                    <div className="text-sm text-gray-400 mb-1">Current Match:</div>
                    <div className="font-medium">
                      {activeMatch.tournament_name || 'Tournament'}
                    </div>
                    <div className="text-sm text-gray-400">
                      Round {activeMatch.round_number}, Match {activeMatch.match_number}
                    </div>
                    <Link
                      href={`/score/${activeMatch.id}`}
                      className="text-teal-400 hover:underline text-sm mt-2 inline-block"
                    >
                      Go to Scoring &rarr;
                    </Link>
                  </div>
                )}

                {isAuthenticated && (
                  <div className="mt-4">
                    {deleteConfirm === board.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteDartboard(board.id)}
                          className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium"
                        >
                          Confirm Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(board.id)}
                        disabled={!board.is_available}
                        className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium"
                        title={!board.is_available ? 'Cannot delete board in use' : ''}
                      >
                        Delete Dartboard
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!loading && dartboards.length === 0 && (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <div className="text-gray-400 text-lg mb-4">No dartboards configured yet.</div>
          {isAuthenticated && (
            <div className="text-gray-500">Use the form above to add your first dartboard.</div>
          )}
        </div>
      )}

      <div className="mt-6 text-gray-400">
        Total: {dartboards.length} dartboards ({dartboards.filter(d => d.is_available).length} available)
      </div>
    </main>
  )
}
