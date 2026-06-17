// ---------- TOURNAMENTS ----------
// A tournament snapshots the master squad into its own lineup (available/out +
// fee paid), can include guests, and groups the games played that weekend.
function gtTournament(id) { return GT.tournaments.find(function(t){ return t.id === id; }); }
function gtTournamentGames(tid) {
  return GT.games.filter(function(g){ return g.tournament_id === tid; })
    .sort(function(a, b){ return gtTsMillis(a.played_at || a.created_at) - gtTsMillis(b.played_at || b.created_at); });
}
function gtTournLineup(t) { return (t && t.lineup) || {}; }

function gtRenderTournaments(view) {
  var canEdit = gtCanEdit();
  var list = GT.tournaments.slice().sort(function(a, b){ return gtTsMillis(b.start_date || b.created_at) - gtTsMillis(a.start_date || a.created_at); });
  var html = gtLockBanner() +
    '<div class="gt-title">🏆 Tournaments</div>' +
    '<div class="gt-sub">Each tournament keeps its own roster, availability and fee tracking.</div>';
  if (canEdit) html += '<button class="btn-primary" style="margin-bottom:16px" onclick="gtOpenTournamentForm(null)">➕ Create Tournament</button>';
  if (!list.length) { html += '<div class="gt-empty">No tournaments yet.' + (canEdit ? ' Create one to get started.' : '') + '</div>'; view.innerHTML = html; return; }
  html += '<div class="gt-glist">' + list.map(function(t) {
    var lu = gtTournLineup(t), ids = Object.keys(lu);
    var avail = ids.filter(function(id){ return lu[id].available; }).length;
    var paid = ids.filter(function(id){ return lu[id].available && lu[id].paid; }).length;
    var games = gtTournamentGames(t.id).length;
    return '<div class="gt-gitem" onclick="gtGo(\'/gametracker/tournament/' + t.id + '\')">' +
      '<span class="gi-teams">' + gtEsc(t.name) + '</span>' +
      '<span class="gi-meta">' + (t.start_date ? gtFmtDate(t.start_date) : '') + (t.venue ? ' · ' + gtEsc(t.venue) : '') +
        ' · ' + avail + ' available · ' + paid + '/' + avail + ' paid · ' + games + ' game' + (games === 1 ? '' : 's') + '</span>' +
      '</div>';
  }).join('') + '</div>';
  view.innerHTML = html;
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
    (t ? '' :
      '<label>Base Roster (squad to pull players from)</label><select id="gt-tf-roster">' +
      (rosters.length ? '' : '<option value="">No rosters yet</option>') +
      rosters.map(function(r){ return '<option value="' + r.id + '"' + (defRid === r.id ? ' selected' : '') + '>' + gtEsc(r.name) + '</option>'; }).join('') + '</select>') +
    '<div class="gm-row"><div><label>Start Date</label><input type="date" id="gt-tf-start" value="' + gtAttr(t ? t.start_date : '') + '"/></div>' +
    '<div><label>End Date</label><input type="date" id="gt-tf-end" value="' + gtAttr(t ? t.end_date : '') + '"/></div></div>' +
    '<label>Venue</label><input type="text" id="gt-tf-venue" value="' + gtAttr(t ? t.venue : '') + '" placeholder="Maryland SoccerPlex"/>' +
    '<label>Players per side</label><input type="number" id="gt-tf-side" min="1" max="11" value="' + (t && t.players_per_side ? t.players_per_side : 11) + '"/>' +
    '<div class="gm-actions"><button class="btn-primary" onclick="gtSaveTournament(' + (t ? '\'' + t.id + '\'' : 'null') + ')">Save</button>' +
    '<button class="gt-minibtn" onclick="gtCloseModal()">Cancel</button></div>'
  );
}
function gtSaveTournament(tid) {
  if (!gtCanEdit()) return;
  var name = document.getElementById('gt-tf-name').value.trim();
  if (!name) { showToast('Tournament name is required.'); return; }
  var data = {
    name: name,
    team_name: document.getElementById('gt-tf-team').value.trim(),
    start_date: document.getElementById('gt-tf-start').value || '',
    end_date: document.getElementById('gt-tf-end').value || '',
    venue: document.getElementById('gt-tf-venue').value.trim(),
    players_per_side: Math.max(1, Math.min(11, parseInt(document.getElementById('gt-tf-side').value, 10) || 11)),
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
  var html = gtLockBanner() +
    '<div class="gt-title">🏆 ' + gtEsc(t.name) + '</div>' +
    '<div class="gt-sub">' + (t.start_date ? gtFmtDate(t.start_date) : '') + (t.end_date && t.end_date !== t.start_date ? ' – ' + gtFmtDate(t.end_date) : '') + (t.venue ? ' · ' + gtEsc(t.venue) : '') + '</div>';
  html += '<div class="gt-stat-strip">' +
    '<div class="gt-stat-box"><div class="sb-num">' + availCount + '</div><div class="sb-label">Available</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + (entries.length - availCount) + '</div><div class="sb-label">Out</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + paidCount + '/' + availCount + '</div><div class="sb-label">Paid</div></div>' +
    '</div>';
  if (canEdit) html += '<div style="margin:4px 0 16px;display:flex;gap:10px;flex-wrap:wrap">' +
    '<button class="gt-minibtn" onclick="gtOpenTournamentForm(\'' + t.id + '\')">✏️ Edit Details</button>' +
    '<button class="gt-minibtn" onclick="gtTournAddGuestPrompt(\'' + t.id + '\')">➕ Add Guest</button></div>';
  html += '<div class="section-title" style="margin-bottom:12px">👥 Tournament Roster</div>';
  if (!entries.length) html += '<div class="gt-empty">No players on this tournament roster yet.</div>';
  else {
    html += '<div class="gt-table-wrap"><table class="gt-table"><thead><tr><th>#</th><th>Player</th><th class="num">Status</th><th class="num">Paid</th>' + (canEdit ? '<th></th>' : '') + '</tr></thead><tbody>';
    entries.forEach(function(x) {
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
  if (!confirm('Delete this tournament? Its games are kept but unlinked from the tournament.')) return;
  db.collection('gt_tournaments').doc(tid).delete().then(function(){ showToast('Tournament deleted.'); gtGo('/gametracker/tournaments'); }).catch(function(e){ showToast('Error: ' + e.message); });
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
    away_team: '', f6ad_side: 'home', game_type: 'tournament', venue: t.venue || '',
    num_periods: 2, period_duration_minutes: 35, players_per_side: t.players_per_side || 11,
    roster_id: t.base_roster_id,
    avail: avail, notes: {}, guests: [], guestIds: guestIds,
    tournament_id: tid, season_id: null,
    started: {}, startPos: {}, team_name: t.team_name || (ros ? ros.name : 'F6AD')
  };
  gtGo('/gametracker/new');
}
