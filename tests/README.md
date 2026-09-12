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
