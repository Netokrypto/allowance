import { agentExecute } from "../src/chain-rpc.js";

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.json === "function") return req.json();
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  try {
    const body = await readBody(req);
    const outcome = await agentExecute(body);
    res.status(200).json(outcome);
  } catch (error) {
    res.status(400).json({ ok: false, reason: error.message || "bad request" });
  }
}
