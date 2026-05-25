const state = {
  selectedPair: null,
  latestCard: null,
  history: JSON.parse(localStorage.getItem("ghostveil-history") || "[]"),
  wallet: {
    connected: false,
    address: "",
    provider: "",
  },
  premiumUnlocked: false,
  paymentStatus: "unpaid",
};

const PREMIUM_FEE_USD = 0.1;
const GHOSTBACK_RATE = 0.4;

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value) {
  const amount = Number(value || 0);
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(2)}`;
}

function setLoading(isLoading) {
  $("#searchMarket").disabled = isLoading;
  $("#scanForm .primary").disabled = isLoading;
  $("#scanForm .primary").textContent = isLoading ? "Running Review" : "Generate Alpha Card";
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok && response.status !== 206) {
    throw new Error(payload.error || `Request failed with ${response.status}`);
  }
  return payload;
}

function pairLabel(pair) {
  const base = pair?.baseToken?.symbol || pair?.baseToken?.name || "Unknown";
  const quote = pair?.quoteToken?.symbol || "";
  return quote ? `${base}/${quote}` : base;
}

function renderSearchResults(payload) {
  const box = $("#searchResults");
  if (payload.warning && !payload.pairs.length) {
    box.innerHTML = `<div class="notice">Live connector unavailable: ${escapeHtml(payload.warning)}. You can still analyze provided data.</div>`;
    return;
  }

  if (!payload.pairs.length) {
    box.innerHTML = `<div class="notice">No Solana market pairs found. Add evidence manually or try a mint address.</div>`;
    return;
  }

  box.innerHTML = payload.pairs
    .map((pair, index) => {
      const selected = state.selectedPair?.pairAddress === pair.pairAddress ? " selected" : "";
      return `
        <button class="pair-result${selected}" type="button" data-index="${index}">
          <strong>${escapeHtml(pairLabel(pair))}</strong>
          <span>${escapeHtml((pair.dexId || "DEX").toUpperCase())} ${money(pair.liquidity?.usd)} liq ${money(pair.volume?.h24)} 24h vol</span>
        </button>
      `;
    })
    .join("");

  box.querySelectorAll(".pair-result").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPair = payload.pairs[Number(button.dataset.index)];
      renderSearchResults(payload);
    });
  });

  if (!state.selectedPair) {
    state.selectedPair = payload.pairs[0];
    renderSearchResults(payload);
  }
}

function notesPayload() {
  return {
    wallet: $("#walletNotes")?.value || "",
    liquidity: $("#liquidityNotes")?.value || "",
    narrative: $("#narrativeNotes")?.value || "",
    social: $("#socialNotes")?.value || "",
    counter: $("#counterNotes")?.value || "",
    private: $("#privateNotes")?.value || "",
  };
}

function setScore(name, value) {
  $(`#${name}Score`).textContent = value;
  $(`#${name}Bar`).style.width = `${value}%`;
}

function formatDateTime(value) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function verdictTone(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("approved") || text.includes("candidate") || text.includes("pass")) return "pass";
  if (text.includes("reject") || text.includes("risk")) return "risk";
  return "watch";
}

function renderSignalReactor(card, result) {
  const scores = card.scores || {};
  const agents = [
    ["VeilSense", "Signal scan", `Stealth ${scores.stealth}/100`],
    ["Bull Agent", "Upside case", card.alphaTribunal?.bullCase || "Review complete."],
    ["Bear Agent", "Invalidation case", card.alphaTribunal?.bearCase || "Review complete."],
    ["VeilGuard", "Privacy pass", card.veilGuardPrivacyCheck?.privacyRiskLevel || "Low"],
    ["GhostProof", "Final lock", card.finalVerdict || "Watchlist"],
  ];

  $("#reactorHeadline").textContent = `${card.signalName} / ${card.currentStage}`;
  $("#signalPulse").textContent =
    result.reviewEngine === "swarms" ? "SWARM VERIFIED" : "LOCAL PRECHECK";

  [
    ["reactorStealth", scores.stealth],
    ["reactorConviction", scores.conviction],
    ["reactorRisk", scores.risk],
    ["reactorGhostProof", scores.ghostProof],
  ].forEach(([id, value]) => {
    $(`#${id}`).style.width = `${Number(value || 0)}%`;
  });

  $("#agentTrace").innerHTML = agents
    .map(([name, role, output]) => {
      const tone = verdictTone(`${output} ${card.finalVerdict}`);
      return `
        <article class="${tone}">
          <span>${escapeHtml(role)}</span>
          <strong>${escapeHtml(name)}</strong>
          <p>${escapeHtml(String(output)).slice(0, 160)}</p>
        </article>
      `;
    })
    .join("");
}

