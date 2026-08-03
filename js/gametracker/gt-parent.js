// ===================== PARENT STAT TRACKING =====================
// Parents log stats for their OWN child during a live game. Private by default;
// at game end they publish selected items (public), which fold into team stats.
// Collections: gt_parent_events, gt_parent_claims. Identity reuses the device's
// "who are you here for" (gtMyRsvpPlayers) + chat display name.

var GT_PARENT_TYPES = [
  { id: 'started', label: 'Started',   emoji: '🟢', stat: false },
  { id: 'sub_on',  label: 'Sub On',    emoji: '🔺', stat: false },
  { id: 'sub_off', label: 'Sub Off',   emoji: '🔻', stat: false },
  { id: 'assist',  label: 'Assist',    emoji: '🅰️', stat: 'assist' },
  { id: 'shot',    label: 'Shot',      emoji: '💨', stat: 'shot' },
  { id: 'sot',     label: 'On Target', emoji: '🎯', stat: 'shot_on_target' },
  { id: 'save',    label: 'Save',      emoji: '🧤', stat: 'save' },
  { id: 'tackle',  label: 'Tackle',    emoji: '🛡️', stat: 'tackle' },
  { id: 'pass',    label: 'Pass',      emoji: '➡️', stat: 'pass' },
  { id: 'pass_comp', label: 'Pass Comp', emoji: '✅', stat: 'pass_comp' }
];
var GT_PARENT_CLAIMABLE = ['sub_on', 'sub_off', 'assist', 'shot', 'sot', 'save', 'tackle', 'pass', 'pass_comp'];
function gtParentType(id) { return GT_PARENT_TYPES.find(function(t){ return t.id === id; }) || { id: id, label: id, emoji: '•', stat: false }; }

function gtParentToken() {
  try {
    var t = localStorage.getItem('gt_parent_token');
    if (!t) { t = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); localStorage.setItem('gt_parent_token', t); }
    return t;
  } catch (e) { return 'p_anon'; }
}
function gtParentName() { return (typeof gtChatName === 'function') ? gtChatName() : ''; }
function gtParentTrackPid(g) {
  var mine = gtMyRsvpPlayers().filter(function(pid){ return gtAvailIds(g.id).indexOf(pid) >= 0; });
  if (GT.parentTrackPid && mine.indexOf(GT.parentTrackPid) >= 0) return GT.parentTrackPid;
  return mine[0] || null;
}
function gtParentSetTrack(pid) {
  GT.parentTrackPid = pid || null;
  if (pid) { var arr = gtMyRsvpPlayers(); if (arr.indexOf(pid) < 0) { arr.push(pid); gtSetMyRsvpPlayers(arr); } }
  gtRerender(true);
}
function gtParentTrackSelect(g, pid) {
  var avail = gtAvailIds(g.id).map(function(id){ return gtP(id); }).filter(Boolean)
    .sort(function(a, b){ return (a.jersey_number == null ? 999 : a.jersey_number) - (b.jersey_number == null ? 999 : b.jersey_number); });
  return '<label class="gt-parent-lbl">Which player are you tracking?</label>' +
    '<select class="rsvp-idselect" style="max-width:280px;margin-bottom:12px" onchange="gtParentSetTrack(this.value)">' +
    '<option value="">Choose your player…</option>' +
    avail.map(function(p){ return '<option value="' + p.id + '"' + (p.id === pid ? ' selected' : '') + '>' + (p.jersey_number != null ? '#' + p.jersey_number + ' ' : '') + gtEsc(gtPlayerName(p.id)) + '</option>'; }).join('') +
    '</select>';
}

// ---- data accessors ----
function gtParentEventsFor(gid, pid) { return (GT.parentEvents || []).filter(function(e){ return e.game_id === gid && (!pid || e.player_id === pid); }); }
function gtMyParentEvents(gid, pid) {
  var tok = gtParentToken();
  return gtParentEventsFor(gid, pid).filter(function(e){ return e.author_token === tok; })
    .sort(function(a, b){ return gtTsMillis(a.created_at) - gtTsMillis(b.created_at); });
}
function gtPublicParentEvents(gid) { return gtParentEventsFor(gid).filter(function(e){ return e.visibility === 'public'; }); }
// published parent STAT events, shaped like gt_events so aggregations count them
function gtPublicParentStatEvents(gid) {
  return gtPublicParentEvents(gid).map(function(e){
    var t = gtParentType(e.type);
    if (!t.stat) return null;
    return { id: 'pp_' + e.id, game_id: e.game_id, player_id: e.player_id, event_type: t.stat, period: e.period || 1, game_clock_seconds: e.game_clock_seconds || 0, notes: e.text || '', source: 'parent', parent_event_id: e.id };
  }).filter(Boolean);
}
// coach events + published parent stat events (for STAT totals only)
function gtGameEventsForStats(gid) { return gtGameEvents(gid).concat(gtPublicParentStatEvents(gid)); }
function gtParentPublicPlayerIds(gid) {
  var s = {}; gtPublicParentStatEvents(gid).forEach(function(e){ if (e.player_id) s[e.player_id] = true; });
  return Object.keys(s);
}

