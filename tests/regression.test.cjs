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

test('player-card adjusted times use the full game clock even after the second half', () => {
  const core = load('js/gametracker/gt-core.js');
  for (const [input, period, seconds] of [['36:54', 1, 2214], ['76:54', 2, 2214], ['40:00', 2, 0]]) {
    const { c, commits, values, game } = gameContext();
    Object.assign(game, { status: 'complete', current_period: 2, num_periods: 2, period_duration_minutes: 40 });
    c.gtNominalToPeriodSec = core.gtNominalToPeriodSec;
    c.GT.events = [{ game_id: 'game', event_type: 'goal', period: 1, game_clock_seconds: 2214 }];
    c.GT.pendingEvent = { gameId: 'game', playerId: 'helper', type: 'assist', clock: 0, period: 2 };
    values['gt-ev-override'] = { checked: true };
    values['gt-ev-time'] = { value: input };
    c.gtSaveLiveEvent();
    assert.equal(commits[0][0].data.period, period, input);
    assert.equal(commits[0][0].data.game_clock_seconds, seconds, input);
    assert.equal(commits[0].length, 1);
  }
});

test('unadjusted player-card assists retain automatic matching to the latest goal', () => {
  const { c, commits } = gameContext();
  c.GT.events = [{ game_id: 'game', event_type: 'goal', period: 1, game_clock_seconds: 2214 }];
  c.GT.pendingEvent = { gameId: 'game', playerId: 'helper', type: 'assist', clock: 0, period: 2 };
  c.gtSaveLiveEvent();
  assert.equal(commits[0][0].data.period, 1);
  assert.equal(commits[0][0].data.game_clock_seconds, 2214);
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

function tournamentSquad(lineup, gamePlayers = ['out']) {
  const players = {
    selected: { id: 'selected', name: 'Selected Player', jersey_number: 9, position: 'MID', parent_email: 'private@example.test' },
    guest: { id: 'guest', name: 'Guest Player', jersey_number: 1, is_guest: true },
    out: { id: 'out', name: 'Excluded Player', jersey_number: 4 },
    club: { id: 'club', name: 'Club Only Player', jersey_number: 2 }
  };
  const tournament = { id: 't', name: 'Cup', base_roster_id: 'club' };
  if (lineup !== undefined) tournament.lineup = lineup;
  const c = load('js/gametracker/gt-lineup.js', {
    GT: { loaded: { players: true, tournaments: true, games: true, avail: true, rsvp: true }, tournaments: [tournament], games: [{ id: 'g', tournament_id: 't' }] },
    gtP: id => players[id], gtPlayerName: id => players[id].name,
    gtGameAvail: () => gamePlayers.map(pid => ({ player_id: pid, available: true })), gtEsc: value => String(value || ''),
    gtFmtDate: () => '', gtTheirName: () => 'Opponent', gtGameSortMs: () => 0,
    gtRosterPlayers: () => Object.values(players)
  });
  load('js/gametracker/gt-tournaments.js', c);
  const view = {};
  c.gtRenderLineup(view, 't', 't');
  return view.innerHTML;
}

test('shared tournament squad uses In selections, places guests last and omits contacts', () => {
  const html = tournamentSquad({ selected: { available: true }, guest: { available: true }, out: { available: false } });
  assert.ok(html.includes('2 players'));
  assert.ok(html.indexOf('Selected Player') < html.indexOf('Guest Player'));
  assert.ok(!html.includes('Excluded Player'));
  assert.ok(!html.includes('Club Only Player'));
  assert.ok(!html.includes('private@example.test'));
});

test('empty, all-Out and deleted-player tournament lineups never restore game players', () => {
  for (const lineup of [{}, { out: { available: false } }, { deleted: { available: true } }]) {
    const html = tournamentSquad(lineup);
    assert.ok(html.includes('0 players'));
    assert.ok(html.includes('No squad set yet.'));
    assert.ok(!html.includes('Excluded Player'));
    assert.ok(!html.includes('Club Only Player'));
  }
});

test('legacy tournaments use deduplicated game players and never the whole club roster', () => {
  const html = tournamentSquad(undefined, ['selected', 'selected', 'guest']);
  assert.ok(html.includes('2 players'));
  assert.ok(html.includes('Selected Player'));
  assert.ok(html.includes('Guest Player'));
  assert.ok(!html.includes('Club Only Player'));
  assert.ok(tournamentSquad(undefined, []).includes('0 players'));
});

test('halftime starter reset records substitutions without starting or resetting the clock', () => {
  const { c, commits, game } = gameContext();
  Object.assign(game, { status: 'between_periods', current_period: 2, clock_elapsed_seconds: 0, clock_started_at: null, period_elapsed: { 1: 2140 } });
  const before = plain(game);
  c.gtKickoffOn = () => ({ starter: true, sentOff: true, substitute: false });
  c.gtOnField = () => ({ starter: false, sentOff: false, substitute: true });
  c.gtPlayerRedInfo = (_, pid) => pid === 'sentOff';
  c.gtGameAvailEntry = () => ({ start_position: 'CM' });
  c.gtResetToStarters('game');
  assert.equal(commits.length, 1);
  assert.deepEqual(commits[0], [{ kind: 'set', ref: 'gt_subs/auto', data: {
    game_id: 'game', player_out_id: 'substitute', player_in_id: 'starter',
    position: 'CM', game_clock_seconds: 0, period: 2, created_at: 0
  } }]);
  assert.deepEqual(game, before);

  // Repeating the reset after the roster updates should create no extra subs.
  c.gtOnField = () => ({ starter: true, sentOff: false, substitute: false });
  c.gtResetToStarters('game');
  assert.equal(commits.length, 1);
});

test('starter reset cannot alter a running game or be used by a spectator', () => {
  const { c, commits, game } = gameContext();
  game.status = 'in_progress';
  c.gtResetToStarters('game');
  assert.equal(commits.length, 0);
  game.status = 'between_periods';
  c.gtCanEdit = () => false;
  c.gtResetToStarters('game');
  assert.equal(commits.length, 0);
});

test('the separate Start action still starts the next period clock', () => {
  const { c } = gameContext();
  const updates = [];
  c.gtGameUpdate = (gid, data) => updates.push({ gid, data: plain(data) });
  c.gtStartNextPeriod('game');
  assert.deepEqual(updates, [{ gid: 'game', data: {
    status: 'in_progress', clock_elapsed_seconds: 0, clock_started_at: 0
  } }]);
});

function swapContext() {
  const c = load('js/gametracker/gt-game.js');
  load('js/gametracker/gt-lineup.js', c);
  const fixture = require('./live-fixture.js')(c);
  c.gtRerender();
  return { c, fixture };
}

test('player cards show readable playing time for starters and bench players', () => {
  const { fixture } = swapContext();
  assert.match(fixture.view.innerHTML, /data-gt-player-minutes="alex">35:00 played/);
  assert.match(fixture.view.innerHTML, /data-gt-player-minutes="chris">0:00 played/);
});

test('card minutes tick on field, freeze on bench and at breaks, and recalculate after Undo', () => {
  const c = load('js/gametracker/gt-core.js');
  load('js/gametracker/gt-game.js', c);
  const start = Date.UTC(2026, 8, 14, 12);
  let now = start + 600000;
  c.gtServerNow = () => now;
  const game = { id: 'game', status: 'in_progress', current_period: 1, num_periods: 2, period_duration_minutes: 40, clock_elapsed_seconds: 0, clock_started_at: start };
  c.GT.games = [game];
  c.GT.avail = ['starter', 'bench'].map((id, i) => ({ game_id: 'game', player_id: id, available: true, started: i === 0 }));
  const nodes = ['starter', 'bench'].map(id => ({ textContent: '', getAttribute: () => id }));
  const view = { querySelectorAll: () => nodes };
  const tick = () => { c.gtUpdatePlayerMinutes(view, 'game'); return nodes.map(n => n.textContent); };
  assert.deepEqual(tick(), ['10:00 played', '0:00 played']);
  c.GT.subs = [{ id: 'sub', game_id: 'game', period: 1, game_clock_seconds: 600, player_out_id: 'starter', player_in_id: 'bench' }];
  now += 300000;
  assert.deepEqual(tick(), ['10:00 played', '5:00 played']);
  game.status = 'paused'; game.clock_elapsed_seconds = 900; game.clock_started_at = null;
  now += 120000;
  assert.deepEqual(tick(), ['10:00 played', '5:00 played']);
  game.status = 'in_progress'; game.clock_started_at = now;
  now += 60000;
  assert.deepEqual(tick(), ['10:00 played', '6:00 played']);
  game.status = 'between_periods'; game.current_period = 2; game.period_elapsed = { 1: 960 }; game.clock_elapsed_seconds = 0; game.clock_started_at = null;
  now += 600000;
  assert.deepEqual(tick(), ['10:00 played', '6:00 played']);
  c.GT.subs = [];
  assert.deepEqual(tick(), ['16:00 played', '0:00 played']);
});

function shortElevenContext() {
  const ctx = swapContext(), { c, fixture } = ctx;
  fixture.game.players_per_side = 11;
  for (let i = 0; i < 6; i++) {
    const id = 'extra-' + i;
    fixture.players.push({ id, name: 'Extra Player ' + i });
    c.gtGameAvail().push({ player_id: id, available: true, started: true });
  }
  return ctx;
}

test('halftime corrections replay in entry order and preserve eleven players and minutes', () => {
  const c = load('js/gametracker/gt-core.js');
  c.GT.games = [{ id: 'game', period_duration_minutes: 40, num_periods: 2 }];
  c.GT.avail = Array.from({ length: 15 }, (_, i) => ({ game_id: 'game', player_id: 'p' + i, available: true, started: i < 11 }));
  // Document IDs put the later corrections first, like the Sporting records.
  c.GT.subs = [
    { id: 'a', game_id: 'game', period: 2, game_clock_seconds: 0, player_out_id: 'p2', player_in_id: 'p0', created_at: '2026-09-13T16:04:00Z' },
    { id: 'b', game_id: 'game', period: 2, game_clock_seconds: 0, player_out_id: 'p3', player_in_id: 'p1', created_at: '2026-09-13T16:04:01Z' },
    { id: 'y', game_id: 'game', period: 2, game_clock_seconds: 0, player_out_id: 'p0', player_in_id: 'p11', created_at: '2026-09-13T16:00:00Z' },
    { id: 'z', game_id: 'game', period: 2, game_clock_seconds: 0, player_out_id: 'p1', player_in_id: 'p12', created_at: '2026-09-13T16:00:00Z' }
  ];
  c.gtTotalSeconds = () => 4800;
  assert.equal(Object.values(c.gtOnField('game')).filter(Boolean).length, 11);
  assert.equal(c.gtOnField('game').p0, true);
  assert.equal(c.gtOnField('game').p1, true);
  assert.equal(c.gtOnField('game').p2, false);
  const minutes = c.gtMinutesMap('game');
  assert.equal(minutes.p0, 4800);
  assert.equal(minutes.p2, 2400);
  assert.equal(minutes.p11, 2400);
});

test('nine-player halftime lineup can reach eleven with standalone additions and Undo', () => {
  const { c, fixture } = shortElevenContext();
  fixture.offline = true;
  c.gtTapSwap('demo', 'chris');
  assert.match(fixture.view.innerHTML, /Bring on/);
  c.gtTapSwap('demo', 'chris', true);
  assert.equal(c.GT.subs[0].player_out_id, null);
  c.gtTapSwap('demo', 'max'); c.gtTapSwap('demo', 'max', true);
  assert.equal(Object.values(c.gtOnField('demo')).filter(Boolean).length, 11);
  c.gtTapSwap('demo', 'leo', true);
  assert.equal(c.GT.subs.length, 2);
  c.gtPlayerRedInfo = (_, pid) => pid === null ? { t: 0 } : null;
  c.gtUndoSwap('demo');
  assert.equal(Object.values(c.gtOnField('demo')).filter(Boolean).length, 10);
  assert.equal(fixture.game.status, 'between_periods');
  assert.equal(fixture.game.current_period, 2);
});

function massContext() {
  const ctx = shortElevenContext(), { c, fixture } = ctx;
  const body = { innerHTML: '' }, classes = { add: () => {} };
  c.document.getElementById = id => id === 'gt-ms-body' ? body : ['gt-modal-overlay', 'gt-modal'].includes(id) ? { classList: classes } : null;
  c.gtOpenModal = () => {};
  c.gtCloseModal = () => { c.GT.massSel = null; };
  c.db = { batch: () => {
    const records = [];
    return { set: (ref, data) => records.push({ id: ref.id, ...data }), commit: () => {
      fixture.writes.push(records);
      c.GT.subs.push(...records);
      return Promise.resolve();
    } };
  } };
  c.gtOpenMassSub('demo');
  return { ...ctx, selection: c.GT.massSel, body };
}

test('Mass Subs pairs taps in selection order without duplicate choices or required positions', () => {
  const { c, fixture, selection, body } = massContext();
  c.gtMassSubTap('on', 'chris');
  c.gtMassSubTap('on', 'chris');
  assert.deepEqual(plain(selection.on), []);
  c.gtMassSubTap('on', 'max'); c.gtMassSubTap('on', 'chris');
  c.gtMassSubTap('off', 'sam'); c.gtMassSubTap('off', 'alex');
  assert.match(body.innerHTML, /Max for Samuel.*Christopher for Alexander/);
  assert.match(body.innerHTML, /Submit 2 subs/);
  assert.equal((body.innerHTML.match(/aria-pressed="true"/g) || []).length, 4);
  c.gtSaveMassSub();
  assert.equal(fixture.writes.length, 1);
  assert.equal(c.GT.subs.length, 2);
  assert.deepEqual(plain(c.GT.subs.map(s => [s.player_in_id, s.player_out_id])), [['max', 'sam'], ['chris', 'alex']]);
  assert.ok(c.GT.subs.every(s => s.position === ''));
  assert.equal(Object.values(c.gtOnField('demo')).filter(Boolean).length, 9);
  assert.equal(fixture.game.status, 'between_periods');
  assert.equal(c.GT.massSel, null);
});

test('Mass Subs writes each paired substitution in one atomic batch with a shared clock', () => {
  const { c, fixture, selection } = massContext();
  fixture.game.status = 'in_progress';
  let ticks = 125;
  c.gtClockSeconds = () => ticks++;
  selection.off = ['alex', 'sam', 'jordan']; selection.on = ['chris', 'max', 'leo'];
  c.gtSaveMassSub();
  assert.equal(fixture.writes.length, 1);
  assert.equal(fixture.writes[0].length, 3);
  assert.ok(c.GT.subs.every(s => s.game_clock_seconds === 125 && s.period === 2 && s.created_at === 1));
  assert.equal(ticks, 126);
  assert.equal(Object.values(c.gtOnField('demo')).filter(Boolean).length, 9);
  assert.equal(c.gtOnField('demo').alex, false);
});

test('Mass Subs rejects stale, unavailable, unpaired and sent-off choices or a changed period', () => {
  for (const scenario of ['empty', 'stale-off', 'stale-on', 'unavailable', 'unpaired', 'red', 'period', 'spectator', 'shootout', 'complete']) {
    const { c, fixture, selection } = massContext();
    selection.on = ['chris']; selection.off = ['alex'];
    if (scenario === 'empty') { selection.on = []; selection.off = []; }
    if (scenario === 'stale-off') selection.off = ['max'];
    if (scenario === 'stale-on') selection.on = ['sam'];
    if (scenario === 'unavailable') selection.on = ['unknown'];
    if (scenario === 'unpaired') selection.on = ['chris', 'max'];
    if (scenario === 'red') c.gtPlayerRedInfo = (_, pid) => pid === 'chris' ? { t: 0 } : null;
    if (scenario === 'period') fixture.game.current_period = 3;
    if (scenario === 'spectator') c.gtCanEdit = () => false;
    if (scenario === 'shootout') c.gtIsPK = () => true;
    if (scenario === 'complete') fixture.game.status = 'complete';
    c.gtSaveMassSub();
    assert.equal(fixture.writes.length, 0, scenario);
  }
});

test('pending Mass Sub blocks duplicate saves and quick additions until local lineup arrives', () => {
  const { c, fixture, selection } = massContext();
  const queued = [];
  c.db = { batch: () => ({ set: (ref, data) => queued.push({ id: ref.id, ...data }), commit: () => new Promise(() => {}) }) };
  selection.on = ['chris', 'max']; selection.off = ['alex', 'sam'];
  c.gtSaveMassSub();
  c.GT.massSel = selection;
  c.gtSaveMassSub();
  c.gtTapSwap('demo', 'leo', true);
  assert.equal(queued.length, 2);
  assert.equal(fixture.writes.length, 0);
  c.GT.subs.push(...queued);
  assert.equal(c.gtSwapPending('demo'), false);
  assert.equal(Object.values(c.gtOnField('demo')).filter(Boolean).length, 9);
  assert.equal(c.gtOnField('demo').chris, true);
  assert.equal(c.gtOnField('demo').alex, false);
});

test('failed Mass Sub clears pending state and preserves the existing lineup', async () => {
  const { c, fixture, selection } = massContext();
  c.db = { batch: () => ({ set: () => {}, commit: () => Promise.reject(new Error('Test failure')) }) };
  selection.on = ['chris', 'max']; selection.off = ['alex', 'sam'];
  c.gtSaveMassSub();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.gtSwapPending('demo'), false);
  assert.equal(Object.values(c.gtOnField('demo')).filter(Boolean).length, 9);
  assert.ok(fixture.messages.some(message => message.includes('Substitutions failed')));
});
test('live cards show full names in current On field / Bench groups without positions', () => {
  const { c, fixture } = swapContext();
  c.GT.subs.push({ id: 'earlier', game_id: 'demo', player_in_id: 'chris', player_out_id: 'alex' });
  c.gtRerender();
  const html = fixture.view.innerHTML;
  const split = html.indexOf('🪑 Bench');
  assert.ok(html.slice(0, split).includes('Christopher Bennett'));
  assert.ok(html.slice(split).includes('Alexander Robinson'));
  assert.ok(html.includes('ON FIELD'));
  assert.ok(html.includes('BENCH'));
});
test('two taps create one paired substitution and Undo restores the lineup offline', () => {
  const { c, fixture } = swapContext();
  fixture.offline = true;
  c.gtTapSwap('demo', 'alex');
  assert.equal(fixture.writes.length, 0);
  c.gtTapSwap('demo', 'chris');
  assert.equal(fixture.writes.length, 1);
  assert.equal(c.gtOnField('demo').alex, false);
  assert.equal(c.gtOnField('demo').chris, true);
  assert.equal(fixture.game.status, 'between_periods');
  assert.ok(fixture.view.innerHTML.includes('Undo substitution'));
  c.gtUndoSwap('demo');
  assert.equal(c.gtOnField('demo').alex, true);
  assert.equal(c.gtOnField('demo').chris, false);
  assert.equal(c.GT.subs.length, 0);
});
test('swap selection can cancel, switch players and start from the bench', () => {
  const { c, fixture } = swapContext();
  c.gtTapSwap('demo', 'alex'); c.gtTapSwap('demo', 'alex');
  assert.equal(c.GT.swapSelection, null);
  c.gtTapSwap('demo', 'chris'); c.gtTapSwap('demo', 'max');
  assert.equal(fixture.writes.length, 0);
  c.gtTapSwap('demo', 'jordan');
  assert.equal(c.GT.subs[0].player_out_id, 'jordan');
  assert.equal(c.GT.subs[0].player_in_id, 'max');
});
test('stale selections, sent-off players and spectators cannot cause a swap', () => {
  const { c, fixture } = swapContext();
  c.gtTapSwap('demo', 'alex');
  fixture.game.current_period = 3;
  c.gtTapSwap('demo', 'chris');
  assert.equal(fixture.writes.length, 0);
  c.gtPlayerRedInfo = (_, pid) => pid === 'alex' ? {} : null;
  c.gtTapSwap('demo', 'alex');
  assert.equal(fixture.writes.length, 0);
  c.gtCanEdit = () => false;
  c.gtTapSwap('demo', 'jordan');
  assert.equal(fixture.writes.length, 0);
});
test('Undo refuses to rewrite a later substitution involving the same players', () => {
  const { c, fixture } = swapContext();
  c.gtTapSwap('demo', 'alex'); c.gtTapSwap('demo', 'chris');
  c.GT.subs.push({ id: 'later', game_id: 'demo', player_in_id: 'max', player_out_id: 'chris' });
  c.gtUndoSwap('demo');
  assert.equal(c.GT.subs.length, 2);
  assert.ok(fixture.messages.some(message => message.includes('lineup has changed')));
});

test('Undo reports the actual players restored for swaps and standalone additions', async () => {
  const { c, fixture } = swapContext();
  c.gtTapSwap('demo', 'alex'); c.gtTapSwap('demo', 'chris');
  c.gtUndoSwap('demo');
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(fixture.view.innerHTML.includes('Substitution undone: Alexander Robinson back on the field; Christopher Bennett back on the bench.'));
  const addition = shortElevenContext();
  addition.c.gtTapSwap('demo', 'chris', true);
  addition.c.gtUndoSwap('demo');
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(addition.fixture.view.innerHTML.includes('Substitution undone: Christopher Bennett back on the bench.'));
});

test('Undo details remain through rerenders and new selections until dismissed, including offline', async () => {
  const { c, fixture } = swapContext();
  fixture.offline = true;
  c.gtTapSwap('demo', 'alex'); c.gtTapSwap('demo', 'chris'); c.gtUndoSwap('demo');
  const noticeId = c.GT.undoNotices[0].id;
  assert.match(fixture.view.innerHTML, /Substitution undone: Alexander/);
  c.gtRerender(); c.gtTapSwap('demo', 'jordan');
  assert.match(fixture.view.innerHTML, /Substitution undone: Alexander/);
  assert.equal(c.gtUndoNoticesHtml('another-game'), '');
  c.gtDismissUndoNotice(noticeId);
  c.gtRerender();
  assert.doesNotMatch(fixture.view.innerHTML, /Substitution undone:/);
  assert.equal(c.gtOnField('demo').alex, true);
  assert.equal(c.gtOnField('demo').chris, false);
});

test('failed Undo removes its success details and retains the saved substitution', async () => {
  const { c, fixture } = swapContext();
  c.gtTapSwap('demo', 'alex'); c.gtTapSwap('demo', 'chris');
  await new Promise(resolve => setImmediate(resolve));
  c.tdb = () => ({ doc: () => ({ delete: () => Promise.reject(new Error('Test failure')) }) });
  c.gtUndoSwap('demo');
  await new Promise(resolve => setImmediate(resolve));
  assert.doesNotMatch(fixture.view.innerHTML, /Substitution undone:/);
  assert.equal(c.GT.undoNotices.length, 0);
  assert.equal(c.GT.subs.length, 1);
  assert.ok(fixture.messages.includes('Could not undo: Test failure'));
});
test('a failed swap clears its selection and Undo state', async () => {
  const { c, fixture } = swapContext();
  fixture.failWrite = true;
  c.gtTapSwap('demo', 'alex'); c.gtTapSwap('demo', 'chris');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.GT.swapPending, null);
  assert.equal(c.GT.lastSwap, null);
  assert.equal(c.GT.subs.length, 0);
});

