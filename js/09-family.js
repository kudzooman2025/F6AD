// ===================== FAMILY ACCOUNTS (Phase 1) =====================
// Parents create a family account (Firebase Auth), claim their kid(s) from the
// roster, and a coach approves the link. Approved families own their kids' profiles.
// Data: families/{uid}, family_links/{uid_playerId}.

function famTs() { return firebase.firestore.FieldValue.serverTimestamp(); }
function famVal(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
function famErr(msg) {
  var el = document.getElementById('family-error');
  if (el) { el.textContent = msg || ''; el.style.display = msg ? 'block' : 'none'; }
}
function myFamilyLinks() {
  if (!authUser) return [];
  return (familyLinks || []).filter(function(l){ return l.uid === authUser.uid; });
}
function familyName() {
  var f = (familyData && authUser) ? familyData[authUser.uid] : null;
  if (f && f.name) return f.name;
  return authUser ? authUser.email.split('@')[0] : '';
}
function familyLinkFor(pid) { return myFamilyLinks().find(function(l){ return l.player_id === pid; }); }
function familyOwnsPlayer(pid) { var l = familyLinkFor(pid); return !!(l && l.status === 'approved'); }

// ---------- overlay ----------
function openFamily(e) { if (e && e.preventDefault) e.preventDefault(); document.getElementById('family-overlay').classList.add('open'); renderFamilyPanel(); }
function closeFamily() { document.getElementById('family-overlay').classList.remove('open'); }
function familyOverlayClick(e) { if (e.target === document.getElementById('family-overlay')) closeFamily(); }

function renderFamilyPanel() {
  var box = document.getElementById('family-body');
  if (!box) return;
  // signed out (or signed in as staff) -> show family sign-in/up
  if (!authUser) {
    box.innerHTML =
      '<p style="font-size:.9rem;color:var(--muted);margin-bottom:14px">Create a family account to track your player, manage their profile, and share highlights &amp; stats.</p>' +
      '<div class="login-form">' +
      '<label>Your name</label><input type="text" id="fam-name" placeholder="The Elwood Family"/>' +
      '<label style="margin-top:10px">Email</label><input type="text" id="fam-email" placeholder="you@example.com"/>' +
      '<label style="margin-top:10px">Password</label><input type="password" id="fam-pw" placeholder="At least 8 characters" onkeydown="if(event.key===\'Enter\')familySignIn()"/>' +
      '<div class="login-error" id="family-error" style="display:none"></div>' +
      '<div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap"><button class="btn-primary" onclick="familySignIn()">Sign In</button>' +
      '<button class="btn-edit" onclick="familyCreateAccount()">Create account</button>' +
      '<button class="t-notes-toggle" style="margin:0" onclick="authSendReset(document.getElementById(\'fam-email\').value.trim())">Forgot password?</button></div>' +
      '</div>';
    return;
  }
  // signed in — show claim + my players
  var mine = myFamilyLinks();
  var claimed = {}; mine.forEach(function(l){ claimed[l.player_id] = true; });
  var players = (typeof GT !== 'undefined' && GT.players ? GT.players : []).filter(function(p){ return !p.is_guest && !claimed[p.id]; })
    .sort(function(a, b){ return gtPlayerName(a.id).localeCompare(gtPlayerName(b.id)); });
  var opts = '<option value="">Choose your player…</option>' + players.map(function(p){
    return '<option value="' + p.id + '">' + (p.jersey_number != null ? '#' + p.jersey_number + ' ' : '') + gtEsc(gtPlayerName(p.id)) + '</option>';
  }).join('');
  var rows = mine.length ? mine.map(function(l){
    var nm = gtPlayerName(l.player_id);
    var badge = l.status === 'approved'
      ? '<span class="fam-badge ok">✓ Approved</span>'
      : '<span class="fam-badge pending">⏳ Pending coach approval</span>';
    var actions = l.status === 'approved'
      ? '<a class="gt-minibtn" href="#/gametracker/player/' + l.player_id + '" onclick="closeFamily()">View profile</a>'
      : '';
    return '<div class="fam-row"><span class="fam-pname">' + gtEsc(nm) + '</span>' + badge + actions +
      '<button class="gt-plog-x" title="Remove" onclick="familyUnclaim(\'' + l.player_id + '\')">✕</button></div>';
  }).join('') : '<div class="gt-parent-empty">No players linked yet — claim your child below.</div>';
  box.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:14px">' +
    '<span style="font-size:.88rem">Signed in as <strong>' + gtEsc(familyName()) + '</strong> <span style="color:var(--muted)">(' + gtEsc(authUser.email) + ')</span></span>' +
    '<button class="btn-edit" onclick="familySignOut()">Sign Out</button></div>' +
    '<p style="font-weight:800;font-size:.9rem;margin:0 0 8px">My Players</p>' +
    '<div class="fam-list">' + rows + '</div>' +
    '<hr style="margin:18px 0;border:none;border-top:1px solid var(--border)">' +
    '<p style="font-weight:800;font-size:.9rem;margin:0 0 8px">Claim your player</p>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
    '<select id="fam-claim-select" class="rsvp-idselect" style="max-width:300px">' + opts + '</select>' +
    '<button class="btn-primary" onclick="familyClaimPlayer()">Request link</button></div>' +
    '<p style="font-size:.75rem;color:var(--muted);margin-top:8px">A coach approves each link so only your family can manage your child\'s profile.</p>';
}

// ---------- family auth ----------
function familySignIn() {
  var email = famVal('fam-email'), pw = famVal('fam-pw');
  if (!email || !pw) { famErr('Enter your email and password.'); return; }
  firebase.auth().signInWithEmailAndPassword(email, pw)
    .then(function(){ famErr(''); showToast('Signed in ✓'); renderFamilyPanel(); })
    .catch(function(e){ famErr(authErrMsg(e)); });
}
function familyCreateAccount() {
  var email = famVal('fam-email'), pw = famVal('fam-pw'), name = famVal('fam-name');
  if (!email || !pw) { famErr('Enter your email and password.'); return; }
  if (pw.length < 8) { famErr('Password must be at least 8 characters.'); return; }
  firebase.auth().createUserWithEmailAndPassword(email, pw)
    .then(function(cred){
      db.collection('families').doc(cred.user.uid).set({ name: name || '', email: email, created_at: famTs() }, { merge: true }).catch(function(){});
      famErr(''); showToast('Family account created ✓'); renderFamilyPanel();
    })
    .catch(function(e){ famErr(authErrMsg(e)); });
}
function familySignOut() { firebase.auth().signOut().then(function(){ showToast('Signed out.'); renderFamilyPanel(); }); }

// ---------- claims ----------
function familyClaimPlayer() {
  if (!authUser) { showToast('Sign in first.'); return; }
  var pid = famVal('fam-claim-select');
  if (!pid) { showToast('Pick your player.'); return; }
  if (familyLinkFor(pid)) { showToast('You already requested this player.'); return; }
  db.collection('family_links').doc(authUser.uid + '_' + pid).set({
    uid: authUser.uid, player_id: pid, family_name: familyName(), email: authUser.email,
    status: 'pending', created_at: famTs()
  }).then(function(){ showToast('Requested — a coach will approve it.'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function familyUnclaim(pid) {
  if (!authUser) return;
  if (!confirm('Remove ' + gtPlayerName(pid) + ' from your family?')) return;
  db.collection('family_links').doc(authUser.uid + '_' + pid).delete()
    .then(function(){ showToast('Removed.'); }).catch(function(e){ showToast('Error: ' + e.message); });
}

// ---------- admin approval ----------
function renderAdminFamilies() {
  var box = document.getElementById('admin-families-list');
  if (!box) return;
  var staff = (typeof isAdminUnlocked === 'function' && isAdminUnlocked()) || (typeof isCoachLoggedIn === 'function' && isCoachLoggedIn());
  var pending = (familyLinks || []).filter(function(l){ return l.status !== 'approved'; });
  var approved = (familyLinks || []).filter(function(l){ return l.status === 'approved'; });
  function row(l, isPending) {
    return '<div class="admin-item"><div class="admin-item-info"><strong>' + gtEsc(gtPlayerName(l.player_id)) + '</strong>' +
      ' <span style="color:var(--muted);font-size:.82rem">← ' + gtEsc(l.family_name || l.email || '') + ' (' + gtEsc(l.email || '') + ')</span></div>' +
      '<div class="admin-item-actions">' +
      (isPending ? '<button class="btn-primary" onclick="familyApprove(\'' + l.id + '\')">✓ Approve</button>' : '') +
      '<button class="btn-edit" onclick="familyDeny(\'' + l.id + '\')">' + (isPending ? 'Deny' : 'Remove') + '</button></div></div>';
  }
  box.innerHTML =
    '<p style="font-weight:800;font-size:.9rem;margin:0 0 8px">Pending requests (' + pending.length + ')</p>' +
    (pending.length ? pending.map(function(l){ return row(l, true); }).join('') : '<p style="font-size:.84rem;color:var(--muted)">None right now.</p>') +
    '<p style="font-weight:800;font-size:.9rem;margin:18px 0 8px">Linked families (' + approved.length + ')</p>' +
    (approved.length ? approved.map(function(l){ return row(l, false); }).join('') : '<p style="font-size:.84rem;color:var(--muted)">No approved links yet.</p>');
}
function familyApprove(id) {
  if (!(isAdminUnlocked() || isCoachLoggedIn())) { showToast('Staff only.'); return; }
  db.collection('family_links').doc(id).set({ status: 'approved' }, { merge: true })
    .then(function(){ showToast('Approved ✓'); }).catch(function(e){ showToast('Error: ' + e.message); });
}
function familyDeny(id) {
  if (!(isAdminUnlocked() || isCoachLoggedIn())) { showToast('Staff only.'); return; }
  if (!confirm('Remove this family link?')) return;
  db.collection('family_links').doc(id).delete()
    .then(function(){ showToast('Removed.'); }).catch(function(e){ showToast('Error: ' + e.message); });
}

// ===================== FAMILY PROFILES (Phase 2) =====================
function gtProfile(pid) { return (typeof playerProfiles !== 'undefined' && playerProfiles[pid]) || {}; }
function familyOwnsPlayerAny(pid) { return (typeof familyOwnsPlayer === 'function') && familyOwnsPlayer(pid); }
function canEditProfile(pid) {
  return (typeof gtCanEdit === 'function' && gtCanEdit()) || familyOwnsPlayerAny(pid);
}
function openProfileEdit(pid) {
  if (!canEditProfile(pid)) { showToast('Only staff or the linked family can edit this profile.'); return; }
  var pr = gtProfile(pid);
  gtOpenModal(
    '<h3>✏️ Edit Profile — ' + gtEsc(gtPlayerName(pid)) + '<button class="gm-close" onclick="gtCloseModal()">✕</button></h3>' +
    '<label>Photo URL</label><input type="text" id="pf-photo" value="' + gtAttr(pr.photo_url || '') + '" placeholder="https://…/photo.jpg"/>' +
    '<label>Class year</label><input type="text" id="pf-class" value="' + gtAttr(pr.class_year || '') + '" placeholder="2030"/>' +
    '<label>Bio</label><textarea id="pf-bio" placeholder="A little about the player…">' + gtEsc(pr.bio || '') + '</textarea>' +
    '<label>Featured highlight links (one per line)</label><textarea id="pf-highlights" placeholder="https://youtu.be/…">' + gtEsc((pr.featured_highlights || []).join('\n')) + '</textarea>' +
    '<label>Visibility</label><select id="pf-vis"><option value="public"' + (pr.visibility !== 'unlisted' ? ' selected' : '') + '>Public (anyone with the link)</option><option value="unlisted"' + (pr.visibility === 'unlisted' ? ' selected' : '') + '>Unlisted (link only, not featured)</option></select>' +
    '<div class="gm-actions"><button class="btn-primary" onclick="saveProfileEdit(\'' + pid + '\')">Save Profile</button><button class="gt-minibtn" onclick="gtCloseModal()">Cancel</button></div>'
  );
}
function saveProfileEdit(pid) {
  if (!canEditProfile(pid)) return;
  var hl = ((document.getElementById('pf-highlights') || {}).value || '').split(/\n+/).map(function(x){ return x.trim(); }).filter(Boolean);
  db.collection('player_profiles').doc(pid).set({
    photo_url: (document.getElementById('pf-photo') || {}).value.trim(),
    class_year: (document.getElementById('pf-class') || {}).value.trim(),
    bio: (document.getElementById('pf-bio') || {}).value.trim(),
    featured_highlights: hl,
    visibility: (document.getElementById('pf-vis') || {}).value,
    updated_at: famTs()
  }, { merge: true }).then(function(){ showToast('Profile saved ✓'); gtCloseModal(); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
