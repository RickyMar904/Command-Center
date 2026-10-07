// Storage for the whole app state as one JSON document in one row.
// `q(text, params)` runs a parameterised query and resolves to an array of rows,
// so the same code runs on Neon in production and on an in-memory Postgres in tests.

const ROW_ID = "main";
let ready = null;

export function ensureTable(q) {
  if (!ready) {
    ready = q(`create table if not exists command_center_state (
      id text primary key,
      data jsonb not null,
      version integer not null default 1,
      updated_at timestamptz not null default now()
    )`).catch((e) => { ready = null; throw e; });
  }
  return ready;
}
export function resetForTests() { ready = null; }

const shape = (row) => row ? { data: row.data, version: Number(row.version), updatedAt: new Date(row.updated_at).toISOString() } : { data: null, version: 0, updatedAt: null };

export async function readState(q) {
  await ensureTable(q);
  const rows = await q("select data, version, updated_at from command_center_state where id = $1", [ROW_ID]);
  return shape(rows[0]);
}

/**
 * Saves `data` only if the stored copy is still at `baseVersion` (0 means "nothing stored yet"),
 * so a device never silently overwrites changes it hasn't seen. `force` skips that check.
 * Returns { ok: true, version, updatedAt } or { ok: false, current } on a conflict.
 */
export async function writeState(q, data, baseVersion, force = false) {
  await ensureTable(q);
  const json = JSON.stringify(data);
  let rows;
  if (force) {
    rows = await q(`insert into command_center_state (id, data) values ($1, $2::jsonb)
      on conflict (id) do update set data = excluded.data, version = command_center_state.version + 1, updated_at = now()
      returning version, updated_at`, [ROW_ID, json]);
  } else if (!baseVersion) {
    rows = await q(`insert into command_center_state (id, data) values ($1, $2::jsonb)
      on conflict (id) do nothing returning version, updated_at`, [ROW_ID, json]);
  } else {
    rows = await q(`update command_center_state set data = $2::jsonb, version = version + 1, updated_at = now()
      where id = $1 and version = $3 returning version, updated_at`, [ROW_ID, json, baseVersion]);
  }
  if (rows[0]) return { ok: true, version: Number(rows[0].version), updatedAt: new Date(rows[0].updated_at).toISOString() };
  return { ok: false, current: await readState(q) };
}

/** Same shape check the app uses for backups. */
export function validDb(x) {
  return !!x && typeof x === "object" && !Array.isArray(x) && Array.isArray(x.projects) && Array.isArray(x.tasks) && (x.phases === undefined || Array.isArray(x.phases));
}
