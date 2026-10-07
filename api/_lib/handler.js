import { passcodeOk } from "./auth.js";
import { readState, writeState, validDb } from "./store.js";

const MAX_BYTES = 4 * 1024 * 1024; // Vercel caps request bodies at 4.5 MB

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

/**
 * GET  /api/state  -> { data, version, updatedAt }   (data is null until the first save)
 * PUT  /api/state  body { data, baseVersion, force? } -> { version, updatedAt }, or 409 { conflict: true, current }
 * Every request needs the header `x-sync-passcode` matching SYNC_PASSCODE.
 */
export function makeHandler({ getQuery, env = process.env }) {
  return async function handler(req, res) {
    if (!env.SYNC_PASSCODE) return send(res, 503, { error: "Sync is not set up: add SYNC_PASSCODE in Vercel and redeploy." });
    if (!passcodeOk(req.headers["x-sync-passcode"], env.SYNC_PASSCODE)) return send(res, 401, { error: "Wrong passcode." });
    let q;
    try { q = getQuery(); } catch (e) { return send(res, 503, { error: e.message }); }
    try {
      if (req.method === "GET") return send(res, 200, await readState(q));
      if (req.method === "PUT" || req.method === "POST") {
        let body = req.body;
        if (typeof body === "string") { try { body = JSON.parse(body); } catch { return send(res, 400, { error: "Body is not JSON." }); } }
        if (!body || !validDb(body.data)) return send(res, 400, { error: "That is not Command Center data." });
        if (JSON.stringify(body.data).length > MAX_BYTES) return send(res, 413, { error: "Data is too large to sync." });
        const base = Number.isInteger(body.baseVersion) && body.baseVersion > 0 ? body.baseVersion : 0;
        const out = await writeState(q, body.data, base, body.force === true);
        return out.ok ? send(res, 200, { version: out.version, updatedAt: out.updatedAt }) : send(res, 409, { conflict: true, current: out.current });
      }
      res.setHeader("Allow", "GET, PUT");
      return send(res, 405, { error: "Use GET or PUT." });
    } catch (e) {
      console.error("state api failed", e);
      return send(res, 500, { error: "The database request failed." });
    }
  };
}
