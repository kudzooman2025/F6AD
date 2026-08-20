// ===================== GUEST PLAYER SIGN-UP =====================
// Families apply from a banner on the home page (collection: gt_guest_apps).
// Staff see pending applications in their notifications and approve with one
// click, which creates the gt_players record that puts them in the guest pool.
// Rules: anyone may create; only staff may read, update or delete.

var guestApps = [];
var guestAppsListening = false;

// Staff-only read, so this listener is attached lazily — never for a visitor,
// whose snapshot would just fail with permission-denied.
function guestAppsListen() {
  if (guestAppsListening) return;
  if (typeof gtCanEdit !== 'function' || !gtCanEdit()) return;
  guestAppsListening = true;
  db.collection('gt_guest_apps').onSnapshot(function(snap) {
    guestApps = snap.docs.map(function(d){ var o = d.data() || {}; o.id = d.id; return o; });
    if (typeof renderGtReviewAlert === 'function') renderGtReviewAlert();
    if (typeof gtRerender === 'function') gtRerender();
  }, function(){ guestAppsListening = false; });
}
function guestAppsPending() {
  return (guestApps || []).filter(function(a){ return (a.status || 'pending') === 'pending'; })
    .sort(function(a, b){ return (b.created_at && b.created_at.toMillis ? b.created_at.toMillis() : 0) - (a.created_at && a.created_at.toMillis ? a.created_at.toMillis() : 0); });
}

// ---------- public: the banner + form ----------
function guestSignupOn() { return !!(typeof siteFlags !== 'undefined' && siteFlags && siteFlags.guest_signup_on); }
function renderGuestBanner() {
  var box = document.getElementById('guest-signup-banner');
  if (!box) return;
  box.innerHTML = guestSignupOn()
    ? '<div class="guest-banner"><div class="gb-text"><strong>⚽ Looking for game time?</strong>' +
      '<span>We take guest players for tournaments and league games. Tell us about your player and a coach will be in touch.</span></div>' +
      '<button class="gb-btn" onclick="openGuestSignup()">Sign up to be a guest player</button></div>'
    : '';
}
function openGuestSignup() { document.getElementById('guest-signup-overlay').classList.add('open'); }
// Shareable deep link: f6ad.space/#/guest-signup opens the form straight away, so
// the form is reachable even when the home-page banner is switched off.
function guestSignupUrl() {
  return window.location.origin + window.location.pathname + '#/guest-signup';
}
// Share the form. Phones get the native share sheet (text/WhatsApp/email in one
// tap); everything else falls back to copying the link.
function shareGuestSignup(btn) {
  var url = guestSignupUrl();
  var payload = { title: 'F6AD Guest Player Sign-Up', text: 'Sign up to be a guest player with F6AD:', url: url };
  if (navigator.share) {
    navigator.share(payload).catch(function(){});
    return;
  }
  var done = function() {
    if (!btn) { showToast('Link copied ✓'); return; }
    var o = btn.textContent; btn.textContent = '✓ Copied!';
    setTimeout(function(){ btn.textContent = o; }, 1800);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(done).catch(function(){ window.prompt('Copy this link:', url); });
  } else {
    window.prompt('Copy this link:', url);
  }
}
function guestSignupCheckHash() {
  if ((window.location.hash || '').indexOf('#/guest-signup') === 0) openGuestSignup();
}
window.addEventListener('hashchange', guestSignupCheckHash);
document.addEventListener('DOMContentLoaded', guestSignupCheckHash);
function closeGuestSignup() { document.getElementById('guest-signup-overlay').classList.remove('open'); }
function guestSignupOverlayClick(e) { if (e.target === document.getElementById('guest-signup-overlay')) closeGuestSignup(); }

