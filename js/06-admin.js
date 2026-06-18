// ===================== VOTE TALLY (admin) =====================
function renderVoteTally() {
  var container=document.getElementById('vote-tally-body'); if(!container) return;
  var html='';
  ['fall','winter','spring'].forEach(function(season){
    var label={fall:'Fall 2026',winter:'Winter 2026',spring:'Spring 2027'}[season];
    var tournaments=getSeasonTournaments(season);
    var allVotes=getSeasonVotes(season);
    var tally={};
    tournaments.forEach(function(t){tally[t.id]={credits:0,voters:[]};});
    Object.keys(allVotes).forEach(function(voter){
      var vv=allVotes[voter];
      Object.keys(vv).forEach(function(tid){
        var id=parseInt(tid), v=vv[tid];
        if(tally[id]&&typeof v==='number'&&v>0){tally[id].credits+=v;tally[id].voters.push(voter+'('+v+')');}
      });
    });
    var sorted=tournaments.slice().sort(function(a,b){return tally[b.id].credits-tally[a.id].credits;});
    var hasVotes=sorted.some(function(t){return tally[t.id].credits>0;});
    html+='<tr><td colspan="4" style="background:var(--black);color:#fff;padding:8px 12px;font-weight:800;font-size:.82rem;text-transform:uppercase;letter-spacing:.5px">'+label+'</td></tr>';
    if(!hasVotes){
      html+='<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:12px;font-size:.82rem;font-style:italic">No credits allocated yet</td></tr>';
    } else {
      sorted.forEach(function(t){
        var v=tally[t.id]; if(!v.credits) return;
        html+='<tr><td style="font-weight:600;font-size:.85rem">'+t.name+'</td><td style="color:var(--muted);font-size:.75rem">'+t.dates+'</td><td class="tally-yes">'+v.credits+' credits</td><td style="font-size:.75rem;color:var(--muted)">'+v.voters.length+' voter'+(v.voters.length!==1?'s':'')+'</td></tr>';
      });
    }
  });
  container.innerHTML=html||'<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px">No votes yet.</td></tr>';
}
function exportVoteTally() {
  var text='F6AD TOURNAMENT CREDIT TALLY\n'+Array(61).join('=')+'\n';
  ['fall','winter','spring'].forEach(function(season){
    var label={fall:'FALL 2026',winter:'WINTER 2026',spring:'SPRING 2027'}[season];
    text+='\n-- '+label+' --\n';
    var tv=getSeasonTournaments(season), av=getSeasonVotes(season), tally={};
    tv.forEach(function(t){tally[t.id]=0;});
    Object.values(av).forEach(function(vv){Object.keys(vv).forEach(function(tid){var id=parseInt(tid);if(tally[id]!==undefined)tally[id]+=vv[tid];});});
    tv.slice().sort(function(a,b){return tally[b.id]-tally[a.id];}).forEach(function(t){if(tally[t.id]>0)text+='  '+t.name+': '+tally[t.id]+' credits\n';});
  });
  navigator.clipboard.writeText(text).then(function(){showToast('Tally copied!');});
}
function clearAllVotes() {
  if(!confirm('Delete ALL votes (all seasons) from the database? This cannot be undone.')) return;
  var del=function(col){return db.collection(col).get().then(function(snap){var b=db.batch();snap.forEach(function(d){b.delete(d.ref);});return b.commit();});};
  Promise.all(['votes_fall','votes_winter','votes_spring'].map(del))
    .then(function(){showToast('All votes cleared.');}).catch(function(e){showToast('Error: '+e.message);});
}
function generateLink() {
  var name=document.getElementById('link-name-input').value.trim();
  if(!name){showToast('Enter a name first.'); return;}
  var base=window.location.href.split('?')[0];
  var url=base+'?voter='+encodeURIComponent(name);
  var container=document.getElementById('generated-links-list');
  var escapedName=CSS.escape(name);
  if(document.getElementById('link-'+escapedName)){showToast('Link already generated.'); return;}
  var div=document.createElement('div');
  div.id='link-'+name;
  div.style.cssText='background:#fafafa;border:1px solid var(--border);border-radius:8px;padding:12px 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap';
  div.innerHTML='<span style="font-weight:700;font-size:.88rem;flex:0 0 auto">'+name+'</span>'
    +'<input readonly value="'+url+'" style="flex:1;min-width:180px;border:1px solid var(--border);border-radius:5px;padding:6px 10px;font-size:.78rem;font-family:monospace;background:#fff;color:#444" onclick="this.select()"/>'
    +'<button class="btn-primary" style="padding:7px 14px;font-size:.78rem" onclick="copyLink(\''+url+'\',this)">Copy</button>'
    +'<button class="btn-danger" style="padding:7px 14px;font-size:.78rem" onclick="this.closest(\'div\').remove()">X</button>';
  container.prepend(div);
  document.getElementById('link-name-input').value='';
  showToast('Link generated for '+name);
}
function copyLink(url,btn) {
  navigator.clipboard.writeText(url).then(function(){var o=btn.textContent;btn.textContent='Copied!';setTimeout(function(){btn.textContent=o;},1800);});
}

