const { fetchDexScreener } = require("./_ghostveil");

module.exports = async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const query = req.query?.q || "";
  const result = await fetchDexScreener(query);
  res.status(result.error ? 206 : 200).json({
    query,
    source: "DexScreener",
    warning: result.error,
    pairs: result.pairs,
  });
};
