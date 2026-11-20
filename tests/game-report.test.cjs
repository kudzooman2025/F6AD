const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));

function reportContext() {
  const context = vm.createContext({ console, URL, Date });
  for (const file of ['gt-core.js', 'gt-parent.js', 'gt-report.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'js/gametracker', file), 'utf8'), context, { filename: file });
  }
  const game = {
    id: 'game', game_type: 'league', season_id: 'season', roster_id: 'club',
    home_team: 'Visitors', away_team: 'Old team name', f6ad_side: 'away',
    home_score: 2, away_score: 2, status: 'complete', phase: 'pk',
    played_at: '2026-11-20T12:00:00', kickoff_time: '10:30', venue: 'Community Field',
    venue_address: '1 Main Street', venue_city: 'Anywhere', venue_state: 'PA', venue_zip: '19001', field: '2', players_per_side: 9,
    num_periods: 2, period_duration_minutes: 40, current_period: 4,
    ot_num_periods: 2, ot_duration_minutes: 10,
    period_elapsed: { 1: 2460, 2: 2430, 3: 600, 4: 600 },
    pk_winner: 'us',
    pk_kicks: [
      { order: 1, team: 'us', player_id: 'starter', outcome: 'goal' },
      { order: 2, team: 'them', player_id: null, outcome: 'saved' },
      { order: 3, team: 'us', player_id: 'guest', outcome: 'missed' },
      { order: 4, team: 'them', player_id: null, outcome: 'goal' },
      { order: 5, team: 'us', player_id: 'starter', outcome: 'goal' }
    ]
  };
  context.GT.games = [game, { id: 'other-game' }];
  context.GT.rosters = [{ id: 'club', name: 'Entire club' }];
  context.GT.seasons = [{ id: 'season', name: 'Fall League', team_name: 'United' }];
  context.gtSeason = id => context.GT.seasons.find(item => item.id === id);
  context.gtTournament = id => context.GT.tournaments.find(item => item.id === id);
  context.GT.players = [
    ['starter', 'Alex', 'Starter', 11], ['guest', 'Blair', 'Guest', 22],
    ['event-only', 'Casey', 'Scorer', 33], ['sub-only', 'Drew', 'Substitute', 44],
    ['parent-only', 'Emery', 'Published', 55], ['removed', 'Gavin', 'Removed', 66],
    ['other', 'Harper', 'Othergame', 77], ['private-only', 'Indigo', 'Private', 88]
  ].map(([id, first_name, last_name, jersey_number]) => ({
    id, first_name, last_name, jersey_number, roster_id: id === 'guest' ? '__guests__' : 'club', is_guest: id === 'guest'
  }));
  context.GT.avail = [
    { id: 'a1', game_id: 'game', player_id: 'starter', available: true, started: true, start_position: 'GK', minutes_override: 12.5 },
    { id: 'a2', game_id: 'game', player_id: 'guest', available: true, started: false },
    { id: 'a3', game_id: 'game', player_id: 'removed', available: false, started: false },
    { id: 'a4', game_id: 'other-game', player_id: 'other', available: true, started: true }
  ];
  context.GT.events = [
    { id: 'ot', game_id: 'game', event_type: 'save', player_id: 'starter', period: 3, game_clock_seconds: 130, notes: 'OT save' },
    { id: 'second', game_id: 'game', event_type: 'goal', player_id: 'event-only', period: 2, game_clock_seconds: 15, notes: 'Second-half goal' },
    { id: 'first', game_id: 'game', event_type: 'highlight', player_id: 'guest', period: 1, game_clock_seconds: 20, notes: 'Early highlight', youtube_url: 'https://youtu.be/abcdefghijk?t=20' },
    { id: 'stoppage', game_id: 'game', event_type: 'assist', player_id: 'starter', period: 1, game_clock_seconds: 2490, notes: 'First-half stoppage assist' },
    { id: 'unknown', game_id: 'game', event_type: 'highlight', player_id: 'guest', period: 1, notes: 'Clock not recorded' },
    { id: 'other-event', game_id: 'other-game', event_type: 'goal', player_id: 'other', period: 1, game_clock_seconds: 10, notes: 'OTHER GAME SECRET' }
  ];
  context.GT.subs = [
    { id: 'solo-on', game_id: 'game', player_in_id: 'sub-only', player_out_id: null, position: 'CMID', period: 2, game_clock_seconds: 30 },
    { id: 'solo-off', game_id: 'game', player_in_id: null, player_out_id: 'guest', position: '', period: 1, game_clock_seconds: 300 }
  ];
  context.GT.parentEvents = [
    { id: 'public-pass', game_id: 'game', player_id: 'parent-only', type: 'pass_comp', visibility: 'public', period: 2, game_clock_seconds: 25, text: 'Published pass', author_name: 'Family' },
    { id: 'public-note', game_id: 'game', player_id: 'starter', type: 'in_play', visibility: 'public', period: 2, game_clock_seconds: 26, text: 'Published film note', outcome: 'S', author_name: 'Family' },
    ...['private', 'coach', 'rejected'].map((visibility, i) => ({
      id: 'hidden-' + visibility, game_id: 'game', player_id: 'private-only', type: 'shot', visibility,
      period: 1, game_clock_seconds: i, text: 'SECRET ' + visibility, author_token: 'SECRET TOKEN'
    }))
  ];
  // These site preferences hide passes in the on-screen feed only.
  context.gtTimelineShowsParentType = type => type !== 'pass_comp';
  return { context, game };
}

function sheet(report, name) {
  const result = report.sheets.find(item => item.name === name);
  assert.ok(result, 'Missing worksheet: ' + name);
  return result;
}

function records(report, name) {
  const tab = sheet(report, name);
  return clone(tab.rows).map(row => Object.fromEntries(tab.headers.map((header, index) => [header, row[index]])));
}

test('game report uses the selected game roster, recorded starters and manual minutes', () => {
  const { context } = reportContext();
  const before = clone(context.GT);
  const report = context.gtBuildGameReport('game');
  const stats = records(report, 'Player Stats');
  assert.deepEqual(stats.map(row => row.Player).sort(), [
    'Alex Starter', 'Blair Guest', 'Casey Scorer', 'Drew Substitute', 'Emery Published'
  ]);
  assert.deepEqual(records(report, 'Starting XI').map(row => [row.Player, row.Position]), [['Alex Starter', 'GK']]);
  const starter = stats.find(row => row.Player === 'Alex Starter');
  assert.equal(starter.Minutes, 12.5);
  assert.match(String(starter['Minutes source']), /manual|override/i);
  assert.match(String(starter['Playing time']), /12:30/);
  assert.match(String(stats.find(row => row.Player === 'Blair Guest')['Player type']), /guest/i);
  assert.equal(stats.find(row => row.Player === 'Casey Scorer').Goals, 1);
  assert.equal(stats.find(row => row.Player === 'Casey Scorer').Minutes, '', 'Event-only participation is not proof of playing time');
  assert.equal(stats.find(row => row.Player === 'Emery Published')['Completed passes'], 1);
  const summary = Object.fromEntries(sheet(report, 'Match Summary').rows);
  assert.equal(summary.Team, 'United');
  assert.equal(summary.Opponent, 'Visitors');
  assert.equal(summary.Kickoff, '10:30 AM');
  assert.equal(summary.Address, '1 Main Street, Anywhere, PA, 19001');
  assert.equal(summary['Our score'], 2);
  assert.equal(summary['Opponent score'], 2);
  assert.deepEqual(clone(context.GT), before, 'Building a report must not change game records');
  assert.match(report.filename, /\.xlsx$/i);
});

test('full report includes public family notes and stats without exposing unpublished data', () => {
  const { context } = reportContext();
  const report = context.gtBuildGameReport('game');
  const timeline = records(report, 'Timeline');
  assert.ok(timeline.some(row => row.Notes === 'Published pass'), 'Display preferences must not suppress full-report data');
  assert.ok(timeline.some(row => String(row.Notes).includes('Published film note')));
  const serialized = JSON.stringify(report);
  for (const hidden of ['SECRET', 'Indigo Private', 'Gavin Removed', 'Harper Othergame']) {
    assert.ok(!serialized.includes(hidden), 'Report leaked unrelated or unpublished data: ' + hidden);
  }
});

test('timeline orders periods before raw clocks and preserves regulation, OT and unknown times after a shootout', () => {
  const { context } = reportContext();
  const report = context.gtBuildGameReport('game');
  const timeline = records(report, 'Timeline');
  const rowFor = text => timeline.find(row => row.Notes === text);
  assert.ok(timeline.indexOf(rowFor('First-half stoppage assist')) < timeline.indexOf(rowFor('Second-half goal')),
    'Late first-half stoppage time must stay before second-half kickoff');
  assert.match(rowFor('Second-half goal')['Match clock'], /^40:15$/);
  assert.match(rowFor('OT save')['Match clock'], /^OT1 0?2:10$/);
  assert.match(String(rowFor('OT save').Period), /OT|extra|overtime/i);
  assert.doesNotMatch(String(rowFor('Early highlight').Period), /penalt|shootout|final/i);
  assert.equal(rowFor('Clock not recorded')['Match clock'], 'Not recorded');
  assert.equal(rowFor('OT save')['Period seconds'], 130);
  const substitutions = records(report, 'Substitutions');
  assert.ok(substitutions.some(row => row['Player on'] === 'Drew Substitute' && !row['Player off']));
  assert.ok(substitutions.some(row => row['Player off'] === 'Blair Guest' && !row['Player on']));
  assert.ok(timeline.some(row => /Drew Substitute/.test(JSON.stringify(row))), 'Full timeline includes substitutions');
});

test('highlights contain significant events and clips while shootout kicks remain separate', () => {
  const { context } = reportContext();
  const report = context.gtBuildGameReport('game');
  const highlights = records(report, 'Highlights');
  for (const note of ['Early highlight', 'Second-half goal', 'OT save', 'First-half stoppage assist']) {
    assert.ok(highlights.some(row => row.Notes === note), 'Missing highlight: ' + note);
  }
  const kicks = records(report, 'Penalty Shootout');
  assert.deepEqual(kicks.map(row => [row.Kick, row['Our score'], row['Opponent score']]), [
    [1, 1, 0], [2, 1, 0], [3, 1, 0], [4, 1, 1], [5, 2, 1]
  ]);
  assert.equal(kicks[0].Team, 'United');
  assert.equal(kicks[1].Team, 'Visitors');
  assert.equal(records(report, 'Player Stats').find(row => row.Player === 'Alex Starter').Goals, 0,
    'Shootout kicks must not increase player match goals');
});

test('missing starting lineup is reported honestly instead of treating every available player as a starter', () => {
  const { context, game } = reportContext();
  context.GT.avail.forEach(entry => { entry.started = false; });
  game.pk_kicks = [];
  game.phase = 'regulation';
  const report = context.gtBuildGameReport('game');
  assert.equal(sheet(report, 'Starting XI').rows.length, 0);
  assert.match(sheet(report, 'Starting XI').note, /not recorded|no .*recorded|none .*recorded/i);
  assert.ok(!report.sheets.some(tab => tab.name === 'Penalty Shootout'));
});

test('missing game-clock history leaves unknown minutes blank while retaining explicit minute adjustments', () => {
  const { context, game } = reportContext();
  game.period_elapsed = {};
  const report = context.gtBuildGameReport('game');
  const stats = records(report, 'Player Stats');
  assert.equal(stats.find(row => row.Player === 'Alex Starter').Minutes, 12.5);
  const guest = stats.find(row => row.Player === 'Blair Guest');
  assert.equal(guest.Minutes, '');
  assert.equal(guest['Playing time'], 'Not recorded');
});

test('Excel workbook round trip preserves typed values, safe links and readable worksheet structure', async () => {
  const ExcelJS = require('../js/vendor/exceljs-4.4.0.min.js');
  const { context } = reportContext();
  const payload = '=HYPERLINK("https://example.com","click")';
  context.GT.events[0].notes = payload;
  context.GT.events[0].youtube_url = 'javascript:alert(1)';
  const report = context.gtBuildGameReport('game');
  // ExcelJS uses instanceof Array internally; keep its input in the same realm
  // as the library, as it is in the actual browser application.
  const workbook = context.gtReportWorkbook(clone(report), ExcelJS);
  const encoded = await workbook.xlsx.writeBuffer();
  assert.ok(encoded.byteLength > 1000);
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(encoded);
  assert.deepEqual(reopened.worksheets.map(tab => tab.name), clone(report.sheets.map(tab => tab.name)));
  for (const tab of reopened.worksheets) {
    const specification = sheet(report, tab.name);
    assert.deepEqual(tab.getRow(4).values.slice(1), clone(specification.headers));
    assert.ok(tab.views.some(view => view.state === 'frozen' && view.ySplit === 4), tab.name + ' should freeze the headers');
    assert.ok(tab.autoFilter, tab.name + ' should be filterable');
    tab.eachRow(row => row.eachCell(cell => assert.notEqual(cell.type, ExcelJS.ValueType.Formula, 'User text must not become an Excel formula')));
  }
  const timeline = reopened.getWorksheet('Timeline');
  const header = sheet(report, 'Timeline').headers;
  const notesColumn = header.indexOf('Notes') + 1;
  const videoColumn = header.indexOf('Video') + 1;
  let sawSafe = false, sawUnsafe = false, sawPayload = false;
  timeline.eachRow((row, number) => {
    if (number < 5) return;
    if (row.getCell(notesColumn).value === payload) sawPayload = true;
    const video = row.getCell(videoColumn);
    if (video.value && video.value.hyperlink === 'https://youtu.be/abcdefghijk?t=20') sawSafe = true;
    if (video.value === 'javascript:alert(1)') sawUnsafe = true;
    if (video.value && typeof video.value === 'object' && video.value.hyperlink) {
      assert.match(video.value.hyperlink, /^https?:\/\//i);
    }
  });
  assert.ok(sawPayload, 'Formula-like text must survive unchanged as text');
  assert.ok(sawSafe, 'The original URL, including its video timestamp, must remain clickable');
  assert.ok(sawUnsafe, 'Unsupported URL schemes must remain plain text');
  const stats = reopened.getWorksheet('Player Stats');
  const minutesColumn = sheet(report, 'Player Stats').headers.indexOf('Minutes') + 1;
  let foundNumericOverride = false;
  stats.eachRow(row => { if (row.getCell(minutesColumn).value === 12.5) foundNumericOverride = true; });
  assert.ok(foundNumericOverride, 'Minutes should be Excel numbers, not text');
});

const reportDataCollections = ['games', 'players', 'events', 'subs', 'avail', 'parentEvents', 'seasons', 'tournaments'];

function exportContext(writeBuffer = () => Promise.resolve(new Uint8Array([80, 75, 3, 4]))) {
  const { context } = reportContext();
  const calls = { serializations: 0, reports: [], links: [], blobs: [], revoked: [], timers: [], toasts: [] };
  const excel = { mock: 'ExcelJS' };
  context.GT.loaded = Object.fromEntries(reportDataCollections.map(name => [name, true]));
  context.window = { ExcelJS: excel, location: { origin: 'https://example.com', pathname: '/soccer-fun-time.html' } };
  context.Blob = Blob;
  context.URL = {
    createObjectURL(blob) { calls.blobs.push(blob); return 'blob:report-' + calls.blobs.length; },
    revokeObjectURL(url) { calls.revoked.push(url); }
  };
  context.setTimeout = (callback, delay) => {
    const timer = { callback, delay, canceled: false };
    calls.timers.push(timer);
    return timer;
  };
  context.clearTimeout = timer => { timer.canceled = true; };
  context.showToast = message => calls.toasts.push(message);
  context.document = {
    createElement(tag) {
      assert.equal(tag, 'a', 'An already loaded ExcelJS library should not create another script');
      return {
        attached: false, removed: false,
        click() { assert.ok(this.attached); calls.links.push({ href: this.href, download: this.download }); },
        remove() { this.removed = true; this.attached = false; }
      };
    },
    body: { appendChild(element) { element.attached = true; } }
  };
  context.gtReportWorkbook = (report, library) => {
    assert.equal(library, excel);
    calls.reports.push(report);
    return { xlsx: { writeBuffer() { calls.serializations++; return writeBuffer(); } } };
  };
  return { context, calls, button: { disabled: false, textContent: 'Download Excel report' } };
}

test('download waits for every required game data collection before building a report', async () => {
  for (const missing of reportDataCollections) {
    const { context, calls, button } = exportContext();
    delete context.GT.loaded[missing];
    await context.gtExportGameExcel('game', button);
    assert.equal(calls.serializations, 0, missing + ' must be loaded before serialization');
    assert.equal(calls.reports.length, 0);
    assert.equal(calls.links.length, 0);
    assert.equal(calls.blobs.length, 0);
    assert.equal(context.gtReportBusy, false);
    assert.deepEqual(button, { disabled: false, textContent: 'Download Excel report' });
    assert.match(calls.toasts.at(-1), /still loading/i);
  }
});

test('serialization failure restores the download button and allows retry', async () => {
  let fail = true;
  const { context, calls, button } = exportContext(() => fail
    ? Promise.reject(new Error('Unable to serialize workbook'))
    : Promise.resolve(new Uint8Array([80, 75, 3, 4])));
  await context.gtExportGameExcel('game', button);
  assert.equal(context.gtReportBusy, false);
  assert.deepEqual(button, { disabled: false, textContent: 'Download Excel report' });
  assert.equal(calls.links.length, 0);
  assert.equal(calls.blobs.length, 0);
  assert.match(calls.toasts.at(-1), /unable to serialize workbook/i);
  fail = false;
  await context.gtExportGameExcel('game', button);
  assert.equal(calls.serializations, 2);
  assert.equal(calls.links.length, 1, 'A failed attempt must not leave the export locked');
});

test('overlapping download requests serialize and download only once', async () => {
  let finishSerialization;
  const pendingBuffer = new Promise(resolve => { finishSerialization = resolve; });
  const { context, calls, button } = exportContext(() => pendingBuffer);
  const first = context.gtExportGameExcel('game', button);
  assert.equal(context.gtReportBusy, true);
  assert.equal(button.disabled, true);
  const secondButton = { disabled: false, textContent: 'Download Excel report' };
  await context.gtExportGameExcel('game', secondButton);
  assert.equal(calls.serializations, 1);
  assert.equal(calls.links.length, 0);
  assert.deepEqual(secondButton, { disabled: false, textContent: 'Download Excel report' });
  assert.match(calls.toasts.at(-1), /being prepared/i);
  finishSerialization(new Uint8Array([80, 75, 3, 4]));
  await first;
  assert.equal(calls.serializations, 1);
  assert.equal(calls.links.length, 1);
  assert.equal(context.gtReportBusy, false);
  assert.deepEqual(button, { disabled: false, textContent: 'Download Excel report' });
});

test('successful download uses the XLSX filename and MIME type, then releases its object URL', async () => {
  const { context, calls, button } = exportContext();
  await context.gtExportGameExcel('game', button);
  assert.equal(calls.links.length, 1);
  assert.equal(calls.links[0].download, calls.reports[0].filename);
  assert.match(calls.links[0].download, /^United_vs_Visitors_2026-11-20_Post_Game_Report\.xlsx$/);
  assert.equal(calls.links[0].href, 'blob:report-1');
  assert.equal(calls.blobs.length, 1);
  assert.equal(calls.blobs[0].type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(calls.blobs[0].size, 4);
  assert.equal(context.gtReportBusy, false);
  assert.deepEqual(button, { disabled: false, textContent: 'Download Excel report' });
  assert.match(calls.toasts.at(-1), /downloaded/i);
  assert.equal(calls.revoked.length, 0, 'Do not release the URL before the browser starts downloading');
  assert.equal(calls.timers.length, 1);
  assert.ok(calls.timers[0].delay > 0 && calls.timers[0].delay <= 60000);
  calls.timers[0].callback();
  assert.deepEqual(calls.revoked, ['blob:report-1']);
});