// ---- Team (non-soccer) events ----
function loadAdmin(extra = {}) {
  const els = {};
  const document = { getElementById: id => els[id] || null, querySelectorAll: () => [], querySelector: () => null, addEventListener() {} };
  const c = load('js/06-admin.js', Object.assign({ document, window: {}, localStorage: { getItem: () => null },
    gtEsc: s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
    schedHidden: () => false, canceledEvents: {}, scheduleItems: [] }, extra));
  return { c, els };
}

test('team event time ranges and RSVP ids', () => {
  const { c } = loadAdmin();
  assert.equal(c.schedTimeRange('18:00', '21:30'), '6:00 PM–9:30 PM');
  assert.equal(c.schedTimeRange('09:15', ''), '9:15 AM');
  assert.equal(c.schedTimeRange('', ''), '');
  assert.equal(c.schedEventRsvpId({ id: 'a1', type: 'event' }), 'ev_a1');
  assert.equal(c.schedEventRsvpId({ id: 'a1', type: 'event', rsvp: false }), '');
  assert.equal(c.schedEventRsvpId({ id: 'a1', type: 'game' }), '');
});

test('home team events list upcoming events only and escape their text', () => {
  const box = { innerHTML: '' }, sec = { style: {} };
  const { c, els } = loadAdmin();
  els['home-events'] = sec; els['home-events-list'] = box;
  const payload = '<img src=x onerror="globalThis.pwned=1">';
  c.scheduleItems = [
    { id: 'past', type: 'event', name: 'Old', date: '2000-01-01' },
    { id: 'game', type: 'game', name: 'Match', date: '2099-01-01' },
    { id: 'e1', type: 'event', name: payload, location: payload, date: '2099-10-17' }
  ];
  c.renderHomeEvents();
  assert.equal(sec.style.display, '');
  assert.ok(!box.innerHTML.includes('<img'));
  assert.ok(box.innerHTML.includes('#/gametracker/rsvp/ev_e1'));
  assert.ok(!box.innerHTML.includes('Old') && !box.innerHTML.includes('Match'));
  c.scheduleItems = [];
  c.renderHomeEvents();
  assert.equal(sec.style.display, 'none');
});

