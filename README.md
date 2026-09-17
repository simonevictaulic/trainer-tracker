 # Trainer Progress Tracker

A standalone build of the trainer/trainee tracking app, ready to push to
GitHub and host on GitHub Pages so tablets can open it as a URL (or as
an installed "app" via Add to Home Screen).

## 1. Push it to GitHub

```bash
cd trainer-tracker-web
git init
git add .
git commit -m "Initial commit"
gh repo create trainer-tracker --public --source=. --push
```

(No `gh` CLI? Create an empty repo named **trainer-tracker** on
github.com first, then `git remote add origin <url>` and
`git push -u origin main`.)

If you name the repo something other than `trainer-tracker`, update the
`base` path in `vite.config.js` to match — GitHub Pages serves project
sites at `https://<you>.github.io/<repo-name>/`, and a mismatched base
path is the #1 reason the deployed site loads blank.

## 2. Install and test locally

```bash
npm install
npm run dev
```

Open the printed `localhost` URL — this is the full app, works exactly
like the artifact preview did.

## 3. Deploy to GitHub Pages

```bash
npm run deploy
```

This builds the app and pushes it to a `gh-pages` branch (via the
`gh-pages` package, already wired up in `package.json`). Then in the
GitHub repo: **Settings → Pages → Branch → `gh-pages` / root → Save**.
Your app will be live at `https://<you>.github.io/trainer-tracker/`
within a minute or two.

## 4. Open it on a tablet

Just visit that URL in the tablet's browser. To make it feel like an
installed app instead of a browser tab:

- **iPad (Safari):** open the URL → Share icon → **Add to Home Screen**.
- **Android (Chrome):** open the URL → ⋮ menu → **Add to Home screen** /
  **Install app**.

Either way it opens full-screen with an icon, no address bar.

## Important: data does NOT sync between tablets

The original artifact stored data through a Claude-specific API. This
build replaces that with `localStorage` (see `src/storagePolyfill.js`)
so it runs as a normal web app — but `localStorage` is **per-browser,
per-device**. Each tablet keeps its own separate list of trainees; they
will not see each other's data.

That's fine if:
- One shared tablet is used for all checkpoint logging, or
- Each trainer's tablet is genuinely meant to track their own trainees
  independently.

It's a problem if you need every tablet to show the same live queue
(e.g. a supervisor's tablet should see checkpoints logged from a
trainer's tablet). If that's your case, the fix is swapping
`storagePolyfill.js` for a real shared backend — a small serverless
database like Supabase or Firebase is the least-effort option, since
both offer free tiers and a JS client that's a near drop-in replacement
for the same `get`/`set` shape used here. Ask and this can be built out.

## Project structure

```
trainer-tracker-web/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx            entry point, loads the storage polyfill first
│   ├── storagePolyfill.js  localStorage shim for window.storage
│   └── App.jsx             the app itself (unmodified from the artifact)
```
