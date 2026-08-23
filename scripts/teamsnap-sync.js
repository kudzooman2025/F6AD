// Pulls the TeamSnap calendar feed (read-only .ics) and syncs it into the
// Firestore `schedule` collection, which the site already renders.
// Auth: the same GCP service account used for deploys. No TeamSnap login needed.
const admin = require('firebase-admin');
const ical = require('node-ical');

const icsUrl = (process.env.TEAMSNAP_ICS_URL || '').trim();
const rawKey = process.env.GCP_SA_KEY || '';

if (!icsUrl) {
  console.log('TEAMSNAP_ICS_URL secret is not set — nothing to sync. (Add it in repo Settings → Secrets.)');
  process.exit(0);
}
if (!rawKey) { console.error('GCP_SA_KEY is missing.'); process.exit(1); }

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(rawKey)) });
const db = admin.firestore();

const pad = n => String(n).padStart(2, '0');
const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeStr = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function classify(summary) {
  const s = String(summary || '').toLowerCase();
  if (/practice|training|session/.test(s)) return 'practice';
  // A head-to-head matchup ("... vs Opponent") is always a game, even when the
  // opponent's name contains tournament-ish words like "Classics" or "Cup".
  if (/\bvs\.?\b/.test(s)) return 'game';
  if (/friendly|scrimmage/.test(s)) return 'friendly';
  // Genuine tournament formats (checked before the looser "at"/"game" test).
  if (/tournament|showcase|invitational|festival|jamboree|kickoff/.test(s)) return 'tournament';
  if (/\bat\b|\bgame\b|\bmatch\b/.test(s)) return 'game';
  if (/classic|\bcup\b/.test(s)) return 'tournament';
  return 'event';
}

(async () => {
  const url = icsUrl.replace(/^webcal:\/\//i, 'https://');
  const data = await ical.async.fromURL(url);

  const cutoff = Date.now() - 30 * 24 * 3600 * 1000; // keep last 30 days + future
  const seen = new Set();
  const batch = db.batch();
  let added = 0, pinned = 0;

  // Existing TeamSnap-sourced docs; any the coach has edited are "pinned" and
  // must not be overwritten or deleted by the sync.
  const existingSnap = await db.collection('schedule').where('source', '==', 'teamsnap').get();
  const existing = {};
  existingSnap.forEach(d => { existing[d.id] = d.data() || {}; });

  for (const key of Object.keys(data)) {
    const ev = data[key];
    if (!ev || ev.type !== 'VEVENT' || !ev.start) continue;
    const start = new Date(ev.start);
    if (isNaN(start.getTime()) || start.getTime() < cutoff) continue;

    const uid = String(ev.uid || key).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);
    const id = 'ts_' + uid;
    seen.add(id);

    if (existing[id] && existing[id].manual_override) { pinned++; continue; }  // keep coach's edits

    batch.set(db.collection('schedule').doc(id), {
      name: String(ev.summary || 'TeamSnap event'),
      date: dateStr(start),
      time: timeStr(start),
      location: String(ev.location || ''),
      type: classify(ev.summary),
      source: 'teamsnap',
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    added++;
  }

  // Drop TeamSnap events that no longer exist in the feed (cancelled/removed),
  // but never delete ones the coach has edited.
  let removed = 0;
  existingSnap.forEach(doc => {
    const d = doc.data() || {};
    if (!seen.has(doc.id) && !d.manual_override) { batch.delete(doc.ref); removed++; }
  });

  await batch.commit();
  console.log(`TeamSnap sync complete — ${added} upserted, ${pinned} pinned (locally edited, left alone), ${removed} stale removed.`);
})().catch(err => { console.error('TeamSnap sync skipped (non-fatal):', (err && err.message) || err); process.exit(0); });
