// ===================== AUTH (Firebase Authentication) =====================
// Bootstrap admins for THIS deployment — see js/00-config.js.
const OWNER_EMAILS = APP_CONFIG.ownerEmails || [];
var authUser = null, authRole = null, authStaffName = '';
var coachName = '';  // set from staff record after Firebase sign-in
var staffData = {}, staffUnsub = null;
localStorage.removeItem('f6ad_pw'); // legacy device password — no longer used
function renderNavAuth() {
  var el = document.getElementById('nav-auth');
  if (!el) return;
  el.style.display = '';
  if (!authUser) { el.textContent = 'Sign In'; return; }
  var role = (typeof isAdminUnlocked === 'function' && isAdminUnlocked()) ? 'Admin'
    : (typeof isCoachLoggedIn === 'function' && isCoachLoggedIn()) ? 'Coach' : 'Family';
  var nm = authStaffName || (typeof familyName === 'function' ? familyName() : '') || authUser.email.split('@')[0];
  el.textContent = 'Sign Out (' + nm + ' · ' + role + ')';
}
function navAuthClick(e) {
  e.preventDefault();
  if (authUser) { authSignOut(); return; }
  if (typeof openFamily === 'function') openFamily(e); else openAdmin();
}
function isAdminUnlocked() { return authRole === 'admin' && !viewAsParent; }
function isCoachLoggedIn() { return (authRole === 'admin' || authRole === 'coach') && !viewAsParent; }
function isRealAdmin() { return authRole === 'admin'; }
function renderViewToggle() {
  var el = document.getElementById('view-toggle');
  if (el) {
    if (isRealAdmin()) { el.style.display = ''; el.textContent = viewAsParent ? '🛠 View as Admin' : '👤 View as Parent'; }
    else { el.style.display = 'none'; }
  }
  var adminBtn = document.querySelector('.btn-admin');
  if (adminBtn) adminBtn.style.display = (isRealAdmin() && viewAsParent) ? 'none' : '';
}
function toggleViewAs() {
  viewAsParent = !viewAsParent;
  try { localStorage.setItem('f6ad_view_as', viewAsParent ? 'parent' : 'admin'); } catch (e) {}
  if (viewAsParent && typeof closeAdmin === 'function') closeAdmin();
  showToast(viewAsParent ? 'Now viewing the site as a parent.' : 'Back to admin view.');
  authRefreshUI();
  if (typeof siteRender === 'function') siteRender();
}
function authIsOwner(u) { return !!u && OWNER_EMAILS.indexOf(u.email) >= 0 && u.emailVerified; }