function renderSchedule() {
  const today = new Date(); today.setHours(0,0,0,0);
  const gtEvents = (typeof GT !== 'undefined' && GT.games) ? GT.games.map(function(g){
    return { name: gtOurName(g) + ' vs ' + gtTheirName(g), date: gtGameDateStr(g), time: g.kickoff_time || '', location: g.venue || '', type: 'game', _gt: true };
  }).filter(function(e){ return e.date; }) : [];
  const condEvents = (typeof COND_SESSIONS !== 'undefined') ? COND_SESSIONS.map(function(s){
    return { name: 'Summer Conditioning', date: s.id, time: '17:00', location: 'Germantown Academy', type: 'practice', _auto: true };
  }) : [];
  const campEvents = (typeof MINI_CAMPS !== 'undefined') ? MINI_CAMPS.map(function(c){
    return { name: c.name, date: c.start, time: '18:00', location: c.location || '', type: 'event', _auto: true };
  }).filter(function(e){ return e.date; }) : [];
  const sorted = [...scheduleItems, ...gtEvents, ...condEvents, ...campEvents].sort((a,b) => new Date(a.date) - new Date(b.date));
  const upcoming = sorted.filter(ev => new Date(ev.date + 'T00:00:00') >= today);
  const past     = sorted.filter(ev => new Date(ev.date + 'T00:00:00') <  today);

  const list  = document.getElementById('schedule-list');
  const empty = document.getElementById('schedule-empty');
  const toggle = document.getElementById('archive-toggle');
  const archiveList = document.getElementById('archive-list');

  function evHTML(ev, isPast) {
    const d = new Date(ev.date + 'T00:00:00');
    const month = d.toLocaleString('en-US',{month:'short'});
    const day = d.getDate();
    const time = ev.time ? (() => { const [h,m]=ev.time.split(':'); const hr=+h; return `${hr>12?hr-12:hr||12}:${m} ${hr>=12?'PM':'AM'}`; })() : '';
    return `<div class="event-item${isPast?' past':''}">
      <div class="event-date"><div class="month">${month}</div><div class="day">${day}</div></div>
      <div class="event-info">
        <div class="event-name">${ev.name}</div>
        <div class="event-detail">${ev.location}${time?' · '+time:''}</div>
        <span class="event-type type-${ev.type}">${ev.type.charAt(0).toUpperCase()+ev.type.slice(1)}</span>
      </div>
    </div>`;
  }

  if (!sorted.length) { list.innerHTML=''; empty.style.display='block'; if(toggle)toggle.style.display='none'; return; }
  empty.style.display = 'none';
  list.innerHTML = upcoming.length ? upcoming.map(ev=>evHTML(ev,false)).join('') : '<p style="font-size:.85rem;color:var(--muted);padding:10px 0">No upcoming events scheduled.</p>';

  // Archive (past events)
  if (toggle) {
    if (past.length) {
      toggle.style.display = 'flex';
      const label = document.getElementById('archive-toggle-label');
      if(label) label.textContent = showPastEvents ? 'Hide Past Events (' + past.length + ')' : 'Show Past Events (' + past.length + ')';
      const chevron = document.getElementById('archive-chevron');
      if(chevron) chevron.className = 'archive-chevron' + (showPastEvents?' open':'');
    } else {
      toggle.style.display = 'none';
    }
  }
  if (archiveList) {
    archiveList.style.display = showPastEvents ? 'block' : 'none';
    archiveList.innerHTML = [...past].reverse().map(ev=>evHTML(ev,true)).join('');
  }
}

function toggleArchive() {
  showPastEvents = !showPastEvents;
  renderSchedule();
}

function renderAdminSchedule() {
  const items = [...scheduleItems].sort((a,b) => new Date(a.date) - new Date(b.date));
  const el = document.getElementById('admin-schedule-list');
  if (!items.length) { el.innerHTML = '<p style="font-size:.85rem;color:var(--muted);margin-bottom:14px">No events yet.</p>'; return; }
  el.innerHTML = items.map(ev => `
    <div class="admin-item">
      <div class="admin-item-info">
        <strong>${ev.name}</strong>
        <span>${ev.date}${ev.time?' · '+ev.time:''} · ${ev.location} · ${ev.type}</span>
      </div>
      <div class="admin-item-actions">
        <button class="btn-edit" onclick="editEvent('${ev.id}')">Edit</button>
        <button class="btn-danger" onclick="deleteEvent('${ev.id}')">Delete</button>
      </div>
    </div>`).join('');
}