function renderKeyValue(container, entries) {
  container.innerHTML = entries
    .map(
      ([label, value]) => `
        <div>
          <strong>${escapeHtml(label)}</strong>
          <p>${Array.isArray(value) ? value.map(escapeHtml).join("<br>") : escapeHtml(value)}</p>
        </div>
      `,
    )
    .join("");
}

function firstLine(value) {
  if (Array.isArray(value)) return value[0] || "No evidence found yet.";
  return value || "No evidence found yet.";
}

function renderAiDesk(result) {
  const card = result.alphaCard;
  $("#deskStatus").textContent = result.reviewEngine === "swarms" ? "Swarm filled" : "Filled";
  $("#aiDesk").innerHTML = `
    <article><span>Wallet</span><p>${escapeHtml(firstLine(card.evidenceTrail.wallet))}</p></article>
    <article><span>Liquidity</span><p>${escapeHtml(firstLine(card.evidenceTrail.liquidity))}</p></article>
    <article><span>Social/X</span><p>${escapeHtml(firstLine(card.evidenceTrail.socialMomentum))}</p></article>
    <article><span>Risk</span><p>${escapeHtml(firstLine(card.evidenceTrail.counterSignals))}</p></article>
  `;
}

function premiumGhostBack() {
  const rewardPoolUsd = PREMIUM_FEE_USD * GHOSTBACK_RATE;
  return {
    premiumFeeUsd: PREMIUM_FEE_USD,
    rewardPoolUsd,
    fundedBy: "Premium Signal revenue, not token trading fees",
    splits: { signalScouts: 0.016, alphaValidators: 0.014, cardDistributors: 0.01 },
  };
}

function renderPaymentPanel(message = "") {
  const walletLabel = state.wallet.connected ? shortAddress(state.wallet.address) : "Not connected";
  const status =
    state.paymentStatus === "paid"
      ? "Paid"
      : state.paymentStatus === "pending"
        ? "Awaiting wallet approval"
        : "Not paid";
  $("#paymentPanel").innerHTML = `
    <div class="quality-row"><span>Wallet</span><strong>${escapeHtml(walletLabel)}</strong></div>
    <div class="quality-row"><span>Premium fee</span><strong>${money(PREMIUM_FEE_USD)} USDC</strong></div>
    <div class="quality-row"><span>GhostBack</span><strong>${money(PREMIUM_FEE_USD * GHOSTBACK_RATE)}</strong></div>
    <div class="quality-row"><span>Status</span><strong>${escapeHtml(status)}</strong></div>
    <p>${escapeHtml(message || "Connect a Solana wallet, then approve the Premium Pro unlock. Live USDC settlement can be connected through x402.")}</p>
  `;
}

function renderPremiumButtons() {
  const label = state.premiumUnlocked ? "Premium Ready" : "Pay $0.10 Premium";
  $("#unlockPremium").textContent = label;
  $("#sideUnlockPremium").textContent = state.premiumUnlocked ? "Premium Ready" : "Connect Wallet + Pay $0.10";
  $("#premiumMode").checked = state.premiumUnlocked;
  renderPaymentPanel();
}

