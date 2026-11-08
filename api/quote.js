import { handleQuote } from "../src/http.js";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "GET or POST" });
    return;
  }
  const outcome = await handleQuote();
  res.status(outcome.status).json(outcome.body);
}
