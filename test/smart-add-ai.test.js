import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

/* Loads the Smart add AI code from index.html with fetch and localStorage stubbed, and no retry waits. */
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = html.slice(html.indexOf("/* ---------- Smart add"), html.indexOf("/* UI */")).replace(/const AI_RETRY_MS = \[[^\]]*\]/, "const AI_RETRY_MS = [0, 0]");

function load({ keys = {}, provider, respond }) {
  const store = { ...keys };
  if (provider) store["command-center-offline-ai-provider"] = provider;
  const calls = [];
  const ctx = {
    localStorage: { getItem: (k) => store[k] ?? null, setItem() {}, removeItem() {} },
    fetch: async (url, opts) => { calls.push(url); const [status, body] = respond(url, calls.length); return { ok: status === 200, status, json: async () => body }; },
    setTimeout, AI_SCHEMA: { type: "object", properties: {} },
  };
  vm.createContext(ctx);
  vm.runInContext(src + "\nthis.aiCallWithFallback = aiCallWithFallback;", ctx);
  return { ctx, calls };
}
const GKEY = { "command-center-offline-gemini-key": "AIza-test" };
const QKEY = { "command-center-offline-groq-key": "gsk-test" };
const ok = (tasks) => [200, { candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ tasks }) }] } }] }];
const busy = [503, { error: { message: "This model is currently experiencing high demand." } }];
const model = (url) => (url.match(/models\/([^:]+):/) || [])[1];

test("a busy Gemini model is retried twice, then the next model answers", async () => {
  const { ctx, calls } = load({ keys: GKEY, respond: (url) => (model(url) === "gemini-flash-latest" ? busy : ok([{ title: "Call vendor" }])) });
  const statuses = [];
  const r = await ctx.aiCallWithFallback("sys", "user", (m) => statuses.push(m));
  assert.equal(calls.filter((u) => model(u) === "gemini-flash-latest").length, 3);
  assert.equal(r.by, "Gemini (gemini-3.5-flash)");
  assert.equal(r.out.tasks[0].title, "Call vendor");
  assert.ok(statuses.some((m) => /busy, trying again/.test(m)));
});

test("a retry that succeeds stays on the same model", async () => {
  const { ctx, calls } = load({ keys: GKEY, respond: (url, n) => (n === 1 ? busy : ok([])) });
  const r = await ctx.aiCallWithFallback("sys", "user");
  assert.equal(calls.length, 2);
  assert.equal(r.by, "Gemini (gemini-flash-latest)");
});

test("retired models (404) and rate limits (429) skip straight to the next model", async () => {
  const { ctx, calls } = load({ keys: GKEY, respond: (url) => ({ "gemini-flash-latest": [404, {}], "gemini-3.5-flash": [429, {}] }[model(url)] || ok([])) });
  const r = await ctx.aiCallWithFallback("sys", "user");
  assert.deepEqual(calls.map(model), ["gemini-flash-latest", "gemini-3.5-flash", "gemini-flash-lite-latest"]);
  assert.equal(r.by, "Gemini (gemini-flash-lite-latest)");
});

test("when every Gemini model is busy, a saved Groq key answers", async () => {
  const { ctx } = load({ keys: { ...GKEY, ...QKEY }, provider: "gemini", respond: (url) => (url.includes("groq") ? [200, { choices: [{ finish_reason: "stop", message: { content: '{"tasks":[]}' } }] }] : busy) });
  const r = await ctx.aiCallWithFallback("sys", "user");
  assert.equal(r.by, "Groq (openai/gpt-oss-120b)");
});

test("with no Groq key, the 503 error is passed on so the built-in splitter is used", async () => {
  const { ctx, calls } = load({ keys: GKEY, respond: () => busy });
  await assert.rejects(ctx.aiCallWithFallback("sys", "user"), /503.*high demand/);
  assert.equal(calls.length, 15); // 5 models x 3 tries
});

test("a rejected key does not try the other Gemini models", async () => {
  const { ctx, calls } = load({ keys: GKEY, respond: () => [400, { error: { message: "API key not valid" } }] });
  await assert.rejects(ctx.aiCallWithFallback("sys", "user"), /rejected the API key/);
  assert.equal(calls.length, 1);
});

test("Claude is never used as a fallback", async () => {
  const { ctx, calls } = load({ keys: { ...QKEY, "command-center-offline-ai-key": "sk-ant" }, provider: "groq", respond: () => busy });
  await assert.rejects(ctx.aiCallWithFallback("sys", "user"));
  assert.ok(calls.every((u) => u.includes("groq")));
});
