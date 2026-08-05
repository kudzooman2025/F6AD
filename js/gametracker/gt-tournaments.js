// ---------- TOURNAMENTS ----------
// A tournament snapshots the master squad into its own lineup (available/out +
// fee paid), can include guests, and groups the games played that weekend.
function gtTournament(id) { return GT.tournaments.find(function(t){ return t.id === id; }); }
function gtTournUrlFor(g) { if (!g || !g.tournament_id) return ''; var t = gtTournament(g.tournament_id); return t ? (t.official_url || '') : ''; }
function gtTournamentGames(tid) {
  return GT.games.filter(function(g){ return g.tournament_id === tid; })
    .sort(function(a, b){ return gtGameSortMs(a) - gtGameSortMs(b); });
}
function gtTournLineup(t) { return (t && t.lineup) || {}; }
// A tournament is "played" once it has games and all of them are complete.
function gtTournComplete(t) {
  var gms = gtTournamentGames(t.id).filter(function(g){ return !gtGameCanceled(g); });
  return gms.length > 0 && gms.every(function(g){ return g.status === 'complete'; });
}
function gtTournRecord(tid) {
  var w = 0, l = 0, d = 0;
  gtTournamentGames(tid).filter(function(g){ return g.status === 'complete' && !gtGameCanceled(g); }).forEach(function(g){
    var r = gtResult(g); if (r === 'W') w++; else if (r === 'L') l++; else d++;
  });
  return { w: w, l: l, d: d };
}
function gtTournRecordStr(tid) {
  var r = gtTournRecord(tid);
  return r.w + 'W-' + r.l + 'L' + (r.d ? '-' + r.d + 'D' : '');
}
// Derive our finish from knockout-round tags + results: won the Final -> Champions,
// lost the Final -> Finalists, won a Semifinal (no final logged yet) -> Finalists,
// lost a Semifinal -> Semifinalists.
function gtTournPlacement(tid) {
  var games = gtTournamentGames(tid).filter(function(g){ return g.status === 'complete' && !gtGameCanceled(g); });
  if (!games.length) return null;
  var finals = games.filter(function(g){ return g.round === 'final'; });
  if (finals.length) {
    return finals.some(function(g){ return gtResult(g) === 'W'; })
      ? { key: 'champion', label: '🏆 Champions' }
      : { key: 'finalist', label: '🥈 Finalists' };
  }
  var sfs = games.filter(function(g){ return g.round === 'sf'; });
  if (sfs.length) {
    return sfs.some(function(g){ return gtResult(g) === 'W'; })
      ? { key: 'finalist', label: '🥈 Finalists' }
      : { key: 'semifinalist', label: '🥉 Semifinalists' };
  }
  return null;
}
function gtTournStatusPill(t) {
  var pl = gtTournPlacement(t.id);
  if (pl) return '<span class="gt-status-pill tb-' + pl.key + '">' + pl.label + '</span>';
  if (gtTournComplete(t)) return '<span class="gt-status-pill gt-st-complete">✔ Played</span>';
  var gms = gtTournamentGames(t.id).filter(function(g){ return !gtGameCanceled(g); });
  if (gms.some(function(g){ return g.status !== 'complete' && g.status !== 'setup'; })) return '<span class="gt-status-pill gt-st-live">🟢 In progress</span>';
  return '';
}