function renderVenueDatalist() {
  var dl = document.getElementById('venue-datalist');
  if (!dl) return;
  dl.innerHTML = venueItems.slice().sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); })
    .map(function(v){ var addr=[v.address,v.city,v.state].filter(Boolean).join(', '); return '<option value="' + gtAttr(v.name||'') + '">' + gtEsc(addr) + '</option>'; }).join('');
}
function renderVenuesAdmin() {
  var el = document.getElementById('admin-venues-list');
  if (!el) return;
  var items = venueItems.slice().sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); });
  el.innerHTML = items.length ? items.map(function(v){
    var addr=[v.address,v.city,v.state,v.zip].filter(Boolean).join(', ');
    return '<div class="admin-item"><div class="admin-item-info"><strong>'+gtEsc(v.name||'')+'</strong><span>'+gtEsc(addr)+'</span></div>'+
      '<div class="admin-item-actions"><button class="btn-edit" onclick="editVenue(\''+v.id+'\')">Edit</button>'+
      '<button class="btn-danger" onclick="deleteVenue(\''+v.id+'\')">Delete</button></div></div>';
  }).join('') : '<p style="font-size:.85rem;color:var(--muted);margin-bottom:14px">No venues yet.</p>';
}
function saveVenue() {
  var name = document.getElementById('vn-name').value.trim();
  if (!name) { showToast('Venue name is required.'); return; }
  var data = { name:name, address:document.getElementById('vn-address').value.trim(), city:document.getElementById('vn-city').value.trim(), state:document.getElementById('vn-state').value.trim(), zip:document.getElementById('vn-zip').value.trim() };
  var p = editingVenueId ? db.collection('venues').doc(editingVenueId).set(data) : db.collection('venues').add(data);
  p.then(function(){ cancelVenueEdit(); showToast('✅ Venue saved!'); }).catch(function(e){ showToast('Error: '+e.message); });
}
function editVenue(id) {
  var v = venueItems.find(function(x){ return x.id===id; });
  if (!v) return;
  editingVenueId = id;
  document.getElementById('vn-name').value = v.name||'';
  document.getElementById('vn-address').value = v.address||'';
  document.getElementById('vn-city').value = v.city||'';
  document.getElementById('vn-state').value = v.state||'';
  document.getElementById('vn-zip').value = v.zip||'';
  var t=document.getElementById('venue-form-title'); if(t) t.textContent='✏️ Edit Venue';
  var c=document.getElementById('cancel-vn-btn'); if(c) c.style.display='';
}
function cancelVenueEdit() {
  editingVenueId = null;
  ['vn-name','vn-address','vn-city','vn-state','vn-zip'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  var t=document.getElementById('venue-form-title'); if(t) t.textContent='➕ Add Venue';
  var c=document.getElementById('cancel-vn-btn'); if(c) c.style.display='none';
}
function deleteVenue(id) {
  if (!confirm('Delete this venue?')) return;
  db.collection('venues').doc(id).delete().then(function(){ showToast('Venue deleted.'); }).catch(function(e){ showToast('Error: '+e.message); });
}
function saveEvent() {
  const name = document.getElementById('ev-name').value.trim();
  const type = document.getElementById('ev-type').value;
  const date = document.getElementById('ev-date').value;
  const time = document.getElementById('ev-time').value;
  const location = document.getElementById('ev-location').value.trim();
  if (!name || !date) { showToast('Name and date are required.'); return; }
  const data = {name, type, date, time, location};
  const p = editingEventId
    ? db.collection('schedule').doc(editingEventId).set(data)
    : db.collection('schedule').add(data);
  p.then(() => { cancelEventEdit(); showToast('✅ Event saved!'); })
   .catch(e => showToast('Error: ' + e.message));
}

function editEvent(id) {
  const ev = scheduleItems.find(e => e.id === id);
  if (!ev) return;
  editingEventId = id;
  document.getElementById('ev-name').value = ev.name;
  document.getElementById('ev-type').value = ev.type;
  document.getElementById('ev-date').value = ev.date;
  document.getElementById('ev-time').value = ev.time || '';
  document.getElementById('ev-location').value = ev.location;
  document.getElementById('schedule-form-title').textContent = '✏️ Edit Event';
  document.getElementById('cancel-ev-btn').style.display = 'inline-block';
}

function cancelEventEdit() {
  editingEventId = null;
  ['ev-name','ev-date','ev-time','ev-location'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('ev-type').value = 'game';
  document.getElementById('schedule-form-title').textContent = '➕ Add Event';
  document.getElementById('cancel-ev-btn').style.display = 'none';
}

function deleteEvent(id) {
  if (!confirm('Delete this event?')) return;
  db.collection('schedule').doc(id).delete()
    .then(() => showToast('Event deleted.'))
    .catch(e => showToast('Error: ' + e.message));
}

// ===================== ANNOUNCEMENTS =====================
function renderAnnouncements() {
  const active = [...announcementItems]
    .filter(a => !a.archived)
    .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
  const list = document.getElementById('announcements-list');
  const empty = document.getElementById('ann-empty');
  if (!active.length) { list.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display = 'none';
  list.innerHTML = active.map(a => `
    <div class="ann-item">
      <div class="ann-date">${a.date}</div>
      <div class="ann-title">${a.title}</div>
      <div class="ann-body">${a.body}</div>
    </div>`).join('');
}

function renderAdminAnnouncements() {
  const items = [...announcementItems].sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
  const el = document.getElementById('admin-ann-list');
  if (!items.length) { el.innerHTML = '<p style="font-size:.85rem;color:var(--muted);margin-bottom:14px">No announcements yet.</p>'; return; }
  el.innerHTML = items.map(a => `
    <div class="admin-item" style="${a.archived ? 'opacity:.55;background:#f9f9f9' : ''}">
      <div class="admin-item-info">
        <strong>${a.title}</strong>
        <span>${a.date}${a.archived ? ' &nbsp;·&nbsp; <em style=\'color:#888\'>Archived</em>' : ''}</span>
      </div>
      <div class="admin-item-actions">
        ${!a.archived ? `<button class="btn-edit" onclick="editAnn('${a.id}')">Edit</button>` : ''}
        <button class="btn-edit" style="background:#f3f4f6;color:#555" onclick="toggleArchiveAnn('${a.id}',${!!a.archived})">${a.archived ? '↩ Unarchive' : '📦 Archive'}</button>
        <button class="btn-danger" onclick="deleteAnn('${a.id}')">Delete</button>
      </div>
    </div>`).join('');
}
function toggleArchiveAnn(id, isArchived) {
  db.collection('announcements').doc(id).update({ archived: !isArchived })
    .then(() => showToast(isArchived ? 'Announcement restored.' : 'Announcement archived.'))
    .catch(e => showToast('Error: ' + e.message));
}

function saveAnnouncement() {
  const title = document.getElementById('ann-title').value.trim();
  const body = document.getElementById('ann-body').value.trim();
  if (!title || !body) { showToast('Title and message are required.'); return; }
  const now = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const p = editingAnnId
    ? db.collection('announcements').doc(editingAnnId).update({title, body})
    : db.collection('announcements').add({title, body, date: now, createdAt: firebase.firestore.FieldValue.serverTimestamp()});
  p.then(() => { cancelAnnEdit(); showToast('✅ Announcement posted!'); })
   .catch(e => showToast('Error: ' + e.message));
}

function editAnn(id) {
  const a = announcementItems.find(x => x.id === id);
  if (!a) return;
  editingAnnId = id;
  document.getElementById('ann-title').value = a.title;
  document.getElementById('ann-body').value = a.body;
  document.getElementById('ann-form-title').textContent = '✏️ Edit Announcement';
  document.getElementById('cancel-ann-btn').style.display = 'inline-block';
}

function cancelAnnEdit() {
  editingAnnId = null;
  document.getElementById('ann-title').value = '';
  document.getElementById('ann-body').value = '';
  document.getElementById('ann-form-title').textContent = '➕ Add Announcement';
  document.getElementById('cancel-ann-btn').style.display = 'none';
}

function deleteAnn(id) {
  if (!confirm('Delete this announcement?')) return;
  db.collection('announcements').doc(id).delete()
    .then(() => showToast('Announcement deleted.'))
    .catch(e => showToast('Error: ' + e.message));
}

// ===================== ADMIN CAMPS =====================
function renderAdminCamps() {
  renderCampAdminList('minicamp-jul14', 'admin-camp1-attendees');
  renderCampAdminList('minicamp-jul30', 'admin-camp2-attendees');
}
function renderCampAdminList(campId, elId) {
  var el = document.getElementById(elId);
  if(!el) return;
  var attendees = condData[campId] || [];
  if(!attendees.length) {
    el.innerHTML = '<p style="font-size:.82rem;color:var(--muted);font-style:italic">No sign-ups yet.</p>';
    return;
  }
  el.innerHTML = attendees.map(function(name) {
    var safe = name.replace(/"/g,'');
    return '<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid #eee" id="camprow-' + campId + '-' + safe + '">'
      + '<span style="flex:1;font-size:.88rem">' + name + '</span>'
      + '<button class="btn-edit" style="padding:3px 10px;font-size:.75rem" '
      +   'data-cid="' + campId + '" data-n="' + safe + '" data-elid="' + elId + '" '
      +   'onclick="adminCampEditStart(this)">Edit</button>'
      + '<button class="btn-danger" style="padding:3px 10px;font-size:.75rem" '
      +   'data-cid="' + campId + '" data-n="' + safe + '" '
      +   'onclick="adminCampRemove(this)">Remove</button>'
      + '</div>';
  }).join('');
}
function adminCampEditStart(btn) {
  var campId  = btn.getAttribute('data-cid');
  var oldName = btn.getAttribute('data-n');
  var elId    = btn.getAttribute('data-elid');
  var row = document.getElementById('camprow-' + campId + '-' + oldName);
  if(!row) return;
  // Build edit row entirely via DOM — no inline onclick strings needed
  row.innerHTML = '';
  var inp = document.createElement('input');
  inp.type = 'text'; inp.value = oldName;
  inp.style.cssText = 'flex:1;border:1.5px solid var(--purple);border-radius:6px;padding:4px 8px;font-size:.85rem';
  var saveBtn = document.createElement('button');
  saveBtn.className = 'btn-primary'; saveBtn.textContent = 'Save';
  saveBtn.style.cssText = 'padding:3px 10px;font-size:.75rem';
  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-edit'; cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'padding:3px 10px;font-size:.75rem';
  saveBtn.addEventListener('click', function() {
    var newName = inp.value.trim();
    if(!newName) { showToast('Name cannot be empty.'); return; }
    if(newName === oldName) { renderCampAdminList(campId, elId); return; }
    var ref = db.collection('conditioning').doc(campId);
    ref.set({ attendees: firebase.firestore.FieldValue.arrayRemove(oldName) }, { merge: true })
      .then(function() {
        return ref.set({ attendees: firebase.firestore.FieldValue.arrayUnion(newName) }, { merge: true });
      })
      .then(function() { showToast(oldName + ' → ' + newName + ' ✓'); })
      .catch(function(e) { showToast('Error: ' + e.message); });
  });
  cancelBtn.addEventListener('click', function() { renderCampAdminList(campId, elId); });
  inp.addEventListener('keydown', function(e) {
    if(e.key === 'Enter') saveBtn.click();
    if(e.key === 'Escape') cancelBtn.click();
  });
  row.appendChild(inp); row.appendChild(saveBtn); row.appendChild(cancelBtn);
  inp.focus(); inp.select();
}
function adminCampAdd(campId, inputId) {
  var input = document.getElementById(inputId);
  var name = input ? input.value.trim() : '';
  if(!name) { showToast('Enter a name first.'); return; }
  db.collection('conditioning').doc(campId).set(
    { attendees: firebase.firestore.FieldValue.arrayUnion(name) },
    { merge: true }
  ).then(function() {
    input.value = '';
    showToast(name + ' added ✓');
  }).catch(function(e) { showToast('Error: ' + e.message); });
}
function adminCampRemove(btn) {
  var campId = btn.getAttribute('data-cid');
  var name   = btn.getAttribute('data-n');
  db.collection('conditioning').doc(campId).set(
    { attendees: firebase.firestore.FieldValue.arrayRemove(name) },
    { merge: true }
  ).then(function() { showToast(name + ' removed'); })
  .catch(function(e) { showToast('Error: ' + e.message); });
}

function adminAddToCamp(campId) {
  var input = document.getElementById('camp-add-'+campId);
  var name = input ? input.value.trim() : '';
  if(!name){showToast('Enter a player name.'); return;}
  db.collection('conditioning').doc(campId).set(
    {attendees: firebase.firestore.FieldValue.arrayUnion(name)},
    {merge: true}
  ).then(function(){ input.value=''; showToast(name+' added ✓'); })
  .catch(function(e){showToast('Error: '+e.message);});
}
function adminRemoveFromCamp(campId, name) {
  db.collection('conditioning').doc(campId).set(
    {attendees: firebase.firestore.FieldValue.arrayRemove(name)},
    {merge: true}
  ).then(function(){showToast(name+' removed');})
  .catch(function(e){showToast('Error: '+e.message);});
}
function signOut() {
  saveVoterName('');
  localStorage.removeItem('f6ad_cond_name');
  ['fall','winter','spring','summer27'].forEach(s => setSeasonCredits(s, {}));
  renderVoterBar();
  renderCondNameRow();
  renderCondGrid();
  renderCampGrid();
  if(activeSeason !== 'summer') renderSeasonGrid(activeSeason);
  updateCreditDisplay();
  showToast('Signed out.');
}

// ===================== ADMIN =====================
function openAdmin() {
  document.getElementById('admin-overlay').classList.add('open');
  if (isAdminUnlocked()) { showAdminPanel(); return; }
  document.getElementById('admin-panel').style.display = 'none';
  document.getElementById('admin-login').style.display = '';
}
function closeAdmin() {
  document.getElementById('admin-overlay').classList.remove('open');
}
function overlayClick(e) {
  if (e.target === document.getElementById('admin-overlay')) closeAdmin();
}

function tryLogin() {
  var errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  authSignIn(
    document.getElementById('admin-email-input').value.trim(),
    document.getElementById('admin-pw-input').value,
    errEl
  );
}

function adminCreateAccount() {
  var errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  authCreateAccount(
    document.getElementById('admin-email-input').value.trim(),
    document.getElementById('admin-pw-input').value,
    errEl
  );
}

function showAdminPanel() {
  document.getElementById('admin-login').style.display = 'none';
  document.getElementById('admin-panel').style.display = 'block';
  var pwEl = document.getElementById('admin-pw-input');
  if (pwEl) pwEl.value = '';
  var acct = document.getElementById('settings-account-line');
  if (acct && authUser) acct.textContent = 'Signed in as ' + authUser.email + (authStaffName ? ' (' + authStaffName + ')' : '');
  renderAdminSchedule();
  renderAdminAnnouncements();
  renderVoteTally();
}

function switchTab(tab, btn) {
  if(tab==='venues') renderVenuesAdmin();
  if(tab==='camps') renderAdminCamps();
  if(tab==='players') renderAdminPlayers();
  if(tab==='sessions') renderAdminSessions();
  if(tab==='coaches') renderAdminCoaches();
  document.querySelectorAll('.admin-tab').forEach(function(t){ t.classList.remove('active'); });
  document.querySelectorAll('.tab-panel').forEach(function(p){ p.classList.remove('active'); });
  btn.classList.add('active');
  document.getElementById('tab-'+tab).classList.add('active');
}




// ===================== ADMIN PLAYERS =====================
function renderAdminPlayers() {
  var container = document.getElementById('admin-players-list');
  if(!container) return;
  container.innerHTML = '';

  // ── Toggle button bar ──
  var bar = document.createElement('div');
  bar.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:14px';
  var toggleBtn = document.createElement('button');
  toggleBtn.className = playerGroupEditMode ? 'btn-primary kanban-done-btn' : 'btn-edit';
  toggleBtn.style.cssText = 'padding:6px 14px;font-size:.82rem';
  toggleBtn.textContent = playerGroupEditMode ? '✓ Done Editing Groups' : '🔀 Rearrange Groups';
  toggleBtn.onclick = function() { playerGroupEditMode = !playerGroupEditMode; renderAdminPlayers(); };
  bar.appendChild(toggleBtn);
  if(playerGroupEditMode) {
    var hint = document.createElement('span');
    hint.style.cssText = 'font-size:.78rem;color:var(--muted)';
    hint.textContent = 'Drag players between groups to reassign them';
    bar.appendChild(hint);
  }
  container.appendChild(bar);

  if(playerGroupEditMode) {
    renderPlayerKanban(container);
  } else {
    renderPlayersTable(container);
  }
}

function renderPlayersTable(container) {
  var tbl = document.createElement('table'); tbl.className = 'players-table';
  var thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Name</th><th>Group</th><th>Test Time</th><th>Tue Target</th><th>Thu Target</th><th>Status</th><th></th></tr>';
  tbl.appendChild(thead);
  var tbody = document.createElement('tbody');

  var sorted = PLAYERS.slice().sort(function(a,b) {
    var ga = a.group||99, gb = b.group||99;
    if(ga !== gb) return ga - gb;
    return (a.testSecs||999)-(b.testSecs||999);
  });

  sorted.forEach(function(p) {
    var g = p.group;
    var targets = g ? GROUP_TARGETS[g] : null;
    var row = document.createElement('tr');

    var nameTd = document.createElement('td');
    nameTd.style.fontWeight = '700';
    nameTd.textContent = p.name + (p.isGuest ? ' *' : '');
    row.appendChild(nameTd);

    var grpTd = document.createElement('td');
    if(g) {
      var badge = document.createElement('span');
      badge.className = 'player-group-badge pgb-' + g;
      badge.textContent = 'Group ' + g + (g===1?' ⚡':'');
      grpTd.appendChild(badge);
    } else {
      grpTd.innerHTML = '<span class="player-group-badge pgb-none">Untested</span>';
    }
    row.appendChild(grpTd);

    var timeTd = document.createElement('td');
    timeTd.textContent = p.testTime || '—';
    row.appendChild(timeTd);

    var tueTd = document.createElement('td');
    tueTd.textContent = targets ? targets.tue + 'yd' : '—';
    row.appendChild(tueTd);

    var thuTd = document.createElement('td');
    thuTd.textContent = targets ? targets.thu + 'yd' : '—';
    row.appendChild(thuTd);

    var statusTd = document.createElement('td');
    statusTd.innerHTML = g ? '<span style="color:#15803d;font-weight:700">✓ Placed</span>' : '<span style="color:#d97706;font-weight:700">⏳ Pending test</span>';
    row.appendChild(statusTd);

    var actTd = document.createElement('td');
    var editBtn = document.createElement('button'); editBtn.className = 'btn-edit';
    editBtn.style.cssText = 'padding:4px 10px;font-size:.72rem';
    editBtn.textContent = 'Edit Time';
    editBtn.setAttribute('data-pname', p.name);
    editBtn.addEventListener('click', function() { openPlayerEdit(this.getAttribute('data-pname'), row); });
    actTd.appendChild(editBtn);
    row.appendChild(actTd);

    tbody.appendChild(row);
  });
  tbl.appendChild(tbody);
  container.appendChild(tbl);
}

function renderPlayerKanban(container) {
  var board = document.createElement('div');
  board.className = 'group-kanban';

  var COLS = [
    {group:1,    label:'G1 ⚡ Fastest', sub:'550yd Tue · 260yd Thu', cls:'pgb-1'},
    {group:2,    label:'Group 2',        sub:'510yd Tue · 242yd Thu', cls:'pgb-2'},
    {group:3,    label:'Group 3',        sub:'475yd Tue · 225yd Thu', cls:'pgb-3'},
    {group:4,    label:'G4 Slowest',     sub:'440yd Tue · 210yd Thu', cls:'pgb-4'},
    {group:null, label:'Untested',       sub:'No test time yet',       cls:'pgb-none'}
  ];

  COLS.forEach(function(col) {
    var colEl = document.createElement('div');
    colEl.className = 'kanban-col';
    colEl.dataset.group = col.group !== null ? col.group : '';

    var hdr = document.createElement('div');
    hdr.className = 'kanban-col-hdr ' + col.cls;
    hdr.innerHTML = col.label + '<div class="kanban-col-sub">' + col.sub + '</div>';
    colEl.appendChild(hdr);

    var members = PLAYERS.filter(function(p){ return p.group === col.group; });
    members.sort(function(a,b){ return (a.testSecs||9999)-(b.testSecs||9999); });
    members.forEach(function(p){ colEl.appendChild(makePlayerDragCard(p)); });

    // Drop zone events
    colEl.addEventListener('dragover', function(e){
      e.preventDefault();
      colEl.classList.add('drag-over');
    });
    colEl.addEventListener('dragleave', function(e){
      if(!colEl.contains(e.relatedTarget)) colEl.classList.remove('drag-over');
    });
    colEl.addEventListener('drop', function(e){
      e.preventDefault();
      colEl.classList.remove('drag-over');
      var pName = e.dataTransfer.getData('text/plain');
      var newGroup = col.group;
      if(pName) savePlayerGroup(pName, newGroup);
    });

    board.appendChild(colEl);
  });

  container.appendChild(board);
}

function makePlayerDragCard(p) {
  var card = document.createElement('div');
  card.className = 'kanban-card';
  card.draggable = true;
  card.title = 'Drag to reassign group';

  var handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.title = 'Drag to move';
  handle.innerHTML = '<svg width="14" height="20" viewBox="0 0 14 20" xmlns="http://www.w3.org/2000/svg">'
    + '<circle cx="4" cy="4"  r="2" fill="#888"/><circle cx="10" cy="4"  r="2" fill="#888"/>'
    + '<circle cx="4" cy="10" r="2" fill="#888"/><circle cx="10" cy="10" r="2" fill="#888"/>'
    + '<circle cx="4" cy="16" r="2" fill="#888"/><circle cx="10" cy="16" r="2" fill="#888"/>'
    + '</svg>';

  var name = document.createElement('span');
  name.className = 'kanban-card-name';
  name.textContent = p.name + (p.isGuest ? ' *' : '');

  var time = document.createElement('span');
  time.className = 'kanban-card-time';
  time.textContent = p.testTime || '—';

  card.appendChild(handle);
  card.appendChild(name);
  card.appendChild(time);

  card.addEventListener('dragstart', function(e){
    e.dataTransfer.setData('text/plain', p.name);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(function(){ card.classList.add('dragging'); }, 0);
  });
  card.addEventListener('dragend', function(){
    card.classList.remove('dragging');
  });

  return card;
}

function savePlayerGroup(playerName, newGroup) {
  var pMem = PLAYERS.find(function(x){ return x.name === playerName; });
  if(!pMem) return;
  if(pMem.group === newGroup) return;  // no change
  pMem.group = newGroup;

  var data = {group: newGroup};
  db.collection('players').doc(playerName).set(data, {merge: true})
    .then(function() {
      var label = newGroup ? 'Group ' + newGroup + (newGroup===1?' ⚡':'') : 'Untested';
      showToast(playerName + ' → ' + label + ' ✓');
      renderAdminPlayers();
      renderSummerOverview();
    })
    .catch(function(e) { showToast('Error saving: ' + e.message); });
}

function openPlayerEdit(playerName, row) {
  var p = PLAYERS.find(function(x){ return x.name === playerName; });
  if(!p) return;
  var existingEdit = document.getElementById('player-edit-row');
  if(existingEdit) existingEdit.remove();

  var editRow = document.createElement('tr');
  editRow.id = 'player-edit-row';
  var editTd = document.createElement('td'); editTd.colSpan = 7;
  editTd.style.cssText = 'background:var(--purple-light);padding:14px;';

  var editDiv = document.createElement('div');
  editDiv.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end';

  // Test time input only (group is managed via drag-and-drop)
  var timeDiv = document.createElement('div');
  var timeLbl = document.createElement('label'); timeLbl.textContent = 'Test Time (mm:ss)';
  timeLbl.style.cssText = 'display:block;font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:3px';
  var timeInp = document.createElement('input'); timeInp.type = 'text';
  timeInp.id = 'pe-time'; timeInp.placeholder = '6:15';
  timeInp.value = p.testTime || '';
  timeInp.style.cssText = 'border:2px solid var(--purple);border-radius:6px;padding:6px 10px;font-size:.85rem;font-family:inherit;width:90px';
  timeDiv.appendChild(timeLbl); timeDiv.appendChild(timeInp);
  editDiv.appendChild(timeDiv);

  var hint = document.createElement('p');
  hint.style.cssText = 'font-size:.76rem;color:var(--muted);margin:0;padding-bottom:6px;align-self:flex-end';
  hint.textContent = 'Use "Rearrange Groups" to change group assignment';
  editDiv.appendChild(hint);

  // Save / Cancel
  var savePBtn = document.createElement('button'); savePBtn.className = 'btn-primary';
  savePBtn.style.cssText = 'padding:7px 16px;font-size:.82rem';
  savePBtn.textContent = 'Save Time';
  savePBtn.setAttribute('data-pname', playerName);
  savePBtn.addEventListener('click', function() { savePlayerEdit(this.getAttribute('data-pname')); });

  var cancelPBtn = document.createElement('button'); cancelPBtn.className = 'btn-edit';
  cancelPBtn.style.cssText = 'padding:7px 14px;font-size:.82rem';
  cancelPBtn.textContent = 'Cancel';
  cancelPBtn.addEventListener('click', function() {
    var er = document.getElementById('player-edit-row'); if(er) er.remove();
  });
  editDiv.appendChild(savePBtn); editDiv.appendChild(cancelPBtn);
  editTd.appendChild(editDiv);
  editRow.appendChild(editTd);
  row.parentNode.insertBefore(editRow, row.nextSibling);
}

function savePlayerEdit(playerName) {
  var timeVal = document.getElementById('pe-time').value.trim();
  var testTime = timeVal || null;
  var testSecs = null;

  if(timeVal) {
    var parts = timeVal.split(':');
    if(parts.length === 2) {
      testSecs = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
  }

  var pMem = PLAYERS.find(function(x){ return x.name === playerName; });
  if(pMem) {
    if(testTime !== null) pMem.testTime = testTime;
    if(testSecs !== null) pMem.testSecs = testSecs;
  }

  var data = {};
  if(testTime !== null) data.testTime = testTime;
  if(testSecs !== null) data.testSecs  = testSecs;

  if(!Object.keys(data).length) {
    var er = document.getElementById('player-edit-row'); if(er) er.remove();
    return;
  }

  db.collection('players').doc(playerName).set(data, {merge: true})
    .then(function() {
      showToast(playerName + ' time updated ✓');
      var er = document.getElementById('player-edit-row'); if(er) er.remove();
      renderAdminPlayers();
      renderSummerOverview();
    })
    .catch(function(e) { showToast('Error: ' + e.message); });
}

// ===================== ADMIN SESSIONS =====================
function renderAdminSessions() {
  var container = document.getElementById('admin-sessions-list');
  if(!container) return;
  container.innerHTML = '';

  COND_SESSIONS.forEach(function(s) {
    var log = sessionLogData[s.id] || null;
    var isCompleted = log && log.completed;
    var attCount = log && log.attendance ? Object.values(log.attendance).filter(function(v){ return v; }).length : 0;

    var rowWrap = document.createElement('div');

    var row = document.createElement('div');
    row.className = 'session-admin-row' + (isCompleted ? ' completed' : '');

    var dateSpan = document.createElement('span');
    dateSpan.style.cssText = 'font-weight:700;flex:1;font-size:.88rem';
    dateSpan.textContent = s.date + ' (' + s.day + ')';
    row.appendChild(dateSpan);

    var statusSpan = document.createElement('span');
    statusSpan.style.cssText = 'font-size:.78rem;' + (isCompleted ? 'color:#15803d;font-weight:700' : 'color:var(--muted)');
    statusSpan.textContent = isCompleted ? '✅ Logged (' + attCount + ' present)' : '⚪ Not logged';
    row.appendChild(statusSpan);

    var editBtn = document.createElement('button');
    editBtn.className = 'btn-edit';
    editBtn.style.cssText = 'padding:4px 12px;font-size:.75rem';
    editBtn.textContent = 'Edit';
    editBtn.setAttribute('data-sid', s.id);
    editBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var sid = this.getAttribute('data-sid');
      var detail = document.getElementById('sadmin-detail-' + sid);
      if(detail) detail.classList.toggle('open');
    });
    row.appendChild(editBtn);
    rowWrap.appendChild(row);

    // Inline edit detail
    var detail = document.createElement('div');
    detail.className = 'session-admin-detail';
    detail.id = 'sadmin-detail-' + s.id;
    buildAdminSessionDetail(detail, s.id, log);
    rowWrap.appendChild(detail);

    container.appendChild(rowWrap);
  });
}

function buildAdminSessionDetail(container, sessionId, log) {
  container.innerHTML = '';
  var log2 = log || {};
  var attendance = log2.attendance || {};

  var session = COND_SESSIONS.find(function(x){ return x.id === sessionId; });
  var isTue = session && session.day === 'Tuesday';

  // Blocks / reps row
  var fr = document.createElement('div'); fr.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px';
  function numField(id, lbl, val, min, max) {
    var d = document.createElement('div'); d.className = 'log-field'; d.style.flex = '1';
    var l = document.createElement('label'); l.textContent = lbl;
    var inp = document.createElement('input'); inp.type = 'number';
    inp.id = id; inp.min = min; inp.max = max; inp.value = val || ''; inp.style.borderColor = 'var(--purple)';
    d.appendChild(l); d.appendChild(inp);
    return d;
  }
  var blocksF = numField('sadmin-blocks-'+sessionId, 'Blocks', log2.blocks, 1, 20);
  var repsF = numField('sadmin-reps-'+sessionId, 'Reps/Block', log2.reps_per_block, 1, 50);
  var totalF = numField('sadmin-total-'+sessionId, 'Total Reps (auto)', log2.total_reps, 0, 9999);
  var totalInp = totalF.querySelector('input'); totalInp.readOnly = true; totalInp.style.background = '#eee';
  var blocksInp = blocksF.querySelector('input');
  var repsInp = repsF.querySelector('input');
  function recalc() {
    var b = parseInt(blocksInp.value)||0, r = parseInt(repsInp.value)||0;
    totalInp.value = b && r ? b*r : '';
  }
  blocksInp.addEventListener('input', recalc); repsInp.addEventListener('input', recalc);
  fr.appendChild(blocksF); fr.appendChild(repsF); fr.appendChild(totalF);
  container.appendChild(fr);

  // Notes
  var notesD = document.createElement('div'); notesD.className = 'log-field'; notesD.style.marginBottom = '12px';
  var notesL = document.createElement('label'); notesL.textContent = 'Notes';
  var notesTA = document.createElement('textarea'); notesTA.id = 'sadmin-notes-'+sessionId;
  notesTA.value = log2.notes || ''; notesTA.style.borderColor = 'var(--purple)';
  notesD.appendChild(notesL); notesD.appendChild(notesTA);
  container.appendChild(notesD);

  // Attendance
  var attHdr = document.createElement('p');
  attHdr.style.cssText = 'font-weight:700;font-size:.82rem;margin-bottom:8px';
  attHdr.textContent = 'Attendance (check = present)';
  container.appendChild(attHdr);

  var attWrap = document.createElement('div'); attWrap.className = 'admin-att-grid-ext';
  var sorted = PLAYERS.slice().sort(function(a,b) {
    var ga = a.group||99, gb = b.group||99;
    return ga !== gb ? ga-gb : a.name.localeCompare(b.name);
  });
  var lastG2 = null;
  sorted.forEach(function(p) {
    var g = p.group || 0;
    if(g !== lastG2) {
      lastG2 = g;
      var ghdr2 = document.createElement('p');
      ghdr2.style.cssText = 'font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin:8px 0 2px';
      ghdr2.textContent = g ? ('Group ' + g + (g===1?' ⚡':'')) : 'Untested';
      attWrap.appendChild(ghdr2);
    }
    var ent3 = getAttEntry(attendance, p.name);
    var item = document.createElement('div'); item.className = 'admin-att-item-ext';
    var cb = document.createElement('input'); cb.type = 'checkbox';
    cb.id = 'satt-'+sessionId+'-'+p.name.replace(/\s/g,'_');
    cb.checked = ent3.present === true;
    var lbl = document.createElement('label'); lbl.htmlFor = cb.id;
    lbl.textContent = p.name; lbl.style.cssText = 'cursor:pointer;font-weight:600;font-size:.8rem';
    var gSel2 = document.createElement('select'); gSel2.className = 'att-grp-sel';
    gSel2.id = 'satt-grp-'+sessionId+'-'+p.name.replace(/\s/g,'_');
    gSel2.title = 'Group override for this session';
    [['','— default'],['1','G1 ⚡'],['2','G2'],['3','G3'],['4','G4']].forEach(function(opt) {
      var o = document.createElement('option'); o.value = opt[0]; o.textContent = opt[1];
      if(ent3.groupOverride && String(ent3.groupOverride) === opt[0]) o.selected = true;
      gSel2.appendChild(o);
    });
    var nInp2 = document.createElement('input'); nInp2.type = 'text';
    nInp2.className = 'att-note-inp';
    nInp2.id = 'satt-note-'+sessionId+'-'+p.name.replace(/\s/g,'_');
    nInp2.placeholder = 'e.g. 2@G2, 3@G1';
    nInp2.value = ent3.note || '';
    item.appendChild(cb); item.appendChild(lbl); item.appendChild(gSel2); item.appendChild(nInp2);
    attWrap.appendChild(item);
  });
  container.appendChild(attWrap);

  // Save button
  var saveBtnRow = document.createElement('div'); saveBtnRow.style.marginTop = '14px';
  var saveBtn = document.createElement('button'); saveBtn.className = 'btn-primary';
  saveBtn.textContent = '💾 Save';
  saveBtn.setAttribute('data-sid', sessionId);
  saveBtn.addEventListener('click', function() {
    var sid = this.getAttribute('data-sid');
    var blocks = parseInt(document.getElementById('sadmin-blocks-'+sid).value)||null;
    var reps = parseInt(document.getElementById('sadmin-reps-'+sid).value)||null;
    var total = blocks && reps ? blocks*reps : null;
    var notes = document.getElementById('sadmin-notes-'+sid).value.trim();
    var att = {};
    PLAYERS.forEach(function(p) {
      var cb2 = document.getElementById('satt-'+sid+'-'+p.name.replace(/\s/g,'_'));
      var gSel3 = document.getElementById('satt-grp-'+sid+'-'+p.name.replace(/\s/g,'_'));
      var nInp3 = document.getElementById('satt-note-'+sid+'-'+p.name.replace(/\s/g,'_'));
      if(cb2) att[p.name] = {
        present: cb2.checked,
        groupOverride: gSel3 && gSel3.value ? parseInt(gSel3.value) : null,
        note: nInp3 ? nInp3.value.trim() : ''
      };
    });
    var data = {completed:true, attendance:att, logged_by:'Admin', logged_at:firebase.firestore.FieldValue.serverTimestamp()};
    if(blocks) data.blocks = blocks;
    if(reps) data.reps_per_block = reps;
    if(total) data.total_reps = total;
    if(notes) data.notes = notes;
    db.collection('session_log').doc(sid).set(data, {merge:true})
      .then(function(){ showToast('Session saved ✓'); })
      .catch(function(e){ showToast('Error: '+e.message); });
  });
  saveBtnRow.appendChild(saveBtn);
  container.appendChild(saveBtnRow);
}

// ===================== ADMIN COACHES =====================
function renderAdminCoaches() {
  var container = document.getElementById('admin-coaches-list');
  if(!container) return;
  var staff = Object.keys(staffData).map(function(id){ return Object.assign({id:id}, staffData[id]); });
  if(!staff.length) {
    container.innerHTML = '<p style="font-size:.85rem;color:var(--muted);margin-bottom:14px">No staff accounts yet. Add one below.</p>';
    return;
  }
  var tbl = document.createElement('table'); tbl.className = 'coaches-table';
  var thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr>';
  tbl.appendChild(thead);
  var tbody = document.createElement('tbody');
  staff.sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); }).forEach(function(c) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td style="font-weight:700"></td><td style="font-size:.8rem"></td>'
      + '<td><span style="background:' + (c.role==='admin'?'#fef3c7;color:#92400e':'#ede9fe;color:#5b21b6') + ';padding:2px 8px;border-radius:999px;font-size:.72rem;font-weight:800">' + (c.role==='admin'?'ADMIN':'COACH') + '</span></td>'
      + '<td style="white-space:nowrap"></td>';
    tr.cells[0].textContent = c.name || '—';
    tr.cells[1].textContent = c.email || '—';
    var resetBtn = document.createElement('button'); resetBtn.className = 'btn-edit';
    resetBtn.style.cssText = 'padding:4px 10px;font-size:.72rem;margin-right:6px';
    resetBtn.textContent = 'Reset PW';
    resetBtn.addEventListener('click', function() { authSendReset(c.email); });
    var delBtn = document.createElement('button'); delBtn.className = 'btn-danger';
    delBtn.style.cssText = 'padding:4px 10px;font-size:.72rem';
    delBtn.textContent = 'Remove';
    delBtn.addEventListener('click', function() {
      if(authUser && c.id === authUser.uid) { showToast("You can't remove your own staff access."); return; }
      if(!confirm('Remove staff access for ' + (c.name || c.email) + '? Their sign-in will remain but they will lose all permissions.')) return;
      db.collection('staff').doc(c.id).delete()
        .then(function(){ showToast('Staff access removed.'); })
        .catch(function(e){ showToast('Error: '+e.message); });
    });
    tr.cells[3].appendChild(resetBtn);
    tr.cells[3].appendChild(delBtn);
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
  container.innerHTML = '';
  container.appendChild(tbl);
}

function adminAddCoach() {
  var name = document.getElementById('new-coach-name').value.trim();
  var email = document.getElementById('new-coach-email').value.trim();
  var pw = document.getElementById('new-coach-pin').value;
  var role = document.getElementById('new-coach-role').value;
  if(!name || !email || !pw) { showToast('Name, email, and temporary password are required.'); return; }
  if(pw.length < 8) { showToast('Temporary password must be at least 8 characters.'); return; }
  // Secondary app so creating the account doesn't sign the admin out
  var sec;
  try { sec = firebase.app('Secondary'); }
  catch(e) { sec = firebase.initializeApp(firebaseConfig, 'Secondary'); }
  sec.auth().createUserWithEmailAndPassword(email, pw)
    .then(function(cred) {
      return db.collection('staff').doc(cred.user.uid).set({
        name: name, email: email, role: role,
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      }).then(function(){ return sec.auth().signOut(); });
    })
    .then(function() {
      document.getElementById('new-coach-name').value = '';
      document.getElementById('new-coach-email').value = '';
      document.getElementById('new-coach-pin').value = '';
      showToast(name + ' added as ' + role + ' ✓ Share their email + temporary password.');
    })
    .catch(function(e) {
      if((e.code||'').indexOf('email-already-in-use') >= 0) {
        showToast('That email already has an account — have them sign in once, then add their staff record from the Firebase console (Authentication → copy UID → Firestore staff collection).');
      } else showToast('Error: ' + authErrMsg(e));
    });
}

function showToast(msg) {
  var t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(function(){t.classList.remove('show');},2800);
}

