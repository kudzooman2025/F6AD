# F6AD — U14 Boys 2026

A single-page web app for managing a youth soccer team: summer conditioning,
mini-camps, player roster, session attendance, voting on tournaments, and a
full live game tracker. Data is stored in Firebase (Firestore + Auth) and the
site is served as static files via Firebase Hosting.

## Project layout

```
soccer-fun-time.html     The page: all HTML markup + script/style references
styles.css               All CSS
js/                       Application logic (plain scripts, no build step)
  01-core.js              Firebase init, data constants, app state
  02-auth.js              Sign in / out, staff, admin unlock
  03-conditioning.js      Summer conditioning, mini camps, roster, coach login
  04-sessions.js          Session detail modal, summer overview, listeners
  05-voting.js            Voting seasons, grids, credits, notes, utils
  06-admin.js             Vote tally + admin tools (camps, players, sessions, coaches)
  08-init.js              Bootstrap — runs on page load (must load LAST)
  gametracker/            The live game tracker feature
    gt-core.js            GT state + helpers (formatting, lookups, clock math)
    gt-shell.js           Routing, modal, nav, coach lock, landing screen
    gt-roster.js          Roster manager and player add/edit forms
    gt-game.js            Game setup wizard, live game view, clock, event logging
    gt-review.js          Post-game review, season overview, player profiles
firebase.json            Firebase Hosting + Firestore config
firestore.rules          Firestore security rules
firestore.indexes.json   Firestore indexes
```

## How the code is structured

This is a **no-build** project: plain `<script>` tags loaded in order, all
sharing one global scope. There is no bundler, no `import`/`export`, and no npm
install step. Open `soccer-fun-time.html` and it runs.

**Load order matters.** Scripts are listed in `soccer-fun-time.html` in this
order, and it should stay that way:

1. The three Firebase CDN scripts
2. `js/01-core.js` (defines app state and Firebase — must be early)
3. `js/02-auth.js` through `js/06-admin.js`
4. The five `js/gametracker/*.js` files (`gt-core.js` first)
5. `js/08-init.js` — the bootstrap that wires everything up on page load
   (must be **last**, since it calls functions defined in the files above)

Functions are global on purpose: the HTML uses ~170 inline handlers like
`onclick="condJoin()"`, which only work if the functions live in global scope.
Game-tracker functions are all prefixed `gt` to keep their names from colliding
with the rest of the app.

## Where features live

| If you want to change…              | Edit…                          |
| ----------------------------------- | ------------------------------ |
| Login / admin access                | `js/02-auth.js`                |
| Conditioning, camps, roster         | `js/03-conditioning.js`        |
| Session attendance / details        | `js/04-sessions.js`            |
| Tournament voting                   | `js/05-voting.js`              |
| Admin screens                       | `js/06-admin.js`               |
| Live game: setup, clock, events     | `js/gametracker/gt-game.js`    |
| Game stats / season / player pages  | `js/gametracker/gt-review.js`  |
| A shared helper used everywhere      | `js/01-core.js` or `gt-core.js`|

When adding a feature, keep new functions in global scope (no `export`), reuse
the existing `gt`-style prefixing for the game tracker, and add shared helpers
to a `*-core.js` file rather than duplicating them.

## Running locally

Because everything is static, you can open `soccer-fun-time.html` directly, or
serve the folder with any static server, e.g.:

```bash
npx serve .
```

Firebase reads/writes still go to the live project, governed by
`firestore.rules`.

## Deploying

The site deploys via Firebase Hosting. `firebase.json` serves real files first
and falls back to `soccer-fun-time.html` for any other path, so `styles.css`
and the `js/` files are served directly with no config changes needed.

```bash
firebase deploy
```

## Notes

- The Firebase config (`apiKey`, etc.) in `js/01-core.js` is **not** a secret —
  for Firebase web apps it is meant to be public. Real protection comes from
  `firestore.rules`.
- If `js/gametracker/gt-game.js` keeps growing, it splits cleanly into a
  pre-game `gt-setup.js` and a live `gt-live.js`.
