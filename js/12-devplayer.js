// ===================== PLAYER DEVELOPMENT — PLAYER SIDE (1b) =====================
// Players sign in anonymously (no email/PII), a coach approves them, then they submit
// anonymous peer evaluations and view ONLY their own published card. Families evaluate
// from their existing account (see renderFamilyPanel).

function pdMyUid() { return authUser ? authUser.uid : null; }
function pdMyLink() { var u = pdMyUid(); if (!u) return null; return (pdPlayerLinks || []).find(function(l){ return l.uid === u; }); }
function pdMyApproved() { var l = pdMyLink(); return l && l.status === 'approved' ? l : null; }
function pdMyPlayerId() { var l = pdMyApproved(); return l ? l.player_id : null; }
function pdRated(period, pid) { try { return localStorage.getItem('pd_rated_' + period + '_' + pid) === '1'; } catch (e) { return false; } }

var _pdLinksListening = false;
function pdAttachPlayerLinksListener() {
  if (_pdLinksListening) return; _pdLinksListening = true;
  db.collection('pd_player_links').onSnapshot(function(snap){
    pdPlayerLinks = snap.docs.map(function(d){ var o = d.data() || {}; o.id = d.id; return o; });
    renderPlayerDevPanel(); pdPlayerListen();
  }, function(){});
}
function openPlayerDev(e) { if (e && e.preventDefault) e.preventDefault(); document.getElementById('playerdev-overlay').classList.add('open'); pdAttachPlayerLinksListener(); renderPlayerDevPanel(); pdPlayerListen(); }
function closePlayerDev() { document.getElementById('playerdev-overlay').classList.remove('open'); }
function playerDevOverlayClick(e) { if (e.target === document.getElementById('playerdev-overlay')) closePlayerDev(); }

