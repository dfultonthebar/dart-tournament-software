'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Tournament, Player, MatchWithPlayers, MatchPlayerInfo, MatchStatus, Team } from '@shared/types'
import { getApiUrl } from '@shared/lib/api-url'

export default function BracketPage() {
  const params = useParams()
  const tournamentId = params.id as string

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<MatchWithPlayers[]>([])
  const [players, setPlayers] = useState<Record<string, Player>>({})
  const [teamMap, setTeamMap] = useState<Record<string, Team>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [tournamentId])

  async function loadData() {
    try {
      const [tournamentRes, matchesRes, playersRes, teamsRes] = await Promise.all([
        fetch(`${getApiUrl()}/tournaments/${tournamentId}`),
        fetch(`${getApiUrl()}/matches?tournament_id=${tournamentId}`),
        fetch(`${getApiUrl()}/players`),
        fetch(`${getApiUrl()}/tournaments/${tournamentId}/teams`),
      ])

      setTournament(await tournamentRes.json())
      setMatches(await matchesRes.json())

      const playersData = await playersRes.json()
      const playerMap: Record<string, Player> = {}
      playersData.forEach((p: Player) => playerMap[p.id] = p)
      setPlayers(playerMap)

      const teamsData = teamsRes.ok ? await teamsRes.json() : []
      const tMap: Record<string, Team> = {}
      teamsData.forEach((t: Team) => { tMap[t.id] = t })
      setTeamMap(tMap)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  function getPlayerName(playerId: string): string {
    return players[playerId]?.name || 'TBD'
  }

  // Detect double elimination
  const isDoubleElim = useMemo(() => {
    return matches.some(m => {
      const bp = m.bracket_position || ''
      return bp.startsWith('WR') || bp.startsWith('LR') || bp.startsWith('GF')
    })
  }, [matches])

  // Double elimination grouping
  const doubleElimData = useMemo(() => {
    if (!isDoubleElim || matches.length === 0) return null

    const wbRounds = new Map<number, MatchWithPlayers[]>()
    const lbRounds = new Map<number, MatchWithPlayers[]>()
    let gf1: MatchWithPlayers | null = null
    let gf2: MatchWithPlayers | null = null

    for (const match of matches) {
      const bp = match.bracket_position || ''
      const wrMatch = bp.match(/^WR(\d+)M(\d+)$/)
      const lrMatch = bp.match(/^LR(\d+)M(\d+)$/)

      if (wrMatch) {
        const round = parseInt(wrMatch[1])
        const list = wbRounds.get(round) || []
        list.push(match)
        wbRounds.set(round, list)
      } else if (lrMatch) {
        const round = parseInt(lrMatch[1])
        const list = lbRounds.get(round) || []
        list.push(match)
        lbRounds.set(round, list)
      } else if (bp === 'GF1') {
        gf1 = match
      } else if (bp === 'GF2') {
        gf2 = match
      }
    }

    const sortByIdx = (a: MatchWithPlayers, b: MatchWithPlayers) => {
      const aM = (a.bracket_position || '').match(/M(\d+)/)
      const bM = (b.bracket_position || '').match(/M(\d+)/)
      return (aM ? parseInt(aM[1]) : 0) - (bM ? parseInt(bM[1]) : 0)
    }
    wbRounds.forEach((v, k) => wbRounds.set(k, v.sort(sortByIdx)))
    lbRounds.forEach((v, k) => lbRounds.set(k, v.sort(sortByIdx)))

    return {
      wbRounds,
      lbRounds,
      gf1,
      gf2,
      wbRoundNums: Array.from(wbRounds.keys()).sort((a, b) => a - b),
      lbRoundNums: Array.from(lbRounds.keys()).sort((a, b) => a - b),
    }
  }, [matches, isDoubleElim])

  const getMatchesByRound = useMemo(() => {
    if (isDoubleElim) return new Map<number, MatchWithPlayers[]>()
    const rounds = new Map<number, MatchWithPlayers[]>()
    matches.forEach(match => {
      const roundMatches = rounds.get(match.round_number) || []
      roundMatches.push(match)
      rounds.set(match.round_number, roundMatches)
    })
    rounds.forEach((roundMatches, round) => {
      rounds.set(round, roundMatches.sort((a, b) => a.match_number - b.match_number))
    })
    return rounds
  }, [matches, isDoubleElim])

  function getRoundName(round: number, totalRounds: number): string {
    const remaining = totalRounds - round + 1
    if (remaining === 1) return 'Final'
    if (remaining === 2) return 'Semi-Finals'
    if (remaining === 3) return 'Quarter-Finals'
    return `Round ${round}`
  }

  function renderMatchCard(match: MatchWithPlayers) {
    return (
      <div
        key={match.id}
        className={`bg-gray-800 rounded-lg p-3 my-2 border-l-4 ${
          match.status === MatchStatus.IN_PROGRESS ? 'border-yellow-500' :
          match.status === MatchStatus.COMPLETED ? 'border-green-500' :
          'border-blue-500'
        }`}
      >
        <div className="text-xs text-gray-500 mb-1">{match.bracket_position || `Match ${match.match_number}`}</div>
        {match.players.length === 0 ? (
          <div className="text-gray-500 italic py-2">Awaiting players</div>
        ) : match.players.some(mp => mp.team_id) ? (
          (() => {
            const teamGroups: Record<string, MatchPlayerInfo[]> = {}
            match.players.forEach(mp => {
              const key = mp.team_id || mp.player_id
              if (!teamGroups[key]) teamGroups[key] = []
              teamGroups[key].push(mp)
            })
            return Object.entries(teamGroups)
              .sort((a, b) => (a[1][0]?.position ?? 0) - (b[1][0]?.position ?? 0))
              .map(([tid, members]) => (
                <div
                  key={tid}
                  className={`flex justify-between py-1 ${
                    match.winner_team_id === tid ? 'text-green-400 font-bold' : ''
                  }`}
                >
                  <span>{teamMap[tid]?.name || members.map(m => getPlayerName(m.player_id)).join(' & ')}</span>
                  <span className="text-gray-400">{members[0]?.legs_won ?? 0}</span>
                </div>
              ))
          })()
        ) : (
          match.players
            .sort((a, b) => a.position - b.position)
            .map(mp => (
              <div
                key={mp.player_id}
                className={`flex justify-between py-1 ${
                  match.winner_id === mp.player_id ? 'text-green-400 font-bold' : ''
                }`}
              >
                <span>{getPlayerName(mp.player_id)}</span>
                <span className="text-gray-400">{mp.legs_won}</span>
              </div>
            ))
        )}
      </div>
    )
  }

  if (loading) {
    return <main className="min-h-screen p-8"><p>Loading bracket...</p></main>
  }

  if (!tournament) {
    return (
      <main className="min-h-screen p-8">
        <p>Tournament not found</p>
        <Link href="/brackets" className="text-blue-400 mt-4 block">Back to brackets</Link>
      </main>
    )
  }

  const roundsMap = getMatchesByRound
  const rounds = Array.from(roundsMap.keys()).sort((a, b) => a - b)
  const totalRounds = Math.max(...rounds, 1)

  return (
    <main className="min-h-screen p-4">
      <div className="flex items-center justify-between mb-6">
        <Link href="/brackets" className="btn-touch btn-secondary px-4 py-2">
          &larr; Back
        </Link>
        <div className="text-center">
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <div className="text-gray-400 text-sm">
            {tournament.game_type.toUpperCase()} • Best of {tournament.legs_to_win}
          </div>
        </div>
        <div className="w-20"></div>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xl text-gray-400">No matches yet</p>
        </div>
      ) : isDoubleElim && doubleElimData ? (
        /* ===== Double Elimination Layout ===== */
        <div className="overflow-x-auto pb-4 space-y-6">
          {/* Winners Bracket */}
          <div className="border border-gray-700 rounded-lg p-4">
            <h2 className="text-center text-green-400 font-bold text-lg mb-4">Winners Bracket</h2>
            <div className="flex justify-center overflow-x-auto">
              {doubleElimData.wbRoundNums.map(r => {
                const totalWB = doubleElimData.wbRoundNums.length
                const label = r === totalWB ? 'WB Final' : r === totalWB - 1 ? 'WB Semis' : `WB R${r}`
                return (
                  <div key={`wb-${r}`} className="flex flex-col justify-around min-w-[220px] mx-2">
                    <div className="text-center mb-4 font-bold text-gray-300">{label}</div>
                    {(doubleElimData.wbRounds.get(r) || []).map(match => renderMatchCard(match))}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Grand Final */}
          <div className="border border-yellow-600 rounded-lg p-4">
            <h2 className="text-center text-yellow-400 font-bold text-lg mb-4">Grand Final</h2>
            <div className="flex justify-center gap-4">
              {doubleElimData.gf1 && (
                <div className="min-w-[220px]">
                  <div className="text-center mb-2 font-bold text-gray-300">GF1</div>
                  {renderMatchCard(doubleElimData.gf1)}
                </div>
              )}
              {doubleElimData.gf2 && doubleElimData.gf2.status !== 'cancelled' && (
                <div className="min-w-[220px]">
                  <div className="text-center mb-2 font-bold text-gray-300">GF2 (Reset)</div>
                  {renderMatchCard(doubleElimData.gf2)}
                </div>
              )}
            </div>
          </div>

          {/* Losers Bracket */}
          <div className="border border-gray-700 rounded-lg p-4">
            <h2 className="text-center text-red-400 font-bold text-lg mb-4">Losers Bracket</h2>
            <div className="flex justify-center overflow-x-auto">
              {doubleElimData.lbRoundNums.map(r => {
                const totalLB = doubleElimData.lbRoundNums.length
                const label = r === totalLB ? 'LB Final' : `LB R${r}`
                return (
                  <div key={`lb-${r}`} className="flex flex-col justify-around min-w-[220px] mx-2">
                    <div className="text-center mb-4 font-bold text-gray-300">{label}</div>
                    {(doubleElimData.lbRounds.get(r) || []).map(match => renderMatchCard(match))}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ===== Single Elimination Layout ===== */
        <div className="flex justify-center overflow-x-auto pb-4">
          {rounds.map(round => (
            <div key={round} className="flex flex-col justify-around min-w-[220px] mx-2">
              <div className="text-center mb-4 font-bold text-gray-300">
                {getRoundName(round, totalRounds)}
              </div>
              {roundsMap.get(round)?.map(match => renderMatchCard(match))}
            </div>
          ))}
        </div>
      )}

      <div className="fixed bottom-4 right-4 text-sm text-gray-500">
        Auto-updates every 10s
      </div>
    </main>
  )
}
