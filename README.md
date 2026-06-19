# F6AD — U14 Boys 2026

A single-page web app for managing a youth soccer team: summer conditioning,
mini-camps, player roster, session attendance, voting on tournaments, and a
full live game tracker (**GameTracker**). Data is stored in Firebase
(Firestore + Auth) and the site is served as static files via Firebase Hosting.

## Project layout

```
soccer-fun-time.html     The page: all HTML markup + script/style references
styles.css               All CSS (design tokens are CSS variables in :root)
js/                       Application logic (plain scripts, no build step)
  01-core.js              Firebase init, data constants, app state
  02-auth.js              Sign in / out, staff, admin unlock
  03-conditioning.js      Summer conditioning, mini camps, roster, coach login
  04-sessions.js          Session detail modal, summer overview, listeners
  05-voting.js            Voting seasons, grids, credits, notes, utils
  06-admin.js             Vote tally + admin tools (schedule, venues, camps,
                          players, sessions, coaches)
  08-init.js              Bootstrap — runs on page load (must load LAST)
  gametracker/            The live game tracker feature
    gt-core.js            GT state + helpers: formatting, lookups, clock math,
                          overtime / penalty-shootout / card / result logic
    gt-shell.js           Routing, modal, nav, coach lock, landing screen,
                          Firestore listeners, live/past game lists, status pills
    gt-roster.js          Roster manager, player add/edit forms, guest pool,
                          parent contacts, "Email All Parents"
    gt-game.js            Game setup wizard, live view, clock, event logging,
                          subs, overtime, penalty shootout, opponent goals/cards,
                          in-game chat, game edit/delete
    gt-review.js          Post-game review, season game log, player profiles,
                          sortable stat tables, PDF export
    gt-seasons.js         Season entity: grouped games, per-game availability,
                          record + per-player stats
    gt-tournaments.js     Tournament entity: grouped games, payment, lineup,
                          address fields
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

1. The three Firebase CDN scripts (plus jsPDF for PDF export)
2. `js/01-core.js` (defines app state and Firebase — must be early)
3. `js/02-auth.js` through `js/06-admin.js`
4. The seven `js/gametracker/*.js` files (`gt-core.js` first)
5. `js/08-init.js` — the bootstrap that wires everything up on page load
   (must be **last**, since it calls functions defined in the files above)

Functions are global on purpose: the HTML uses inline handlers like
`onclick="condJoin()"`, which only work if the functions live in global scope.
Game-tracker functions are all prefixed `gt` to keep their names from colliding
with the rest of the app.

## Where features live

| If you want to change…              | Edit…                            |
| ----------------------------------- | -------------------------------- |
| Login / admin access                | `js/02-auth.js`                  |
| Conditioning, camps, roster         | `js/03-conditioning.js`          |
| Session attendance / details        | `js/04-sessions.js`              |
| Tournament voting                   | `js/05-voting.js`                |
| Admin screens (schedule, venues…)   | `js/06-admin.js`                 |
| Colors / fonts / design tokens      | `styles.css` (`:root` variables) |
| Live game: setup, clock, events     | `js/gametracker/gt-game.js`      |
| Overtime / PK / result / card logic | `js/gametracker/gt-core.js`      |
| Game stats / review / player pages  | `js/gametracker/gt-review.js`    |
| Seasons                             | `js/gametracker/gt-seasons.js`   |
| Tournaments                         | `js/gametracker/gt-tournaments.js`|
| Routing, listeners, game lists      | `js/gametracker/gt-shell.js`     |
| A shared helper used everywhere     | `js/01-core.js` or `gt-core.js`  |

When adding a feature, keep new functions in global scope (no `export`), reuse
the existing `gt`-style prefixing for the game tracker, and add shared helpers
to a `*-core.js` file rather than duplicating them.

## GameTracker

GameTracker is the live match module: roster management, real-time game
tracking, post-game review, and season/tournament organization. Coaches and
admins record everything; **anyone can watch live, read-only** (the UI hides
edit controls, and Firestore rules enforce it server-side).

### Who can do what

- **Coaches / admins (signed in):** create and run games, log every stat, edit
  the lineup, run overtime and shootouts, edit/delete events, manage rosters.
- **Parents / public (not signed in):** view every screen live — clock, score,
  events, Starting XI, man-down banner, overtime clock, and the penalty
  shootout — all updating in real time via Firestore listeners. They cannot
  write anything except the in-game chat (which is intentionally open).

### Rosters & players (`gt-roster.js`)

- Multiple rosters; each player has a name, jersey number, position, goalkeeper
  flag, and a **default lineup position** used to pre-fill the starting XI.
- **Guest players:** a reusable guest pool, plus "Make Guest" to convert an
  existing roster player. Guests are tracked and badged like regular players.
- **Parent contacts:** Mom/Guardian and Dad/Guardian name, phone, and email.
  "Email All Parents" opens a pre-addressed (BCC) email. Roster heading shows a
  live player count.
- Delete a roster; player count shown in parentheses.

### Game setup

- A setup wizard captures: our team name (with FC Delco / F6AD override),
  opponent, home/away, game type (league / tournament / friendly), date,
  kickoff time, venue (auto-fills address from the venue database), field
  assignment, number of periods, minutes per period, and players-per-side
  (e.g. 7v7, 9v9, 11v11).
- **Tap-to-set starters:** tap players to toggle them into the starting XI
  (turns green), each using their default position (overridable in-game). The
  lineup **locks at players-per-side** — selecting another shows a "lineup full"
  popup until you remove someone. A persistent **Starting XI** line is shown in
  live and review views.

### Live game (`gt-game.js`)

- **Continuous clock** across periods: the 2nd half resumes at the nominal end
  of the 1st (e.g. 35:00) and counts up, with an extra-time (`+ET`) badge past
  the scheduled period end. Press-and-hold to pause, end a period, or end the
  game (prevents accidental taps).
- **Event logging:** tap a player → choose Goal, Assist, Shot on Target, Shot,
  Save, Tackle, Yellow/Red card, or Highlight (with optional note + YouTube
  link). An **assist auto-snaps to the most recent goal's timestamp** and can't
  be logged without a goal.
- **Opponent events:** "Opponent Goal" and "Opponent Card" buttons. A second
  opponent yellow prompts "same player?" → converts to a red.
- **Substitutions:** individual subs (with position) and **Mass Sub** (N off /
  N on at once); sub positions are editable after the fact; free re-subs.
- **Cards & man-down:** a red card — or a second yellow to the same player —
  shows a "man down" banner for that team (works for both F6AD and the
  opponent), with effective counts.
- **Edit / delete events:** tap any event in the feed to reveal Edit and Delete.
  Editing can change the stat type, player, period, time, and notes; the score
  auto-adjusts when goals are added, removed, or reclassified.
- **In-game chat** (open to anyone) and a **shareable game link** that never
  expires.

### Overtime & penalty shootouts

- When a game is **tied at the final whistle**, a popup offers **Overtime**,
  **Penalty Shootout**, or **End as Tie** (so league games can end drawn).
- **Overtime:** choose the number of periods and minutes each; every OT period
  counts up from 0:00, labeled OT1 / OT2. If it's still tied after OT, the popup
  reappears with PK or tie.
- **Penalty shootout:** choose who shoots first; kicks **strictly alternate**
  (only the team whose turn it is can kick). Our kick = pick the player → Goal /
  Saved / Missed; opponent kick → Goal / Saved / Missed. Each team shows a row
  of markers (green = goal, red ✗ = saved or missed), a per-kick log, and a
  running tally. **Clinch detection** (best-of-5, then sudden death) pops a
  **Win? / Loss?** prompt the moment a result is mathematically decided. Undo
  fixes the last kick. The result reads e.g. `2–2 (4–3 pens)` and counts as a
  Win/Loss in season records.

### Post-game review (`gt-review.js`)

- Final score and result (penalty-aware), a penalties line when applicable, a
  team stat strip, the Starting XI, and an **event timeline** with period
  markers (including OT and shootout).
- Substitution log, a **sortable player stat table** (goals, assists, shots on
  target, shots, cards, saves, tackles, minutes), **PDF export**, copy-to-
  clipboard, and a share link.

### Seasons & tournaments

- **Seasons (`gt-seasons.js`):** group games into a season, set players-per-side,
  track per-game availability (no fees), and view the season record plus
  per-player stats. "Add Game" seeds the setup wizard.
- **Tournaments (`gt-tournaments.js`):** group games, track payment, manage a
  lineup (in/out + paid), add roster players or guests, store address fields,
  and list games sorted by date and time. "Out" players are hidden from
  visitors.

### Site integration

GameTracker games are **automatically merged into the public site Schedule**
(alongside conditioning sessions and mini-camps), sorted by date and time, with
filter chips (All / Games / Practices / Events).

### Privacy note

All GameTracker data is **publicly readable**, including parent contact info on
the roster. This is intentional for the current team setup but worth revisiting
(e.g. first name + last initial) if the site is ever shared more widely.

### Backward compatibility

Helpers default any fields older game records lack (periods → 2×35 min,
players-per-side → 11, `phase` → regulation, `pk_kicks` → empty). Games created
before a feature shipped gain the new behavior automatically when played.

## Data model (Firestore collections)

Site: `schedule`, `announcements`, `conditioning`, `session_log`, `players`,
`staff`, `coaches`, `votes_fall` / `votes_winter` / `votes_spring` /
`votes_summer27`, `venues`.

GameTracker: `gt_rosters`, `gt_players`, `gt_games`, `gt_availability`,
`gt_events`, `gt_subs`, `gt_seasons`, `gt_tournaments`, `gt_chat`.

All collections are **public-read**; writes are restricted to staff/admin by
`firestore.rules`, except `gt_chat` (open read + write) and the voting/
conditioning sign-up collections (open by design for no-login family use).

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
and the `js/` files are served directly with no config changes needed. A
GitHub Action deploys hosting + Firestore rules on push to `main`.

```bash
firebase deploy
```

## Notes

- The Firebase config (`apiKey`, etc.) in `js/01-core.js` is **not** a secret —
  for Firebase web apps it is meant to be public. Real protection comes from
  `firestore.rules`.
- If `js/gametracker/gt-game.js` keeps growing, it splits cleanly into a
  pre-game `gt-setup.js` and a live `gt-live.js`.
