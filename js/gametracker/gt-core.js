// ===================== GAMETRACKER =====================
// Live game logging, rosters, season stats. Firestore collections:
// gt_rosters, gt_players, gt_games, gt_availability, gt_events, gt_subs

var GT = {
  rosters: [], players: [], games: [], events: [], subs: [], avail: [], tournaments: [], seasons: [],
  loaded: {},
  listening: false,
  route: { page: 'home', arg: null },
  setup: null,
  clockTimer: null,
  pendingEvent: null,
  openFeedItem: null,
  seasonSort: { col: 'goals', dir: -1 },
  seasonShowGuests: false,
  seasonFilters: { type: 'all', from: '', to: '', opp: '' },
  rosterSel: null
};

var GT_EVENT_TYPES = [
  { id: 'goal',           label: 'Goal',           emoji: '⚽' },
  { id: 'assist',         label: 'Assist',         emoji: '🅰️' },
  { id: 'shot_on_target', label: 'Shot on Target', emoji: '🎯' },
  { id: 'shot',           label: 'Shot',           emoji: '💨' },
  { id: 'highlight',      label: 'Highlight',      emoji: '⭐' },
  { id: 'yellow_card',    label: 'Yellow Card',    emoji: '🟨' },
  { id: 'red_card',       label: 'Red Card',       emoji: '🟥' },
  { id: 'save',           label: 'Save',           emoji: '🧤' }
];
// Fixed position list (primary formation 5-3-2). Order is intentional.
var GT_POSITIONS = ['GK', 'LST', 'RST', 'LWB', 'RWB', 'CDM', 'LCB', 'CB', 'RCB', 'CMID', 'LMID', 'RMID', 'CAM', 'FWD'];
function gtPositionOptions(sel) {
  return '<option value="">— Position —</option>' + GT_POSITIONS.map(function(p) {
    return '<option value="' + p + '"' + (p === sel ? ' selected' : '') + '>' + p + '</option>';
  }).join('');
}
function gtEventType(id) {
  if (id === 'opponent_goal') return { id: 'opponent_goal', label: 'Opponent Goal', emoji: '😣' };
  return GT_EVENT_TYPES.find(function(t){ return t.id === id; }) || { id: id, label: id, emoji: '•' };
}

