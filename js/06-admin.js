// GameTracker game_type -> site schedule type (league games are just "game")
function gtScheduleType(g) {
  var t = String((g && g.game_type) || '').toLowerCase();
  if (t === 'tournament') return 'tournament';
  if (t === 'friendly') return 'friendly';
  return 'game';
}
// A GameTracker game rendered as a schedule row
function gtScheduleRow(g) {
  return {
    id: 'gt:' + g.id,
    name: gtOurName(g) + ' vs ' + gtTheirName(g),
    date: gtGameDateStr(g),
    time: g.kickoff_time || '',
    location: [g.venue, g.field].filter(Boolean).join(' · '),
    type: gtScheduleType(g),
    _gt: true,
    _cancelId: 'game_' + g.id
  };
}
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
  var text=appText('shortName')+' TOURNAMENT CREDIT TALLY\n'+Array(61).join('=')+'\n';
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
  var del=function(col){return tdb(col).get().then(function(snap){var b=db.batch();snap.forEach(function(d){b.delete(d.ref);});return b.commit();});};
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

// ---- TeamSnap de-duplication ----
// A TeamSnap row is hidden when its game already exists in GameTracker. The
// gt_game_id back-link only gets written when someone promotes the schedule row,
// so games created directly in GameTracker used to show up twice. Fall back to
// matching on date + the opponent parsed out of "... vs X" / "... at X".
function schedOppKey(s) {
  var m = String(s || '').match(/\b(?:vs\.?|at)\b\s+(.+)$/i);
  return m ? m[1].toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() : '';
}
function schedDupOfGtGame(it) {
  if (it.type === 'tournament') return false;   // tournaments link via gt_tournament_id
  if (typeof GT === 'undefined' || !GT.games || typeof gtGameDateStr !== 'function') return false;
  var key = schedOppKey(it.name);
  if (!key) return false;
  return GT.games.some(function(g) {
    if (gtGameDateStr(g) !== it.date) return false;
    var opp = String(gtTheirName(g) || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!opp) return false;
    return opp.indexOf(key) === 0 || key.indexOf(opp) === 0;
  });
}
function schedHidden(it) {
  return !!it.suppressed
    || !!(it.promoted && it.gt_game_id && typeof gtGame === 'function' && gtGame(it.gt_game_id))
    || schedDupOfGtGame(it);
}

