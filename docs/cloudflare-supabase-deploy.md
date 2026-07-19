# Cloudflare Pages + Supabase deployment

This project keeps local development simple with the existing Node server, and uses Cloudflare Pages plus Supabase in production.

## Runtime shape

- Cloudflare Pages serves the static HTML/CSS/JS files.
- Cloudflare Pages Functions expose same-origin `/health`, `/api/search`, `/api/analyze`, and `/api/decisions/:decision_id`.
- Pages Functions proxy those requests to the Supabase Edge Function at `/functions/v1/search`.
- Supabase Postgres stores legal decisions in `public.legal_decisions`.
- The Edge Function uses `SUPABASE_SERVICE_ROLE_KEY`; the browser never receives that key.

## Supabase setup

1. Create a Supabase project.
2. Apply `supabase/migrations/202607190001_legal_decisions.sql`.
3. Optionally apply `supabase/seed.sql` for a smoke-test row.
4. Deploy the Edge Function:

```bash
supabase functions deploy search
```

5. Set function secrets:

```bash
supabase secrets set SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
```

## Cloudflare Pages setup

Build settings:

- Framework preset: `None`
- Build command: leave empty
- Build output directory: `/`

Environment variables:

- `SUPABASE_URL`: `https://YOUR_PROJECT.supabase.co`
- `SUPABASE_ANON_KEY`: public anon key

Cloudflare Pages Functions use the anon key only to call the Edge Function. Database reads still happen inside Supabase with the service role key.

## Import JSONL data

Import the committed synthetic sample or a locally generated ignored index:

```bash
SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" \
npm run import:supabase -- --input data/index/edrsr-2026.sample.text.jsonl
```

On Windows PowerShell:

```powershell
$env:SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
npm run import:supabase -- --input data\sample\edrsr-sample.jsonl
```

## Local development

Use the existing local server:

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:8787/precedent-search.html
```

The browser first tries a same-origin API, then `:8787`, then falls back to committed sample JSONL data.