function renderAlphaCard(result) {
  const card = result.alphaCard;
  state.latestCard = result;

  $("#emptyState").classList.add("hidden");
  $("#alphaCard").classList.remove("hidden");
  $("#exportCard").disabled = false;

  $("#signalName").textContent = card.signalName;
  $("#marketNarrative").textContent = card.marketNarrative;
  $("#finalVerdict").textContent = card.finalVerdict;
  $("#currentStage").textContent = card.currentStage;
  $("#alphaRating").textContent = card.alphaRating || "--";
  $("#signalRoute").textContent = card.signalRoute || "Input -> DexScreener -> GhostVeil -> Verdict";
  $("#xPostedAt").textContent = card.socialContext?.xPostedAt
    ? formatDateTime(card.socialContext.xPostedAt)
    : card.socialContext?.xStatus === "not_provided"
      ? "No X post provided"
      : "Needs confirmation";
  $("#detectedAt").textContent = formatDateTime(card.detectedAt || result.generatedAt);
  $("#sourceRating").textContent = card.sourceRating || "--";
  $("#whyItMatters").textContent = card.whyItMattersNow;
  $("#nextSteps").textContent = card.suggestedNextSteps;
  $("#shareSummary").textContent = card.shareableSummary;
  $("#disclaimer").textContent = card.disclaimer;

  setScore("stealth", card.scores.stealth);
  setScore("conviction", card.scores.conviction);
  setScore("risk", card.scores.risk);
  setScore("ghostProof", card.scores.ghostProof);
  renderSignalReactor(card, result);

  renderKeyValue($("#evidenceTrail"), [
    ["Wallet Evidence", card.evidenceTrail.wallet],
    ["Liquidity Evidence", card.evidenceTrail.liquidity],
    ["Narrative Evidence", card.evidenceTrail.narrative],
    ["Social Momentum", card.evidenceTrail.socialMomentum],
    ["Counter-Signals", card.evidenceTrail.counterSignals],
  ]);

  renderKeyValue($("#tribunalReview"), [
    ["Bull Case", card.alphaTribunal.bullCase],
    ["Bear Case", card.alphaTribunal.bearCase],
    ["Timing Check", card.alphaTribunal.timingCheck],
    ["Rug / MEV / Liquidity Risks", card.alphaTribunal.riskReview],
    ["Crowding Risk", card.alphaTribunal.crowdingRisk],
    ["Final Judgment", card.alphaTribunal.finalJudgment],
  ]);

  renderKeyValue($("#privacyCheck"), [
    ["Public-safe summary", card.veilGuardPrivacyCheck.publicSafeSummary],
    ["Sensitive details removed", card.veilGuardPrivacyCheck.sensitiveDetailsRemoved],
    ["Privacy risk level", card.veilGuardPrivacyCheck.privacyRiskLevel],
  ]);

  renderKeyValue($("#riskPreview"), [
    ["Best-case path", card.ghostTradeRiskPreview.bestCasePath],
    ["Base-case path", card.ghostTradeRiskPreview.baseCasePath],
    ["Worst-case path", card.ghostTradeRiskPreview.worstCasePath],
    ["Key risk trigger", card.ghostTradeRiskPreview.keyRiskTrigger],
    ["Invalidation point", card.ghostTradeRiskPreview.invalidationPoint],
  ]);

  renderSourceQuality(result);
  renderGhostBack(result.ghostBack);
  renderAiDesk(result);
  renderPremiumButtons();
  addHistory(result);
}

function renderSourceQuality(result) {
  const quality = result.sourceQuality;
  $("#sourceQuality").innerHTML = `
    <div class="quality-row"><span>Data status</span><strong>${escapeHtml(result.dataStatus)}</strong></div>
    <div class="quality-row"><span>Review engine</span><strong>${escapeHtml(result.reviewEngine || "local")}</strong></div>
    <div class="quality-row"><span>Live pair</span><strong>${quality.livePairConnected ? "Connected" : "Not connected"}</strong></div>
    <div class="quality-row"><span>User evidence</span><strong>${quality.userEvidenceProvided ? "Provided" : "Not provided"}</strong></div>
    <div class="quality-row"><span>Swarms API</span><strong>${escapeHtml(result.swarmsReview?.status || "not used")}</strong></div>
    <div class="mini-list">
      <strong>Observed evidence</strong>
      ${quality.directEvidence.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
    </div>
    <div class="mini-list">
      <strong>Assumptions</strong>
      ${(quality.assumptions.length ? quality.assumptions : ["No major assumptions recorded."])
        .map((item) => `<p>${escapeHtml(item)}</p>`)
        .join("")}
    </div>
  `;
}

function renderGhostBack(ghostBack) {
  if (!ghostBack) {
    $("#ghostBackBox").innerHTML = "<p>Enable Premium Pro to show reward economics.</p>";
    return;
  }

  $("#ghostBackBox").innerHTML = `
    <div class="quality-row"><span>Premium fee</span><strong>${money(ghostBack.premiumFeeUsd)}</strong></div>
    <div class="quality-row"><span>Reward pool</span><strong>${money(ghostBack.rewardPoolUsd)}</strong></div>
    <p>${escapeHtml(ghostBack.fundedBy)}.</p>
    <div class="split-list">
      <div><span>Signal Scouts</span><b>${money(ghostBack.splits.signalScouts)}</b></div>
      <div><span>Alpha Validators</span><b>${money(ghostBack.splits.alphaValidators)}</b></div>
      <div><span>Card Distributors</span><b>${money(ghostBack.splits.cardDistributors)}</b></div>
    </div>
  `;
}

