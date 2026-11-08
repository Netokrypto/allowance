import { createDesk, DATA_PRICE, DATA_RECEIVER, SANDBOX_AMOUNT, SANDBOX_RECEIVER, submit } from "./chain.js";
import { requestDryQuote } from "./intents.js";
import { formatUsd } from "./money.js";

const now = Date.now();
let desk = createDesk(now);

function step(label, signer, action, at = now) {
  const outcome = submit(desk, signer, action, at);
  desk = outcome.desk;
  const result = outcome.result;
  const mark = result.ok ? "ALLOW" : "BLOCK";
  console.log(`${mark}  ${label}`);
  console.log(`      ${result.layer}: ${result.reason}`);
  console.log(`      treasury ${formatUsd(desk.treasury)} · spent today ${formatUsd(desk.policy.spentToday)}`);
  return result;
}

const paid = step("agent pays market-data.near for one scan", "agent", {
  method: "execute",
  kind: "pay",
  receiver: DATA_RECEIVER,
  amount: DATA_PRICE,
  memo: "scan",
});

const unpinned = step("agent tries to settle before the human pins a quote", "agent", {
  method: "execute",
  kind: "settle",
  receiver: SANDBOX_RECEIVER,
  amount: SANDBOX_AMOUNT,
});

const expiresAt = now + 10 * 60 * 1000;
const pinned = step("human pins the sandbox settlement", "human", {
  method: "record_quote",
  depositAddress: SANDBOX_RECEIVER,
  amount: SANDBOX_AMOUNT,
  expiresAt,
});

const settled = step("agent fills the pinned settlement", "agent", {
  method: "execute",
  kind: "settle",
  receiver: SANDBOX_RECEIVER,
  amount: SANDBOX_AMOUNT,
  memo: "sandbox settle",
});

console.log("");
try {
  const quote = await requestDryQuote({ now, signal: AbortSignal.timeout(12_000) });
  console.log("LIVE dry quote  wNEAR -> USDT");
  console.log(`      in ${quote.amountInFormatted} NEAR · out ${quote.amountOutFormatted} USDT · usd ${quote.amountOutUsd}`);
  console.log(`      deposit address: none · ${quote.note}`);
} catch (error) {
  console.log(`QUOTE UNAVAILABLE  ${error.message}`);
  console.log("      The policy steps above do not depend on this quote.");
}

const ok = paid.ok && !unpinned.ok && pinned.ok && settled.ok && desk.policy.quote == null;
if (!ok) {
  console.error("demo failed");
  process.exit(1);
}
