# GhostVeil Oracle Swarm

GhostVeil is a working privacy-first Solana signal verification app and Swarms multi-agent package.

It helps traders and researchers inspect early Solana market signals without acting like a pump group. The app can fetch Solana market context through DexScreener, derive an AI Evidence Desk from token/mint/pair/X-post inputs, stress-test the signal through a structured GhostVeil review, protect sensitive trader intent, and return an exportable Alpha Card.

GhostVeil does not execute trades, promise profit, or invent live data. If live market context is unavailable, the app clearly labels the output as framework-based analysis of user-provided evidence.

## Product Flow

1. Enter a token, mint address, pair URL, or market note.
2. Fetch Solana market context, when available.
3. GhostVeil fills the AI Evidence Desk.
4. Choose local GhostVeil rules or Swarms multi-agent review.
5. Generate a GhostVeil Alpha Card with ratings, route, evidence, risk, and verdict.
6. Export the Alpha Card JSON or copy the public-safe X/Discord summary.

## What the App Includes

- DexScreener Solana market context connector
- Solana RPC wallet intelligence for token-holder concentration and recent wallet counterparty heuristics
- Provided-data mode when live data is unavailable
- VeilSense scoring for stealth, conviction, and risk
- Alpha Tribunal review with bull, bear, timing, risk, and crowding checks
- VeilGuard privacy check that separates public output from private notes
- GhostTrade Risk Preview with best/base/worst paths and invalidation point
- GhostProof Score and final verdict
- Watchlist history stored locally in the browser
- Free full-detail Alpha Cards with no wallet or payment gate
- Exportable Alpha Card JSON
- Swarms multi-agent review when `SWARMS_API_KEY` is configured

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
5. Open the Vercel URL and choose `Swarms multi-agent swarm` in the Review Engine dropdown.

Do not expose `SWARMS_API_KEY` in frontend code. The deployed app calls Swarms from the serverless API route only.

## Swarms Integration

GhostVeil can run its review through the Swarms multi-agent completions API.

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
SWARMS_MODE=swarm
HELIUS_API_KEY=
SOLANA_RPC_URLS=
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

When the key is present, choose `Swarms multi-agent swarm` in the Review Engine dropdown. By default the backend runs GhostVeil through a multi-agent Swarms completion:

```text
POST https://api.swarms.world/v1/swarm/completions
```

Set `SWARMS_MODE=agent` only if you want the older single-agent fallback.

The API key stays on the server. It is never sent to the browser.

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `SWARMS_API_KEY` | Yes for Swarms review | Runs GhostVeil through Swarms multi-agent completions |
| `SWARMS_MODEL` | No | Defaults to `gpt-4o-mini` |
| `SWARMS_BASE_URL` | No | Defaults to `https://api.swarms.world` |
| `SWARMS_MODE` | No | Defaults to `swarm`; set `agent` for fallback |
| `HELIUS_API_KEY` | No | Recommended for reliable Solana wallet/holder cluster scans |
| `SOLANA_RPC_URLS` | No | Optional comma-separated Solana RPC fallback endpoints |
| `PORT` | No | Defaults to `4173` |

DexScreener search does not require an API key. Wallet intelligence can use public Solana RPC, but public endpoints may rate-limit holder-cluster calls. Add `HELIUS_API_KEY` or `SOLANA_RPC_URLS` for reliable production scans.

## Local Checks

```bash
npm run check
```

## Integration Smoke Test

After adding `SWARMS_API_KEY` to `.env`, run:

```bash
npm run test:api
```

This checks DexScreener market context, local GhostVeil scoring, Swarms multi-agent completions, and the final Alpha Card merge.

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
- It does not require wallet connection or payment in the current build.
- Wallet cluster notes are public on-chain heuristics, not proof that wallets share ownership.

## Swarms References

- ACM Hackathon: https://docs.swarms.ai/docs/marketplace/acm-hackathon
- Marketplace monetization: https://docs.swarms.ai/docs/marketplace/tokenization
- Marketplace publishing quickstart: https://docs.swarms.ai/docs/marketplace/marketplace_publishing_quickstart
- Swarms quickstart: https://docs.swarms.world/quickstart
- SequentialWorkflow architecture: https://docs.swarms.world/architectures/sequential-workflow
- DexScreener API reference: https://docs.dexscreener.com/api/reference
