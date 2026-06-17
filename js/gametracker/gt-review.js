// ---------- POST-GAME REVIEW ----------
function gtRenderReview(view, gameId) {
  var g = gtGame(gameId);
  if (!g) {
    view.innerHTML = GT.loaded.games ? '<div class="gt-empty">Game not found. <a href="#/gametracker">Back to GameTracker</a></div>' : '<div class="gt-empty">Loading game…</div>';
    return;
  }
  var canEdit = gtCanEdit();
  var events = gtGameEvents(g.id);
  var res = g.status === 'complete' ? gtResult(g) : null;
  var html = gtLockBanner() +
    '<div class="gt-card" style="text-align:center">' +
    '<div style="font-size:.74rem;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--muted)">' + gtEsc(g.game_type || 'game') + ' · ' + gtFmtDate(g.played_at || g.created_at) + (g.kickoff_time ? ' · ' + gtFmtKickoff(g.kickoff_time) : '') + (g.players_per_side ? ' · ' + g.players_per_side + 'v' + g.players_per_side : '') + (g.venue ? ' · ' + gtEsc(g.venue) : '') + '</div>' +
    '<div style="font-size:1.25rem;font-weight:900;margin-top:8px">' + gtEsc(g.home_team) + ' <span style="font-size:1.6rem;color:var(--purple)">' + (g.home_score || 0) + ' – ' + (g.away_score || 0) + '</span> ' + gtEsc(g.away_team) + '</div>' +
    (res ? '<div style="margin-top:6px"><span class="gt-result-' + res.toLowerCase() + '" style="font-size:1rem">' + (res === 'W' ? '✅ Win' : res === 'L' ? '❌ Loss' : '➖ Draw') + '</span></div>' : '<div style="margin-top:6px">' + gtStatusPill(g) + (canEdit ? ' <a href="#/gametracker/live/' + g.id + '" style="font-size:.8rem;font-weight:700">Open live view →</a>' : '') + '</div>') +
    '</div>';
  // stat strip
  var totals = { goal: 0, assist: 0, shot_on_target: 0, shot: 0, save: 0, tackle: 0, yellow_card: 0, red_card: 0 };
  events.forEach(function(e){ if (totals[e.event_type] !== undefined) totals[e.event_type]++; });
  html += '<div class="gt-stat-strip">' +
    '<div class="gt-stat-box"><div class="sb-num">' + totals.goal + '</div><div class="sb-label">Goals</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + totals.assist + '</div><div class="sb-label">Assists</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + totals.shot_on_target + '</div><div class="sb-label">Shots on Target</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + totals.shot + '</div><div class="sb-label">Shots</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + totals.save + '</div><div class="sb-label">Saves</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + totals.tackle + '</div><div class="sb-label">Tackles</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + (totals.yellow_card + totals.red_card) + '</div><div class="sb-label">Cards</div></div>' +
    '</div>';
  html += gtStartingXiHtml(g.id);
  // timeline with period markers
  html += '<div class="section-title" style="margin-bottom:12px">⏱ Event Timeline</div>';
  if (!events.length) html += '<div class="gt-empty">No events were logged in this game.</div>';
  else {
    var lastPeriod = 0;
    html += '<div class="gt-feed">';
    events.forEach(function(e) {
      if (e.period !== lastPeriod) {
        lastPeriod = e.period;
        html += '<div class="gt-period-marker">— ' + gtEsc(gtPeriodLabel(g, e.period, 'in_progress')) + ' —</div>';
      }
      html += gtFeedItem(g, e, canEdit);
    });
    html += '</div>';
  }
  // substitution log
  var subLog = gtGameSubs(g.id);
  if (subLog.length) {
    html += '<div class="section-title" style="margin:22px 0 12px">🔄 Substitutions</div><div class="gt-feed">' +
      subLog.map(function(sb) {
        return '<div class="gt-fitem"><span class="fi-min">[' + gtFmtMMSS(gtDisplayCumSec(g, sb.period, sb.game_clock_seconds)) + ']</span>🔄 <strong>' + gtEsc(gtPlayerShort(sb.player_in_id)) + '</strong>' + (sb.position ? ' (' + gtEsc(sb.position) + ')' : '') + ' ← ' + gtEsc(gtPlayerShort(sb.player_out_id)) + '</div>';
      }).join('') + '</div>';
  }
  // player stat table
  html += '<div class="section-title" style="margin:26px 0 12px">📊 Player Stats</div>';
  var availIds = gtAvailIds(g.id);
  if (availIds.length) {
    var mins = gtMinutesMap(g.id);
    html += '<div class="gt-table-wrap"><table class="gt-table"><thead><tr><th>Player</th><th class="num">⚽ G</th><th class="num">🅰️ A</th><th class="num">🎯 SOT</th><th class="num">💨 SH</th><th class="num">🟨</th><th class="num">🟥</th><th class="num">🧤 SV</th><th class="num">🛡️ T</th><th class="num">Min</th></tr></thead><tbody>';
    availIds.map(function(pid){ return gtP(pid); }).filter(Boolean)
      .sort(function(a, b){ return (a.jersey_number == null ? 999 : a.jersey_number) - (b.jersey_number == null ? 999 : b.jersey_number); })
      .forEach(function(p) {
        var st = gtStatLine(p.id, events);
        html += '<tr><td><span class="gt-plink" onclick="gtGo(\'/gametracker/player/' + p.id + '\')">' + gtEsc(gtPlayerName(p.id)) + '</span>' + (p.is_guest ? '<span class="gt-guest-badge">Guest</span>' : '') + '</td>' +
          '<td class="num">' + (st.goal || '') + '</td><td class="num">' + (st.assist || '') + '</td><td class="num">' + (st.shot_on_target || '') + '</td><td class="num">' + (st.shot || '') + '</td>' +
          '<td class="num">' + (st.yellow_card || '') + '</td><td class="num">' + (st.red_card || '') + '</td><td class="num">' + (st.save || '') + '</td><td class="num">' + (st.tackle || '') + '</td>' +
          '<td class="num">' + Math.round((mins[p.id] || 0) / 60) + '</td></tr>';
      });
    html += '</tbody></table></div>';
  }
  html += '<div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap">' +
    '<button class="btn-primary" onclick="gtExportGame(\'' + g.id + '\')">📋 Copy Summary</button>' +
    '<button class="btn-primary" onclick="gtExportGamePDF(\'' + g.id + '\')">📄 Export PDF</button>' +
    '<button class="gt-minibtn" style="padding:10px 16px" onclick="gtGo(\'/gametracker\')">← All Games</button>' +
    (canEdit ? '<button class="gt-minibtn" style="padding:10px 16px;margin-left:auto" onclick="gtOpenGameEdit(\'' + g.id + '\')">✏️ Edit Game</button>' : '') +
    (canEdit ? '<button class="gt-minibtn danger" style="padding:10px 16px" onclick="gtDeleteGame(\'' + g.id + '\')">🗑 Delete Game</button>' : '') + '</div>';
  view.innerHTML = html;
}
function gtExportGame(gid) {
  var g = gtGame(gid); if (!g) return;
  var events = gtGameEvents(gid);
  var lines = [];
  lines.push(g.home_team + ' ' + (g.home_score || 0) + ' - ' + (g.away_score || 0) + ' ' + g.away_team);
  lines.push(gtFmtDate(g.played_at || g.created_at) + (g.venue ? ' · ' + g.venue : '') + ' · ' + (g.game_type || ''));
  lines.push('');
  events.forEach(function(e) {
    var t = gtEventType(e.event_type);
    var who = e.event_type === 'opponent_goal' ? gtTheirName(g) : gtPlayerName(e.player_id);
    lines.push('[' + gtFmtMMSS(gtDisplayCumSec(g, e.period, e.game_clock_seconds)) + '] ' + who + ' - ' + t.label + (e.notes ? ' (' + e.notes + ')' : '') + (e.youtube_url ? ' ' + e.youtube_url : ''));
  });
  lines.push('');
  lines.push('— F6AD GameTracker');
  navigator.clipboard.writeText(lines.join('\n')).then(function(){ showToast('Game summary copied!'); });
}
function gtPdfDate(ts) {
  var d = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : new Date());
  if (isNaN(d.getTime())) d = new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
