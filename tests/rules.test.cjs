const { test, before, after, beforeEach } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, deleteDoc, writeBatch, getDoc, getDocFromCache, disableNetwork, enableNetwork } = require('firebase/firestore');
let env;
const dbFor = uid => uid ? env.authenticatedContext(uid, {
  email: uid + '@example.test', email_verified: true
}).firestore() : env.unauthenticatedContext().firestore();
const evaluation = (type, rater, target) => ({
  period: 'mid', rater_type: type, rater_id: rater, target_player_id: target, ratings: { pace: 70 }
});
const outsideEvent = (game = 'alice-game', owner = 'alice', player = 'p1') => ({
  ext_game_id: game, owner_uid: owner, player_id: player, event_type: 'goal'
});
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run through npm run test:rules; production access is forbidden.');
  env = await initializeTestEnvironment({
    projectId: 'demo-f6ad',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') }
  });
});
after(async () => { if (env) await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const records = {
      'staff/coach': { role: 'coach' },
      'family_links/alice_p1': { uid: 'alice', player_id: 'p1', status: 'approved' },
      'family_links/bob_p2': { uid: 'bob', player_id: 'p2', status: 'approved' },
      'family_links/pending_p1': { uid: 'pending', player_id: 'p1', status: 'pending' },
      'pd_player_links/player_p1': { uid: 'player', player_id: 'p1', status: 'approved' },
      'pd_evals/mid_coach_p1': evaluation('coach', 'coach', 'p1'),
      'pd_evals/mid_coach_p2': evaluation('coach', 'coach', 'p2'),
      'pd_evals/mid_family_alice_p1': evaluation('family', 'alice', 'p1'),
      'pd_evals/mid_peer_p1_p2': evaluation('peer', 'p1', 'p2'),
      'gt_ext_games/alice-game': { owner_uid: 'alice', player_id: 'p1' },
      'gt_ext_games/bob-game': { owner_uid: 'bob', player_id: 'p2' },
      'gt_ext_events/alice-event': outsideEvent(),
      'discussions/post': { title: 'Test', votes: 0 },
      'discussion_comments/comment': { post_id: 'post', text: 'Test', votes: 0 }
    };
    const batch = writeBatch(db);
    for (const [id, data] of Object.entries(records)) batch.set(doc(db, id), data);
    await batch.commit();
  });
});

test('public discussion votes must be integers and new posts start at zero', async () => {
  const db = dbFor(null);
  for (const collection of ['discussions', 'discussion_comments']) {
    const existing = collection + '/' + (collection === 'discussions' ? 'post' : 'comment');
    await assertSucceeds(setDoc(doc(db, collection + '/new'), { votes: 0 }));
    await assertSucceeds(updateDoc(doc(db, existing), { votes: 1 }));
    for (const votes of ['<img src=x onerror=alert(1)>', {}, 1.5]) {
      await assertFails(setDoc(doc(db, collection + '/bad'), { votes }));
      await assertFails(updateDoc(doc(db, existing), { votes }));
    }
    await assertFails(setDoc(doc(db, collection + '/bad'), { votes: 100 }));
    await assertFails(updateDoc(doc(db, existing), { text: 'replacement' }));
  }
});

test('approved families can create and update only their canonical evaluations', async () => {
  const db = dbFor('alice');
  await assertSucceeds(updateDoc(doc(db, 'pd_evals/mid_family_alice_p1'), { ratings: { pace: 80 } }));
  await assertSucceeds(setDoc(doc(db, 'pd_evals/end_family_alice_p1'), { ...evaluation('family', 'alice', 'p1'), period: 'end' }));
  await assertFails(setDoc(doc(db, 'pd_evals/mid_coach_p1'), evaluation('family', 'alice', 'p1')));
  await assertFails(setDoc(doc(db, 'pd_evals/mid_family_bob_p1'), evaluation('family', 'bob', 'p1')));
  await assertFails(setDoc(doc(db, 'pd_evals/mid_family_alice_p2'), evaluation('family', 'alice', 'p2')));
  await assertFails(updateDoc(doc(db, 'pd_evals/mid_family_alice_p1'), { target_player_id: 'p2' }));
  await assertFails(setDoc(doc(dbFor('pending'), 'pd_evals/mid_family_pending_p1'), evaluation('family', 'pending', 'p1')));
});

test('approved players can rate peers but cannot replace coach or other-rater records', async () => {
  const db = dbFor('player');
  await assertSucceeds(updateDoc(doc(db, 'pd_evals/mid_peer_p1_p2'), { ratings: { pace: 80 } }));
  await assertSucceeds(setDoc(doc(db, 'pd_evals/end_peer_p1_p2'), { ...evaluation('peer', 'p1', 'p2'), period: 'end' }));
  await assertFails(setDoc(doc(db, 'pd_evals/mid_coach_p2'), evaluation('peer', 'p1', 'p2')));
  await assertFails(setDoc(doc(db, 'pd_evals/mid_family_alice_p1'), evaluation('peer', 'p1', 'p2')));
  await assertFails(setDoc(doc(db, 'pd_evals/mid_peer_p1_p1'), evaluation('peer', 'p1', 'p1')));
  await assertFails(setDoc(doc(db, 'pd_evals/duplicate'), evaluation('peer', 'p1', 'p2')));
  await assertFails(setDoc(doc(dbFor(null), 'pd_evals/mid_peer_p1_p2'), evaluation('peer', 'p1', 'p2')));
  await assertSucceeds(updateDoc(doc(dbFor('coach'), 'pd_evals/mid_coach_p2'), { ratings: { pace: 85 } }));
});

