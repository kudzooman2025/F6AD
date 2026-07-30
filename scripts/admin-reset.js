// One-off admin account recovery via the Firebase Admin SDK.
// Sets (or creates) the password for a given email. The new password is passed in
// via the NEW_PW env var (a workflow_dispatch input) and is never printed to logs.
const admin = require('firebase-admin');

const rawKey = process.env.GCP_SA_KEY;
if (!rawKey) { console.error('Missing GCP_SA_KEY secret.'); process.exit(1); }
let key;
try { key = JSON.parse(rawKey); } catch (e) { console.error('GCP_SA_KEY is not valid JSON.'); process.exit(1); }

admin.initializeApp({ credential: admin.credential.cert(key) });

const email = (process.env.TARGET_EMAIL || '').trim();
const pw = process.env.NEW_PW || '';

(async () => {
  if (!email) { console.error('No target email provided.'); process.exit(1); }
  if (pw.length < 6) { console.error('New password must be at least 6 characters.'); process.exit(1); }

  let user = null;
  try {
    user = await admin.auth().getUserByEmail(email);
    console.log('Found account for ' + email + ' (uid ' + user.uid + '). Updating password + marking email verified...');
    await admin.auth().updateUser(user.uid, { password: pw, emailVerified: true });
    console.log('✅ Password updated and email marked verified. You can now sign in as ' + email + '.');
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      console.log('No account existed for ' + email + ' — creating one now...');
      user = await admin.auth().createUser({ email: email, password: pw, emailVerified: true });
      console.log('✅ Account created (uid ' + user.uid + '). Sign in as ' + email + '.');
      console.log('NOTE: a brand-new account may need to be added to the staff list to get admin rights.');
    } else {
      console.error('❌ Failed:', e.code || '', e.message);
      process.exit(1);
    }
  }

  // Diagnostics: list existing auth accounts (emails only) so we can spot the real admin email if needed.
  try {
    const list = await admin.auth().listUsers(1000);
    console.log('--- All auth accounts (' + list.users.length + ') ---');
    list.users.forEach(function (u) {
      console.log(' • ' + (u.email || '(no email)') + '  ·  providers: ' + (u.providerData.map(function (p) { return p.providerId; }).join(',') || 'password') + '  ·  uid ' + u.uid);
    });
  } catch (e) {
    console.log('(Could not list users for diagnostics: ' + e.message + ')');
  }
})().catch(function (e) { console.error('❌ Unexpected error:', e.message); process.exit(1); });
