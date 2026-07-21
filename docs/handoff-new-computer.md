# New computer handoff

This file records the deployed infrastructure and the minimum steps needed to continue work from another machine.

## Repository

- GitHub: `https://github.com/Flumos1/codex_sud`
- Main branch: `main`
- Latest deployed code should be pulled from `main`.

```powershell
git clone https://github.com/Flumos1/codex_sud.git
cd codex_sud
npm run check
npm test
```

## Production resources

- Cloudflare Pages project: `codex-sud`
- Production URL: `https://codex-sud.pages.dev/`
- Supabase organization: `codex-sud`
- Supabase project name: `codex-sud`
- Supabase project ref: `aqxbydfvrvytwpgqjzpy`
- Supabase URL: `https://aqxbydfvrvytwpgqjzpy.supabase.co`
- Supabase Edge Function: `search`
- Supabase table: `public.legal_decisions`

## Secrets

Do not commit secrets.

Cloudflare Pages production secrets already set:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Supabase Edge Function uses Supabase-provided runtime values for:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

On a new computer, create a fresh Supabase Personal Access Token at:

```text
https://supabase.com/dashboard/account/tokens
```

Then log in:

```powershell
npx supabase login --token <NEW_SUPABASE_PERSONAL_ACCESS_TOKEN> --name codex-sud
npx supabase link --project-ref aqxbydfvrvytwpgqjzpy
```

Log in to Cloudflare:

```powershell
npx wrangler login
```

## Local commands

Local Node prototype:

```powershell
npm run dev
```

Cloudflare Pages local preview:

```powershell
npm run dev:pages
```

Build public Pages output:

```powershell
npm run build:pages
```

Deploy Cloudflare Pages:

```powershell
npm run deploy:pages
```

Apply Supabase migrations:

```powershell
npm run db:push
```

Deploy Supabase Edge Function:

```powershell
npm run deploy:supabase:function
```

Import JSONL data:

```powershell
$env:SUPABASE_URL="https://aqxbydfvrvytwpgqjzpy.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="<SERVICE_ROLE_KEY_FROM_SUPABASE_DASHBOARD>"
npm run import:supabase -- --input data\sample\edrsr-sample.jsonl
Remove-Item Env:\SUPABASE_SERVICE_ROLE_KEY
Remove-Item Env:\SUPABASE_URL
```

## Production checks

```powershell
Invoke-WebRequest -UseBasicParsing https://codex-sud.pages.dev/ | Select-Object StatusCode,ContentLength
Invoke-RestMethod https://codex-sud.pages.dev/health
Invoke-RestMethod "https://codex-sud.pages.dev/api/search?article=625%20%D0%A6%D0%9A&limit=1"
Invoke-RestMethod "https://codex-sud.pages.dev/api/analyze?region=%D0%9A%D0%B8%D1%97%D0%B2"
```

Expected health response:

```json
{
  "ok": true,
  "source": "supabase",
  "decisions": 5
}
```

## Current production state

- Cloudflare Pages responds with HTTP 200.
- `/health` returns Supabase-backed status.
- `/api/search` works through Cloudflare Pages Functions to Supabase Edge Function.
- `/api/analyze` works through Cloudflare Pages Functions to Supabase Edge Function.
- Sample dataset currently contains 5 synthetic decisions.

## Important notes

- `dist/`, `.wrangler/`, `.dev.vars`, and `supabase/.temp/` are local-only and ignored.
- Real EDRSR data and generated indexes must stay out of git.
- If a Supabase token is ever shown in a screenshot or chat, revoke it immediately and create a new one.
