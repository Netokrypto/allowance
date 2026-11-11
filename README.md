# Allowance

A trading desk whose agent can pay for market data and fill one settlement a human pinned. The key in the agent process is a NEAR function-call key for a single contract method. It cannot transfer NEAR, call another contract, withdraw, or pay an address that is not on the list.

This is a NEAR Hackathon prototype for the `security`, `agents`, and `defi` tracks. The executable rules are in `src/policy.js` and `src/chain.js`. `contract/allowance.js` is the same policy written as a near-sdk-js contract. It is not compiled here.

The browser keeps the desk state so a judge can click through it with no account. A client can edit that state. On NEAR, the protocol checks the key and the contract checks the caller. The tests cover both layers. No key in this demo can move mainnet funds. Quotes are always `dry: true`.

## Try it

Do this, and you should see that.

1. `npm test`
   See every check pass, including the attacker payment, the NEAR transfer, and the dry-quote body.

2. `npm run attack`
   See four lines that start with `STOPPED`. The last line is `treasury unchanged`. The process exits 0 only when the treasury is unchanged.

3. `npm run demo`
   See `ALLOW` for the data payment, `BLOCK` for a settle before a pin, `ALLOW` for the human pin, and `ALLOW` for the fill. Then see a live dry quote, or the line `QUOTE UNAVAILABLE` if 1Click does not answer. A dry quote has no deposit address.

4. `npm start`
   Open `http://localhost:3000`.
   Click **Agent pays for the scan**. See `ALLOW` and the treasury move from `$1` to `$0.99`.
   Click **Injection: pay attacker.near**. See `BLOCK` and `receiver_not_allowlisted`. The treasury does not move.
   Click **Request a dry quote**. See a wNEAR to USDT price and `Deposit address: none`.

The live desk is https://allowance-vert.vercel.app. Vercel serves `public/` and `api/`. Steps for the host are in `YOU-DO-THIS.md`.

## What the agent is allowed to do

| Action | Who signs | Result |
| --- | --- | --- |
| Pay `market-data.near` $0.01 | Agent function-call key | Allowed, until the $0.05 per-call cap or the $0.10 daily cap |
| Fill the pinned sandbox settlement | Agent function-call key | Allowed once, for that receiver and that amount, before it expires |
| Pay `attacker.near` | Agent function-call key | Blocked. Receiver is not on the allowlist |
| Transfer NEAR | Agent function-call key | Blocked. A function-call key cannot transfer |
| Call another contract | Agent function-call key | Blocked. The key names one receiver, `allowance.testnet` |
| Withdraw, pause, or pin a quote | Agent function-call key | Blocked. Those methods are not on the key |
| Pin, pause, withdraw | Human full-access key | Allowed. The human keeps this key out of the agent process |

Amounts on the desk are 6-decimal units. `1000000` is `$1`. The Intents quote is a separate unit: `100000000000000000000000` yoctoNEAR, which is 0.1 NEAR.

## How NEAR fits

The agent holds a function-call access key. That key can call `execute` on one contract and cannot attach NEAR. The contract holds the budget, so draining the agent account does not drain the desk. The human keeps a full-access key in a wallet and uses it to pause, withdraw, change the allowlist, and pin the next settlement.

A passed scan pays an allowlisted data vendor from that budget. That is the agent spending. The Intents call is a dry quote from `https://1click.chaindefuser.com/v0/quote` for wNEAR to USDT. Dry mode returns a price and does not return a deposit address, so the demo cannot send a deposit by accident. A live swap would be a separate human step, with a tiny amount, after the human pins the real deposit address.

The same policy is deployed on testnet at `netokrypto-allowance.testnet`. Connect a testnet wallet on the site to open your own desk and pin a settlement. The agent call is signed by a function-call key whose only method is `execute`. The Rust source is `contract-rs/`. `contract/allowance.js` is the same rules for the local desk.

## Limits a judge should know

- The deployed contract is the Rust crate in `contract-rs/`. `npm test` still checks the local desk. `contract/allowance.js` is the JavaScript twin, not the wasm that was deployed.
- Intents has no testnet. This project never sends `dry: false`.
- The hosted page and `npm start` share one rule module. There is no second policy in the browser.
- This repository is only Allowance. It does not contain the author's other bots.

## License

MIT. See `LICENSE`.
