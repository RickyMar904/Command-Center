// Local test server: serves index.html and runs /api/state against an in-memory Postgres (PGlite).
// Usage: SYNC_PASSCODE=test node dev/server.js   (port 3000, or PORT)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { makeHandler } from "../api/_lib/handler.js";

const pg = new PGlite();
const api = makeHandler({ getQuery: () => async (text, params) => (await pg.query(text, params)).rows });
const page = new URL("../index.html", import.meta.url);

createServer(async (req, res) => {
  if (req.url.startsWith("/api/state")) {
    let raw = ""; for await (const c of req) raw += c;
    req.body = raw ? JSON.parse(raw) : undefined;
    return api(req, res);
  }
  if (req.url === "/" || req.url.startsWith("/?") || req.url.startsWith("/index.html")) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(await readFile(page));
  }
  res.statusCode = 404; res.end("not found");
}).listen(process.env.PORT || 3000, () => console.log(`http://localhost:${process.env.PORT || 3000}`));
