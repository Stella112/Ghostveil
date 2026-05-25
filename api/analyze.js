const {
  analyzeSignal,
  fetchDexScreener,
  mergeSwarmsAlphaCard,
  runSwarmsReview,
} = require("./_ghostveil");

module.exports = async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body || {};
    let selectedPair = body.selectedPair || null;
    let connectorError = null;

    if (!selectedPair && body.sourceMode !== "provided") {
      const fetched = await fetchDexScreener(body.query);
      selectedPair = fetched.pairs[0] || null;
      connectorError = fetched.error;
    }

    const result = analyzeSignal({
      query: body.query,
      pair: selectedPair,
      notes: body.notes,
      publicMode: body.publicMode !== false,
      premiumMode: Boolean(body.premiumMode),
      connectorError,
    });

    if (body.reviewEngine === "swarms") {
      const swarmsReview = await runSwarmsReview({
        query: body.query,
        pair: selectedPair,
        notes: body.notes,
        publicMode: body.publicMode !== false,
        premiumMode: Boolean(body.premiumMode),
        localResult: result,
      });
      const merged = mergeSwarmsAlphaCard(result, swarmsReview.parsed);
      if (swarmsReview.status === "ok" && merged.alphaCard?.signalRoute && !merged.alphaCard.signalRoute.includes("Swarms")) {
        merged.alphaCard.signalRoute = merged.alphaCard.signalRoute.replace(
          "GhostVeil local precheck",
          "GhostVeil local precheck -> Swarms multi-agent swarm",
        );
      }
      res.status(200).json({
        ...merged,
        reviewEngine: swarmsReview.status === "ok" ? "swarms" : "local",
        swarmsReview,
      });
      return;
    }

    res.status(200).json({
      ...result,
      reviewEngine: "local",
      swarmsReview: {
        enabled: Boolean(process.env.SWARMS_API_KEY),
        status: process.env.SWARMS_API_KEY ? "available_not_used" : "missing_api_key",
      },
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
