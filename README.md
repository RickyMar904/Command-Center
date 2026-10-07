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

Data is per browser and per address, so the Vercel site starts empty. Export a backup from **Data & backup** in the copy you use now, then import it on the Vercel site.

Voice input, the spoken morning briefing and AI mode work only when the file is opened from your own computer (not inside a sandboxed preview).

## Your data

- Everything is stored in your browser's `localStorage` on the device you use. Clearing site data or switching browsers starts empty.
- Export a JSON backup regularly from **Data & backup**, and import it there to restore or move to another device.

## API keys

The optional Anthropic (AI mode) and ElevenLabs (briefing voice) keys are entered inside the app and kept only in your browser. They are never included in backups and must never be committed to this repository.