function renderSchedule() {
  const today = new Date(); today.setHours(0,0,0,0);
  const gtEvents = (typeof GT !== 'undefined' && GT.games) ? GT.games.map(function(g){
    return { name: gtOurName(g) + ' vs ' + gtTheirName(g), date: gtGameDateStr(g), time: g.kickoff_time || '', location: [g.venue, g.field].filter(Boolean).join(' · '), type: gtScheduleType(g), _round: (typeof gtRoundLabel === 'function' ? gtRoundLabel(g.round) : ''), _seasonId: g.season_id || '', _ourName: gtOurName(g), _gt: true, _rsvpId: g.id, _cancelId: 'game_' + g.id };
  }).filter(function(e){ return e.date; }) : [];
  const condEvents = (typeof COND_SESSIONS !== 'undefined') ? COND_SESSIONS.map(function(s){
    return { name: 'Summer Conditioning', date: s.id, time: '17:00', location: 'Germantown Academy', type: 'practice', _auto: true, _cancelId: 'cond_' + s.id };
  }) : [];
  const campEvents = [];
  if (typeof MINI_CAMPS !== 'undefined') {
    MINI_CAMPS.forEach(function(c){
      if (!c.start) return;
      for (var off = 0; off < 2; off++) {
        var d = new Date(c.start + 'T00:00:00'); d.setDate(d.getDate() + off);
        var ds = d.getFullYear() + '-' + ('0'+(d.getMonth()+1)).slice(-2) + '-' + ('0'+d.getDate()).slice(-2);
        campEvents.push({ name: c.name + ' (Day ' + (off+1) + ')', date: ds, time: '18:00', location: c.location || '', type: 'event', _auto: true, _rsvpId: c.id + '-d' + (off+1), _cancelId: 'camp_' + c.id + '-d' + (off+1) });
      }
    });
  }
  const schedMs = ev => new Date((ev.date || '') + 'T' + (ev.time && /^\d{1,2}:\d{2}/.test(ev.time) ? ev.time : '00:00')).getTime();
  const sorted = [...scheduleItems.filter(it => !schedHidden(it)).map(it => Object.assign({ _cancelId: 'sched_' + it.id }, it)), ...gtEvents, ...condEvents, ...campEvents].sort((a,b) => schedMs(a) - schedMs(b));
  // Populate the team dropdown from the teams actually present.
  var _teamSel = document.getElementById('sched-team-filter');
  if (_teamSel) {
    var _present = {}; sorted.forEach(function(ev){ _present[schedTeamOf(ev)] = true; });
    var _order = [['delco', 'FC Delco'], ['f6ad', 'F6AD'], ['other', 'Other']];
    if (typeof scheduleTeamFilter !== 'undefined' && scheduleTeamFilter !== 'all' && !_present[scheduleTeamFilter]) scheduleTeamFilter = 'all';
    _teamSel.innerHTML = '<option value="all">All teams</option>' + _order.filter(function(o){ return _present[o[0]]; }).map(function(o){ return '<option value="' + o[0] + '"' + (scheduleTeamFilter === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
  }
  const _typeOk = ev => (typeof scheduleFilter === 'undefined' || scheduleFilter === 'all' || ev.type === scheduleFilter);
  const _teamOk = ev => (typeof scheduleTeamFilter === 'undefined' || scheduleTeamFilter === 'all' || schedTeamOf(ev) === scheduleTeamFilter);
  const vis = sorted.filter(ev => _typeOk(ev) && _teamOk(ev));
  const upcoming = vis.filter(ev => new Date(ev.date + 'T00:00:00') >= today);
  const past     = vis.filter(ev => new Date(ev.date + 'T00:00:00') <  today);

  const list  = document.getElementById('schedule-list');
  const empty = document.getElementById('schedule-empty');
  const toggle = document.getElementById('archive-toggle');
  const archiveList = document.getElementById('archive-list');

  function evHTML(ev, isPast) {
    const d = new Date(ev.date + 'T00:00:00');
    const month = d.toLocaleString('en-US',{month:'short'});
    const day = d.getDate();
    const time = ev.time ? (() => { const [h,m]=ev.time.split(':'); const hr=+h; return `${hr>12?hr-12:hr||12}:${m} ${hr>=12?'PM':'AM'}`; })() : '';
    const canceled = !!(ev._cancelId && typeof canceledEvents !== 'undefined' && canceledEvents[ev._cancelId]);
    var _seasonName = (typeof schedSeasonLabel === 'function') ? schedSeasonLabel(ev) : '';
    const staff = (typeof isAdminUnlocked === 'function' && isAdminUnlocked()) || (typeof isCoachLoggedIn === 'function' && isCoachLoggedIn());
    return `<div class="event-item${isPast?' past':''}${canceled?' canceled':''}${ev._cancelId?' editable':''}"${ev._cancelId?` onclick="schedShowDetails('${ev._cancelId}')" title="Click for details"`:''}>
      <div class="event-date"><div class="month">${month}</div><div class="day">${day}</div></div>
      <div class="event-info">
        <div class="event-name"><span class="evn-text">${ev.name}</span>${ev._round?` <span class="round-badge">${ev._round}</span>`:''}${_seasonName?` <span class="season-badge">📅 ${_seasonName}</span>`:''}${ev.source==='teamsnap'?` <span class="ts-badge">${APP_CONFIG.clubName||'TeamSnap'}</span>`:''}${canceled?' <span class="cancel-badge">Canceled</span>':''}</div>
        <div class="event-detail">${ev.location}${time?' · '+time:''}</div>
        <span class="event-type type-${ev.type}">${ev.type.charAt(0).toUpperCase()+ev.type.slice(1)}</span>
        ${(!isPast && !canceled && ev._rsvpId) ? `<a class="sched-rsvp" href="#/gametracker/rsvp/${ev._rsvpId}" onclick="event.stopPropagation()">📋 RSVP / availability</a>` : ''}
        ${(staff && ev._cancelId && ev._cancelId.indexOf('sched_')===0 && (ev.type==='game'||ev.type==='tournament'||ev.type==='friendly')) ? `<button class="sched-fulledit" onclick="event.stopPropagation();schedPromoteToGame('${ev._cancelId.slice(6)}')">🎮 Full game details</button>` : ''}
        ${(staff && ev._cancelId) ? `<button class="sched-edit" onclick="event.stopPropagation();schedEditEvent('${ev._cancelId}')">✏️ Edit</button>` : ''}
        ${(staff && ev._cancelId) ? `<button class="sched-cancel" onclick="event.stopPropagation();cancelEvent('${ev._cancelId}', ${canceled?'false':'true'})">${canceled?'↩ Un-cancel':'🚫 Mark canceled'}</button>` : ''}
        ${(staff && ev._cancelId && (ev._cancelId.indexOf('game_')===0 || ev._cancelId.indexOf('sched_')===0)) ? `<button class="sched-del" onclick="event.stopPropagation();schedDeleteEvent('${ev._cancelId}')">🗑 Delete</button>` : ''}
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

function setScheduleFilter(f, btn) {
  scheduleFilter = f;
  document.querySelectorAll('#sched-filters .sched-chip').forEach(function(c){ c.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  renderSchedule();
}
function setScheduleTeam(v) {
  scheduleTeamFilter = v;
  renderSchedule();
}
function toggleArchive() {
  showPastEvents = !showPastEvents;
  renderSchedule();
}

function renderAdminSchedule() {
  if (typeof renderTeamsnapSync === 'function') renderTeamsnapSync();
  const gtRows = (typeof GT !== 'undefined' && GT.games)
    ? GT.games.map(gtScheduleRow).filter(e => e.date) : [];
  const condRows = (typeof COND_SESSIONS !== 'undefined') ? COND_SESSIONS.map(function(cs){
    return { id: 'cond_' + cs.id, name: 'Summer Conditioning', date: cs.id, time: '17:00', location: 'Germantown Academy', type: 'practice', _auto: true, _readonly: true, _cancelId: 'cond_' + cs.id };
  }) : [];
  const campRows = [];
  if (typeof MINI_CAMPS !== 'undefined') {
    MINI_CAMPS.forEach(function(c){
      if (!c.start) return;
      for (var off = 0; off < 2; off++) {
        var d = new Date(c.start + 'T00:00:00'); d.setDate(d.getDate() + off);
        var ds = d.getFullYear() + '-' + ('0'+(d.getMonth()+1)).slice(-2) + '-' + ('0'+d.getDate()).slice(-2);
        campRows.push({ id: 'camp_' + c.id + '-d' + (off+1), name: c.name + ' (Day ' + (off+1) + ')', date: ds, time: '18:00', location: c.location || '', type: 'event', _auto: true, _readonly: true, _cancelId: 'camp_' + c.id + '-d' + (off+1) });
      }
    });
  }
  const items = [...scheduleItems.filter(it => !schedHidden(it)).map(it => Object.assign({ _cancelId: 'sched_' + it.id }, it)), ...gtRows, ...condRows, ...campRows].sort((a,b) => new Date(a.date) - new Date(b.date));
  const el = document.getElementById('admin-schedule-list');
  if (!items.length) { el.innerHTML = '<p style="font-size:.85rem;color:var(--muted);margin-bottom:14px">No events yet.</p>'; return; }
  el.innerHTML = items.map(ev => `
    <div class="admin-item">
      <div class="admin-item-info">
        <strong style="${(typeof canceledEvents!=='undefined'&&ev._cancelId&&canceledEvents[ev._cancelId])?'text-decoration:line-through;color:var(--muted)':''}">${ev.name}</strong>${ev._gt?' <span class="gt-src-badge">GameTracker</span>':''}${(typeof canceledEvents!=='undefined'&&ev._cancelId&&canceledEvents[ev._cancelId])?' <span class="cancel-badge">Canceled</span>':''}
        <span>${ev.date}${ev.time?' · '+ev.time:''} · ${ev.location} · ${ev.type}</span>
      </div>
      <div class="admin-item-actions">
        ${ev._cancelId ? `<button class="btn-edit" onclick="cancelEvent('${ev._cancelId}', ${(typeof canceledEvents!=='undefined'&&canceledEvents[ev._cancelId])?'false':'true'})">${(typeof canceledEvents!=='undefined'&&canceledEvents[ev._cancelId])?'↩ Un-cancel':'🚫 Cancel'}</button>` : ''}
        ${ev._readonly ? '' : `<button class="btn-edit" onclick="editEvent('${ev.id}')">Edit</button>`}
        ${(ev._gt || ev._readonly) ? '' : `<button class="btn-danger" onclick="deleteEvent('${ev.id}')">Delete</button>`}
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
  var p = editingVenueId ? tdb('venues').doc(editingVenueId).set(data) : tdb('venues').add(data);
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
  tdb('venues').doc(id).delete().then(function(){ showToast('Venue deleted.'); }).catch(function(e){ showToast('Error: '+e.message); });
}
function saveEvent() {
  const name = document.getElementById('ev-name').value.trim();
  const type = document.getElementById('ev-type').value;
  const date = document.getElementById('ev-date').value;
  const time = document.getElementById('ev-time').value;
  const location = document.getElementById('ev-location').value.trim();
  if (!name || !date) { showToast('Name and date are required.'); return; }
  // A GameTracker game: write the changes back to gt_games, not the schedule collection.
  if (String(editingEventId || '').indexOf('gt:') === 0) {
    const gid = String(editingEventId).slice(3);
    const g = (typeof gtGame === 'function') ? gtGame(gid) : null;
    const parts = location.split(' · ');
    const upd = {
      game_type: type === 'tournament' ? 'tournament' : type === 'friendly' ? 'friendly' : 'league',
      kickoff_time: time || '',
      venue: (parts[0] || '').trim(),
      field: parts.length > 1 ? parts.slice(1).join(' · ').trim() : '',
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (date) upd.played_at = firebase.firestore.Timestamp.fromDate(new Date(date + 'T12:00:00'));
    const vs = name.split(/\s+vs\.?\s+/i);
    if (g && vs.length === 2) {
      const ours = vs[0].trim(), theirs = vs[1].trim();
      if (g.f6ad_side === 'away') { upd.away_team = ours; upd.home_team = theirs; }
      else { upd.home_team = ours; upd.away_team = theirs; }
    }
    tdb('gt_games').doc(gid).set(upd, { merge: true })
      .then(() => { cancelEventEdit(); showToast('✅ GameTracker game updated!'); })
      .catch(e => showToast('Error: ' + e.message));
    return;
  }
  const data = {name, type, date, time, location};
  // Editing pins the event: merge (so source/club survive) and flag it so the
  // TeamSnap sync will not overwrite your changes on its next run.
  if (editingEventId) data.manual_override = true;
  const p = editingEventId
    ? tdb('schedule').doc(editingEventId).set(data, { merge: true })
    : tdb('schedule').add(data);
  p.then(() => { cancelEventEdit(); showToast('✅ Event saved!'); })
   .catch(e => showToast('Error: ' + e.message));
}

function editEvent(id) {
  let ev;
  if (String(id).indexOf('gt:') === 0) {
    const g = (typeof gtGame === 'function') ? gtGame(String(id).slice(3)) : null;
    if (!g) return;
    ev = gtScheduleRow(g);
  } else {
    ev = scheduleItems.find(e => e.id === id);
  }
  if (!ev) return;
  editingEventId = id;
  document.getElementById('ev-name').value = ev.name;
  document.getElementById('ev-type').value = ev.type;
  document.getElementById('ev-date').value = ev.date;
  document.getElementById('ev-time').value = ev.time || '';
  document.getElementById('ev-location').value = ev.location;
  document.getElementById('schedule-form-title').textContent = '✏️ Edit Event';
  document.getElementById('cancel-ev-btn').style.display = 'inline-block';
  var ft = document.getElementById('schedule-form-title');
  if (ft && ft.scrollIntoView) ft.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
  tdb('schedule').doc(id).delete()
    .then(() => showToast('Event deleted.'))
    .catch(e => showToast('Error: ' + e.message));
}

// ===================== ANNOUNCEMENTS =====================
function summerWrapNote() {
  // Auto-posted, date-gated note. Appears on/after Sep 1, 2026 with no manual step.
  var flip = (typeof SEASON_FLIP_DATE !== 'undefined') ? SEASON_FLIP_DATE : new Date('2026-09-01T00:00:00');
  if (new Date() < flip) return null;
  return {
    id: 'auto-summer-wrap-2026',
    date: 'Sep 1, 2026',
    title: '☀️ Summer wrapped up — on to Fall!',
    body: 'That\u2019s a wrap on the summer tournament season \u2014 thank you to every player, parent, and coach who made it a great one. The Summer \u201926 slate is now in the archives (still viewable under the Summer tab), and the Tournaments page has rolled over to our Fall \u201926 season. Let\u2019s keep it rolling. \ud83d\udcaa\u26bd',
    _auto: true
  };
}
function renderAnnouncements() {
  const active = [...announcementItems]
    .filter(a => !a.archived)
    .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
  const _sw = summerWrapNote();
  if (_sw) active.unshift(_sw);   // pin the auto note to the top once it's live
  const list = document.getElementById('announcements-list');
  const empty = document.getElementById('ann-empty');
  if (!active.length) { list.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display = 'none';
  const staff = (typeof isAdminUnlocked === 'function' && isAdminUnlocked()) || (typeof isCoachLoggedIn === 'function' && isCoachLoggedIn());
  list.innerHTML = active.map(a => {
    const cs = annCommentsFor(a.id);
    const open = !!openAnnComments[a.id];
    return `
    <div class="ann-item">
      <div class="ann-date">${a.date}</div>
      <div class="ann-title">${a.title}</div>
      <div class="ann-body">${a.body}</div>
      <button class="ann-ctoggle" onclick="toggleAnnComments('${a.id}')">💬 ${cs.length ? cs.length + (cs.length === 1 ? ' comment' : ' comments') : 'Add a comment'}</button>
      ${open ? `
      <div class="ann-comments">
        ${cs.length ? cs.map(c => `
          <div class="ann-comment">
            <div class="ac-head"><span class="ac-name">${annEsc(c.name || 'Anonymous')}</span><span class="ac-time">${annCommentTime(c.created_at)}</span>${staff ? `<button class="ac-del" title="Delete comment" onclick="deleteAnnComment('${c.id}')">🗑</button>` : ''}</div>
            <div class="ac-text">${annEsc(c.text || '')}</div>
          </div>`).join('') : '<div class="ac-empty">No comments yet — be the first.</div>'}
        <div class="ann-cform">
          <input type="text" id="acn-${a.id}" placeholder="Your name" value="${annEsc(annCommentName())}"/>
          <textarea id="act-${a.id}" placeholder="Write a comment…" rows="2"></textarea>
          <button class="btn-primary" onclick="postAnnComment('${a.id}')">Post Comment</button>
        </div>
      </div>` : ''}
    </div>`;
  }).join('');
}

// ---------- Announcement comments (open to parents, staff can moderate) ----------
function annEsc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function annCommentTime(ts) {
  var d = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
  if (!d || isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' +
         d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function annCommentsFor(annId) {
  return annComments.filter(function(c){ return c.ann_id === annId; })
    .sort(function(a, b){ return ((a.created_at && a.created_at.seconds) || 0) - ((b.created_at && b.created_at.seconds) || 0); });
}
function annCommentName() {
  try { return localStorage.getItem('f6ad_comment_name') || (typeof getCondName === 'function' ? (getCondName() || '') : '') || ''; }
  catch (e) { return ''; }
}
function setAnnCommentName(v) { try { localStorage.setItem('f6ad_comment_name', v); } catch (e) {} }
function toggleAnnComments(annId) {
  openAnnComments[annId] = !openAnnComments[annId];
  renderAnnouncements();
}
function postAnnComment(annId) {
  var nameEl = document.getElementById('acn-' + annId);
  var textEl = document.getElementById('act-' + annId);
  var name = ((nameEl && nameEl.value) || '').trim();
  var text = ((textEl && textEl.value) || '').trim();
  if (!name) { showToast('Add your name first.'); return; }
  if (!text) { showToast('Write a comment first.'); return; }
  setAnnCommentName(name);
  tdb('ann_comments').add({
    ann_id: annId, name: name, text: text,
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(){ if (textEl) textEl.value = ''; showToast('Comment posted ✓'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function deleteAnnComment(id) {
  if (!(isAdminUnlocked() || isCoachLoggedIn())) { showToast('Coach/admin only.'); return; }
  if (!confirm('Delete this comment?')) return;
  tdb('ann_comments').doc(id).delete()
    .then(function(){ showToast('Comment deleted.'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
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
  tdb('announcements').doc(id).update({ archived: !isArchived })
    .then(() => showToast(isArchived ? 'Announcement restored.' : 'Announcement archived.'))
    .catch(e => showToast('Error: ' + e.message));
}

function saveAnnouncement() {
  const title = document.getElementById('ann-title').value.trim();
  const body = document.getElementById('ann-body').value.trim();
  if (!title || !body) { showToast('Title and message are required.'); return; }
  const now = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const p = editingAnnId
    ? tdb('announcements').doc(editingAnnId).update({title, body})
    : tdb('announcements').add({title, body, date: now, createdAt: firebase.firestore.FieldValue.serverTimestamp()});
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
  tdb('announcements').doc(id).delete()
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
  inp.style.cssText = 'flex:1;border:1.5px solid var(--brand);border-radius:6px;padding:4px 8px;font-size:.85rem';
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
    var ref = tdb('conditioning').doc(campId);
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
  tdb('conditioning').doc(campId).set(
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
  tdb('conditioning').doc(campId).set(
    { attendees: firebase.firestore.FieldValue.arrayRemove(name) },
    { merge: true }
  ).then(function() { showToast(name + ' removed'); })
  .catch(function(e) { showToast('Error: ' + e.message); });
}

function adminAddToCamp(campId) {
  var input = document.getElementById('camp-add-'+campId);
  var name = input ? input.value.trim() : '';
  if(!name){showToast('Enter a player name.'); return;}
  tdb('conditioning').doc(campId).set(
    {attendees: firebase.firestore.FieldValue.arrayUnion(name)},
    {merge: true}
  ).then(function(){ input.value=''; showToast(name+' added ✓'); })
  .catch(function(e){showToast('Error: '+e.message);});
}
function adminRemoveFromCamp(campId, name) {
  tdb('conditioning').doc(campId).set(
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
  if (typeof attachVotesListeners === 'function') attachVotesListeners();
  if (typeof attachConditioningListeners === 'function') attachConditioningListeners();
  if (typeof attachFeedbackListener === 'function') attachFeedbackListener();
  if (typeof attachDevCardsListener === 'function') attachDevCardsListener();
  // The parent-stat collections only attach once GameTracker is opened, so pull them
  // in here too — otherwise the review alert has nothing to count.
  if (typeof gtListenHeavy === 'function') gtListenHeavy();
  if (typeof renderGtReviewAlert === 'function') renderGtReviewAlert();
  var pwEl = document.getElementById('admin-pw-input');
  if (pwEl) pwEl.value = '';
  var acct = document.getElementById('settings-account-line');
  if (acct && authUser) acct.textContent = 'Signed in as ' + authUser.email + (authStaffName ? ' (' + authStaffName + ')' : '');
  renderAdminSchedule();
  renderAdminAnnouncements();
  renderVoteTally();
  renderSiteFlags();
}

function switchTab(tab, btn) {
  if(tab==='venues') renderVenuesAdmin();
  if(tab==='camps') renderAdminCamps();
  if(tab==='players') renderAdminPlayers();
  if(tab==='sessions') renderAdminSessions();
  if(tab==='coaches') renderAdminCoaches();
  if(tab==='families') renderAdminFamilies();
  if(tab==='feedback') renderAdminFeedback();
  if(tab==='devcards') renderAdminDevCards();
  if(tab==='visitors') renderAdminVisitors();
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
  tdb('players').doc(playerName).set(data, {merge: true})
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
  editTd.style.cssText = 'background:var(--brand-soft);padding:14px;';

  var editDiv = document.createElement('div');
  editDiv.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end';

  // Test time input only (group is managed via drag-and-drop)
  var timeDiv = document.createElement('div');
  var timeLbl = document.createElement('label'); timeLbl.textContent = 'Test Time (mm:ss)';
  timeLbl.style.cssText = 'display:block;font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:3px';
  var timeInp = document.createElement('input'); timeInp.type = 'text';
  timeInp.id = 'pe-time'; timeInp.placeholder = '6:15';
  timeInp.value = p.testTime || '';
  timeInp.style.cssText = 'border:2px solid var(--brand);border-radius:6px;padding:6px 10px;font-size:.85rem;font-family:inherit;width:90px';
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

  tdb('players').doc(playerName).set(data, {merge: true})
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
    var attCount = log && log.attendance ? Object.values(log.attendance).filter(function(v){ return v === true || (v && v.present); }).length : 0;

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
    inp.id = id; inp.min = min; inp.max = max; inp.value = val || ''; inp.style.borderColor = 'var(--brand)';
    d.appendChild(l); d.appendChild(inp);
    return d;
  }
  var blocksF = numField('sadmin-blocks-'+sessionId, 'Blocks', log2.blocks, 1, 20);
  var totalF = numField('sadmin-total-'+sessionId, 'Total Reps (auto)', log2.total_reps, 0, 9999);
  var totalInp = totalF.querySelector('input'); totalInp.readOnly = true; totalInp.style.background = '#eee';
  var blocksInp = blocksF.querySelector('input');
  fr.appendChild(blocksF); fr.appendChild(totalF);
  container.appendChild(fr);

  // Per-block reps (one input per block; each block can differ)
  var repsD = document.createElement('div'); repsD.className = 'log-field'; repsD.style.marginBottom = '12px';
  var repsL = document.createElement('label'); repsL.textContent = 'Reps per Block (set each block individually)';
  var repsWrap = document.createElement('div'); repsWrap.id = 'sadmin-block-reps-'+sessionId;
  repsWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:4px';
  repsD.appendChild(repsL); repsD.appendChild(repsWrap);
  container.appendChild(repsD);

  function recalc() {
    var t = 0, any = false;
    repsWrap.querySelectorAll('input.block-rep-inp').forEach(function(inp){
      var v = parseInt(inp.value); if(!isNaN(v)){ t += v; any = true; }
    });
    totalInp.value = any ? t : '';
  }
  function buildRepInputs() {
    var n = parseInt(blocksInp.value) || 0;
    var cur = [];
    repsWrap.querySelectorAll('input.block-rep-inp').forEach(function(inp){ cur.push(inp.value); });
    repsWrap.innerHTML = '';
    var existing = sessionBlockReps(log2);
    for(var i=0;i<n;i++){
      var cell = document.createElement('div');
      cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:64px';
      var cl = document.createElement('label');
      cl.textContent = 'Block ' + (i+1);
      cl.style.cssText = 'font-size:.68rem;color:var(--muted);margin-bottom:2px';
      var ci = document.createElement('input'); ci.type = 'number'; ci.min = '0'; ci.max = '50';
      ci.className = 'block-rep-inp'; ci.style.cssText = 'width:100%;text-align:center;border-color:var(--brand)';
      var val = (cur[i] !== undefined && cur[i] !== '') ? cur[i] : (existing[i] !== undefined ? existing[i] : '');
      ci.value = val;
      ci.addEventListener('input', recalc);
      cell.appendChild(cl); cell.appendChild(ci); repsWrap.appendChild(cell);
    }
    recalc();
  }
  blocksInp.addEventListener('input', buildRepInputs);
  if(!blocksInp.value){ var initN = sessionBlockReps(log2).length; if(initN) blocksInp.value = initN; }
  buildRepInputs();

  // Notes
  var notesD = document.createElement('div'); notesD.className = 'log-field'; notesD.style.marginBottom = '12px';
  var notesL = document.createElement('label'); notesL.textContent = 'Notes';
  var notesTA = document.createElement('textarea'); notesTA.id = 'sadmin-notes-'+sessionId;
  notesTA.value = log2.notes || ''; notesTA.style.borderColor = 'var(--brand)';
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
    var blockReps = [];
    var brW = document.getElementById('sadmin-block-reps-'+sid);
    if(brW){ brW.querySelectorAll('input.block-rep-inp').forEach(function(inp){ var v = parseInt(inp.value); blockReps.push(isNaN(v)?0:v); }); }
    var total = blockReps.length ? blockReps.reduce(function(a,b){return a+b;},0) : null;
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
    if(blockReps.length){ data.block_reps = blockReps; data.reps_per_block = firebase.firestore.FieldValue.delete(); }
    if(total) data.total_reps = total;
    if(notes) data.notes = notes;
    tdb('session_log').doc(sid).set(data, {merge:true})
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
    if (typeof renderAdminAccounts === 'function') renderAdminAccounts();
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
      tdb('staff').doc(c.id).delete()
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
  if (typeof renderAdminAccounts === 'function') renderAdminAccounts();
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
      return tdb('staff').doc(cred.user.uid).set({
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

function cancelEvent(cancelId, on) {
  if (!(isAdminUnlocked() || isCoachLoggedIn())) { showToast('Coach/admin sign-in required.'); return; }
  if (on) {
    tdb('cancellations').doc(cancelId).set({ canceled: true, by: (isAdminUnlocked() ? 'Admin' : (coachName || 'Coach')), at: firebase.firestore.FieldValue.serverTimestamp() })
      .then(function(){ showToast('Event marked canceled.'); }).catch(function(e){ showToast('Error: ' + e.message); });
  } else {
    tdb('cancellations').doc(cancelId).delete()
      .then(function(){ showToast('Cancellation removed.'); }).catch(function(e){ showToast('Error: ' + e.message); });
  }
}


// ===== Click-to-edit any event from the public Schedule page (staff only) =====
function schedDeleteEvent(cancelId) {
  var staff = (typeof isAdminUnlocked === 'function' && isAdminUnlocked()) || (typeof isCoachLoggedIn === 'function' && isCoachLoggedIn());
  if (!staff || !cancelId) return;
  var us = cancelId.indexOf('_'); if (us < 0) return;
  var kind = cancelId.slice(0, us), rest = cancelId.slice(us + 1);
  if (kind === 'game') {
    if (!confirm('Delete this game and all its stats? This cannot be undone.')) return;
    var op = (typeof gtDeleteGameDocs === 'function') ? gtDeleteGameDocs(rest) : tdb('gt_games').doc(rest).delete();
    op.then(function(){ showToast('Game deleted.'); }).catch(function(e){ showToast('Error: ' + e.message); });
    return;
  }
  if (kind === 'sched') {
    var _ev = (typeof scheduleItems !== 'undefined') ? scheduleItems.find(function(e){ return e.id === rest; }) : null;
    if (_ev && _ev.source === 'teamsnap') {
      if (!confirm('Remove this TeamSnap event from the schedule?\n\nIt stays hidden and the daily TeamSnap sync will NOT bring it back — use this when you\'ve added your own games in its place.')) return;
      tdb('schedule').doc(rest).set({ suppressed: true, manual_override: true, updated_at: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
        .then(function(){ showToast('TeamSnap event removed — it won\'t sync back.'); }).catch(function(e){ showToast('Error: ' + e.message); });
      return;
    }
    if (!confirm('Delete this schedule event? This cannot be undone.')) return;
    tdb('schedule').doc(rest).delete().then(function(){ showToast('Event deleted.'); }).catch(function(e){ showToast('Error: ' + e.message); });
    return;
  }
  showToast('Conditioning and camp entries are auto-generated \u2014 use Mark canceled instead.');
}
function schedActivateAdminTab(tab) {
  var btn = document.querySelector('.admin-tab[onclick*="\'' + tab + '\'"]');
  if (btn && typeof switchTab === 'function') switchTab(tab, btn);
}
function schedEditEvent(cancelId) {
  var staff = (typeof isAdminUnlocked === 'function' && isAdminUnlocked()) || (typeof isCoachLoggedIn === 'function' && isCoachLoggedIn());
  if (!staff || !cancelId) return;
  var us = cancelId.indexOf('_');
  if (us < 0) return;
  var kind = cancelId.slice(0, us);
  var rest = cancelId.slice(us + 1);
  if (kind === 'game') {
    if (typeof gtOpenGameEdit === 'function') gtOpenGameEdit(rest);
    else if (typeof showToast === 'function') showToast('Open GameTracker to edit this game.');
    return;
  }
  if (kind === 'sched') {
    if (typeof openAdmin === 'function') openAdmin();
    schedActivateAdminTab('schedule');
    if (typeof editEvent === 'function') editEvent(rest);
    return;
  }
  if (kind === 'camp') {
    if (typeof openAdmin === 'function') openAdmin();
    schedActivateAdminTab('camps');
    if (typeof showToast === 'function') showToast('Edit camp details on the Camps tab.');
    return;
  }
  if (kind === 'cond') {
    if (typeof showToast === 'function') showToast('Conditioning sessions are auto-generated \u2014 use Mark canceled to cancel one.');
    return;
  }
}


// ===== Promote a TeamSnap (or manual) game/tournament into a full GameTracker game =====
// Read-only game/event details popup (available to everyone, incl. parents).
function schedShowDetails(cancelId) {
  if (!cancelId || typeof gtOpenModal !== 'function') return;
  var us = cancelId.indexOf('_'); if (us < 0) return;
  var kind = cancelId.slice(0, us), id = cancelId.slice(us + 1);
  var name = '', date = '', time = '', venue = '', addr = '', field = '', type = '', round = '', season = '', officialUrl = '', rsvpId = '', gtId = '', gtComplete = false, tournId = '';

  if (kind === 'game') {
    var g = gtGame(id); if (!g) { if (typeof showToast === 'function') showToast('Game not found.'); return; }
    name = gtOurName(g) + ' vs ' + gtTheirName(g);
    date = gtGameDateStr(g); time = g.kickoff_time || '';
    venue = g.venue || ''; addr = [g.venue_address, g.venue_city, g.venue_state, g.venue_zip].filter(Boolean).join(', ');
    field = g.field || ''; type = gtScheduleType(g);
    round = (typeof gtRoundLabel === 'function') ? gtRoundLabel(g.round) : '';
    officialUrl = (typeof gtTournUrlFor === 'function') ? gtTournUrlFor(g) : '';
    if (g.season_id && typeof gtSeason === 'function') { var se = gtSeason(g.season_id); if (se) season = se.name; }
    rsvpId = g.id; gtId = g.id; gtComplete = (g.status === 'complete'); tournId = g.tournament_id || '';
  } else if (kind === 'sched') {
    var ev = (typeof scheduleItems !== 'undefined') ? scheduleItems.find(function(e){ return e.id === id; }) : null;
    if (!ev) { if (typeof showToast === 'function') showToast('Event not found.'); return; }
    name = ev.name; date = ev.date; time = ev.time || '';
    var parts = String(ev.location || '').split(' \u00b7 '); venue = parts[0] || ''; field = parts.slice(1).join(' \u00b7 ');
    type = ev.type || '';
    if (typeof schedSeasonLabel === 'function') season = schedSeasonLabel(ev) || '';
    officialUrl = (ev.official_url || '');
    rsvpId = ev._rsvpId || '';
  } else {
    // conditioning / camp / other auto events
    var src = null;
    if (typeof scheduleItems !== 'undefined') src = scheduleItems.find(function(e){ return ('sched_' + e.id) === cancelId; });
    name = (src && src.name) || cancelId; 
  }
  if (!name) { if (typeof showToast === 'function') showToast('No details available.'); return; }

  var typeLabel = type ? (type.charAt(0).toUpperCase() + type.slice(1)) : '';
  var dObj = date ? new Date(date + 'T00:00:00') : null;
  var dateStr = (dObj && !isNaN(dObj.getTime())) ? dObj.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' }) : (date || '');
  var timeStr = '';
  if (time && /^\d{1,2}:\d{2}/.test(time)) { var hm = time.split(':'); var hr = +hm[0]; timeStr = (hr>12?hr-12:hr||12) + ':' + hm[1] + ' ' + (hr>=12?'PM':'AM'); }
  var mapsUrl = addr ? ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((venue?venue+', ':'') + addr)) : '';

  var h = '<h3>' + gtEsc(name) + '<button class="gm-close" onclick="gtCloseModal()">\u2715</button></h3>';
  h += '<div class="sd-tags">';
  if (typeLabel) h += '<span class="event-type type-' + gtEsc(type) + '">' + gtEsc(typeLabel) + '</span>';
  if (round) h += '<span class="round-badge">' + gtEsc(round) + '</span>';
  if (season) h += '<span class="season-badge">\ud83d\udcc5 ' + gtEsc(season) + '</span>';
  h += '</div>';
  h += '<div class="sd-rows">';
  if (dateStr) h += '<div class="sd-row"><span class="sd-k">\ud83d\udcc5 When</span><span class="sd-v">' + gtEsc(dateStr) + (timeStr ? ' \u00b7 ' + gtEsc(timeStr) : '') + '</span></div>';
  if (venue || addr) h += '<div class="sd-row"><span class="sd-k">\ud83d\udccd Where</span><span class="sd-v">' + gtEsc([venue, addr].filter(Boolean).join(' \u2014 ')) + (mapsUrl ? ' <a href="' + gtAttr(mapsUrl) + '" target="_blank" rel="noopener">map \u2192</a>' : '') + '</span></div>';
  if (field) h += '<div class="sd-row"><span class="sd-k">\ud83e\udd45 Field</span><span class="sd-v">' + gtEsc(field) + '</span></div>';
  h += '</div>';
  if (officialUrl) h += '<a class="gt-tourn-link" href="' + gtAttr(officialUrl) + '" target="_blank" rel="noopener">\ud83d\udd17 Official tournament site \u2192</a>';
  var _staff = (typeof isAdminUnlocked === 'function' && isAdminUnlocked()) || (typeof isCoachLoggedIn === 'function' && isCoachLoggedIn());
  if (!officialUrl && tournId && _staff && typeof gtOpenTournamentForm === 'function') h += '<button class="gt-tourn-link" style="background:#fff;cursor:pointer" onclick="gtCloseModal();gtOpenTournamentForm(\'' + tournId + '\')">\u2795 Add official tournament link</button>';
  h += '<div class="gm-actions">';
  if (rsvpId) h += '<a class="btn-primary" href="#/gametracker/rsvp/' + gtEsc(rsvpId) + '" onclick="gtCloseModal()">\ud83d\udccb RSVP / availability</a>';
  if (gtId) h += '<a class="gt-minibtn" href="#/gametracker/' + (gtComplete ? 'review' : 'live') + '/' + gtEsc(gtId) + '" onclick="gtCloseModal()">' + (gtComplete ? '\ud83d\udcca Stats' : '\u26bd Open game') + '</a>';
  h += '<button class="gt-minibtn" onclick="gtCloseModal()">Close</button>';
  h += '</div>';
  gtOpenModal(h);
}

// Which team an event belongs to: our FC Delco / MLS Next AD side vs the "F6AD"
// tournament-team side (else "other"). Used by the schedule team filter.
function schedTeamOf(ev) {
  if (!ev) return 'other';
  var ours = ev._ourName || (typeof schedParseMatchup === 'function' ? schedParseMatchup(ev.name || '').ours : (ev.name || ''));
  if (/delco|mls\s*next/i.test(ours)) return 'delco';
  if (/f6ad/i.test(ours)) return 'f6ad';
  if (/delco|mls\s*next/i.test(ev.name || '')) return 'delco';
  if (/f6ad/i.test(ev.name || '')) return 'f6ad';
  return 'other';
}
// Season tag rule: ONLY FC Delco / MLS Next AD *league games* carry a season label.
// Tournaments, friendlies, practices/events, and any game where our side is the
// "F6AD" tournament team are deliberately excluded.
function schedSeasonLabel(ev) {
  if (!ev || ev.type !== 'game') return '';
  var ours = ev._ourName || (typeof schedParseMatchup === 'function' ? schedParseMatchup(ev.name || '').ours : (ev.name || ''));
  if (/f6ad/i.test(ours)) return '';              // playing as the F6AD tournament team -> not a league game
  if (!/delco|mls\s*next/i.test(ours)) return ''; // must be our FC Delco / MLS Next AD side
  var se = (ev._seasonId && typeof gtSeason === 'function') ? gtSeason(ev._seasonId) : null;
  if (!se && ev.date && typeof gtSeasonForDate === 'function') se = gtSeasonForDate(ev.date);
  return se ? se.name : '';
}
function schedParseMatchup(name) {
  var raw = String(name || '').trim();
  var ourRe = /f6ad|delco/i;
  var def = 'FC Delco MLS Next AD U14';
  function pick(a, b, aIsHome) {
    a = a.trim(); b = b.trim();
    var aOurs = ourRe.test(a), bOurs = ourRe.test(b);
    if (aOurs && !bOurs) return { ours: a, opp: b, side: aIsHome ? 'home' : 'away' };
    if (bOurs && !aOurs) return { ours: b, opp: a, side: aIsHome ? 'away' : 'home' };
    return { ours: a, opp: b, side: aIsHome ? 'home' : 'away' };
  }
  var vs = raw.split(/\s+vs\.?\s+/i);
  if (vs.length === 2) return pick(vs[0], vs[1], true);
  var at = raw.split(/\s+@\s+|\s+\bat\b\s+/i);
  if (at.length === 2) return pick(at[0], at[1], false);
  return { ours: def, opp: raw, side: 'home' };
}
function schedPromoteToGame(schedId) {
  var staff = (typeof isAdminUnlocked === 'function' && isAdminUnlocked()) || (typeof isCoachLoggedIn === 'function' && isCoachLoggedIn());
  if (!staff) return;
  var ev = scheduleItems.find(function(e){ return e.id === schedId; });
  if (!ev) { if (typeof showToast === 'function') showToast('Event not found.'); return; }
  // Already promoted: just reopen the linked game's full editor.
  if (ev.gt_game_id && typeof gtGame === 'function' && gtGame(ev.gt_game_id)) {
    if (typeof gtOpenGameEdit === 'function') gtOpenGameEdit(ev.gt_game_id);
    return;
  }
  var roster = (typeof gtActiveRoster === 'function' && gtActiveRoster()) || (typeof GT !== 'undefined' && GT.rosters && GT.rosters[0]);
  if (!roster) { if (typeof showToast === 'function') showToast('Create a roster in GameTracker first, then try again.'); return; }
  var m = schedParseMatchup(ev.name);
  var gtype = ev.type === 'tournament' ? 'tournament' : ev.type === 'friendly' ? 'friendly' : 'league';
  // Match format: the season wins if it sets one, otherwise the deployment's
  // defaults. Hardcoding 11v11 / 35s here silently mis-set every promoted game
  // and quietly corrupted minutes-played, since the clock runs off these.
  var se = (typeof gtCurrentSeason === 'function' && gtCurrentSeason()) || null;
  var gd = appGameDefaults();
  var parts = String(ev.location || '').split(' \u00b7 ');
  var ts = firebase.firestore.FieldValue.serverTimestamp();
  var gameRef = tdb('gt_games').doc();
  var data = {
    roster_id: roster.id, tournament_id: null,
    season_id: se ? se.id : null,
    home_team: m.side === 'away' ? m.opp : m.ours,
    away_team: m.side === 'away' ? m.ours : m.opp,
    f6ad_side: m.side,
    game_type: gtype, round: '',
    venue: (parts[0] || '').trim(), venue_address: '', venue_city: '', venue_state: '', venue_zip: '',
    num_periods: (se && se.num_periods) || gd.num_periods,
    period_duration_minutes: (se && se.period_duration_minutes) || gd.period_duration_minutes,
    players_per_side: (se && se.players_per_side) || gd.players_per_side,
    kickoff_time: ev.time || '', field: parts.length > 1 ? parts.slice(1).join(' \u00b7 ').trim() : '',
    status: 'setup', current_period: 1, clock_started_at: null, clock_elapsed_seconds: 0,
    period_elapsed: {}, home_score: 0, away_score: 0,
    played_at: ev.date ? firebase.firestore.Timestamp.fromDate(new Date(ev.date + 'T12:00:00')) : null,
    source: ev.source || '', from_schedule_id: schedId,
    created_at: ts, updated_at: ts
  };
  var batch = db.batch();
  batch.set(gameRef, data);
  // Pin + hide the original schedule row so it won't duplicate or get overwritten by future TeamSnap syncs.
  batch.set(tdb('schedule').doc(schedId), { promoted: true, gt_game_id: gameRef.id, manual_override: true, updated_at: ts }, { merge: true });
  batch.commit().then(function(){
    if (typeof showToast === 'function') showToast('Converted to a full game \u2713 Fill in the details.');
    if (typeof gtOpenGameEdit === 'function') gtOpenGameEdit(gameRef.id);
  }).catch(function(e){ if (typeof showToast === 'function') showToast('Error: ' + e.message); });
}

// ===== Section visibility flags (lightweight, admin-controlled) =====
// Every main menu item can be hidden from the nav without deleting the page/data.
var SITE_SECTIONS = [
  { key: 'home',         label: 'Home',         sel: 'nav a[data-page="home"]' },
  { key: 'schedule',     label: 'Schedule',     sel: 'nav a[data-page="schedule"]' },
  { key: 'conditioning', label: 'Conditioning', sel: 'nav a[data-page="conditioning"]' },
  { key: 'tournaments',  label: 'Voting',       sel: 'nav a[data-page="tournaments"]' },
  { key: 'discussions',  label: 'Discussions',  sel: 'nav a[data-page="discussions"]' },
  { key: 'availability', label: 'Availability', sel: 'nav a[href="#/gametracker/availability"]' },
  { key: 'profiles',     label: 'Profiles',     sel: 'nav a[data-page="profiles"]' },
  { key: 'gametracker',  label: 'GameTracker',  sel: 'nav a.nav-gt' }
];
function applySiteFlags() {
  SITE_SECTIONS.forEach(function(sec){
    var link = document.querySelector(sec.sel);
    if (!link) return;
    // Two independent switches: the deployment either ships this module at all
    // (js/00-config.js), and the admin can hide a shipped one day to day.
    var shipped = (typeof appModuleOn !== 'function') || appModuleOn(sec.key);
    var hidden  = !!(siteFlags && siteFlags['hide_' + sec.key]);
    link.style.display = (shipped && !hidden) ? '' : 'none';
  });
  if (typeof renderGuestBanner === 'function') renderGuestBanner();
}
function toggleSiteFlag(key) {
  if (typeof isAdminUnlocked === 'function' && !isAdminUnlocked()) { showToast('Admin only.'); return; }
  var val = !(siteFlags && siteFlags[key]);
  var data = {}; data[key] = val;
  tdb('site_flags').doc('main').set(data, { merge: true })
    .then(function(){ showToast(val ? 'Hidden from the menu.' : 'Shown in the menu.'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
// ===== "Needs review" alert at the top of the admin panel =====
function renderGtReviewAlert() {
  var box = document.getElementById('gt-review-alert-box');
  if (!box) return;
  if (typeof guestAppsListen === 'function') guestAppsListen();
  box.innerHTML =
    ((typeof gtGuestAppsQueueHtml === 'function') ? gtGuestAppsQueueHtml({ closeAdmin: true }) : '') +
    ((typeof gtReviewQueueHtml === 'function') ? gtReviewQueueHtml({ closeAdmin: true }) : '');
}

// ===== Which approved parent-reported stats appear in the game Event Timeline =====
// Types switched OFF still count in every total (stat strip, player table, season
// stats) — they simply render in the Parent-Reported section instead of the
// timeline, so a parent logging 60 passes can't bury the goals.
var GT_TIMELINE_PARENT_TYPES = [
  { id: 'assist',    label: '\u{1F170}\uFE0F Assists',           on: true  },
  { id: 'sot',       label: '\u{1F3AF} Shots on Target',   on: true  },
  { id: 'shot',      label: '\u{1F4A8} Shots',             on: true  },
  { id: 'save',      label: '\u{1F9E4} Saves',             on: true  },
  { id: 'tackle',    label: '\u{1F6E1}\uFE0F Tackles',          on: true  },
  { id: 'pass',      label: '\u27A1\uFE0F Passes',              on: false },
  { id: 'pass_comp', label: '\u2705 Passes Completed',    on: false }
];
function gtTimelineShowsParentType(typeId) {
  var d = GT_TIMELINE_PARENT_TYPES.find(function(t){ return t.id === typeId; });
  if (!d) return true;
  var v = (typeof siteFlags !== 'undefined' && siteFlags) ? siteFlags['gt_tl_' + typeId] : undefined;
  return (typeof v === 'boolean') ? v : d.on;   // saved choice wins, else the default
}
function toggleGtTimelineType(typeId) { setGtTimelineType(typeId, !gtTimelineShowsParentType(typeId)); }
function setGtTimelineType(typeId, val) {
  if (typeof isAdminUnlocked === 'function' && !isAdminUnlocked()) { showToast('Admin only.'); return; }
  val = !!val;
  var data = {}; data['gt_tl_' + typeId] = val;
  tdb('site_flags').doc('main').set(data, { merge: true })
    .then(function(){ showToast(val ? 'Now shown in the timeline.' : 'Moved to Parent-Reported.'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function renderGtTimelineFlags() {
  var box = document.getElementById('gt-timeline-flags-box');
  if (!box) return;
  // A checkbox reads as state ("is it on?") rather than as an action, which a
  // Show/Hide button does not — ticked means it appears in the timeline.
  var rows = GT_TIMELINE_PARENT_TYPES.map(function(t){
    var on = gtTimelineShowsParentType(t.id);
    var cid = 'gt-tl-cb-' + t.id;
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--border)">' +
      '<input type="checkbox" id="' + cid + '"' + (on ? ' checked' : '') +
      ' onchange="setGtTimelineType(\'' + t.id + '\', this.checked)" style="width:17px;height:17px;flex:0 0 auto;cursor:pointer"/>' +
      '<label for="' + cid + '" style="margin:0;font-size:.86rem;cursor:pointer">' + t.label + '</label></div>';
  }).join('');
  box.innerHTML = '<p style="font-weight:800;font-size:.9rem;margin:0 0 6px">Parent Stats in the Event Timeline</p>' +
    '<p style="font-size:.75rem;color:var(--muted);margin:0 0 6px">Ticked = shows in each game\'s Event Timeline. Unticked types still count in every stat total \u2014 they just appear in the Parent-Reported section further down the game page instead.</p>' +
    rows;
}

function renderSiteFlags() {
  var box = document.getElementById('site-flags-box');
  if (!box) return;
  var rows = SITE_SECTIONS.map(function(sec){
    var hidden = !!(siteFlags && siteFlags['hide_' + sec.key]);
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid var(--border)">' +
      '<span style="font-size:.86rem">' + sec.label + ' <span style="color:var(--muted);font-size:.78rem">(' + (hidden ? 'hidden' : 'visible') + ')</span></span>' +
      '<button class="btn-edit" onclick="toggleSiteFlag(\'hide_' + sec.key + '\')">' + (hidden ? '↩ Show' : '🙈 Hide') + '</button></div>';
  }).join('');
  box.innerHTML = '<p style="font-weight:800;font-size:.9rem;margin:0 0 6px">Site Sections</p>' +
    '<p style="font-size:.75rem;color:var(--muted);margin:0 0 6px">Hide any menu item. The page and its data stay — it\'s just removed from the top menu and can be shown again anytime.</p>' +
    rows;
  renderGtTimelineFlags();
  if (typeof renderGuestFlagBox === 'function') renderGuestFlagBox();
  if (typeof renderGuestBanner === 'function') renderGuestBanner();
  if (typeof gtRerender === 'function') gtRerender();
}


// ===== Manual TeamSnap sync (admin) =====
var GH_REPO = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.githubRepo) || 'kudzooman2025/F6AD';
function renderTeamsnapSync() {
  var box = document.getElementById('teamsnap-sync-box');
  if (!box) return;
  box.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;background:#faf9ff;border:1px solid var(--border);border-radius:10px;padding:12px 14px">' +
    '<div><strong>TeamSnap sync</strong> <span style="color:var(--muted);font-size:.8rem">pull the latest events from TeamSnap now (also runs daily)</span></div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-primary" onclick="teamsnapSyncNow()">🔄 Sync now</button>' +
    '<button class="btn-edit" onclick="setSyncToken()">🔑 Set token</button></div></div>';
}
function setSyncToken() {
  if (!isAdminUnlocked()) { showToast('Admin only.'); return; }
  var tok = window.prompt('Paste a GitHub fine-grained token with "Actions: Read and write" on ' + GH_REPO + ' (stored privately, admin-only). Leave blank to clear.');
  if (tok === null) return;
  tdb('site_secrets').doc('main').set({ gh_token: tok.trim() }, { merge: true })
    .then(function(){ showToast(tok.trim() ? 'Sync token saved ✓' : 'Sync token cleared.'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function teamsnapSyncNow() {
  if (!isAdminUnlocked()) { showToast('Admin only.'); return; }
  tdb('site_secrets').doc('main').get().then(function(doc) {
    var tok = (doc.exists && doc.data().gh_token) ? doc.data().gh_token : '';
    if (!tok) { showToast('Add a GitHub sync token first (🔑 Set token).'); return; }
    showToast('Starting TeamSnap sync…');
    return fetch('https://api.github.com/repos/' + GH_REPO + '/actions/workflows/teamsnap-sync.yml/dispatches', {
      method: 'POST',
      headers: { 'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + tok, 'X-GitHub-Api-Version': '2022-11-28' },
      body: JSON.stringify({ ref: 'main' })
    }).then(function(r) {
      if (r.status === 204) showToast('Sync started — your schedule updates in about a minute ✓');
      else if (r.status === 401 || r.status === 403) showToast('Sync token was rejected — check it has Actions: write and try 🔑 Set token again.');
      else r.text().then(function(t){ showToast('Sync request failed (' + r.status + ').'); });
    });
  }).catch(function(e){ showToast('Error: ' + e.message); });
}


// ===================== ADMIN: VISITORS =====================
function f6adRel(ms) {
  var s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  var d = Math.floor(s / 86400);
  if (d < 30) return d + 'd ago';
  return new Date(ms).toLocaleDateString();
}
function f6adBrowser(ua) {
  ua = ua || '';
  var os = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : '';
  var b = /Edg/.test(ua) ? 'Edge' : /OPR|Opera/.test(ua) ? 'Opera' : /Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'Browser';
  return (os ? os + ' · ' : '') + b;
}
function renderAdminVisitors() {
  var box = document.getElementById('admin-visitors-list');
  if (!box) return;
  box.innerHTML = '<p style="font-size:.85rem;color:var(--muted)">Loading…</p>';
  tdb('site_visits').orderBy('last_seen', 'desc').limit(500).get().then(function(snap) {
    var rows = []; snap.forEach(function(d){ rows.push(d.data() || {}); });
    var now = Date.now();
    var day = rows.filter(function(r){ return r.last_seen && (now - r.last_seen.toMillis()) < 864e5; }).length;
    var week = rows.filter(function(r){ return r.last_seen && (now - r.last_seen.toMillis()) < 7 * 864e5; }).length;
    var head = '<div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:14px;font-size:.9rem"><span><strong>' + rows.length + '</strong> devices</span><span>🟢 <strong>' + day + '</strong> active today</span><span><strong>' + week + '</strong> this week</span></div>';
    if (!rows.length) { box.innerHTML = head + '<p style="font-size:.85rem;color:var(--muted)">No visits recorded yet.</p>'; return; }
    box.innerHTML = head + rows.map(function(r) {
      var name = (r.name && r.name.trim()) ? gtEsc(r.name) : '<span style="color:var(--muted)">Anonymous</span>';
      var lastSeen = r.last_seen ? f6adRel(r.last_seen.toMillis()) : '—';
      var dev = gtEsc((r.token || '').slice(0, 10));
      return '<div class="admin-item"><div class="admin-item-info"><strong>' + name + '</strong> <span style="color:var(--muted);font-size:.78rem">· ' + f6adBrowser(r.ua) + ' · ' + dev + '</span>' +
        '<span>last seen ' + lastSeen + ' · ' + (r.visits || 1) + ' visit' + ((r.visits || 1) === 1 ? '' : 's') + (r.last_page ? ' · <code>' + gtEsc(r.last_page) + '</code>' : '') + '</span></div></div>';
    }).join('');
  }).catch(function(e){ box.innerHTML = '<p style="color:#b91c1c;font-size:.85rem">' + gtEsc(e.message) + '</p>'; });
}


// ===================== ADMIN: SIGNED-UP ACCOUNTS / PROMOTE =====================
function renderAdminAccounts() {
  var box = document.getElementById('admin-accounts-list');
  if (!box) return;
  box.innerHTML = '<p style="font-size:.82rem;color:var(--muted)">Loading…</p>';
  tdb('user_directory').get().then(function(snap) {
    var rows = []; snap.forEach(function(d){ rows.push(Object.assign({ uid: d.id }, d.data() || {})); });
    rows.sort(function(a, b){ return (b.last_seen && b.last_seen.toMillis ? b.last_seen.toMillis() : 0) - (a.last_seen && a.last_seen.toMillis ? a.last_seen.toMillis() : 0); });
    if (!rows.length) { box.innerHTML = '<p style="font-size:.82rem;color:var(--muted)">No sign-ins recorded yet. Accounts appear here once they sign in (after this update).</p>'; return; }
    box.innerHTML = rows.map(function(r) {
      var isStaff = !!(staffData && staffData[r.uid]);
      var role = isStaff ? staffData[r.uid].role : '';
      var badge = isStaff ? '<span style="background:' + (role === 'admin' ? '#fef3c7;color:#92400e' : '#ede9fe;color:#5b21b6') + ';padding:2px 8px;border-radius:999px;font-size:.7rem;font-weight:800;margin-left:6px">' + (role === 'admin' ? 'ADMIN' : 'COACH') + '</span>' : '';
      var actions = isStaff
        ? '<button class="btn-danger" style="padding:3px 9px;font-size:.7rem" onclick="adminRemoveStaff(\'' + r.uid + '\')">Remove staff</button>'
        : '<button class="btn-primary" style="padding:3px 9px;font-size:.7rem" onclick="adminMakeStaff(\'' + r.uid + '\',\'' + gtAttr(r.email || '') + '\',\'coach\')">Make coach</button><button class="btn-edit" style="padding:3px 9px;font-size:.7rem;margin-left:5px" onclick="adminMakeStaff(\'' + r.uid + '\',\'' + gtAttr(r.email || '') + '\',\'admin\')">Make admin</button>';
      return '<div class="admin-item"><div class="admin-item-info"><strong>' + gtEsc(r.email || r.uid) + '</strong>' + badge + '<span>' + (r.last_seen ? 'signed in ' + f6adRel(r.last_seen.toMillis()) : '') + '</span></div><div class="admin-item-actions">' + actions + '</div></div>';
    }).join('');
  }).catch(function(e){ box.innerHTML = '<p style="color:#b91c1c;font-size:.82rem">' + gtEsc(e.message) + '</p>'; });
}
function adminMakeStaff(uid, email, role) {
  tdb('staff').doc(uid).set({ name: email || uid, email: email || '', role: (role === 'admin' ? 'admin' : 'coach'), created_at: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
    .then(function(){ showToast('Granted ' + (role === 'admin' ? 'admin' : 'coach') + ' access ✓'); renderAdminAccounts(); })
    .catch(function(e){ showToast('Error: ' + authErrMsg(e)); });
}
function adminRemoveStaff(uid) {
  if (authUser && uid === authUser.uid) { showToast("You can't remove your own access."); return; }
  if (!confirm('Remove staff access for this account?')) return;
  tdb('staff').doc(uid).delete().then(function(){ showToast('Staff access removed.'); renderAdminAccounts(); }).catch(function(e){ showToast('Error: ' + e.message); });
}
function adminPromoteExisting() {
  var name = document.getElementById('promo-name').value.trim();
  var email = document.getElementById('promo-email').value.trim();
  var uid = document.getElementById('promo-uid').value.trim();
  var role = document.getElementById('promo-role').value;
  if (!uid) { showToast('Enter the person\'s Firebase User UID (from the console).'); return; }
  tdb('staff').doc(uid).set({ name: name || email || uid, email: email, role: (role === 'admin' ? 'admin' : 'coach'), created_at: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
    .then(function(){ document.getElementById('promo-name').value = ''; document.getElementById('promo-email').value = ''; document.getElementById('promo-uid').value = ''; showToast((name || email || 'Account') + ' granted ' + role + ' access ✓'); renderAdminAccounts(); })
    .catch(function(e){ showToast('Error: ' + authErrMsg(e)); });
}
