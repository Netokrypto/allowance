const QUOTE_URL = "https://1click.chaindefuser.com/v0/quote";

export function buildDryQuoteBody(options = {}) {
  const now = options.now ?? Date.now();
  const amount = options.amount || "100000000000000000000000";
  const account = options.recipient || "allowance-demo.near";
  return {
    dry: true,
    swapType: "EXACT_INPUT",
    slippageTolerance: 100,
    originAsset: "nep141:wrap.near",
    depositType: "INTENTS",
    destinationAsset: "nep141:usdt.tether-token.near",
    amount: String(amount),
    recipient: options.recipient || account,
    recipientType: "INTENTS",
    refundTo: options.refundTo || account,
    refundType: "INTENTS",
    deadline: new Date(now + 3 * 60 * 1000).toISOString(),
  };
}

export function readQuote(payload) {
  const quote = payload?.quote;
  if (!quote) throw new Error("quote response had no quote");
  return {
    live: true,
    dry: true,
    amountInFormatted: quote.amountInFormatted || "",
    amountOutFormatted: quote.amountOutFormatted || "",
    amountOutUsd: quote.amountOutUsd || "",
    minAmountOut: quote.minAmountOut || "",
    depositAddress: null,
    note: "Dry quote. 1Click omits the deposit address, so this cannot be settled.",
  };
}

export async function requestDryQuote(options = {}) {
  const body = buildDryQuoteBody(options);
  if (body.dry !== true) throw new Error("refusing a live swap");

  const headers = { "Content-Type": "application/json" };
  if (options.apiKey) headers["X-API-Key"] = options.apiKey;

  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(QUOTE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  });
  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.message || `quote HTTP ${response.status}`;
    throw new Error(message);
  }
  return readQuote(payload);
}
