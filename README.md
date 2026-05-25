# GhostVeil Oracle Swarm

GhostVeil is a working Solana signal verification app and Swarms agent package.

It helps traders and researchers inspect early Solana market signals without acting like a pump group. The app can fetch Solana market context through DexScreener, accept user-provided wallet/liquidity/social notes, stress-test the signal through a structured GhostVeil review, protect sensitive trader intent, and return an exportable Alpha Card.

GhostVeil does not execute trades, promise profit, or invent live data. If live market context is unavailable, the app clearly labels the output as framework-based analysis of user-provided evidence.

## Product Flow

1. Enter a token, mint address, pair URL, or market note.
2. Fetch Solana market context, when available.
3. Add wallet, liquidity, narrative, social, counter-signal, and private notes.
4. Choose local GhostVeil rules or Swarms API agent review.
5. Generate a GhostVeil Alpha Card.
6. Export the Alpha Card JSON or copy the public-safe X/Discord summary.

## What the App Includes

- DexScreener Solana market context connector
- Provided-data mode when live data is unavailable
- VeilSense scoring for stealth, conviction, and risk
- Alpha Tribunal review with bull, bear, timing, risk, and crowding checks
- VeilGuard privacy check that separates public output from private notes
- GhostTrade Risk Preview with best/base/worst paths and invalidation point
- GhostProof Score and final verdict
- Watchlist history stored locally in the browser
- Premium Pro mode with GhostBack reward economics
- Exportable Alpha Card JSON
- Swarms API agent review when `SWARMS_API_KEY` is configured

## Run Locally

```bash
npm start
```

Open `http://localhost:4173`.

## Deploy to Vercel

GhostVeil includes Vercel serverless API routes:

- `api/health.js`
- `api/search.js`
- `api/analyze.js`

Deploy steps:

1. Push this repo to GitHub.
2. Import the GitHub repo in Vercel.
3. Add these Vercel environment variables:
   - `SWARMS_API_KEY`
   - `SWARMS_MODEL` = `gpt-4o-mini`
   - `SWARMS_BASE_URL` = `https://api.swarms.world`
4. Deploy.
5. Open the Vercel URL and choose `Swarms API agent` in the Review Engine dropdown.

Do not expose `SWARMS_API_KEY` in frontend code. The deployed app calls Swarms from the serverless API route only.

## Swarms Integration

GhostVeil can run its review through the Swarms Agent Completions API.

Get your Swarms API key:

1. Create or sign in to your Swarms account at https://swarms.world
2. Open https://swarms.world/platform/api-keys
3. Create an API key
4. Create a local `.env` file from `.env.example`

```powershell
Copy-Item .env.example .env
notepad .env
```

Paste your key into `.env`:

```text
SWARMS_API_KEY=your-real-key-here
SWARMS_MODEL=gpt-4o-mini
SWARMS_BASE_URL=https://api.swarms.world
PORT=4173
```

Then start the app:

```powershell
npm start
```

Alternative one-session PowerShell setup:

```powershell
$env:SWARMS_API_KEY="paste-your-key-here"
$env:SWARMS_MODEL="gpt-4o-mini"
npm start
```

When the key is present, choose `Swarms API agent` in the Review Engine dropdown. The backend will call:

```text
POST https://api.swarms.world/v1/agent/completions
```

The API key stays on the server. It is never sent to the browser.

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `SWARMS_API_KEY` | Yes for Swarms review | Runs GhostVeil through Swarms Agent Completions |
| `SWARMS_MODEL` | No | Defaults to `gpt-4o-mini` |
| `SWARMS_BASE_URL` | No | Defaults to `https://api.swarms.world` |
| `PORT` | No | Defaults to `4173` |

DexScreener search does not require an API key.

## Local Checks

```bash
npm run check
```

## Swarms Agent Package

- `agent/ghostveil_oracle_swarm.py`: Swarms-ready agent workflow scaffold
- `agent/system_prompt.md`: full GhostVeil system prompt
- `submission/marketplace-listing.md`: marketplace listing copy
- `submission/launch-checklist.md`: launch checklist
- `assets/ghostveil-marketplace-card.png`: representative marketplace image

## Safety Model

GhostVeil is market intelligence software, not financial advice.

- It never says "buy this now."
- It never guarantees alpha or profit.
- It separates observed evidence from assumptions.
- It includes risks and invalidation conditions.
- It protects private user intent from public Alpha Cards.

## Swarms References

- ACM Hackathon: https://docs.swarms.ai/docs/marketplace/acm-hackathon
- Marketplace monetization: https://docs.swarms.ai/docs/marketplace/tokenization
- Marketplace publishing quickstart: https://docs.swarms.ai/docs/marketplace/marketplace_publishing_quickstart
- Swarms quickstart: https://docs.swarms.world/quickstart
- SequentialWorkflow architecture: https://docs.swarms.world/architectures/sequential-workflow
- DexScreener API reference: https://docs.dexscreener.com/api/reference
