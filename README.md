# Command Center (offline)

A personal project-management and task-scheduling app in a single, self-contained HTML file.

## Open it

Download `index.html` and open it in Chrome or Edge. No install, server or build step is needed.

## Host it on Vercel

The app is a static file, so Vercel serves `index.html` at `/` with no build:

- Framework Preset: **Other**
- Build Command: none (leave empty)
- Output Directory: no override
- Root Directory: leave blank

The site also has a small save API (`api/state.js`), so Vercel installs one package (`@neondatabase/serverless`) from `package.json`. Nothing needs building.

Voice input, the spoken morning briefing and AI mode work only when the file is opened from your own computer (not inside a sandboxed preview).

## Auto-save to your database

On your Vercel site, every change is saved to your Neon database a moment after you make it, so you never need to download and re-import backups. A small badge at the top of the app shows **Saved**, **Saving…**, **Offline** or **Not saving**.

### One-time setup on Vercel

1. Open your project on vercel.com, then **Settings → Environment Variables**.
2. Check that `DATABASE_URL` is listed. Connecting Neon to the project adds it. If it is missing, open **Storage**, pick your Neon database and connect it to this project.
3. Add a new variable named `SYNC_PASSCODE`. Make the value a long passphrase only you know (for example four random words). Tick Production, Preview and Development, then **Save**.
4. Go to **Deployments**, open the menu (⋯) on the latest deployment and choose **Redeploy**. New variables only take effect after a redeploy.
5. Open your site, go to **Data & backup**, type the same passcode under **Auto-save** and press **Turn on auto-save**.

The first time, whatever is on that device is uploaded and the database table is created automatically. On every other device or browser, open the site and enter the passcode once; it loads your saved data.

### How it behaves

- The app still keeps a copy in the browser (`localStorage`), so it opens instantly and keeps working offline. Changes made offline are saved when the connection is back.
- When the app opens or comes back into view, it fetches the latest copy from the database, so changes from your phone show up on your laptop and the other way round.
- If two devices both changed things before syncing, the newest copy wins. The other one is never thrown away: it is kept as a **safety copy** under Data & backup (the last three), where you can download or restore it.
- Your site address is public, so the save API refuses any request without the passcode. The passcode is stored only in your browser.
- **Download backup** still works if you want an extra copy now and then.
- A file opened from your own computer (not the website) does not auto-save; it keeps working the old way, with backups.

### Developing locally

`npm install`, then `npm test` runs the API tests against an in-memory Postgres. `SYNC_PASSCODE=test node dev/server.js` serves the app at http://localhost:3000 with a temporary database.

## API keys

Smart add and Meeting notes can use one of three AI services. Gemini (key from aistudio.google.com) and Groq (key from console.groq.com/keys) have free tiers; Claude (console.anthropic.com) is paid. Saving a key when no other key is saved switches Smart add to that service.


The optional AI keys for Smart add (Claude, Gemini or Groq, picked under **Data & backup → AI for Smart add**) and the ElevenLabs (briefing voice) key are entered inside the app and kept only in your browser. They are never included in backups or auto-save, and must never be committed to this repository. The same goes for `SYNC_PASSCODE` and `DATABASE_URL`: they live only in Vercel's settings.
