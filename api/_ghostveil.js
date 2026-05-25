const fs = require("fs");
const path = require("path");

const swarmsModel = process.env.SWARMS_MODEL || "gpt-4o-mini";
const swarmsBaseUrl = process.env.SWARMS_BASE_URL || "https://api.swarms.world";
const swarmsMode = process.env.SWARMS_MODE || "swarm";
const premiumUsd = Number(process.env.PREMIUM_USD || "0.1");
const swarmsMint = process.env.SWARMS_TOKEN_MINT || "74SBV4zDXxTRgv1pEMoECskKBkZHc2yGPnc7GYVepump";
const swarmsDecimals = Number(process.env.SWARMS_TOKEN_DECIMALS || "6");
const premiumTreasuryWallet =
  process.env.PREMIUM_TREASURY_WALLET || "4ogwVdsKTyCKB9mowj5QyehhCpiQE5FsijG8gcL5haYE";

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  const amount = number(value);
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(2)}`;
}

function ageHours(pair) {
  if (!pair?.pairCreatedAt) return null;
  return Math.max(0, (Date.now() - pair.pairCreatedAt) / 36e5);
}

function formatAge(hours) {
  if (hours === null) return "unknown";
  if (hours < 48) return `${hours.toFixed(1)} hours`;
  return `${(hours / 24).toFixed(1)} days`;
}

function alphaRatingFromScores(ghostProof, risk) {
  if (risk >= 82) return "F";
  if (ghostProof >= 82 && risk < 45) return "A";
  if (ghostProof >= 70 && risk < 60) return "B";
  if (ghostProof >= 55) return "C";
  if (ghostProof >= 40) return "D";
  return "F";
}

function sourceRating({ pair, socialContext, directEvidenceCount }) {
  let score = 45;
  if (pair) score += 25;
  if (socialContext?.xPostedAt) score += 15;
  if (directEvidenceCount >= 4) score += 10;
  if (!pair) score -= 15;
  score = clamp(score);
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function extractXPostMeta(...values) {
  const text = values.filter(Boolean).join("\n");
  const urlMatch = text.match(/https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[^/\s]+\/status\/(\d+)/i);
  const id = urlMatch?.[1];
  if (!id) {
    return {
      xStatus: "not_provided",
      xUrl: null,
      xPostId: null,
      xPostedAt: null,
      note: "No X/Twitter post URL was provided. Social timing cannot be verified.",
    };
  }

  let postedAt = null;
  try {
    const timestamp = Number((BigInt(id) >> 22n) + 1288834974657n);
    if (Number.isFinite(timestamp)) postedAt = new Date(timestamp).toISOString();
  } catch {}

  return {
    xStatus: postedAt ? "decoded_from_status_id" : "found_needs_confirmation",
    xUrl: urlMatch[0],
    xPostId: id,
    xPostedAt: postedAt,
    note: postedAt
      ? "X post time decoded from the public status ID. Engagement and author quality still need confirmation."
      : "X post URL found, but timestamp could not be decoded.",
  };
}

function stageFromScores(stealth, risk, age) {
  if (risk >= 78) return "Exit-Liquidity Risk";
  if (stealth <= 35) return "Crowded";
  if (age !== null && age <= 12) return "Hidden";
  if (stealth >= 61) return "Emerging";
  return "Needs Confirmation";
}

function verdictFromScores(ghostProof, risk, conviction) {
  if (risk >= 82) return "High Risk";
  if (ghostProof >= 72 && risk < 60) return "Approved";
  if (ghostProof >= 62 && conviction >= 58) return "Premium Signal Candidate";
  if (ghostProof >= 48) return "Watchlist";
  return "Rejected";
}

function parseNotes(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function pairSummary(pair) {
  if (!pair) return null;
  return {
    chainId: pair.chainId,
    dexId: pair.dexId,
    url: pair.url,
    pairAddress: pair.pairAddress,
    baseToken: pair.baseToken,
    quoteToken: pair.quoteToken,
    priceUsd: pair.priceUsd,
    fdv: pair.fdv,
    marketCap: pair.marketCap,
    liquidity: pair.liquidity,
    volume: pair.volume,
    txns: pair.txns,
    priceChange: pair.priceChange,
    pairCreatedAt: pair.pairCreatedAt,
    labels: pair.labels,
    info: pair.info,
  };
}

function compactPairForAgent(pair) {
  if (!pair) return null;
  return {
    chainId: pair.chainId,
    dexId: pair.dexId,
    url: pair.url,
    pairAddress: pair.pairAddress,
    baseToken: pair.baseToken,
    quoteToken: pair.quoteToken,
    priceUsd: pair.priceUsd,
    marketCap: pair.marketCap,
    fdv: pair.fdv,
    liquidityUsd: pair.liquidity?.usd,
    volume: pair.volume,
    transactions: pair.txns,
    priceChange: pair.priceChange,
    pairCreatedAt: pair.pairCreatedAt,
    pairAge: formatAge(ageHours(pair)),
    labels: pair.labels,
  };
}

async function fetchDexScreener(query) {
  const safeQuery = String(query || "").trim();
  if (!safeQuery) return { pairs: [], error: null };

  const addressMatch = safeQuery.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  const endpoint = addressMatch
    ? `https://api.dexscreener.com/latest/dex/tokens/${addressMatch[0]}`
    : `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(safeQuery)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "GhostVeil-Oracle-Swarm/0.1",
      },
    });
    if (!response.ok) return { pairs: [], error: `DexScreener returned HTTP ${response.status}` };

    const payload = await response.json();
    const pairs = Array.isArray(payload.pairs) ? payload.pairs : [];
    return {
      pairs: pairs
        .filter((pair) => pair.chainId === "solana")
        .sort((a, b) => number(b.volume?.h24) - number(a.volume?.h24))
        .slice(0, 8)
        .map(pairSummary),
      error: null,
    };
  } catch (error) {
    return {
      pairs: [],
      error: error.name === "AbortError" ? "DexScreener request timed out" : error.message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function getPremiumQuote() {
  const result = await fetchDexScreener(swarmsMint);
  const pair =
    result.pairs.find((item) => item.baseToken?.address === swarmsMint || item.quoteToken?.address === swarmsMint) ||
    result.pairs[0];
  const priceUsd = number(pair?.priceUsd);
  if (!priceUsd) {
    return {
      ok: false,
      error: "Unable to quote $SWARMS price from DexScreener.",
      premiumUsd,
      mint: swarmsMint,
      treasuryWallet: premiumTreasuryWallet,
      decimals: swarmsDecimals,
    };
  }

  const tokenAmount = premiumUsd / priceUsd;
  const rawAmount = Math.ceil(tokenAmount * 10 ** swarmsDecimals).toString();
  return {
    ok: true,
    premiumUsd,
    symbol: "$SWARMS",
    mint: swarmsMint,
    decimals: swarmsDecimals,
    treasuryWallet: premiumTreasuryWallet,
    priceUsd,
    tokenAmount,
    rawAmount,
    pairUrl: pair?.url || null,
    quotedAt: new Date().toISOString(),
  };
}

function getGhostveilSystemPrompt() {
  const candidates = [
    path.join(process.cwd(), "agent", "system_prompt.md"),
    path.join(__dirname, "..", "agent", "system_prompt.md"),
  ];
  for (const candidate of candidates) {
    try {
      return fs.readFileSync(candidate, "utf8");
    } catch {}
  }
  return [
    "You are GhostVeil Oracle Swarm.",
    "Analyze Solana market signals with a cautious, evidence-focused tone.",
    "Never provide financial advice or guaranteed profit claims.",
    "Return structured Alpha Cards with evidence, assumptions, risks, invalidation, and verdict.",
  ].join("\n");
}

function analyzeSignal({ query, pair, notes = {}, publicMode = true, premiumMode = false, connectorError = null }) {
  const walletNotes = parseNotes(notes.wallet);
  const liquidityNotes = parseNotes(notes.liquidity);
  const narrativeNotes = parseNotes(notes.narrative);
  const socialNotes = parseNotes(notes.social);
  const counterNotes = parseNotes(notes.counter);
  const privateNotes = parseNotes(notes.private);

  const tokenName = pair?.baseToken?.name || pair?.baseToken?.symbol || query || "User Provided Signal";
  const tokenSymbol = pair?.baseToken?.symbol || "";
  const signalName =
    tokenSymbol && tokenSymbol.toLowerCase() !== String(tokenName).toLowerCase()
      ? `${tokenName} (${tokenSymbol})`
      : tokenName;
  const dex = pair?.dexId ? pair.dexId.toUpperCase() : "Provided Data";
  const age = ageHours(pair);
  const liq = number(pair?.liquidity?.usd);
  const vol24 = number(pair?.volume?.h24);
  const vol6 = number(pair?.volume?.h6);
  const vol1 = number(pair?.volume?.h1);
  const change24 = number(pair?.priceChange?.h24);
  const change6 = number(pair?.priceChange?.h6);
  const h24Buys = number(pair?.txns?.h24?.buys);
  const h24Sells = number(pair?.txns?.h24?.sells);
  const h24Txns = h24Buys + h24Sells;
  const buyRatio = h24Txns ? h24Buys / h24Txns : 0.5;
  const volumeToLiquidity = liq ? vol24 / liq : 0;

  let stealth = 48;
  if (age !== null && age <= 6) stealth += 28;
  else if (age !== null && age <= 24) stealth += 18;
  else if (age !== null && age <= 72) stealth += 8;
  else if (age !== null && age > 168) stealth -= 12;
  if (vol24 > 1_000_000) stealth -= 16;
  if (vol24 > 250_000 && age !== null && age <= 24) stealth -= 5;
  if (socialNotes.length) stealth -= 4;
  if (!pair && walletNotes.length + liquidityNotes.length + narrativeNotes.length >= 2) stealth += 8;

  let conviction = 34;
  if (liq >= 10_000) conviction += 10;
  if (liq >= 50_000) conviction += 10;
  if (vol24 >= 25_000) conviction += 8;
  if (vol6 >= 10_000 || vol1 >= 2_500) conviction += 8;
  if (h24Txns >= 100) conviction += 9;
  if (buyRatio >= 0.52 && buyRatio <= 0.68) conviction += 6;
  if (walletNotes.length) conviction += 6;
  if (liquidityNotes.length) conviction += 5;
  if (narrativeNotes.length) conviction += 5;
  if (counterNotes.length) conviction -= 5;
  if (!pair) conviction -= 8;

  let risk = 35;
  if (!pair) risk += 14;
  if (liq > 0 && liq < 10_000) risk += 25;
  else if (liq > 0 && liq < 50_000) risk += 13;
  if (!liq) risk += 12;
  if (Math.abs(change24) >= 100) risk += 16;
  if (Math.abs(change6) >= 45) risk += 10;
  if (volumeToLiquidity >= 8) risk += 10;
  if (h24Txns > 0 && buyRatio < 0.43) risk += 12;
  if (counterNotes.length) risk += 10;
  if (privateNotes.length) risk += 4;
  if (age !== null && age <= 3) risk += 8;

  stealth = clamp(stealth);
  conviction = clamp(conviction);
  risk = clamp(risk);
  const ghostProof = clamp(stealth * 0.24 + conviction * 0.46 + (100 - risk) * 0.3);
  const currentStage = stageFromScores(stealth, risk, age);
  const finalVerdict = verdictFromScores(ghostProof, risk, conviction);
  const socialContext = extractXPostMeta(query, notes.social, notes.narrative);
  const alphaRating = alphaRatingFromScores(ghostProof, risk);

  const directEvidence = [];
  if (pair) {
    directEvidence.push(`DexScreener Solana pair on ${dex}${pair.url ? `: ${pair.url}` : ""}.`);
    directEvidence.push(`Liquidity observed at ${money(liq)} with 24h volume of ${money(vol24)}.`);
    directEvidence.push(`24h price change: ${change24.toFixed(2)}%. 6h price change: ${change6.toFixed(2)}%.`);
    directEvidence.push(`24h transaction flow: ${h24Buys} buys and ${h24Sells} sells.`);
    if (age !== null) directEvidence.push(`Pair age estimate: ${formatAge(age)}.`);
  } else {
    directEvidence.push("No live market pair was connected. Analysis is based only on user-provided evidence.");
  }
  directEvidence.push(socialContext.note);

  const route = [
    "User input",
    pair ? "DexScreener Solana pair" : "Provided-data mode",
    socialContext.xPostedAt ? "X timestamp decoded" : "X timing missing",
    "GhostVeil local precheck",
    "Alpha Tribunal verdict",
  ].join(" -> ");
  const rating = sourceRating({ pair, socialContext, directEvidenceCount: directEvidence.length });

  const assumptions = [];
  if (walletNotes.length) assumptions.push("Wallet evidence is based on user notes and needs independent verification.");
  if (socialNotes.length || narrativeNotes.length) assumptions.push("Narrative and social quality are inferred from provided notes.");
  if (!pair) assumptions.push("Scores are framework-based because live Solana market data is unavailable.");
  if (connectorError) assumptions.push(`Live connector note: ${connectorError}.`);

  const evidenceTrail = {
    wallet: walletNotes.length ? walletNotes : ["No wallet evidence provided or connected."],
    liquidity: liquidityNotes.length
      ? liquidityNotes
      : pair
        ? [`Observed liquidity: ${money(liq)}. Volume/liquidity ratio: ${volumeToLiquidity.toFixed(2)}.`]
        : ["No liquidity evidence provided or connected."],
    narrative: narrativeNotes.length ? narrativeNotes : ["No narrative notes provided."],
    socialMomentum: socialNotes.length ? [...socialNotes, socialContext.note] : [socialContext.note],
    counterSignals: counterNotes.length
      ? counterNotes
      : risk >= 65
        ? ["Risk score is elevated. Treat as a watchlist or reject candidate until confirmation improves."]
        : ["No explicit counter-signal provided. Continue monitoring for sell pressure, crowding, and liquidity weakness."],
  };

  const alphaTribunal = {
    bullCase:
      conviction >= 64
        ? "Evidence quality is strong enough to justify continued monitoring."
        : "There are some early clues, but evidence is not yet strong enough for high conviction.",
    bearCase:
      risk >= 65
        ? "Risk is elevated. The setup can become exit liquidity if attention outruns liquidity."
        : "The bear case is mainly missing confirmation and the possibility that early momentum fades.",
    timingCheck:
      currentStage === "Crowded" || currentStage === "Exit-Liquidity Risk"
        ? "Timing is weak. The signal may already be visible to the wider market."
        : "Timing is still potentially early, but confirmation is required before treating it as strong.",
    riskReview: `Liquidity, MEV, holder concentration, and sell pressure require monitoring. Current risk score: ${risk}.`,
    crowdingRisk:
      stealth <= 35
        ? "Crowding risk is high."
        : stealth <= 60
          ? "Crowding risk is rising."
          : "Crowding risk appears manageable from the available evidence.",
    finalJudgment:
      finalVerdict === "Rejected" || finalVerdict === "High Risk"
        ? "Rejected or high-risk until stronger evidence appears."
        : finalVerdict === "Approved"
          ? "Approved as a risk-aware market intelligence signal, not a trading instruction."
          : "Watchlist candidate. Research deeper and wait for confirmation.",
  };

  const sensitiveRemoved = [];
  if (privateNotes.length) sensitiveRemoved.push("Private strategy notes");
  if (String(notes.wallet || "").match(/[1-9A-HJ-NP-Za-km-z]{32,44}/)) sensitiveRemoved.push("Specific wallet identifiers");
  if (String(notes.private || "").match(/\$?\d+(\.\d+)?\s*(sol|usd|usdc|%)/i)) sensitiveRemoved.push("Sizing or threshold details");
  if (!sensitiveRemoved.length) sensitiveRemoved.push("No sensitive user-specific details detected");

  const invalidation =
    risk >= 70
      ? "Reject unless liquidity improves, sell pressure cools, and independent evidence confirms the thesis."
      : pair
        ? "Invalidate if volume fades below recent baseline, sell pressure dominates, liquidity drops sharply, or social attention becomes purely promotional."
        : "Invalidate if provided evidence cannot be verified by wallet, liquidity, narrative, or social data.";

  const suggested =
    finalVerdict === "Approved"
      ? "Monitor and research deeper. Do not treat this as a buy signal. Watch invalidation conditions first."
      : finalVerdict === "Premium Signal Candidate"
        ? "Request Premium Pro Card for deeper evidence, private brief notes, and alert logic."
        : finalVerdict === "Watchlist"
          ? "Keep on watchlist and wait for stronger liquidity, wallet, and narrative confirmation."
          : "Avoid or reject until the evidence materially improves.";

  return {
    generatedAt: new Date().toISOString(),
    dataStatus: pair
      ? "Live DexScreener market context connected. Wallet and social details are only used when provided by the user."
      : "No live Solana pair connected. This is framework-based analysis of user-provided data.",
    sourceQuality: {
      livePairConnected: Boolean(pair),
      userEvidenceProvided: walletNotes.length + liquidityNotes.length + narrativeNotes.length + socialNotes.length + counterNotes.length > 0,
      assumptions,
      directEvidence,
    },
    alphaCard: {
      signalName,
      marketNarrative: pair ? `Solana ${dex} market signal` : "User-provided Solana market signal",
      currentStage,
      alphaRating,
      sourceRating: rating,
      detectedAt: new Date().toISOString(),
      firstSeenAt: pair?.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : null,
      signalRoute: route,
      socialContext,
      scores: { stealth, conviction, risk, ghostProof },
      whyItMattersNow: pair
        ? `GhostVeil found current Solana market context for ${tokenName}. The signal is scored from liquidity, volume, transaction flow, age, risk factors, and any evidence supplied by the user. ${socialContext.xPostedAt ? `The linked X post appears to have been posted at ${socialContext.xPostedAt}.` : "No X post URL was provided, so social timing is not verified."}`
        : `GhostVeil can structure the signal and risk review, but live Solana data is not connected for this request. ${socialContext.xPostedAt ? `The linked X post appears to have been posted at ${socialContext.xPostedAt}.` : "No X post URL was provided, so social timing is not verified."}`,
      evidenceTrail,
      alphaTribunal,
      veilGuardPrivacyCheck: {
        publicSafeSummary:
          publicMode
            ? "Public card is sanitized and avoids user-specific intent, exact sizing, and private strategy."
            : "Private brief mode is enabled. Do not share this output publicly without sanitizing it first.",
        sensitiveDetailsRemoved: sensitiveRemoved,
        privacyRiskLevel: privateNotes.length ? "Medium" : "Low",
      },
      ghostTradeRiskPreview: {
        bestCasePath: "Evidence strengthens across liquidity, transaction quality, and organic narrative attention.",
        baseCasePath: "Signal remains watchlist-worthy while confirmation develops or fades.",
        worstCasePath: "Liquidity weakens, sell pressure rises, and the setup becomes crowded or promotional.",
        keyRiskTrigger:
          risk >= 65
            ? "Elevated risk score means poor liquidity, sell pressure, or volatility can quickly invalidate the signal."
            : "The key trigger is loss of volume quality or sudden crowding without deeper liquidity.",
        invalidationPoint: invalidation,
      },
      suggestedNextSteps: suggested,
      finalVerdict,
      shareableSummary: `GhostVeil Alpha Card: ${tokenName} is ${currentStage.toLowerCase()} with Stealth ${stealth}, Conviction ${conviction}, Risk ${risk}, GhostProof ${ghostProof}. Verdict: ${finalVerdict}. Watch invalidation before acting.`,
      premiumMode,
      disclaimer:
        "GhostVeil provides market intelligence and risk-aware research outputs. This is not financial advice and does not guarantee profit.",
    },
    ghostBack: premiumMode
      ? {
          premiumFeeUsd: 0.1,
          rewardPoolUsd: 0.04,
          fundedBy: "Premium Signal revenue, not token trading fees",
          splits: { signalScouts: 0.016, alphaValidators: 0.014, cardDistributors: 0.01 },
        }
      : null,
  };
}

function buildSwarmsTask({ query, pair, notes, publicMode, premiumMode, localResult }) {
  return JSON.stringify(
    {
      instruction:
        "Return a GhostVeil Alpha Card as strict JSON. Use only the observed market context and user-provided notes below. Separate observed evidence from assumptions. Do not tell the user to buy or sell.",
      userRequest: { query, publicMode, premiumMode },
      observedMarketContext: compactPairForAgent(pair),
      userProvidedEvidence: notes || {},
      localPrecheck: localResult?.alphaCard || null,
      safetyReminder:
        "If live data is incomplete, say what is missing. Do not invent wallet/social data. Do not promise profit.",
    },
    null,
    2,
  );
}

function buildGhostVeilAgents() {
  const basePrompt = getGhostveilSystemPrompt();
  return [
    {
      agent_name: "VeilSense Signal Scout",
      description: "Finds early Solana market signals and grades stealth, liquidity, wallet, and narrative clues.",
      system_prompt: `${basePrompt}\n\nYou are VeilSense. Focus only on observed signal discovery, timing, stealth, and source quality.`,
      model_name: swarmsModel,
      temperature: 0.18,
      max_tokens: 1800,
      max_loops: 1,
    },
    {
      agent_name: "Alpha Tribunal Bear Judge",
      description: "Attacks the signal, finds invalidation risks, and rejects weak or crowded setups.",
      system_prompt: `${basePrompt}\n\nYou are the Alpha Tribunal Bear Judge. Focus on what could be wrong, crowded, manipulated, unsafe, or unsupported.`,
      model_name: swarmsModel,
      temperature: 0.18,
      max_tokens: 1800,
      max_loops: 1,
    },
    {
      agent_name: "VeilGuard Privacy Sentinel",
      description: "Sanitizes public output and removes sensitive wallet intent, sizing, and strategy details.",
      system_prompt: `${basePrompt}\n\nYou are VeilGuard. Focus on privacy, public-safe summaries, and removing trader intent or sensitive execution details.`,
      model_name: swarmsModel,
      temperature: 0.12,
      max_tokens: 1500,
      max_loops: 1,
    },
    {
      agent_name: "GhostProof Final Card Writer",
      description: "Synthesizes the swarm into one strict JSON GhostVeil Alpha Card.",
      system_prompt: `${basePrompt}\n\nYou are GhostProof. Return only strict JSON matching the GhostVeil Alpha Card shape. Do not add markdown.`,
      model_name: swarmsModel,
      temperature: 0.12,
      max_tokens: 3000,
      max_loops: 1,
    },
  ];
}

function extractTextFromSwarmsPayload(payload) {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return "";

  if (Array.isArray(payload.outputs) && payload.outputs.length) {
    const output = payload.outputs.find((item) => typeof item?.content === "string");
    if (output) return output.content;
  }

  const candidates = [
    payload.output,
    payload.response,
    payload.result,
    payload.content,
    payload.message,
    payload.completion,
    payload.text,
    payload.data?.output,
    payload.data?.response,
    payload.data?.result,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string") return candidate;
    if (candidate && typeof candidate === "object") {
      const nested = extractTextFromSwarmsPayload(candidate);
      if (nested) return nested;
    }
  }
  return JSON.stringify(payload);
}

function parseJsonFromText(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      try {
        return JSON.parse(fenced[1]);
      } catch {
        return null;
      }
    }
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function mergeSwarmsAlphaCard(localResult, swarmsCard) {
  if (!swarmsCard || typeof swarmsCard !== "object") return localResult;
  const maybeCard = swarmsCard.alphaCard || swarmsCard;
  return {
    ...localResult,
    alphaCard: {
      ...localResult.alphaCard,
      ...maybeCard,
      scores: { ...localResult.alphaCard.scores, ...(maybeCard.scores || {}) },
      evidenceTrail: { ...localResult.alphaCard.evidenceTrail, ...(maybeCard.evidenceTrail || {}) },
      alphaTribunal: { ...localResult.alphaCard.alphaTribunal, ...(maybeCard.alphaTribunal || {}) },
      veilGuardPrivacyCheck: {
        ...localResult.alphaCard.veilGuardPrivacyCheck,
        ...(maybeCard.veilGuardPrivacyCheck || {}),
      },
      ghostTradeRiskPreview: {
        ...localResult.alphaCard.ghostTradeRiskPreview,
        ...(maybeCard.ghostTradeRiskPreview || {}),
      },
      disclaimer:
        maybeCard.disclaimer ||
        localResult.alphaCard.disclaimer ||
        "GhostVeil provides market intelligence and risk-aware research outputs. This is not financial advice and does not guarantee profit.",
    },
  };
}

async function runSwarmsReview({ query, pair, notes, publicMode, premiumMode, localResult }) {
  if (!process.env.SWARMS_API_KEY) {
    return {
      enabled: false,
      status: "missing_api_key",
      message: "SWARMS_API_KEY is not set. Using local GhostVeil review only.",
    };
  }

  const task = buildSwarmsTask({ query, pair, notes, publicMode, premiumMode, localResult });
  const useSwarm = swarmsMode !== "agent";
  const response = await fetch(`${swarmsBaseUrl}${useSwarm ? "/v1/swarm/completions" : "/v1/agent/completions"}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.SWARMS_API_KEY,
    },
    body: JSON.stringify(
      useSwarm
        ? {
            name: "GhostVeil Oracle Swarm",
            description:
              "A Solana alpha verification swarm with VeilSense, Alpha Tribunal, VeilGuard, and GhostProof agents.",
            swarm_type: "MixtureOfAgents",
            max_loops: 1,
            agents: buildGhostVeilAgents(),
            task,
          }
        : {
            agent_config: {
              agent_name: "GhostVeil Oracle Swarm",
              description:
                "Solana market intelligence agent that verifies signals, separates evidence from assumptions, protects trader intent, and returns risk-aware Alpha Cards.",
              system_prompt: getGhostveilSystemPrompt(),
              model_name: swarmsModel,
              temperature: 0.2,
              max_tokens: 3000,
              max_loops: 1,
            },
            task,
          },
    ),
  });

  const payloadText = await response.text();
  let payload;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    payload = { raw: payloadText };
  }

  if (!response.ok) {
    return {
      enabled: true,
      status: "error",
      message: `Swarms API returned HTTP ${response.status}`,
      raw: payload,
    };
  }

  const text = extractTextFromSwarmsPayload(payload);
  const parsed = parseJsonFromText(text);
  return {
    enabled: true,
    status: parsed ? "ok" : "raw",
    mode: useSwarm ? "swarm" : "agent",
    model: swarmsModel,
    parsed,
    rawText: text,
    raw: payload,
  };
}

module.exports = {
  analyzeSignal,
  fetchDexScreener,
  getPremiumQuote,
  mergeSwarmsAlphaCard,
  runSwarmsReview,
};
