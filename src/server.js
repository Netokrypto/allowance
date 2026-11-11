import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { agentExecute, chainInfo } from "./chain-rpc.js";
import { handleAct, handleDesk, handleQuote } from "./http.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");

function loadEnv() {
  try {
    const text = readFileSync(path.join(root, ".env"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2];
    }
  } catch {
    // Production reads these from the host environment.
  }
}

loadEnv();
const port = Number(process.env.PORT) || 3000;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 100_000) throw new Error("body too large");
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  return JSON.parse(text);
}

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.resolve(publicDir, `.${requested}`);
  if (!filePath.startsWith(publicDir)) {
    send(res, 404, { error: "not found" });
    return;
  }
  try {
    const file = await readFile(filePath);
    const type = types[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(file);
  } catch {
    send(res, 404, { error: "not found" });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/api/chain") {
      send(res, 200, chainInfo());
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/chain-act") {
      send(res, 200, await agentExecute(await readJson(req)));
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/desk") {
      const outcome = handleDesk();
      send(res, outcome.status, outcome.body);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/act") {
      const outcome = handleAct(await readJson(req));
      send(res, outcome.status, outcome.body);
      return;
    }
    if ((req.method === "GET" || req.method === "POST") && url.pathname === "/api/quote") {
      const outcome = await handleQuote();
      send(res, outcome.status, outcome.body);
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      send(res, 404, { error: "not found" });
      return;
    }
    if (req.method !== "GET") {
      send(res, 405, { error: "GET only" });
      return;
    }
    await serveStatic(req, res);
  } catch (error) {
    send(res, 400, { error: error.message || "bad request" });
  }
});

server.listen(port, () => {
  console.log(`Allowance desk at http://localhost:${port}`);
});
