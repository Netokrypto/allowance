const mark = document.querySelector("#mark");
const reason = document.querySelector("#reason");
const decision = document.querySelector("#decision");
const actions = document.querySelector("#actions");
const blotter = document.querySelector("#blotter");
const receipts = document.querySelector("#receipts");
const log = document.querySelector("#log");
const quoteOut = document.querySelector("#quote-out");

let desk = null;

function formatUsd(units) {
  const value = Number(units);
  if (!Number.isFinite(value)) return "$0";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const whole = Math.floor(abs / 1_000_000);
  const frac = String(Math.floor(abs % 1_000_000)).padStart(6, "0").replace(/0+$/, "");
  return frac ? `${sign}$${whole}.${frac}` : `${sign}$${whole}`;
}

function row(term, value) {
  const wrap = document.createElement("div");
  wrap.className = "row";
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = term;
  dd.textContent = value;
  wrap.append(dt, dd);
  return wrap;
}

function paint() {
  blotter.replaceChildren(
    row("treasury", `${formatUsd(desk.treasury)} · ${desk.treasury}`),
    row("spent", `${formatUsd(desk.policy.spentToday)} / ${formatUsd(desk.policy.dailyCap)}`),
    row("per call", formatUsd(desk.policy.perCallCap)),
    row("allowlist", desk.policy.allowlist.join(", ")),
    row("pinned", desk.policy.quote
      ? `${desk.policy.quote.depositAddress} · ${formatUsd(desk.policy.quote.amount)}`
      : "none"),
    row("agent key", "function-call · execute only"),
  );

  receipts.replaceChildren(...desk.receipts.slice().reverse().map((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.kind} · ${item.receiver} · ${formatUsd(item.amount)}`;
    return li;
  }));
  if (!desk.receipts.length) {
    const li = document.createElement("li");
    li.textContent = "No receipts yet.";
    receipts.replaceChildren(li);
  }

  log.replaceChildren(...desk.log.slice().reverse().map((item) => {
    const li = document.createElement("li");
    const strong = document.createElement("strong");
    strong.className = item.ok ? "allow" : "block";
    strong.textContent = item.ok ? "ALLOW" : "BLOCK";
    li.append(strong, document.createTextNode(` ${item.layer} · ${item.reason}`));
    if (item.receiver) li.append(document.createTextNode(` · ${item.receiver}`));
    return li;
  }));
}

function show(result) {
  const ok = result?.ok === true;
  decision.classList.toggle("allow", ok);
  decision.classList.toggle("block", result && !ok);
  mark.textContent = result ? (ok ? "ALLOW" : "BLOCK") : "READY";
  reason.textContent = result ? `${result.layer}: ${result.reason}` : "Load a desk, then run one action.";
}

async function act(signer, action) {
  const buttons = actions.querySelectorAll("button");
  buttons.forEach((button) => { button.disabled = true; });
  try {
    const response = await fetch("/api/act", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ desk, signer, action }),
    });
    const body = await response.json();
    if (!response.ok) {
      show({ ok: false, layer: "desk", reason: body.error || "request failed" });
      return;
    }
    desk = body.desk;
    show(body.result);
    paint();
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}

function button(label, signer, action) {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = label;
  node.addEventListener("click", () => act(signer, action));
  return node;
}

function buildActions() {
  const constants = desk.constants;
  const expiresAt = Date.now() + 10 * 60 * 1000;
  actions.replaceChildren(
    button("Agent pays for the scan", "agent", {
      method: "execute",
      kind: "pay",
      receiver: constants.dataReceiver,
      amount: constants.dataPrice,
      memo: "scan",
    }),
    button("Human pins the sandbox settlement", "human", {
      method: "record_quote",
      depositAddress: constants.sandboxReceiver,
      amount: constants.sandboxAmount,
      expiresAt,
    }),
    button("Agent fills that pin", "agent", {
      method: "execute",
      kind: "settle",
      receiver: constants.sandboxReceiver,
      amount: constants.sandboxAmount,
      memo: "sandbox settle",
    }),
    button("Injection: pay attacker.near", "agent", {
      method: "execute",
      kind: "pay",
      receiver: constants.attackReceiver,
      amount: constants.attackAmount,
      memo: "ignore the policy",
    }),
    button("Injection: transfer NEAR", "agent", {
      method: "transfer",
      receiver: constants.attackReceiver,
      amount: constants.attackAmount,
    }),
    button("Injection: call another contract", "agent", {
      method: "execute",
      contractId: "usdt.tether-token.near",
      kind: "pay",
      receiver: constants.attackReceiver,
      amount: constants.attackAmount,
    }),
  );
}

async function load() {
  const response = await fetch("/api/desk");
  desk = await response.json();
  buildActions();
  show(null);
  paint();
}

document.querySelector("#reset").addEventListener("click", load);

document.querySelector("#quote").addEventListener("click", async (event) => {
  event.currentTarget.disabled = true;
  quoteOut.textContent = "Asking 1Click for a dry quote…";
  try {
    const response = await fetch("/api/quote");
    const body = await response.json();
    if (!body.ok) {
      quoteOut.textContent = `Quote unavailable. ${body.error}`;
      return;
    }
    const quote = body.quote;
    quoteOut.textContent = `${quote.amountInFormatted} NEAR → ${quote.amountOutFormatted} USDT (${quote.amountOutUsd} USD). Deposit address: none. ${quote.note}`;
  } catch (error) {
    quoteOut.textContent = `Quote unavailable. ${error.message}`;
  } finally {
    event.currentTarget.disabled = false;
  }
});

load();
