import { connect, KeyPair, keyStores } from "near-api-js";

const NETWORK = "testnet";
const RPC = "https://rpc.testnet.near.org";
const REASONS = [
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
  "need_storage",
  "desk_exists",
];

export function chainInfo() {
  return {
    network: NETWORK,
    contractId: process.env.CONTRACT_ID || "netokrypto-allowance.testnet",
    agentConfigured: Boolean(process.env.AGENT_PRIVATE_KEY),
    explorer: "https://testnet.nearblocks.io",
    faucet: "https://near-faucet.io",
  };
}

function reasonFrom(error) {
  const text = `${error?.message || ""} ${JSON.stringify(error?.kind || "")}`;
  return REASONS.find((reason) => text.includes(reason)) || "chain_error";
}

function hashFrom(value) {
  const direct = value?.transaction?.hash
    || value?.transaction_outcome?.id
    || value?.transactionHash
    || "";
  if (direct) return direct;
  const match = `${value?.message || ""}`.match(/Transaction ([1-9A-HJ-NP-Za-km-z]+) failed/);
  return match ? match[1] : "";
}

export async function agentExecute({ owner, kind, receiver, amount }) {
  const info = chainInfo();
  const secret = process.env.AGENT_PRIVATE_KEY || "";
  if (!secret) {
    return { ok: false, reason: "agent_key_missing", hash: "", explorerUrl: "" };
  }
  if (!owner || !kind || !receiver || amount == null) {
    return { ok: false, reason: "bad_request", hash: "", explorerUrl: "" };
  }
  const keyStore = new keyStores.InMemoryKeyStore();
  await keyStore.setKey(NETWORK, info.contractId, KeyPair.fromString(secret));
  const near = await connect({
    networkId: NETWORK,
    nodeUrl: RPC,
    deps: { keyStore },
  });
  const account = await near.account(info.contractId);
  const args = { owner, kind, receiver, amount: String(amount) };
  try {
    const result = await account.functionCall({
      contractId: info.contractId,
      methodName: "execute",
      args,
      gas: 80_000_000_000_000n,
      attachedDeposit: 0n,
    });
    const hash = hashFrom(result);
    return {
      ok: true,
      reason: "allowed",
      hash,
      explorerUrl: hash ? `${info.explorer}/txns/${hash}` : "",
    };
  } catch (error) {
    const hash = hashFrom(error);
    return {
      ok: false,
      reason: reasonFrom(error),
      hash,
      explorerUrl: hash ? `${info.explorer}/txns/${hash}` : "",
    };
  }
}
