# Playwright Worker

Chromium-in-a-box for scraping JS-rendered Indian govt sites (RBI, UPSC SPA, MPPSC, etc). Called by `supabase/functions/scheduled-scraper` via `POST /render`.

## Contract

- `POST /render` — body `{ url, wait_for?, timeout_ms? }` → `{ html, status, final_url }`
- `GET /health` → `ok`

Auth: include header `x-worker-token: $AUTH_TOKEN` (skipped if `AUTH_TOKEN` env var unset).

## Deploy to Fly.io

```bash
cd services/playwright-worker
fly launch --no-deploy                               # accepts existing fly.toml; rename app if prompted
fly secrets set AUTH_TOKEN=$(openssl rand -hex 32)   # SAVE THIS VALUE — you'll paste it into Supabase secrets next
fly deploy
fly status                                            # note the hostname, e.g. career-copilot-playwright.fly.dev
```

Then wire the scraper:

```bash
supabase secrets set PLAYWRIGHT_WORKER_URL=https://<app>.fly.dev
supabase secrets set PLAYWRIGHT_WORKER_TOKEN=<same-token-as-above>
supabase functions deploy scheduled-scraper --no-verify-jwt
```

## Swap to another host later

The contract is one HTTP endpoint. Point `PLAYWRIGHT_WORKER_URL` at Browserless.io, Railway, a VPS, or AWS Lambda — the scraper doesn't care.