test('team event headcount counts In families only, defaulting to one person', () => {
  const c = load('js/gametracker/gt-core.js', { localStorage: { getItem: () => null }, window: {}, document: { addEventListener() {} } });
  c.GT.rsvp = [
    { game_id: 'ev_1', status: 'in', count: 4 },
    { game_id: 'ev_1', status: 'in' },
    { game_id: 'ev_1', status: 'maybe', count: 3 },
    { game_id: 'ev_1', status: 'in', count: 2, hidden: true },
    { game_id: 'ev_2', status: 'in', count: 9 }
  ];
  assert.equal(c.gtRsvpHeadcount('ev_1'), 5);
});

// ---- Season roster (committed players) ----
function loadGt() {
  const ctx = { localStorage: { getItem: () => null, setItem() {} }, window: {}, document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [] },
    appTeamName: () => 'Team', appGameDefaults: () => ({ num_periods: 2, period_duration_minutes: 30, players_per_side: 7 }), gtCanEdit: () => true, gtGo() {}, showToast() {} };
  load('js/gametracker/gt-core.js', ctx);
  load('js/gametracker/gt-game.js', ctx);
  load('js/gametracker/gt-seasons.js', ctx);
  ctx.gtCanEdit = () => true; ctx.gtGo = () => {};
  ctx.GT.rosters = [{ id: 'r1', name: 'Squad' }];
  ctx.GT.players = [
    { id: 'a', roster_id: 'r1', first_name: 'Al', last_name: 'A' },
    { id: 'b', roster_id: 'r1', first_name: 'Bo', last_name: 'B' },
    { id: 'c', roster_id: 'r1', first_name: 'Cy', last_name: 'C' },
    { id: 'g', roster_id: '__guests__', first_name: 'Gus', last_name: 'G', is_guest: true }
  ];
  return ctx;
}

