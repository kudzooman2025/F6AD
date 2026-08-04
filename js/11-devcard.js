// ===================== PLAYER DEVELOPMENT CARDS (Phase 1a) =====================
// Private, development-focused evaluations rendered as FIFA-style cards.
// 1a = data model + coach evaluation + card computation. Scoped to the MLS Next AD
// 26/27 roster (active roster, no guests). Peer login + peer evals come in 1b.

var PD_ATTRS = [
  { id: 'speed',           label: 'Speed',          group: 'Athletic' },
  { id: 'endurance',       label: 'Endurance',      group: 'Athletic' },
  { id: 'work_rate',       label: 'Work-rate',      group: 'Athletic' },
  { id: 'strength',        label: 'Strength',       group: 'Athletic' },
  { id: 'first_touch',     label: 'First Touch',    group: 'Technical' },
  { id: 'passing',         label: 'Passing',        group: 'Technical' },
  { id: 'dribbling',       label: 'Dribbling',      group: 'Technical' },
  { id: 'shot_accuracy',   label: 'Shot Accuracy',  group: 'Technical' },
  { id: 'defending',       label: 'Defending',      group: 'Technical' },
  { id: 'decision_making', label: 'Decision-Making',group: 'Understanding' },
  { id: 'communication',   label: 'Communication',  group: 'Team & Growth' },
  { id: 'commitment',      label: 'Commitment',     group: 'Team & Growth' },
  { id: 'coachability',    label: 'Coachability',   group: 'Team & Growth' },
  { id: 'leadership',      label: 'Leadership',      group: 'Team & Growth' }
];
var PD_PERIODS = [['begin', 'Beginning of Season'], ['mid', 'Midseason'], ['end', 'End of Season']];
// Score is entered directly on the 0-99 scale. These tiers are the range explainers
// shown on cards (and live in the coach form).
var PD_TIERS = [
  { min: 90, short: 'Exceptional', label: 'Exceptional for the current team or age group' },
  { min: 75, short: 'Strong',      label: 'Strong' },
  { min: 65, short: 'Solid',       label: 'Solid for the current level' },
  { min: 50, short: 'Developing',  label: 'Developing' },
  { min: 0,  short: 'Needs development', label: 'Needs significant development' }
];
function pdClamp(v) { return Math.max(0, Math.min(99, Math.round(Number(v)))); }
function pdTier(v) { v = Number(v); for (var i = 0; i < PD_TIERS.length; i++) if (v >= PD_TIERS[i].min) return PD_TIERS[i]; return PD_TIERS[PD_TIERS.length - 1]; }
function pdTierLabel(v) { return (v == null || v === '') ? '' : pdTier(v).label; }
function pdTierShort(v) { return (v == null || v === '') ? '' : pdTier(v).short; }
function pdTierRanges() { return PD_TIERS.map(function(t, i){ var max = i > 0 ? PD_TIERS[i - 1].min - 1 : 99; return { min: t.min, max: max, label: t.label }; }); }
function pdShowTier(input, spanId) { var el = document.getElementById(spanId); if (el) el.textContent = input.value !== '' ? pdTierLabel(input.value) : ''; }
function pdPeriodLabel(p) { var m = { begin: 'Beginning of Season', mid: 'Midseason', end: 'End of Season' }; return m[p] || p; }
function pdPriorPeriod(p) { return p === 'end' ? 'mid' : p === 'mid' ? 'begin' : null; }
var pdSelectedPid = null;

// Roster: MLS Next AD 26/27 = active roster, NO guests.
function pdRosterPlayers() {
  var r = (typeof gtActiveRoster === 'function') ? gtActiveRoster() : null;
  if (!r || typeof gtRosterPlayers !== 'function') return [];
  return gtRosterPlayers(r.id).filter(function(p) { return !p.is_guest; })
    .sort(function(a, b) { return (a.jersey_number == null ? 999 : a.jersey_number) - (b.jersey_number == null ? 999 : b.jersey_number); });
}

