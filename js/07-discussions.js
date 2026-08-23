// ===================== DISCUSSIONS (Reddit-style board) =====================
// Posts + threaded comments (one reply level) + upvotes. No login: you type your
// name (remembered on this device). Staff/admins can delete anything.

function discEsc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function discMs(x) {
  var ts = x && x.created_at;
  if (!ts) return 0;
  if (ts.seconds) return ts.seconds * 1000;
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}
function discTime(ts) {
  var d = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
  if (!d || isNaN(d.getTime())) return 'just now';
  var mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  if (mins < 1440) return Math.floor(mins / 60) + 'h ago';
  if (mins < 10080) return Math.floor(mins / 1440) + 'd ago';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function discStaff() {
  return (typeof isAdminUnlocked === 'function' && isAdminUnlocked()) ||
         (typeof isCoachLoggedIn === 'function' && isCoachLoggedIn());
}
function discName() {
  try { return localStorage.getItem('f6ad_comment_name') || ''; } catch (e) { return ''; }
}
function setDiscName(v) { try { localStorage.setItem('f6ad_comment_name', v); } catch (e) {} }

// ---- local vote tracking (one vote per device, toggleable) ----
function discVotes() {
  try { return JSON.parse(localStorage.getItem('f6ad_disc_votes') || '{}') || {}; } catch (e) { return {}; }
}
function discSaveVotes(v) { try { localStorage.setItem('f6ad_disc_votes', JSON.stringify(v)); } catch (e) {} }
function discHasVoted(kind, id) { return !!discVotes()[kind + ':' + id]; }
function discToggleVote(kind, id, coll) {
  var v = discVotes(); var key = kind + ':' + id;
  var delta = v[key] ? -1 : 1;
  if (v[key]) delete v[key]; else v[key] = 1;
  discSaveVotes(v);
  tdb(coll).doc(id).update({ votes: firebase.firestore.FieldValue.increment(delta) })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function voteDiscussion(id) { discToggleVote('p', id, 'discussions'); }
function voteDiscComment(id) { discToggleVote('c', id, 'discussion_comments'); }

function discCommentsFor(pid) {
  return discussionComments.filter(function(c){ return c.post_id === pid; })
    .sort(function(a, b){ return discMs(a) - discMs(b); });
}
function discPostIdFromHash() {
  var h = window.location.hash || '';
  var parts = h.replace(/^#\//, '').split('/');
  return (parts[0] === 'discussions' && parts[1]) ? parts[1] : null;
}

// ---- render ----
function renderDiscussions() {
  var root = document.getElementById('discussions-root');
  if (!root) return;
  var pid = discPostIdFromHash();
  if (pid) renderDiscussionDetail(root, pid);
  else renderDiscussionList(root);
}
function renderDiscussionList(root) {
  var sort = discSort || 'top';
  var posts = discussionItems.slice().sort(function(a, b) {
    if (sort === 'new') return discMs(b) - discMs(a);
    return ((b.votes || 0) - (a.votes || 0)) || (discMs(b) - discMs(a));
  });
  var html = '<div class="disc-bar">' +
    '<div class="disc-sorts">' +
      '<button class="disc-sort' + (sort === 'top' ? ' active' : '') + '" onclick="setDiscSort(\'top\')">🔥 Top</button>' +
      '<button class="disc-sort' + (sort === 'new' ? ' active' : '') + '" onclick="setDiscSort(\'new\')">🕘 New</button>' +
    '</div>' +
    '<button class="btn-primary" onclick="toggleDiscForm()">＋ New Post</button></div>';
  if (discFormOpen) html += discNewPostForm();
  html += posts.length
    ? '<div class="disc-list">' + posts.map(discPostCard).join('') + '</div>'
    : '<div class="empty-state"><span>💬</span><strong>No discussions yet.</strong><br>Start the first one!</div>';
  root.innerHTML = html;
}
function discPostCard(p) {
  var n = discCommentsFor(p.id).length;
  return '<div class="disc-card">' +
    '<div class="disc-vote"><button class="disc-up' + (discHasVoted('p', p.id) ? ' on' : '') + '" onclick="voteDiscussion(\'' + p.id + '\')" title="Upvote">▲</button>' +
    '<span class="disc-score">' + (p.votes || 0) + '</span></div>' +
    '<div class="disc-main"><a class="disc-title" href="#/discussions/' + p.id + '">' + discEsc(p.title || '(untitled)') + '</a>' +
    '<div class="disc-meta">' + discEsc(p.author || 'Anonymous') + ' · ' + discTime(p.created_at) + ' · 💬 ' + n + ' comment' + (n === 1 ? '' : 's') +
    ' <button class="disc-link" onclick="discCopyLink(\'' + p.id + '\')">🔗 Copy link</button></div></div></div>';
}
function renderDiscussionDetail(root, pid) {
  var p = discussionItems.find(function(x){ return x.id === pid; });
  if (!p) { root.innerHTML = '<div class="empty-state"><strong>Post not found.</strong><br><a href="#/discussions">← Back to Discussions</a></div>'; return; }
  var staff = discStaff();
  var all = discCommentsFor(pid);
  var top = all.filter(function(c){ return !c.parent_id; });
  var html = '<a class="disc-back" href="#/discussions">← All discussions</a>' +
    '<div class="disc-post">' +
      '<div class="disc-vote"><button class="disc-up' + (discHasVoted('p', pid) ? ' on' : '') + '" onclick="voteDiscussion(\'' + pid + '\')">▲</button>' +
      '<span class="disc-score">' + (p.votes || 0) + '</span></div>' +
      '<div class="disc-main"><div class="disc-ptitle">' + discEsc(p.title || '(untitled)') + '</div>' +
      '<div class="disc-meta">' + discEsc(p.author || 'Anonymous') + ' · ' + discTime(p.created_at) +
        ' <button class="disc-link" onclick="discCopyLink(\'' + pid + '\')">🔗 Copy link</button>' +
        (staff ? ' <button class="disc-del" onclick="deleteDiscussion(\'' + pid + '\')">🗑 Delete post</button>' : '') + '</div>' +
      (p.body ? '<div class="disc-body">' + discEsc(p.body) + '</div>' : '') +
      '</div></div>';
  html += discCommentForm(pid, '');
  html += '<div class="disc-comments">' + (top.length
    ? top.map(function(c){ return discCommentHtml(c, all, staff, pid); }).join('')
    : '<div class="disc-none">No comments yet — start the conversation.</div>') + '</div>';
  root.innerHTML = html;
}
function discCommentRow(c, staff, cls) {
  return '<div class="disc-comment' + (cls || '') + '">' +
    '<div class="dc-head"><span class="dc-author">' + discEsc(c.author || 'Anonymous') + '</span>' +
    '<span class="dc-time">' + discTime(c.created_at) + '</span>' +
    '<button class="disc-up sm' + (discHasVoted('c', c.id) ? ' on' : '') + '" onclick="voteDiscComment(\'' + c.id + '\')">▲ ' + (c.votes || 0) + '</button>' +
    (staff ? '<button class="disc-del" onclick="deleteDiscComment(\'' + c.id + '\')">🗑</button>' : '') + '</div>' +
    '<div class="dc-text">' + discEsc(c.text || '') + '</div>';
}
function discCommentHtml(c, all, staff, pid) {
  var replies = all.filter(function(r){ return r.parent_id === c.id; });
  return discCommentRow(c, staff, '') +
    '<button class="dc-reply" onclick="toggleDiscReply(\'' + c.id + '\')">↩ Reply</button>' +
    (discReplyOpen === c.id ? discCommentForm(pid, c.id) : '') +
    (replies.length ? '<div class="dc-replies">' + replies.map(function(r){ return discCommentRow(r, staff, ' reply') + '</div>'; }).join('') + '</div>' : '') +
    '</div>';
}
function discCommentForm(pid, parentId) {
  var suf = parentId ? ('r-' + parentId) : ('p-' + pid);
  return '<div class="disc-form">' +
    '<input type="text" id="dcn-' + suf + '" placeholder="Your name" value="' + discEsc(discName()) + '"/>' +
    '<textarea id="dct-' + suf + '" rows="2" placeholder="' + (parentId ? 'Write a reply…' : 'Add a comment…') + '"></textarea>' +
    '<button class="btn-primary" onclick="postDiscComment(\'' + pid + '\',\'' + (parentId || '') + '\')">' + (parentId ? 'Reply' : 'Comment') + '</button>' +
    '</div>';
}
function discNewPostForm() {
  return '<div class="disc-form disc-newpost">' +
    '<input type="text" id="dp-name" placeholder="Your name" value="' + discEsc(discName()) + '"/>' +
    '<input type="text" id="dp-title" placeholder="Title — what is this about?"/>' +
    '<textarea id="dp-body" rows="4" placeholder="Add details (optional)"></textarea>' +
    '<div style="display:flex;gap:8px"><button class="btn-primary" onclick="createDiscussion()">Post</button>' +
    '<button class="btn-edit" onclick="toggleDiscForm()">Cancel</button></div></div>';
}

// ---- actions ----
function setDiscSort(s) { discSort = s; renderDiscussions(); }
function toggleDiscForm() { discFormOpen = !discFormOpen; renderDiscussions(); }
function toggleDiscReply(cid) { discReplyOpen = (discReplyOpen === cid) ? null : cid; renderDiscussions(); }
function createDiscussion() {
  var name = (document.getElementById('dp-name').value || '').trim();
  var title = (document.getElementById('dp-title').value || '').trim();
  var body = (document.getElementById('dp-body').value || '').trim();
  if (!name) { showToast('Add your name first.'); return; }
  if (!title) { showToast('Give your post a title.'); return; }
  setDiscName(name);
  tdb('discussions').add({
    title: title, body: body, author: name, votes: 0,
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(){ discFormOpen = false; showToast('Posted ✓'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function postDiscComment(pid, parentId) {
  var suf = parentId ? ('r-' + parentId) : ('p-' + pid);
  var name = ((document.getElementById('dcn-' + suf) || {}).value || '').trim();
  var text = ((document.getElementById('dct-' + suf) || {}).value || '').trim();
  if (!name) { showToast('Add your name first.'); return; }
  if (!text) { showToast('Write something first.'); return; }
  setDiscName(name);
  tdb('discussion_comments').add({
    post_id: pid, parent_id: parentId || null, author: name, text: text, votes: 0,
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(){ discReplyOpen = null; showToast('Comment posted ✓'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function deleteDiscussion(pid) {
  if (!discStaff()) { showToast('Coach/admin only.'); return; }
  if (!confirm('Delete this post and all of its comments?')) return;
  var batch = db.batch();
  batch.delete(tdb('discussions').doc(pid));
  discussionComments.filter(function(c){ return c.post_id === pid; })
    .forEach(function(c){ batch.delete(tdb('discussion_comments').doc(c.id)); });
  batch.commit().then(function(){ showToast('Post deleted.'); window.location.hash = '#/discussions'; })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function deleteDiscComment(cid) {
  if (!discStaff()) { showToast('Coach/admin only.'); return; }
  if (!confirm('Delete this comment?')) return;
  var batch = db.batch();
  batch.delete(tdb('discussion_comments').doc(cid));
  discussionComments.filter(function(r){ return r.parent_id === cid; })
    .forEach(function(r){ batch.delete(tdb('discussion_comments').doc(r.id)); });
  batch.commit().then(function(){ showToast('Comment deleted.'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}

function discCopyLink(pid) {
  var url = window.location.origin + window.location.pathname + '#/discussions/' + pid;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function(){ showToast('Post link copied!'); })
      .catch(function(){ window.prompt('Copy this post link:', url); });
  } else { window.prompt('Copy this post link:', url); }
}
