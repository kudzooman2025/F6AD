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
  if (/\bvs\.?\b|\bat\b|\bgame\b|\bmatch\b|\bscrimmage\b/.test(s)) return 'game';
  return 'event';
}

(async () => {
  const url = icsUrl.replace(/^webcal:\/\//i, 'https://');
  const data = await ical.async.fromURL(url);

  const cutoff = Date.now() - 30 * 24 * 3600 * 1000; // keep last 30 days + future
  const seen = new Set();
  const batch = db.batch();
  let added = 0;

  for (const key of Object.keys(data)) {
    const ev = data[key];
    if (!ev || ev.type !== 'VEVENT' || !ev.start) continue;
    const start = new Date(ev.start);
    if (isNaN(start.getTime()) || start.getTime() < cutoff) continue;

    const uid = String(ev.uid || key).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);
    const id = 'ts_' + uid;
    seen.add(id);

    batch.set(db.collection('schedule').doc(id), {
      name: String(ev.summary || 'TeamSnap event'),
      date: dateStr(start),
      time: timeStr(start),
      location: String(ev.location || ''),
      type: classify(ev.summary),
      source: 'teamsnap',
      club: 'FC Delco',
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    added++;
  }

  // Drop TeamSnap events that no longer exist in the feed (cancelled/removed).
  const existing = await db.collection('schedule').where('source', '==', 'teamsnap').get();
  let removed = 0;
  existing.forEach(doc => { if (!seen.has(doc.id)) { batch.delete(doc.ref); removed++; } });

  await batch.commit();
  console.log(`TeamSnap sync complete — ${added} event(s) upserted, ${removed} stale removed.`);
})().catch(err => { console.error('TeamSnap sync failed:', err); process.exit(1); });
