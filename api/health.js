module.exports = async function handler(req, res) {
  const baseUrl = process.env.SWARMS_BASE_URL || "https://api.swarms.world";
  const mode = process.env.SWARMS_MODE || "swarm";
  res.setHeader("cache-control", "no-store");
  res.status(200).json({
    ok: true,
    app: "GhostVeil Oracle Swarm",
    connectors: ["DexScreener Solana market context", "Solana RPC wallet intelligence"],
    swarms: {
      configured: Boolean(process.env.SWARMS_API_KEY),
      model: process.env.SWARMS_MODEL || "gpt-4o-mini",
      mode,
      endpoint: `${baseUrl}${mode === "agent" ? "/v1/agent/completions" : "/v1/swarm/completions"}`,
    },
    tradingExecution: false,
    deployment: "vercel",
  });
};