function gtExportGamePDF(gid) {
  var g = gtGame(gid); if (!g) return;
  if (!(window.jspdf && window.jspdf.jsPDF)) { showToast('PDF tool still loading — try again in a moment.'); return; }
  var events = gtGameEvents(gid);
  var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
  var purple = [123, 47, 212];
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(purple[0], purple[1], purple[2]);
  doc.text('F6AD GameTracker', 40, 48);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(110);
  doc.text((g.game_type || 'game') + '  ·  ' + gtFmtDate(g.played_at || g.created_at) + (g.venue ? '  ·  ' + g.venue : ''), 40, 66);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(20);
  doc.text(g.home_team + '   ' + (g.home_score || 0) + ' - ' + (g.away_score || 0) + '   ' + g.away_team, 40, 92);
  var res = g.status === 'complete' ? gtResult(g) : null;
  var y = 100;
  if (res) { doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(110); doc.text(res === 'W' ? 'Win' : res === 'L' ? 'Loss' : 'Draw', 40, (y += 12)); }
  var evRows = events.map(function(e) {
    var who = e.event_type === 'opponent_goal' ? gtTheirName(g) : gtPlayerName(e.player_id);
    return [gtFmtMMSS(gtDisplayCumSec(g, e.period, e.game_clock_seconds)), gtEventType(e.event_type).label, who, e.notes || ''];
  });
  doc.autoTable({
    startY: y + 16,
    head: [['Clock', 'Event', 'Player', 'Notes']],
    body: evRows.length ? evRows : [['—', 'No events logged', '', '']],
    headStyles: { fillColor: purple }, styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: { 0: { cellWidth: 50 }, 3: { cellWidth: 210 } },
    margin: { left: 40, right: 40 }
  });
  var availIds = gtAvailIds(g.id);
  var mins = gtMinutesMap(g.id);
  var statRows = availIds.map(function(pid){ return gtP(pid); }).filter(Boolean)
    .sort(function(a, b){ return (a.jersey_number == null ? 999 : a.jersey_number) - (b.jersey_number == null ? 999 : b.jersey_number); })
    .map(function(p) {
      var st = gtStatLine(p.id, events);
      return [gtPlayerName(p.id), st.goal || 0, st.assist || 0, st.shot_on_target || 0, st.shot || 0, st.yellow_card || 0, st.red_card || 0, st.save || 0, st.tackle || 0, Math.round((mins[p.id] || 0) / 60)];
    });
  if (statRows.length) {
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 22,
      head: [['Player', 'G', 'A', 'SOT', 'SH', 'Y', 'R', 'SV', 'T', 'Min']],
      body: statRows,
      headStyles: { fillColor: purple }, styles: { fontSize: 9, cellPadding: 4 },
      margin: { left: 40, right: 40 }
    });
  }
  doc.save('F6AD_vs_' + String(gtTheirName(g) || 'game').replace(/[^a-z0-9]+/gi, '_') + '_' + gtPdfDate(g.played_at || g.created_at) + '.pdf');
  showToast('PDF exported ✓');
}

