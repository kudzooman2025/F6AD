// ---------- SEASONS ----------
// A season groups league/MLS Next games under one squad + display name.
// Unlike tournaments there is no shared lineup — each game keeps its own
// availability/starters, since availability changes week to week.
function gtSeason(id) { return GT.seasons.find(function(se){ return se.id === id; }); }
function gtSeasonEntGames(sid) {
  return GT.games.filter(function(g){ return g.season_id === sid; })
    .sort(function(a, b){ return gtTsMillis(b.played_at || b.created_at) - gtTsMillis(a.played_at || a.created_at); });
}
function gtSeasonRecord(games) {
  var r = { w: 0, l: 0, d: 0, gf: 0, ga: 0 };
  games.filter(function(g){ return g.status === 'complete'; }).forEach(function(g) {
    var res = gtResult(g);
    if (res === 'W') r.w++; else if (res === 'L') r.l++; else r.d++;
    r.gf += gtOurScore(g); r.ga += gtTheirScore(g);
  });
  return r;
}

function gtRenderSeasons(view) {
  var canEdit = gtCanEdit();
  var list = GT.seasons.slice().sort(function(a, b){ return gtTsMillis(b.start_date || b.created_at) - gtTsMillis(a.start_date || a.created_at); });
  var html = gtLockBanner() +
    '<div class="gt-title">📅 Seasons</div>' +
    '<div class="gt-sub">Group your league / MLS Next games into seasons and track record &amp; stats.</div>';
  if (canEdit) html += '<button class="btn-primary" style="margin-bottom:16px" onclick="gtOpenSeasonForm(null)">➕ Create Season</button>';
  if (!list.length) { html += '<div class="gt-empty">No seasons yet.' + (canEdit ? ' Create one to get started.' : '') + '</div>'; view.innerHTML = html; return; }
  html += '<div class="gt-glist">' + list.map(function(se) {
    var games = gtSeasonEntGames(se.id);
    var r = gtSeasonRecord(games);
    return '<div class="gt-gitem" onclick="gtGo(\'/gametracker/seasons/' + se.id + '\')">' +
      '<span class="gi-teams">' + gtEsc(se.name) + '</span>' +
      '<span class="gi-meta">' + (se.start_date ? gtFmtDate(se.start_date) : '') + ' · ' + games.length + ' game' + (games.length === 1 ? '' : 's') + ' · ' + r.w + '-' + r.l + '-' + r.d + '</span>' +
      '</div>';
  }).join('') + '</div>';
  view.innerHTML = html;
}

