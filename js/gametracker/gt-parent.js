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
  { id: 'tackle',  label: 'Tackle',    emoji: '🛡️', stat: 'tackle' }
];
var GT_PARENT_CLAIMABLE = ['sub_on', 'sub_off', 'assist', 'shot', 'sot', 'save', 'tackle'];
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
  db.collection('gt_parent_events').add({
    game_id: gid, player_id: pid, author_token: gtParentToken(), author_name: gtParentName(),
    type: type, game_clock_seconds: gtClockSeconds(g), period: g.current_period || 1,
    text: '', visibility: 'private', created_at: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(){ showToast(gtParentType(type).emoji + ' ' + gtParentType(type).label + ' logged (private)'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function gtParentNote(gid, pid) {
  if (!gtParentName()) { showToast('Add your name first.'); return; }
  var inp = document.getElementById('gt-pnote-input'); var text = (inp ? inp.value : '').trim(); if (!text) return;
  var g = gtGame(gid); if (!g) return;
  db.collection('gt_parent_events').add({
    game_id: gid, player_id: pid, author_token: gtParentToken(), author_name: gtParentName(),
    type: 'note', game_clock_seconds: gtClockSeconds(g), period: g.current_period || 1,
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
  var mine = gtMyRsvpPlayers().filter(function(pid){ return gtAvailIds(g.id).indexOf(pid) >= 0; });
  var avail = gtAvailIds(g.id).map(function(pid){ return gtP(pid); }).filter(Boolean)
    .sort(function(a, b){ return (a.jersey_number == null ? 999 : a.jersey_number) - (b.jersey_number == null ? 999 : b.jersey_number); });
  var head = '<div class="gt-parent-head">👨‍👩‍👧 Track My Player <span class="gt-parent-sub">private to you until you share</span></div>';
  if (!mine.length) {
    if (!avail.length) return '';
    var opts = avail.map(function(p){ return '<option value="' + p.id + '">' + (p.jersey_number != null ? '#' + p.jersey_number + ' ' : '') + gtEsc(gtPlayerName(p.id)) + '</option>'; }).join('');
    return '<div class="gt-parent">' + head + '<div class="gt-parent-body"><label class="gt-parent-lbl">Which player are you here for?</label>' +
      '<select class="rsvp-idselect" onchange="if(this.value){gtToggleMyRsvpPlayer(this.value);GT.parentTrackPid=this.value;gtRerender(true);}"><option value="">Choose your player…</option>' + opts + '</select></div></div>';
  }
  var pid = gtParentTrackPid(g);
  var switcher = mine.length > 1
    ? '<select class="rsvp-idselect" style="max-width:240px;margin-bottom:10px" onchange="GT.parentTrackPid=this.value;gtRerender(true)">' + mine.map(function(id){ return '<option value="' + id + '"' + (id === pid ? ' selected' : '') + '>' + gtEsc(gtPlayerName(id)) + '</option>'; }).join('') + '</select>'
    : '';
  if (!gtParentName()) {
    return '<div class="gt-parent">' + head + '<div class="gt-parent-body">' + switcher +
      '<label class="gt-parent-lbl">Your name (so stats are attributed):</label>' +
      '<div class="gt-chat-bar"><input id="gt-chat-name" placeholder="Your name…" onkeydown="if(event.key===\'Enter\')gtSetChatName()"/><button class="btn-primary" onclick="gtSetChatName()">Start tracking</button></div></div></div>';
  }
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
      gtEsc(e.type === 'note' ? ('“' + e.text + '”') : t.label) + (e.visibility === 'public' ? ' <span class="gt-plog-pub">shared</span>' : '') +
      '<button class="gt-plog-x" title="Delete" onclick="gtParentDelete(\'' + e.id + '\')">✕</button></div>';
  }).join('') : '<div class="gt-parent-empty">No stats logged yet — tap a button above.</div>';
  return '<div class="gt-parent">' + head + '<div class="gt-parent-body">' + switcher +
    '<div class="gt-parent-who">Tracking <strong>' + gtEsc(gtPlayerName(pid)) + '</strong> as ' + gtEsc(gtParentName()) + ' · <a onclick="gtSetChatName(true)">change name</a></div>' +
    '<div class="gt-claim-row"><span class="gt-claim-lbl">I\'m tracking:</span>' + claimChips + '</div>' +
    '<div class="gt-pstat-grid">' + statBtns + '</div>' +
    '<div class="gt-chat-bar" style="margin-top:8px"><input id="gt-pnote-input" placeholder="Timestamped note (private)…" value="' + gtAttr(GT.pnoteDraft || '') + '" oninput="GT.pnoteDraft=this.value" onkeydown="if(event.key===\'Enter\')gtParentNote(\'' + g.id + '\',\'' + pid + '\')"/><button class="btn-primary" onclick="gtParentNote(\'' + g.id + '\',\'' + pid + '\')">Note</button></div>' +
    '<div class="gt-plog">' + logHtml + '</div>' +
    '</div></div>';
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
