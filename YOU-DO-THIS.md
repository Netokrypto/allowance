# What you still do

The repo, the tests, the desk, and the dry-quote client are done. These steps need your accounts. I must not post on X, send the hackathon form, invent a NEAR account, or deploy to mainnet.

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

You post this. I do not.

Record the screen while you do these three clicks on the Vercel URL, or on `http://localhost:3000` after `npm start`:

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

Replace the GitHub line with the Vercel URL as well if you have it. Send me the post URL when it is up.

## 5. Submit the hackathon form once

Do this after the repo is public and the X post is live. The form cannot be edited after you send it. Mistakes go to https://nearhackathon.com/request-changes , not a second submission.

Fill these yourself. I will not guess them.

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

When you want me to send it, reply with every value above and a clear yes. I will print the JSON and wait for that yes before I POST it. One try per repository.

Form, if you prefer to send it yourself: https://nearhackathon.com/#apply

## 6. Deploying the contract later

Not required for the submission. The judged prototype is `npm test` and the web desk.

`contract/allowance.js` is near-sdk-js source. This environment has no contract toolchain, so there is no wasm in the repo. When you want it on testnet, install the NEAR contract toolchain from https://docs.near.org/ , deploy `allowance.js` to a testnet account you control, and add a function-call key whose methods are only `execute` and whose receiver is that contract. Keep the full-access key in your wallet. Do not put that full-access key in the project or in Vercel.
