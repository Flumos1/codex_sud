# Cloudflare Pages + Supabase architecture

## Goal

Run the public prototype on Cloudflare Pages while moving production data and search API behavior into Supabase.

## Components

- `dist/`: Cloudflare Pages build output. It contains only public HTML, assets, and safe sample fallback data.
- `functions/`: Cloudflare Pages Functions. These expose same-origin `/health` and `/api/*` routes.
- `supabase/migrations/`: Postgres schema for indexed legal decisions.
- `supabase/functions/search/`: Supabase Edge Function that reads from Postgres and implements search/analyze/detail endpoints.
- `scripts/import-jsonl-to-supabase.mjs`: JSONL upsert path from local generated indexes into Supabase Postgres.
- `scripts/serve-search-api.mjs`: local Node development server that remains useful before cloud credentials are available.

## Request flow

```text
Browser
  -> Cloudflare Pages static files from dist/
  -> Cloudflare Pages Function /api/search
  -> Supabase Edge Function /functions/v1/search/api/search
  -> Supabase Postgres public.legal_decisions
```

The browser only receives `SUPABASE_ANON_KEY` indirectly through the Cloudflare proxy request. The service role key stays inside Supabase Edge Function secrets.

## Data flow

```text
Raw EDRSR files outside git
  -> normalize/enrich scripts
  -> ignored JSONL in data/index/
  -> npm run import:supabase -- --input data/index/...
  -> public.legal_decisions
```

## Deployment order

1. Create/link Supabase project.
2. Run `npm run db:push`.
3. Set Supabase function secrets from `supabase/env.example`.
4. Run `npm run deploy:supabase:function`.
5. Import sample or real JSONL data.
6. Create/link Cloudflare Pages project.
7. Set Pages env vars from `.dev.vars.example`.
8. Run `npm run deploy:pages`.
