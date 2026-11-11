import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ATTACK_AMOUNT,
  ATTACK_RECEIVER,
  DATA_PRICE,
  DATA_RECEIVER,
  SANDBOX_AMOUNT,
  SANDBOX_RECEIVER,
  createDesk,
  submit,
  assertAgentKey,
} from "../src/chain.js";
import { handleAct } from "../src/http.js";
import { REASONS } from "../src/policy.js";

const NOW = Date.parse("2026-11-08T12:00:00.000Z");

function run(desk, signer, action, now = NOW) {
  return submit(desk, signer, action, now);
}

test("agent pays the allowlisted data vendor inside the cap", () => {
  const outcome = run(createDesk(NOW), "agent", {
    method: "execute",
    kind: "pay",
    receiver: DATA_RECEIVER,
    amount: DATA_PRICE,
  });
  assert.equal(outcome.result.ok, true);
  assert.equal(outcome.result.reason, "allowed");
  assert.equal(outcome.desk.treasury, 990_000);
  assert.equal(outcome.desk.policy.spentToday, DATA_PRICE);
  assert.equal(outcome.desk.receipts.length, 1);
});

test("a pay does not change the desk it was given", () => {
  const desk = createDesk(NOW);
  run(desk, "agent", { method: "execute", kind: "pay", receiver: DATA_RECEIVER, amount: DATA_PRICE });
  assert.equal(desk.treasury, 1_000_000);
  assert.equal(desk.policy.spentToday, 0);
});

test("attacker is refused and the treasury stays put", () => {
  const outcome = run(createDesk(NOW), "agent", {
    method: "execute",
    kind: "pay",
    receiver: ATTACK_RECEIVER,
    amount: ATTACK_AMOUNT,
  });
  assert.equal(outcome.result.ok, false);
  assert.equal(outcome.result.layer, "policy");
  assert.equal(outcome.result.reason, "receiver_not_allowlisted");
  assert.equal(outcome.desk.treasury, 1_000_000);
  assert.equal(outcome.desk.receipts.length, 0);
});

test("an allowlisted receiver still cannot break the per-call cap", () => {
  const outcome = run(createDesk(NOW), "agent", {
    method: "execute",
    kind: "pay",
    receiver: DATA_RECEIVER,
    amount: 50_001,
  });
  assert.equal(outcome.result.reason, "over_per_call_cap");
});

test("daily cap blocks the next payment after the book is used", () => {
  let desk = createDesk(NOW);
  desk = run(desk, "agent", { method: "execute", kind: "pay", receiver: DATA_RECEIVER, amount: 50_000 }).desk;
  desk = run(desk, "agent", { method: "execute", kind: "pay", receiver: DATA_RECEIVER, amount: 50_000 }).desk;
  const blocked = run(desk, "agent", { method: "execute", kind: "pay", receiver: DATA_RECEIVER, amount: 1 });
  assert.equal(blocked.result.reason, "over_daily_cap");
  assert.equal(blocked.desk.policy.spentToday, 100_000);
});

test("a new UTC day clears today's spend", () => {
  let desk = createDesk(NOW);
  desk = run(desk, "agent", { method: "execute", kind: "pay", receiver: DATA_RECEIVER, amount: 50_000 }).desk;
  const nextDay = run(desk, "agent", {
    method: "execute",
    kind: "pay",
    receiver: DATA_RECEIVER,
    amount: 50_000,
  }, Date.parse("2026-11-09T00:00:00.000Z"));
  assert.equal(nextDay.result.ok, true);
  assert.equal(nextDay.desk.policy.spentToday, 50_000);
  assert.equal(nextDay.desk.policy.day, "2026-11-09");
});

test("settle fails until the human pins an exact quote", () => {
  const missing = run(createDesk(NOW), "agent", {
    method: "execute",
    kind: "settle",
    receiver: SANDBOX_RECEIVER,
    amount: SANDBOX_AMOUNT,
  });
  assert.equal(missing.result.reason, "quote_missing");
});

test("agent fills the pinned quote once, then the pin is gone", () => {
  let desk = createDesk(NOW);
  desk = run(desk, "human", {
    method: "record_quote",
    depositAddress: SANDBOX_RECEIVER,
    amount: SANDBOX_AMOUNT,
    expiresAt: NOW + 60_000,
  }).desk;
  const filled = run(desk, "agent", {
    method: "execute",
    kind: "settle",
    receiver: SANDBOX_RECEIVER,
    amount: SANDBOX_AMOUNT,
  });
  assert.equal(filled.result.ok, true);
  assert.equal(filled.desk.policy.quote, null);
  assert.equal(filled.desk.treasury, 960_000);
  const again = run(filled.desk, "agent", {
    method: "execute",
    kind: "settle",
    receiver: SANDBOX_RECEIVER,
    amount: SANDBOX_AMOUNT,
  });
  assert.equal(again.result.reason, "quote_missing");
});

