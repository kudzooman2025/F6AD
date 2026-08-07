// ===================== FEEDBACK =====================
// Anyone can submit a suggestion / bug; staff review it in Admin → Feedback.
function fbTs() { return firebase.firestore.FieldValue.serverTimestamp(); }
function openFeedback() { document.getElementById('feedback-overlay').classList.add('open'); }
function closeFeedback() { document.getElementById('feedback-overlay').classList.remove('open'); }
function feedbackOverlayClick(e) { if (e.target === document.getElementById('feedback-overlay')) closeFeedback(); }
function submitFeedback() {
  var text = (document.getElementById('fb-text') || {}).value.trim();
  if (!text) { showToast('Please enter your feedback first.'); return; }
  var type = (document.getElementById('fb-type') || {}).value || 'other';
  var name = (document.getElementById('fb-name') || {}).value.trim();
  var email = (document.getElementById('fb-email') || {}).value.trim();
  db.collection('feedback').add({
    type: type, text: text, name: name || 'Anonymous', email: email || '', page: window.location.hash || '',
    status: 'open', created_at: fbTs()
  }).then(function(){
    showToast('Thanks — your feedback was sent 🙏');
    var t = document.getElementById('fb-text'); if (t) t.value = '';
    var n = document.getElementById('fb-name'); if (n) n.value = '';
    var em = document.getElementById('fb-email'); if (em) em.value = '';
    closeFeedback();
  }).catch(function(e){ showToast('Error: ' + e.message); });
}
function fbTypeLabel(t) { return t === 'bug' ? '🐞 Bug' : t === 'suggestion' ? '💡 Suggestion' : '💬 Other'; }
function fbTime(ts) {
  var d = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
  if (!d || isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
function renderAdminFeedback() {
  var box = document.getElementById('admin-feedback-list');
  if (!box) return;
  var items = (feedbackItems || []).slice().sort(function(a, b){ return (b.created_at && b.created_at.seconds || 0) - (a.created_at && a.created_at.seconds || 0); });
  var open = items.filter(function(f){ return f.status !== 'resolved'; });
  var done = items.filter(function(f){ return f.status === 'resolved'; });
  function row(f) {
    var resolved = f.status === 'resolved';
    return '<div class="admin-item" style="' + (resolved ? 'opacity:.6' : '') + '"><div class="admin-item-info">' +
      '<strong>' + fbTypeLabel(f.type) + '</strong> <span style="color:var(--muted);font-size:.8rem">· ' + gtEsc(f.name || 'Anonymous') + (f.email ? ' · <a href="mailto:' + gtAttr(f.email) + '">' + gtEsc(f.email) + '</a>' : '') + ' · ' + fbTime(f.created_at) + (f.page ? ' · <code>' + gtEsc(f.page) + '</code>' : '') + '</span>' +
      '<span style="white-space:pre-wrap;margin-top:4px;display:block">' + gtEsc(f.text || '') + '</span></div>' +
      '<div class="admin-item-actions">' +
      (resolved ? '<button class="btn-edit" onclick="fbSetStatus(\'' + f.id + '\',\'open\')">Reopen</button>' : '<button class="btn-primary" onclick="fbSetStatus(\'' + f.id + '\',\'resolved\')">✓ Resolve</button>') +
      '<button class="btn-edit" onclick="fbDelete(\'' + f.id + '\')">Delete</button></div></div>';
  }
  box.innerHTML =
    '<p style="font-weight:800;font-size:.9rem;margin:0 0 8px">Open (' + open.length + ')</p>' +
    (open.length ? open.map(row).join('') : '<p style="font-size:.84rem;color:var(--muted)">Nothing new.</p>') +
    '<p style="font-weight:800;font-size:.9rem;margin:18px 0 8px">Resolved (' + done.length + ')</p>' +
    (done.length ? done.map(row).join('') : '<p style="font-size:.84rem;color:var(--muted)">None yet.</p>');
}
function fbSetStatus(id, status) {
  if (!(isAdminUnlocked() || isCoachLoggedIn())) { showToast('Staff only.'); return; }
  db.collection('feedback').doc(id).set({ status: status }, { merge: true }).catch(function(e){ showToast('Error: ' + e.message); });
}
function fbDelete(id) {
  if (!(isAdminUnlocked() || isCoachLoggedIn())) { showToast('Staff only.'); return; }
  if (!confirm('Delete this feedback?')) return;
  db.collection('feedback').doc(id).delete().catch(function(e){ showToast('Error: ' + e.message); });
}
