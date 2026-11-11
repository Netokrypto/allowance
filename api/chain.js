import { chainInfo } from "../src/chain-rpc.js";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "GET only" });
    return;
  }
  res.status(200).json(chainInfo());
}
