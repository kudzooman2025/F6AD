const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function load(file, context = {}) {
  if (!vm.isContext(context)) vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  return context;
}
function plain(v) { return JSON.parse(JSON.stringify(v)); }

test('all application and maintenance scripts parse', () => {
  for (const dir of ['js', 'scripts']) {
    for (const file of fs.readdirSync(path.join(root, dir), { recursive: true })) {
      if (file.endsWith('.js')) new vm.Script(fs.readFileSync(path.join(root, dir, file), 'utf8'));
    }
  }
  new vm.Script(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'));
});

test('discussion vote payloads cannot produce markup in cards, details or comments', () => {
  const c = load('js/07-discussions.js', {
    localStorage: { getItem: () => null }, discussionComments: [], discReplyOpen: null
  });
  const payload = '<img src=x onerror="globalThis.pwned=1">';
  const post = { id: 'post', title: 'Title', votes: payload };
  c.discussionItems = [post];
  const detail = {};
  c.renderDiscussionDetail(detail, 'post');
  for (const html of [c.discPostCard(post), detail.innerHTML, c.discCommentRow({ id: 'comment', votes: payload }, true, '')]) {
    assert.ok(!html.includes(payload));
    assert.ok(!html.includes('<img'));
  }
  assert.equal(c.discVoteCount(7), 7);
  assert.equal(c.discVoteCount('7'), 0);
});

test('discussion identifiers stay string arguments inside inline handlers', () => {
  const c = load('js/07-discussions.js', { localStorage: { getItem: () => null }, discussionComments: [] });
  const id = '\");globalThis.pwned=1;//\' <img src=x>';
  const encoded = c.discArg(id);
  assert.ok(!encoded.includes('<'));
  assert.ok(!encoded.includes('"'));
  const decoded = encoded.replace(/&(quot|#39|lt|gt|amp);/g, (_, e) => ({ quot: '"', '#39': "'", lt: '<', gt: '>', amp: '&' }[e]));
  let received;
  vm.runInNewContext('capture(' + decoded + ')', { capture: value => { received = value; } });
  assert.equal(received, id);
  assert.ok(!c.discPostCard({ id, title: 'test', votes: 0 }).includes('<img'));
});

function gameContext(side = 'home') {
  const commits = [];
  const game = { id: 'game', f6ad_side: side, current_period: 1 };
  const values = {};
  const c = load('js/gametracker/gt-game.js', {
    GT: { events: [], pendingEvent: null }, gtCanEdit: () => true,
    gtGame: () => game, gtTheirName: () => 'Opponent', gtClockSeconds: () => 120,
    gtEventType: () => ({ label: 'Goal', emoji: '' }), gtPlayerShort: () => 'Player',
    gtNominalToPeriodSec: (_, sec) => ({ period: 1, sec }),
    confirm: () => true, showToast: () => {}, gtCloseModal: () => {},
    document: { getElementById: id => values[id] || { value: '', checked: false } },
    firebase: { firestore: { FieldValue: { serverTimestamp: () => 0, increment: n => ({ increment: n }) } } },
    tdb: name => ({ doc: (id = 'auto') => name + '/' + id }),
    db: { batch: () => {
      const ops = [];
      return {
        set: (ref, data) => ops.push({ kind: 'set', ref, data: plain(data) }),
        update: (ref, data) => ops.push({ kind: 'update', ref, data: plain(data) }),
        delete: ref => ops.push({ kind: 'delete', ref }),
        // Never acknowledge: every assertion below runs while still offline.
        commit: () => { commits.push(ops); return new Promise(() => {}); }
      };
    } }
  });
  return { c, commits, game, values };
}

for (const side of ['home', 'away']) {
  test('offline goal entry points queue event and correct score together: ' + side, () => {
    for (const type of ['goal', 'own_goal', 'opponent_goal', 'opponent_own_goal']) {
      const { c, commits } = gameContext(side);
      if (type === 'opponent_goal') c.gtLogOpponentGoal('game');
      else if (type === 'opponent_own_goal') c.gtLogOwnGoalForUs('game');
      else {
        c.GT.pendingEvent = { gameId: 'game', playerId: 'p', type, clock: 120, period: 1 };
        c.gtSaveLiveEvent();
      }
      assert.equal(commits.length, 1);
      assert.equal(commits[0].length, 2);
      assert.equal(commits[0][0].data.event_type, type);
      const us = type === 'goal' || type === 'opponent_own_goal';
      const field = (us === (side === 'home')) ? 'home_score' : 'away_score';
      assert.deepEqual(commits[0][1], { kind: 'update', ref: 'gt_games/game', data: { [field]: { increment: 1 } } });
    }
  });
}

test('manual goals and assists are included in the same pending commit', () => {
  const { c, commits, values } = gameContext();
  values['gt-add-type'] = { value: 'goal' };
  values['gt-add-time'] = { value: '1:00' };
  values['gt-add-player'] = { value: 'p' };
  c.gtSaveAddEvent('game');
  assert.equal(commits[0].length, 2);
  c.GT.pendingEvent = { gameId: 'game', playerId: 'p', type: 'goal', clock: 120, period: 1 };
  values['gt-assist-pid'] = { value: 'helper' };
  c.gtSaveLiveEvent();
  assert.equal(commits[1].length, 3);
  assert.equal(commits[1][2].data.event_type, 'assist');
});

test('offline deletion and goal-to-own-goal edits update both teams atomically', () => {
  const { c, commits, values } = gameContext();
  c.GT.events = [{ id: 'e', game_id: 'game', event_type: 'goal', player_id: 'p' }];
  c.gtDeleteEvent('e');
  assert.deepEqual(commits[0], [
    { kind: 'delete', ref: 'gt_events/e' },
    { kind: 'update', ref: 'gt_games/game', data: { home_score: { increment: -1 } } }
  ]);
  values['gt-edit-type'] = { value: 'own_goal' };
  values['gt-edit-time'] = { value: '2:00' };
  c.gtSaveEditEvent('e');
  assert.equal(commits[1].length, 2);
  assert.deepEqual(commits[1][1].data, { home_score: { increment: -1 }, away_score: { increment: 1 } });
});

test('outside listeners wait for sign-in and detach and clear data on account changes', () => {
  let attachments = 0, detachments = 0;
  const c = load('js/gametracker/gt-outside.js', {
    authUser: null, GT: { loaded: {}, extGames: [], extEvents: [] },
    gtAttachListeners: defs => { attachments++; return defs.map(() => () => { detachments++; }); }
  });
  c.gtExtListen();
  assert.equal(attachments, 0);
  c.authUser = { uid: 'first' };
  c.gtExtListen(); c.gtExtListen();
  assert.equal(attachments, 1);
  c.GT.extGames = [{ id: 'private' }];
  c.GT.loaded.extGames = true;
  c.authUser = { uid: 'second' };
  c.gtExtListen();
  assert.equal(attachments, 2);
  assert.equal(detachments, 2);
  assert.equal(c.GT.extGames.length, 0);
  assert.equal(c.GT.loaded.extGames, undefined);
  c.authUser = null;
  c.gtExtListen();
  assert.equal(detachments, 4);
  assert.equal(c.GT.listeningExt, false);
});

test('removing a player queues all removed goals and own goals with their records', () => {
  const { c, commits } = gameContext();
  load('js/gametracker/gt-review.js', c);
  c.GT.events = ['goal', 'goal', 'own_goal'].map((event_type, id) => ({ id: String(id), event_type, game_id: 'game', player_id: 'p' }));
  c.GT.subs = [];
  c.gtGameAvail = () => [];
  c.gtPlayerName = () => 'Player';
  c.gtRemovePlayerFromGame('game', 'p');
  assert.equal(commits.length, 1);
  assert.equal(commits[0].filter(op => op.kind === 'delete').length, 3);
  assert.deepEqual(commits[0].filter(op => op.kind === 'update').map(op => op.data), [
    { home_score: { increment: -2 } }, { away_score: { increment: -1 } }
  ]);
});

test('Firebase sign-out resets outside listeners before refreshing the UI', () => {
  let callback;
  const calls = [];
  const c = load('js/02-auth.js', {
    APP_CONFIG: {}, localStorage: { removeItem: () => {} },
    firebase: { auth: () => ({ onAuthStateChanged: cb => { callback = cb; } }) },
    gtExtResetListeners: () => calls.push('reset')
  });
  c.subscribeStaff = () => {};
  c.authRefreshUI = () => calls.push('refresh');
  callback(null);
  assert.deepEqual(calls, ['reset', 'refresh']);
});

test('outside edit controls follow family approval as well as ownership', () => {
  const c = load('js/gametracker/gt-outside.js', {
    authUser: { uid: 'parent' }, gtCanEdit: () => false, familyOwnsPlayer: () => false
  });
  const game = { owner_uid: 'parent', player_id: 'p' };
  assert.equal(c.gtExtCanEdit(game), false);
  c.familyOwnsPlayer = id => id === 'p';
  assert.equal(c.gtExtCanEdit(game), true);
  assert.equal(c.gtExtCanEdit({ owner_uid: 'other', player_id: 'p' }), false);
  c.gtCanEdit = () => true;
  assert.equal(c.gtExtCanEdit({ owner_uid: 'other', player_id: 'p' }), true);
});
