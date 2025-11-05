# WAMO Dart Game Rules

## Supported Game Types

### 1. 301 / 501

**Objective:** Reduce your score from 301 (or 501) to exactly zero.

**Rules:**
- Each player starts with 301 or 501 points
- Scores are subtracted from remaining total
- Must finish on exactly zero
- **Double Out:** Must finish with a double (default)
- **Double In:** Must start scoring with a double (optional)

**Bust Rules:**
- Going below zero is a bust
- Finishing on non-double when double-out is enabled
- Score remains at value before the bust throw

**Winning:**
- First player to reach exactly zero wins

**Example Turn:**
```
Starting score: 301
Throw: T20, T20, T20 = 180
Remaining: 121

Next throw: T20, S11, D20 = 111
Final score: 10 (need D5 to finish)
```

### 2. Cricket

**Objective:** Close all numbers (15-20 and Bull) and have the highest score.

**Numbers:** 15, 16, 17, 18, 19, 20, Bull

**Rules:**
- Hit each number 3 times to "close" it
- Singles count as 1 mark, doubles as 2, triples as 3
- After closing a number, additional hits score points (number × hits)
- Points only count if opponent hasn't closed that number
- Bull = 25 points

**Winning:**
- All numbers closed AND highest score
- If tied on score, first to close all wins

**Example:**
```
Player 1 marks: 20(3), 19(2), 18(1)
Player 2 marks: 20(1), 19(3), 17(3)

Player 1 hits T20: Closes 20, no points yet
Player 1 hits S20: Scores 20 points (20 already closed)
```

### 3. Cricket Cut-Throat

**Variant of Cricket** with reversed scoring:

**Rules:**
- Same as Cricket but inverted scoring
- Points are given to OPPONENTS instead
- LOWEST score wins
- Strategy: Close numbers to stop opponents from giving you points

### 4. Round the Clock

**Objective:** Hit numbers 1-20 in order, then bull.

**Rules:**
- Start at 1, must hit sequentially through 20
- Any segment of the number counts (single, double, triple)
- Must hit bull to finish
- First to complete the sequence wins

**Example:**
```
Turn 1: Hit 1, 2, 3 (advance to 4)
Turn 2: Miss, Hit 4, Hit 5 (advance to 6)
Turn 3: Hit 6, 7, 8 (advance to 9)
...
Final: Hit Bull = WIN
```

### 5. Killer

**Objective:** Eliminate all other players by taking their lives.

**Setup:**
- Each player throws to select their number (1-20)
- No duplicates allowed
- Each player starts with 3 lives

**Phases:**

**Phase 1 - Number Selection:**
- Throw until you hit an unclaimed number (1-20)
- That becomes your number for the game

**Phase 2 - Battle:**
- Hit doubles on your own number to become a "Killer"
- Once a Killer, hit doubles on opponents' numbers
- Each double hit removes one life
- Players with 0 lives are eliminated
- Last player standing wins

**Example:**
```
Player A: Number 20
Player B: Number 17

Player A hits D20 → Becomes Killer
Player A hits D17 → Player B loses 1 life (2 remaining)
Player A hits D17 → Player B loses 1 life (1 remaining)
Player B hits D17 → Becomes Killer
Player B hits D20 → Player A loses 1 life
```

### 6. Shanghai

**Objective:** Score the most points over 7 innings, or hit a Shanghai.

**Innings:** 1 through 7 (targeting numbers 1-7 respectively)

**Rules:**
- Inning 1: Only scoring on the number 1
- Inning 2: Only scoring on the number 2
- And so on through Inning 7
- Singles, doubles, and triples all count
- **Shanghai:** Hitting single, double, AND triple of target number in one turn = instant win

**Scoring:**
- Single = 1× number
- Double = 2× number
- Triple = 3× number

**Example (Inning 5):**
```
Player throws: S5, D5, T5
Score: 5 + 10 + 15 = 30 points
Result: SHANGHAI! Instant win!

Normal turn:
Player throws: T5, S5, S3
Score: 15 + 5 = 20 points (3 doesn't count in inning 5)
```

### 7. Baseball

**Objective:** Score the most runs over 9 innings.

**Innings:** 1 through 9 (corresponding to numbers 1-9)

**Rules:**
- Each inning targets its corresponding number
- Score = number × multiplier
- 9 innings total
- Highest cumulative score wins

**Scoring Example (Inning 3):**
```
Throw: T3, D3, S3
Score: 9 + 6 + 3 = 18 runs
```

## Multiplier Values

- **Single:** 1× the number
- **Double:** 2× the number (outer ring)
- **Triple:** 3× the number (inner ring)
- **Single Bull:** 25 points
- **Double Bull:** 50 points

## Tournament Match Format

### Match Structure
- **Sets:** Best of N sets (configurable)
- **Legs:** Best of N legs per set (configurable)
- **Games:** Individual rounds within a leg

### Winning
1. Win required legs to win a set
2. Win required sets to win the match
3. Winner advances in tournament bracket

## Common Checkouts (for 301/501)

| Score | Checkout |
|-------|----------|
| 170 | T20, T20, Bull |
| 167 | T20, T19, Bull |
| 164 | T20, T18, Bull |
| 160 | T20, T20, D20 |
| 158 | T20, T20, D19 |
| 156 | T20, T20, D18 |
| 150 | T20, T18, D18 |
| 141 | T20, T19, D12 |
| 132 | Bull, Bull, D16 |
| 120 | T20, S20, D20 |
| 110 | T20, T18, D8 |
| 100 | T20, D20 |

## Scoring Terminal Usage

### Entering Scores

1. Select the dartboard segment hit
2. Select multiplier (Single/Double/Triple)
3. Repeat for all 3 darts
4. System automatically validates and calculates

### Corrections

- Undo button available before submitting
- Contact tournament official for post-submission corrections

### Automatic Features

- Bust detection
- Win detection
- Checkout suggestions (301/501)
- Real-time score calculation
- Statistical tracking