// ---------- generic helpers ----------
function gtEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function gtAttr(s) { return gtEsc(s).replace(/\n/g, ' '); }
function gtFmtMMSS(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  var m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}
function gtFmtDate(ts) {
  if (!ts) return '—';
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function gtTsMillis(ts) { return ts && ts.toMillis ? ts.toMillis() : (ts ? new Date(ts).getTime() : 0); }
function gtCanEdit() { return isCoachLoggedIn() || isAdminUnlocked(); }

// ---------- data helpers ----------
function gtP(id) { return GT.players.find(function(p){ return p.id === id; }); }
function gtPlayerName(id) {
  var p = gtP(id);
  return p ? ((p.first_name || '') + ' ' + (p.last_name || '')).trim() : 'Unknown';
}
function gtPlayerShort(id) {
  var p = gtP(id);
  if (!p) return 'Unknown';
  return ((p.first_name || '') + (p.last_name ? ' ' + p.last_name.charAt(0) + '.' : '')).trim();
}
function gtIsGK(p) { return !!(p && p.position && /^(gk|goal)/i.test(p.position)); }
function gtRosterPlayers(rid) {
  return GT.players.filter(function(p){ return p.roster_id === rid; }).sort(function(a, b) {
    var an = a.jersey_number == null ? 999 : a.jersey_number, bn = b.jersey_number == null ? 999 : b.jersey_number;
    if (an !== bn) return an - bn;
    return gtPlayerName(a.id).localeCompare(gtPlayerName(b.id));
  });
}
function gtGuestPool() {
  // reusable pool of guest players (tracked like any player, not tied to a squad)
  return GT.players.filter(function(p){ return p.is_guest; }).sort(function(a, b) {
    var an = a.jersey_number == null ? 999 : a.jersey_number, bn = b.jersey_number == null ? 999 : b.jersey_number;
    if (an !== bn) return an - bn;
    return gtPlayerName(a.id).localeCompare(gtPlayerName(b.id));
  });
}
function gtActiveRoster() { return GT.rosters.find(function(r){ return r.is_active && !r.archived; }); }
function gtRoster(id) { return GT.rosters.find(function(r){ return r.id === id; }); }
function gtGame(id) { return GT.games.find(function(g){ return g.id === id; }); }
function gtGameEvents(gid) {
  return GT.events.filter(function(e){ return e.game_id === gid; }).sort(function(a, b) {
    var ga = gtGame(gid);
    var ta = gtCumSec(ga, a.period, a.game_clock_seconds), tb = gtCumSec(ga, b.period, b.game_clock_seconds);
    if (ta !== tb) return ta - tb;
    return gtTsMillis(a.created_at) - gtTsMillis(b.created_at);
  });
}
function gtGameSubs(gid) {
  var g = gtGame(gid);
  return GT.subs.filter(function(s){ return s.game_id === gid; }).sort(function(a, b) {
    return gtCumSec(g, a.period, a.game_clock_seconds) - gtCumSec(g, b.period, b.game_clock_seconds);
  });
}
function gtGameAvail(gid) { return GT.avail.filter(function(a){ return a.game_id === gid; }); }
function gtGameAvailEntry(gid, pid) { return gtGameAvail(gid).find(function(a){ return a.player_id === pid; }); }
function gtAvailIds(gid) {
  return gtGameAvail(gid).filter(function(a){ return a.available; }).map(function(a){ return a.player_id; });
}
function gtOurScore(g) { return g.f6ad_side === 'away' ? (g.away_score || 0) : (g.home_score || 0); }
function gtTheirScore(g) { return g.f6ad_side === 'away' ? (g.home_score || 0) : (g.away_score || 0); }
function gtOurName(g) { return g.f6ad_side === 'away' ? g.away_team : g.home_team; }
function gtTheirName(g) { return g.f6ad_side === 'away' ? g.home_team : g.away_team; }
function gtResult(g) {
  var us = gtOurScore(g), them = gtTheirScore(g);
  return us > them ? 'W' : us < them ? 'L' : 'D';
}

// ---------- clock math ----------
function gtClockSeconds(g) {
  // seconds elapsed in the CURRENT period
  if (!g) return 0;
  var base = g.clock_elapsed_seconds || 0;
  if (g.status === 'in_progress' && g.clock_started_at) {
    base += (Date.now() - gtTsMillis(g.clock_started_at)) / 1000;
  }
  return Math.max(0, Math.floor(base));
}
function gtDisplaySeconds(g) {
  // cumulative game seconds for display: the clock runs continuously across
  // periods, each period starting at the NOMINAL end time of the previous one
  // (e.g. with 35-min halves the 2nd half starts at 35:00 and counts up).
  if (!g) return 0;
  var curPeriod = g.current_period || 1;
  var dur = (g.period_duration_minutes || 0) * 60;
  return (curPeriod - 1) * dur + gtClockSeconds(g);
}
function gtFmtDisplayClock(g) {
  // Format the live game clock with extra-time annotation
  var dispSec = gtDisplaySeconds(g);
  var dur = (g && g.period_duration_minutes) || 0;
  var curPeriod = g ? (g.current_period || 1) : 1;
  var pe = g ? (g.period_elapsed || {}) : {};
  // cumulative scheduled time up to and including current period
  var scheduledThisPeriodEnd = curPeriod * dur * 60;
  if (dur > 0 && dispSec > scheduledThisPeriodEnd) {
    var extra = dispSec - scheduledThisPeriodEnd;
    var em = Math.floor(extra / 60), es = extra % 60;
    return gtFmtMMSS(scheduledThisPeriodEnd) + ' <span class="gt-et-badge">+' + em + ':' + (es < 10 ? '0' : '') + es + ' ET</span>';
  }
  return gtFmtMMSS(dispSec);
}
function gtPeriodActual(g, p) {
  // actual elapsed seconds of a COMPLETED period (fallback: nominal)
  var pe = g.period_elapsed || {};
  if (pe[p] != null) return pe[p];
  return (g.period_duration_minutes || 0) * 60;
}
function gtCumSec(g, period, sec) {
  if (!g) return sec || 0;
  var total = sec || 0;
  for (var p = 1; p < (period || 1); p++) total += gtPeriodActual(g, p);
  return total;
}
function gtDisplayCumSec(g, period, sec) {
  // cumulative game-clock seconds for displaying a stored event, on NOMINAL
  // period boundaries so it matches the live clock (2nd half event = 35:00+).
  if (!g) return sec || 0;
  var dur = (g.period_duration_minutes || 0) * 60;
  return ((period || 1) - 1) * dur + (sec || 0);
}
function gtTotalSeconds(g) {
  // total actual seconds played so far in the game
  if (!g) return 0;
  var total = 0, pe = g.period_elapsed || {};
  Object.keys(pe).forEach(function(k){ total += pe[k] || 0; });
  if (g.status === 'in_progress' || g.status === 'paused') total += gtClockSeconds(g);
  return total;
}
function gtNominalMinute(g, period, sec) {
  // display minute, soccer style: 1st minute = 1'
  var dur = (g && g.period_duration_minutes) || 0;
  return ((period || 1) - 1) * dur + Math.floor((sec || 0) / 60) + 1;
}
function gtPeriodLabel(g, period, status) {
  var n = (g && g.num_periods) || 2;
  var p = period || (g ? g.current_period : 1) || 1;
  var labels;
  if (n === 1) labels = ['Game'];
  else if (n === 2) labels = ['1st Half', '2nd Half'];
  else if (n === 4) labels = ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'];
  else labels = []; for (var i = labels.length; i < n; i++) labels.push('Period ' + (i + 1));
  var label = labels[Math.min(p, n) - 1] || ('Period ' + p);
  var st = status || (g && g.status);
  if (st === 'between_periods') return (n === 2 && p === 2) ? 'Halftime' : 'Break before ' + label;
  if (st === 'paused') return label + ' — Paused';
  if (st === 'complete') return 'Final';
  if (st === 'setup') return 'Not Started';
  return label;
}

// ---------- minutes played / on-field ----------
function gtSubEvents(gid) {
  var g = gtGame(gid);
  return gtGameSubs(gid).map(function(s) {
    return { t: gtCumSec(g, s.period, s.game_clock_seconds), out: s.player_out_id, inn: s.player_in_id, position: s.position || '' };
  });
}
function gtKickoffOn(gid) {
  // Who is on the field at kickoff. If any starters were explicitly designated,
  // only those start; otherwise (legacy games) all available players start.
  var startedSet = {}, anyStarter = false;
  gtGameAvail(gid).forEach(function(a) {
    if (a.available && a.started) { startedSet[a.player_id] = true; anyStarter = true; }
  });
  var on = {};
  gtAvailIds(gid).forEach(function(pid){ on[pid] = anyStarter ? !!startedSet[pid] : true; });
  return on;
}
function gtOnField(gid) {
  // pid -> bool currently on the field; kickoff XI then sub toggles (free re-subs)
  var on = gtKickoffOn(gid);
  gtSubEvents(gid).forEach(function(s) {
    if (s.out && on[s.out] !== undefined) on[s.out] = false;
    if (s.inn && on[s.inn] !== undefined) on[s.inn] = true;
  });
  return on;
}
function gtMinutesMap(gid) {
  // pid -> seconds on field (approx.: available players on from kickoff unless subbed out)
  var g = gtGame(gid);
  var total = gtTotalSeconds(g);
  var kick = gtKickoffOn(gid);
  var secs = {}, onAt = {};
  gtAvailIds(gid).forEach(function(pid){ secs[pid] = 0; onAt[pid] = kick[pid] ? 0 : null; });
  gtSubEvents(gid).forEach(function(s) {
    if (s.out && onAt[s.out] != null) { secs[s.out] += Math.max(0, s.t - onAt[s.out]); onAt[s.out] = null; }
    if (s.inn && secs[s.inn] !== undefined && onAt[s.inn] == null) onAt[s.inn] = s.t;
  });
  Object.keys(onAt).forEach(function(pid) {
    if (onAt[pid] != null) secs[pid] += Math.max(0, total - onAt[pid]);
  });
  return secs;
}
function gtPlayerStints(gid, pid) {
  // ordered list of on-field stints: { inT, position, outT } (outT null = still on)
  var kick = gtKickoffOn(gid);
  var ae = gtGameAvailEntry(gid, pid);
  var startPos = ae && ae.start_position ? ae.start_position : '';
  var stints = [], cur = null;
  if (kick[pid]) cur = { inT: 0, position: startPos, outT: null };
  gtSubEvents(gid).forEach(function(s) {
    if (s.out === pid && cur) { cur.outT = s.t; stints.push(cur); cur = null; }
    if (s.inn === pid) { if (cur) { cur.outT = s.t; stints.push(cur); } cur = { inT: s.t, position: s.position || '', outT: null }; }
  });
  if (cur) stints.push(cur);
  return stints;
}
function gtLastPosition(gid, pid) {
  var st = gtPlayerStints(gid, pid);
  if (st.length && st[st.length - 1].position) return st[st.length - 1].position;
  var ae = gtGameAvailEntry(gid, pid);
  return ae && ae.start_position ? ae.start_position : '';
}
function gtPlayerGameStatus(gid, pid) {
  // STARTER | ON_FIELD | BENCHED | NOT_USED
  var stints = gtPlayerStints(gid, pid);
  if (!stints.length) return 'NOT_USED';
  if (gtOnField(gid)[pid]) {
    return (gtKickoffOn(gid)[pid] && stints.length === 1) ? 'STARTER' : 'ON_FIELD';
  }
  return 'BENCHED';
}
function gtStatLine(pid, events) {
  var st = { goal: 0, assist: 0, shot_on_target: 0, shot: 0, highlight: 0, yellow_card: 0, red_card: 0, save: 0 };
  events.forEach(function(e){ if (e.player_id === pid && st[e.event_type] !== undefined) st[e.event_type]++; });
  return st;
}

