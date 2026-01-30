#!/usr/bin/env node
/**
 * test_double_elim.js — Double Elimination Bracket End-to-End Test
 *
 * Tests the full double elimination lifecycle via API:
 * - Creates 8 players, tournament, generates bracket
 * - Verifies correct match count and bracket positions
 * - Scores through WB, LB, and Grand Final
 * - Tests both GF1-only and GF2 reset scenarios
 *
 * Usage:  node test_double_elim.js
 */

const http = require('http');
const { execSync } = require('child_process');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname);

let adminToken = null;
let passed = 0;
let failed = 0;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 23)}] ${msg}`);
}

function assert(condition, msg) {
  if (condition) {
    passed++;
    log(`  ✓ ${msg}`);
  } else {
    failed++;
    log(`  ✗ FAIL: ${msg}`);
  }
}

function _httpRequestOnce(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 8000,
      path: `/api${urlPath}`, method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    if (adminToken) opts.headers['Authorization'] = `Bearer ${adminToken}`;

    const req = http.request(opts, res => {
      let result = '';
      res.on('data', c => result += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(result) });
        } catch {
          resolve({ status: res.statusCode, data: result });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function httpRequest(method, urlPath, body) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await _httpRequestOnce(method, urlPath, body);
    } catch (e) {
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1500));
      } else {
        throw e;
      }
    }
  }
}

function getMatchByBP(matches, bp) {
  const match = matches.find(m => m.bracket_position === bp);
  if (!match) {
    log(`  WARNING: Match ${bp} not found in ${matches.length} matches`);
    if (matches.length > 0) log(`  Available BPs: ${matches.map(m => m.bracket_position).join(', ')}`);
  }
  return match;
}

async function fetchMatches(tournamentId) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await httpRequest('GET', `/matches?tournament_id=${tournamentId}&limit=500`);
    const data = Array.isArray(res.data) ? res.data : [];
    if (data.length > 0) return data;
    if (attempt === 0) log(`  Matches fetch returned 0, retrying...`);
    await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
  }
  log(`  WARNING: No matches found after 5 retries`);
  return [];
}

function getPlayerIds(match) {
  return (match.players || []).map(p => p.player_id);
}

async function setupTournamentEntries(tournamentId, playerList) {
  // Add all players to tournament
  for (const p of playerList) {
    if (p.id) {
      const res = await httpRequest('POST', `/tournaments/${tournamentId}/entries/${p.id}`);
      if (res.status >= 400) log(`  Add entry failed for ${p.name}: ${JSON.stringify(res.data).slice(0, 80)}`);
    }
  }

  // Verify and retry missing entries
  for (let retry = 0; retry < 3; retry++) {
    const entriesRes = await httpRequest('GET', `/tournaments/${tournamentId}/entries`);
    const entries = Array.isArray(entriesRes.data) ? entriesRes.data : [];
    if (entries.length >= playerList.filter(p => p.id).length) {
      // All entries present — mark paid and check in
      for (const entry of entries) {
        await httpRequest('PATCH', `/tournaments/${tournamentId}/entries/${entry.id}`, { paid: true });
        await httpRequest('POST', `/tournaments/${tournamentId}/entries/${entry.id}/check-in`);
      }
      log(`  ${entries.length} entries ready`);
      return entries.length;
    }
    // Re-add missing players
    const existingPlayerIds = new Set(entries.map(e => e.player_id));
    for (const p of playerList) {
      if (p.id && !existingPlayerIds.has(p.id)) {
        log(`  Re-adding ${p.name}...`);
        await httpRequest('POST', `/tournaments/${tournamentId}/entries/${p.id}`);
      }
    }
  }

  // Final attempt to mark paid and check in
  const finalEntries = await httpRequest('GET', `/tournaments/${tournamentId}/entries`);
  const entries = Array.isArray(finalEntries.data) ? finalEntries.data : [];
  for (const entry of entries) {
    await httpRequest('PATCH', `/tournaments/${tournamentId}/entries/${entry.id}`, { paid: true });
    await httpRequest('POST', `/tournaments/${tournamentId}/entries/${entry.id}/check-in`);
  }
  log(`  ${entries.length} entries ready (after retries)`);
  return entries.length;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  DOUBLE ELIMINATION BRACKET TEST');
  console.log('═'.repeat(60) + '\n');

  // ── Pre-flight ──
  log('Checking backend...');
  try {
    await new Promise((resolve, reject) => {
      http.get('http://localhost:8000/health', res => resolve(res.statusCode)).on('error', reject);
    });
    log('✓ Backend running');
  } catch {
    console.error('Backend not running! Start with: ./start-dev.sh');
    process.exit(1);
  }

  // ── Reset DB ──
  log('Resetting database...');
  execSync(
    `${PROJECT_DIR}/backend/venv/bin/python ${PROJECT_DIR}/backend/scripts/init_db.py`,
    { cwd: PROJECT_DIR, stdio: 'pipe' }
  );

  // Wait for backend to stabilize after DB reset (uvicorn --reload may restart)
  log('Waiting for backend to stabilize...');
  await new Promise(r => setTimeout(r, 5000));
  let backendReady = false;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const h = await new Promise((resolve, reject) => {
        http.get('http://localhost:8000/health', res => {
          let body = '';
          res.on('data', c => body += c);
          res.on('end', () => resolve({ status: res.statusCode }));
        }).on('error', reject);
      });
      if (h.status === 200) { backendReady = true; log('Backend stable'); break; }
    } catch {}
  }
  if (!backendReady) { console.error('Backend did not stabilize'); process.exit(1); }
  // Extra pause to let uvicorn fully settle
  await new Promise(r => setTimeout(r, 2000));

  // ── Create admin ──
  log('Creating admin...');
  for (let i = 0; i < 5; i++) {
    await httpRequest('POST', '/auth/admins', { name: 'Admin', pin: '1972', email: 'admin@test.com' });
    const login = await httpRequest('POST', '/auth/admin-login', { name: 'Admin', pin: '1972' });
    if (login.data.access_token) {
      adminToken = login.data.access_token;
      break;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  if (!adminToken) { console.error('Failed to get admin token'); process.exit(1); }
  log('✓ Admin ready\n');

  // ── Create event (with retry for transient connection issues) ──
  let eventId = null;
  for (let i = 0; i < 5; i++) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const eventRes = await httpRequest('POST', '/events', {
        name: 'Test Event', location: 'Test',
        start_date: today, end_date: today,
      });
      if (eventRes.data && eventRes.data.id) {
        eventId = eventRes.data.id;
        break;
      }
      log(`  Event create attempt ${i + 1} failed: ${JSON.stringify(eventRes.data).slice(0, 80)}`);
    } catch (e) {
      log(`  Event create attempt ${i + 1} error: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  if (!eventId) { console.error('Failed to create event'); process.exit(1); }
  log(`Event created: ${eventId}`);

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 1: 8-player double elimination — WB champion wins GF1
  // ══════════════════════════════════════════════════════════════════════════
  log('═══ TEST 1: 8-player double elimination (WB champ wins GF1) ═══\n');

  // Create 8 players (with retry for transient failures)
  const players = [];
  for (let i = 1; i <= 8; i++) {
    let pData = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await httpRequest('POST', '/players/register', {
        name: `Player ${i}`, email: `p${i}@test.com`, phone: `555100${i}`,
      });
      if (res.data && res.data.id) { pData = res.data; break; }
      log(`  Player ${i} create attempt ${attempt + 1} failed: ${JSON.stringify(res.data).slice(0, 100)}`);
      await new Promise(r => setTimeout(r, 500));
    }
    if (!pData) { log(`  FATAL: Could not create Player ${i}`); process.exit(1); }
    players.push(pData);
  }
  log(`Created ${players.length} players`);

  // Create tournament
  const tRes = await httpRequest('POST', '/tournaments', {
    name: 'Double Elim Test 1',
    game_type: '501',
    format: 'double_elimination',
    event_id: eventId,
    legs_to_win: 1,
    starting_score: 501,
    double_out: true,
  });
  if (!tRes.data.id) {
    log(`Tournament creation failed: ${JSON.stringify(tRes.data).slice(0, 200)}`);
    process.exit(1);
  }
  const t1Id = tRes.data.id;
  log(`Tournament created: ${t1Id}`);

  // Open registration (with retry)
  for (let i = 0; i < 5; i++) {
    const regRes = await httpRequest('PATCH', `/tournaments/${t1Id}`, { status: 'registration' });
    if (regRes.status === 200 && regRes.data.status === 'registration') break;
    log(`  Registration open attempt ${i + 1} failed: ${JSON.stringify(regRes.data).slice(0, 100)}`);
    await new Promise(r => setTimeout(r, 1000));
  }

  // Add players, check in, and mark paid
  const t1Entries = await setupTournamentEntries(t1Id, players);
  assert(t1Entries === 8, `T1 has 8 entries (got ${t1Entries})`);

  // Generate bracket
  const genRes = await httpRequest('POST', `/tournaments/${t1Id}/generate-bracket`);
  if (genRes.status !== 200) {
    log(`Bracket generation failed: ${JSON.stringify(genRes.data).slice(0, 300)}`);
  }
  assert(genRes.status === 200, `Bracket generated (status ${genRes.status})`);

  // Fetch all matches
  let matches = await fetchMatches(t1Id);

  // Verify match structure
  const wbMatches = matches.filter(m => (m.bracket_position || '').startsWith('WR'));
  const lbMatches = matches.filter(m => (m.bracket_position || '').startsWith('LR'));
  const gfMatches = matches.filter(m => (m.bracket_position || '').startsWith('GF'));

  assert(wbMatches.length === 7, `WB: 7 matches (got ${wbMatches.length})`);
  assert(lbMatches.length === 6, `LB: 6 matches (got ${lbMatches.length})`);
  assert(gfMatches.length === 2, `GF: 2 matches (got ${gfMatches.length})`);
  assert(matches.length === 15, `Total: 15 matches (got ${matches.length})`);

  // Verify bracket positions exist
  for (const bp of ['WR1M1','WR1M2','WR1M3','WR1M4','WR2M1','WR2M2','WR3M1']) {
    assert(getMatchByBP(matches, bp), `Match ${bp} exists`);
  }
  for (const bp of ['LR1M1','LR1M2','LR2M1','LR2M2','LR3M1','LR4M1']) {
    assert(getMatchByBP(matches, bp), `Match ${bp} exists`);
  }
  assert(getMatchByBP(matches, 'GF1'), 'Match GF1 exists');
  assert(getMatchByBP(matches, 'GF2'), 'Match GF2 exists');

  // Verify WR1 has players seeded
  const wr1m1 = getMatchByBP(matches, 'WR1M1');
  assert(wr1m1.players.length === 2, `WR1M1 has 2 players (got ${wr1m1.players.length})`);

  // ── Score WR1 matches ──
  log('\nScoring Winners Bracket Round 1...');
  for (const bp of ['WR1M1','WR1M2','WR1M3','WR1M4']) {
    matches = await fetchMatches(t1Id);
    const match = getMatchByBP(matches, bp);
    if (!match) continue;
    if (match.status === 'completed') { log(`  ${bp} already completed (bye)`); continue; }

    const pids = getPlayerIds(match);
    assert(pids.length === 2, `${bp} has 2 players`);

    // Winner = position 1 player
    const winnerId = pids[0];
    const res = await httpRequest('PATCH', `/matches/${match.id}`, {
      status: 'completed', winner_id: winnerId,
    });
    assert(res.status === 200, `${bp} scored`);
  }

  // Verify WR1 losers appeared in LR1
  matches = await fetchMatches(t1Id);
  const lr1m1 = getMatchByBP(matches, 'LR1M1');
  const lr1m2 = getMatchByBP(matches, 'LR1M2');
  assert(lr1m1.players.length === 2, `LR1M1 has 2 players (losers from WR1M1,WR1M2)`);
  assert(lr1m2.players.length === 2, `LR1M2 has 2 players (losers from WR1M3,WR1M4)`);

  // Verify WR2 has winners
  const wr2m1 = getMatchByBP(matches, 'WR2M1');
  const wr2m2 = getMatchByBP(matches, 'WR2M2');
  assert(wr2m1.players.length === 2, `WR2M1 has 2 players (winners from WR1M1,WR1M2)`);
  assert(wr2m2.players.length === 2, `WR2M2 has 2 players (winners from WR1M3,WR1M4)`);

  // ── Score WR2 ──
  log('\nScoring Winners Bracket Round 2...');
  for (const bp of ['WR2M1', 'WR2M2']) {
    matches = await fetchMatches(t1Id);
    const match = getMatchByBP(matches, bp);
    if (!match) continue;
    const winnerId = getPlayerIds(match)[0];
    await httpRequest('PATCH', `/matches/${match.id}`, { status: 'completed', winner_id: winnerId });
    log(`  ${bp} scored`);
  }

  // ── Score LR1 ──
  log('\nScoring Losers Bracket Round 1...');
  for (const bp of ['LR1M1', 'LR1M2']) {
    matches = await fetchMatches(t1Id);
    const match = getMatchByBP(matches, bp);
    if (!match) continue;
    const winnerId = getPlayerIds(match)[0];
    await httpRequest('PATCH', `/matches/${match.id}`, { status: 'completed', winner_id: winnerId });
    log(`  ${bp} scored`);
  }

  // Verify LR2 has players (LR1 winners in pos 1, WR2 losers in pos 2)
  matches = await fetchMatches(t1Id);
  const lr2m1 = getMatchByBP(matches, 'LR2M1');
  const lr2m2 = getMatchByBP(matches, 'LR2M2');
  assert(lr2m1.players.length === 2, `LR2M1 has 2 players (got ${lr2m1.players.length})`);
  assert(lr2m2.players.length === 2, `LR2M2 has 2 players (got ${lr2m2.players.length})`);

  // ── Score LR2 ──
  log('\nScoring Losers Bracket Round 2...');
  for (const bp of ['LR2M1', 'LR2M2']) {
    matches = await fetchMatches(t1Id);
    const match = getMatchByBP(matches, bp);
    if (!match) continue;
    const winnerId = getPlayerIds(match)[0];
    await httpRequest('PATCH', `/matches/${match.id}`, { status: 'completed', winner_id: winnerId });
    log(`  ${bp} scored`);
  }

  // ── Score WR3 (WB Final) ──
  log('\nScoring WB Final...');
  matches = await fetchMatches(t1Id);
  let wr3m1 = getMatchByBP(matches, 'WR3M1');
  assert(wr3m1.players.length === 2, `WR3M1 (WB Final) has 2 players`);
  const wbChampId = getPlayerIds(wr3m1)[0];
  await httpRequest('PATCH', `/matches/${wr3m1.id}`, { status: 'completed', winner_id: wbChampId });
  log('  WR3M1 scored');

  // ── Score LR3 ──
  log('\nScoring LR3...');
  matches = await fetchMatches(t1Id);
  const lr3m1 = getMatchByBP(matches, 'LR3M1');
  assert(lr3m1.players.length === 2, `LR3M1 has 2 players (got ${lr3m1.players.length})`);
  const lr3WinnerId = getPlayerIds(lr3m1)[0];
  await httpRequest('PATCH', `/matches/${lr3m1.id}`, { status: 'completed', winner_id: lr3WinnerId });
  log('  LR3M1 scored');

  // ── Score LR4 (LB Final) ──
  log('\nScoring LB Final...');
  matches = await fetchMatches(t1Id);
  const lr4m1 = getMatchByBP(matches, 'LR4M1');
  assert(lr4m1.players.length === 2, `LR4M1 (LB Final) has 2 players (got ${lr4m1.players.length})`);
  const lbChampId = getPlayerIds(lr4m1)[0];
  await httpRequest('PATCH', `/matches/${lr4m1.id}`, { status: 'completed', winner_id: lbChampId });
  log('  LR4M1 scored');

  // ── Score GF1 (WB champ wins) ──
  log('\nScoring Grand Final 1 (WB champion wins)...');
  matches = await fetchMatches(t1Id);
  let gf1 = getMatchByBP(matches, 'GF1');
  assert(gf1.players.length === 2, `GF1 has 2 players (got ${gf1.players.length})`);

  // WB champion is position 1
  const gf1Players = gf1.players.sort((a, b) => a.position - b.position);
  const gf1WinnerId = gf1Players[0].player_id; // WB champion (pos 1)
  await httpRequest('PATCH', `/matches/${gf1.id}`, { status: 'completed', winner_id: gf1WinnerId });
  log('  GF1 scored — WB champion wins');

  // Verify GF2 is cancelled and tournament is completed
  matches = await fetchMatches(t1Id);
  const gf2 = getMatchByBP(matches, 'GF2');
  assert(gf2.status === 'cancelled', `GF2 cancelled (got ${gf2.status})`);

  const tCheck = await httpRequest('GET', `/tournaments/${t1Id}`);
  assert(tCheck.data.status === 'completed', `Tournament completed (got ${tCheck.data.status})`);

  log('\n✓ TEST 1 PASSED: 8-player double elimination, WB champ wins GF1\n');

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 2: 4-player double elimination — LB champion wins GF1 (reset)
  // ══════════════════════════════════════════════════════════════════════════
  log('═══ TEST 2: 4-player double elimination (GF2 reset) ═══\n');

  // Small delay between tests
  await new Promise(r => setTimeout(r, 500));

  // Create 4 new players
  const players2 = [];
  for (let i = 9; i <= 12; i++) {
    const res = await httpRequest('POST', '/players/register', {
      name: `Player ${i}`, email: `p${i}@test.com`, phone: `555200${i}`,
    });
    if (!res.data.id) log(`  Player ${i} create failed: ${JSON.stringify(res.data).slice(0, 100)}`);
    players2.push(res.data);
  }
  log(`Created ${players2.filter(p => p.id).length} players for Test 2`);

  // Create tournament
  const t2Res = await httpRequest('POST', '/tournaments', {
    name: 'Double Elim Test 2 (Reset)',
    game_type: '501',
    format: 'double_elimination',
    event_id: eventId,
    legs_to_win: 1,
    starting_score: 501,
    double_out: true,
  });
  const t2Id = t2Res.data.id;
  if (!t2Id) {
    log(`Tournament 2 creation failed: ${JSON.stringify(t2Res.data).slice(0, 200)}`);
    process.exit(1);
  }
  log(`Tournament 2 created: ${t2Id}`);

  // Setup - open registration (with retry)
  let regOk = false;
  for (let i = 0; i < 5; i++) {
    const regRes2 = await httpRequest('PATCH', `/tournaments/${t2Id}`, { status: 'registration' });
    if (regRes2.status === 200) { regOk = true; break; }
    log(`  Registration open attempt ${i + 1} failed (${regRes2.status}): ${JSON.stringify(regRes2.data).slice(0, 100)}`);
    await new Promise(r => setTimeout(r, 1000));
  }
  if (!regOk) log('  WARNING: Failed to open registration for tournament 2');

  const t2Entries = await setupTournamentEntries(t2Id, players2);
  assert(t2Entries === 4, `T2 has 4 entries (got ${t2Entries})`);

  // Generate bracket
  const gen2 = await httpRequest('POST', `/tournaments/${t2Id}/generate-bracket`);
  if (gen2.status !== 200) {
    log(`Bracket generation failed (${gen2.status}): ${JSON.stringify(gen2.data).slice(0, 300)}`);
  }
  assert(gen2.status === 200, 'Bracket generated for 4-player');

  if (gen2.status !== 200) {
    log('  Skipping Test 2 scoring due to bracket generation failure');
  } else {

  matches = await fetchMatches(t2Id);

  // 4-player: bracket_size=4, 2 WB rounds, 2 LB rounds, 2 GF = 7 total matches
  // WR1: 2, WR2: 1, LR1: 1, LR2: 1, GF1, GF2
  const wb2 = matches.filter(m => (m.bracket_position || '').startsWith('WR'));
  const lb2 = matches.filter(m => (m.bracket_position || '').startsWith('LR'));
  const gf2_2 = matches.filter(m => (m.bracket_position || '').startsWith('GF'));
  assert(wb2.length === 3, `WB: 3 matches (got ${wb2.length})`);
  assert(lb2.length === 2, `LB: 2 matches (got ${lb2.length})`);
  assert(gf2_2.length === 2, `GF: 2 matches (got ${gf2_2.length})`);

  // Helper to score a match by bracket position
  async function scoreMatch(tId, bp, pickWinnerFn) {
    const m = await fetchMatches(tId);
    const match = getMatchByBP(m, bp);
    if (!match) { log(`  SKIP: ${bp} not found`); return null; }
    if (match.status === 'completed') { log(`  SKIP: ${bp} already completed`); return match; }
    const pids = getPlayerIds(match);
    if (pids.length < 1) { log(`  SKIP: ${bp} has ${pids.length} players`); return match; }
    const winnerId = pickWinnerFn ? pickWinnerFn(match) : pids[0];
    if (!winnerId) { log(`  SKIP: ${bp} no winner`); return match; }
    const res = await httpRequest('PATCH', `/matches/${match.id}`, { status: 'completed', winner_id: winnerId });
    if (res.status !== 200) log(`  ${bp} score failed (${res.status}): ${JSON.stringify(res.data).slice(0, 100)}`);
    return match;
  }

  // Score WR1
  log('Scoring WR1...');
  for (const bp of ['WR1M1', 'WR1M2']) await scoreMatch(t2Id, bp);

  // Score WR2 (WB Final)
  log('Scoring WR2 (WB Final)...');
  await scoreMatch(t2Id, 'WR2M1');

  // Score LR1
  log('Scoring LR1...');
  await scoreMatch(t2Id, 'LR1M1');

  // Score LR2 (LB Final)
  log('Scoring LR2 (LB Final)...');
  await scoreMatch(t2Id, 'LR2M1');

  // Score GF1 — LB champion wins (position 2)
  log('Scoring GF1 (LB champion wins — triggers reset)...');
  await scoreMatch(t2Id, 'GF1', (match) => {
    const sorted = match.players.sort((a, b) => a.position - b.position);
    return sorted.length >= 2 ? sorted[1].player_id : sorted[0]?.player_id;
  });

  // Verify GF2 has both players (NOT cancelled)
  matches = await fetchMatches(t2Id);
  const gf2_check = getMatchByBP(matches, 'GF2');
  if (gf2_check) {
    assert(gf2_check.status !== 'cancelled', `GF2 is NOT cancelled (got ${gf2_check.status})`);
    assert(gf2_check.players.length === 2, `GF2 has 2 players (got ${gf2_check.players.length})`);

    // Score GF2 — either player wins
    log('Scoring GF2 (reset match)...');
    const gf2WinnerId = getPlayerIds(gf2_check)[0];
    if (gf2WinnerId) {
      await httpRequest('PATCH', `/matches/${gf2_check.id}`, { status: 'completed', winner_id: gf2WinnerId });
    }
  } else {
    log('  GF2 not found!');
  }

  // Verify tournament completed
  const t2Check = await httpRequest('GET', `/tournaments/${t2Id}`);
  assert(t2Check.data.status === 'completed', `Tournament 2 completed (got ${t2Check.data.status})`);

  log('\n✓ TEST 2 PASSED: 4-player double elimination with GF2 reset\n');

  } // end if gen2 succeeded

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 3: 6-player (non-power-of-2, byes required)
  // ══════════════════════════════════════════════════════════════════════════
  log('═══ TEST 3: 6-player double elimination (byes) ═══\n');

  await new Promise(r => setTimeout(r, 500));

  const players3 = [];
  for (let i = 13; i <= 18; i++) {
    const res = await httpRequest('POST', '/players/register', {
      name: `Player ${i}`, email: `p${i}@test.com`, phone: `555300${i}`,
    });
    if (!res.data.id) log(`  Player ${i} create failed: ${JSON.stringify(res.data).slice(0, 100)}`);
    players3.push(res.data);
  }
  log(`Created ${players3.filter(p => p.id).length} players for Test 3`);

  const t3Res = await httpRequest('POST', '/tournaments', {
    name: 'Double Elim Test 3 (Byes)',
    game_type: '501',
    format: 'double_elimination',
    event_id: eventId,
    legs_to_win: 1,
    starting_score: 501,
    double_out: true,
  });
  const t3Id = t3Res.data.id;
  if (!t3Id) {
    log(`Tournament 3 creation failed: ${JSON.stringify(t3Res.data).slice(0, 200)}`);
    process.exit(1);
  }

  // Open registration with retry
  for (let i = 0; i < 5; i++) {
    const regRes3 = await httpRequest('PATCH', `/tournaments/${t3Id}`, { status: 'registration' });
    if (regRes3.status === 200) break;
    log(`  Registration open attempt ${i + 1} failed (${regRes3.status})`);
    await new Promise(r => setTimeout(r, 1000));
  }
  const t3Entries = await setupTournamentEntries(t3Id, players3);
  assert(t3Entries === 6, `T3 has 6 entries (got ${t3Entries})`);

  const gen3 = await httpRequest('POST', `/tournaments/${t3Id}/generate-bracket`);
  assert(gen3.status === 200, 'Bracket generated for 6-player');

  // 6 players -> bracket_size=8, same structure as 8-player but with 2 byes
  matches = await fetchMatches(t3Id);
  assert(matches.length === 15, `6-player bracket: 15 matches (got ${matches.length})`);

  // Verify some WR1 matches auto-completed as byes
  const wr1Completed = matches.filter(m =>
    (m.bracket_position || '').startsWith('WR1') && m.status === 'completed'
  );
  assert(wr1Completed.length === 2, `2 WR1 byes auto-completed (got ${wr1Completed.length})`);

  log('\n✓ TEST 3 PASSED: 6-player bracket with byes\n');

  // ══════════════════════════════════════════════════════════════════════════
  // Summary
  // ══════════════════════════════════════════════════════════════════════════
  console.log('═'.repeat(60));
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