function addHistory(result) {
  const entry = {
    at: result.generatedAt,
    signalName: result.alphaCard.signalName,
    verdict: result.alphaCard.finalVerdict,
    stage: result.alphaCard.currentStage,
    scores: result.alphaCard.scores,
  };
  state.history = [entry, ...state.history.filter((item) => item.signalName !== entry.signalName)].slice(0, 8);
  localStorage.setItem("ghostveil-history", JSON.stringify(state.history));
  renderHistory();
}

function renderHistory() {
  if (!state.history.length) {
    $("#historyList").innerHTML = "<p>No cards yet.</p>";
    return;
  }

  $("#historyList").innerHTML = state.history
    .map(
      (item) => `
        <div class="history-item">
          <strong>${escapeHtml(item.signalName)}</strong>
          <span>${escapeHtml(item.verdict)} / ${escapeHtml(item.stage)}</span>
          <small>GP ${item.scores.ghostProof} Risk ${item.scores.risk}</small>
        </div>
      `,
    )
    .join("");
}

function shortAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function renderWallet() {
  const label = state.wallet.connected ? shortAddress(state.wallet.address) : "Not connected";
  $("#connectWallet").textContent = state.wallet.connected ? label : "Connect Wallet";
  $("#resultConnectWallet").textContent = state.wallet.connected ? label : "Connect Wallet";
  $("#walletBox").innerHTML = state.wallet.connected
    ? `
      <div class="quality-row"><span>Status</span><strong>Connected</strong></div>
      <div class="quality-row"><span>Provider</span><strong>${escapeHtml(state.wallet.provider)}</strong></div>
      <div class="quality-row"><span>Address</span><strong>${escapeHtml(label)}</strong></div>
      <p>Wallet is connected locally for marketplace/payment readiness. The full address is not sent to GhostVeil analysis or Swarms prompts.</p>
      <button id="disconnectWallet" type="button" class="quiet-button">Disconnect</button>
    `
    : `
      <div class="quality-row"><span>Status</span><strong>Not connected</strong></div>
      <p>Connect Phantom or another Solana wallet for launch readiness. GhostVeil keeps the connected wallet client-side.</p>
    `;

  const disconnect = $("#disconnectWallet");
  if (disconnect) {
    disconnect.addEventListener("click", async () => {
      try {
        await window.solana?.disconnect?.();
      } catch {}
      state.wallet = { connected: false, address: "", provider: "" };
      state.paymentStatus = "unpaid";
      state.premiumUnlocked = false;
      renderWallet();
      renderPremiumButtons();
    });
  }
  renderPremiumButtons();
}

function openScanOverlay() {
  $("#scanOverlay")?.classList.remove("hidden");
  document.body.classList.add("overlay-open");
  setTimeout(() => $("#queryInput")?.focus(), 120);
}

function closeScanOverlay() {
  $("#scanOverlay")?.classList.add("hidden");
  document.body.classList.remove("overlay-open");
}

async function connectWallet() {
  const provider = window.solana;
  if (!provider?.isPhantom && !provider?.connect) {
    $("#walletBox").innerHTML = `
      <div class="notice">No Solana wallet was detected. Install Phantom, reload the page, then connect.</div>
      <p>Phantom: https://phantom.app</p>
    `;
    return;
  }

  try {
    const response = await provider.connect();
    const publicKey = response?.publicKey || provider.publicKey;
    state.wallet = {
      connected: Boolean(publicKey),
      address: publicKey?.toString?.() || "",
      provider: provider.isPhantom ? "Phantom" : "Solana Wallet",
    };
    renderWallet();
  } catch (error) {
    $("#walletBox").innerHTML = `<div class="notice">Wallet connection cancelled or failed: ${escapeHtml(error.message || "Unknown error")}</div>`;
  }
}

