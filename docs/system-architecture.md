# QuizQuest System Architecture

## Client
- Expo + React Native app with Expo Router route groups for auth and core tabs.
- Zustand stores ephemeral battle state and answer locks.
- TanStack Query owns server state fetch/invalidate cycles.
- Supabase auth handles session bootstrap; Realtime channels power live match transport.

## Backend
- Supabase Postgres stores profiles, questions, matches, answers, ratings, friendships, queue state, notifications, and suspicious logs.
- SQL functions handle question selection, match creation, answer score calculation, rating math, and ingestion promotion.
- Edge Functions enforce authoritative actions:
  - Queue join/leave
  - Match ready
  - Answer submission
  - Match sync
  - Friend challenges and rematches
  - Question ingestion

## Match model
- `matches` stores lifecycle, type, mode, timers, and source references.
- `match_participants` stores seats, readiness, final score, ghost marker, and outcome.
- `match_questions` locks the exact 7-question set at creation time.
- `match_answers` stores correctness, response time, awarded score, cumulative score, and playback offsets.

## Ghost playback
- Seed player completes a 7-question run.
- Only complete, valid runs are reusable.
- Follow-up players receive the same `match_questions`.
- Client simulates opponent score progression from stored answer offsets while server still evaluates only the active player.

## Scaling posture
- Realtime is treated as a fanout layer, not the source of truth.
- Queue and leaderboard reads are indexed for the main hot paths.
- Match orchestration is concentrated into database functions plus thin edge endpoints so future dedicated services can replace parts incrementally.
