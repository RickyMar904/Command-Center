import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { makeHandler } from "../api/_lib/handler.js";
import { resetForTests } from "../api/_lib/store.js";

let pg, handler;
const env = { SYNC_PASSCODE: "correct horse" };
beforeEach(async () => {
  pg = new PGlite();
  resetForTests();
  handler = makeHandler({ env, getQuery: () => async (text, params) => (await pg.query(text, params)).rows });
});

async function call(method, { body, pass = "correct horse" } = {}) {
  const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(s) { this.body = JSON.parse(s); } };
  await handler({ method, headers: pass ? { "x-sync-passcode": pass } : {}, body }, res);
  return res;
}
const db = (n) => ({ version: 1, projects: [], phases: [], tasks: Array.from({ length: n }, (_, i) => ({ id: "t" + i, title: "Task " + i })) });

test("rejects missing or wrong passcode", async () => {
  assert.equal((await call("GET", { pass: null })).statusCode, 401);
  assert.equal((await call("GET", { pass: "nope" })).statusCode, 401);
});

test("refuses to run without SYNC_PASSCODE", async () => {
  const h = makeHandler({ env: {}, getQuery: () => { throw new Error("unused"); } });
  const res = { setHeader() {}, end(s) { this.body = JSON.parse(s); } };
  await h({ method: "GET", headers: { "x-sync-passcode": "" } }, res);
  assert.equal(res.statusCode, 503);
});

test("empty database returns null data and creates the table", async () => {
  const r = await call("GET");
  assert.equal(r.statusCode, 200);
  assert.deepEqual(r.body, { data: null, version: 0, updatedAt: null });
});

test("first save, then versioned saves", async () => {
  const a = await call("PUT", { body: { data: db(1), baseVersion: 0 } });
  assert.equal(a.statusCode, 200); assert.equal(a.body.version, 1);
  const b = await call("PUT", { body: { data: db(2), baseVersion: 1 } });
  assert.equal(b.body.version, 2);
  const g = await call("GET");
  assert.equal(g.body.version, 2); assert.equal(g.body.data.tasks.length, 2); assert.ok(g.body.updatedAt);
});

test("stale writes get a 409 with the current copy", async () => {
  await call("PUT", { body: { data: db(1), baseVersion: 0 } });
  await call("PUT", { body: { data: db(2), baseVersion: 1 } });
  const stale = await call("PUT", { body: { data: db(5), baseVersion: 1 } });
  assert.equal(stale.statusCode, 409); assert.equal(stale.body.current.version, 2); assert.equal(stale.body.current.data.tasks.length, 2);
  const first = await call("PUT", { body: { data: db(5), baseVersion: 0 } });
  assert.equal(first.statusCode, 409);
  const forced = await call("PUT", { body: { data: db(5), baseVersion: 1, force: true } });
  assert.equal(forced.statusCode, 200); assert.equal(forced.body.version, 3);
});

test("rejects bodies that are not app data", async () => {
  assert.equal((await call("PUT", { body: { data: { hello: 1 } } })).statusCode, 400);
  assert.equal((await call("PUT", { body: "not json" })).statusCode, 400);
  assert.equal((await call("PUT", { body: JSON.stringify({ data: db(1), baseVersion: 0 }) })).statusCode, 200);
  assert.equal((await call("DELETE")).statusCode, 405);
});