test('season games start with committed players available and others Out', () => {
  const c = loadGt();
  c.GT.seasons = [{ id: 's7', name: '7v7', base_roster_id: 'r1', roster: { a: true, g: true } }];
  c.gtStartSeasonGame('s7');
  assert.deepEqual(plain(c.GT.setup.avail), { a: true, b: false, c: false });
  assert.deepEqual(plain(c.GT.setup.guestIds), { g: true });
});

test('seasons without a roster keep the whole squad', () => {
  const c = loadGt();
  c.GT.seasons = [{ id: 'mls', name: 'MLS', base_roster_id: 'r1' }];
  c.gtStartSeasonGame('mls');
  assert.deepEqual(plain(c.GT.setup.avail), {});
  c.GT.games = [{ id: 'g1', season_id: 'mls', roster_id: 'r1' }];
  assert.deepEqual(c.gtRsvpPlayersFor('r1', 'g1').map(p => p.id), ['a', 'b', 'c']);
});

test('season game RSVP lists committed players plus anyone a coach added', () => {
  const c = loadGt();
  c.GT.seasons = [{ id: 's7', name: '7v7', base_roster_id: 'r1', roster: { a: true, g: true } }];
  c.GT.games = [{ id: 'g1', season_id: 's7', roster_id: 'r1' }];
  assert.deepEqual(c.gtRsvpPlayersFor('r1', 'g1').map(p => p.id), ['a', 'g']);
  c.GT.rsvp = [{ game_id: 'g1', player_id: 'c', hidden: false, status: 'in' }];
  assert.deepEqual(c.gtRsvpPlayersFor('r1', 'g1').map(p => p.id), ['a', 'c', 'g']);
});


