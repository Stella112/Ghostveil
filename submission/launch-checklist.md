# ACM Launch Checklist

## Product

- [ ] Confirm final name: GhostVeil Oracle Swarm
- [ ] Confirm ticker: GVEIL or GHOST
- [ ] Confirm category: Finance / DeFi / Research / Tools
- [ ] Confirm product type: Agent
- [ ] Confirm pricing: Free tier plus $1 Premium Pro Alpha Card
- [ ] Confirm x402 support and settlement preference: USDC or $SWARMS
- [ ] Create Swarms API key at https://swarms.world/platform/api-keys
- [ ] Run app with `SWARMS_API_KEY` configured

## Repository

- [ ] Push this project to a public GitHub repository
- [ ] Include README, agent code, system prompt, working app UI, and submission copy
- [ ] Add screenshots or product video to the README after testing
- [ ] Verify `npm start` works locally

## Vercel Deployment

- [ ] Create or sign in to Vercel at https://vercel.com
- [ ] Import the public GitHub repository
- [ ] Add Vercel environment variable `SWARMS_API_KEY`
- [ ] Add Vercel environment variable `SWARMS_MODEL=gpt-4o-mini`
- [ ] Add Vercel environment variable `SWARMS_BASE_URL=https://api.swarms.world`
- [ ] Deploy and copy the live Vercel URL
- [ ] Verify `/api/health` says Swarms is configured
- [ ] Verify the app can generate an Alpha Card with Review Engine set to Swarms API agent

## Swarms Marketplace

- [ ] Sign in at https://swarms.world
- [ ] Open the launch portal: https://swarms.world/launch?type=prompt&model=tokenized&frenzy=true
- [ ] Select Agent
- [ ] Upload `assets/ghostveil-marketplace-card.png` as the representative image
- [ ] Paste marketplace description from `submission/marketplace-listing.md`
- [ ] Add use cases
- [ ] Add tags and category
- [ ] Enable tokenization through Frenzy Mode
- [ ] Submit before May 27, 2026

## Validation

- [ ] Demo shows scan to Alpha Card
- [ ] Demo shows Tribunal debate
- [ ] Demo shows VeilGuard public/private output
- [ ] Demo shows GhostBack 40% reward pool
- [ ] Agent code includes Swarms `Agent` and `SequentialWorkflow`
- [ ] Public output includes risk warnings and no guaranteed-return claims

## Final Submission Angle

GhostVeil is a marketplace-ready Swarms agent that helps crypto traders find early Solana opportunities, filters noise through multi-agent debate, protects sensitive intent, and monetizes verified Alpha Cards through Premium Pro usage and Frenzy Mode.
