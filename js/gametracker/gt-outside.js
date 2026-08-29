// ===================== OUTSIDE GAMES =====================
// A game the player appeared in for somebody else — guesting for another club,
// a school team, indoor. Tracked by their own parent.
//
// These live in gt_ext_games / gt_ext_events and NEVER in gt_games / gt_events.
// 23 places in the app read GT.games; exactly two should ever see an outside
// game (the player profile and career totals). Keeping them in separate
// collections makes the other 21 safe by construction rather than by an
// exclusion each one has to remember. Season stats need no change at all —
// gtSeasonPlayerStats is handed an explicit list of games and this is never in it.

// Stat buttons. event_type deliberately matches the gt_events vocabulary so
// gtStatLine() counts these without knowing where they came from.
var GT_EXT_STATS = [
  { type: 'goal',           label: 'Goal',      emoji: '⚽' },
  { type: 'assist',         label: 'Assist',    emoji: '🅰️' },
  { type: 'shot_on_target', label: 'On Target', emoji: '🎯' },
  { type: 'shot',           label: 'Shot',      emoji: '💨' },
  { type: 'save',           label: 'Save',      emoji: '🧤' },
  { type: 'tackle',         label: 'Tackle',    emoji: '🛡️' },
  { type: 'pass',           label: 'Pass',      emoji: '➡️' },
  { type: 'pass_comp',      label: 'Pass Comp', emoji: '✅' },
  { type: 'yellow_card',    label: 'Yellow',    emoji: '🟨' },
  { type: 'red_card',       label: 'Red',       emoji: '🟥' },
  // Opens a note box instead of logging straight away — see gtExtHighlight.
  { type: 'highlight',      label: 'Highlight', emoji: '⭐', prompts: true }
];
// Sub markers aren't stats, but they share the event stream and need labels
// wherever the timeline renders them.
var GT_EXT_MARKS = [
  { type: 'sub_on',    label: 'Sub On',        emoji: '🔺' },
  { type: 'sub_off',   label: 'Sub Off',       emoji: '🔻' },
  // A goal by somebody else on the team. Not in GT_EXT_STATS, so gtStatLine —
  // which counts only the types it knows — never credits it to our player.
  { type: 'team_goal', label: 'Teammate goal', emoji: '👥' }
];
function gtExtStatDef(t) {
  return GT_EXT_STATS.find(function(s){ return s.type === t; }) ||
    GT_EXT_MARKS.find(function(s){ return s.type === t; }) ||
    { type: t, label: String(t).replace(/_/g, ' '), emoji: '•' };
}

// ---------- data ----------
// Attached lazily: only the profile and outside-game screens need these, so
// nobody else pays reads for them.
function gtExtListen() {
  if (GT.listeningExt) return;
  GT.listeningExt = true;
  gtAttachListeners([['gt_ext_games', 'extGames'], ['gt_ext_events', 'extEvents']]);
}
function gtExtGame(id) { return (GT.extGames || []).find(function(g){ return g.id === id; }); }
// What to call this game. The parent's own label wins; otherwise fall back to
// the matchup so nothing ever renders as an untitled blank.
function gtExtTitle(eg) {
  if (!eg) return '';
  var n = String(eg.event_name || '').trim();
  if (n) return n;
  var them = String(eg.opponent || '').trim();
  return them ? (String(eg.played_for || 'Outside game') + ' vs ' + them) : (String(eg.played_for || 'Outside game'));
}
function gtExtEventsFor(id) {
  return (GT.extEvents || []).filter(function(e){ return e.ext_game_id === id; })
    .sort(function(a, b) {
      return gtCumSec(gtExtGame(id), a.period || 1, a.game_clock_seconds || 0) -
             gtCumSec(gtExtGame(id), b.period || 1, b.game_clock_seconds || 0);
    });
}
function gtExtGamesFor(pid) {
  return (GT.extGames || []).filter(function(g){ return g.player_id === pid; })
    .sort(function(a, b){ return String(b.played_at || '').localeCompare(String(a.played_at || '')); });
}

// ---------- permissions ----------
// A parent may log outside games for a child they have an approved family link
// to; staff may do it for anyone (useful when a parent isn't technical).
function gtCanTrackOutside(pid) {
  if (typeof gtCanEdit === 'function' && gtCanEdit()) return true;
  return !!(typeof familyOwnsPlayer === 'function' && familyOwnsPlayer(pid));
}
function gtExtCanEdit(eg) {
  if (!eg) return false;
  if (typeof gtCanEdit === 'function' && gtCanEdit()) return true;
  return !!(authUser && eg.owner_uid === authUser.uid);
}