function gtOpenSeasonForm(sid) {
  if (!gtCanEdit()) { showToast('Coach login required.'); return; }
  var se = sid ? gtSeason(sid) : null;
  var rosters = GT.rosters.filter(function(r){ return !r.archived; });
  var defRid = se ? se.base_roster_id : (gtActiveRoster() ? gtActiveRoster().id : (rosters[0] ? rosters[0].id : ''));
  var defName = se ? (se.team_name || '') : (gtRoster(defRid) ? gtRoster(defRid).name : 'F6AD');
  gtOpenModal(
    '<h3>' + (se ? '✏️ Edit Season' : '➕ Create Season') + '<button class="gm-close" onclick="gtCloseModal()">✕</button></h3>' +
    '<label>Season Name</label><input type="text" id="gt-sf-name" value="' + gtAttr(se ? se.name : '') + '" placeholder="MLS Next 2026-27"/>' +
    '<label>Team Name (shown in games)</label><input type="text" id="gt-sf-team" value="' + gtAttr(defName) + '" placeholder="FC Delco MLS Next AD U14"/>' +
    (se ? '' :
      '<label>Base Roster (squad)</label><select id="gt-sf-roster">' +
      (rosters.length ? '' : '<option value="">No rosters yet</option>') +
      rosters.map(function(r){ return '<option value="' + r.id + '"' + (defRid === r.id ? ' selected' : '') + '>' + gtEsc(r.name) + '</option>'; }).join('') + '</select>') +
    '<div class="gm-row"><div><label>Start Date</label><input type="date" id="gt-sf-start" value="' + gtAttr(se ? se.start_date : '') + '"/></div>' +
    '<div><label>End Date</label><input type="date" id="gt-sf-end" value="' + gtAttr(se ? se.end_date : '') + '"/></div></div>' +
    '<label>Players per side</label><input type="number" id="gt-sf-side" min="1" max="11" value="' + (se && se.players_per_side ? se.players_per_side : 11) + '"/>' +
    '<div class="gm-actions"><button class="btn-primary" onclick="gtSaveSeason(' + (se ? '\'' + se.id + '\'' : 'null') + ')">Save</button>' +
    '<button class="gt-minibtn" onclick="gtCloseModal()">Cancel</button></div>'
  );
}
function gtSaveSeason(sid) {
  if (!gtCanEdit()) return;
  var name = document.getElementById('gt-sf-name').value.trim();
  if (!name) { showToast('Season name is required.'); return; }
  var data = {
    name: name,
    team_name: document.getElementById('gt-sf-team').value.trim(),
    start_date: document.getElementById('gt-sf-start').value || '',
    end_date: document.getElementById('gt-sf-end').value || '',
    players_per_side: Math.max(1, Math.min(11, parseInt(document.getElementById('gt-sf-side').value, 10) || 11)),
    updated_at: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (sid) {
    db.collection('gt_seasons').doc(sid).set(data, { merge: true })
      .then(function(){ showToast('Season saved ✓'); gtCloseModal(); })
      .catch(function(e){ showToast('Error: ' + e.message); });
    return;
  }
  var rid = document.getElementById('gt-sf-roster').value;
  if (!rid) { showToast('Create a roster first in the Roster Manager.'); return; }
  data.base_roster_id = rid;
  data.created_at = firebase.firestore.FieldValue.serverTimestamp();
  db.collection('gt_seasons').add(data)
    .then(function(ref){ showToast('Season created ✓'); gtCloseModal(); gtGo('/gametracker/seasons/' + ref.id); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}

function gtRenderSeasonEntity(view, sid) {
  var se = gtSeason(sid);
  if (!se) { view.innerHTML = GT.loaded.seasons ? '<div class="gt-empty">Season not found. <a href="#/gametracker/seasons">Back to Seasons</a></div>' : '<div class="gt-empty">Loading…</div>'; return; }
  var canEdit = gtCanEdit();
  var games = gtSeasonEntGames(sid);
  var done = games.filter(function(g){ return g.status === 'complete'; });
  var r = gtSeasonRecord(games);
  var html = gtLockBanner() +
    '<div class="gt-title">📅 ' + gtEsc(se.name) + '</div>' +
    '<div class="gt-sub">' + (se.start_date ? gtFmtDate(se.start_date) : '') + (se.end_date && se.end_date !== se.start_date ? ' – ' + gtFmtDate(se.end_date) : '') + (gtRoster(se.base_roster_id) ? ' · ' + gtEsc(gtRoster(se.base_roster_id).name) : '') + '</div>';
  html += '<div class="gt-stat-strip">' +
    '<div class="gt-stat-box"><div class="sb-num">' + r.w + '-' + r.l + '-' + r.d + '</div><div class="sb-label">W-L-D</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + games.length + '</div><div class="sb-label">Games</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + r.gf + '</div><div class="sb-label">Goals For</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + r.ga + '</div><div class="sb-label">Goals Against</div></div>' +
    '</div>';
  if (canEdit) html += '<div style="margin:4px 0 16px;display:flex;gap:10px;flex-wrap:wrap">' +
    '<button class="gt-minibtn" onclick="gtOpenSeasonForm(\'' + se.id + '\')">✏️ Edit Details</button></div>';
  html += '<div class="section-title" style="margin-bottom:12px">⚽ Games</div>';
  if (canEdit) html += '<button class="btn-primary" style="margin-bottom:14px" onclick="gtStartSeasonGame(\'' + se.id + '\')">➕ Add Game</button>';
  html += games.length ? '<div class="gt-glist">' + games.map(gtGameItem).join('') + '</div>' : '<div class="gt-empty">No games yet.</div>';
  // player stats across the season's completed games
  var stats = gtSeasonPlayerStats(done, se.base_roster_id);
  if (stats.length) {
    stats.sort(function(a, b){ return (b.goals - a.goals) || (b.assists - a.assists) || a.name.localeCompare(b.name); });
    html += '<div class="section-title" style="margin:26px 0 12px">🏆 Player Stats</div>' +
      '<div class="gt-table-wrap"><table class="gt-table"><thead><tr><th>Player</th><th class="num">GP</th><th class="num">⚽</th><th class="num">🅰️</th><th class="num">🎯</th><th class="num">💨</th><th class="num">🧤</th><th class="num">🛡️</th><th class="num">Min</th></tr></thead><tbody>';
    stats.forEach(function(st) {
      html += '<tr><td><span class="gt-plink" onclick="gtGo(\'/gametracker/player/' + st.id + '\')">' + gtEsc(st.name) + '</span>' + (st.guest ? '<span class="gt-guest-badge">Guest</span>' : '') + '</td>' +
        '<td class="num">' + st.gp + '</td><td class="num">' + st.goals + '</td><td class="num">' + st.assists + '</td><td class="num">' + st.sot + '</td><td class="num">' + st.sh + '</td><td class="num">' + st.saves + '</td><td class="num">' + (st.tackles || 0) + '</td><td class="num">' + st.min + '</td></tr>';
    });
    html += '</tbody></table></div>';
  }
  if (canEdit) html += '<div style="margin-top:24px;text-align:right"><button class="gt-minibtn danger" onclick="gtDeleteSeason(\'' + se.id + '\')">🗑 Delete Season</button></div>';
  view.innerHTML = html;
}
function gtStartSeasonGame(sid) {
  if (!gtCanEdit()) { showToast('Coach login required.'); return; }
  var se = gtSeason(sid); if (!se) return;
  var ros = gtRoster(se.base_roster_id);
  GT.setup = {
    step: 1,
    home_team: se.team_name || (ros ? ros.name : 'F6AD'),
    away_team: '', f6ad_side: 'home', game_type: 'league', venue: '',
    num_periods: 2, period_duration_minutes: 35, players_per_side: se.players_per_side || 11,
    roster_id: se.base_roster_id,
    avail: {}, notes: {}, guests: [], guestIds: {}, kickoff_time: '', game_date: gtTodayStr(),
    tournament_id: null, season_id: sid,
    started: {}, startPos: {}, team_name: se.team_name || (ros ? ros.name : 'F6AD')
  };
  gtGo('/gametracker/new');
}
function gtDeleteSeason(sid) {
  if (!gtCanEdit()) return;
  if (!confirm('Delete this season? Its games are kept but unlinked from the season.')) return;
  db.collection('gt_seasons').doc(sid).delete().then(function(){ showToast('Season deleted.'); gtGo('/gametracker/seasons'); }).catch(function(e){ showToast('Error: ' + e.message); });
}
