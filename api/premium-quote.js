const { getPremiumQuote } = require("./_ghostveil");

module.exports = async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const quote = await getPremiumQuote();
  res.status(quote.ok ? 200 : 502).json(quote);
};
