// ===================== GAMETRACKER =====================
// Live game logging, rosters, season stats. Firestore collections:
// gt_rosters, gt_players, gt_games, gt_availability, gt_events, gt_subs

var GT = {
  rosters: [], players: [], games: [], events: [], subs: [], avail: [], tournaments: [], seasons: [], chat: [], rsvp: [], parentEvents: [], parentClaims: [],
  parentTrackPid: null, pnoteDraft: '',
  film: { gameId: null, on: false, running: false, base: 0, startedAt: null }, filmTimer: null,
  loaded: {},
  listening: false,
  route: { page: 'home', arg: null },
  setup: null,
  clockTimer: null,
  pendingEvent: null,
  openFeedItem: null,
  seasonSort: { col: 'goals', dir: -1 },
  seasonShowGuests: false,
  seasonFilters: { type: 'all', from: '', to: '', opp: '', team: '', round: '' },
  playerFilters: { type: 'all', from: '', to: '', opp: '', team: '', round: '' },
  rosterSel: null,
  chatDraft: ''
};

var GT_EVENT_TYPES = [
  { id: 'goal',           label: 'Goal',           emoji: '⚽' },
  { id: 'assist',         label: 'Assist',         emoji: '🅰️' },
  { id: 'shot_on_target', label: 'Shot on Target', emoji: '🎯' },
  { id: 'shot',           label: 'Shot',           emoji: '💨' },
  { id: 'highlight',      label: 'Highlight',      emoji: '⭐' },
  { id: 'yellow_card',    label: 'Yellow Card',    emoji: '🟨' },
  { id: 'red_card',       label: 'Red Card',       emoji: '🟥' },
  { id: 'save',           label: 'Save',           emoji: '🧤' },
  { id: 'tackle',         label: 'Tackle',         emoji: '🛡️' },
  { id: 'pass',           label: 'Pass',           emoji: '➡️' },
  { id: 'pass_comp',      label: 'Pass Comp',      emoji: '✅' },
  { id: 'own_goal',       label: 'Own Goal',       emoji: '🥅' }
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
  if (id === 'opponent_own_goal') return { id: id, label: 'Own Goal (their net)', emoji: '🥅' };
  if (id === 'opponent_yellow_card') return { id: id, label: 'Opponent Yellow', emoji: '🟨' };
  if (id === 'opponent_red_card') return { id: id, label: 'Opponent Red', emoji: '🟥' };
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
  var d;
  if (ts.toDate) d = ts.toDate();
  else if (typeof ts === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ts)) d = new Date(ts + 'T00:00:00');
  else d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function gtTsMillis(ts) { return ts && ts.toMillis ? ts.toMillis() : (ts ? new Date(ts).getTime() : 0); }
