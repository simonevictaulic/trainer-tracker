# Training Specialist Tracker

React app for tracking new-hire training by specialist.

## Run it
    npm install --legacy-peer-deps
    node node_modules/vite/bin/vite.js
Then open http://localhost:5173

(`npm run dev` does the same thing, but running node directly avoids the shortcut commands IT blocks.)

## Notes
- Data is saved in the browser's localStorage, so each computer/browser has its own data.
- Never commit the "Archive completed" JSON files — they contain trainee names and evaluations.
- Admin page password is set inside the running app (stored only as a hash in the browser).
