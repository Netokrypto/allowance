import { utcDay } from "./money.js";

export const REASONS = [
  "allowed",
  "paused",
  "not_agent",
  "not_owner",
  "receiver_not_allowlisted",
  "amount_not_positive",
  "over_per_call_cap",
  "over_daily_cap",
  "quote_mismatch",
  "quote_expired",
  "quote_missing",
  "bad_kind",
  "bad_receiver",
  "insufficient_treasury",
  "unknown_method",
];

export function parseAmount(value) {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "string" && /^[0-9]+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return null;
}

export function cleanReceiver(value) {
  if (typeof value !== "string") return "";
  const receiver = value.trim().toLowerCase();
  if (receiver.length < 2 || receiver.length > 64) return "";
  if (!/^[a-z0-9._-]+$/.test(receiver)) return "";
  return receiver;
}

function actorId(policy, signer) {
  if (signer === "human") return policy.owner;
  if (signer === "agent") return policy.agent;
  return "";
}

function rollDay(policy, now) {
  const day = utcDay(now);
  if (policy.day !== day) {
    policy.day = day;
    policy.spentToday = 0;
  }
}

function receipt(desk, signer, action, amount, receiver) {
  return {
    id: desk.receipts.length + 1,
    signer,
    kind: action.kind || action.method,
    receiver,
    amount,
    memo: typeof action.memo === "string" ? action.memo.slice(0, 140) : "",
  };
}

export function applyPolicy(desk, signer, action, now) {
  const policy = desk.policy;
  const actor = actorId(policy, signer);
  rollDay(policy, now);

  if (action.method === "pause") {
    if (actor !== policy.owner) return { ok: false, reason: "not_owner" };
    policy.paused = Boolean(action.paused);
    return { ok: true, reason: "allowed" };
  }

  if (action.method === "allow") {
    if (actor !== policy.owner) return { ok: false, reason: "not_owner" };
    const receiver = cleanReceiver(action.receiver);
    if (!receiver) return { ok: false, reason: "bad_receiver" };
    if (!policy.allowlist.includes(receiver)) policy.allowlist.push(receiver);
    return { ok: true, reason: "allowed" };
  }

  if (action.method === "record_quote") {
    if (actor !== policy.owner) return { ok: false, reason: "not_owner" };
    const receiver = cleanReceiver(action.depositAddress || action.receiver);
    const amount = parseAmount(action.amount);
    const expiresAt = Number(action.expiresAt);
    if (!receiver) return { ok: false, reason: "bad_receiver" };
    if (amount == null || amount <= 0) return { ok: false, reason: "amount_not_positive" };
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return { ok: false, reason: "quote_expired" };
    policy.quote = { depositAddress: receiver, amount, expiresAt };
    return { ok: true, reason: "allowed" };
  }

  if (action.method === "withdraw") {
    if (actor !== policy.owner) return { ok: false, reason: "not_owner" };
    const amount = parseAmount(action.amount);
    const receiver = cleanReceiver(action.receiver);
    if (!receiver) return { ok: false, reason: "bad_receiver" };
    if (amount == null || amount <= 0) return { ok: false, reason: "amount_not_positive" };
    if (amount > desk.treasury) return { ok: false, reason: "insufficient_treasury" };
    desk.treasury -= amount;
    return { ok: true, reason: "allowed", receipt: receipt(desk, signer, action, amount, receiver) };
  }

  if (action.method !== "execute") return { ok: false, reason: "unknown_method" };
  if (policy.paused) return { ok: false, reason: "paused" };
  if (actor !== policy.agent) return { ok: false, reason: "not_agent" };
  if (action.kind !== "pay" && action.kind !== "settle") return { ok: false, reason: "bad_kind" };

  const amount = parseAmount(action.amount);
  const receiver = cleanReceiver(action.receiver);
  if (amount == null || amount <= 0) return { ok: false, reason: "amount_not_positive" };
  if (!receiver) return { ok: false, reason: "bad_receiver" };

  if (action.kind === "pay") {
    if (!policy.allowlist.includes(receiver)) return { ok: false, reason: "receiver_not_allowlisted" };
  } else {
    if (!policy.quote) return { ok: false, reason: "quote_missing" };
    if (policy.quote.expiresAt <= now) return { ok: false, reason: "quote_expired" };
    if (receiver !== policy.quote.depositAddress || amount !== policy.quote.amount) {
      return { ok: false, reason: "quote_mismatch" };
    }
  }

  if (amount > policy.perCallCap) return { ok: false, reason: "over_per_call_cap" };
  if (policy.spentToday + amount > policy.dailyCap) return { ok: false, reason: "over_daily_cap" };
  if (amount > desk.treasury) return { ok: false, reason: "insufficient_treasury" };

  policy.spentToday += amount;
  desk.treasury -= amount;
  if (action.kind === "settle") policy.quote = null;
  return { ok: true, reason: "allowed", receipt: receipt(desk, signer, action, amount, receiver) };
}
