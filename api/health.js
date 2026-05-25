module.exports = async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  res.status(200).json({
    ok: true,
    app: "GhostVeil Oracle Swarm",
    connectors: ["DexScreener Solana market context"],
    swarms: {
      configured: Boolean(process.env.SWARMS_API_KEY),
      model: process.env.SWARMS_MODEL || "gpt-4o-mini",
      endpoint: `${process.env.SWARMS_BASE_URL || "https://api.swarms.world"}/v1/agent/completions`,
    },
    tradingExecution: false,
    deployment: "vercel",
  });
};