// Roster exports must match the selected scope, even after removals.
function lineupContext() {
  const c = loadGt();
  load('js/gametracker/gt-tournaments.js', c);
  load('js/gametracker/gt-lineup.js', c);
  c.GT.loaded = { players: true, games: true, seasons: true, tournaments: true, avail: true, rsvp: true };
  c.GT.players[0].jersey_number = 0;
  c.GT.players[0].parent_email = 'private@example.test';
  c.GT.players[3].jersey_number = 7;
  c.GT.games = [{ id: 'game', game_type: 'league', home_team: 'Our Team', away_team: 'Rivals', f6ad_side: 'home', roster_id: 'r1' }];
  c.GT.avail = ['a', 'b', 'g'].map(pid => ({ game_id: 'game', player_id: pid, available: true }));
  return c;
}

test('game roster excludes scratched, deleted and RSVP-removed regular players and guests for every game type', () => {
  for (const type of ['league', 'tournament', 'friendly']) {
    const c = lineupContext();
    c.GT.games[0].game_type = type;
    c.GT.avail.push({ game_id: 'other', player_id: 'c', available: true });
    c.GT.rsvp = [{ game_id: 'game', player_id: 'b', hidden: true }];
    assert.deepEqual(plain(c.gtLineupData('g', 'game').players.map(p => p.id)), ['a', 'g']);
    c.GT.rsvp.push({ game_id: 'game', player_id: 'g', hidden: true });
    assert.deepEqual(plain(c.gtLineupData('g', 'game').players.map(p => p.id)), ['a']);
    c.GT.avail[0].available = false;
    assert.equal(c.gtLineupData('g', 'game').players.length, 0);
    c.GT.avail = [];
    assert.equal(c.gtLineupData('g', 'game').players.length, 0);
  }
});