function submitGuestSignup() {
  var val = function(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; };
  var player = val('ga-player'), parent = val('ga-parent'), phone = val('ga-phone'), email = val('ga-email');
  if (!player || !parent || !phone || !email) { showToast('Player name, parent name, phone and email are all required.'); return; }
  if (email.indexOf('@') < 0) { showToast('That email address does not look right.'); return; }
  db.collection('gt_guest_apps').add({
    player_name: player, parent_name: parent, phone: phone, email: email,
    position: val('ga-position'), current_team: val('ga-team'), location: val('ga-location'),
    referred_by: val('ga-referred'), notes: val('ga-notes'),
    status: 'pending', created_at: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function() {
    ['ga-player','ga-parent','ga-phone','ga-email','ga-position','ga-team','ga-location','ga-referred','ga-notes']
      .forEach(function(id){ var el = document.getElementById(id); if (el) el.value = ''; });
    closeGuestSignup();
    showToast('Thanks! Your application is in — a coach will review it. ✓');
  }).catch(function(e){ showToast('Error: ' + e.message); });
}

// ---------- staff: notification queue ----------
function gtGuestAppsQueueHtml(opts) {
  if (typeof gtCanEdit === 'function' && !gtCanEdit()) return '';
  guestAppsListen();
  var pending = guestAppsPending();
  if (!pending.length) return '';
  var rows = pending.map(function(a) {
    var bits = [a.position, a.current_team, a.location].filter(Boolean).join(' · ');
    return '<div class="gt-rq-row"><div class="gt-rq-info">' +
      '<strong>' + gtEsc(a.player_name || '(no name)') + '</strong>' +
      '<span class="gt-rq-meta">' + gtEsc(a.parent_name || '') + ' · ' + gtEsc(a.phone || '') + ' · ' + gtEsc(a.email || '') + '</span>' +
      (bits ? '<span class="gt-rq-meta">' + gtEsc(bits) + '</span>' : '') +
      (a.referred_by ? '<span class="gt-rq-meta">Referred by ' + gtEsc(a.referred_by) + '</span>' : '') +
      (a.notes ? '<span class="gt-rq-meta">“' + gtEsc(a.notes) + '”</span>' : '') +
      '</div><div class="gb-actions">' +
      '<button class="gt-rq-btn" onclick="approveGuestApp(\'' + a.id + '\')">✓ Approve</button>' +
      '<button class="gt-minibtn danger" onclick="declineGuestApp(\'' + a.id + '\')">Decline</button>' +
      '</div></div>';
  }).join('');
  return '<div class="gt-review-queue"><div class="gt-rq-head">🙋 ' + pending.length + ' guest player application' +
    (pending.length === 1 ? '' : 's') + ' awaiting approval</div>' + rows + '</div>';
}

// Approving writes the player straight into the guest pool, so they're pickable
// in game setup and in the mid-game "add player" list immediately.
function approveGuestApp(id) {
  if (typeof gtCanEdit === 'function' && !gtCanEdit()) { showToast('Coach login required.'); return; }
  var a = (guestApps || []).find(function(x){ return x.id === id; });
  if (!a) return;
  var parts = String(a.player_name || '').trim().split(/\s+/);
  var first = parts.shift() || a.player_name || 'Guest';
  var last = parts.join(' ');
  var ts = firebase.firestore.FieldValue.serverTimestamp();
  var pref = db.collection('gt_players').doc();
  var batch = db.batch();
  batch.set(pref, {
    roster_id: '__guests__', first_name: first, last_name: last, jersey_number: null,
    position: a.position || '', parent_name: a.parent_name || '', parent_phone: a.phone || '',
    parent_email: a.email || '', whatsapp_opt_in: false, is_guest: true,
    guest_app_id: id, created_at: ts
  });
  batch.set(db.collection('gt_guest_apps').doc(id), {
    status: 'approved', player_id: pref.id,
    decided_by: (typeof gtParentName === 'function' ? (gtParentName() || 'Coach') : 'Coach'), decided_at: ts
  }, { merge: true });
  batch.commit()
    .then(function(){ showToast(first + ' added to the guest pool ✓'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function declineGuestApp(id) {
  if (typeof gtCanEdit === 'function' && !gtCanEdit()) { showToast('Coach login required.'); return; }
  if (!confirm('Decline this guest player application? It stays on file but leaves your queue.')) return;
  db.collection('gt_guest_apps').doc(id).set({
    status: 'declined',
    decided_by: (typeof gtParentName === 'function' ? (gtParentName() || 'Coach') : 'Coach'),
    decided_at: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true })
    .then(function(){ showToast('Application declined.'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}

// ---------- admin: the on/off switch ----------
function toggleGuestSignup() {
  if (typeof isAdminUnlocked === 'function' && !isAdminUnlocked()) { showToast('Admin only.'); return; }
  var val = !guestSignupOn();
  db.collection('site_flags').doc('main').set({ guest_signup_on: val }, { merge: true })
    .then(function(){ showToast(val ? 'Guest sign-up banner is live.' : 'Guest sign-up banner hidden.'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function renderGuestFlagBox() {
  var box = document.getElementById('guest-signup-flag-box');
  if (!box) return;
  var on = guestSignupOn();
  box.innerHTML = '<p style="font-weight:800;font-size:.9rem;margin:0 0 6px">Guest Player Sign-Up</p>' +
    '<p style="font-size:.75rem;color:var(--muted);margin:0 0 8px">Shows a "sign up to be a guest player" banner on the home page. Applications land in your notifications for approval — turning the banner off never hides ones already submitted.</p>' +
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid var(--border)">' +
    '<span style="font-size:.86rem">Home page banner <span style="color:var(--muted);font-size:.78rem">(' + (on ? 'showing' : 'hidden') + ')</span></span>' +
    '<button class="btn-edit" onclick="toggleGuestSignup()">' + (on ? '🙈 Hide' : '↩ Show') + '</button></div>' +
    '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 0 0">' +
    '<input readonly value="' + guestSignupUrl() + '" onclick="this.select()" style="flex:1;min-width:190px;border:1px solid var(--border);border-radius:5px;padding:6px 10px;font-size:.76rem;font-family:monospace"/>' +
    '<button class="btn-primary" style="padding:6px 14px;font-size:.78rem" onclick="copyLink(guestSignupUrl(),this)">🔗 Copy link</button></div>' +
    '<p style="font-size:.74rem;color:var(--muted);margin:8px 0 0">Send this to families directly — it opens the form even with the banner hidden.</p>';
}
