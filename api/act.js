import { handleAct } from "../src/http.js";

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
    const outcome = handleAct(await readBody(req));
    res.status(outcome.status).json(outcome.body);
  } catch (error) {
    res.status(400).json({ error: error.message || "bad request" });
  }
}