test('season and league exports include committed guests and never restore removed players or an empty roster', () => {
  const c = lineupContext();
  c.GT.seasons = [{ id: 's', name: 'League Season', base_roster_id: 'r1', roster: { a: true, b: false, g: true, deleted: true } }];
  assert.deepEqual(plain(c.gtLineupData('s', 's').players.map(p => p.id)), ['a', 'g']);
  delete c.GT.seasons[0].roster.g;
  assert.deepEqual(plain(c.gtLineupData('s', 's').players.map(p => p.id)), ['a']);
  c.GT.seasons[0].roster = {};
  assert.equal(c.gtLineupData('s', 's').players.length, 0);
  delete c.GT.seasons[0].roster;
  assert.deepEqual(plain(c.gtLineupData('s', 's').players.map(p => p.id)), ['a', 'b', 'c']);
  c.window.location = { origin: 'https://team.test', pathname: '/' };
  assert.equal(c.gtLineupUrl('s', 's'), 'https://team.test/#/gametracker/lineup/s/s');
});

test('new tournament games keep removed regular players Out and include only selected guests', () => {
  const c = lineupContext();
  c.GT.tournaments = [{ id: 't', base_roster_id: 'r1', lineup: { a: { available: true }, b: { available: false }, g: { available: true } } }];
  c.gtStartTournamentGame('t');
  assert.deepEqual(plain(c.GT.setup.avail), { a: true, b: false, c: false });
  assert.deepEqual(plain(c.GT.setup.guestIds), { g: true });
  c.GT.tournaments[0].lineup = {};
  c.gtStartTournamentGame('t');
  assert.deepEqual(plain(c.GT.setup.avail), { a: false, b: false, c: false });
  assert.deepEqual(plain(c.GT.setup.guestIds), {});
});

