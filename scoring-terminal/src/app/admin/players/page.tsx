'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Player } from '@shared/types'
import { useAuth } from '@/contexts/AuthContext'

// Helper to get API base URL
const getApiUrl = () => typeof window !== 'undefined' ? `http://${window.location.hostname}:8000/api` : 'http://localhost:8000/api'

export default function PlayersPage() {
  const { token, isAuthenticated } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
  })

  useEffect(() => {
    loadPlayers()
  }, [])

  async function loadPlayers() {
    try {
      const response = await fetch(`${getApiUrl()}/players`)
      const data = await response.json()
      // Filter out admin accounts (emails ending in @thebar.com)
      const playerAccounts = data.filter((p: Player) => !p.email?.endsWith('@thebar.com'))
      setPlayers(playerAccounts)
    } catch (err) {
      console.error('Error loading players:', err)
    } finally {
      setLoading(false)
    }
  }

  async function deletePlayer(playerId: string) {
    if (!token) {
      setError('Please login to delete players')
      return
    }

    try {
      const response = await fetch(`${getApiUrl()}/players/${playerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to delete player')
      }

      setDeleteConfirm(null)
      loadPlayers()
    } catch (err: any) {
      setError(err.message || 'Failed to delete player')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormLoading(true)
    setError('')

    try {
      const response = await fetch(`${getApiUrl()}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to register player')
      }

      // Reset form and reload players
      setFormData({ name: '', email: '', password: '', phone: '' })
      setShowForm(false)
      loadPlayers()
    } catch (err: any) {
      setError(err.message || 'Failed to register player')
    } finally {
      setFormLoading(false)
    }
  }

  function exportToCSV() {
    // Create CSV content
    const headers = ['Name', 'Email', 'Phone']
    const rows = players.map(p => [
      p.name,
      p.email,
      p.phone || ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `players_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="btn-touch btn-secondary px-4 py-2">
            &larr; Back
          </Link>
          <h1 className="text-4xl font-bold">Players</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToCSV}
            disabled={players.length === 0}
            className="btn-touch bg-green-600 hover:bg-green-700 px-6 py-3 disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-touch btn-primary px-6 py-3"
          >
            {showForm ? 'Cancel' : '+ Add Player'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-gray-800 rounded-lg p-6 mb-8 max-w-xl">
          <h2 className="text-2xl font-bold mb-4">Register New Player</h2>

          {error && (
            <div className="bg-red-600 text-white p-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder="Player name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder="player@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Password *</label>
              <input
                type="password"
                required
                minLength={8}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder="Minimum 8 characters"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder="Optional"
              />
            </div>

            <button
              type="submit"
              disabled={formLoading}
              className="btn-touch btn-primary w-full py-3 font-bold disabled:opacity-50"
            >
              {formLoading ? 'Registering...' : 'Register Player'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <p>Loading players...</p>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="text-left p-4">Name</th>
                <th className="text-left p-4">Email</th>
                <th className="text-left p-4">Phone</th>
                {isAuthenticated && <th className="text-left p-4">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id} className="border-t border-gray-700 hover:bg-gray-750">
                  <td className="p-4 font-medium">{player.name}</td>
                  <td className="p-4 text-gray-400">{player.email}</td>
                  <td className="p-4 text-gray-400">{player.phone || '-'}</td>
                  {isAuthenticated && (
                    <td className="p-4">
                      {deleteConfirm === player.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => deletePlayer(player.id)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(player.id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {players.length === 0 && (
            <p className="p-8 text-center text-gray-400">No players registered yet.</p>
          )}
        </div>
      )}

      <div className="mt-4 text-gray-400">
        Total: {players.length} players
      </div>
    </main>
  )
}