function pdPlayerSignIn() {
  firebase.auth().signInAnonymously()
    .then(function(){ showToast('Signed in — pick your name.'); renderPlayerDevPanel(); pdPlayerListen(); })
    .catch(function(e){
      if ((e.code || '').indexOf('operation-not-allowed') >= 0) showToast('Anonymous sign-in is not enabled in Firebase yet (Authentication → Sign-in method).');
      else showToast('Error: ' + e.message);
    });
}
function pdPlayerRequestLink() {
  var u = pdMyUid(); if (!u) { showToast('Sign in first.'); return; }
  var sel = document.getElementById('pd-whoami'); var pid = sel ? sel.value : '';
  if (!pid) { showToast('Pick your name.'); return; }
  db.collection('pd_player_links').doc(u + '_' + pid).set({
    uid: u, player_id: pid, player_name: gtPlayerName(pid), status: 'pending',
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(){ showToast('Sent — your coach will approve it.'); }).catch(function(e){ showToast('Error: ' + e.message); });
}
function pdPlayerSignOut() { firebase.auth().signOut().then(function(){ showToast('Signed out.'); renderPlayerDevPanel(); }); }

var _pdPlayerListening = {};
function pdPlayerListen() {
  var pid = pdMyPlayerId(); if (!pid) return;
  PD_PERIODS.forEach(function(pp) {
    var key = pid + '_' + pp[0];
    if (_pdPlayerListening[key]) return; _pdPlayerListening[key] = true;
    db.collection('pd_cards').doc(key).onSnapshot(function(doc){
      pdMyCards[pp[0]] = doc.exists ? doc.data() : null;
      renderPlayerDevPanel();
    }, function(){});
  });
}

function pdPeerEvalForm(targetPid) {
  var done = pdRated(pdActivePeriod(), targetPid);
  return '<div class="pd-peer-form"><div class="pd-form-title">' + gtEsc(gtPlayerName(targetPid)) + (done ? ' <span class="fam-badge ok">Submitted</span>' : '') + '</div>' +
    '<div class="pd-grid">' + PD_ATTRS.map(function(a) {
      return '<div class="pd-field"><label>' + gtEsc(a.label) + ' <button type="button" class="pd-info" title="' + gtAttr(a.desc) + '" onclick="pdToggleDesc(\'pd-pd-' + targetPid + '-' + a.id + '\')">i</button></label>' +
        '<div class="pd-desc" id="pd-pd-' + targetPid + '-' + a.id + '" style="display:none">' + gtEsc(a.desc) + '</div>' +
        '<input type="number" min="0" max="99" id="pd-pe-' + targetPid + '-' + a.id + '" placeholder="0–99" oninput="pdShowTier(this,\'pd-pt-' + targetPid + '-' + a.id + '\')"/>' +
        '<span class="pd-tierlbl" id="pd-pt-' + targetPid + '-' + a.id + '"></span></div>';
    }).join('') + '</div>' +
    '<button class="btn-primary" style="margin-top:10px" onclick="pdSavePeerEval(\'' + targetPid + '\')">' + (done ? 'Update rating' : 'Submit rating') + '</button></div>';
}
function pdSavePeerEval(targetPid) {
  var myPid = pdMyPlayerId(); if (!myPid) { showToast('Not approved yet.'); return; }
  var period = pdActivePeriod(); if (!period || !pdIsOpen()) { showToast('Evaluations are closed right now.'); return; }
  var ratings = {}, any = false;
  PD_ATTRS.forEach(function(a) { var el = document.getElementById('pd-pe-' + targetPid + '-' + a.id); var v = el ? el.value : ''; if (v !== '') { var n = pdClamp(v); if (!isNaN(n)) { ratings[a.id] = n; any = true; } } });
  if (!any) { showToast('Rate at least one attribute.'); return; }
  db.collection('pd_evals').doc(period + '_peer_' + myPid + '_' + targetPid).set({
    period: period, rater_type: 'peer', rater_id: myPid, target_player_id: targetPid,
    ratings: ratings, updated_at: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(){ try { localStorage.setItem('pd_rated_' + period + '_' + targetPid, '1'); } catch (e) {} showToast('Rating saved ✓'); renderPlayerDevPanel(); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}

function pdPlayerCardHtml(pid) {
  var period = pdActivePeriod();
  // show the latest published period if the active one isn't published
  var order = ['end', 'mid', 'begin'];
  var shown = (period && pdMyCards[period]) ? period : order.find(function(pp){ return pdMyCards[pp]; });
  if (!shown || !pdMyCards[shown]) return '<div class="gt-empty">Your card isn\'t ready to view yet — check back after your coach publishes it.</div>';
  var doc = pdMyCards[shown];
  var prior = pdPriorPeriod(shown);
  var priorAttrs = (prior && pdMyCards[prior]) ? pdMyCards[prior].attrs : null;
  return '<div class="section-title" style="margin:6px 0 10px">🃏 Your card · ' + pdPeriodLabel(shown) + '</div>' + pdCardRender(doc.attrs, priorAttrs);
}

function renderPlayerDevPanel() {
  var box = document.getElementById('playerdev-body'); if (!box) return;
  // must be signed in AND anonymous-ish (a player). Staff/family use their own areas.
  if (!authUser) {
    box.innerHTML = '<p style="font-size:.9rem;color:var(--muted);margin-bottom:14px">Sign in as a player to rate your teammates and see your development card. No email needed — your coach approves you.</p>' +
      '<button class="btn-primary" onclick="pdPlayerSignIn()">🔒 Sign in as a player</button>';
    return;
  }
  if (!authUser.isAnonymous) {
    var famPids = (typeof familyLinks !== 'undefined' ? familyLinks : []).filter(function(l){ return l.uid === authUser.uid && l.status === 'approved'; }).map(function(l){ return l.player_id; });
    var isStaffUser = (typeof isAdminUnlocked === 'function' && isAdminUnlocked()) || (typeof isCoachLoggedIn === 'function' && isCoachLoggedIn());
    if (isStaffUser && !famPids.length) famPids = pdRosterPlayers().map(function(p){ return p.id; });
    if (famPids.length) {
      var name = (typeof familyName === 'function' ? familyName() : '') || (authUser.email ? authUser.email.split('@')[0] : '');
      box.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:4px"><span style="font-size:.88rem">Signed in as <strong>' + gtEsc(name) + '</strong></span></div>' +
        pdFamilyEvalUI(famPids);
      return;
    }
    box.innerHTML = '<p style="font-size:.9rem;line-height:1.5">You\'re signed in, but this account has no linked player.</p>' +
      '<p style="font-size:.84rem;color:var(--muted);margin-top:8px">Claim your player first (Profiles → Create Profile / your account), then a coach approves you.</p>';
    return;
  }
  var link = pdMyLink();
  if (!link) {
    var players = pdRosterPlayers();
    box.innerHTML = '<p style="font-size:.88rem;margin-bottom:10px">Which player are you?</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><select id="pd-whoami" class="rsvp-idselect" style="max-width:260px"><option value="">Choose your name…</option>' +
      players.map(function(p){ return '<option value="' + p.id + '">' + (p.jersey_number != null ? '#' + p.jersey_number + ' ' : '') + gtEsc(gtPlayerName(p.id)) + '</option>'; }).join('') + '</select>' +
      '<button class="btn-primary" onclick="pdPlayerRequestLink()">Request access</button></div>' +
      '<p style="font-size:.75rem;color:var(--muted);margin-top:10px"><a onclick="pdPlayerSignOut()" style="cursor:pointer;color:#5A3FD6">Sign out</a></p>';
    return;
  }
  if (link.status !== 'approved') {
    box.innerHTML = '<p style="font-size:.9rem">Waiting for your coach to approve you as <strong>' + gtEsc(gtPlayerName(link.player_id)) + '</strong> ⏳</p>' +
      '<p style="font-size:.75rem;color:var(--muted);margin-top:10px"><a onclick="pdPlayerSignOut()" style="cursor:pointer;color:#5A3FD6">Sign out</a></p>';
    return;
  }
  var myPid = link.player_id;
  var period = pdActivePeriod();
  var html = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px"><span style="font-size:.88rem">You are <strong>' + gtEsc(gtPlayerName(myPid)) + '</strong> <span class="fam-badge ok">Player</span></span><button class="btn-edit" onclick="pdPlayerSignOut()">Sign Out</button></div>';
  // peer evals (if open)
  if (period && pdIsOpen()) {
    var teammates = pdRosterPlayers().filter(function(p){ return p.id !== myPid; });
    html += '<div class="section-title" style="margin:6px 0 8px">Rate your teammates · ' + pdPeriodLabel(period) + '</div>' +
      '<div class="pd-instr"><strong>Be honest, but never mean.</strong> Rate what you\'ve actually seen this season, not just your friends. Your individual ratings are anonymous — the goal is to help teammates grow.</div>' +
      '<div class="pd-teammate-picker"><label>Teammate</label><select onchange="document.querySelectorAll(\'.pd-peer-block\').forEach(function(b){b.style.display=\'none\'});var t=document.getElementById(\'pdpb-\'+this.value);if(t)t.style.display=\'block\'">' +
      '<option value="">Choose a teammate…</option>' + teammates.map(function(p){ return '<option value="' + p.id + '">' + gtEsc(gtPlayerName(p.id)) + (pdRated(period, p.id) ? ' ✓' : '') + '</option>'; }).join('') + '</select></div>' +
      teammates.map(function(p){ return '<div class="pd-peer-block" id="pdpb-' + p.id + '" style="display:none">' + pdPeerEvalForm(p.id) + '</div>'; }).join('');
  } else {
    html += '<div class="pd-instr">Teammate ratings are closed right now. Your coach opens them at the start, middle, and end of the season.</div>';
  }
  // own card
  html += pdPlayerCardHtml(myPid);
  box.innerHTML = html;
}

// ---------- family evaluation (from the family account) ----------
var pdFamEvalPid = null;
function pdSetFamEval(pid) { pdFamEvalPid = pid || null; if (typeof renderFamilyPanel === 'function') renderFamilyPanel(); }
function pdFamilyEvalSection(mineLinks) {
  var pids = (mineLinks || []).filter(function(l){ return l.status === 'approved'; }).map(function(l){ return l.player_id; });
  return pdFamilyEvalUI(pids);
}
function pdFamilyEvalUI(pids) {
  pids = (pids || []).filter(function(x){ return !!x; });
  if (!pids.length) return '';
  var period = pdActivePeriod();
  var head = '<hr style="margin:18px 0;border:none;border-top:1px solid var(--border)"><p style="font-weight:800;font-size:.9rem;margin:0 0 6px">🃏 Player development — family evaluation</p>';
  if (!period || !pdIsOpen()) return head + '<p style="font-size:.8rem;color:var(--muted)">Family evaluations are closed right now. Your coach opens them at the start, middle, and end of the season.</p>';
  var pid = (pdFamEvalPid && pids.indexOf(pdFamEvalPid) >= 0) ? pdFamEvalPid : null;
  var picker = '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px"><label style="font-size:.82rem;font-weight:700">Evaluate</label><select class="rsvp-idselect" style="max-width:220px" onchange="pdSetFamEval(this.value)"><option value="">Choose your player…</option>' +
    pids.map(function(id){ return '<option value="' + id + '"' + (pid === id ? ' selected' : '') + '>' + gtEsc(gtPlayerName(id)) + '</option>'; }).join('') + '</select></div>';
  if (!pid) return head + picker;
  var relSel = '<div class="pd-field" style="max-width:220px"><label>Your relationship</label><select id="pd-fe-rel">' +
    PD_RELATIONSHIPS.map(function(r){ return '<option value="' + r[0] + '">' + r[1] + '</option>'; }).join('') + '</select></div>';
  var grid = '<div class="pd-grid">' + PD_ATTRS.map(function(a) {
    return '<div class="pd-field"><label>' + gtEsc(a.label) + ' <button type="button" class="pd-info" title="' + gtAttr(a.desc) + '" onclick="pdToggleDesc(\'pd-fd-' + a.id + '\')">i</button></label>' +
      '<div class="pd-desc" id="pd-fd-' + a.id + '" style="display:none">' + gtEsc(a.desc) + '</div>' +
      '<input type="number" min="0" max="99" id="pd-fe-' + a.id + '" placeholder="0–99" oninput="pdShowTier(this,\'pd-ft-' + a.id + '\')"/>' +
      '<span class="pd-tierlbl" id="pd-ft-' + a.id + '"></span></div>';
  }).join('') + '</div>';
  return head + picker + '<div class="pd-form" style="margin-top:0">' + relSel + '<div class="pd-instr" style="margin-top:8px">This is your family\'s perspective on ' + gtEsc(gtPlayerName(pid)) + ' — a snapshot to support their growth, not a ranking. Individual ratings stay private.</div>' + grid +
    '<button class="btn-primary" style="margin-top:12px" onclick="pdSaveFamilyEval(\'' + pid + '\')">Submit family evaluation</button></div>';
}
function pdSaveFamilyEval(pid) {
  if (!authUser) { showToast('Sign in first.'); return; }
  var period = pdActivePeriod(); if (!period || !pdIsOpen()) { showToast('Evaluations are closed.'); return; }
  var rel = (document.getElementById('pd-fe-rel') || {}).value || 'other';
  var ratings = {}, any = false;
  PD_ATTRS.forEach(function(a) { var el = document.getElementById('pd-fe-' + a.id); var v = el ? el.value : ''; if (v !== '') { var n = pdClamp(v); if (!isNaN(n)) { ratings[a.id] = n; any = true; } } });
  if (!any) { showToast('Rate at least one attribute.'); return; }
  db.collection('pd_evals').doc(period + '_family_' + authUser.uid + '_' + pid).set({
    period: period, rater_type: 'family', rater_id: authUser.uid, relationship: rel, target_player_id: pid,
    ratings: ratings, updated_at: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(){ showToast('Family evaluation saved ✓'); }).catch(function(e){ showToast('Error: ' + e.message); });
}