function authRefreshUI() {
  renderNavAuth();
  renderCoachBar();
  if (typeof renderViewToggle === 'function') renderViewToggle();
  var overlay = document.getElementById('admin-overlay');
  if (overlay && overlay.classList.contains('open')) {
    if (isAdminUnlocked()) showAdminPanel();
    else if (isCoachLoggedIn()) closeAdmin();
    else {
      document.getElementById('admin-panel').style.display = 'none';
      document.getElementById('admin-login').style.display = '';
    }
  }
  if (typeof renderFamilyPanel === 'function') renderFamilyPanel();
  if (typeof renderAdminFamilies === 'function' && document.getElementById('admin-families-list')) renderAdminFamilies();
  if (typeof renderPlayerDevPanel === 'function') renderPlayerDevPanel();
  if (typeof gtRerender === 'function') gtRerender(true);
}
function subscribeStaff() {
  if (staffUnsub) { staffUnsub(); staffUnsub = null; }
  staffData = {};
  if (authRole !== 'admin') return;
  staffUnsub = tdb('staff').onSnapshot(function(snap) {
    staffData = {};
    snap.forEach(function(d){ staffData[d.id] = d.data(); });
    var adminPanel = document.getElementById('admin-panel');
    if (adminPanel && adminPanel.style.display !== 'none') {
      var tabCoaches = document.getElementById('tab-coaches');
      if (tabCoaches && tabCoaches.classList.contains('active')) renderAdminCoaches();
    }
  }, function(){ /* permissions race during sign-out */ });
}
firebase.auth().onAuthStateChanged(function(u) {
  authUser = u;
  if (u && u.email) {
    tdb('user_directory').doc(u.uid).set({ email: u.email, name: u.displayName || '', last_seen: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(function(){});
  }
  if (!u) {
    authRole = null; authStaffName = ''; coachName = '';
    subscribeStaff(); authRefreshUI();
    return;
  }
  tdb('staff').doc(u.uid).get().then(function(doc) {
    if (doc.exists) {
      authRole = doc.data().role === 'admin' ? 'admin' : 'coach';
      authStaffName = doc.data().name || u.email;
    } else if (authIsOwner(u)) {
      authRole = 'admin'; authStaffName = 'Chris';
      tdb('staff').doc(u.uid).set({
        name: 'Chris', email: u.email, role: 'admin',
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch(function(e){ showToast('Heads up: could not save your staff record (' + e.message + ')'); });
    } else {
      authRole = null; authStaffName = '';
    }
    coachName = isCoachLoggedIn() ? authStaffName : '';
    subscribeStaff(); authRefreshUI();
  }).catch(function() {
    if (authIsOwner(u)) { authRole = 'admin'; authStaffName = 'Chris'; }
    else { authRole = null; authStaffName = ''; }
    coachName = isCoachLoggedIn() ? authStaffName : '';
    subscribeStaff(); authRefreshUI();
  });
});
function authErrMsg(e) {
  var c = e.code || '';
  if (c.indexOf('user-not-found') >= 0 || c.indexOf('wrong-password') >= 0 || c.indexOf('invalid-credential') >= 0 || c.indexOf('invalid-login-credentials') >= 0) return 'Email or password incorrect.';
  if (c.indexOf('too-many-requests') >= 0) return 'Too many attempts — wait a few minutes and try again.';
  if (c.indexOf('operation-not-allowed') >= 0) return 'Email/password sign-in is not enabled in Firebase yet (see Authentication → Sign-in method).';
  if (c.indexOf('email-already-in-use') >= 0) return 'That email already has an account.';
  if (c.indexOf('invalid-email') >= 0) return 'Invalid email address.';
  if (c.indexOf('weak-password') >= 0) return 'Password too weak — use at least 8 characters.';
  if (c.indexOf('network') >= 0) return 'Network error — check your connection.';
  return e.message || 'Sign-in failed.';
}
function authShowErr(errEl, msg) {
  if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
  else showToast(msg);
}
function authSignIn(email, pw, errEl) {
  if (!email || !pw) { authShowErr(errEl, 'Enter email and password.'); return; }
  firebase.auth().signInWithEmailAndPassword(email, pw)
    .then(function(cred) {
      if (OWNER_EMAILS.indexOf(cred.user.email) >= 0 && !cred.user.emailVerified) {
        cred.user.sendEmailVerification().catch(function(){});
        authShowErr(errEl, 'Verify your email first — a new verification link was just sent. Click it, then sign in again.');
        return firebase.auth().signOut();
      }
      showToast('Signed in ✓');
    })
    .catch(function(e){ authShowErr(errEl, authErrMsg(e)); });
}
function authCreateAccount(email, pw, errEl) {
  if (!email || !pw) { authShowErr(errEl, 'Enter email and password.'); return; }
  if (pw.length < 8) { authShowErr(errEl, 'Password must be at least 8 characters.'); return; }
  firebase.auth().createUserWithEmailAndPassword(email, pw)
    .then(function(cred) {
      cred.user.sendEmailVerification().catch(function(){});
      if (OWNER_EMAILS.indexOf(cred.user.email) >= 0) {
        authShowErr(errEl, 'Account created! Check your inbox for a verification link, then sign in.');
        return firebase.auth().signOut();
      }
      showToast('Account created. Ask the team owner to add you as staff before you can manage anything.');
    })
    .catch(function(e){ authShowErr(errEl, authErrMsg(e)); });
}
function authSendReset(email) {
  email = (email || '').trim();
  if (!email) {
    email = (window.prompt('Enter the email address for your account:') || '').trim();
    if (!email) return;
  }
  firebase.auth().sendPasswordResetEmail(email)
    .then(function(){ showToast('If an account exists for ' + email + ', a reset link is on its way. Check your inbox AND spam — it can take a few minutes.'); })
    .catch(function(e){
      var c = e.code || '';
      if (c.indexOf('user-not-found') >= 0) { showToast('No account found for ' + email + '. Check the address, or have the owner create it.'); return; }
      if (c.indexOf('invalid-email') >= 0) { showToast('That is not a valid email address.'); return; }
      if (c.indexOf('too-many-requests') >= 0) { showToast('Too many attempts — wait a few minutes and try again.'); return; }
      if (c.indexOf('operation-not-allowed') >= 0) { showToast('Email/password sign-in is not enabled in Firebase (Authentication -> Sign-in method).'); return; }
      showToast(authErrMsg(e));
    });
}
function authSignOut() {
  firebase.auth().signOut().then(function(){ showToast('Signed out.'); });
}