async function unlockPremium() {
  if (!state.wallet.connected) {
    await connectWallet();
    if (!state.wallet.connected) return;
  }
  state.paymentStatus = "pending";
  renderPremiumButtons();
  renderPaymentPanel("Wallet connected. Approving simulated $0.10 USDC Premium unlock...");
  $("#deskStatus").textContent = "Payment pending";

  window.setTimeout(() => {
    state.paymentStatus = "paid";
    state.premiumUnlocked = true;
    $("#premiumMode").checked = true;
    renderPremiumButtons();
    renderGhostBack(state.latestCard?.ghostBack || premiumGhostBack());
    renderPaymentPanel("Premium Pro unlocked. Payment is simulated locally; connect x402/USDC settlement before production.");
    $("#deskStatus").textContent = "Premium unlocked";
  }, 700);
}

async function runSearch() {
  const query = $("#queryInput").value.trim();
  if (!query) {
    $("#searchResults").innerHTML = `<div class="notice">Enter a token, mint, or pair URL first.</div>`;
    return;
  }
  $("#searchResults").innerHTML = `<div class="notice">Fetching Solana market context...</div>`;
  state.selectedPair = null;
  const payload = await api(`/api/search?q=${encodeURIComponent(query)}`);
  renderSearchResults(payload);
}

async function runAnalysis(event) {
  event?.preventDefault();
  setLoading(true);
  try {
    const payload = await api("/api/analyze", {
      method: "POST",
      body: JSON.stringify({
        query: $("#queryInput").value.trim(),
        selectedPair: state.selectedPair,
        reviewEngine: $("#reviewEngine").value,
        sourceMode: $("#sourceMode").value,
        publicMode: $("#cardMode").value === "public",
        premiumMode: $("#premiumMode").checked || state.premiumUnlocked,
        notes: notesPayload(),
      }),
    });
    renderAlphaCard(payload);
  } catch (error) {
    $("#emptyState").classList.remove("hidden");
    $("#emptyState").innerHTML = `
      <p class="eyebrow">Scan Failed</p>
      <h2>GhostVeil could not complete the review.</h2>
      <p>${escapeHtml(error.message)}</p>
    `;
  } finally {
    setLoading(false);
  }
}

function exportLatestCard() {
  if (!state.latestCard) return;
  const blob = new Blob([JSON.stringify(state.latestCard, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.latestCard.alphaCard.signalName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-ghostveil-card.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function checkHealth() {
  try {
    const payload = await api("/api/health");
    const swarmsText = payload.swarms?.configured ? `Swarms ${payload.swarms.mode || "swarm"} connected` : "Swarms key needed";
    $("#healthStatus").textContent = payload.ok ? "SOLANA_MAINNET" : "Connector unavailable";
    $("#healthStatus").title = payload.ok ? `DexScreener ready / ${swarmsText}` : "Connector unavailable";
    const swarmsOption = $("#reviewEngine").querySelector('option[value="swarms"]');
    swarmsOption.textContent = payload.swarms?.configured ? "Swarms multi-agent swarm" : "Swarms swarm (needs key)";
  } catch {
    $("#healthStatus").textContent = "Connector unavailable";
  }
}

$("#searchMarket").addEventListener("click", () => {
  runSearch().catch((error) => {
    $("#searchResults").innerHTML = `<div class="notice">Live connector unavailable: ${escapeHtml(error.message)}. You can still analyze provided data.</div>`;
  });
});

$("#scanForm").addEventListener("submit", runAnalysis);
$("#copyShare").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("#shareSummary").textContent);
  $("#copyShare").textContent = "Copied";
  setTimeout(() => {
    $("#copyShare").textContent = "Copy Share Summary";
  }, 1100);
});
$("#exportCard").addEventListener("click", exportLatestCard);
$("#connectWallet").addEventListener("click", connectWallet);
$("#resultConnectWallet").addEventListener("click", connectWallet);
$("#unlockPremium").addEventListener("click", unlockPremium);
$("#sideUnlockPremium").addEventListener("click", unlockPremium);
$("#heroRunScan")?.addEventListener("click", () => {
  openScanOverlay();
});
$("#closeScan")?.addEventListener("click", closeScanOverlay);
$("#scanOverlay")?.addEventListener("click", (event) => {
  if (event.target === $("#scanOverlay")) closeScanOverlay();
});
document.querySelectorAll(".feed-grid button, .start-scan").forEach((button) => {
  button.addEventListener("click", openScanOverlay);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeScanOverlay();
});
if (window.location.hash === "#scan") {
  openScanOverlay();
}
$("#clearHistory").addEventListener("click", () => {
  state.history = [];
  localStorage.removeItem("ghostveil-history");
  renderHistory();
});

renderHistory();
renderWallet();
checkHealth();
