'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getApiUrl } from '@shared/lib/api-url'
import { WebSocketEventType, BoardAssignedData } from '@shared/types'
import { wsClient } from '@/lib/websocket'
import MatchNotification, { MatchNotificationItem } from '@/components/MatchNotification'

let notifCounter = 0

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<MatchNotificationItem[]>([])
  const [playerId, setPlayerId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioPrimed = useRef(false)

  // Prime audio context on first user interaction (mobile browsers block autoplay)
  useEffect(() => {
    function primeAudio() {
      if (audioPrimed.current) return
      audioPrimed.current = true

      // Create a short silent audio to unlock the audio context
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const buffer = ctx.createBuffer(1, 1, 22050)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.start(0)

      // Also prime our notification chime
      if (audioRef.current) {
        audioRef.current.load()
      }
    }

    document.addEventListener('touchstart', primeAudio, { once: true })
    document.addEventListener('click', primeAudio, { once: true })

    return () => {
      document.removeEventListener('touchstart', primeAudio)
      document.removeEventListener('click', primeAudio)
    }
  }, [])

  // Connect WebSocket with player identity
  useEffect(() => {
    const token = localStorage.getItem('player_token')
    if (!token) return

    fetch(`${getApiUrl()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then(data => {
        setPlayerId(data.id)
        wsClient.setPlayerId(data.id)
      })
      .catch(() => {
        // Not logged in — no WS player identity
      })
  }, [])

  // Handle board:assigned events
  const handleBoardAssigned = useCallback((message: { data?: BoardAssignedData }) => {
    if (!message.data || !playerId) return

    const data = message.data
    // Only show notification if current player is in this match
    const isMyMatch = data.players?.some(p => p.player_id === playerId)
    if (!isMyMatch) return

    const id = `notif-${++notifCounter}`
    setNotifications(prev => [...prev, { id, data, currentPlayerId: playerId }])

    // Play notification sound
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {
        // Audio play failed (user hasn't interacted yet)
      })
    }

    // Vibrate on supported devices (Android)
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 200])
    }
  }, [playerId])

  useEffect(() => {
    if (!playerId) return

    wsClient.on(WebSocketEventType.BOARD_ASSIGNED, handleBoardAssigned)

    return () => {
      wsClient.off(WebSocketEventType.BOARD_ASSIGNED, handleBoardAssigned)
    }
  }, [playerId, handleBoardAssigned])

  // Reconnect and re-poll on visibility change (phone wakes from sleep)
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && playerId) {
        // Ensure WebSocket is connected
        wsClient.setPlayerId(playerId)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [playerId])

  function dismissNotification(id: string) {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  return (
    <>
      {/* Notification chime - short tone generated via data URI */}
      <audio
        ref={audioRef}
        preload="auto"
        src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVoGAACAgICAgICAgICAgICAgICAgICA
gH1xZV1YV1pdZnF9iJOdpqqrrqunoZqRh3xwZVtUUVFUW2VwhJCcp6+0tLOvqaGYjYF2a2JbV1da
Ym15hpKdqbC0trWxrKWckoiAd29oY2BhZGlxeIOOl6GorK2sqaWfmZGJgXpzb2xrbW9zeX+Fio+U
l5mZl5SSjoqFgX15d3V1d3l7foGDhYeIiIeGhYSCgH58e3p6ent8fH19fn5+fn5+fn5+fn5+fn5+
fn5+fn5+f4CAgYKDhIWGh4iIiYmJiIiHhoWEgoGAf359fHt6eXl5eXl6ent8fX5/gIGChIOEhYaH
iImJiomJiIeGhYOCgX9+fXx7enp5eXl5eXp7fH1+f4CCg4WGiImKi4yMjIuKiYiGhYOBf35+fXx7
e3t7e3x9fn+AgoOEhoeIiYmJiYmIh4aFg4KAf359fXx8fHx8fX5/gIGCg4SFhoeHh4eGhYSEgoGA
f359fHt6enp6ent8fX5/gYKDhYaHiImJiYmIh4WEgoGAf359fHt7e3t7fH1+gIGDhIaHiImKioqK
iYiHhYSCgH9+fXx7e3t7e3x9fn+AgoSFhoeIiYmIiIeGhYSDgYB/fn19fHx8fH1+f4CBgoOEhYaH
h4eHh4aFhIOCgIB/fn19fX1+fn+AgIGCgoODg4ODgoKBgH9/fn19fX1+fn+AgIGBgoKDg4ODg4OC
goGAgH9/fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+"
      />

      {/* Notification overlay — renders above all child pages */}
      <MatchNotification
        notifications={notifications}
        onDismiss={dismissNotification}
      />

      {/* Page content */}
      {children}
    </>
  )
}