// ---------- minutes ----------
// One player, so this is a single timeline rather than gtMinutesMap's
// eleven-way swap: on at kickoff (or not), alternating sub_on / sub_off,
// closed out at whatever the clock has reached.
function gtExtMinutes(eg, evs) {
  if (!eg) return 0;
  var total = gtTotalSeconds(eg);
  var stream = (evs || gtExtEventsFor(eg.id))
    .filter(function(e){ return e.event_type === 'sub_on' || e.event_type === 'sub_off'; })
    .map(function(e){
      return { t: gtCumSec(eg, e.period || 1, e.game_clock_seconds || 0), on: e.event_type === 'sub_on' };
    })
    .sort(function(a, b){ return a.t - b.t; });
  var secs = 0, onAt = eg.started ? 0 : null;
  stream.forEach(function(s) {
    if (s.on) { if (onAt == null) onAt = s.t; }
    else if (onAt != null) { secs += Math.max(0, s.t - onAt); onAt = null; }
  });
  if (onAt != null) secs += Math.max(0, total - onAt);
  // A typed correction beats the tapped record — you can't go back and re-tap a
  // sub you forgot, and the team side has had the same escape hatch all along.
  if (eg.minutes_override != null && eg.minutes_override !== '') {
    return Math.max(0, Number(eg.minutes_override) || 0) * 60;
  }
  return secs;
}
// Whole minutes read as "0" for anything under 60s, which makes a short test
// look like nothing was recorded. Show seconds until there's a minute to show.
function gtExtFmtMins(secs) {
  if (secs > 0 && secs < 60) return secs + 's';
  return Math.round(secs / 60) + '';
}
function gtExtOnField(eg, evs) {
  var stream = (evs || gtExtEventsFor(eg.id))
    .filter(function(e){ return e.event_type === 'sub_on' || e.event_type === 'sub_off'; });
  if (!stream.length) return !!eg.started;
  return stream[stream.length - 1].event_type === 'sub_on';
}

// Career totals across every outside game for this player.
function gtExtTotals(pid) {
  var games = gtExtGamesFor(pid).filter(function(g){ return g.status === 'complete'; });
  var t = { games: games.length, goals: 0, assists: 0, sot: 0, sh: 0, saves: 0, tackles: 0, min: 0 };
  games.forEach(function(g) {
    var evs = gtExtEventsFor(g.id);
    var st = gtStatLine(pid, evs.map(function(e){ return { player_id: pid, event_type: e.event_type }; }));
    t.goals += st.goal; t.assists += st.assist; t.sot += st.shot_on_target; t.sh += st.shot;
    t.saves += st.save; t.tackles += st.tackle;
    t.min += Math.round(gtExtMinutes(g, evs) / 60);
  });
  return t;
}