function gtGameSortMs(g) {
  // sortable timestamp combining the game date with its kickoff time (if set)
  var base = gtTsMillis(g.played_at || g.created_at);
  if (g.kickoff_time && /^\d{1,2}:\d{2}/.test(g.kickoff_time)) {
    var d = new Date(base), parts = g.kickoff_time.split(':');
    d.setHours(parseInt(parts[0], 10) || 0, parseInt(parts[1], 10) || 0, 0, 0);
    return d.getTime();
  }
  return base;
}
function gtTodayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
function gtGameDateStr(g) {
  var ms = gtTsMillis(g.played_at || g.created_at);
  if (!ms) return '';
  var d = new Date(ms);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
function gtFillVenueFields(nameId, addrId, cityId, stateId, zipId) {
  var name = (document.getElementById(nameId) || {}).value || '';
  var v = (typeof venueItems !== 'undefined' && venueItems) ? venueItems.find(function(x){ return (x.name || '').toLowerCase() === name.trim().toLowerCase(); }) : null;
  if (!v) return;
  function set(id, val){ var el = document.getElementById(id); if (el) el.value = val || ''; }
  set(addrId, v.address); set(cityId, v.city); set(stateId, v.state); set(zipId, v.zip);
}
function gtFmtKickoff(t) {
  if (!t || typeof t !== 'string' || t.indexOf(':') < 0) return '';
  var parts = t.split(':'), h = parseInt(parts[0], 10), m = parts[1];
  if (isNaN(h)) return '';
  var ap = h < 12 ? 'AM' : 'PM', h12 = h % 12; if (h12 === 0) h12 = 12;
  return h12 + ':' + m + ' ' + ap;
}
function gtChatName() { try { return localStorage.getItem('gt_chat_name') || ''; } catch (e) { return ''; } }
function gtSetChatName(clear) {
  if (clear) { try { localStorage.removeItem('gt_chat_name'); } catch (e) {} gtRerender(true); return; }
  var v = ((document.getElementById('gt-chat-name') || {}).value || '').trim();
  if (!v) { showToast('Enter a name to chat.'); return; }
  try { localStorage.setItem('gt_chat_name', v); } catch (e) {}
  gtRerender(true);
}
function gtGameChat(gid) {
  return GT.chat.filter(function(m){ return m.game_id === gid; }).sort(function(a, b){ return gtTsMillis(a.created_at) - gtTsMillis(b.created_at); });
}
function gtChatTime(ts) {
  var d = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
  if (!d || isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
function gtChatMsgsHtml(gid) {
  var msgs = gtGameChat(gid);
  if (!msgs.length) return '<div class="gt-chat-empty">No messages yet. Say hi 👋</div>';
  return msgs.map(function(m){
    return '<div class="gt-chat-msg">' + (gtCanEdit() ? '<button class="gt-chat-del" title="Delete message" onclick="gtDeleteChat(\'' + m.id + '\')">🗑</button>' : '') + '<span class="cm-name">' + gtEsc(m.name || '') + '</span> <span class="cm-time">' + gtChatTime(m.created_at) + '</span><div class="cm-text">' + gtEsc(m.text || '') + '</div></div>';
  }).join('');
}
function gtChatPanelHtml(gid) {
  var name = gtChatName();
  var foot = name
    ? '<div class="gt-chat-bar"><input id="gt-chat-input" placeholder="Message…" value="' + gtAttr(GT.chatDraft || '') + '" oninput="GT.chatDraft=this.value" onkeydown="if(event.key===\'Enter\')gtSendChat(\'' + gid + '\')"/><button class="btn-primary" onclick="gtSendChat(\'' + gid + '\')">Send</button></div><div class="gt-chat-as">Chatting as <strong>' + gtEsc(name) + '</strong> · <a onclick="gtSetChatName(true)">change name</a></div>'
    : '<div class="gt-chat-bar"><input id="gt-chat-name" placeholder="Enter your name to chat…" onkeydown="if(event.key===\'Enter\')gtSetChatName()"/><button class="btn-primary" onclick="gtSetChatName()">Join Chat</button></div>';
  return '<div class="gt-chat"><div class="gt-chat-head">💬 Game Chat</div><div class="gt-chat-msgs" id="gt-chat-msgs">' + gtChatMsgsHtml(gid) + '</div>' + foot + '</div>';
}
function gtRenderChatMessages() {
  var el = document.getElementById('gt-chat-msgs');
  if (!el || !GT.route || !GT.route.arg) return;
  el.innerHTML = gtChatMsgsHtml(GT.route.arg);
  el.scrollTop = el.scrollHeight;
}
function gtSendChat(gid) {
  var name = gtChatName();
  if (!name) { showToast('Add your name first.'); return; }
  var inp = document.getElementById('gt-chat-input');
  var text = (inp ? inp.value : '').trim();
  if (!text) return;
  db.collection('gt_chat').add({ game_id: gid, name: name, text: text, created_at: firebase.firestore.FieldValue.serverTimestamp() })
    .then(function(){ GT.chatDraft = ''; var i = document.getElementById('gt-chat-input'); if (i) { i.value = ''; i.focus(); } })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function gtDeleteChat(id) {
  // Staff/admin only (enforced in UI and firestore.rules). Posting stays open to all.
  if (!gtCanEdit()) return;
  if (!confirm('Delete this chat message?')) return;
  db.collection('gt_chat').doc(id).delete()
    .then(function(){ showToast('Message deleted.'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function gtCopyRsvpLink(gid) {
  var url = window.location.origin + window.location.pathname + '#/gametracker/rsvp/' + gid;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function(){ showToast('RSVP link copied!'); }).catch(function(){ window.prompt('Copy this RSVP link:', url); });
  } else { window.prompt('Copy this RSVP link:', url); }
}
function gtCopySeasonLink(sid) {
  var url = window.location.origin + window.location.pathname + '#/gametracker/seasons/' + sid;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function(){ showToast('Season link copied!'); }).catch(function(){ window.prompt('Copy this season link:', url); });
  } else { window.prompt('Copy this season link:', url); }
}
function gtCopyGameLink(gid) {
  var url = window.location.origin + window.location.pathname + '#/gametracker/review/' + gid;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function(){ showToast('Game link copied!'); }).catch(function(){ window.prompt('Copy this game link:', url); });
  } else { window.prompt('Copy this game link:', url); }
}
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
function gtSubRowText(sb) {
  // HTML for one substitution row, handling solo on/off toggles (one side null)
  var inN = sb.player_in_id ? gtEsc(gtPlayerShort(sb.player_in_id)) : '';
  var outN = sb.player_out_id ? gtEsc(gtPlayerShort(sb.player_out_id)) : '';
  var pos = sb.position ? ' (' + gtEsc(sb.position) + ')' : '';
  if (inN && outN) return '🔄 <strong>' + inN + '</strong>' + pos + ' ← ' + outN;
  if (inN) return '⬆ <strong>' + inN + '</strong>' + pos + ' on';
  if (outN) return '⬇ <strong>' + outN + '</strong> off';
  return '🔄 sub';
}
function gtSubDesc(sb) {
  var inN = sb.player_in_id ? gtPlayerShort(sb.player_in_id) : '';
  var outN = sb.player_out_id ? gtPlayerShort(sb.player_out_id) : '';
  if (inN && outN) return inN + ' on for ' + outN;
  if (inN) return inN + ' coming on';
  if (outN) return outN + ' going off';
  return 'this substitution';
}
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
// Everyone who appears in a game: marked-available players PLUS anyone with a logged
// event (goal/assist/card/save/etc.) or a substitution — so the roster shows up even
// for games where a formal lineup/availability was never set.
function gtWhoPlayedIds(gid) {
  var set = {};
  gtAvailIds(gid).forEach(function(pid){ if (pid) set[pid] = true; });
  gtGameEvents(gid).forEach(function(e){ if (e.player_id) set[e.player_id] = true; });
  gtGameSubs(gid).forEach(function(sb){ if (sb.player_in_id) set[sb.player_in_id] = true; if (sb.player_out_id) set[sb.player_out_id] = true; });
  if (typeof gtParentPublicPlayerIds === 'function') gtParentPublicPlayerIds(gid).forEach(function(pid){ set[pid] = true; });
  return Object.keys(set);
}
function gtOurScore(g) { return g.f6ad_side === 'away' ? (g.away_score || 0) : (g.home_score || 0); }
function gtTheirScore(g) { return g.f6ad_side === 'away' ? (g.home_score || 0) : (g.away_score || 0); }
function gtOurName(g) {
  // The team-name LABEL for our side. A linked tournament/season's team name is
  // authoritative (so it applies to all its games + season stats, retroactively);
  // otherwise fall back to the name stored on the game.
  if (g) {
    if (g.tournament_id && typeof gtTournament === 'function') { var t = gtTournament(g.tournament_id); if (t && t.team_name) return t.team_name; }
    if (g.season_id && typeof gtSeason === 'function') { var se = gtSeason(g.season_id); if (se && se.team_name) return se.team_name; }
  }
  return g.f6ad_side === 'away' ? g.away_team : g.home_team;
}
function gtTheirName(g) { return g.f6ad_side === 'away' ? g.home_team : g.away_team; }
function gtHomeName(g) { return g.f6ad_side === 'home' ? gtOurName(g) : gtTheirName(g); }
function gtAwayName(g) { return g.f6ad_side === 'away' ? gtOurName(g) : gtTheirName(g); }
function gtResult(g) {
  var us = gtOurScore(g), them = gtTheirScore(g);
  if (us === them && g && g.pk_winner) return g.pk_winner === 'us' ? 'W' : 'L';
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
  if (g && g.phase === 'pk') return 'PKs';
  if (g && g.phase === 'ot') {
    // each OT period counts up from 0:00
    var otSec = gtClockSeconds(g);
    var otDur = (g.ot_duration_minutes || 0) * 60;
    if (otDur > 0 && otSec > otDur) {
      var oex = otSec - otDur, oem = Math.floor(oex / 60), oes = oex % 60;
      return gtFmtMMSS(otDur) + ' <span class="gt-et-badge">+' + oem + ':' + (oes < 10 ? '0' : '') + oes + ' ET</span>';
    }
    return gtFmtMMSS(otSec);
  }
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
  var _st = status || (g && g.status);
  if (g && g.phase === 'pk') return _st === 'complete' ? 'Final' : 'Penalty Shootout';
  if (g && g.phase === 'ot' && p > n) {
    var _ot = p - n;
    var _lbl = (g.ot_num_periods > 1) ? ('Overtime ' + _ot) : 'Overtime';
    if (_st === 'between_periods') return 'Break before ' + _lbl;
    if (_st === 'paused') return _lbl + ' — Paused';
    if (_st === 'complete') return 'Final';
    if (_st === 'setup') return 'Not Started';
    return _lbl;
  }
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
function gtPlayerRedInfo(gid, pid) {
  // Cumulative-seconds time a player is sent off (straight red OR 2nd yellow), else null.
  var g = gtGame(gid);
  var evs = gtGameEvents(gid).filter(function(e){ return e.player_id === pid && (e.event_type === 'red_card' || e.event_type === 'yellow_card'); });
  var y = 0, t = null;
  for (var i = 0; i < evs.length; i++) {
    var et = gtCumSec(g, evs[i].period, evs[i].game_clock_seconds);
    if (evs[i].event_type === 'red_card') { t = et; break; }
    y++; if (y >= 2) { t = et; break; }
  }
  return t === null ? null : { t: t };
}
function gtOnField(gid) {
  // pid -> bool currently on the field; kickoff XI then sub toggles (free re-subs)
  var on = gtKickoffOn(gid);
  gtSubEvents(gid).forEach(function(s) {
    if (s.out && on[s.out] !== undefined) on[s.out] = false;
    if (s.inn && on[s.inn] !== undefined) on[s.inn] = true;
  });
  // a sent-off player (red / 2nd yellow) is off regardless of subs
  Object.keys(on).forEach(function(pid) { if (on[pid] && gtPlayerRedInfo(gid, pid)) on[pid] = false; });
  return on;
}
function gtMinutesMap(gid) {
  // pid -> seconds on field (approx.: available players on from kickoff unless subbed out)
  var g = gtGame(gid);
  var total = gtTotalSeconds(g);
  var kick = gtKickoffOn(gid);
  var secs = {}, onAt = {}, sentOff = {};
  gtAvailIds(gid).forEach(function(pid){ secs[pid] = 0; onAt[pid] = kick[pid] ? 0 : null; });
  var stream = gtSubEvents(gid).slice();
  gtAvailIds(gid).forEach(function(pid){ var r = gtPlayerRedInfo(gid, pid); if (r) stream.push({ t: r.t, out: pid, inn: null, red: true }); });
  stream.sort(function(a, b){ return a.t - b.t; });
  stream.forEach(function(s) {
    if (s.out && onAt[s.out] != null) { secs[s.out] += Math.max(0, s.t - onAt[s.out]); onAt[s.out] = null; }
    if (s.red && s.out) sentOff[s.out] = true;
    if (s.inn && !sentOff[s.inn] && secs[s.inn] !== undefined && onAt[s.inn] == null) onAt[s.inn] = s.t;
  });
  Object.keys(onAt).forEach(function(pid) {
    if (onAt[pid] != null) secs[pid] += Math.max(0, total - onAt[pid]);
  });
  // Manual per-player minute overrides (stored in MINUTES on the availability doc)
  gtGameAvail(gid).forEach(function(a) {
    if (a.minutes_override != null && a.minutes_override !== '') {
      secs[a.player_id] = Math.max(0, Number(a.minutes_override) || 0) * 60;
    }
  });
  return secs;
}
function gtOnFieldIntervals(gid, pid) {
  // [start,end] cumulative-second windows the player was on the pitch (from starters + subs).
  var g = gtGame(gid);
  if (gtAvailIds(gid).indexOf(pid) < 0) return [];
  var total = gtTotalSeconds(g);
  var kick = gtKickoffOn(gid);
  var intervals = [], onAt = kick[pid] ? 0 : null, sentOff = false;
  var stream = gtSubEvents(gid).slice();
  var r = gtPlayerRedInfo(gid, pid); if (r) stream.push({ t: r.t, out: pid, inn: null, red: true });
  stream.sort(function(a, b){ return a.t - b.t; });
  stream.forEach(function(s) {
    if (s.out === pid && onAt != null) { intervals.push([onAt, s.t]); onAt = null; }
    if (s.red && s.out === pid) sentOff = true;
    if (s.inn === pid && !sentOff && onAt == null) onAt = s.t;
  });
  if (onAt != null) intervals.push([onAt, total]);
  return intervals;
}
function gtOnFieldGoals(gid, pid) {
  // Team goals for/against that happened while this player was on the field.
  var g = gtGame(gid);
  var iv = gtOnFieldIntervals(gid, pid);
  if (!iv.length) return { gf: 0, ga: 0 };
  function on(t){ for (var i = 0; i < iv.length; i++) if (t >= iv[i][0] && t <= iv[i][1]) return true; return false; }
  var gf = 0, ga = 0;
  gtGameEvents(gid).forEach(function(e) {
    var forUs = (e.event_type === 'goal' || e.event_type === 'opponent_own_goal');
    var against = (e.event_type === 'opponent_goal' || e.event_type === 'own_goal');
    if (!forUs && !against) return;
    if (on(gtCumSec(g, e.period, e.game_clock_seconds))) { if (forUs) gf++; else ga++; }
  });
  return { gf: gf, ga: ga };
}
function gtMinutesOverridden(gid, pid) {
  var a = gtGameAvailEntry(gid, pid);
  return !!(a && a.minutes_override != null && a.minutes_override !== '');
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
  var red = gtPlayerRedInfo(gid, pid);
  if (red) {
    var trimmed = [];
    stints.forEach(function(st) {
      if (st.inT >= red.t) return;                                  // stint began after send-off
      if (st.outT === null || st.outT > red.t) st.outT = red.t;     // cap open/overrunning stint
      trimmed.push(st);
    });
    stints = trimmed;
  }
  return stints;
}
function gtLastPosition(gid, pid) {
  var st = gtPlayerStints(gid, pid);
  if (st.length && st[st.length - 1].position) return st[st.length - 1].position;
  var ae = gtGameAvailEntry(gid, pid);
  return ae && ae.start_position ? ae.start_position : '';
}
function gtPlayerGameStatus(gid, pid) {
  // STARTER | ON_FIELD | BENCHED | NOT_USED | SENT_OFF
  if (gtPlayerRedInfo(gid, pid)) return 'SENT_OFF';
  var stints = gtPlayerStints(gid, pid);
  if (!stints.length) return 'NOT_USED';
  if (gtOnField(gid)[pid]) {
    return (gtKickoffOn(gid)[pid] && stints.length === 1) ? 'STARTER' : 'ON_FIELD';
  }
  return 'BENCHED';
}
function gtStarters(gid) {
  // players who started, ordered by position (formation order) then jersey
  return gtGameAvail(gid).filter(function(a){ return a.available && a.started; })
    .map(function(a){ return { pid: a.player_id, pos: a.start_position || '' }; })
    .sort(function(x, y) {
      var xi = GT_POSITIONS.indexOf(x.pos); if (xi < 0) xi = 99;
      var yi = GT_POSITIONS.indexOf(y.pos); if (yi < 0) yi = 99;
      if (xi !== yi) return xi - yi;
      var xp = gtP(x.pid), yp = gtP(y.pid);
      return (xp && xp.jersey_number != null ? xp.jersey_number : 999) - (yp && yp.jersey_number != null ? yp.jersey_number : 999);
    });
}
function gtStartingXiHtml(gid) {
  var starters = gtStarters(gid);
  if (!starters.length) return '';
  return '<div class="gt-xi"><span class="gt-xi-label">⭐ Starting XI (' + starters.length + ')</span> ' +
    starters.map(function(s) {
      var p = gtP(s.pid);
      return '<span class="gt-xi-item">' + (p && p.jersey_number != null ? '#' + p.jersey_number + ' ' : '') + gtEsc(gtPlayerShort(s.pid)) + (s.pos ? ' <span class="gt-xi-pos">' + gtEsc(s.pos) + '</span>' : '') + '</span>';
    }).join('') + '</div>';
}
function gtStatLine(pid, events) {
  var st = { goal: 0, assist: 0, shot_on_target: 0, shot: 0, highlight: 0, yellow_card: 0, red_card: 0, save: 0, tackle: 0, pass: 0, pass_comp: 0, own_goal: 0 };
  events.forEach(function(e){ if (e.player_id === pid && st[e.event_type] !== undefined) st[e.event_type]++; });
  return st;
}



// ===================== OT / PK / CARDS HELPERS =====================
function gtIsOT(g) { return !!(g && g.phase === 'ot'); }
function gtIsPK(g) { return !!(g && g.phase === 'pk'); }
function gtOtIndex(g) { return gtIsOT(g) ? ((g.current_period || 1) - (g.num_periods || 2)) : 0; }

function gtPkKicks(g) { return (g && g.pk_kicks) || []; }
function gtPkScore(g) {
  var us = 0, them = 0;
  gtPkKicks(g).forEach(function(k){ if (k.outcome === 'goal') { if (k.team === 'us') us++; else them++; } });
  return { us: us, them: them };
}
function gtPkTurn(g) {
  // Penalties strictly alternate: whose kick is next, based on who shot first.
  var first = (g && g.pk_first) || 'us';
  return (gtPkKicks(g).length % 2 === 0) ? first : (first === 'us' ? 'them' : 'us');
}
function gtPkClinch(g) {
  // Returns 'us'|'them' when a team has mathematically clinched the shootout, else null.
  // Standard best-of-5, then sudden death (equal kicks, scores differ).
  var BEST = 5;
  var usG = 0, themG = 0, usT = 0, themT = 0;
  gtPkKicks(g).forEach(function(k){
    if (k.team === 'us') { usT++; if (k.outcome === 'goal') usG++; }
    else { themT++; if (k.outcome === 'goal') themG++; }
  });
  var usRem = Math.max(0, BEST - usT), themRem = Math.max(0, BEST - themT);
  // best-of-5 clinch (while either team still has regulation kicks)
  if (usT <= BEST && themT <= BEST) {
    if (usG > themG + themRem) return 'us';
    if (themG > usG + usRem) return 'them';
  }
  // sudden death: both past 5, equal kicks taken, scores differ
  if (usT >= BEST && themT >= BEST && usT === themT && usG !== themG) {
    return usG > themG ? 'us' : 'them';
  }
  return null;
}
function gtResultLabel(g) {
  var s = gtOurScore(g) + '–' + gtTheirScore(g);
  if (g && g.pk_winner) { var pk = gtPkScore(g); s += ' (' + pk.us + '–' + pk.them + ' pens)'; }
  return s;
}

function gtOurReds(gid) {
  var ev = gtGameEvents(gid);
  var reds = ev.filter(function(e){ return e.event_type === 'red_card'; }).length;
  var yc = {};
  ev.forEach(function(e){ if (e.event_type === 'yellow_card' && e.player_id) yc[e.player_id] = (yc[e.player_id] || 0) + 1; });
  Object.keys(yc).forEach(function(p){ if (yc[p] >= 2) reds++; });
  return reds;
}
function gtTheirReds(gid) {
  return gtGameEvents(gid).filter(function(e){ return e.event_type === 'opponent_red_card'; }).length;
}
function gtManDownHtml(g) {
  if (!g) return '';
  var our = gtOurReds(g.id), their = gtTheirReds(g.id);
  if (!our && !their) return '';
  var html = '<div class="gt-mandown-bar">';
  if (our) html += '<span class="gt-mandown">🟥 ' + gtEsc(gtOurName(g)) + ' down ' + (our > 1 ? ('×' + our) : 'a player') + '</span>';
  if (their) html += '<span class="gt-mandown">🟥 ' + gtEsc(gtTheirName(g)) + ' down ' + (their > 1 ? ('×' + their) : 'a player') + '</span>';
  return html + '</div>';
}

// ===================== RSVP (advance attendance) =====================
function gtUpcomingGames() {
  return GT.games.filter(function(g){ return g.status !== 'complete'; })
    .sort(function(a, b){ return gtGameSortMs(a) - gtGameSortMs(b); });
}
function gtGameRsvps(gid) { return GT.rsvp.filter(function(r){ return r.game_id === gid; }); }
function gtRsvp(gid, pid) { return GT.rsvp.find(function(r){ return r.game_id === gid && r.player_id === pid; }); }
function gtRsvpStatus(gid, pid) { var r = gtRsvp(gid, pid); return r ? r.status : ''; }
function gtRsvpTally(gid) {
  var t = { in: 0, out: 0, maybe: 0 };
  gtGameRsvps(gid).forEach(function(r){ if (!r.hidden && t[r.status] !== undefined) t[r.status]++; });
  return t;
}
function gtRsvpOpen(g) { return g && g.status === 'setup'; }   // frozen once a game kicks off
function gtSetRsvp(gid, pid, status, note) {
  var id = gid + '_' + pid;
  var data = {
    game_id: gid, player_id: pid, status: status, note: note || '',
    updated_by: gtPlayerName(pid), updated_at: firebase.firestore.FieldValue.serverTimestamp()
  };
  return db.collection('gt_rsvp').doc(id).set(data, { merge: true })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
// Which players this device manages (chosen from the roster, stored locally)
function gtMyRsvpPlayers() {
  try { return JSON.parse(localStorage.getItem('gt_rsvp_players') || '[]') || []; } catch (e) { return []; }
}
function gtSetMyRsvpPlayers(arr) {
  try { localStorage.setItem('gt_rsvp_players', JSON.stringify(arr || [])); } catch (e) {}
}
function gtIsMyRsvpPlayer(pid) { return gtMyRsvpPlayers().indexOf(pid) >= 0; }
function gtToggleMyRsvpPlayer(pid) {
  var arr = gtMyRsvpPlayers(), i = arr.indexOf(pid);
  if (i >= 0) arr.splice(i, 1); else arr.push(pid);
  gtSetMyRsvpPlayers(arr); gtRerender(true);
}

function gtGameCanceled(g) { return !!(g && typeof canceledEvents !== 'undefined' && canceledEvents['game_' + g.id]); }
function gtCampDayCanceled(dayId) { return !!(typeof canceledEvents !== 'undefined' && canceledEvents['camp_' + dayId]); }

var GT_ROUNDS = [['qf', 'Quarterfinal'], ['sf', 'Semifinal'], ['final', 'Final']];
function gtRoundLabel(r) { var m = { qf: 'Quarterfinal', sf: 'Semifinal', final: 'Final' }; return m[r] || ''; }
