# Submission checklist

The desk, the tests, and the dry-quote client are in this repo. The steps below use a NEAR account, an X post, and the hackathon form.

Deadline: **14 Nov 2026, 23:59 UTC**. Leave the hosted page up through **18 Nov**, and through **25 Nov** if you can.

## 1. The judge page is already on Vercel

Open https://allowance-vert.vercel.app and click **Agent pays for the scan**, then **Injection: pay attacker.near**, then **Request a dry quote**. You should see ALLOW, then BLOCK, then a price with no deposit address.

Leave that URL up through 18 Nov 2026, and through 25 Nov if you can. Do not put a Telegram poller on Vercel. This project does not have one.

## 2. Confirm the GitHub repo is public

Judges cannot open a private repository. The repo should already be public at:

https://github.com/Netokrypto/allowance

If it is private, on GitHub open **Settings → General → Danger zone → Change visibility → Public**.

## 3. Create the NEAR account that receives a prize

Any mainnet account works. A named account such as `yourname.near`, or a 64-character implicit account. Create it in a NEAR wallet. Write the address down exactly, in lowercase.

That address is only for the prize form. It is not used by the demo.

Testnet NEAR is free from https://near-faucet.io if you later deploy the contract. Mainnet gas is not reimbursed. You do not need testnet funds to submit this prototype.

## 4. Film the demo and post it on X

Record the screen while doing these three clicks on the Vercel URL, or on `http://localhost:3000` after `npm start`:

1. **Agent pays for the scan.** The banner says ALLOW and the treasury drops.
2. **Injection: pay attacker.near.** The banner says BLOCK and the treasury stays.
3. **Request a dry quote.** A wNEAR to USDT price appears, and the deposit address is none.

Post the video on X. The post has to say you built it at NEAR HACKATHON, tag `@NEARProtocol`, and include `#NEARHackathon`. `@NearLegion` and `@NearBuilders` are optional.

Draft you can paste and edit:

```text
An agent with a budget still needs a lock.

Allowance gives the agent a NEAR function-call key for one contract method. It can pay for a scan and fill one settlement I pinned. Told to pay an attacker, the policy blocks it and the treasury does not move. A dry NEAR Intents quote prices the swap and returns no deposit address, so nothing is sent.

Built at NEAR HACKATHON.
https://github.com/Netokrypto/allowance

@NEARProtocol #NEARHackathon
```

The Vercel URL can go in the same post, under the repository link.

## 5. Submit the hackathon form once

Do this after the repo is public and the X post is live. The form cannot be edited after you send it. Mistakes go to https://nearhackathon.com/request-changes , not a second submission.

Fill in the personal fields before sending. The form accepts each repository once.

- Project name: `Allowance`
- Your name
- Your email
- Team size: `1`
- Tracks: `security`, `agents`, `defi`
- NEAR account from step 3
- Repository: `https://github.com/Netokrypto/allowance`
- Demo post: the X URL from step 4
- Consent, after you agree to this sentence: "I agree that the organizers may use these details to review our submission and contact us about this hackathon."

Description you can paste:

```text
Allowance is a trading desk whose agent can pay for market data and fill one settlement a human pinned. The agent signs with a NEAR function-call key scoped to a single contract method. The contract holds the budget. The human sets the daily cap, the per-call cap, and the allowlist, and pins the exact receiver and amount. The agent pays an allowlisted data vendor, then requests a dry NEAR Intents quote from wNEAR to USDT. A dry quote returns a price and no deposit address, so no funds move. A prompt-injected command that transfers NEAR, calls another contract, or pays an attacker is refused, and the treasury does not change.
```

Send the form from https://nearhackathon.com/#apply. One submission per repository. It cannot be edited after it is sent.

## 6. Deploying the contract later

Not required for the submission. The judged prototype is `npm test` and the web desk.

`contract/allowance.js` is near-sdk-js source. This repo does not include a compiled wasm. To put it on testnet, install the NEAR contract toolchain from https://docs.near.org/ , deploy `allowance.js` to a testnet account, and add a function-call key whose methods are only `execute` and whose receiver is that contract. Keep the full-access key in a wallet, out of the project and out of Vercel.