// ---------- SEASON OVERVIEW ----------
function gtSeasonGames() {
  var rid = GT.seasonRoster || (gtActiveRoster() ? gtActiveRoster().id : null);
  var f = GT.seasonFilters;
  return GT.games.filter(function(g) {
    if (rid && g.roster_id !== rid) return false;
    if (g.status !== 'complete') return false;
    if (f.type !== 'all' && g.game_type !== f.type) return false;
    if (f.opp) {
      var opp = gtTheirName(g) || '';
      if (opp.toLowerCase().indexOf(f.opp.toLowerCase()) < 0) return false;
    }
    var when = gtTsMillis(g.played_at || g.created_at);
    if (f.from && when < new Date(f.from + 'T00:00:00').getTime()) return false;
    if (f.to && when > new Date(f.to + 'T23:59:59').getTime()) return false;
    return true;
  });
}
function gtRenderSeason(view) {
  var rosters = GT.rosters.slice().sort(function(a, b){ return (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0); });
  if (!GT.seasonRoster && gtActiveRoster()) GT.seasonRoster = gtActiveRoster().id;
  var rid = GT.seasonRoster || (rosters[0] ? rosters[0].id : null);
  var f = GT.seasonFilters;
  var games = gtSeasonGames();
  var w = 0, l = 0, d = 0, gf = 0, ga = 0;
  games.forEach(function(g) {
    var r = gtResult(g);
    if (r === 'W') w++; else if (r === 'L') l++; else d++;
    gf += gtOurScore(g); ga += gtTheirScore(g);
  });
  var html = '<div class="gt-title">📊 Season Overview</div>' +
    '<div class="gt-sub">All completed games' + (rid && gtRoster(rid) ? ' for ' + gtEsc(gtRoster(rid).name) : '') + '.</div>';
  html += '<div class="gt-filters">' +
    (rosters.length > 1 ? '<select onchange="GT.seasonRoster=this.value;gtRerender(true)">' + rosters.map(function(r){ return '<option value="' + r.id + '"' + (rid === r.id ? ' selected' : '') + '>' + gtEsc(r.name) + '</option>'; }).join('') + '</select>' : '') +
    '<select onchange="GT.seasonFilters.type=this.value;gtRerender(true)">' +
    ['all', 'league', 'tournament', 'friendly'].map(function(t){ return '<option value="' + t + '"' + (f.type === t ? ' selected' : '') + '>' + (t === 'all' ? 'All types' : t.charAt(0).toUpperCase() + t.slice(1)) + '</option>'; }).join('') + '</select>' +
    '<input type="date" value="' + gtAttr(f.from) + '" onchange="GT.seasonFilters.from=this.value;gtRerender(true)" title="From date"/>' +
    '<input type="date" value="' + gtAttr(f.to) + '" onchange="GT.seasonFilters.to=this.value;gtRerender(true)" title="To date"/>' +
    '<input type="text" value="' + gtAttr(f.opp) + '" placeholder="Opponent…" onchange="GT.seasonFilters.opp=this.value;gtRerender(true)"/>' +
    '</div>';
  html += '<div class="gt-stat-strip">' +
    '<div class="gt-stat-box"><div class="sb-num">' + w + '-' + l + '-' + d + '</div><div class="sb-label">W-L-D</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + games.length + '</div><div class="sb-label">Games</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + gf + '</div><div class="sb-label">Goals For</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + ga + '</div><div class="sb-label">Goals Against</div></div>' +
    '</div>';
  // game log
  html += '<div class="section-title" style="margin-bottom:12px">📜 Game Log</div>';
  if (!games.length) html += '<div class="gt-empty">No completed games match these filters.</div>';
  else {
    var gs = GT.glogSort || { col: 'date', dir: -1 };
    var sorted = games.slice().sort(function(a, b) {
      var va, vb;
      if (gs.col === 'date') { va = gtTsMillis(a.played_at || a.created_at); vb = gtTsMillis(b.played_at || b.created_at); }
      else if (gs.col === 'result') { va = 'WDL'.indexOf(gtResult(a)); vb = 'WDL'.indexOf(gtResult(b)); }
      else { va = a.game_type || ''; vb = b.game_type || ''; }
      return (va < vb ? -1 : va > vb ? 1 : 0) * gs.dir;
    });
    html += '<div class="gt-table-wrap"><table class="gt-table"><thead><tr>' +
      '<th class="' + (gs.col === 'date' ? 'sorted' : '') + '" onclick="gtGlogSort(\'date\')">Date ' + (gs.col === 'date' ? (gs.dir > 0 ? '▲' : '▼') : '') + '</th>' +
      '<th>Opponent</th>' +
      '<th class="num ' + (gs.col === 'result' ? 'sorted' : '') + '" onclick="gtGlogSort(\'result\')">Result ' + (gs.col === 'result' ? (gs.dir > 0 ? '▲' : '▼') : '') + '</th>' +
      '<th class="num">Score</th>' +
      '<th class="' + (gs.col === 'type' ? 'sorted' : '') + '" onclick="gtGlogSort(\'type\')">Type ' + (gs.col === 'type' ? (gs.dir > 0 ? '▲' : '▼') : '') + '</th>' +
      '<th>Venue</th></tr></thead><tbody>';
    sorted.forEach(function(g) {
      var r = gtResult(g);
      html += '<tr style="cursor:pointer" onclick="gtGo(\'/gametracker/review/' + g.id + '\')">' +
        '<td>' + gtFmtDate(g.played_at || g.created_at) + '</td>' +
        '<td style="font-weight:700">' + gtEsc(gtTheirName(g)) + '</td>' +
        '<td class="num"><span class="gt-result-' + r.toLowerCase() + '">' + r + '</span></td>' +
        '<td class="num" style="font-weight:800">' + gtOurScore(g) + '–' + gtTheirScore(g) + '</td>' +
        '<td>' + gtEsc(g.game_type || '') + '</td><td>' + gtEsc(g.venue || '') + '</td></tr>';
    });
    html += '</tbody></table></div>';
  }
  // player stats
  html += '<div class="section-title" style="margin:26px 0 12px">🏆 Player Stats</div>' +
    '<div class="gt-checkrow" style="margin-bottom:12px"><input type="checkbox" id="gt-show-guests"' + (GT.seasonShowGuests ? ' checked' : '') + ' onchange="GT.seasonShowGuests=this.checked;gtRerender(true)"/><label for="gt-show-guests" style="margin:0">Include guest players</label></div>';
  var stats = gtSeasonPlayerStats(games, rid);
  if (!stats.length) html += '<div class="gt-empty">No player stats yet.</div>';
  else {
    var cols = [['name', 'Player'], ['gp', 'GP'], ['goals', '⚽ G'], ['assists', '🅰️ A'], ['sot', '🎯 SOT'], ['sh', '💨 SH'], ['yc', '🟨 YC'], ['rc', '🟥 RC'], ['saves', '🧤 SV'], ['tackles', '🛡️ T'], ['min', 'Min']];
    var ss = GT.seasonSort;
    stats.sort(function(a, b) {
      var va = a[ss.col], vb = b[ss.col];
      if (typeof va === 'string') return va.localeCompare(vb) * ss.dir;
      return ((va || 0) - (vb || 0)) * ss.dir;
    });
    html += '<div class="gt-table-wrap"><table class="gt-table"><thead><tr>' + cols.map(function(c) {
      return '<th class="' + (c[0] === 'name' ? '' : 'num ') + (ss.col === c[0] ? 'sorted' : '') + '" onclick="gtSeasonSortBy(\'' + c[0] + '\')">' + c[1] + (ss.col === c[0] ? (ss.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>';
    }).join('') + '</tr></thead><tbody>';
    stats.forEach(function(s) {
      html += '<tr><td><span class="gt-plink" onclick="gtGo(\'/gametracker/player/' + s.id + '\')">' + gtEsc(s.name) + '</span>' + (s.guest ? '<span class="gt-guest-badge">Guest</span>' : '') + '</td>' +
        '<td class="num">' + s.gp + '</td><td class="num">' + s.goals + '</td><td class="num">' + s.assists + '</td>' +
        '<td class="num">' + s.sot + '</td><td class="num">' + s.sh + '</td><td class="num">' + s.yc + '</td><td class="num">' + s.rc + '</td>' +
        '<td class="num">' + s.saves + '</td><td class="num">' + (s.tackles || 0) + '</td><td class="num">' + s.min + '</td></tr>';
    });
    html += '</tbody></table></div>';
  }
  view.innerHTML = html;
}
function gtGlogSort(col) {
  var gs = GT.glogSort || { col: 'date', dir: -1 };
  GT.glogSort = { col: col, dir: gs.col === col ? -gs.dir : (col === 'date' ? -1 : 1) };
  gtRerender(true);
}
function gtSeasonSortBy(col) {
  GT.seasonSort = { col: col, dir: GT.seasonSort.col === col ? -GT.seasonSort.dir : (col === 'name' ? 1 : -1) };
  gtRerender(true);
}
function gtSeasonPlayerStats(games, rid) {
  var map = {};
  games.forEach(function(g) {
    var events = gtGameEvents(g.id);
    var mins = gtMinutesMap(g.id);
    gtAvailIds(g.id).forEach(function(pid) {
      var p = gtP(pid);
      if (!p) return;
      if (!GT.seasonShowGuests && p.is_guest) return;
      if (!map[pid]) map[pid] = { id: pid, name: gtPlayerName(pid), guest: !!p.is_guest, gp: 0, goals: 0, assists: 0, sot: 0, sh: 0, yc: 0, rc: 0, saves: 0, tackles: 0, min: 0 };
      var row = map[pid];
      row.gp++;
      var st = gtStatLine(pid, events);
      row.goals += st.goal; row.assists += st.assist; row.sot += st.shot_on_target; row.sh += st.shot;
      row.yc += st.yellow_card; row.rc += st.red_card; row.saves += st.save; row.tackles += st.tackle;
      row.min += Math.round((mins[pid] || 0) / 60);
    });
  });
  // include rostered players with no games yet
  if (rid) gtRosterPlayers(rid).forEach(function(p) {
    if (map[p.id]) return;
    if (!GT.seasonShowGuests && p.is_guest) return;
    map[p.id] = { id: p.id, name: gtPlayerName(p.id), guest: !!p.is_guest, gp: 0, goals: 0, assists: 0, sot: 0, sh: 0, yc: 0, rc: 0, saves: 0, tackles: 0, min: 0 };
  });
  return Object.keys(map).map(function(k){ return map[k]; });
}

// ---------- PLAYER PROFILE ----------
function gtRenderPlayerProfile(view, pid) {
  var p = gtP(pid);
  if (!p) {
    view.innerHTML = GT.loaded.players ? '<div class="gt-empty">Player not found. <a href="#/gametracker/roster">Back to Roster</a></div>' : '<div class="gt-empty">Loading…</div>';
    return;
  }
  var games = GT.games.filter(function(g) {
    return g.status === 'complete' && gtAvailIds(g.id).indexOf(pid) >= 0;
  }).sort(function(a, b){ return gtTsMillis(b.played_at || b.created_at) - gtTsMillis(a.played_at || a.created_at); });
  var tot = { goals: 0, assists: 0, sot: 0, sh: 0, yc: 0, rc: 0, saves: 0, tackles: 0, min: 0 };
  var rows = games.map(function(g) {
    var events = gtGameEvents(g.id);
    var st = gtStatLine(pid, events);
    var mins = Math.round((gtMinutesMap(g.id)[pid] || 0) / 60);
    tot.goals += st.goal; tot.assists += st.assist; tot.sot += st.shot_on_target; tot.sh += st.shot;
    tot.yc += st.yellow_card; tot.rc += st.red_card; tot.saves += st.save; tot.tackles += st.tackle; tot.min += mins;
    var highlights = events.filter(function(e){ return e.player_id === pid && gtYtId(e.youtube_url); });
    return { g: g, st: st, mins: mins, highlights: highlights };
  });
  var html = '<div class="gt-title">' + (p.jersey_number != null ? '<span style="color:var(--purple)">#' + p.jersey_number + '</span> ' : '') + gtEsc(gtPlayerName(pid)) +
    (p.is_guest ? '<span class="gt-guest-badge">Guest</span>' : '') + (gtIsGK(p) ? '<span class="gt-gk-badge">GK</span>' : '') + '</div>' +
    '<div class="gt-sub">' + gtEsc(p.position || '') + (gtRoster(p.roster_id) ? (p.position ? ' · ' : '') + gtEsc(gtRoster(p.roster_id).name) : '') + '</div>';
  html += '<div class="gt-stat-strip">' +
    '<div class="gt-stat-box"><div class="sb-num">' + games.length + '</div><div class="sb-label">Games</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + tot.goals + '</div><div class="sb-label">Goals</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + tot.assists + '</div><div class="sb-label">Assists</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + tot.sot + '</div><div class="sb-label">Shots on Target</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + tot.sh + '</div><div class="sb-label">Shots</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + tot.saves + '</div><div class="sb-label">Saves</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + tot.tackles + '</div><div class="sb-label">Tackles</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + tot.min + '</div><div class="sb-label">Minutes</div></div>' +
    '</div>';
  html += '<div class="section-title" style="margin-bottom:12px">📜 Game by Game</div>';
  if (!rows.length) html += '<div class="gt-empty">No completed games yet.</div>';
  else {
    html += '<div class="gt-table-wrap"><table class="gt-table"><thead><tr><th>Date</th><th>Opponent</th><th class="num">Result</th><th class="num">⚽</th><th class="num">🅰️</th><th class="num">🎯</th><th class="num">💨</th><th class="num">🧤</th><th class="num">🛡️</th><th class="num">Min</th><th>Highlights</th></tr></thead><tbody>';
    rows.forEach(function(r) {
      var g = r.g, res = gtResult(g);
      html += '<tr><td style="cursor:pointer" onclick="gtGo(\'/gametracker/review/' + g.id + '\')">' + gtFmtDate(g.played_at || g.created_at) + '</td>' +
        '<td style="font-weight:700;cursor:pointer" onclick="gtGo(\'/gametracker/review/' + g.id + '\')">' + gtEsc(gtTheirName(g)) + '</td>' +
        '<td class="num"><span class="gt-result-' + res.toLowerCase() + '">' + res + '</span> ' + gtOurScore(g) + '–' + gtTheirScore(g) + '</td>' +
        '<td class="num">' + (r.st.goal || '') + '</td><td class="num">' + (r.st.assist || '') + '</td><td class="num">' + (r.st.shot_on_target || '') + '</td><td class="num">' + (r.st.shot || '') + '</td><td class="num">' + (r.st.save || '') + '</td><td class="num">' + (r.st.tackle || '') + '</td>' +
        '<td class="num">' + r.mins + '</td>' +
        '<td>' + r.highlights.map(function(e) {
          return '<a class="gt-yt-thumb" href="' + gtAttr(e.youtube_url) + '" target="_blank" rel="noopener"><img src="https://img.youtube.com/vi/' + gtYtId(e.youtube_url) + '/default.jpg" alt=""/>▶ ' + gtNominalMinute(g, e.period, e.game_clock_seconds) + '&prime;</a> ';
        }).join('') + '</td></tr>';
    });
    html += '</tbody></table></div>';
  }
  html += '<div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap">' +
    '<button class="btn-primary" onclick="gtSharePlayer(\'' + pid + '\')">🔗 Copy Shareable Link</button>' +
    '<button class="gt-minibtn" style="padding:10px 16px" onclick="gtGo(\'/gametracker/season\')">← Season Stats</button></div>';
  view.innerHTML = html;
}
function gtSharePlayer(pid) {
  var url = window.location.origin + window.location.pathname + '#/gametracker/player/' + pid;
  navigator.clipboard.writeText(url).then(function(){ showToast('Player profile link copied!'); });
}