// ---------- create / edit the game ----------
function gtOpenExtForm(pid, egId) {
  if (!gtCanTrackOutside(pid)) { showToast('You can only log outside games for your own player.'); return; }
  var eg = egId ? gtExtGame(egId) : null;
  var gd = appGameDefaults();
  var v = function(k, d){ return eg && eg[k] != null && eg[k] !== '' ? eg[k] : d; };
  gtOpenModal(
    '<h3>' + (eg ? '✏️ Edit Outside Game' : '➕ Log an Outside Game') +
      '<button class="gm-close" onclick="gtCloseModal()">✕</button></h3>' +
    '<p class="gt-sub" style="margin:-6px 0 12px">A game ' + gtEsc(gtPlayerName(pid)) +
      ' played for someone else. These stats count toward their own record only — never the team’s.</p>' +
    '<label>Event name</label><input type="text" id="gt-xf-name" value="' + gtAttr(v('event_name', '')) +
      '" placeholder="e.g. Ghouls &amp; Goals Tournament — Game 2"/>' +
    '<div class="gt-sub" style="margin:-8px 0 10px;font-size:.78rem">Optional. Leave blank and it will show as “played for vs opponent”.</div>' +
    '<label>Played for</label><input type="text" id="gt-xf-for" value="' + gtAttr(v('played_for', '')) +
      '" placeholder="e.g. Marple Newtown FC3"/>' +
    '<label>Opponent</label><input type="text" id="gt-xf-opp" value="' + gtAttr(v('opponent', '')) + '" placeholder="e.g. Rose Tree Red Stars"/>' +
    '<div class="gm-row"><div><label>Date</label><input type="date" id="gt-xf-date" value="' + gtAttr(v('played_at', gtTodayStr())) + '"/></div>' +
    '<div><label>Kickoff</label><input type="time" id="gt-xf-time" value="' + gtAttr(v('kickoff_time', '')) + '"/></div></div>' +
    '<label>Competition</label><select id="gt-xf-comp">' +
      ['Guest appearance', 'School', 'Indoor / futsal', 'Tournament', 'Friendly', 'Other'].map(function(c) {
        return '<option value="' + gtAttr(c) + '"' + (v('competition', 'Guest appearance') === c ? ' selected' : '') + '>' + gtEsc(c) + '</option>';
      }).join('') + '</select>' +
    '<label>Venue</label><input type="text" id="gt-xf-venue" value="' + gtAttr(v('venue', '')) + '"/>' +
    '<div class="gm-row"><div><label>Periods</label><input type="number" id="gt-xf-per" min="1" max="4" value="' + v('num_periods', gd.num_periods) + '"/></div>' +
    '<div><label>Minutes / period</label><input type="number" id="gt-xf-min" min="1" max="60" value="' + v('period_duration_minutes', gd.period_duration_minutes) + '"/></div></div>' +
    '<label style="display:flex;align-items:center;gap:8px;margin-top:12px"><input type="checkbox" id="gt-xf-started"' +
      (eg ? (eg.started ? ' checked' : '') : ' checked') + ' style="width:auto"/> Started the game</label>' +
    '<div class="gm-actions"><button class="btn-primary" onclick="gtSaveExtGame(\'' + pid + '\',' + (eg ? '\'' + eg.id + '\'' : 'null') + ')">Save</button>' +
    '<button class="gt-minibtn" onclick="gtCloseModal()">Cancel</button></div>'
  );
}
function gtSaveExtGame(pid, egId) {
  if (!gtCanTrackOutside(pid)) return;
  if (!authUser) { showToast('Sign in first.'); return; }
  var val = function(id){ var e = document.getElementById(id); return e ? e.value.trim() : ''; };
  var playedFor = val('gt-xf-for');
  if (!playedFor) { showToast('Who did they play for?'); return; }
  var ts = firebase.firestore.FieldValue.serverTimestamp();
  var data = {
    player_id: pid,
    event_name: val('gt-xf-name'),
    played_for: playedFor,
    opponent: val('gt-xf-opp'),
    played_at: val('gt-xf-date') || gtTodayStr(),
    kickoff_time: val('gt-xf-time'),
    competition: val('gt-xf-comp') || 'Guest appearance',
    venue: val('gt-xf-venue'),
    num_periods: Math.max(1, Math.min(4, parseInt(val('gt-xf-per'), 10) || appGameDefaults().num_periods)),
    period_duration_minutes: Math.max(1, Math.min(60, parseInt(val('gt-xf-min'), 10) || appGameDefaults().period_duration_minutes)),
    started: !!(document.getElementById('gt-xf-started') || {}).checked,
    updated_at: ts
  };
  if (egId) {
    tdb('gt_ext_games').doc(egId).set(data, { merge: true })
      .then(function(){ showToast('Saved ✓'); gtCloseModal(); })
      .catch(function(e){ showToast('Error: ' + e.message); });
    return;
  }
  data.owner_uid = authUser.uid;
  data.owner_name = (typeof familyName === 'function' ? familyName() : '') || authUser.email;
  data.status = 'setup';
  data.current_period = 1;
  data.clock_started_at = null;
  data.clock_elapsed_seconds = 0;
  data.period_elapsed = {};
  data.our_score = 0;
  data.their_score = 0;
  data.created_at = ts;
  tdb('gt_ext_games').add(data)
    .then(function(ref){ gtCloseModal(); gtGo('/gametracker/outside/' + ref.id); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function gtDeleteExtGame(egId) {
  var eg = gtExtGame(egId); if (!eg || !gtExtCanEdit(eg)) return;
  if (!window.confirm('Delete this outside game and everything logged in it?')) return;
  var pid = eg.player_id;
  tdb('gt_ext_events').where('ext_game_id', '==', egId).get().then(function(snap) {
    var batch = db.batch();
    snap.forEach(function(d){ batch.delete(d.ref); });
    batch.delete(tdb('gt_ext_games').doc(egId));
    return batch.commit();
  }).then(function(){ showToast('Deleted.'); gtGo('/gametracker/player/' + pid); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}

// ---------- clock ----------
function gtExtUpdate(egId, data) {
  data.updated_at = firebase.firestore.FieldValue.serverTimestamp();
  return tdb('gt_ext_games').doc(egId).update(data).catch(function(e){ showToast('Error: ' + e.message); });
}
function gtExtStart(egId) {
  gtExtUpdate(egId, { status: 'in_progress', current_period: 1, clock_elapsed_seconds: 0,
    clock_started_at: firebase.firestore.FieldValue.serverTimestamp() });
  showToast('Kickoff! ⚽');
}
function gtExtPause(egId) {
  var eg = gtExtGame(egId); if (!eg) return;
  gtExtUpdate(egId, { status: 'paused', clock_elapsed_seconds: gtClockSeconds(eg), clock_started_at: null });
}
function gtExtResume(egId) {
  gtExtUpdate(egId, { status: 'in_progress', clock_started_at: firebase.firestore.FieldValue.serverTimestamp() });
}
function gtExtEndPeriod(egId) {
  var eg = gtExtGame(egId); if (!eg) return;
  var pe = Object.assign({}, eg.period_elapsed || {});
  pe[eg.current_period || 1] = gtClockSeconds(eg);
  gtExtUpdate(egId, { status: 'between_periods', period_elapsed: pe,
    current_period: (eg.current_period || 1) + 1, clock_elapsed_seconds: 0, clock_started_at: null });
}
function gtExtStartNext(egId) {
  gtExtUpdate(egId, { status: 'in_progress', clock_started_at: firebase.firestore.FieldValue.serverTimestamp() });
}
function gtExtEndGame(egId) {
  var eg = gtExtGame(egId); if (!eg) return;
  var pe = Object.assign({}, eg.period_elapsed || {});
  if (eg.status === 'in_progress' || eg.status === 'paused') pe[eg.current_period || 1] = gtClockSeconds(eg);
  gtExtUpdate(egId, { status: 'complete', period_elapsed: pe, clock_started_at: null });
  showToast('Game complete 🏁');
}
function gtExtReopen(egId) {
  gtExtUpdate(egId, { status: 'paused' });
}

// ---------- logging ----------
function gtExtLog(egId, type) {
  var eg = gtExtGame(egId); if (!eg || !gtExtCanEdit(eg)) return;
  if (!authUser) { showToast('Sign in first.'); return; }
  var ts = firebase.firestore.FieldValue.serverTimestamp();
  tdb('gt_ext_events').add({
    ext_game_id: egId, owner_uid: eg.owner_uid, player_id: eg.player_id,
    event_type: type,
    game_clock_seconds: gtClockSeconds(eg), period: eg.current_period || 1,
    notes: '', youtube_url: '', created_at: ts
  }).then(function() {
    if (type === 'goal') gtExtUpdate(egId, { our_score: (eg.our_score || 0) + 1 });
    var d = gtExtStatDef(type);
    showToast(d.emoji + ' ' + d.label + ' logged');
  }).catch(function(e){ showToast('Error: ' + e.message); });
}
// Starting status, settable right up to kickoff. It seeds the minutes clock:
// started means on from 0:00, otherwise nothing accrues until the first Sub On.
function gtExtSetStarted(egId, started) {
  var eg = gtExtGame(egId); if (!eg || !gtExtCanEdit(eg)) return;
  if (eg.status !== 'setup') { showToast('Use Sub On / Sub Off once the game has started.'); return; }
  gtExtUpdate(egId, { started: !!started });
}
// A highlight is a moment, not a counter — so it asks what happened. Freezes the
// clock reading at the moment you tapped, so a slow typist doesn't shift the
// timestamp; the same reason the team tracker stamps first and asks second.
function gtExtHighlight(egId, type) {
  var eg = gtExtGame(egId); if (!eg || !gtExtCanEdit(eg)) return;
  var stamp = { sec: gtClockSeconds(eg), period: eg.current_period || 1 };
  var def = gtExtStatDef(type || 'highlight');
  gtOpenModal(
    '<h3>' + def.emoji + ' ' + gtEsc(def.label) + '<button class="gm-close" onclick="gtCloseModal()">✕</button></h3>' +
    '<div class="gt-sub" style="margin:-6px 0 12px">' +
      gtEsc(gtNominalMinute(eg, stamp.period, stamp.sec)) + "' — " + gtEsc(gtPeriodLabel(eg, stamp.period, 'in_progress')) + '</div>' +
    '<label>What happened?</label>' +
    '<textarea id="gt-xh-note" rows="3" placeholder="e.g. Won it back on the halfway line and drove at the back four"></textarea>' +
    '<label>Video link (optional)</label><input type="text" id="gt-xh-yt" placeholder="YouTube URL"/>' +
    '<div class="gm-actions"><button class="btn-primary" onclick="gtExtSaveHighlight(\'' + egId + '\',\'' + (type || 'highlight') + '\',' + stamp.sec + ',' + stamp.period + ')">Save</button>' +
    '<button class="gt-minibtn" onclick="gtCloseModal()">Cancel</button></div>'
  );
  setTimeout(function(){ var t = document.getElementById('gt-xh-note'); if (t) t.focus(); }, 60);
}
function gtExtSaveHighlight(egId, type, sec, period) {
  var eg = gtExtGame(egId); if (!eg || !gtExtCanEdit(eg)) return;
  var note = (document.getElementById('gt-xh-note') || {}).value || '';
  var yt = (document.getElementById('gt-xh-yt') || {}).value || '';
  tdb('gt_ext_events').add({
    ext_game_id: egId, owner_uid: eg.owner_uid, player_id: eg.player_id,
    event_type: type, game_clock_seconds: sec, period: period,
    notes: note.trim(), youtube_url: yt.trim(),
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(){ gtCloseModal(); showToast('⭐ Highlight saved'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
// Add or change the note on anything already in the timeline.
function gtExtEditNote(id) {
  var e = (GT.extEvents || []).find(function(x){ return x.id === id; });
  if (!e) return;
  var eg = gtExtGame(e.ext_game_id); if (!gtExtCanEdit(eg)) return;
  var def = gtExtStatDef(e.event_type);
  gtOpenModal(
    '<h3>' + def.emoji + ' ' + gtEsc(def.label) + '<button class="gm-close" onclick="gtCloseModal()">✕</button></h3>' +
    '<label>Note</label><textarea id="gt-xh-note" rows="3">' + gtEsc(e.notes || '') + '</textarea>' +
    '<label>Video link (optional)</label><input type="text" id="gt-xh-yt" value="' + gtAttr(e.youtube_url || '') + '"/>' +
    '<div class="gm-actions"><button class="btn-primary" onclick="gtExtSaveNote(\'' + id + '\')">Save</button>' +
    '<button class="gt-minibtn" onclick="gtCloseModal()">Cancel</button></div>'
  );
}
function gtExtSaveNote(id) {
  var note = (document.getElementById('gt-xh-note') || {}).value || '';
  var yt = (document.getElementById('gt-xh-yt') || {}).value || '';
  tdb('gt_ext_events').doc(id).set({ notes: note.trim(), youtube_url: yt.trim() }, { merge: true })
    .then(function(){ gtCloseModal(); }).catch(function(e){ showToast('Error: ' + e.message); });
}
// A teammate's goal: bumps the score and lands in the timeline, but is not a
// stat for the player this game belongs to.
function gtExtTeamGoal(egId) {
  var eg = gtExtGame(egId); if (!eg || !gtExtCanEdit(eg)) return;
  var ts = firebase.firestore.FieldValue.serverTimestamp();
  tdb('gt_ext_events').add({
    ext_game_id: egId, owner_uid: eg.owner_uid, player_id: eg.player_id,
    event_type: 'team_goal',
    game_clock_seconds: gtClockSeconds(eg), period: eg.current_period || 1,
    notes: '', youtube_url: '', created_at: ts
  }).then(function(){ gtExtUpdate(egId, { our_score: (eg.our_score || 0) + 1 }); showToast('👥 Teammate goal'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
// Undo takes the most recent teammate goal back out with the score, so the
// timeline and the scoreline can't drift apart from a mis-tap.
function gtExtTeamGoalUndo(egId) {
  var eg = gtExtGame(egId); if (!eg || !gtExtCanEdit(eg)) return;
  if ((eg.our_score || 0) <= 0) return;
  var mine = gtExtEventsFor(egId).filter(function(e){ return e.event_type === 'team_goal'; });
  var last = mine[mine.length - 1];
  gtExtUpdate(egId, { our_score: Math.max(0, (eg.our_score || 0) - 1) });
  if (last) tdb('gt_ext_events').doc(last.id).delete().catch(function(){});
}
function gtExtSetMinutes(egId) {
  var eg = gtExtGame(egId); if (!eg || !gtExtCanEdit(eg)) return;
  var cur = (eg.minutes_override != null && eg.minutes_override !== '')
    ? String(eg.minutes_override) : String(Math.round(gtExtMinutes(eg) / 60));
  var v = window.prompt('Minutes played in this game:', cur);
  if (v == null) return;
  v = String(v).trim();
  if (v === '') { gtExtClearMinutes(egId); return; }
  var n = parseInt(v, 10);
  if (isNaN(n) || n < 0) { showToast('Enter a whole number of minutes.'); return; }
  gtExtUpdate(egId, { minutes_override: n });
  showToast('Minutes set to ' + n + '.');
}
function gtExtClearMinutes(egId) {
  var eg = gtExtGame(egId); if (!eg || !gtExtCanEdit(eg)) return;
  gtExtUpdate(egId, { minutes_override: firebase.firestore.FieldValue.delete() });
  showToast('Back to counting your Sub On / Sub Off taps.');
}
function gtExtDelEvent(id) {
  tdb('gt_ext_events').doc(id).delete().catch(function(e){ showToast('Error: ' + e.message); });
}
function gtExtScore(egId, side, delta) {
  var eg = gtExtGame(egId); if (!eg || !gtExtCanEdit(eg)) return;
  var k = side === 'us' ? 'our_score' : 'their_score';
  var d = {}; d[k] = Math.max(0, (eg[k] || 0) + delta);
  gtExtUpdate(egId, d);
}

// ---------- the outside-game screen ----------
function gtRenderOutside(view, egId) {
  gtExtListen();
  if (typeof gtSyncHeaderHeight === 'function') gtSyncHeaderHeight();
  if (typeof gtSyncServerClock === 'function') gtSyncServerClock();
  var eg = gtExtGame(egId);
  if (!eg) {
    view.innerHTML = GT.loaded.extGames
      ? '<div class="gt-empty">Outside game not found. <a href="#/gametracker">Back to GameTracker</a></div>'
      : '<div class="gt-empty">Loading…</div>';
    return;
  }
  var canEdit = gtExtCanEdit(eg);
  var evs = gtExtEventsFor(egId);
  var pid = eg.player_id;
  var secsOn = gtExtMinutes(eg, evs);
  var mins = Math.round(secsOn / 60);
  var minsLabel = gtExtFmtMins(secsOn);
  var onField = gtExtOnField(eg, evs);
  var col = (typeof gtClockCollapsed === 'function') ? gtClockCollapsed() : false;

  var html = '<div class="gt-outside-banner">🎽 <strong>Outside game.</strong> ' +
    gtEsc(gtPlayerName(pid)) + ' playing for ' + gtEsc(eg.played_for || '—') +
    ' — counts toward their own record only, never team or season stats.</div>' +
    '<div class="gt-ext-head"><div class="gt-title" style="margin:0">' + gtEsc(gtExtTitle(eg)) + '</div>' +
    '<div class="gt-sub">' +
      [eg.competition, eg.played_at, eg.venue].filter(Boolean).map(gtEsc).join(' · ') +
    '</div></div>';

  html += '<div class="gt-clockbar' + (col ? ' collapsed' : '') + '">' +
    '<button class="gt-clock-toggle" type="button" aria-expanded="' + (col ? 'false' : 'true') +
      '" title="' + (col ? 'Expand clock' : 'Collapse clock') + '" aria-label="' +
      (col ? 'Expand clock' : 'Collapse clock') + '" onclick="gtToggleClockbar()">' + (col ? '▾' : '▴') + '</button>' +
    '<div class="gt-period" id="gt-period-label">' + gtEsc(gtPeriodLabel(eg)) + '</div>' +
    '<div class="gt-clock" id="gt-clock-display">' + gtFmtDisplayClock(eg) + '</div>' +
    '<div class="gt-scoreline">' +
      '<span class="sc-team">' + gtEsc(eg.played_for || 'Them') + '</span><span class="sc-num">' + (eg.our_score || 0) + '</span>' +
      '<span style="color:#666">–</span>' +
      '<span class="sc-num">' + (eg.their_score || 0) + '</span><span class="sc-team">' + gtEsc(eg.opponent || 'Opponent') + '</span>' +
      '<span class="gt-ext-minchip" title="Minutes played">' + (onField ? '🟢' : '⚪') + ' ' + minsLabel + (minsLabel.indexOf('s') < 0 ? "'" : '') + '</span>' +
    '</div>';

  if (canEdit) {
    html += '<div class="gt-clock-controls">';
    // Sub on/off lives in the clock bar, not in a card below it: the bar is
    // sticky at z-index 250, so anything underneath disappears behind it the
    // moment you scroll — which is exactly when you need these.
    if (eg.status === 'setup') {
      html += '<button class="gt-cbtn ' + (eg.started ? 'gt-cbtn-go' : 'gt-cbtn-dark') + '" onclick="gtExtSetStarted(\'' + egId + '\',true)">🟢 Starts on field</button>' +
        '<button class="gt-cbtn ' + (eg.started ? 'gt-cbtn-dark' : 'gt-cbtn-warn') + '" onclick="gtExtSetStarted(\'' + egId + '\',false)">🪑 Starts on bench</button>';
    } else if (eg.status !== 'complete') {
      html += '<button class="gt-cbtn ' + (onField ? 'gt-cbtn-dark' : 'gt-cbtn-go') + '" onclick="gtExtLog(\'' + egId + '\',\'sub_on\')"' + (onField ? ' disabled' : '') + '>🔺 Sub On</button>' +
        '<button class="gt-cbtn ' + (onField ? 'gt-cbtn-warn' : 'gt-cbtn-dark') + '" onclick="gtExtLog(\'' + egId + '\',\'sub_off\')"' + (onField ? '' : ' disabled') + '>🔻 Sub Off</button>';
    }
    var last = (eg.current_period || 1) >= (eg.num_periods || 2);
    if (eg.status === 'setup') {
      html += '<button class="gt-cbtn gt-cbtn-go" onclick="gtExtStart(\'' + egId + '\')">▶ Start Game</button>';
    } else if (eg.status === 'in_progress') {
      html += '<button class="gt-cbtn gt-cbtn-warn" onclick="gtExtPause(\'' + egId + '\')">⏸ Pause</button>' +
        (last ? '<button class="gt-cbtn gt-cbtn-danger" onclick="gtExtEndGame(\'' + egId + '\')">🏁 End Game</button>'
              : '<button class="gt-cbtn gt-cbtn-dark" onclick="gtExtEndPeriod(\'' + egId + '\')">End ' + gtEsc(gtPeriodLabel(eg, eg.current_period, 'in_progress')) + '</button>');
    } else if (eg.status === 'paused') {
      html += '<button class="gt-cbtn gt-cbtn-go" onclick="gtExtResume(\'' + egId + '\')">▶ Resume</button>' +
        (last ? '' : '<button class="gt-cbtn gt-cbtn-dark" onclick="gtExtEndPeriod(\'' + egId + '\')">End Period</button>') +
        '<button class="gt-cbtn gt-cbtn-danger" onclick="gtExtEndGame(\'' + egId + '\')">🏁 End Game</button>';
    } else if (eg.status === 'between_periods') {
      html += '<button class="gt-cbtn gt-cbtn-go" onclick="gtExtStartNext(\'' + egId + '\')">▶ Start ' + gtEsc(gtPeriodLabel(eg, eg.current_period, 'in_progress')) + '</button>' +
        '<button class="gt-cbtn gt-cbtn-danger" onclick="gtExtEndGame(\'' + egId + '\')">🏁 End Game</button>';
    } else if (eg.status === 'complete') {
      html += '<button class="gt-cbtn gt-cbtn-dark" onclick="gtExtReopen(\'' + egId + '\')">↺ Reopen to edit</button>';
    }
    html += '</div>';
  }
  html += '</div>';

  // minutes + on/off — the whole point of sub on/off here
  html += '<div class="gt-card gt-ext-mins">' +
    '<div class="gt-ext-minrow"><div><div class="gt-ext-minnum">' + minsLabel +
      (minsLabel.indexOf('s') < 0 ? '<span>min</span>' : '<span>on the field</span>') + '</div>' +
      '<div class="gt-sub">' + (eg.status === 'setup'
        ? (eg.started ? '🟢 Starts on the field' : '🪑 Starts on the bench')
        : (onField ? '🟢 On the field' : '⚪ Off the field')) + '</div></div>';
  if (canEdit) {
    html += '<div class="gt-ext-override">' +
      (eg.minutes_override != null && eg.minutes_override !== ''
        ? '<span class="gt-ext-ovr-on">✏️ Set manually to ' + gtEsc(String(eg.minutes_override)) + ' min</span>' +
          '<button class="gt-minibtn" onclick="gtExtSetMinutes(\'' + egId + '\')">Change</button>' +
          '<button class="gt-minibtn" onclick="gtExtClearMinutes(\'' + egId + '\')">Use tapped subs</button>'
        : '<button class="gt-minibtn" onclick="gtExtSetMinutes(\'' + egId + '\')">✏️ Enter minutes manually</button>') +
      '</div>';
  }
  if (eg.status === 'complete' && secsOn === 0) {
    html += '<div class="gt-starter-warn" style="margin-top:10px">⚠️ <strong>No minutes recorded.</strong> ' +
      (eg.started ? 'The clock never ran.' : 'They started on the bench and no Sub On was tapped.') +
      ' Enter the minutes manually if they did play.</div>';
  }
  html += '</div>' +
    '<div class="gt-sub" style="margin-top:8px">' +
    (eg.status === 'setup'
      ? 'Set this in the clock bar before kickoff. Starting on the bench means the clock only begins when you tap Sub On.'
      : 'Sub On and Sub Off are in the clock bar above. Minutes run from kickoff if they started, then follow every sub you tap.') +
    '</div></div>';

  // stat buttons
  if (canEdit && eg.status !== 'setup') {
    html += '<div class="gt-card"><div class="gt-title" style="font-size:1rem;margin-bottom:10px">Log a stat</div>' +
      '<div class="gt-ext-stats">' + GT_EXT_STATS.map(function(s) {
        var _fn = s.prompts ? 'gtExtHighlight' : 'gtExtLog';
        return '<button class="gt-statbtn' + (s.prompts ? ' hl' : '') + '" onclick="' + _fn + '(\'' + egId + '\',\'' + s.type + '\')">' +
          '<span class="sb-emoji">' + s.emoji + '</span><span class="sb-label">' + gtEsc(s.label) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="gt-ext-scores">' +
        '<div class="gt-ext-scorerow"><span class="sr-lbl">' + gtEsc(eg.played_for || 'Their team') + ' goals</span>' +
          '<button class="gt-minibtn" onclick="gtExtTeamGoalUndo(\'' + egId + '\')" aria-label="Undo the last teammate goal">−</button>' +
          '<strong>' + (eg.our_score || 0) + '</strong>' +
          '<button class="gt-minibtn" onclick="gtExtTeamGoal(\'' + egId + '\')" aria-label="A teammate scored">+</button></div>' +
        '<div class="gt-ext-scorerow"><span class="sr-lbl">' + gtEsc(eg.opponent || 'Opponent') + ' goals</span>' +
          '<button class="gt-minibtn" onclick="gtExtScore(\'' + egId + '\',\'them\',-1)" aria-label="One fewer opponent goal">−</button>' +
          '<strong>' + (eg.their_score || 0) + '</strong>' +
          '<button class="gt-minibtn" onclick="gtExtScore(\'' + egId + '\',\'them\',1)">+</button></div>' +
        '<div class="gt-sub" style="grid-column:1/-1;margin-top:2px">Tap + when a teammate scores — it is timestamped into the timeline. ' +
          gtEsc(gtPlayerShort ? gtPlayerShort(pid) : gtPlayerName(pid)) +
          '’s own goals are added here automatically by the Goal button.</div>' +
      '</div>' +
      '</div>';
  }

  // stat line
  var st = gtStatLine(pid, evs.map(function(e){ return { player_id: pid, event_type: e.event_type }; }));
  html += '<div class="gt-card"><div class="gt-title" style="font-size:1rem;margin-bottom:10px">' +
    gtEsc(gtPlayerName(pid)) + '</div><div class="gt-ext-line">' +
    [['⚽', 'Goals', st.goal], ['🅰️', 'Assists', st.assist], ['🎯', 'On Target', st.shot_on_target],
     ['💨', 'Shots', st.shot], ['🧤', 'Saves', st.save], ['🛡️', 'Tackles', st.tackle],
     ['⏱', 'Minutes', mins]].map(function(r) {
      return '<div class="gt-ext-stat"><span class="s-emoji">' + r[0] + '</span><span class="s-num">' + r[2] + '</span><span class="s-lbl">' + r[1] + '</span></div>';
    }).join('') + '</div></div>';

  // timeline
  html += '<div class="gt-card"><div class="gt-title" style="font-size:1rem;margin-bottom:10px">Timeline</div>';
  if (!evs.length) {
    html += '<div class="gt-empty" style="padding:14px">Nothing logged yet.</div>';
  } else {
    html += '<div class="gt-ext-feed">' + evs.map(function(e) {
      var d = gtExtStatDef(e.event_type);
      var mark = gtNominalMinute(eg, e.period || 1, e.game_clock_seconds || 0);
      var yid = (typeof gtYtId === 'function') ? gtYtId(e.youtube_url) : '';
      return '<div class="gt-ext-item' + (e.event_type === 'team_goal' ? ' team-goal' : '') + '"><span class="ei-min">' + mark + "'" + '</span>' +
        '<span class="ei-body">' + d.emoji + ' ' + gtEsc(d.label) +
          (e.notes ? '<span class="ei-note">' + gtEsc(e.notes) + '</span>' : '') +
          (yid ? '<a class="ei-yt" href="' + gtAttr(e.youtube_url) + '" target="_blank" rel="noopener">▶ Video</a>' : '') +
        '</span>' +
        (canEdit ? '<button class="ei-del" title="Add or edit a note" onclick="gtExtEditNote(\'' + e.id + '\')">✎</button>' +
                   '<button class="ei-del" title="Remove" onclick="gtExtDelEvent(\'' + e.id + '\')">✕</button>' : '') +
        '</div>';
    }).join('') + '</div>';
  }
  html += '</div>';

  html += '<div class="gt-ext-foot">' +
    '<a class="gt-minibtn" href="#/gametracker/player/' + pid + '">← ' + gtEsc(gtPlayerName(pid)) + '’s profile</a>' +
    (canEdit ? '<button class="gt-minibtn" onclick="gtOpenExtForm(\'' + pid + '\',\'' + egId + '\')">✏️ Edit details</button>' +
      '<button class="gt-minibtn danger" onclick="gtDeleteExtGame(\'' + egId + '\')">🗑 Delete</button>' : '') +
    '</div>';

  view.innerHTML = html;

  if (!GT.clockTimer) {
    GT.clockTimer = setInterval(function() {
      var cur = gtExtGame(egId);
      var el = document.getElementById('gt-clock-display');
      var pl = document.getElementById('gt-period-label');
      if (cur && el) el.innerHTML = gtFmtDisplayClock(cur);
      if (cur && pl) pl.textContent = gtPeriodLabel(cur);
    }, 500);
  }
}

// ---------- player profile block ----------
function gtExtBlockHtml(pid) {
  gtExtListen();
  var games = gtExtGamesFor(pid);
  var canAdd = gtCanTrackOutside(pid);
  if (!games.length && !canAdd) return '';
  var html = '<div class="section-title" style="margin:26px 0 6px">🎽 Outside Games</div>' +
    '<p class="gt-sub" style="margin-bottom:12px">Games played for another club, a school team or indoor. ' +
    'Tracked by the player’s family and counted in their own record only — never in team or season stats.</p>';
  if (canAdd) {
    html += '<button class="btn-primary" style="margin-bottom:14px" onclick="gtOpenExtForm(\'' + pid + '\',null)">➕ Log an Outside Game</button>';
  }
  if (!games.length) return html + '<div class="gt-empty">None logged yet.</div>';
  html += '<div class="gt-table-wrap"><table class="gt-table"><thead><tr>' +
    '<th>Date</th><th>Played for</th><th>Opponent</th><th class="num">⚽</th><th class="num">🅰️</th>' +
    '<th class="num">🎯</th><th class="num">🧤</th><th class="num">🛡️</th><th class="num">Min</th><th></th></tr></thead><tbody>';
  games.forEach(function(g) {
    var evs = gtExtEventsFor(g.id);
    var st = gtStatLine(pid, evs.map(function(e){ return { player_id: pid, event_type: e.event_type }; }));
    var open = g.status !== 'complete';
    html += '<tr><td>' + gtEsc(g.played_at || '') + (open ? ' <span class="gt-guest-badge">In progress</span>' : '') + '</td>' +
      '<td>' + gtEsc(g.played_for || '') +
        (g.event_name ? '<div class="gt-ext-evname">' + gtEsc(g.event_name) + '</div>' : '') + '</td>' +
        '<td>' + gtEsc(g.opponent || '—') + '</td>' +
      '<td class="num">' + st.goal + '</td><td class="num">' + st.assist + '</td><td class="num">' + st.shot_on_target + '</td>' +
      '<td class="num">' + st.save + '</td><td class="num">' + st.tackle + '</td>' +
      '<td class="num">' + gtExtFmtMins(gtExtMinutes(g, evs)) + '</td>' +
      '<td><button class="gt-minibtn" onclick="gtGo(\'/gametracker/outside/' + g.id + '\')">Open</button></td></tr>';
  });
  return html + '</tbody></table></div>';
}
