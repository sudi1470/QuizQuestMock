# QuizQuest Lean PRD

## Vision
Deliver a fast, competitive trivia experience that feels alive in both synchronous and asynchronous play. The MVP should make it easy for a player to pick a category, get into a 7-question duel quickly, and immediately understand their progress, rating, and next action.

## Primary users
- Competitive trivia players who want quick ranked matches.
- Casual players who prefer turn-based async challenges.
- Social players who want to challenge friends and rematch.

## MVP success criteria
- A signed-in user can start a live or async match from the lobby in under 10 seconds.
- Each match plays exactly 7 timed questions with server-authoritative scoring.
- Live matches sync score progression in realtime.
- Ghost matches replay Player A's timing and score progression while Player B answers.
- Ratings, XP, and leaderboard placement update after match completion.

## Core flows
1. Authenticate with email or Google.
2. Choose a category from the lobby.
3. Queue for live random, async random, or friend challenge.
4. Play 7 timed questions.
5. View winner, rating delta, XP, and follow-up actions.

## Non-goals for MVP
- Multi-language content.
- Tournament brackets and clans.
- Rich moderation tooling beyond ingestion validation and suspicious match logs.
- Deep analytics dashboards.

## Risks
- Low question pool diversity can cause repeat exposure.
- Ghost fairness depends on exact question-set locking and clean invalidation of incomplete seeds.
- Realtime drift can harm trust if timers are not derived from authoritative timestamps.