test("a pinned quote rejects a different receiver, amount, or a late fill", () => {
  let desk = createDesk(NOW);
  desk = run(desk, "human", {
    method: "record_quote",
    depositAddress: SANDBOX_RECEIVER,
    amount: SANDBOX_AMOUNT,
    expiresAt: NOW + 60_000,
  }).desk;
  assert.equal(run(desk, "agent", {
    method: "execute",
    kind: "settle",
    receiver: ATTACK_RECEIVER,
    amount: SANDBOX_AMOUNT,
  }).result.reason, "quote_mismatch");
  assert.equal(run(desk, "agent", {
    method: "execute",
    kind: "settle",
    receiver: SANDBOX_RECEIVER,
    amount: SANDBOX_AMOUNT - 1,
  }).result.reason, "quote_mismatch");

  const expiredDesk = run(createDesk(NOW), "human", {
    method: "record_quote",
    depositAddress: SANDBOX_RECEIVER,
    amount: SANDBOX_AMOUNT,
    expiresAt: NOW + 1,
  }).desk;
  assert.equal(run(expiredDesk, "agent", {
    method: "execute",
    kind: "settle",
    receiver: SANDBOX_RECEIVER,
    amount: SANDBOX_AMOUNT,
  }, NOW + 1).result.reason, "quote_expired");
});

test("the agent key cannot transfer, withdraw, pause, or call another contract", () => {
  const desk = createDesk(NOW);
  const transfer = run(desk, "agent", { method: "transfer", receiver: ATTACK_RECEIVER, amount: 5 });
  const withdraw = run(desk, "agent", { method: "withdraw", receiver: ATTACK_RECEIVER, amount: 5 });
  const pause = run(desk, "agent", { method: "pause", paused: true });
  const other = run(desk, "agent", {
    method: "execute",
    contractId: "usdt.tether-token.near",
    kind: "pay",
    receiver: DATA_RECEIVER,
    amount: DATA_PRICE,
  });
  const deposit = run(desk, "agent", {
    method: "execute",
    deposit: "1",
    kind: "pay",
    receiver: DATA_RECEIVER,
    amount: DATA_PRICE,
  });
  assert.equal(transfer.result.reason, "function_call_key_cannot_transfer");
  assert.equal(withdraw.result.reason, "function_call_key_method_not_allowed");
  assert.equal(pause.result.reason, "function_call_key_method_not_allowed");
  assert.equal(other.result.reason, "function_call_key_wrong_contract");
  assert.equal(deposit.result.reason, "function_call_key_cannot_attach_deposit");
  assert.equal(transfer.desk.treasury, 1_000_000);
});

test("pause stops the agent and still lets the human withdraw", () => {
  let desk = createDesk(NOW);
  desk = run(desk, "human", { method: "pause", paused: true }).desk;
  const blocked = run(desk, "agent", {
    method: "execute",
    kind: "pay",
    receiver: DATA_RECEIVER,
    amount: DATA_PRICE,
  });
  assert.equal(blocked.result.reason, "paused");
  const withdrawn = run(desk, "human", {
    method: "withdraw",
    receiver: "human.testnet",
    amount: 25_000,
  });
  assert.equal(withdrawn.result.ok, true);
  assert.equal(withdrawn.desk.treasury, 975_000);
  assert.equal(withdrawn.desk.policy.spentToday, 0);
});

test("the agent cannot pin a quote or widen the allowlist", () => {
  const desk = createDesk(NOW);
  assert.equal(run(desk, "agent", {
    method: "record_quote",
    depositAddress: ATTACK_RECEIVER,
    amount: 1,
    expiresAt: NOW + 1000,
  }).result.reason, "function_call_key_method_not_allowed");
  assert.equal(run(desk, "agent", { method: "allow", receiver: ATTACK_RECEIVER }).result.layer, "key");
});

test("the agent process refuses to boot with a full-access key", () => {
  assert.throws(() => assertAgentKey({ permission: { type: "fullAccess" } }), /full-access/);
  assert.doesNotThrow(() => assertAgentKey(createDesk(NOW).keys.agent));
});

test("the http handler rejects a desk whose agent key was widened", () => {
  const desk = createDesk(NOW);
  desk.keys.agent.permission.type = "fullAccess";
  const outcome = handleAct({
    desk,
    signer: "agent",
    action: { method: "transfer", receiver: ATTACK_RECEIVER, amount: 1 },
  }, NOW);
  assert.equal(outcome.status, 400);
  assert.match(outcome.body.error, /full-access|widened/);
});

test("the contract source names every policy reason", async () => {
  const source = await readFile(new URL("../contract/allowance.js", import.meta.url), "utf8");
  const rust = await readFile(new URL("../contract-rs/src/lib.rs", import.meta.url), "utf8");
  for (const reason of REASONS) {
    assert.equal(source.includes(reason), true, reason);
    assert.equal(rust.includes(reason), true, reason);
  }
});
