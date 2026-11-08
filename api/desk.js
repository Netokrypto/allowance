import { handleDesk } from "../src/http.js";

export default function handler(_req, res) {
  const outcome = handleDesk();
  res.status(outcome.status).json(outcome.body);
}
