# QuizQuest MVP

QuizQuest is a QuizUp-inspired 1v1 trivia game with live and ghost matches. This repository contains:

- An Expo + React Native client scaffold using Expo Router, Zustand, TanStack Query, NativeWind, Moti, and Supabase auth/realtime.
- A Supabase backend scaffold with a production-oriented Postgres schema, RLS, SQL helper functions, and Edge Function contracts.

## Structure

- `app/`: Expo Router routes for auth, lobby, battle, friends, leaderboards, and profile.
- `src/`: Shared UI, state, hooks, providers, and domain types.
- `supabase/migrations/`: Postgres schema, helper functions, views, and RLS policies.
- `supabase/functions/`: Edge Functions for matchmaking, gameplay, challenges, and question ingestion.

## MVP Notes

- Matches always contain 7 questions.
- Ghost ties are allowed.
- Incomplete seed ghost runs are invalidated.
- Player B receives the exact same question order as Player A.

## Next Steps

1. Install dependencies with `npm install`.
2. Create a Supabase project and apply `supabase/migrations/0001_init.sql`.
3. Populate `.env` from `.env.example`.
4. Run `npx expo start`.

## Demo auth requirement

For the guest ghost-match demo flow, enable anonymous sign-ins in Supabase:

1. Open `Authentication` in your Supabase dashboard.
2. Open `Providers`.
3. Enable `Anonymous Sign-Ins`.

Without that setting, the demo lobby can render categories but cannot create guest sessions or start protected Edge Function flows.