function gtTournItemHtml(t) {
  var lu = gtTournLineup(t), ids = Object.keys(lu);
  var avail = ids.filter(function(id){ return lu[id].available; }).length;
  var paid = ids.filter(function(id){ return lu[id].available && lu[id].paid; }).length;
  var gms = gtTournamentGames(t.id);
  var games = gms.length;
  var gd = gms.map(function(g){ return gtGameDateStr(g); }).filter(Boolean);
  var ud = gd.filter(function(d, i){ return gd.indexOf(d) === i; }).sort();
  var dateLabel = ud.length ? ud.map(gtFmtDate).join(', ')
    : (t.start_date ? gtFmtDate(t.start_date) + (t.end_date && t.end_date !== t.start_date ? ' \u2013 ' + gtFmtDate(t.end_date) : '') : '');
  var complete = gtTournComplete(t);
  return '<div class="gt-gitem' + (complete ? ' done' : '') + '" onclick="gtGo(\'/gametracker/tournament/' + t.id + '\')">' +
    gtTournStatusPill(t) +
    '<span class="gi-teams">' + gtEsc(t.name) + '</span>' +
    '<span class="gi-meta">' + dateLabel + (t.venue ? ' \u00b7 ' + gtEsc(t.venue) : '') +
      ' \u00b7 ' + avail + ' available \u00b7 ' + paid + '/' + avail + ' paid \u00b7 ' + games + ' game' + (games === 1 ? '' : 's') + (complete ? ' \u00b7 ' + gtTournRecordStr(t.id) : '') + '</span>' +
    '</div>';
}
function gtTournTogglePast() { GT.tournPastOpen = !GT.tournPastOpen; gtRerender(true); }
function gtRenderTournaments(view) {
  var canEdit = gtCanEdit();
  var list = GT.tournaments.slice().sort(function(a, b){ return gtTsMillis(b.start_date || b.created_at) - gtTsMillis(a.start_date || a.created_at); });
  var html = gtLockBanner() +
    '<div class="gt-title">🏆 Tournaments</div>' +
    '<div class="gt-sub">Each tournament keeps its own roster, availability and fee tracking.</div>';
  if (canEdit) html += '<button class="btn-primary" style="margin-bottom:16px" onclick="gtOpenTournamentForm(null)">➕ Create Tournament</button>';
  var active = list.filter(function(t){ return !gtTournComplete(t); });
  var past = list.filter(function(t){ return gtTournComplete(t); });
  if (!list.length) {
    html += '<div class="gt-empty">No tournaments yet.' + (canEdit ? ' Create one, or set one up from TeamSnap below.' : '') + '</div>';
  } else {
    html += '<div class="section-title" style="margin-bottom:12px">⚔️ Active (' + active.length + ')</div>';
    html += active.length ? '<div class="gt-glist">' + active.map(gtTournItemHtml).join('') + '</div>'
      : '<div class="gt-empty">No active tournaments.</div>';
    if (past.length) {
      var pastOpen = !!GT.tournPastOpen;
      html += '<div class="section-title" style="margin:22px 0 12px;cursor:pointer;user-select:none" onclick="gtTournTogglePast()">' + (pastOpen ? '▾' : '▸') + ' 📜 Past Tournaments <span style="font-size:.78rem;color:var(--muted);font-weight:600">(' + past.length + ')</span></div>';
      if (pastOpen) html += '<div class="gt-glist">' + past.map(gtTournItemHtml).join('') + '</div>';
    }
  }
  // TeamSnap-synced tournaments not yet set up in GameTracker
  var tsT = (typeof scheduleItems !== 'undefined' ? scheduleItems : []).filter(function(ev) {
    return ev.type === 'tournament' && ev.source === 'teamsnap' && !ev.gt_tournament_id;
  }).sort(function(a, b){ return (a.date || '').localeCompare(b.date || ''); });
  if (tsT.length) {
    html += '<div class="section-title" style="margin:24px 0 12px">\uD83D\uDCC5 From TeamSnap</div>' +
      '<div class="gt-sub" style="margin-top:-6px">Tournaments pulled from your TeamSnap schedule. ' + (canEdit ? 'Tap to set one up in GameTracker (rosters, availability, games) — it becomes fully editable.' : 'A coach can set these up in GameTracker.') + '</div>' +
      '<div class="gt-glist">' + tsT.map(function(ev) {
        return '<div class="gt-gitem"' + (canEdit ? ' onclick="gtImportTeamSnapTournament(\'' + ev.id + '\')"' : '') + '>' +
          '<span class="gt-status-pill ts-badge">TeamSnap</span>' +
          '<span class="gi-teams">' + gtEsc(ev.name) + '</span>' +
          '<span class="gi-meta">' + (ev.date ? gtFmtDate(ev.date) : '') + (ev.location ? ' · ' + gtEsc(ev.location) : '') + (canEdit ? ' · \u2795 Set up in GameTracker' : '') + '</span>' +
          '</div>';
      }).join('') + '</div>';
  }
  view.innerHTML = html;
}
function gtImportTeamSnapTournament(schedId) {
  if (!gtCanEdit()) { showToast('Coach login required.'); return; }
  var ev = (typeof scheduleItems !== 'undefined' ? scheduleItems : []).find(function(e){ return e.id === schedId; });
  if (!ev) { showToast('Event not found.'); return; }
  if (ev.gt_tournament_id && gtTournament(ev.gt_tournament_id)) { gtGo('/gametracker/tournament/' + ev.gt_tournament_id); return; }
  var roster = (typeof gtActiveRoster === 'function' && gtActiveRoster()) || (GT.rosters && GT.rosters[0]);
  if (!roster) { showToast('Create a roster in the Roster Manager first.'); return; }
  var ts = firebase.firestore.FieldValue.serverTimestamp();
  var ref = db.collection('gt_tournaments').doc();
  var lineup = {};
  gtRosterPlayers(roster.id).filter(function(p){ return !p.is_guest; }).forEach(function(p){ lineup[p.id] = { available: true, paid: false, note: '' }; });
  var data = {
    name: ev.name, team_name: (gtRoster(roster.id) ? gtRoster(roster.id).name : 'F6AD'),
    base_roster_id: roster.id, start_date: ev.date || '', end_date: ev.date || '',
    venue: ev.location || '', venue_address: '', venue_city: '', venue_state: '', venue_zip: '',
    players_per_side: 11, official_url: '', lineup: lineup,
    source: 'teamsnap', from_schedule_id: schedId, created_at: ts, updated_at: ts
  };
  var batch = db.batch();
  batch.set(ref, data);
  batch.set(db.collection('schedule').doc(schedId), { gt_tournament_id: ref.id, manual_override: true, updated_at: ts }, { merge: true });
  batch.commit().then(function(){ showToast('Tournament set up in GameTracker \u2713'); gtGo('/gametracker/tournament/' + ref.id); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}

function gtOpenTournamentForm(tid) {
  if (!gtCanEdit()) { showToast('Coach login required.'); return; }
  var t = tid ? gtTournament(tid) : null;
  var rosters = GT.rosters.filter(function(r){ return !r.archived; });
  var defRid = t ? t.base_roster_id : (gtActiveRoster() ? gtActiveRoster().id : (rosters[0] ? rosters[0].id : ''));
  var defName = t ? (t.team_name || '') : (gtRoster(defRid) ? gtRoster(defRid).name : 'F6AD');
  gtOpenModal(
    '<h3>' + (t ? '✏️ Edit Tournament' : '➕ Create Tournament') + '<button class="gm-close" onclick="gtCloseModal()">✕</button></h3>' +
    '<label>Tournament Name</label><input type="text" id="gt-tf-name" value="' + gtAttr(t ? t.name : '') + '" placeholder="Memorial Day Classic 2026"/>' +
    '<label>Team Name (how your team is shown in games)</label><input type="text" id="gt-tf-team" value="' + gtAttr(defName) + '" placeholder="F6AD"/>' +
    '<label>Official tournament link</label><input type="url" id="gt-tf-url" value="' + gtAttr(t ? (t.official_url || '') : '') + '" placeholder="https://tournament-website.com"/>' +
    (t ? '' :
      '<label>Base Roster (squad to pull players from)</label><select id="gt-tf-roster">' +
      (rosters.length ? '' : '<option value="">No rosters yet</option>') +
      rosters.map(function(r){ return '<option value="' + r.id + '"' + (defRid === r.id ? ' selected' : '') + '>' + gtEsc(r.name) + '</option>'; }).join('') + '</select>') +
    '<div class="gm-row"><div><label>Start Date</label><input type="date" id="gt-tf-start" value="' + gtAttr(t ? t.start_date : '') + '"/></div>' +
    '<div><label>End Date</label><input type="date" id="gt-tf-end" value="' + gtAttr(t ? t.end_date : '') + '"/></div></div>' +
    '<label>Venue</label><input type="text" id="gt-tf-venue" list="venue-datalist" onchange="gtTournVenueFill()" value="' + gtAttr(t ? t.venue : '') + '" placeholder="Maryland SoccerPlex"/>' +
    '<label>Address</label><input type="text" id="gt-tf-vaddr" value="' + gtAttr(t ? (t.venue_address || '') : '') + '" placeholder="223 Keith Valley Rd"/>' +
    '<div class="gm-row"><div><label>City</label><input type="text" id="gt-tf-vcity" value="' + gtAttr(t ? (t.venue_city || '') : '') + '"/></div>' +
    '<div><label>State</label><input type="text" id="gt-tf-vstate" value="' + gtAttr(t ? (t.venue_state || '') : '') + '"/></div>' +
    '<div><label>Zip</label><input type="text" id="gt-tf-vzip" value="' + gtAttr(t ? (t.venue_zip || '') : '') + '"/></div></div>' +
    '<label>Players per side</label><input type="number" id="gt-tf-side" min="1" max="11" value="' + (t && t.players_per_side ? t.players_per_side : 11) + '"/>' +
    '<div class="gm-actions"><button class="btn-primary" onclick="gtSaveTournament(' + (t ? '\'' + t.id + '\'' : 'null') + ')">Save</button>' +
    '<button class="gt-minibtn" onclick="gtCloseModal()">Cancel</button></div>'
  );
}
function gtTournVenueFill() {
  var name = (document.getElementById('gt-tf-venue') || {}).value || '';
  var v = (typeof venueItems !== 'undefined' && venueItems) ? venueItems.find(function(x){ return (x.name || '').toLowerCase() === name.trim().toLowerCase(); }) : null;
  if (!v) return;
  function set(id, val){ var el = document.getElementById(id); if (el) el.value = val || ''; }
  set('gt-tf-vaddr', v.address); set('gt-tf-vcity', v.city); set('gt-tf-vstate', v.state); set('gt-tf-vzip', v.zip);
}
function gtSaveTournament(tid) {
  if (!gtCanEdit()) return;
  var name = document.getElementById('gt-tf-name').value.trim();
  if (!name) { showToast('Tournament name is required.'); return; }
  var _url = document.getElementById('gt-tf-url').value.trim();
  if (_url && !/^https?:\/\//i.test(_url)) _url = 'https://' + _url;
  var data = {
    name: name,
    team_name: document.getElementById('gt-tf-team').value.trim(),
    start_date: document.getElementById('gt-tf-start').value || '',
    end_date: document.getElementById('gt-tf-end').value || '',
    venue: document.getElementById('gt-tf-venue').value.trim(),
    venue_address: document.getElementById('gt-tf-vaddr').value.trim(),
    venue_city: document.getElementById('gt-tf-vcity').value.trim(),
    venue_state: document.getElementById('gt-tf-vstate').value.trim(),
    venue_zip: document.getElementById('gt-tf-vzip').value.trim(),
    players_per_side: Math.max(1, Math.min(11, parseInt(document.getElementById('gt-tf-side').value, 10) || 11)),
    official_url: _url,
    updated_at: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (tid) {
    db.collection('gt_tournaments').doc(tid).set(data, { merge: true })
      .then(function(){ showToast('Tournament saved ✓'); gtCloseModal(); })
      .catch(function(e){ showToast('Error: ' + e.message); });
    return;
  }
  var rid = document.getElementById('gt-tf-roster').value;
  if (!rid) { showToast('Create a roster first in the Roster Manager.'); return; }
  data.base_roster_id = rid;
  // snapshot the squad into the lineup (available by default, unpaid)
  var lineup = {};
  gtRosterPlayers(rid).filter(function(p){ return !p.is_guest; }).forEach(function(p) {
    lineup[p.id] = { available: true, paid: false, note: '' };
  });
  data.lineup = lineup;
  data.created_at = firebase.firestore.FieldValue.serverTimestamp();
  db.collection('gt_tournaments').add(data)
    .then(function(ref){ showToast('Tournament created ✓'); gtCloseModal(); gtGo('/gametracker/tournament/' + ref.id); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}

function gtRenderTournament(view, tid) {
  var t = gtTournament(tid);
  if (!t) { view.innerHTML = GT.loaded.tournaments ? '<div class="gt-empty">Tournament not found. <a href="#/gametracker/tournaments">Back to Tournaments</a></div>' : '<div class="gt-empty">Loading…</div>'; return; }
  var canEdit = gtCanEdit();
  var lu = gtTournLineup(t);
  var entries = Object.keys(lu).map(function(id){ return { id: id, p: gtP(id), e: lu[id] }; }).filter(function(x){ return x.p; })
    .sort(function(a, b) {
      var ag = a.p.is_guest ? 1 : 0, bg = b.p.is_guest ? 1 : 0;
      if (ag !== bg) return ag - bg;
      var an = a.p.jersey_number == null ? 999 : a.p.jersey_number, bn = b.p.jersey_number == null ? 999 : b.p.jersey_number;
      if (an !== bn) return an - bn;
      return gtPlayerName(a.id).localeCompare(gtPlayerName(b.id));
    });
  var availCount = entries.filter(function(x){ return x.e.available; }).length;
  var paidCount = entries.filter(function(x){ return x.e.available && x.e.paid; }).length;
  var shownEntries = canEdit ? entries : entries.filter(function(x){ return x.e.available; });
  var html = gtLockBanner() +
    '<div class="gt-title">🏆 ' + gtEsc(t.name) + '</div>' +
    '<div class="gt-sub">' + (t.start_date ? gtFmtDate(t.start_date) : '') + (t.end_date && t.end_date !== t.start_date ? ' – ' + gtFmtDate(t.end_date) : '') + (t.venue ? ' · ' + gtEsc(t.venue) : '') + '</div>' +
    ([t.venue_address, t.venue_city, t.venue_state, t.venue_zip].filter(Boolean).length ? '<div class="gt-sub" style="margin-top:-4px">📍 ' + gtEsc([t.venue_address, t.venue_city, t.venue_state, t.venue_zip].filter(Boolean).join(', ')) + '</div>' : '');
  if (t.official_url) html += '<a class="gt-tourn-link" href="' + gtAttr(t.official_url) + '" target="_blank" rel="noopener">🔗 Official tournament site →</a>';
  var _pl = gtTournPlacement(tid), _complete = gtTournComplete(t);
  if (_pl) {
    var _titles = { champion: '🏆 Tournament Champions', finalist: '🥈 Tournament Finalists', semifinalist: '🥉 Semifinalists' };
    html += '<div class="gt-tourn-banner tb-' + _pl.key + '"><span class="gtb-title">' + _titles[_pl.key] + '</span><span class="gtb-rec">' + gtTournRecordStr(tid) + '</span></div>';
  } else if (_complete) {
    html += '<div class="gt-tourn-banner tb-done"><span class="gtb-title">✔ Tournament complete</span><span class="gtb-rec">' + gtTournRecordStr(tid) + '</span></div>';
  }
  html += '<div class="gt-stat-strip">' +
    '<div class="gt-stat-box"><div class="sb-num">' + availCount + '</div><div class="sb-label">Available</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + (entries.length - availCount) + '</div><div class="sb-label">Out</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + paidCount + '/' + availCount + '</div><div class="sb-label">Paid</div></div>' +
    '</div>';
  if (canEdit) html += '<div style="margin:4px 0 16px;display:flex;gap:10px;flex-wrap:wrap">' +
    '<button class="gt-minibtn" onclick="gtOpenTournamentForm(\'' + t.id + '\')">✏️ Edit Details</button>' +
    '<button class="gt-minibtn" onclick="gtTournAddPlayerPrompt(\'' + t.id + '\')">➕ Add Player</button>' +
    '<button class="gt-minibtn" onclick="gtTournAddGuestPrompt(\'' + t.id + '\')">➕ Add Guest</button></div>';
  var rosterCollapsed = !!GT.tournRosterCollapsed;
  html += '<div class="section-title" style="margin-bottom:12px;cursor:pointer;user-select:none" onclick="gtTournToggleRoster()">' + (rosterCollapsed ? '▸' : '▾') + ' 👥 Tournament Roster <span style="font-size:.78rem;color:var(--muted);font-weight:600">(' + shownEntries.length + ')</span></div>';
  if (!rosterCollapsed) {
  if (!shownEntries.length) html += '<div class="gt-empty">No players on this tournament roster yet.</div>';
  else {
    html += '<div class="gt-table-wrap"><table class="gt-table"><thead><tr><th>#</th><th>Player</th><th class="num">Status</th><th class="num">Paid</th>' + (canEdit ? '<th></th>' : '') + '</tr></thead><tbody>';
    shownEntries.forEach(function(x) {
      var p = x.p, e = x.e;
      html += '<tr>' +
        '<td class="num" style="font-weight:900;color:var(--purple)">' + (p.jersey_number != null ? p.jersey_number : '—') + '</td>' +
        '<td><span class="gt-plink" onclick="gtGo(\'/gametracker/player/' + p.id + '\')">' + gtEsc(gtPlayerName(p.id)) + '</span>' + (p.is_guest ? '<span class="gt-guest-badge">Guest</span>' : '') + '</td>' +
        '<td class="num">' + (canEdit
          ? '<span class="gt-avail-toggle"><button class="' + (e.available ? 'on-yes' : '') + '" onclick="gtTournSetAvail(\'' + t.id + '\',\'' + p.id + '\',true)">In</button><button class="' + (!e.available ? 'on-no' : '') + '" onclick="gtTournSetAvail(\'' + t.id + '\',\'' + p.id + '\',false)">Out</button></span>'
          : (e.available ? 'In' : 'Out')) + '</td>' +
        '<td class="num">' + (canEdit
          ? '<input type="checkbox"' + (e.paid ? ' checked' : '') + ' onchange="gtTournSetPaid(\'' + t.id + '\',\'' + p.id + '\',this.checked)"/>'
          : (e.paid ? '✅' : '—')) + '</td>' +
        (canEdit ? '<td><button class="gt-minibtn danger" onclick="gtTournRemove(\'' + t.id + '\',\'' + p.id + '\')">Remove</button></td>' : '') +
        '</tr>';
    });
    html += '</tbody></table></div>';
  }
  }
  var games = gtTournamentGames(t.id);
  html += '<div class="section-title" style="margin:26px 0 12px">⚽ Games</div>';
  if (canEdit) html += '<button class="btn-primary" style="margin-bottom:14px" onclick="gtStartTournamentGame(\'' + t.id + '\')">➕ Add Game</button>';
  html += games.length ? '<div class="gt-glist">' + games.map(gtGameItem).join('') + '</div>' : '<div class="gt-empty">No games yet.</div>';
  if (canEdit) html += '<div style="margin-top:24px;text-align:right"><button class="gt-minibtn danger" onclick="gtDeleteTournament(\'' + t.id + '\')">🗑 Delete Tournament</button></div>';
  view.innerHTML = html;
}

function gtTournSetAvail(tid, pid, val) {
  if (!gtCanEdit()) return;
  var u = {}; u['lineup.' + pid + '.available'] = val;
  db.collection('gt_tournaments').doc(tid).update(u).catch(function(e){ showToast('Error: ' + e.message); });
}
function gtTournSetPaid(tid, pid, val) {
  if (!gtCanEdit()) return;
  var u = {}; u['lineup.' + pid + '.paid'] = val;
  db.collection('gt_tournaments').doc(tid).update(u).catch(function(e){ showToast('Error: ' + e.message); });
}
function gtTournRemove(tid, pid) {
  if (!gtCanEdit()) return;
  if (!confirm('Remove ' + gtPlayerName(pid) + ' from this tournament roster?')) return;
  var u = {}; u['lineup.' + pid] = firebase.firestore.FieldValue.delete();
  db.collection('gt_tournaments').doc(tid).update(u).then(function(){ showToast('Removed.'); }).catch(function(e){ showToast('Error: ' + e.message); });
}
function gtTournToggleRoster() {
  GT.tournRosterCollapsed = !GT.tournRosterCollapsed;
  gtRerender(true);
}
function gtTournAddPlayerPrompt(tid) {
  if (!gtCanEdit()) return;
  var t = gtTournament(tid); if (!t) return;
  var lu = gtTournLineup(t);
  var players = gtRosterPlayers(t.base_roster_id).filter(function(p){ return !p.is_guest && !lu[p.id]; });
  if (!players.length) { showToast('All squad players are already on this tournament.'); return; }
  gtOpenModal(
    '<h3>➕ Add Player<button class="gm-close" onclick="gtCloseModal()">✕</button></h3>' +
    '<p style="font-size:.85rem;color:var(--muted)">Add squad players to this tournament roster.</p>' +
    '<div>' + players.map(function(p) {
      return '<div class="gt-avail-row"><span class="gt-avail-name">' + (p.jersey_number != null ? '<span style="color:var(--purple);font-weight:900">#' + p.jersey_number + '</span> ' : '') + gtEsc(gtPlayerName(p.id)) + '</span>' +
        '<button class="gt-minibtn" onclick="gtTournAddGuest(\'' + tid + '\',\'' + p.id + '\')">Add</button></div>';
    }).join('') + '</div>' +
    '<div class="gm-actions"><button class="gt-minibtn" onclick="gtCloseModal()">Done</button></div>'
  );
}
function gtTournAddGuestPrompt(tid) {
  if (!gtCanEdit()) return;
  var t = gtTournament(tid); if (!t) return;
  var lu = gtTournLineup(t);
  var pool = gtGuestPool().filter(function(p){ return !lu[p.id]; });
  if (!pool.length) { showToast('No more guests in the pool. Add them in the Roster Manager.'); return; }
  gtOpenModal(
    '<h3>➕ Add Guest<button class="gm-close" onclick="gtCloseModal()">✕</button></h3>' +
    '<p style="font-size:.85rem;color:var(--muted)">Add guest players from your pool to this tournament roster.</p>' +
    '<div>' + pool.map(function(p) {
      return '<div class="gt-avail-row"><span class="gt-avail-name">' + (p.jersey_number != null ? '<span style="color:var(--purple);font-weight:900">#' + p.jersey_number + '</span> ' : '') + gtEsc(gtPlayerName(p.id)) + ' <span class="gt-guest-badge">Guest</span></span>' +
        '<button class="gt-minibtn" onclick="gtTournAddGuest(\'' + tid + '\',\'' + p.id + '\')">Add</button></div>';
    }).join('') + '</div>' +
    '<div class="gm-actions"><button class="gt-minibtn" onclick="gtCloseModal()">Done</button></div>'
  );
}
function gtTournAddGuest(tid, pid) {
  if (!gtCanEdit()) return;
  var u = {}; u['lineup.' + pid] = { available: true, paid: false, note: '' };
  db.collection('gt_tournaments').doc(tid).update(u).then(function(){ showToast(gtPlayerName(pid) + ' added ✓'); gtCloseModal(); }).catch(function(e){ showToast('Error: ' + e.message); });
}
function gtDeleteTournament(tid) {
  if (!gtCanEdit()) return;
  var gms = gtTournamentGames(tid);
  var msg = gms.length
    ? 'Delete this tournament AND its ' + gms.length + ' game' + (gms.length === 1 ? '' : 's') + ' (with all their stats)? This cannot be undone.'
    : 'Delete this tournament? This cannot be undone.';
  if (!confirm(msg)) return;
  var ops = gms.map(function(g){ return (typeof gtDeleteGameDocs === 'function') ? gtDeleteGameDocs(g.id) : db.collection('gt_games').doc(g.id).delete(); });
  Promise.all(ops).then(function(){ return db.collection('gt_tournaments').doc(tid).delete(); })
    .then(function(){ showToast('Tournament and its games deleted.'); gtGo('/gametracker/tournaments'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function gtStartTournamentGame(tid) {
  if (!gtCanEdit()) { showToast('Coach login required.'); return; }
  var t = gtTournament(tid); if (!t) return;
  var lu = gtTournLineup(t);
  var ros = gtRoster(t.base_roster_id);
  var avail = {}, guestIds = {};
  Object.keys(lu).forEach(function(pid) {
    var p = gtP(pid); if (!p) return;
    if (p.is_guest) { if (lu[pid].available) guestIds[pid] = true; }
    else { avail[pid] = !!lu[pid].available; }
  });
  GT.setup = {
    step: 1,
    home_team: t.team_name || (ros ? ros.name : 'F6AD'),
    away_team: '', f6ad_side: 'home', game_type: 'tournament', venue: t.venue || '', venue_address: t.venue_address || '', venue_city: t.venue_city || '', venue_state: t.venue_state || '', venue_zip: t.venue_zip || '', field: '',
    num_periods: 2, period_duration_minutes: 35, players_per_side: t.players_per_side || 11,
    roster_id: t.base_roster_id,
    avail: avail, notes: {}, guests: [], guestIds: guestIds, kickoff_time: '', game_date: gtTodayStr(),
    tournament_id: tid, season_id: null,
    started: {}, startPos: {}, team_name: t.team_name || (ros ? ros.name : 'F6AD')
  };
  gtGo('/gametracker/new');
}
