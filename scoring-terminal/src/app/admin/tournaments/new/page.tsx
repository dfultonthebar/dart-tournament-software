'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Event, Player, SportType } from '@shared/types'
import { getApiUrl } from '@shared/lib/api-url'
import Breadcrumbs, { BreadcrumbItem } from '@/components/Breadcrumbs'

const GAME_TYPES = [
  { value: '501', label: '501' },
  { value: '301', label: '301' },
  { value: 'cricket', label: 'Cricket' },
]

const FORMATS = [
  { value: 'single_elimination', label: 'Single Elimination' },
  { value: 'double_elimination', label: 'Double Elimination' },
  { value: 'round_robin', label: 'Round Robin' },
  { value: 'lucky_draw_doubles', label: 'Lucky Draw Doubles' },
]

const GAME_TYPE_DEFAULTS: Record<string, { legs_to_win: number; sets_to_win: number; double_in: boolean; double_out: boolean; master_out: boolean }> = {
  '501': { legs_to_win: 3, sets_to_win: 1, double_in: false, double_out: true, master_out: false },
  '301': { legs_to_win: 3, sets_to_win: 1, double_in: true, double_out: true, master_out: false },
  'cricket': { legs_to_win: 3, sets_to_win: 1, double_in: false, double_out: false, master_out: false },
}

function NewTournamentWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const eventIdParam = searchParams.get('event_id')
  const { token, isAuthenticated, isLoading: authLoading } = useAuth()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [event, setEvent] = useState<Event | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [loadingData, setLoadingData] = useState(true)

  // Step 1: Basics
  const [formData, setFormData] = useState({
    event_id: eventIdParam || '',
    name: '',
    description: '',
    game_type: '501',
    format: 'single_elimination',
    scheduled_date: '',
    scheduled_time: '',
  })

  // Step 2: Rules
  const [rules, setRules] = useState({
    max_players: 16,
    legs_to_win: 3,
    sets_to_win: 1,
    double_in: false,
    double_out: true,
    master_out: false,
    is_coed: false,
  })

  // Step 3: Players
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set())
  const [markSelectedPaid, setMarkSelectedPaid] = useState(false)
  const [playerSearch, setPlayerSearch] = useState('')

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/admin/login')
    }
  }, [isAuthenticated, authLoading, router])

  useEffect(() => {
    loadInitialData()
  }, [eventIdParam])

  // Update rules when game type changes
  useEffect(() => {
    const defaults = GAME_TYPE_DEFAULTS[formData.game_type]
    if (defaults) {
      setRules(prev => ({ ...prev, ...defaults }))
    }
  }, [formData.game_type])

  async function loadInitialData() {
    setLoadingData(true)
    try {
      const [eventsResponse, playersResponse] = await Promise.all([
        fetch(`${getApiUrl()}/events`),
        fetch(`${getApiUrl()}/players`),
      ])

      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json()
        const filteredEvents = eventsData.filter((e: Event) =>
          e.sport_type === SportType.DARTS &&
          (e.status === 'draft' || e.status === 'registration' || e.status === 'active')
        )
        setEvents(filteredEvents)
      }

      if (playersResponse.ok) {
        const playersData = await playersResponse.json()
        setAllPlayers(playersData.filter((p: Player) =>
          p.is_active && !p.email?.endsWith('@thebar.com')
        ))
      }

      if (eventIdParam) {
        const eventRes = await fetch(`${getApiUrl()}/events/${eventIdParam}`)
        if (eventRes.ok) {
          const eventData = await eventRes.json()
          setEvent(eventData)
          setFormData(prev => ({ ...prev, event_id: eventIdParam }))
        } else {
          setError('Event not found')
        }
      }
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoadingData(false)
    }
  }

  function validateStep1(): boolean {
    if (!formData.event_id) {
      setError('Please select an event')
      return false
    }
    if (!formData.name.trim()) {
      setError('Please enter a tournament name')
      return false
    }
    setError('')
    return true
  }

  function validateStep2(): boolean {
    if (rules.legs_to_win < 1) {
      setError('Legs to win must be at least 1')
      return false
    }
    if (rules.sets_to_win < 1) {
      setError('Sets to win must be at least 1')
      return false
    }
    setError('')
    return true
  }

  function nextStep() {
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    setStep(s => Math.min(s + 1, 3))
  }

  function prevStep() {
    setError('')
    setStep(s => Math.max(s - 1, 1))
  }

  function getFilteredPlayers(): Player[] {
    if (!playerSearch.trim()) return allPlayers
    const search = playerSearch.toLowerCase()
    return allPlayers.filter(p =>
      p.name.toLowerCase().includes(search) ||
      p.email?.toLowerCase().includes(search)
    )
  }

  function togglePlayer(playerId: string) {
    setSelectedPlayers(prev => {
      const next = new Set(prev)
      if (next.has(playerId)) {
        next.delete(playerId)
      } else {
        next.add(playerId)
      }
      return next
    })
  }

  function selectAllFiltered() {
    const filtered = getFilteredPlayers()
    setSelectedPlayers(new Set(filtered.map(p => p.id)))
  }

  function deselectAll() {
    setSelectedPlayers(new Set())
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')

    try {
      // Create tournament
      const submitData: Record<string, unknown> = {
        ...formData,
        ...rules,
      }
      if (!submitData.scheduled_date) delete submitData.scheduled_date
      if (!submitData.scheduled_time) delete submitData.scheduled_time

      const response = await fetch(`${getApiUrl()}/tournaments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(submitData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to create tournament')
      }

      const tournament = await response.json()

      // Add selected players
      if (selectedPlayers.size > 0) {
        const playerIds = Array.from(selectedPlayers)
        for (const playerId of playerIds) {
          try {
            const addRes = await fetch(`${getApiUrl()}/tournaments/${tournament.id}/entries/${playerId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
            })

            // Mark paid if checkbox was checked
            if (addRes.ok && markSelectedPaid) {
              const entryData = await addRes.json()
              await fetch(`${getApiUrl()}/tournaments/${tournament.id}/entries/${entryData.id}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ paid: true }),
              })
            }
          } catch {
            // Continue adding other players
          }
        }
      }

      router.push(`/admin/tournaments/${tournament.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create tournament')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || loadingData) {
    return <main className="min-h-screen p-8"><p>Loading...</p></main>
  }

  if (!isAuthenticated) {
    return <main className="min-h-screen p-8"><p>Redirecting to login...</p></main>
  }

  if (!eventIdParam && events.length === 0) {
    return (
      <main className="min-h-screen p-6 lg:p-8">
        <Breadcrumbs items={[
          { label: 'Dashboard', href: '/admin/darts' },
          { label: 'Tournaments', href: '/admin/tournaments' },
          { label: 'New Tournament' },
        ]} />

        <h1 className="text-3xl font-bold mb-6">Create Tournament</h1>

        <div className="bg-yellow-600 text-white p-6 rounded-lg max-w-2xl">
          <h2 className="text-xl font-bold mb-2">No Events Available</h2>
          <p className="mb-4">
            Tournaments must be created within an event. Please create a Darts event first.
          </p>
          <Link
            href="/admin/events/new?sport=darts"
            className="btn-touch btn-primary px-6 py-3 inline-block no-underline text-white"
          >
            Create Darts Event
          </Link>
        </div>
      </main>
    )
  }

  // Build breadcrumbs
  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Dashboard', href: '/admin/darts' },
  ]
  if (event) {
    breadcrumbs.push({ label: 'Events', href: '/admin/events' })
    breadcrumbs.push({ label: event.name, href: `/admin/events/${event.id}` })
  } else {
    breadcrumbs.push({ label: 'Tournaments', href: '/admin/tournaments' })
  }
  breadcrumbs.push({ label: 'New Tournament' })

  const filteredPlayers = getFilteredPlayers()

  return (
    <main className="min-h-screen p-6 lg:p-8">
      <Breadcrumbs items={breadcrumbs} />

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Create Tournament</h1>
        {event && (
          <p className="text-gray-400 mt-1">
            for event: <span className="text-white">{event.name}</span>
          </p>
        )}
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center gap-2 mb-8 max-w-2xl">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center flex-1">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
              s < step ? 'bg-green-600 text-white' :
              s === step ? 'bg-blue-600 text-white' :
              'bg-gray-700 text-gray-400'
            }`}>
              {s < step ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : s}
            </div>
            <div className={`flex-1 h-1 mx-2 rounded ${
              s < step ? 'bg-green-600' :
              s === step ? 'bg-blue-600' :
              'bg-gray-700'
            } ${s === 3 ? 'hidden' : ''}`} />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 mb-6 text-sm">
        <span className={step === 1 ? 'text-blue-400 font-medium' : step > 1 ? 'text-green-400' : 'text-gray-500'}>
          1. Basics
        </span>
        <span className="text-gray-600">&rarr;</span>
        <span className={step === 2 ? 'text-blue-400 font-medium' : step > 2 ? 'text-green-400' : 'text-gray-500'}>
          2. Rules
        </span>
        <span className="text-gray-600">&rarr;</span>
        <span className={step === 3 ? 'text-blue-400 font-medium' : 'text-gray-500'}>
          3. Players
        </span>
      </div>

      {error && (
        <div className="bg-red-600 text-white p-4 rounded-lg mb-6 max-w-2xl">
          {error}
        </div>
      )}

      {/* Step 1: Basics */}
      {step === 1 && (
        <div className="max-w-2xl space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Event *</label>
            <select
              value={formData.event_id}
              onChange={(e) => setFormData({ ...formData, event_id: e.target.value })}
              className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
              required
            >
              <option value="">Select an event...</option>
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.name} ({evt.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Tournament Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
              placeholder="e.g., 501 Singles Championship"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Game Type *</label>
              <select
                value={formData.game_type}
                onChange={(e) => setFormData({ ...formData, game_type: e.target.value })}
                className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
              >
                {GAME_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Format *</label>
              <select
                value={formData.format}
                onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
              >
                {FORMATS.map((format) => (
                  <option key={format.value} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formData.format === 'lucky_draw_doubles' && (
            <p className="text-sm text-yellow-400 bg-yellow-900/30 p-3 rounded-lg">
              Teams will be randomly assigned from registered players. Requires an even number of players.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Description (optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
              rows={2}
              placeholder="Optional description..."
            />
          </div>

          <button
            onClick={nextStep}
            className="btn-touch btn-primary w-full py-4 text-xl font-bold"
          >
            Next: Set Rules &rarr;
          </button>
        </div>
      )}

      {/* Step 2: Rules */}
      {step === 2 && (
        <div className="max-w-2xl space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Max Players</label>
              <input
                type="number"
                min="2"
                max="128"
                value={rules.max_players}
                onChange={(e) => setRules({ ...rules, max_players: parseInt(e.target.value) || 16 })}
                className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Legs to Win</label>
              <input
                type="number"
                min="1"
                max="11"
                value={rules.legs_to_win}
                onChange={(e) => setRules({ ...rules, legs_to_win: parseInt(e.target.value) || 3 })}
                className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Sets to Win</label>
              <input
                type="number"
                min="1"
                max="7"
                value={rules.sets_to_win}
                onChange={(e) => setRules({ ...rules, sets_to_win: parseInt(e.target.value) || 1 })}
                className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium">Finish Rules</label>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rules.double_in}
                  onChange={(e) => setRules({ ...rules, double_in: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
                <span>Double In</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rules.double_out}
                  onChange={(e) => setRules({ ...rules, double_out: e.target.checked, master_out: false })}
                  className="w-5 h-5 rounded"
                />
                <span>Double Out</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rules.master_out}
                  onChange={(e) => setRules({ ...rules, master_out: e.target.checked, double_out: false })}
                  className="w-5 h-5 rounded"
                />
                <span>Master Out</span>
                <span className="text-xs text-gray-400">(double, triple, or bull)</span>
              </label>
            </div>
          </div>

          {formData.format === 'lucky_draw_doubles' && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rules.is_coed}
                  onChange={(e) => setRules({ ...rules, is_coed: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
                <div>
                  <span className="font-medium">Co-ed Teams</span>
                  <p className="text-sm text-gray-400 mt-1">
                    Pair one male + one female per team. Players must have gender set during registration.
                  </p>
                </div>
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Scheduled Date (optional)</label>
              <input
                type="date"
                value={formData.scheduled_date}
                onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Scheduled Time (optional)</label>
              <input
                type="time"
                value={formData.scheduled_time}
                onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={prevStep}
              className="btn-touch btn-secondary flex-1 py-4 text-lg font-bold"
            >
              &larr; Back
            </button>
            <button
              onClick={nextStep}
              className="btn-touch btn-primary flex-1 py-4 text-lg font-bold"
            >
              Next: Add Players &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Players */}
      {step === 3 && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm">
              Select players to add to this tournament. You can also add players later from the tournament detail page.
            </p>
          </div>

          {/* Search */}
          <input
            type="text"
            value={playerSearch}
            onChange={(e) => setPlayerSearch(e.target.value)}
            placeholder="Search players by name or email..."
            className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
          />

          {/* Controls */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">
              {selectedPlayers.size} selected of {allPlayers.length} players
            </span>
            <div className="flex gap-2">
              <button
                onClick={selectAllFiltered}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                disabled={selectedPlayers.size === 0}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm disabled:opacity-50"
              >
                Deselect All
              </button>
            </div>
          </div>

          {/* Player checkboxes */}
          <div className="max-h-80 overflow-y-auto space-y-1 border border-gray-700 rounded-lg p-2 bg-gray-800">
            {filteredPlayers.map((player) => (
              <label
                key={player.id}
                className="flex items-center gap-3 p-2 rounded hover:bg-gray-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedPlayers.has(player.id)}
                  onChange={() => togglePlayer(player.id)}
                  className="w-5 h-5 accent-blue-500"
                />
                <span className="flex-1">{player.name}</span>
                {player.email && (
                  <span className="text-sm text-gray-500">{player.email}</span>
                )}
              </label>
            ))}
            {filteredPlayers.length === 0 && (
              <p className="text-gray-500 text-center py-4 text-sm">
                {playerSearch ? 'No matching players' : 'No players available'}
              </p>
            )}
          </div>

          {/* Mark as paid */}
          {selectedPlayers.size > 0 && (
            <label className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg border border-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={markSelectedPaid}
                onChange={(e) => setMarkSelectedPaid(e.target.checked)}
                className="w-5 h-5 accent-green-500"
              />
              <div>
                <span className="font-medium">Mark all selected players as paid</span>
                <p className="text-sm text-gray-400">Toggle payment status for {selectedPlayers.size} player{selectedPlayers.size !== 1 ? 's' : ''}</p>
              </div>
            </label>
          )}

          <div className="flex gap-4">
            <button
              onClick={prevStep}
              className="btn-touch btn-secondary flex-1 py-4 text-lg font-bold"
            >
              &larr; Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !formData.event_id}
              className="btn-touch btn-primary flex-1 py-4 text-xl font-bold disabled:opacity-50"
            >
              {loading ? 'Creating...' : `Create Tournament${selectedPlayers.size > 0 ? ` (${selectedPlayers.size} players)` : ''}`}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

export default function NewTournamentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-8"><p>Loading...</p></div>}>
      <NewTournamentWizard />
    </Suspense>
  )
}
