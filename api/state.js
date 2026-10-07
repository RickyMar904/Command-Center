import { neon } from "@neondatabase/serverless";
import { makeHandler } from "./_lib/handler.js";

let sql;
function getQuery() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("No database: connect Neon to this Vercel project so DATABASE_URL is set, then redeploy.");
  sql ||= neon(url);
  return (text, params) => sql.query(text, params);
}

export default makeHandler({ getQuery });
