import { assertDemoDesk, createDesk, submit } from "./chain.js";
import { requestDryQuote } from "./intents.js";

export function handleDesk() {
  return { status: 200, body: createDesk() };
}

export function handleAct(input, now = Date.now()) {
  try {
    if (!input || typeof input !== "object") throw new Error("JSON body is required");
    if (typeof input.signer !== "string" || !input.action || typeof input.action !== "object") {
      throw new Error("signer and action are required");
    }
    if (typeof input.action.method !== "string") throw new Error("action.method is required");
    assertDemoDesk(input.desk);
    const outcome = submit(input.desk, input.signer, input.action, now);
    return { status: 200, body: outcome };
  } catch (error) {
    return { status: 400, body: { error: error.message } };
  }
}

export async function handleQuote(options = {}) {
  try {
    const quote = await requestDryQuote({
      apiKey: process.env.ONE_CLICK_API_KEY || "",
      signal: AbortSignal.timeout(12_000),
      ...options,
    });
    return { status: 200, body: { ok: true, quote } };
  } catch (error) {
    return {
      status: 200,
      body: { ok: false, live: false, error: error.message || "quote failed" },
    };
  }
}