test('copy and PDF export contain the same scope-specific players without contact details', async () => {
  const c = lineupContext();
  c.GT.seasons = [{ id: 's', name: 'League Season', roster: { a: true, g: true } }];
  c.GT.tournaments = [{ id: 't', name: 'Cup', lineup: { a: { available: true }, g: { available: true }, b: { available: false } } }];
  c.GT.rsvp = [{ game_id: 'game', player_id: 'b', hidden: true }];
  let copied, table, filename;
  c.navigator = { clipboard: { writeText: async text => { copied = text; } } };
  c.window.jspdf = { jsPDF: function() {
    return { setFont() {}, setFontSize() {}, text() {}, splitTextToSize: text => [text],
      autoTable: opts => { table = opts; }, save: name => { filename = name; } };
  } };
  for (const [kind, id] of [['g', 'game'], ['s', 's'], ['t', 't']]) {
    await c.gtCopyLineup(kind, id);
    assert.match(copied, /#0 Al A/);
    assert.match(copied, /#7 Gus G \(Guest\)/);
    assert.doesNotMatch(copied, /Bo B|Cy C|private@example/);
    c.gtExportLineup(kind, id);
    assert.deepEqual(plain(table.body), [['0', 'Al A', ''], ['7', 'Gus G', 'Guest']]);
    assert.match(filename, /_roster\.pdf$/);
    const view = {};
    c.gtRenderLineup(view, kind, id);
    assert.match(view.innerHTML, /Copy Roster/);
    assert.match(view.innerHTML, /Export Roster PDF/);
    assert.doesNotMatch(view.innerHTML, /Bo B|Cy C|private@example/);
  }
});

test('copy fallback selects a readable multiline roster when clipboard is unavailable or denied', async () => {
  const c = lineupContext();
  let modal, selected = 0;
  c.gtOpenModal = html => { modal = html; };
  c.document.getElementById = () => ({ focus() {}, select() { selected++; } });
  for (const navigator of [{}, { clipboard: { writeText: () => Promise.reject(new Error('denied')) } }]) {
    c.navigator = navigator;
    await c.gtCopyLineup('g', 'game');
    assert.match(modal, /textarea/);
    assert.match(modal, /Al A/);
    assert.match(modal, /Gus G/);
  }
  assert.equal(selected, 2);
});

test('roster exports wait for player and removal data instead of publishing a partial list', async () => {
  const c = lineupContext();
  let copied = false, notice;
  c.navigator = { clipboard: { writeText: async () => { copied = true; } } };
  c.showToast = text => { notice = text; };
  delete c.GT.loaded.rsvp;
  await c.gtCopyLineup('g', 'game');
  c.gtExportLineup('g', 'game');
  assert.equal(copied, false);
  assert.match(notice, /loading/);
  const view = {};
  c.gtRenderLineup(view, 'g', 'game');
  assert.match(view.innerHTML, /Loading roster/);
});


test('spreadsheet exports match the roster and safely quote names, Unicode and formula-like values', () => {
  const c = lineupContext();
  c.GT.rsvp = [{ game_id: 'game', player_id: 'b', hidden: true }];
  c.GT.players[0].first_name = 'Alex, "Álex"';
  c.GT.players[3].first_name = '=HYPERLINK("bad")';
  const csv = c.gtLineupCsv(c.gtLineupData('g', 'game'));
  assert.ok(csv.startsWith('\uFEFF"Roster","Details","Jersey number","Player","Guest"\r\n'));
  assert.ok(csv.includes('"Alex, ""Álex"" A"'));
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"") G"'));
  assert.doesNotMatch(csv, /Bo B|Cy C|private@example/);
  assert.equal(csv.split('\r\n').length, 4);
  for (const title of ['=1+1', ' +1', '@SUM(A1)', '-1', '\tname', '\nname']) {
    assert.ok(c.gtLineupCsv({ title, meta: '', players: [c.GT.players[0]] }).includes('"\'' + title + '"'));
  }
  c.GT.avail = [];
  assert.equal(c.gtLineupCsv(c.gtLineupData('g', 'game')).split('\r\n').length, 2);
});


function seasonRsvpContext() {
  const c = loadGt();
  c.GT.seasons = [{ id: 'winter', name: 'Winter 7s', roster: { a: true, g: true } }];
  c.GT.games = [{ id: 'winter-game', season_id: 'winter', roster_id: 'r1', status: 'setup', home_team: 'Our team', away_team: '(re)United', f6ad_side: 'home', played_at: '2026-11-06', kickoff_time: '19:00' }];
  // Actual setup stores all club players, including unavailable non-season players.
  c.GT.avail = ['a', 'b', 'c', 'g'].map(pid => ({ id: 'avail-' + pid, game_id: 'winter-game', player_id: pid, available: ['a', 'g'].includes(pid) }));
  c.GT.rsvp = [{ game_id: 'winter-game', player_id: 'b', hidden: true, status: 'in' }];
  c.window.location = { origin: 'https://team.test', pathname: '/' };
  c.gtFmtKickoff = time => time;
  return c;
}

test('season RSVP rows and family picker exclude unavailable club records and preserve removals', () => {
  const c = seasonRsvpContext();
  const before = plain({ avail: c.GT.avail, rsvp: c.GT.rsvp, seasons: c.GT.seasons });
  assert.deepEqual(plain(c.gtRsvpPlayersFor('r1', 'winter-game').map(p => p.id)), ['a', 'g']);
  c.gtCanEdit = () => false;
  const picker = c.gtRsvpIdentityPicker('r1', 'winter-game');
  const card = c.gtRsvpCard('winter-game', 'Game', '', 'r1', true, false);
  for (const html of [picker, card]) {
    assert.match(html, /Al A/);
    assert.match(html, /Gus G/);
    assert.doesNotMatch(html, /Bo B|Cy C/);
  }
  assert.deepEqual(plain({ avail: c.GT.avail, rsvp: c.GT.rsvp, seasons: c.GT.seasons }), before);
});

test('season RSVP allows deliberate regular and guest additions without treating old responses as invitations', () => {
  const c = seasonRsvpContext();
  c.GT.players.push({ id: 'guest2', first_name: 'New', last_name: 'Guest', is_guest: true });
  c.GT.rsvp.push({ game_id: 'winter-game', player_id: 'c', status: 'in' });
  assert.deepEqual(plain(c.gtRsvpPlayersFor('r1', 'winter-game').map(p => p.id)), ['a', 'g']);
  c.GT.rsvp[1].hidden = false; // Coach's Add/Restore action.
  c.GT.rsvp.push({ game_id: 'winter-game', player_id: 'guest2', hidden: false });
  assert.deepEqual(plain(c.gtRsvpPlayersFor('r1', 'winter-game').map(p => p.id)), ['a', 'c', 'g', 'guest2']);
  c.GT.rsvp[1].hidden = true;
  assert.doesNotMatch(c.gtRsvpIdentityPicker('r1', 'winter-game'), /Cy C/);
  // A selected game-specific addition is also allowed.
  c.GT.avail[2].available = true;
  c.GT.rsvp = [];
  assert.deepEqual(plain(c.gtRsvpPlayersFor('r1', 'winter-game').map(p => p.id)), ['a', 'c', 'g']);
});

test('an empty season roster and a season still loading never show the whole club', () => {
  const c = seasonRsvpContext();
  c.GT.avail.forEach(a => { a.available = false; });
  c.GT.seasons[0].roster = {};
  assert.equal(c.gtRsvpPlayersFor('r1', 'winter-game').length, 0);
  c.GT.seasons = [];
  assert.equal(c.gtRsvpPlayersFor('r1', 'winter-game').length, 0);
  const view = {};
  c.gtRenderRsvp(view, 'winter-game');
  assert.match(view.innerHTML, /Loading game availability/);
});

test('RSVP tallies and applying responses ignore removed, out-of-season and invitation-only records', async () => {
  const c = seasonRsvpContext(), writes = [];
  c.GT.rsvp.push({ game_id: 'winter-game', player_id: 'a', status: 'out' },
    { game_id: 'winter-game', player_id: 'c', status: 'in' },
    { game_id: 'winter-game', player_id: 'g', hidden: false });
  assert.deepEqual(plain(c.gtRsvpTally('winter-game')), { in: 0, out: 1, maybe: 0 });
  c.confirm = () => true;
  c.tdb = () => ({ doc: id => ({ id }) });
  c.db = { batch: () => ({ set: (ref, data) => writes.push({ id: ref.id, data }), commit: async () => {} }) };
  c.gtApplyRsvpsToGame('winter-game');
  assert.deepEqual(plain(writes), [{ id: 'avail-a', data: { available: false, scratched: false } }]);
});

test('RSVP request copies a game-specific message and opens the same family RSVP route', async () => {
  const c = seasonRsvpContext();
  let copied, notice;
  c.navigator = { clipboard: { writeText: async text => { copied = text; } } };
  c.showToast = text => { notice = text; };
  await c.gtRequestRsvps('winter-game');
  assert.match(copied, /Our team vs \(re\)United/);
  assert.match(copied, /19:00/);
  assert.match(copied, /In, Maybe, or Out/);
  assert.ok(copied.endsWith('https://team.test/#/gametracker/rsvp/winter-game'));
  assert.match(notice, /copied/);
  const actions = c.gtRsvpActions(c.GT.games[0]);
  assert.match(actions, /Request RSVPs/);
  assert.match(actions, /Copy RSVP Link/);
  assert.match(actions, /href="#\/gametracker\/rsvp\/winter-game"/);
  for (const status of ['in_progress', 'complete']) {
    c.GT.games[0].status = status;
    assert.equal(c.gtRsvpActions(c.GT.games[0]), '');
  }
  c.GT.games[0].status = 'setup';
  c.canceledEvents = { 'game_winter-game': true };
  assert.equal(c.gtRsvpActions(c.GT.games[0]), '');
});

test('RSVP request supports native share, cancellation, and clipboard failure', async () => {
  const c = seasonRsvpContext();
  let shared, fallback, copies = 0;
  c.navigator = { share: async data => { shared = data; } };
  await c.gtRequestRsvps('winter-game');
  assert.match(shared.text, /rsvp\/winter-game/);
  c.navigator = { share: async () => { throw { name: 'AbortError' }; }, clipboard: { writeText: async () => { copies++; } } };
  await c.gtRequestRsvps('winter-game');
  assert.equal(copies, 0);
  c.window.prompt = (label, text) => { fallback = text; };
  c.navigator = { share: async () => { throw new Error('unsupported'); }, clipboard: { writeText: async () => { throw new Error('denied'); } } };
  await c.gtRequestRsvps('winter-game');
  assert.match(fallback, /rsvp\/winter-game/);
});
