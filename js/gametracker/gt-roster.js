// ---------- ROSTER MANAGER ----------
function gtRenderRoster(view) {
  var canEdit = gtCanEdit();
  var rosters = GT.rosters.slice().sort(function(a, b) {
    if (!!b.is_active !== !!a.is_active) return b.is_active ? 1 : -1;
    if (!!a.archived !== !!b.archived) return a.archived ? 1 : -1;
    return gtTsMillis(b.created_at) - gtTsMillis(a.created_at);
  });
  if (!GT.rosterSel || !gtRoster(GT.rosterSel)) {
    var act = gtActiveRoster();
    GT.rosterSel = act ? act.id : (rosters[0] ? rosters[0].id : null);
  }
  var html = gtLockBanner() +
    '<div class="gt-title">👥 Roster Manager</div>' +
    '<div class="gt-sub">Build rosters, manage player records and parent contact info.</div>';
  if (canEdit) html += '<button class="btn-primary" style="margin-bottom:16px" onclick="gtOpenRosterForm(null)">➕ Create Roster</button>';
  if (!rosters.length) {
    html += '<div class="gt-empty">No rosters yet.' + (canEdit ? ' Create one to get started.' : '') + '</div>';
    view.innerHTML = html; return;
  }
  html += rosters.map(function(r) {
    var count = gtRosterPlayers(r.id).length;
    return '<div class="gt-roster-card' + (r.is_active ? ' active-roster' : '') + '">' +
      '<span class="rc-name" style="cursor:pointer" onclick="GT.rosterSel=\'' + r.id + '\';gtRerender(true)">' + gtEsc(r.name) +
      (r.is_active ? ' <span class="gt-active-badge">Active</span>' : '') +
      (r.archived ? ' <span class="gt-archived-badge">Archived</span>' : '') +
      '<br><span style="font-size:.76rem;color:var(--muted);font-weight:600">' + gtEsc(r.season || '') + ' · ' + count + ' players</span></span>' +
      '<button class="gt-minibtn" onclick="GT.rosterSel=\'' + r.id + '\';gtRerender(true)">' + (GT.rosterSel === r.id ? '▼ Viewing' : 'View Players') + '</button>' +
      (canEdit ? (
        '<button class="gt-minibtn" onclick="gtOpenRosterForm(\'' + r.id + '\')">Edit</button>' +
        (!r.is_active && !r.archived ? '<button class="gt-minibtn" onclick="gtSetActiveRoster(\'' + r.id + '\')">Set Active</button>' : '') +
        (!r.archived ? '<button class="gt-minibtn" onclick="gtArchiveRoster(\'' + r.id + '\',true)">Archive</button>'
          : '<button class="gt-minibtn" onclick="gtArchiveRoster(\'' + r.id + '\',false)">Unarchive</button>')
      ) : '') +
      '</div>';
  }).join('');
  var sel = gtRoster(GT.rosterSel);
  if (sel) {
    var players = gtRosterPlayers(sel.id);
    html += '<div class="gt-title" style="margin-top:28px;font-size:1.05rem">' + gtEsc(sel.name) + ' — Players</div>';
    if (canEdit) html += '<button class="btn-primary" style="margin-bottom:14px" onclick="gtOpenPlayerForm(\'' + sel.id + '\',null)">➕ Add Player</button>';
    if (!players.length) html += '<div class="gt-empty">No players on this roster yet.</div>';
    else {
      html += '<div class="gt-table-wrap"><table class="gt-table"><thead><tr><th>#</th><th>Player</th><th>Pos</th><th>Parent</th><th>Phone</th><th class="num">WhatsApp</th>' + (canEdit ? '<th></th>' : '') + '</tr></thead><tbody>';
      players.forEach(function(p) {
        html += '<tr><td class="num" style="font-weight:900;color:var(--purple)">' + (p.jersey_number != null ? p.jersey_number : '—') + '</td>' +
          '<td><span class="gt-plink" onclick="gtGo(\'/gametracker/player/' + p.id + '\')">' + gtEsc(gtPlayerName(p.id)) + '</span>' +
          (p.is_guest ? '<span class="gt-guest-badge">Guest</span>' : '') + (gtIsGK(p) ? '<span class="gt-gk-badge">GK</span>' : '') + '</td>' +
          '<td>' + gtEsc(p.position || '—') + '</td>' +
          '<td>' + gtEsc(p.parent_name || '—') + '</td>' +
          '<td>' + gtEsc(p.parent_phone || '—') + '</td>' +
          '<td class="num">' + (p.whatsapp_opt_in ? '✅' : '—') + '</td>' +
          (canEdit ? '<td style="white-space:nowrap"><button class="gt-minibtn" onclick="gtOpenPlayerForm(\'' + sel.id + '\',\'' + p.id + '\')">Edit</button> ' +
            (p.is_guest ? '<button class="gt-minibtn" onclick="gtConvertGuest(\'' + p.id + '\')">⬆ Full Player</button> ' : '') +
            '<button class="gt-minibtn danger" onclick="gtDeletePlayer(\'' + p.id + '\')">Remove</button></td>' : '') +
          '</tr>';
      });
      html += '</tbody></table></div>';
    }
  }
  view.innerHTML = html;
}
function gtOpenRosterForm(rid) {
  if (!gtCanEdit()) { showToast('Coach login required.'); return; }
  var r = rid ? gtRoster(rid) : null;
  gtOpenModal(
    '<h3>' + (r ? '✏️ Edit Roster' : '➕ Create Roster') + '<button class="gm-close" onclick="gtCloseModal()">✕</button></h3>' +
    '<label>Roster Name</label><input type="text" id="gt-rf-name" value="' + gtAttr(r ? r.name : '') + '" placeholder="FC Delco F6AD 2026-27"/>' +
    '<label>Season Label</label><input type="text" id="gt-rf-season" value="' + gtAttr(r ? r.season : '') + '" placeholder="2026-27"/>' +
    '<div class="gm-actions"><button class="btn-primary" onclick="gtSaveRoster(' + (r ? '\'' + r.id + '\'' : 'null') + ')">Save</button>' +
    '<button class="gt-minibtn" onclick="gtCloseModal()">Cancel</button></div>'
  );
}
function gtSaveRoster(rid) {
  var name = document.getElementById('gt-rf-name').value.trim();
  var season = document.getElementById('gt-rf-season').value.trim();
  if (!name) { showToast('Roster name is required.'); return; }
  var data = { name: name, season: season, updated_at: firebase.firestore.FieldValue.serverTimestamp() };
  var op;
  if (rid) op = db.collection('gt_rosters').doc(rid).set(data, { merge: true });
  else {
    data.is_active = !GT.rosters.some(function(r){ return r.is_active; });
    data.archived = false;
    data.created_at = firebase.firestore.FieldValue.serverTimestamp();
    op = db.collection('gt_rosters').add(data);
  }
  op.then(function(){ showToast('Roster saved ✓'); gtCloseModal(); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function gtSetActiveRoster(rid) {
  if (!gtCanEdit()) return;
  var batch = db.batch();
  GT.rosters.forEach(function(r) {
    batch.set(db.collection('gt_rosters').doc(r.id), { is_active: r.id === rid }, { merge: true });
  });
  batch.commit().then(function(){ showToast('Active roster updated ✓'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function gtArchiveRoster(rid, val) {
  if (!gtCanEdit()) return;
  db.collection('gt_rosters').doc(rid).set({ archived: val, is_active: false }, { merge: true })
    .then(function(){ showToast(val ? 'Roster archived.' : 'Roster restored.'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function gtOpenPlayerForm(rid, pid) {
  if (!gtCanEdit()) { showToast('Coach login required.'); return; }
  var p = pid ? gtP(pid) : null;
  gtOpenModal(
    '<h3>' + (p ? '✏️ Edit Player' : '➕ Add Player') + '<button class="gm-close" onclick="gtCloseModal()">✕</button></h3>' +
    '<div class="gm-row"><div><label>First Name</label><input type="text" id="gt-pf-first" value="' + gtAttr(p ? p.first_name : '') + '" autocomplete="off"/></div>' +
    '<div><label>Last Name</label><input type="text" id="gt-pf-last" value="' + gtAttr(p ? p.last_name : '') + '"/></div></div>' +
    '<div class="gm-row"><div><label>Jersey #</label><input type="number" id="gt-pf-num" value="' + (p && p.jersey_number != null ? p.jersey_number : '') + '" min="0" max="99"/></div>' +
    '<div><label>Position</label><input type="text" id="gt-pf-pos" value="' + gtAttr(p ? p.position : '') + '" placeholder="GK, DEF, MID, FWD"/></div></div>' +
    '<label>Parent / Guardian Name</label><input type="text" id="gt-pf-pname" value="' + gtAttr(p ? p.parent_name : '') + '"/>' +
    '<label>Parent Phone (E.164, e.g. +12155551234)</label><input type="tel" id="gt-pf-pphone" value="' + gtAttr(p ? p.parent_phone : '') + '" placeholder="+1XXXXXXXXXX"/>' +
    '<div class="gt-checkrow" style="margin-top:12px"><input type="checkbox" id="gt-pf-optin"' + (p && p.whatsapp_opt_in ? ' checked' : '') + '/>' +
    '<label for="gt-pf-optin" style="margin:0;text-transform:none;font-size:.8rem">Parent has <strong>explicitly opted in</strong> to WhatsApp game notifications</label></div>' +
    '<div class="gm-actions"><button class="btn-primary" onclick="gtSavePlayer(\'' + rid + '\',' + (p ? '\'' + p.id + '\'' : 'null') + ')">Save Player</button>' +
    '<button class="gt-minibtn" onclick="gtCloseModal()">Cancel</button></div>'
  );
  gtWirePlayerAutocomplete();
}
function gtWirePlayerAutocomplete() {
  var inp = document.getElementById('gt-pf-first');
  if (!inp) return;
  // Remove any stale suggestion list from a previous form open
  var oldSug = document.getElementById('gt-pf-sug');
  if (oldSug) oldSug.parentNode.removeChild(oldSug);
  // Create suggestion list at body level so it's never clipped by any ancestor overflow
  var sug = document.createElement('div');
  sug.id = 'gt-pf-sug';
  sug.className = 'gt-autocomplete-list';
  sug.style.position = 'fixed';
  sug.style.zIndex = '99999';
  document.body.appendChild(sug);
  var activeIdx = -1;
  function populatePlayer(pl) {
    inp.value = pl.first_name || '';
    var el;
    el = document.getElementById('gt-pf-last');  if(el) el.value = pl.last_name || '';
    el = document.getElementById('gt-pf-num');   if(el) el.value = pl.jersey_number != null ? pl.jersey_number : '';
    el = document.getElementById('gt-pf-pos');   if(el) el.value = pl.position || '';
    el = document.getElementById('gt-pf-pname'); if(el) el.value = pl.parent_name || '';
    el = document.getElementById('gt-pf-pphone');if(el) el.value = pl.parent_phone || '';
    el = document.getElementById('gt-pf-optin'); if(el) el.checked = !!pl.whatsapp_opt_in;
    sug.style.display = 'none'; activeIdx = -1;
  }
  function positionSug() {
    var rect = inp.getBoundingClientRect();
    sug.style.top = (rect.bottom + 2) + 'px';
    sug.style.left = rect.left + 'px';
    sug.style.width = rect.width + 'px';
    sug.style.right = 'auto';
  }
  function showSuggestions() {
    var q = inp.value.trim().toLowerCase();
    sug.innerHTML = ''; sug.style.display = 'none'; activeIdx = -1;
    if (q.length < 2) return;
    var seen = {};
    var matches = GT.players.filter(function(pl) {
      if (!pl.first_name) return false;
      var key = (pl.first_name + '|' + (pl.last_name||'')).toLowerCase();
      if (seen[key]) return false;
      seen[key] = true;
      return pl.first_name.toLowerCase().startsWith(q);
    }).slice(0, 8);
    if (!matches.length) return;
    matches.forEach(function(pl) {
      var item = document.createElement('div');
      item.className = 'gt-autocomplete-item';
      var sub = [];
      if (pl.jersey_number != null) sub.push('#' + pl.jersey_number);
      if (pl.position) sub.push(pl.position);
      if (pl.parent_name) sub.push(pl.parent_name);
      item.innerHTML = '<strong>' + gtEsc((pl.first_name + ' ' + (pl.last_name||'')).trim()) + '</strong>'
        + (sub.length ? '<div class="gt-ac-sub">' + gtEsc(sub.join(' · ')) + '</div>' : '');
      item.addEventListener('mousedown', function(e) { e.preventDefault(); populatePlayer(pl); });
      sug.appendChild(item);
    });
    positionSug();
    sug.style.display = 'block';
  }
  inp.addEventListener('input', showSuggestions);
  inp.addEventListener('keydown', function(e) {
    var items = sug.querySelectorAll('.gt-autocomplete-item');
    if (!items.length || sug.style.display === 'none') return;
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx+1, items.length-1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx-1, -1); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); items[activeIdx].dispatchEvent(new MouseEvent('mousedown')); return; }
    else if (e.key === 'Escape') { sug.style.display = 'none'; activeIdx = -1; return; }
    items.forEach(function(it, i) { it.classList.toggle('gt-ac-active', i === activeIdx); });
    if (activeIdx >= 0) items[activeIdx].scrollIntoView({block:'nearest'});
  });
  inp.addEventListener('blur', function() { setTimeout(function(){ sug.style.display='none'; activeIdx=-1; }, 200); });
}
function gtSavePlayer(rid, pid) {
  var first = document.getElementById('gt-pf-first').value.trim();
  var last = document.getElementById('gt-pf-last').value.trim();
  if (!first) { showToast('First name is required.'); return; }
  var numV = document.getElementById('gt-pf-num').value;
  var phone = document.getElementById('gt-pf-pphone').value.trim();
  if (phone && !/^\+[1-9]\d{6,14}$/.test(phone)) { showToast('Phone must be E.164 format, e.g. +12155551234'); return; }
  var optin = document.getElementById('gt-pf-optin').checked;
  var prev = pid ? gtP(pid) : null;
  var data = {
    roster_id: rid, first_name: first, last_name: last,
    jersey_number: numV === '' ? null : parseInt(numV, 10),
    position: document.getElementById('gt-pf-pos').value.trim(),
    parent_name: document.getElementById('gt-pf-pname').value.trim(),
    parent_phone: phone, whatsapp_opt_in: optin,
    updated_at: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (optin && !(prev && prev.whatsapp_opt_in)) data.whatsapp_opt_in_at = firebase.firestore.FieldValue.serverTimestamp();
  if (!optin) data.whatsapp_opt_in_at = null;
  var op;
  if (pid) op = db.collection('gt_players').doc(pid).set(data, { merge: true });
  else {
    data.is_guest = false;
    data.created_at = firebase.firestore.FieldValue.serverTimestamp();
    op = db.collection('gt_players').add(data);
  }
  op.then(function(){ showToast('Player saved ✓'); gtCloseModal(); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function gtConvertGuest(pid) {
  if (!gtCanEdit()) return;
  db.collection('gt_players').doc(pid).set({ is_guest: false }, { merge: true })
    .then(function(){ showToast(gtPlayerName(pid) + ' converted to full player ✓'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function gtDeletePlayer(pid) {
  if (!gtCanEdit()) return;
  if (!confirm('Remove ' + gtPlayerName(pid) + ' from the roster? Their logged game events will remain.')) return;
  db.collection('gt_players').doc(pid).delete()
    .then(function(){ showToast('Player removed.'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}