// 1..5 -> FIFA 40..99
function pdFifa(v) { if (v == null || isNaN(v)) return null; return Math.max(40, Math.min(99, Math.round(40 + (v - 1) / 4 * 59))); }
function pdMedian(arr) { if (!arr.length) return null; var a = arr.slice().sort(function(x, y){ return x - y; }); var m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
function pdStdev(arr) { if (arr.length < 2) return 0; var mean = arr.reduce(function(s, x){ return s + x; }, 0) / arr.length; var v = arr.reduce(function(s, x){ return s + (x - mean) * (x - mean); }, 0) / arr.length; return Math.sqrt(v); }
function pdAgreement(arr) { if (arr.length < 2) return null; var sd = pdStdev(arr); return sd < 0.6 ? 'High' : sd < 1.1 ? 'Moderate' : 'Low'; }
var PD_MIN_PEERS = 5;

function pdConfig() { return (typeof pdConfigData !== 'undefined' && pdConfigData) ? pdConfigData : {}; }
function pdActivePeriod() { return pdConfig().active_period || null; }
function pdIsOpen() { var c = pdConfig(); return !!c.open && !!c.active_period; }

function pdEvalsFor(period, target) { return (typeof pdEvals !== 'undefined' ? pdEvals : []).filter(function(e){ return e.period === period && e.target_player_id === target; }); }
function pdCoachEval(period, target) { return pdEvalsFor(period, target).find(function(e){ return e.rater_type === 'coach'; }); }
function pdPeerEvals(period, target) { return pdEvalsFor(period, target).filter(function(e){ return e.rater_type === 'peer'; }); }

// Card for one player+period: per-attribute coach FIFA + peer median FIFA (gated at 5), agreement.
function pdCard(period, target) {
  var coach = pdCoachEval(period, target);
  var peers = pdPeerEvals(period, target);
  var attrs = PD_ATTRS.map(function(a) {
    var coachV = coach && coach.ratings ? coach.ratings[a.id] : null;
    var peerVals = peers.map(function(e){ return e.ratings ? e.ratings[a.id] : null; }).filter(function(x){ return x != null; });
    var enough = peerVals.length >= PD_MIN_PEERS;
    return {
      id: a.id, label: a.label, group: a.group,
      coach: (coachV != null && coachV !== '') ? pdClamp(coachV) : null,
      peer: enough ? pdClamp(pdMedian(peerVals)) : null,
      peerCount: peerVals.length,
      agreement: enough ? pdAgreement(peerVals) : null
    };
  });
  return { attrs: attrs, coachDone: !!coach, peerResponders: peers.length };
}

// ---------- coach controls + evaluation (admin) ----------
function pdSetPeriod(v) {
  if (!(isAdminUnlocked() || isCoachLoggedIn())) return;
  db.collection('pd_config').doc('main').set({ active_period: v || null }, { merge: true }).catch(function(e){ showToast('Error: ' + e.message); });
}
function pdSetOpen(v) {
  if (!(isAdminUnlocked() || isCoachLoggedIn())) return;
  db.collection('pd_config').doc('main').set({ open: !!v }, { merge: true }).catch(function(e){ showToast('Error: ' + e.message); });
}
function pdSelectPlayer(pid) { pdSelectedPid = pid || null; renderAdminDevCards(); }
function pdSaveCoachEval(pid) {
  if (!(isAdminUnlocked() || isCoachLoggedIn())) { showToast('Coach only.'); return; }
  var period = pdActivePeriod(); if (!period) { showToast('Pick an active period first.'); return; }
  var ratings = {}, any = false;
  PD_ATTRS.forEach(function(a) {
    var el = document.getElementById('pd-ce-' + a.id);
    var v = el ? el.value : '';
    if (v !== '') { var n = pdClamp(v); if (!isNaN(n)) { ratings[a.id] = n; any = true; } }
  });
  if (!any) { showToast('Rate at least one attribute.'); return; }
  db.collection('pd_evals').doc(period + '_coach_' + pid).set({
    period: period, rater_type: 'coach', rater_id: 'coach', target_player_id: pid,
    ratings: ratings, updated_at: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).then(function(){ showToast('Coach evaluation saved ✓'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}

function pdScoreChip(fifa) {
  if (fifa == null) return '<span class="pd-score pd-none">—</span>';
  var cls = fifa >= 90 ? 'pd-elite' : fifa >= 75 ? 'pd-strong' : fifa >= 65 ? 'pd-solid' : fifa >= 50 ? 'pd-developing' : 'pd-dev';
  return '<span class="pd-score ' + cls + '">' + fifa + '</span>';
}
function pdCardHtml(period, pid, opts) {
  opts = opts || {};
  var card = pdCard(period, pid);
  var prior = pdPriorPeriod(period);
  var priorCard = prior ? pdCard(prior, pid) : null;
  var rows = card.attrs.map(function(at, i) {
    var pf = priorCard ? priorCard.attrs[i].coach : null;
    var delta = (at.coach != null && pf != null) ? (at.coach - pf) : null;
    var deltaHtml = delta != null && delta !== 0 ? '<span class="pd-delta ' + (delta > 0 ? 'up' : 'down') + '">' + (delta > 0 ? '▲+' : '▼') + delta + '</span>' : '';
    var peerCell = at.peer != null
      ? pdScoreChip(at.peer) + '<span class="pd-tierlbl">' + gtEsc(pdTierShort(at.peer)) + '</span>' + (at.agreement ? '<span class="pd-agree pd-a-' + at.agreement.toLowerCase() + '">' + at.agreement + '</span>' : '')
      : '<span class="pd-note">' + (at.peerCount ? at.peerCount + '/' + PD_MIN_PEERS + ' responses' : 'No peer data') + '</span>';
    var coachTier = at.coach != null ? '<span class="pd-tierlbl">' + gtEsc(pdTierShort(at.coach)) + '</span>' : '';
    return '<tr><td class="pd-attr">' + gtEsc(at.label) + '</td>' +
      '<td class="num">' + pdScoreChip(at.coach) + coachTier + ' ' + deltaHtml + '</td>' +
      '<td class="num">' + peerCell + '</td></tr>';
  }).join('');
  // strengths / priorities (from coach ratings)
  var scored = card.attrs.filter(function(a){ return a.coach != null; }).slice().sort(function(a, b){ return b.coach - a.coach; });
  var strengths = scored.slice(0, 3).map(function(a){ return a.label; });
  var priorities = scored.slice(-3).reverse().map(function(a){ return a.label; });
  return '<div class="pd-card">' +
    '<div class="pd-card-body"><table class="pd-table"><thead><tr><th>Attribute</th><th class="num">Coach</th><th class="num">Peers</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    (scored.length ? '<div class="pd-summary"><div><strong>Strengths:</strong> ' + gtEsc(strengths.join(', ')) + '</div><div><strong>Work on next:</strong> ' + gtEsc(priorities.join(', ')) + '</div></div>' : '') +
    '<p class="pd-disclaimer">This card is a snapshot of where the player is today — not a ranking or a label. It can change with effort, practice, and coaching.</p>' +
    '</div></div>';
}

function renderAdminDevCards() {
  var box = document.getElementById('admin-devcards-list');
  if (!box) return;
  var players = pdRosterPlayers();
  var period = pdActivePeriod();
  var c = pdConfig();
  var ctrl = '<div class="pd-ctrl">' +
    '<label>Evaluation period</label>' +
    '<select onchange="pdSetPeriod(this.value)"><option value="">— None —</option>' +
    PD_PERIODS.map(function(pp){ return '<option value="' + pp[0] + '"' + (period === pp[0] ? ' selected' : '') + '>' + pp[1] + '</option>'; }).join('') + '</select>' +
    '<label style="display:inline-flex;align-items:center;gap:8px;margin-left:14px"><input type="checkbox"' + (c.open ? ' checked' : '') + ' onchange="pdSetOpen(this.checked)"/> Open for player submissions</label>' +
    '</div>';
  if (!players.length) { box.innerHTML = ctrl + '<p style="color:var(--muted);font-size:.85rem">No MLS Next AD roster players found (need an active roster).</p>'; return; }
  if (!period) { box.innerHTML = ctrl + '<p style="color:var(--muted);font-size:.85rem">Pick an evaluation period above to start recording coach evaluations.</p>'; return; }
  var sel = (pdSelectedPid && players.some(function(p){ return p.id === pdSelectedPid; })) ? pdSelectedPid : players[0].id;
  var opts = players.map(function(p) {
    var done = !!pdCoachEval(period, p.id);
    return '<option value="' + p.id + '"' + (sel === p.id ? ' selected' : '') + '>' + (p.jersey_number != null ? '#' + p.jersey_number + ' ' : '') + gtEsc(gtPlayerName(p.id)) + (done ? ' ✓' : '') + '</option>';
  }).join('');
  var coach = pdCoachEval(period, sel);
  var legend = '<div class="pd-legend">' + pdTierRanges().map(function(t){ return '<span class="pd-legend-item"><b>' + t.min + '–' + t.max + '</b> ' + gtEsc(t.label) + '</span>'; }).join('') + '</div>';
  var form = '<div class="pd-form"><div class="pd-form-title">Coach evaluation — ' + gtEsc(gtPlayerName(sel)) + ' · ' + pdPeriodLabel(period) + '</div>' +
    legend +
    '<div class="pd-grid">' + PD_ATTRS.map(function(a) {
      var cur = (coach && coach.ratings && coach.ratings[a.id] != null) ? coach.ratings[a.id] : '';
      return '<div class="pd-field"><label>' + gtEsc(a.label) + '</label>' +
        '<input type="number" min="0" max="99" id="pd-ce-' + a.id + '" value="' + cur + '" placeholder="0\u201399" oninput="pdShowTier(this,\'pd-tier-' + a.id + '\')"/>' +
        '<span class="pd-tierlbl" id="pd-tier-' + a.id + '">' + (cur !== '' ? gtEsc(pdTierLabel(cur)) : '') + '</span></div>';
    }).join('') + '</div>' +
    '<button class="btn-primary" style="margin-top:12px" onclick="pdSaveCoachEval(\'' + sel + '\')">Save Coach Evaluation</button></div>';
  box.innerHTML = ctrl +
    '<div class="pd-picker"><label>Player</label><select onchange="pdSelectPlayer(this.value)">' + opts + '</select></div>' +
    form +
    '<div class="section-title" style="margin:20px 0 10px">🃏 ' + gtEsc(gtPlayerName(sel)) + ' — ' + pdPeriodLabel(period) + ' card</div>' +
    pdCardHtml(period, sel);
}
// lazy listener for evaluations (staff-only read)
function attachDevCardsListener() {
  if (typeof _lazyOn === 'undefined') { window._lazyOn = window._lazyOn || {}; }
  if (_lazyOn.pd) return; _lazyOn.pd = true;
  db.collection('pd_evals').onSnapshot(function(snap) {
    pdEvals = snap.docs.map(function(d){ var o = d.data() || {}; o.id = d.id; return o; });
    if (typeof renderAdminDevCards === 'function' && document.getElementById('admin-devcards-list')) renderAdminDevCards();
  }, function(){});
}
