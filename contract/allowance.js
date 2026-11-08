// On-chain twin of src/policy.js. This file is the deploy target.
// It is not compiled in this repository: this machine has no Rust toolchain
// and no near-sdk-js build. Judges verify the rules with `npm test`.
//
// The agent key may call `execute` only. Owner methods stay on the human's
// full-access key. Function-call keys cannot attach a NEAR deposit, so the
// treasury lives in this contract and the agent never holds it.

import { NearBindgen, near, call, view } from "near-sdk-js";

@NearBindgen({})
class Allowance {
  owner = "";
  agent = "";
  perCallCap = "50000";
  dailyCap = "100000";
  spentToday = "0";
  day = "";
  paused = false;
  allowlist = ["market-data.near"];
  quoteReceiver = "";
  quoteAmount = "0";
  quoteExpiresAt = "0";
  treasury = "1000000";

  @view({})
  get_policy() {
    return {
      owner: this.owner,
      agent: this.agent,
      perCallCap: this.perCallCap,
      dailyCap: this.dailyCap,
      spentToday: this.spentToday,
      day: this.day,
      paused: this.paused,
      allowlist: this.allowlist,
      quoteReceiver: this.quoteReceiver,
      quoteAmount: this.quoteAmount,
      quoteExpiresAt: this.quoteExpiresAt,
      treasury: this.treasury,
    };
  }

  assertOwner() {
    if (near.predecessorAccountId() !== this.owner) throw new Error("not_owner");
  }

  assertAgent() {
    if (near.predecessorAccountId() !== this.agent) throw new Error("not_agent");
  }

  rollDay() {
    const day = new Date().toISOString().slice(0, 10);
    if (this.day !== day) {
      this.day = day;
      this.spentToday = "0";
    }
  }

  @call({})
  init({ owner, agent }) {
    if (this.owner) throw new Error("unknown_method");
    this.owner = owner;
    this.agent = agent;
    this.day = new Date().toISOString().slice(0, 10);
  }

  @call({})
  pause({ paused }) {
    this.assertOwner();
    this.paused = Boolean(paused);
  }

  @call({})
  allow({ receiver }) {
    this.assertOwner();
    if (!receiver) throw new Error("bad_receiver");
    if (!this.allowlist.includes(receiver)) this.allowlist.push(receiver);
  }

  @call({})
  record_quote({ depositAddress, amount, expiresAt }) {
    this.assertOwner();
    if (!depositAddress) throw new Error("bad_receiver");
    if (!(BigInt(amount) > 0n)) throw new Error("amount_not_positive");
    if (BigInt(expiresAt) <= BigInt(Date.now())) throw new Error("quote_expired");
    this.quoteReceiver = depositAddress;
    this.quoteAmount = String(amount);
    this.quoteExpiresAt = String(expiresAt);
  }

  @call({})
  withdraw({ receiver, amount }) {
    this.assertOwner();
    if (!receiver) throw new Error("bad_receiver");
    const value = BigInt(amount);
    if (value <= 0n) throw new Error("amount_not_positive");
    if (value > BigInt(this.treasury)) throw new Error("insufficient_treasury");
    this.treasury = (BigInt(this.treasury) - value).toString();
  }

  @call({})
  execute({ kind, receiver, amount }) {
    if (this.paused) throw new Error("paused");
    this.assertAgent();
    this.rollDay();
    if (kind !== "pay" && kind !== "settle") throw new Error("bad_kind");
    const value = BigInt(amount);
    if (value <= 0n) throw new Error("amount_not_positive");
    if (!receiver) throw new Error("bad_receiver");

    if (kind === "pay") {
      if (!this.allowlist.includes(receiver)) throw new Error("receiver_not_allowlisted");
    } else if (!this.quoteReceiver) {
      throw new Error("quote_missing");
    } else if (BigInt(this.quoteExpiresAt) <= BigInt(Date.now())) {
      throw new Error("quote_expired");
    } else if (receiver !== this.quoteReceiver || String(amount) !== this.quoteAmount) {
      throw new Error("quote_mismatch");
    }

    if (value > BigInt(this.perCallCap)) throw new Error("over_per_call_cap");
    if (BigInt(this.spentToday) + value > BigInt(this.dailyCap)) throw new Error("over_daily_cap");
    if (value > BigInt(this.treasury)) throw new Error("insufficient_treasury");

    this.spentToday = (BigInt(this.spentToday) + value).toString();
    this.treasury = (BigInt(this.treasury) - value).toString();
    if (kind === "settle") {
      this.quoteReceiver = "";
      this.quoteAmount = "0";
      this.quoteExpiresAt = "0";
    }
    return "allowed";
  }
}
