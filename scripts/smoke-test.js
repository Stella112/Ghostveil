const fs = require("fs");
const path = require("path");

function loadLocalEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equals = trimmed.indexOf("=");
    if (equals === -1) continue;
    const key = trimmed.slice(0, equals).trim();
    let value = trimmed.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && !process.env[key]) process.env[key] = value;
  }
}

loadLocalEnv();

const {
  analyzeSignal,
  fetchDexScreener,
  mergeSwarmsAlphaCard,
  runSwarmsReview,
} = require("../api/_ghostveil");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  console.log("GhostVeil smoke test starting");

  assert(process.env.SWARMS_API_KEY, "SWARMS_API_KEY is missing. Add it to .env or your environment.");

  const market = await fetchDexScreener("BONK");
  assert(!market.error, `DexScreener error: ${market.error}`);
  assert(market.pairs.length > 0, "DexScreener returned no Solana pairs for BONK.");
  console.log(`DexScreener ok: ${market.pairs.length} Solana pairs`);

  const notes = {
    wallet: "No verified wallet cluster provided. Needs confirmation before public claim.",
    liquidity: "Use live DexScreener market context when available.",
    narrative: "Established Solana meme asset; likely high visibility rather than hidden alpha.",
    social: "High visibility, likely crowded.",
    counter: "Not an early hidden signal; watch crowding and sell pressure.",
    private: "Private watchlist threshold hidden from public card.",
  };

  const localResult = analyzeSignal({
    query: "BONK",
    pair: market.pairs[0],
    notes,
    publicMode: true,
    premiumMode: true,
  });
  assert(localResult.alphaCard?.signalName, "Local analysis did not produce an Alpha Card.");
  console.log(`Local GhostVeil ok: ${localResult.alphaCard.signalName} / ${localResult.alphaCard.finalVerdict}`);

  const swarmsReview = await runSwarmsReview({
    query: "BONK",
    pair: market.pairs[0],
    notes,
    publicMode: true,
    premiumMode: true,
    localResult,
  });
  assert(swarmsReview.enabled, "Swarms review did not run.");
  assert(swarmsReview.status === "ok", `Swarms review status was ${swarmsReview.status}.`);

  const merged = mergeSwarmsAlphaCard(localResult, swarmsReview.parsed);
  assert(merged.alphaCard?.finalVerdict, "Merged Swarms card is missing final verdict.");
  assert(!Object.prototype.hasOwnProperty.call(merged.alphaCard, "job_id"), "Swarms job metadata leaked into Alpha Card.");

  console.log(`Swarms API ok: ${merged.alphaCard.signalName} / ${merged.alphaCard.finalVerdict}`);
  console.log("GhostVeil smoke test passed");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
