# Voice Studio

Turn any script into natural speech in English or Khmer, powered by the OpenAI Speech API. Each user signs in, keeps a history of generated clips, bookmarks favourites, and saves style presets.

## Stack

- Next.js 16 (App Router, TypeScript) with route handlers as the backend
- Supabase for auth, Postgres, and private audio storage
- next-intl for English and Khmer
- OpenAI `gpt-4o-mini-tts`, `tts-1`, `tts-1-hd`

## Setup (local, Docker)

Requires Docker Desktop running.

```bash
npm install
npm run db:start     # local Supabase in Docker; applies supabase/migrations automatically
npm run db:env       # prints the local URL and keys
```

Copy `.env.example` to `.env.local`, add your OpenAI key, and paste the local `API_URL` as `NEXT_PUBLIC_SUPABASE_URL` and `ANON_KEY` as `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Then:

```bash
npm run dev          # http://localhost:3000
```

Local Supabase Studio is at http://localhost:54323 and caught emails at http://localhost:54324. Email confirmation is off locally, so sign-up signs you straight in. `npm run db:stop` shuts the stack down; `npm run db:reset` wipes it and re-applies the migration.

Until Supabase keys are present the app shows a setup notice instead of the sign-in page. Restart `npm run dev` after changing `NEXT_PUBLIC_*` values, since they are inlined at compile time.

## Deploying

See [DEPLOY.md](DEPLOY.md) for the Docker image and the two AWS layouts (Fargate with hosted Supabase, or everything self-hosted on EC2).

## Features

- Sign in with email and password or Google
- Studio: script editor, voice avatars with previews, style presets, model, format, and speed
- Long scripts split on sentence boundaries and stitched into one MP3
- History with inline playback, download, bookmark, and delete
- Per-user monthly character quota shown in the sidebar
- Light and dark theme, collapsible icon-rail sidebar
- English and Khmer interface with a Khmer typeface

## Project layout

```
app/(auth)/            login, signup, server actions
app/(app)/             studio, history, bookmarks, voices (requires sign-in)
app/api/tts/route.ts   generates audio, uploads to storage, records the generation
app/auth/callback      OAuth and email confirmation exchange
components/            UI (AppShell, Sidebar, Studio, Player, VoicePicker, HistoryTable…)
lib/supabase/          browser, server, and proxy clients
lib/generations.ts     queries with signed URLs
lib/actions/library.ts bookmark, delete, preset server actions
i18n/ + messages/      locale cookie handling and translations
supabase/migrations/   database schema
proxy.ts               refreshes sessions and guards routes
```

## Voice avatars

Each voice shows a placeholder cartoon face. To replace it, drop a square PNG at `public/avatars/<voice>.png`, for example `public/avatars/alloy.png`.