// ---- claims (coordination between multiple parents) ----
function gtParentClaimId(gid, pid, tok) { return gid + '_' + pid + '_' + tok; }
function gtParentMyClaims(gid, pid) {
  var c = (GT.parentClaims || []).find(function(x){ return x.id === gtParentClaimId(gid, pid, gtParentToken()); });
  return (c && c.types) || [];
}
function gtParentOtherClaims(gid, pid) {
  var tok = gtParentToken(), m = {};
  (GT.parentClaims || []).forEach(function(c){
    if (c.game_id === gid && c.player_id === pid && c.author_token !== tok) {
      (c.types || []).forEach(function(ty){ (m[ty] = m[ty] || []).push(c.author_name || 'Someone'); });
    }
  });
  return m;
}
function gtParentToggleClaim(gid, pid, type) {
  var tok = gtParentToken(), name = gtParentName() || 'A parent';
  var cur = gtParentMyClaims(gid, pid).slice(), i = cur.indexOf(type);
  if (i >= 0) cur.splice(i, 1);
  else {
    cur.push(type);
    var others = gtParentOtherClaims(gid, pid)[type];
    if (others && others.length) showToast('Heads up: ' + others.join(' & ') + ' is already tracking ' + gtParentType(type).label + ' for ' + gtPlayerShort(pid) + " — you'll both log these.");
  }
  db.collection('gt_parent_claims').doc(gtParentClaimId(gid, pid, tok)).set({
    game_id: gid, player_id: pid, author_token: tok, author_name: name, types: cur,
    updated_at: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch(function(e){ showToast('Error: ' + e.message); });
}

// ---- logging ----
function gtParentLog(gid, pid, type) {
  if (!gtParentName()) { showToast('Add your name in the panel first so stats are attributed.'); return; }
  var g = gtGame(gid); if (!g) return;
  var _t = gtParentEventTime(g);
  db.collection('gt_parent_events').add({
    game_id: gid, player_id: pid, author_token: gtParentToken(), author_name: gtParentName(),
    type: type, game_clock_seconds: _t.sec, period: _t.period, mode: _t.mode,
    text: '', visibility: 'private', created_at: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(){ showToast(gtParentType(type).emoji + ' ' + gtParentType(type).label + ' logged (private)'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function gtParentNote(gid, pid) {
  if (!gtParentName()) { showToast('Add your name first.'); return; }
  var inp = document.getElementById('gt-pnote-input'); var text = (inp ? inp.value : '').trim(); if (!text) return;
  var g = gtGame(gid); if (!g) return;
  var _t = gtParentEventTime(g);
  db.collection('gt_parent_events').add({
    game_id: gid, player_id: pid, author_token: gtParentToken(), author_name: gtParentName(),
    type: 'note', game_clock_seconds: _t.sec, period: _t.period, mode: _t.mode,
    text: text, visibility: 'private', created_at: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(){ GT.pnoteDraft = ''; var i = document.getElementById('gt-pnote-input'); if (i) { i.value = ''; i.focus(); } })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function gtParentDelete(id) {
  db.collection('gt_parent_events').doc(id).delete().catch(function(e){ showToast('Error: ' + e.message); });
}
function gtParentSetVisibility(id, vis) {
  db.collection('gt_parent_events').doc(id).set({ visibility: vis, updated_at: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function gtParentPublishAll(gid, pid, includeNotes) {
  var items = gtMyParentEvents(gid, pid).filter(function(e){ return e.visibility !== 'public' && (includeNotes || e.type !== 'note'); });
  if (!items.length) { showToast('Nothing new to share.'); return; }
  var batch = db.batch();
  items.forEach(function(e){ batch.set(db.collection('gt_parent_events').doc(e.id), { visibility: 'public', updated_at: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }); });
  batch.commit().then(function(){ showToast('Shared ' + items.length + ' item' + (items.length === 1 ? '' : 's') + ' to the team ✓'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}

// ---- live panel ----
function gtParentClock(g, e) {
  if (g.status === 'setup' && !e.game_clock_seconds) return 'pre';
  return gtFmtMMSS(gtDisplayCumSec(g, e.period, e.game_clock_seconds)) + "'";
}
function gtParentPanelHtml(g) {
  if (!g || g.status === 'complete' || gtGameCanceled(g)) return '';
  var avail = gtAvailIds(g.id).map(function(pid){ return gtP(pid); }).filter(Boolean)
    .sort(function(a, b){ return (a.jersey_number == null ? 999 : a.jersey_number) - (b.jersey_number == null ? 999 : b.jersey_number); });
  var head = '<div class="gt-parent-head">👨‍👩‍👧 Track My Player <span class="gt-parent-sub">private to you until you share</span></div>';
  if (!avail.length) return '';
  var pid = gtParentTrackPid(g);
  var selector = gtParentTrackSelect(g, pid);
  // no player chosen yet — just show the dropdown
  if (!pid) {
    return '<div class="gt-parent">' + head + '<div class="gt-parent-body">' + selector + '</div></div>';
  }
  // player chosen, but no name yet
  if (!gtParentName()) {
    return '<div class="gt-parent">' + head + '<div class="gt-parent-body">' + selector +
      '<label class="gt-parent-lbl">Your name (so stats are attributed):</label>' +
      '<div class="gt-chat-bar"><input id="gt-chat-name" placeholder="Your name…" onkeydown="if(event.key===\'Enter\')gtSetChatName()"/><button class="btn-primary" onclick="gtSetChatName()">Start tracking</button></div></div></div>';
  }
  return '<div class="gt-parent">' + head + '<div class="gt-parent-body">' + selector + gtParentBodyHtml(g, pid) + '</div></div>';
}
// Shared inner UI (who-line, claim chips, stat grid, note bar, log) used by both the
// live panel and the film-session panel. Logging auto-detects the active clock.
function gtParentBodyHtml(g, pid) {
  var others = gtParentOtherClaims(g.id, pid), myClaims = gtParentMyClaims(g.id, pid);
  var claimChips = GT_PARENT_CLAIMABLE.map(function(ty){
    var t = gtParentType(ty), on = myClaims.indexOf(ty) >= 0, oth = others[ty];
    return '<button class="gt-claim-chip' + (on ? ' on' : '') + (oth ? ' conflict' : '') + '" onclick="gtParentToggleClaim(\'' + g.id + '\',\'' + pid + '\',\'' + ty + '\')" title="' + (oth ? 'Also tracked by ' + gtAttr(oth.join(', ')) : 'Claim ' + t.label) + '">' + (on ? '✓ ' : '') + t.emoji + ' ' + t.label + (oth ? ' ⚠' : '') + '</button>';
  }).join('');
  var statBtns = GT_PARENT_TYPES.map(function(t){
    return '<button class="gt-pstat-btn" onclick="gtParentLog(\'' + g.id + '\',\'' + pid + '\',\'' + t.id + '\')"><span class="ps-emoji">' + t.emoji + '</span><span class="ps-lbl">' + t.label + '</span></button>';
  }).join('');
  var mylog = gtMyParentEvents(g.id, pid);
  var logHtml = mylog.length ? mylog.slice().reverse().map(function(e){
    var t = gtParentType(e.type);
    return '<div class="gt-plog-row"><span class="gt-plog-t">[' + gtParentClock(g, e) + ']</span> ' + t.emoji + ' ' +
      gtEsc(e.type === 'note' ? ('“' + e.text + '”') : t.label) + (e.mode === 'film' ? ' <span class="gt-film-tag">film</span>' : '') + (e.visibility === 'public' ? ' <span class="gt-plog-pub">shared</span>' : '') +
      '<button class="gt-plog-x" title="Delete" onclick="gtParentDelete(\'' + e.id + '\')">✕</button></div>';
  }).join('') : '<div class="gt-parent-empty">No stats logged yet — tap a button above.</div>';
  return '<div class="gt-parent-who">Tracking <strong>' + gtEsc(gtPlayerName(pid)) + '</strong> as ' + gtEsc(gtParentName()) + ' · <a onclick="gtSetChatName(true)">change name</a></div>' +
    '<div class="gt-claim-row"><span class="gt-claim-lbl">I\'m tracking:</span>' + claimChips + '</div>' +
    '<div class="gt-pstat-grid">' + statBtns + '</div>' +
    '<div class="gt-chat-bar" style="margin-top:8px"><input id="gt-pnote-input" placeholder="Timestamped note (private)…" value="' + gtAttr(GT.pnoteDraft || '') + '" oninput="GT.pnoteDraft=this.value" onkeydown="if(event.key===\'Enter\')gtParentNote(\'' + g.id + '\',\'' + pid + '\')"/><button class="btn-primary" onclick="gtParentNote(\'' + g.id + '\',\'' + pid + '\')">Note</button></div>' +
    '<div class="gt-plog">' + logHtml + '</div>';
}

// ---- review: share panel (my private items) ----
function gtParentSharePanelHtml(g) {
  if (!g) return '';
  var loggedPids = {}; gtMyParentEvents(g.id).forEach(function(e){ loggedPids[e.player_id] = true; });
  var pids = Object.keys(loggedPids);
  if (!pids.length) return '';
  var html = '<div class="gt-parent"><div class="gt-parent-head">📤 Share Your Tracked Stats <span class="gt-parent-sub">what you share joins the team totals</span></div><div class="gt-parent-body">';
  pids.forEach(function(pid){
    var items = gtMyParentEvents(g.id, pid);
    html += '<div class="gt-share-player"><div class="gt-share-name">' + gtEsc(gtPlayerName(pid)) + '</div>';
    html += items.map(function(e){
      var t = gtParentType(e.type);
      return '<label class="gt-share-row"><input type="checkbox"' + (e.visibility === 'public' ? ' checked' : '') + ' onchange="gtParentSetVisibility(\'' + e.id + '\',this.checked?\'public\':\'private\')"/> <span class="gt-plog-t">[' + gtParentClock(g, e) + ']</span> ' + t.emoji + ' ' + gtEsc(e.type === 'note' ? ('“' + e.text + '”') : t.label) + (e.type === 'note' ? ' <span class="gt-note-tag">note</span>' : '') + '</label>';
    }).join('');
    html += '<div class="gt-share-actions"><button class="gt-minibtn" onclick="gtParentPublishAll(\'' + g.id + '\',\'' + pid + '\',false)">Share all stats</button><button class="gt-minibtn" onclick="gtParentPublishAll(\'' + g.id + '\',\'' + pid + '\',true)">Share incl. notes</button></div></div>';
  });
  html += '<div class="gt-parent-note">Notes stay private unless you check them. Shared stats add to that player\'s team totals.</div></div></div>';
  return html;
}

// ---- review: public parent-reported section (visible to all; coach can remove) ----
function gtParentReviewSectionHtml(g) {
  if (!g) return '';
  var pub = gtPublicParentEvents(g.id).slice().sort(function(a, b){ return gtCumSec(g, a.period, a.game_clock_seconds) - gtCumSec(g, b.period, b.game_clock_seconds); });
  if (!pub.length) return '';
  var canEd = gtCanEdit();
  var rows = pub.map(function(e){
    var t = gtParentType(e.type);
    return '<div class="gt-fitem"><span class="fi-min">[' + gtFmtMMSS(gtDisplayCumSec(g, e.period, e.game_clock_seconds)) + "']</span> " +
      t.emoji + ' <strong>' + gtEsc(gtPlayerShort(e.player_id)) + '</strong> ' + gtEsc(e.type === 'note' ? ('“' + e.text + '”') : t.label) +
      ' <span class="gt-parent-badge">parent-reported · ' + gtEsc(e.author_name || '') + '</span>' +
      (canEd ? '<button class="gt-plog-x" title="Remove" onclick="gtParentDelete(\'' + e.id + '\')">✕</button>' : '') + '</div>';
  }).join('');
  return '<div class="section-title" style="margin:26px 0 12px">👨‍👩‍👧 Parent-Reported' + (canEd ? ' <span style="font-size:.72rem;color:var(--muted);font-weight:600;text-transform:none">tap ✕ to remove</span>' : '') + '</div><div class="gt-feed">' + rows + '</div>';
}


// ===================== FILM SESSION (post-game watch-back) =====================
// A device-local clock the parent syncs to their video. Stats logged during a film
// session are timestamped from this clock (not the game's finished clock).
function gtFilmActive(gid) { return !!(GT.film && GT.film.on && GT.film.gameId === gid); }
function gtFilmSeconds() {
  if (!GT.film) return 0;
  var b = GT.film.base || 0;
  if (GT.film.running && GT.film.startedAt) b += (Date.now() - GT.film.startedAt) / 1000;
  return Math.max(0, b);
}
function gtFilmToPeriod(g, T) {
  var dur = (g.period_duration_minutes || 0) * 60, np = g.num_periods || 2;
  if (dur <= 0) return { period: 1, sec: Math.round(T) };
  var period = Math.min(np, Math.floor(T / dur) + 1);
  return { period: period, sec: Math.round(T - (period - 1) * dur) };
}
function gtParentEventTime(g) {
  if (gtFilmActive(g.id)) { var m = gtFilmToPeriod(g, gtFilmSeconds()); return { period: m.period, sec: m.sec, mode: 'film' }; }
  return { period: g.current_period || 1, sec: gtClockSeconds(g), mode: 'live' };
}
function gtFilmStartTimer() {
  if (GT.filmTimer) return;
  GT.filmTimer = setInterval(function() {
    var el = document.getElementById('gt-film-clock');
    if (!el) { clearInterval(GT.filmTimer); GT.filmTimer = null; return; }
    el.textContent = gtFmtMMSS(Math.floor(gtFilmSeconds()));
  }, 500);
}
function gtFilmOpen(gid) { GT.film = { gameId: gid, on: true, running: false, base: 0, startedAt: null }; gtFilmStartTimer(); gtRerender(true); }
function gtFilmToggle(gid) {
  if (!gtFilmActive(gid)) return;
  if (GT.film.running) { GT.film.base = gtFilmSeconds(); GT.film.running = false; GT.film.startedAt = null; }
  else { GT.film.running = true; GT.film.startedAt = Date.now(); gtFilmStartTimer(); }
  gtRerender(true);
}
function gtFilmSet(gid) {
  if (!gtFilmActive(gid)) return;
  var el = document.getElementById('gt-film-set');
  var mmss = gtParseMMSS(el ? el.value : '');
  if (mmss == null) { showToast('Enter the time as MM:SS.'); return; }
  GT.film.base = mmss; if (GT.film.running) GT.film.startedAt = Date.now();
  showToast('Film clock synced to ' + gtFmtMMSS(mmss)); gtRerender(true);
}
function gtParentFilmPanelHtml(g) {
  if (!g || g.status !== 'complete' || gtGameCanceled(g)) return '';
  var avail = gtAvailIds(g.id).map(function(id){ return gtP(id); }).filter(Boolean);
  if (!avail.length) return '';
  var head = '<div class="gt-parent-head">🎬 Film Session <span class="gt-parent-sub">log stats while you rewatch — synced to your video</span></div>';
  if (!gtFilmActive(g.id)) {
    return '<div class="gt-parent">' + head + '<div class="gt-parent-body"><div class="gt-parent-note" style="margin:0 0 12px">Watching the game video? Start a film session, sync the clock to your video, then log stats for your player as you watch. Private until you share.</div>' +
      '<button class="btn-primary" onclick="gtFilmOpen(\'' + g.id + '\')">🎬 Start film session</button></div></div>';
  }
  var pid = gtParentTrackPid(g);
  var selector = gtParentTrackSelect(g, pid);
  var running = GT.film.running;
  var clockUi = '<div class="gt-film-clockbar">' +
    '<span class="gt-film-clock" id="gt-film-clock">' + gtFmtMMSS(Math.floor(gtFilmSeconds())) + '</span>' +
    '<button class="gt-cbtn ' + (running ? 'gt-cbtn-warn' : 'gt-cbtn-go') + '" onclick="gtFilmToggle(\'' + g.id + '\')">' + (running ? '⏸ Pause' : '▶ Play') + '</button>' +
    '<span class="gt-film-sync"><input id="gt-film-set" placeholder="MM:SS" value="' + gtFmtMMSS(Math.floor(gtFilmSeconds())) + '"/><button class="gt-minibtn" onclick="gtFilmSet(\'' + g.id + '\')">Sync to video</button></span>' +
    '</div><div class="gt-film-hint">Type the time shown on your video and hit “Sync to video,” then Play in step with it. Every stat you log stamps to this clock.</div>';
  if (!gtParentName()) {
    return '<div class="gt-parent">' + head + '<div class="gt-parent-body">' + clockUi + selector +
      '<label class="gt-parent-lbl">Your name (so stats are attributed):</label>' +
      '<div class="gt-chat-bar"><input id="gt-chat-name" placeholder="Your name…" onkeydown="if(event.key===\'Enter\')gtSetChatName()"/><button class="btn-primary" onclick="gtSetChatName()">Start tracking</button></div></div></div>';
  }
  if (!pid) return '<div class="gt-parent">' + head + '<div class="gt-parent-body">' + clockUi + selector + '</div></div>';
  return '<div class="gt-parent">' + head + '<div class="gt-parent-body">' + clockUi + selector + gtParentBodyHtml(g, pid) + '</div></div>';
}
