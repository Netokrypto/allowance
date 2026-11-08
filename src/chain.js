import { applyPolicy } from "./policy.js";
import { utcDay } from "./money.js";

export const CONTRACT_ID = "allowance.testnet";
export const DATA_RECEIVER = "market-data.near";
export const DATA_PRICE = 10_000;
export const SANDBOX_RECEIVER = "sandbox.intents.testnet";
export const SANDBOX_AMOUNT = 40_000;
export const ATTACK_RECEIVER = "attacker.near";
export const ATTACK_AMOUNT = 1_000_000_000;

export function createDesk(now = Date.now()) {
  return {
    contractId: CONTRACT_ID,
    treasury: 1_000_000,
    policy: {
      owner: "human.testnet",
      agent: "agent.testnet",
      perCallCap: 50_000,
      dailyCap: 100_000,
      spentToday: 0,
      day: utcDay(now),
      paused: false,
      allowlist: [DATA_RECEIVER],
      quote: null,
    },
    keys: {
      human: { permission: { type: "fullAccess" } },
      agent: {
        permission: {
          type: "functionCall",
          receiverId: CONTRACT_ID,
          methodNames: ["execute"],
          allowanceYocto: "250000000000000000000000",
        },
      },
    },
    constants: {
      dataReceiver: DATA_RECEIVER,
      dataPrice: DATA_PRICE,
      sandboxReceiver: SANDBOX_RECEIVER,
      sandboxAmount: SANDBOX_AMOUNT,
      attackReceiver: ATTACK_RECEIVER,
      attackAmount: ATTACK_AMOUNT,
    },
    receipts: [],
    log: [],
  };
}

export function assertAgentKey(key) {
  const permission = key?.permission;
  if (permission?.type !== "functionCall") {
    throw new Error("agent process refuses a full-access key");
  }
  if (permission.receiverId !== CONTRACT_ID) {
    throw new Error("agent key must target the allowance contract");
  }
  const methods = permission.methodNames || [];
  if (methods.length !== 1 || methods[0] !== "execute") {
    throw new Error("agent key may call execute only");
  }
}

export function assertDemoDesk(desk) {
  if (!desk || typeof desk !== "object") throw new Error("desk is required");
  if (desk.contractId !== CONTRACT_ID) throw new Error("demo_refuses_widened_key");
  assertAgentKey(desk.keys?.agent);
  if (desk.keys?.human?.permission?.type !== "fullAccess") {
    throw new Error("human key must stay a full-access key");
  }
}

function checkKey(desk, signer, action) {
  const key = desk.keys?.[signer];
  if (!key) return { ok: false, reason: "unknown_signer" };
  const permission = key.permission;
  if (!permission) return { ok: false, reason: "unsupported_key" };

  if (permission.type === "fullAccess") return { ok: true, reason: "allowed" };
  if (permission.type !== "functionCall") return { ok: false, reason: "unsupported_key" };

  if (action.deposit != null && action.deposit !== "0" && action.deposit !== 0) {
    return { ok: false, reason: "function_call_key_cannot_attach_deposit" };
  }

  const contractId = action.contractId || desk.contractId;
  if (contractId !== permission.receiverId) {
    return { ok: false, reason: "function_call_key_wrong_contract" };
  }
  if (action.method === "transfer") {
    return { ok: false, reason: "function_call_key_cannot_transfer" };
  }
  if (!Array.isArray(permission.methodNames) || !permission.methodNames.includes(action.method)) {
    return { ok: false, reason: "function_call_key_method_not_allowed" };
  }
  return { ok: true, reason: "allowed" };
}

export function submit(desk, signer, action, now = Date.now()) {
  const next = structuredClone(desk);
  const entry = {
    at: new Date(now).toISOString(),
    signer,
    method: action?.method || "",
    kind: action?.kind || "",
    receiver: action?.receiver || action?.depositAddress || "",
    amount: action?.amount ?? "",
    ok: false,
    layer: "key",
    reason: "unknown_method",
  };

  const keyResult = checkKey(next, signer, action || {});
  if (!keyResult.ok) {
    entry.reason = keyResult.reason;
    next.log.push(entry);
    next.log = next.log.slice(-30);
    return { desk: next, result: entry };
  }

  const policyResult = applyPolicy(next, signer, action, now);
  entry.layer = "policy";
  entry.ok = policyResult.ok;
  entry.reason = policyResult.reason;
  if (policyResult.receipt) {
    policyResult.receipt.at = entry.at;
    next.receipts.push(policyResult.receipt);
    next.receipts = next.receipts.slice(-30);
    entry.receiptId = policyResult.receipt.id;
  }
  next.log.push(entry);
  next.log = next.log.slice(-30);
  return { desk: next, result: entry };
}