test('outside game creation requires an approved player link or staff access', async () => {
  await assertSucceeds(setDoc(doc(dbFor('alice'), 'gt_ext_games/new'), { owner_uid: 'alice', player_id: 'p1' }));
  await assertSucceeds(setDoc(doc(dbFor('coach'), 'gt_ext_games/staff'), { owner_uid: 'coach', player_id: 'p2' }));
  for (const uid of ['stranger', 'pending', null]) {
    await assertFails(setDoc(doc(dbFor(uid), 'gt_ext_games/bad'), { owner_uid: uid, player_id: 'p1' }));
  }
  await assertFails(setDoc(doc(dbFor('alice'), 'gt_ext_games/bad'), { owner_uid: 'alice', player_id: 'p2' }));
  await assertFails(setDoc(doc(dbFor('alice'), 'gt_ext_games/bad'), { owner_uid: 'bob', player_id: 'p1' }));
});

test('outside games cannot be transferred to another player or owner', async () => {
  const ref = doc(dbFor('alice'), 'gt_ext_games/alice-game');
  await assertSucceeds(updateDoc(ref, { opponent: 'Other club' }));
  await assertFails(updateDoc(ref, { player_id: 'p2' }));
  await assertFails(updateDoc(ref, { owner_uid: 'bob' }));
  await assertFails(updateDoc(doc(dbFor('bob'), 'gt_ext_games/alice-game'), { opponent: 'Fake' }));
  await assertSucceeds(updateDoc(doc(dbFor('coach'), 'gt_ext_games/alice-game'), { opponent: 'Correction' }));
});

test('outside events must match their game and the caller must manage that game', async () => {
  const db = dbFor('alice');
  await assertSucceeds(setDoc(doc(db, 'gt_ext_events/new'), outsideEvent()));
  await assertSucceeds(setDoc(doc(dbFor('coach'), 'gt_ext_events/staff'), outsideEvent()));
  await assertFails(setDoc(doc(dbFor('bob'), 'gt_ext_events/bad'), outsideEvent()));
  await assertFails(setDoc(doc(db, 'gt_ext_events/bad'), outsideEvent('bob-game', 'alice', 'p2')));
  await assertFails(setDoc(doc(db, 'gt_ext_events/bad'), outsideEvent('alice-game', 'alice', 'p2')));
  await assertFails(setDoc(doc(db, 'gt_ext_events/bad'), outsideEvent('missing')));
  await assertFails(updateDoc(doc(db, 'gt_ext_events/alice-event'), { ext_game_id: 'bob-game' }));
  await assertFails(updateDoc(doc(db, 'gt_ext_events/alice-event'), { owner_uid: 'bob' }));
  await assertFails(updateDoc(doc(db, 'gt_ext_events/alice-event'), { player_id: 'p2' }));
  await assertSucceeds(updateDoc(doc(db, 'gt_ext_events/alice-event'), { notes: 'Correction' }));
});

test('revoking a family link removes outside write access while staff can clean up', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await updateDoc(doc(context.firestore(), 'family_links/alice_p1'), { status: 'pending' });
  });
  const db = dbFor('alice');
  await assertFails(updateDoc(doc(db, 'gt_ext_games/alice-game'), { opponent: 'Fake' }));
  await assertFails(setDoc(doc(db, 'gt_ext_events/new'), outsideEvent()));
  await assertFails(deleteDoc(doc(db, 'gt_ext_events/alice-event')));
  await assertSucceeds(deleteDoc(doc(dbFor('coach'), 'gt_ext_events/alice-event')));
});

test('owners and staff can atomically delete a game and its events', async () => {
  for (const uid of ['alice', 'coach']) {
    if (uid === 'coach') await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'gt_ext_games/alice-game'), { owner_uid: 'alice', player_id: 'p1' });
      await setDoc(doc(context.firestore(), 'gt_ext_events/alice-event'), outsideEvent());
    });
    const db = dbFor(uid), batch = writeBatch(db);
    batch.delete(doc(db, 'gt_ext_events/alice-event'));
    batch.delete(doc(db, 'gt_ext_games/alice-game'));
    await assertSucceeds(batch.commit());
  }
});

test('real SDK queues scores with events offline and applies multiple score corrections', async () => {
  const db = dbFor('coach');
  const game = { id: 'team-game', f6ad_side: 'home', home_score: 0, away_score: 0 };
  await setDoc(doc(db, 'gt_games/team-game'), game);
  const compat = require('firebase/compat/app');
  require('firebase/compat/firestore');
  // Use the SDK's realm: Firestore rejects objects constructed in a vm realm.
  const source = fs.readFileSync(path.join(__dirname, '..', 'js/gametracker/gt-game.js'), 'utf8');
  const c = new Function('db', 'tdb', 'firebase', source + '\nreturn { gtAddScoredEvent, gtQueueEventScore };')(
    db, name => db.collection(name), compat
  );
  await disableNetwork(db);
  const pending = c.gtAddScoredEvent(game, { game_id: game.id, player_id: 'p1', event_type: 'goal' });
  try {
    const local = await getDocFromCache(doc(db, 'gt_games/team-game'));
    assert.equal(local.data().home_score, 1);
  } finally {
    await enableNetwork(db);
  }
  await pending;
  assert.equal((await getDoc(doc(db, 'gt_games/team-game'))).data().home_score, 1);
  const batch = db.batch();
  c.gtQueueEventScore(batch, game, 'goal', null, 1);
  c.gtQueueEventScore(batch, game, null, 'own_goal', 1);
  await batch.commit();
  const result = (await getDoc(doc(db, 'gt_games/team-game'))).data();
  assert.equal(result.home_score, 0);
  assert.equal(result.away_score, 1);
});
