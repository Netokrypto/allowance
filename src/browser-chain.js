import { setupWalletSelector } from "@near-wallet-selector/core";
import { setupModal } from "@near-wallet-selector/modal-ui";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";

const GAS = "80000000000000";
const OPEN_DEPOSIT = "20000000000000000000000";
const SANDBOX = "sandbox.intents.testnet";
const SANDBOX_AMOUNT = "40000";
const DATA_RECEIVER = "market-data.near";
const DATA_PRICE = "10000";
const ATTACK_RECEIVER = "attacker.near";
const ATTACK_AMOUNT = "1000000000";

const connectButton = document.querySelector("#connect");
const accountNode = document.querySelector("#chain-account");
const actionsNode = document.querySelector("#chain-actions");
const outNode = document.querySelector("#chain-out");

const info = await fetch("/api/chain").then((response) => response.json());
let accountId = "";
let selector;
let modal;

function say(text) {
  outNode.textContent = text;
}

function button(label, tone, onClick) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = `action ${tone}`;
  node.textContent = label;
  node.addEventListener("click", onClick);
  return node;
}

function explorerLink(hash) {
  return hash ? `${info.explorer}/txns/${hash}` : "";
}

async function viewDesk() {
  if (!accountId) return null;
  const body = {
    jsonrpc: "2.0",
    id: "allowance",
    method: "query",
    params: {
      request_type: "call_function",
      finality: "final",
      account_id: info.contractId,
      method_name: "get_desk",
      args_base64: btoa(JSON.stringify({ owner: accountId })),
    },
  };
  const response = await fetch("https://rpc.testnet.near.org", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (json.result?.error || json.error) return null;
  const bytes = json.result?.result;
  if (!bytes) return null;
  const text = new TextDecoder().decode(Uint8Array.from(bytes));
  return text && text !== "null" ? JSON.parse(text) : null;
}

async function sign(methodName, args, deposit = "0") {
  const wallet = await selector.wallet();
  const result = await wallet.signAndSendTransaction({
    signerId: accountId,
    receiverId: info.contractId,
    actions: [{
      type: "FunctionCall",
      params: { methodName, args, gas: GAS, deposit },
    }],
  });
  const hash = result?.transaction?.hash || result?.transaction_outcome?.id || "";
  return hash;
}

async function agent(kind, receiver, amount) {
  say("The function-call key is sending the transaction…");
  const response = await fetch("/api/chain-act", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ owner: accountId, kind, receiver, amount }),
  });
  const body = await response.json();
  const link = body.explorerUrl || explorerLink(body.hash);
  const desk = await viewDesk();
  const treasury = desk ? ` Treasury ${desk.treasury}.` : "";
  say(`${body.ok ? "ALLOW" : "BLOCK"} ${body.reason}.${treasury}${link ? ` ${link}` : ""}`);
}

function paintActions() {
  if (!accountId) {
    actionsNode.replaceChildren();
    return;
  }
  actionsNode.replaceChildren(
    button("Open my on-chain desk", "pin", async () => {
      say("Approve 0.02 testnet NEAR for storage in your wallet.");
      const hash = await sign("open_desk", {}, OPEN_DEPOSIT);
      say(`Desk opened. ${explorerLink(hash)}`);
    }),
    button("Pin the sandbox settlement", "pin", async () => {
      const hash = await sign("record_quote", {
        deposit_address: SANDBOX,
        amount: SANDBOX_AMOUNT,
        expires_at: String(Date.now() + 10 * 60 * 1000),
      });
      say(`Pinned ${SANDBOX}. ${explorerLink(hash)}`);
    }),
    button("Agent pays for the scan", "go", () => agent("pay", DATA_RECEIVER, DATA_PRICE)),
    button("Agent fills that pin", "fill", () => agent("settle", SANDBOX, SANDBOX_AMOUNT)),
    button("Injection: pay attacker.near", "danger", () => agent("pay", ATTACK_RECEIVER, ATTACK_AMOUNT)),
  );
}

function showAccount(next) {
  accountId = next || "";
  connectButton.textContent = accountId || "Connect NEAR wallet";
  accountNode.textContent = accountId
    ? `${accountId} on testnet. Contract ${info.contractId}. Faucet: ${info.faucet}`
    : `Connect a testnet wallet. Contract ${info.contractId}. Faucet: ${info.faucet}`;
  paintActions();
  if (accountId) {
    viewDesk().then((desk) => {
      say(desk
        ? `On-chain treasury ${desk.treasury}. Pinned ${desk.quote_receiver || "none"}.`
        : "No on-chain desk yet. Open one with your wallet.");
    }).catch(() => say("Could not read the contract yet."));
  }
}

selector = await setupWalletSelector({
  network: "testnet",
  modules: [
    setupMyNearWallet(),
    setupMeteorWallet(),
  ],
});
modal = setupModal(selector, { contractId: info.contractId });
const state = selector.store.getState();
const current = state.accounts.find((item) => item.active) || state.accounts[0];
showAccount(current?.accountId || "");

selector.on("signedIn", ({ accounts }) => {
  showAccount(accounts[0]?.accountId || "");
});
selector.on("signedOut", () => showAccount(""));

connectButton.addEventListener("click", async () => {
  if (accountId) {
    const wallet = await selector.wallet();
    await wallet.signOut();
    showAccount("");
    return;
  }
  modal.show();
});
