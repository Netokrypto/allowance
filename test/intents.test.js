import assert from "node:assert/strict";
import test from "node:test";
import { buildDryQuoteBody, readQuote, requestDryQuote } from "../src/intents.js";

test("a quote body is always dry, even if the caller asks for a live swap", () => {
  const body = buildDryQuoteBody({ dry: false, now: Date.parse("2026-11-08T12:00:00.000Z") });
  assert.equal(body.dry, true);
  assert.equal(body.swapType, "EXACT_INPUT");
  assert.equal(body.originAsset, "nep141:wrap.near");
  assert.equal(body.destinationAsset, "nep141:usdt.tether-token.near");
  assert.equal(body.amount, "100000000000000000000000");
  assert.equal(body.deadline, "2026-11-08T12:03:00.000Z");
});

test("a dry quote result never keeps a deposit address", () => {
  const quote = readQuote({
    quote: {
      amountInFormatted: "0.1",
      amountOutFormatted: "0.36",
      amountOutUsd: "0.36",
      depositAddress: "should-not-pass",
    },
  });
  assert.equal(quote.depositAddress, null);
  assert.equal(quote.dry, true);
  assert.equal(quote.amountOutFormatted, "0.36");
});

test("requestDryQuote posts the dry body and strips any deposit address", async () => {
  let sent;
  const quote = await requestDryQuote({
    now: Date.parse("2026-11-08T12:00:00.000Z"),
    fetchImpl: async (url, options) => {
      sent = { url, options };
      return {
        ok: true,
        json: async () => ({
          quote: {
            amountInFormatted: "0.1",
            amountOutFormatted: "0.367072",
            amountOutUsd: "0.3667",
            depositAddress: "hidden.near",
          },
        }),
      };
    },
  });
  const body = JSON.parse(sent.options.body);
  assert.equal(sent.url, "https://1click.chaindefuser.com/v0/quote");
  assert.equal(body.dry, true);
  assert.equal(quote.depositAddress, null);
  assert.equal(quote.amountOutFormatted, "0.367072");
});
