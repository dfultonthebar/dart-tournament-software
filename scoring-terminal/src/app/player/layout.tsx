'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getApiUrl } from '@shared/lib/api-url'
import { WebSocketEventType, BoardAssignedData } from '@shared/types'
import { wsClient } from '@/lib/websocket'
import MatchNotification, { MatchNotificationItem } from '@/components/MatchNotification'

let notifCounter = 0

/** Play a two-tone chime using the Web Audio API. Works on mobile after any user tap. */
function playChime(audioCtx: AudioContext) {
  const now = audioCtx.currentTime

  // First tone: E5 (659 Hz)
  const osc1 = audioCtx.createOscillator()
  const gain1 = audioCtx.createGain()
  osc1.type = 'sine'
  osc1.frequency.value = 659
  gain1.gain.setValueAtTime(0.4, now)
  gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
  osc1.connect(gain1)
  gain1.connect(audioCtx.destination)
  osc1.start(now)
  osc1.stop(now + 0.3)

  // Second tone: A5 (880 Hz), starts after a short gap
  const osc2 = audioCtx.createOscillator()
  const gain2 = audioCtx.createGain()
  osc2.type = 'sine'
  osc2.frequency.value = 880
  gain2.gain.setValueAtTime(0.4, now + 0.15)
  gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5)
  osc2.connect(gain2)
  gain2.connect(audioCtx.destination)
  osc2.start(now + 0.15)
  osc2.stop(now + 0.5)

  // Third tone: E6 (1319 Hz), completes the chime
  const osc3 = audioCtx.createOscillator()
  const gain3 = audioCtx.createGain()
  osc3.type = 'sine'
  osc3.frequency.value = 1319
  gain3.gain.setValueAtTime(0.3, now + 0.3)
  gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.8)
  osc3.connect(gain3)
  gain3.connect(audioCtx.destination)
  osc3.start(now + 0.3)
  osc3.stop(now + 0.8)
}

// Shared AudioContext — created on first user interaction, reused for all chimes
let sharedAudioCtx: AudioContext | null = null

function getOrCreateAudioCtx(): AudioContext {
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    sharedAudioCtx = new AudioCtx()
  }
  return sharedAudioCtx
}

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<MatchNotificationItem[]>([])
  const [playerId, setPlayerId] = useState<string | null>(null)

  // Prime AudioContext on first user interaction (mobile browsers require this)
  useEffect(() => {
    function primeAudio() {
      const ctx = getOrCreateAudioCtx()
      if (ctx.state === 'suspended') {
        ctx.resume()
      }
      // Play a silent buffer to fully unlock audio on iOS
      const buffer = ctx.createBuffer(1, 1, 22050)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.start(0)
    }

    document.addEventListener('touchstart', primeAudio)
    document.addEventListener('click', primeAudio)

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
        console.log('[PlayerLayout] Got player ID:', data.id)
        setPlayerId(data.id)
        wsClient.setPlayerId(data.id)
      })
      .catch((err) => {
        console.warn('[PlayerLayout] Auth failed, no WS identity:', err)
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

    // Play notification chime
    try {
      const ctx = getOrCreateAudioCtx()
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => playChime(ctx)).catch(() => {})
      } else {
        playChime(ctx)
      }
    } catch (e) {
      console.warn('[PlayerLayout] Failed to play chime:', e)
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
