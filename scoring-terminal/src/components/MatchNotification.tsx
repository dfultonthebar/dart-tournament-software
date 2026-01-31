'use client'

import { useState } from 'react'
import { getApiUrl } from '@shared/lib/api-url'
import { getErrorMessage } from '@shared/lib/error-message'
import { BoardAssignedData } from '@shared/types'

export interface MatchNotificationItem {
  id: string
  data: BoardAssignedData
  currentPlayerId: string
}

interface Props {
  notifications: MatchNotificationItem[]
  onDismiss: (id: string) => void
}

export default function MatchNotification({ notifications, onDismiss }: Props) {
  const [loading, setLoading] = useState(false)

  if (notifications.length === 0) return null

  // Show one notification at a time (queue)
  const notification = notifications[0]
  const { data, currentPlayerId } = notification

  // Build matchup label
  const players = data.players || []
  const hasTeams = players.some(p => p.team_id)

  let matchupLabel: string

  if (hasTeams) {
    // Doubles: find current player's team
    const me = players.find(p => p.player_id === currentPlayerId)
    const myTeamId = me?.team_id

    const myTeam = players
      .filter(p => p.team_id === myTeamId && p.player_id !== currentPlayerId)
      .map(p => p.player_name)
    const oppTeam = players
      .filter(p => p.team_id !== myTeamId)
      .map(p => p.player_name)

    const myLabel = myTeam.length > 0 ? `You & ${myTeam.join(' & ')}` : 'You'
    const oppLabel = oppTeam.join(' & ') || 'TBD'
    matchupLabel = `${myLabel} vs ${oppLabel}`
  } else {
    // Singles
    const opponent = players.find(p => p.player_id !== currentPlayerId)
    matchupLabel = `You vs ${opponent?.player_name || 'TBD'}`
  }

  const boardDisplay = data.dartboard_name || `Board ${data.dartboard_number}`

  async function handleOnMyWay() {
    setLoading(true)
    try {
      const token = localStorage.getItem('player_token')
      if (token) {
        await fetch(`${getApiUrl()}/matches/${data.match_id}/arrive`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      }
    } catch (err) {
      console.error('Failed to mark arrival:', getErrorMessage(err))
    } finally {
      setLoading(false)
      onDismiss(notification.id)
    }
  }

  function handleGotIt() {
    onDismiss(notification.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        {/* Pulsing header */}
        <h1 className="text-3xl font-black text-yellow-400 animate-pulse">
          YOUR MATCH IS READY!
        </h1>

        {/* Board number */}
        <div className="bg-blue-900/60 border-2 border-blue-400 rounded-2xl py-6 px-4">
          <p className="text-blue-300 text-sm font-medium mb-1">Go to</p>
          <p className="text-5xl font-black text-blue-300">{boardDisplay}</p>
        </div>

        {/* Matchup */}
        <p className="text-xl font-bold text-white">{matchupLabel}</p>

        {/* Queue indicator */}
        {notifications.length > 1 && (
          <p className="text-sm text-gray-400">
            +{notifications.length - 1} more notification{notifications.length > 2 ? 's' : ''}
          </p>
        )}

        {/* Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleOnMyWay}
            disabled={loading}
            className="w-full py-4 bg-green-600 hover:bg-green-700 active:bg-green-800 rounded-xl text-xl font-bold text-white disabled:opacity-50 transition"
          >
            {loading ? 'Checking in...' : "I'm On My Way"}
          </button>
          <button
            onClick={handleGotIt}
            className="w-full py-3 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 rounded-xl text-lg font-medium text-gray-300 transition"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  )
}
