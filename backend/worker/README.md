# RavenHUD Marker Submission API

Small Cloudflare Worker backend that creates GitHub issues automatically for map submissions and uploads pasted screenshots into the repo.

## What it does

- accepts marker submissions from the site
- optionally verifies the Discord user from the frontend OAuth access token
- uploads the screenshot to `docs/data/community-screenshots/`
- creates a GitHub issue in `Azurak666/Raven_hud`

## Deploy

```bash
cd backend/worker
npm install
npx wrangler login
npx wrangler secret put GITHUB_TOKEN
npm run deploy
```

After deploy, copy the Worker URL and set it in `docs/index.html`:

```html
<script>
  window.RAVENHUD_API_URL = 'https://your-worker-name.your-subdomain.workers.dev';
</script>
```

## Required secret

- `GITHUB_TOKEN` — GitHub personal access token with repo issue/content write access

## Local dev

```bash
cd backend/worker
copy .dev.vars.example .dev.vars
npm install
npm run dev
```

Then point `window.RAVENHUD_API_URL` to your local Worker URL.
