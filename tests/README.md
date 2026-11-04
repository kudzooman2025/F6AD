Run the application regression checks with Node 22 or later:

```
node --test tests/regression.test.cjs
```

Run the security rules against a local Firestore emulator (requires Java 21):

```
cd tests
npm ci
npm run test:rules
```

The rules tests use the `demo-f6ad` project, seed synthetic records, and refuse
to run without `FIRESTORE_EMULATOR_HOST`. They never use the production database.
Test files and dependencies are excluded from Firebase Hosting.

For a browser check of roster sharing, copying, PDF, and CSV exports, serve the
repository locally and open `/tests/roster-preview.html`. It uses synthetic
game, season, and tournament rosters, with no Firebase connection.

`/tests/rsvp-preview.html` exercises season-game request links and the family
RSVP flow with a selected guest, excluded club players, and a saved removal.
Responses on this preview update only its in-memory sample data.
