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
  var html = gtLockBanner() + (gtGameCanceled(g) ? '<div class="gt-cancel-banner">🚫 This game has been canceled.</div>' : '') +
    '<div class="gt-card" style="text-align:center">' +
    '<div style="font-size:.74rem;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--muted)">' + gtEsc(g.game_type || 'game') + (g.round ? ' · ' + gtRoundLabel(g.round) : '') + ' · ' + gtFmtDate(g.played_at || g.created_at) + (g.kickoff_time ? ' · ' + gtFmtKickoff(g.kickoff_time) : '') + (g.players_per_side ? ' · ' + g.players_per_side + 'v' + g.players_per_side : '') + (g.venue ? ' · ' + gtEsc(g.venue) : '') + (g.field ? ' · ' + gtEsc(g.field) : '') + '</div>' +
    ([g.venue_address, g.venue_city, g.venue_state, g.venue_zip].filter(Boolean).length ? '<div style="font-size:.72rem;color:var(--muted);margin-top:2px">📍 ' + gtEsc([g.venue_address, g.venue_city, g.venue_state, g.venue_zip].filter(Boolean).join(', ')) + '</div>' : '') +
    '<div style="font-size:1.25rem;font-weight:900;margin-top:8px">' + gtEsc(gtHomeName(g)) + ' <span style="font-size:1.6rem;color:var(--purple)">' + (g.home_score || 0) + ' – ' + (g.away_score || 0) + '</span> ' + gtEsc(gtAwayName(g)) + '</div>' +
    (g.pk_winner ? '<div style="font-size:.85rem;color:var(--muted);margin-top:2px">🥅 Penalties: ' + gtEsc(gtOurName(g)) + ' ' + gtPkScore(g).us + '–' + gtPkScore(g).them + ' ' + gtEsc(gtTheirName(g)) + '</div>' : '') +
    (res ? '<div style="margin-top:6px"><span class="gt-result-' + res.toLowerCase() + '" style="font-size:1rem">' + (res === 'W' ? '✅ Win' : res === 'L' ? '❌ Loss' : '➖ Draw') + '</span></div>' : '<div style="margin-top:6px">' + gtStatusPill(g) + (canEdit ? ' <a href="#/gametracker/live/' + g.id + '" style="font-size:.8rem;font-weight:700">Open live view →</a>' : '') + '</div>') +
    '</div>';
  var _tUrl = (typeof gtTournUrlFor === 'function') ? gtTournUrlFor(g) : '';
  if (_tUrl) html += '<a class="gt-tourn-link" href="' + gtAttr(_tUrl) + '" target="_blank" rel="noopener">🔗 Official tournament site →</a>';
  // stat strip
  var statEvents = (typeof gtGameEventsForStats === 'function') ? gtGameEventsForStats(g.id) : events;
  var totals = { goal: 0, assist: 0, shot_on_target: 0, shot: 0, save: 0, tackle: 0, yellow_card: 0, red_card: 0 };
  statEvents.forEach(function(e){ if (totals[e.event_type] !== undefined) totals[e.event_type]++; });
  html += (typeof gtParentFilmPanelHtml === 'function' ? gtParentFilmPanelHtml(g) : '');
  html += '<div class="gt-stat-strip">' +
    '<div class="gt-stat-box"><div class="sb-num">' + totals.goal + '</div><div class="sb-label">Goals</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + totals.assist + '</div><div class="sb-label">Assists</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + totals.shot_on_target + '</div><div class="sb-label">Shots on Target</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + totals.shot + '</div><div class="sb-label">Shots</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + totals.save + '</div><div class="sb-label">Saves</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + totals.tackle + '</div><div class="sb-label">Tackles</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + (totals.yellow_card + totals.red_card) + '</div><div class="sb-label">Cards</div></div>' +
    '</div>';
  html += (typeof gtParentSharePanelHtml === 'function' ? gtParentSharePanelHtml(g) : '');
  html += gtStartingXiHtml(g.id);
  // timeline with period markers
  html += '<div class="section-title" style="margin-bottom:12px">⏱ Event Timeline' + (canEdit ? ' <span style="font-size:.72rem;color:var(--muted);font-weight:600;text-transform:none">tap an event to edit or delete</span>' : '') + '</div>';
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
    var _mineSub = (typeof gtMyRsvpPlayers === 'function') ? gtMyRsvpPlayers() : [];
    html += '<div class="section-title" style="margin:22px 0 12px">🔄 Substitutions</div><div class="gt-feed">' +
      subLog.map(function(sb) {
        var posBtn = '';
        if (sb.player_in_id) {
          if (canEdit) posBtn = ' <button class="gt-minibtn" style="padding:2px 8px;font-size:.7rem" onclick="event.stopPropagation();gtEditSubPosition(\'' + sb.id + '\')">✏️ Pos</button>';
          else if (_mineSub.indexOf(sb.player_in_id) >= 0) posBtn = ' <button class="gt-minibtn" style="padding:2px 8px;font-size:.7rem" onclick="event.stopPropagation();gtParentEditSubPos(\'' + sb.id + '\')">✏️ My position</button>';
        }
        return '<div class="gt-fitem"><span class="fi-min">[' + gtFmtMMSS(gtDisplayCumSec(g, sb.period, sb.game_clock_seconds)) + ']</span>' + gtSubRowText(sb) + posBtn + '</div>';
      }).join('') + '</div>';
  }
  // player stat table
  var availIds = gtWhoPlayedIds(g.id);
  var availSet = {}; gtAvailIds(g.id).forEach(function(pid){ availSet[pid] = true; });
  var inferredCount = availIds.filter(function(pid){ return !availSet[pid]; }).length;
  html += '<div class="section-title" style="margin:26px 0 12px">📊 Player Stats &amp; Who Played' + (canEdit ? ' <span style="font-size:.72rem;color:var(--muted);font-weight:600;text-transform:none">tap ✕ to remove a player · ✏️ to edit minutes</span>' : '') + '</div>';
  if (inferredCount) html += '<div style="font-size:.74rem;color:var(--muted);margin:-4px 0 10px">Includes ' + inferredCount + ' player' + (inferredCount === 1 ? '' : 's') + ' added from logged stats/subs (no lineup was set for this game).</div>';
  if (availIds.length) {
    var mins = gtMinutesMap(g.id);
    html += '<div class="gt-table-wrap"><table class="gt-table"><thead><tr><th>Player</th><th class="num">⚽ G</th><th class="num">🅰️ A</th><th class="num">🎯 SOT</th><th class="num">💨 SH</th><th class="num">🟨</th><th class="num">🟥</th><th class="num">🥅 OG</th><th class="num">🧤 SV</th><th class="num">🛡️ T</th><th class="num">➡️ P</th><th class="num">✅ PC</th><th class="num">Min</th></tr></thead><tbody>';
    availIds.map(function(pid){ return gtP(pid); }).filter(Boolean)
      .sort(function(a, b){ return (a.jersey_number == null ? 999 : a.jersey_number) - (b.jersey_number == null ? 999 : b.jersey_number); })
      .forEach(function(p) {
        var st = gtStatLine(p.id, statEvents);
        html += '<tr><td><span class="gt-plink" onclick="gtGo(\'/gametracker/player/' + p.id + '\')">' + gtEsc(gtPlayerName(p.id)) + '</span>' + (p.is_guest ? '<span class="gt-guest-badge">Guest</span>' : '') + (canEdit ? ' <button class="gt-minibtn danger" style="padding:1px 6px;font-size:.65rem" title="Remove from this game" onclick="gtRemovePlayerFromGame(\'' + g.id + '\',\'' + p.id + '\')">✕</button>' : '') + '</td>' +
          '<td class="num">' + (st.goal || '') + '</td><td class="num">' + (st.assist || '') + '</td><td class="num">' + (st.shot_on_target || '') + '</td><td class="num">' + (st.shot || '') + '</td>' +
          '<td class="num">' + (st.yellow_card || '') + '</td><td class="num">' + (st.red_card || '') + '</td><td class="num">' + (st.save || '') + '</td><td class="num">' + (st.tackle || '') + '</td>' +
          '<td class="num">' + Math.round((mins[p.id] || 0) / 60) + (gtMinutesOverridden(g.id, p.id) ? '<span title="Manually adjusted" style="color:var(--purple)">*</span>' : '') + (canEdit ? ' <button class="gt-minibtn" style="padding:1px 6px;font-size:.66rem" title="Edit minutes" onclick="gtEditMinutes(\'' + g.id + '\',\'' + p.id + '\')">✏️</button>' : '') + '</td></tr>';
      });
    html += '</tbody></table></div>';
  }
  html += (typeof gtParentReviewSectionHtml === 'function' ? gtParentReviewSectionHtml(g) : '');
  html += (typeof gtParentCoachReviewHtml === 'function' ? gtParentCoachReviewHtml(g) : '');
  html += gtChatPanelHtml(g.id);
  html += '<div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap">' +
    '<button class="btn-primary" onclick="gtCopyGameLink(\'' + g.id + '\')">🔗 Share</button>' +
    '<button class="btn-primary" onclick="gtExportGame(\'' + g.id + '\')">📋 Copy Summary</button>' +
    '<button class="btn-primary" onclick="gtExportGamePDF(\'' + g.id + '\')">📄 Export PDF</button>' +
    (canEdit ? '<button class="btn-primary" onclick="gtOpenAddStat(\'' + g.id + '\')">➕ Add Stat</button>' : '') +
    '<button class="gt-minibtn" style="padding:10px 16px" onclick="gtGo(\'/gametracker\')">← All Games</button>' +
    (canEdit ? '<button class="gt-minibtn" style="padding:10px 16px;margin-left:auto" onclick="gtOpenGameEdit(\'' + g.id + '\')">✏️ Edit Game</button>' : '') +
    (canEdit ? '<button class="gt-minibtn danger" style="padding:10px 16px" onclick="gtDeleteGame(\'' + g.id + '\')">🗑 Delete Game</button>' : '') + '</div>';
  view.innerHTML = html;
  var _cm = document.getElementById('gt-chat-msgs'); if (_cm) _cm.scrollTop = _cm.scrollHeight;
}
function gtRemovePlayerFromGame(gid, pid) {
  // Remove a player who shouldn't be in THIS game: their availability, events, and
  // subs for this game only (roster profile + other games are untouched).
  if (!gtCanEdit()) return;
  var g = gtGame(gid); if (!g) return;
  var evs = GT.events.filter(function(e){ return e.game_id === gid && e.player_id === pid; });
  var goalsRemoved = evs.filter(function(e){ return e.event_type === 'goal'; }).length;
  var subs = GT.subs.filter(function(s){ return s.game_id === gid && (s.player_in_id === pid || s.player_out_id === pid); });
  if (!confirm('Remove ' + gtPlayerName(pid) + ' from this game?\n\nThis deletes their availability, ' + evs.length + ' event(s), and ' + subs.length + ' sub record(s) for THIS game only. Their roster profile and other games are unaffected.')) return;
  var batch = db.batch();
  gtGameAvail(gid).filter(function(a){ return a.player_id === pid; }).forEach(function(a){ batch.delete(db.collection('gt_availability').doc(a.id)); });
  evs.forEach(function(e){ batch.delete(db.collection('gt_events').doc(e.id)); });
  subs.forEach(function(s){ batch.delete(db.collection('gt_subs').doc(s.id)); });
  batch.commit().then(function() {
    if (goalsRemoved) gtBumpScore(g, 'us', -goalsRemoved);
    showToast(gtPlayerShort(pid) + ' removed from this game.');
  }).catch(function(e){ showToast('Error: ' + e.message); });
}
function gtExportGame(gid) {
  var g = gtGame(gid); if (!g) return;
  var events = gtGameEvents(gid);
  var lines = [];
  lines.push(gtHomeName(g) + ' ' + (g.home_score || 0) + ' - ' + (g.away_score || 0) + ' ' + gtAwayName(g));
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
  if (!(window.jspdf && window.jspdf.jsPDF)) {
    showToast('Loading PDF tool…');
    gtEnsureJsPdf(function(ok){ if (ok) gtExportGamePDF(gid); else showToast('Could not load the PDF tool — check your connection.'); });
    return;
  }
  var events = gtGameEvents(gid);
  var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
  var purple = [123, 47, 212];
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(purple[0], purple[1], purple[2]);
  doc.text('F6AD GameTracker', 40, 48);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(110);
  doc.text((g.game_type || 'game') + '  ·  ' + gtFmtDate(g.played_at || g.created_at) + (g.venue ? '  ·  ' + g.venue : ''), 40, 66);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(20);
  doc.text(gtHomeName(g) + '   ' + (g.home_score || 0) + ' - ' + (g.away_score || 0) + '   ' + gtAwayName(g), 40, 92);
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
    if (f.round && (g.round || '') !== f.round) return false;
    if (f.season && (g.season_id || '') !== f.season) return false;
    if (f.team && gtOurName(g) !== f.team) return false;
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
  if (f.season === undefined && GT.loaded.seasons && GT.seasons.length) {
    var _cur = GT.seasons.find(function(se){ return /mls next/i.test(se.name || ''); }) ||
      GT.seasons.slice().sort(function(a, b){ return gtTsMillis(b.created_at) - gtTsMillis(a.created_at); })[0];
    f.season = _cur ? _cur.id : '';
  }
  var games = gtSeasonGames();
  var w = 0, l = 0, d = 0, gf = 0, ga = 0;
  games.forEach(function(g) {
    var r = gtResult(g);
    if (r === 'W') w++; else if (r === 'L') l++; else d++;
    gf += gtOurScore(g); ga += gtTheirScore(g);
  });
  var seasonTeams = [];
  GT.games.forEach(function(g){ if (g.status === 'complete' && (!rid || g.roster_id === rid)) { var tn = gtOurName(g); if (tn && seasonTeams.indexOf(tn) < 0) seasonTeams.push(tn); } });
  seasonTeams.sort();
  var _selSeasonName = f.season ? ((GT.seasons.find(function(se){ return se.id === f.season; }) || {}).name || '') : '';
  var html = '<div class="gt-title">📊 Season Overview</div>' +
    '<div class="gt-sub">' + (_selSeasonName ? 'Completed games in ' + gtEsc(_selSeasonName) : ('All completed games' + (rid && gtRoster(rid) ? ' for ' + gtEsc(gtRoster(rid).name) : ''))) + '.</div>';
  html += '<div class="gt-filters">' +
    (GT.seasons.length ? '<select onchange="GT.seasonFilters.season=this.value;gtRerender(true)"><option value="">All seasons</option>' + GT.seasons.slice().sort(function(a, b){ return gtTsMillis(b.created_at) - gtTsMillis(a.created_at); }).map(function(se){ return '<option value="' + se.id + '"' + (f.season === se.id ? ' selected' : '') + '>' + gtEsc(se.name) + '</option>'; }).join('') + '</select>' : '') +
    (rosters.length > 1 ? '<select onchange="GT.seasonRoster=this.value;gtRerender(true)">' + rosters.map(function(r){ return '<option value="' + r.id + '"' + (rid === r.id ? ' selected' : '') + '>' + gtEsc(r.name) + '</option>'; }).join('') + '</select>' : '') +
    (seasonTeams.length >= 1 ? '<select onchange="GT.seasonFilters.team=this.value;gtRerender(true)"><option value="">All teams</option>' + seasonTeams.map(function(tn){ return '<option value="' + gtAttr(tn) + '"' + (f.team === tn ? ' selected' : '') + '>' + gtEsc(tn) + '</option>'; }).join('') + '</select>' : '') +
    '<select onchange="GT.seasonFilters.type=this.value;gtRerender(true)">' +
    ['all', 'league', 'tournament', 'friendly'].map(function(t){ return '<option value="' + t + '"' + (f.type === t ? ' selected' : '') + '>' + (t === 'all' ? 'All types' : t.charAt(0).toUpperCase() + t.slice(1)) + '</option>'; }).join('') + '</select>' +
    '<select onchange="GT.seasonFilters.round=this.value;gtRerender(true)"><option value="">All rounds</option>' + GT_ROUNDS.map(function(r){ return '<option value="' + r[0] + '"' + (f.round === r[0] ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('') + '</select>' +
    '<input type="date" value="' + gtAttr(f.from) + '" onchange="GT.seasonFilters.from=this.value;gtRerender(true)" title="From date"/>' +
    '<input type="date" value="' + gtAttr(f.to) + '" onchange="GT.seasonFilters.to=this.value;gtRerender(true)" title="To date"/>' +
    '<input type="text" value="' + gtAttr(f.opp) + '" placeholder="Opponent…" onchange="GT.seasonFilters.opp=this.value;gtRerender(true)"/>' +
    '</div>';
  html += '<div class="gt-stat-strip">' +
    '<div class="gt-stat-box"><div class="sb-num">' + w + '-' + l + '-' + d + '</div><div class="sb-label">W-L-D</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + games.length + '</div><div class="sb-label">Games</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + (tot.gs || 0) + '</div><div class="sb-label">Starts</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + gf + '</div><div class="sb-label">Goals For</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + ga + '</div><div class="sb-label">Goals Against</div></div>' +
    '</div>';
  // game log
  var glogCollapsed = GT.glogCollapsed !== false;
  html += '<div class="section-title" style="margin-bottom:12px;cursor:pointer;user-select:none" onclick="gtToggleGlog()">' + (glogCollapsed ? '▸' : '▾') + ' 📜 Game Log <span style="font-size:.78rem;color:var(--muted);font-weight:600">(' + games.length + ')</span></div>';
  if (!glogCollapsed) {
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
        '<td>' + gtEsc(g.game_type || '') + (g.round ? ' · ' + gtRoundLabel(g.round) : '') + '</td><td>' + gtEsc(g.venue || '') + '</td></tr>';
    });
    html += '</tbody></table></div>';
  }
  }
  // player stats
  html += '<div class="section-title" style="margin:26px 0 12px">🏆 Player Stats</div>' +
    '<div class="gt-checkrow" style="margin-bottom:12px"><input type="checkbox" id="gt-show-guests"' + (GT.seasonShowGuests ? ' checked' : '') + ' onchange="GT.seasonShowGuests=this.checked;gtRerender(true)"/><label for="gt-show-guests" style="margin:0">Include guest players</label></div>';
  var stats = gtSeasonPlayerStats(games, rid);
  if (!stats.length) html += '<div class="gt-empty">No player stats yet.</div>';
  else {
    var cols = [['name', 'Player'], ['gp', 'GP'], ['gs', '🟢 GS'], ['goals', '⚽ G'], ['assists', '🅰️ A'], ['sot', '🎯 SOT'], ['sh', '💨 SH'], ['yc', '🟨 YC'], ['rc', '🟥 RC'], ['og', '🥅 OG'], ['saves', '🧤 SV'], ['tackles', '🛡️ T'], ['pass', '➡️ P'], ['pass_comp', '✅ PC'], ['min', 'Min']];
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
        '<td class="num">' + s.gp + '</td><td class="num">' + (s.gs || 0) + '</td><td class="num">' + s.goals + '</td><td class="num">' + s.assists + '</td>' +
        '<td class="num">' + s.sot + '</td><td class="num">' + s.sh + '</td><td class="num">' + s.yc + '</td><td class="num">' + s.rc + '</td>' +
        '<td class="num">' + (s.og || 0) + '</td><td class="num">' + s.saves + '</td><td class="num">' + (s.tackles || 0) + '</td><td class="num">' + (s.pass || 0) + '</td><td class="num">' + (s.pass_comp || 0) + '</td><td class="num">' + s.min + '</td></tr>';
    });
    html += '</tbody></table></div>';
  }
  view.innerHTML = html;
}
function gtToggleGlog() {
  GT.glogCollapsed = (GT.glogCollapsed === false);
  gtRerender(true);
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
function gtPlayerSortBy(col) {
  var ps = GT.playerSort || { col: 'date', dir: -1 };
  GT.playerSort = { col: col, dir: ps.col === col ? -ps.dir : (col === 'opp' ? 1 : -1) };
  gtRerender(true);
}
function gtSeasonPlayerStats(games, rid) {
  var map = {};
  games.forEach(function(g) {
    var events = (typeof gtGameEventsForStats === 'function') ? gtGameEventsForStats(g.id) : gtGameEvents(g.id);
    var mins = gtMinutesMap(g.id);
    (typeof gtWhoPlayedIds === 'function' ? gtWhoPlayedIds(g.id) : gtAvailIds(g.id)).forEach(function(pid) {
      var p = gtP(pid);
      if (!p) return;
      if (!GT.seasonShowGuests && p.is_guest) return;
      if (!map[pid]) map[pid] = { id: pid, name: gtPlayerName(pid), guest: !!p.is_guest, gp: 0, gs: 0, goals: 0, assists: 0, sot: 0, sh: 0, yc: 0, rc: 0, og: 0, saves: 0, tackles: 0, pass: 0, pass_comp: 0, min: 0 };
      var row = map[pid];
      row.gp++;
      if ((gtGameAvailEntry(g.id, pid) || {}).started) row.gs++;
      var st = gtStatLine(pid, events);
      row.goals += st.goal; row.assists += st.assist; row.sot += st.shot_on_target; row.sh += st.shot;
      row.yc += st.yellow_card; row.rc += st.red_card; row.og += st.own_goal; row.saves += st.save; row.tackles += st.tackle; row.pass += st.pass; row.pass_comp += st.pass_comp;
      row.min += Math.round((mins[pid] || 0) / 60);
    });
  });
  // include rostered players with no games yet
  if (rid) gtRosterPlayers(rid).forEach(function(p) {
    if (map[p.id]) return;
    if (!GT.seasonShowGuests && p.is_guest) return;
    map[p.id] = { id: p.id, name: gtPlayerName(p.id), guest: !!p.is_guest, gp: 0, gs: 0, goals: 0, assists: 0, sot: 0, sh: 0, yc: 0, rc: 0, og: 0, saves: 0, tackles: 0, pass: 0, pass_comp: 0, min: 0 };
  });
  return Object.keys(map).map(function(k){ return map[k]; });
}

// ---------- PLAYER PROFILE ----------
function gtPlayerFilteredGames(pid) {
  var f = GT.playerFilters;
  return GT.games.filter(function(g) {
    if (g.status !== 'complete') return false;
    if ((typeof gtWhoPlayedIds === 'function' ? gtWhoPlayedIds(g.id) : gtAvailIds(g.id)).indexOf(pid) < 0) return false;
    if (f.type !== 'all' && g.game_type !== f.type) return false;
    if (f.round && (g.round || '') !== f.round) return false;
    if (f.season && (g.season_id || '') !== f.season) return false;
    if (f.team && gtOurName(g) !== f.team) return false;
    if (f.opp) { var opp = gtTheirName(g) || ''; if (opp.toLowerCase().indexOf(f.opp.toLowerCase()) < 0) return false; }
    var when = gtTsMillis(g.played_at || g.created_at);
    if (f.from && when < new Date(f.from + 'T00:00:00').getTime()) return false;
    if (f.to && when > new Date(f.to + 'T23:59:59').getTime()) return false;
    return true;
  }).sort(function(a, b){ return gtTsMillis(b.played_at || b.created_at) - gtTsMillis(a.played_at || a.created_at); });
}
function gtRenderPlayerProfile(view, pid) {
  var p = gtP(pid);
  if (!p) {
    view.innerHTML = GT.loaded.players ? '<div class="gt-empty">Player not found. <a href="#/gametracker/roster">Back to Roster</a></div>' : '<div class="gt-empty">Loading…</div>';
    return;
  }
  var allGames = GT.games.filter(function(g) {
    return g.status === 'complete' && (typeof gtWhoPlayedIds === 'function' ? gtWhoPlayedIds(g.id) : gtAvailIds(g.id)).indexOf(pid) >= 0;
  });
  var pteams = [];
  allGames.forEach(function(g){ var tn = gtOurName(g); if (tn && pteams.indexOf(tn) < 0) pteams.push(tn); });
  pteams.sort();
  var games = gtPlayerFilteredGames(pid);
  var tot = { gs: 0, goals: 0, assists: 0, sot: 0, sh: 0, yc: 0, rc: 0, saves: 0, tackles: 0, min: 0, gf: 0, ga: 0 };
  var rows = games.map(function(g) {
    var events = (typeof gtGameEventsForStats === 'function') ? gtGameEventsForStats(g.id) : gtGameEvents(g.id);
    var st = gtStatLine(pid, events);
    var mins = Math.round((gtMinutesMap(g.id)[pid] || 0) / 60);
    tot.goals += st.goal; tot.assists += st.assist; tot.sot += st.shot_on_target; tot.sh += st.shot;
    tot.yc += st.yellow_card; tot.rc += st.red_card; tot.saves += st.save; tot.tackles += st.tackle; tot.min += mins;
    if ((gtGameAvailEntry(g.id, pid) || {}).started) tot.gs++;
    if (typeof gtOnFieldGoals === 'function') { var _ofg = gtOnFieldGoals(g.id, pid); tot.gf += _ofg.gf; tot.ga += _ofg.ga; }
    var highlights = events.filter(function(e){ return e.player_id === pid && gtYtId(e.youtube_url); });
    return { g: g, st: st, mins: mins, highlights: highlights };
  });
  var html = '<div class="gt-title">' + (p.jersey_number != null ? '<span style="color:var(--purple)">#' + p.jersey_number + '</span> ' : '') + gtEsc(gtPlayerName(pid)) +
    (p.is_guest ? '<span class="gt-guest-badge">Guest</span>' : '') + (gtIsGK(p) ? '<span class="gt-gk-badge">GK</span>' : '') + '</div>' +
    '<div class="gt-sub">' + gtEsc(p.position || '') + (gtRoster(p.roster_id) ? (p.position ? ' · ' : '') + gtEsc(gtRoster(p.roster_id).name) : '') + '</div>';
  var pr = (typeof gtProfile === 'function') ? gtProfile(pid) : {};
  var canEdPf = (typeof canEditProfile === 'function') && canEditProfile(pid);
  if (pr.photo_url || pr.bio || pr.class_year || canEdPf) {
    html += '<div class="pf-card">' +
      (pr.photo_url ? '<img class="pf-photo" src="' + gtAttr(pr.photo_url) + '" alt="" onerror="this.style.display=\'none\'"/>' : '<div class="pf-photo pf-ph">' + gtEsc(gtPlayerName(pid).slice(0,1)) + '</div>') +
      '<div class="pf-meta">' +
      (pr.class_year ? '<div class="pf-year">Class of ' + gtEsc(pr.class_year) + '</div>' : '') +
      (pr.bio ? '<div class="pf-bio">' + gtEsc(pr.bio) + '</div>' : (canEdPf ? '<div class="pf-bio pf-muted">Add a photo, bio &amp; highlight reel for ' + gtEsc(gtPlayerShort(pid)) + '.</div>' : '')) +
      (canEdPf ? '<div style="margin-top:8px"><button class="gt-minibtn" onclick="openProfileEdit(\'' + pid + '\')">✏️ Edit profile</button>' + (pr.visibility === 'unlisted' ? ' <span class="fam-badge pending">Unlisted</span>' : '') + '</div>' : '') +
      '</div></div>';
  }
  var pf = GT.playerFilters;
  html += '<div class="gt-filters">' +
    (pteams.length >= 1 ? '<select onchange="GT.playerFilters.team=this.value;gtRerender(true)"><option value="">All teams</option>' + pteams.map(function(tn){ return '<option value="' + gtAttr(tn) + '"' + (pf.team === tn ? ' selected' : '') + '>' + gtEsc(tn) + '</option>'; }).join('') + '</select>' : '') +
    '<select onchange="GT.playerFilters.type=this.value;gtRerender(true)">' +
    ['all', 'league', 'tournament', 'friendly'].map(function(t){ return '<option value="' + t + '"' + (pf.type === t ? ' selected' : '') + '>' + (t === 'all' ? 'All types' : t.charAt(0).toUpperCase() + t.slice(1)) + '</option>'; }).join('') + '</select>' +
    '<select onchange="GT.playerFilters.round=this.value;gtRerender(true)"><option value="">All rounds</option>' + GT_ROUNDS.map(function(r){ return '<option value="' + r[0] + '"' + (pf.round === r[0] ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('') + '</select>' +
    '<input type="date" value="' + gtAttr(pf.from) + '" onchange="GT.playerFilters.from=this.value;gtRerender(true)" title="From date"/>' +
    '<input type="date" value="' + gtAttr(pf.to) + '" onchange="GT.playerFilters.to=this.value;gtRerender(true)" title="To date"/>' +
    '<input type="text" value="' + gtAttr(pf.opp) + '" placeholder="Opponent…" onchange="GT.playerFilters.opp=this.value;gtRerender(true)"/>' +
    '</div>';
  html += '<div class="gt-stat-strip">' +
    '<div class="gt-stat-box"><div class="sb-num">' + games.length + '</div><div class="sb-label">Games</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + tot.goals + '</div><div class="sb-label">Goals</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + tot.assists + '</div><div class="sb-label">Assists</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + tot.sot + '</div><div class="sb-label">Shots on Target</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + tot.sh + '</div><div class="sb-label">Shots</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + tot.saves + '</div><div class="sb-label">Saves</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + tot.tackles + '</div><div class="sb-label">Tackles</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + tot.min + '</div><div class="sb-label">Minutes</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + ((tot.gf - tot.ga) >= 0 ? '+' : '') + (tot.gf - tot.ga) + '</div><div class="sb-label">Team +/- (on field)</div></div>' +
    '<div class="gt-stat-box"><div class="sb-num">' + tot.gf + '–' + tot.ga + '</div><div class="sb-label">Goals for–against (on)</div></div>' +
    '</div>';
  html += '<div class="section-title" style="margin-bottom:12px">📜 Game by Game</div>';
  if (!rows.length) html += '<div class="gt-empty">' + ((pf.team || pf.opp || pf.from || pf.to || (pf.type && pf.type !== 'all') || pf.round) ? 'No games match these filters.' : 'No completed games yet.') + '</div>';
  else {
    var ps = GT.playerSort || { col: 'date', dir: -1 };
    var pv = function(r, col) {
      var g = r.g, st = r.st;
      switch (col) {
        case 'date': return gtTsMillis(g.played_at || g.created_at);
        case 'opp': return gtTheirName(g) || '';
        case 'result': return gtOurScore(g) - gtTheirScore(g);
        case 'goal': return st.goal || 0;
        case 'assist': return st.assist || 0;
        case 'sot': return st.shot_on_target || 0;
        case 'sh': return st.shot || 0;
        case 'save': return st.save || 0;
        case 'tackle': return st.tackle || 0;
        case 'pass': return st.pass || 0;
        case 'pass_comp': return st.pass_comp || 0;
        case 'og': return st.own_goal || 0;
        case 'min': return r.mins || 0;
      }
      return 0;
    };
    rows.sort(function(a, b) {
      var va = pv(a, ps.col), vb = pv(b, ps.col);
      if (typeof va === 'string') return va.localeCompare(vb) * ps.dir;
      return ((va || 0) - (vb || 0)) * ps.dir;
    });
    var pcols = [['date', 'Date'], ['opp', 'Opponent'], ['result', 'Result'], ['goal', '⚽'], ['assist', '🅰️'], ['sot', '🎯'], ['sh', '💨'], ['save', '🧤'], ['tackle', '🛡️'], ['pass', '➡️'], ['pass_comp', '✅'], ['og', '🥅'], ['min', 'Min']];
    var phead = pcols.map(function(c) {
      var isNum = c[0] !== 'date' && c[0] !== 'opp';
      return '<th class="' + (isNum ? 'num ' : '') + (ps.col === c[0] ? 'sorted' : '') + '" style="cursor:pointer" onclick="gtPlayerSortBy(\'' + c[0] + '\')">' + c[1] + (ps.col === c[0] ? (ps.dir > 0 ? ' \u25b2' : ' \u25bc') : '') + '</th>';
    }).join('') + '<th>⏱ On field</th><th>Highlights</th>';
    html += '<div class="gt-table-wrap"><table class="gt-table"><thead><tr>' + phead + '</tr></thead><tbody>';
    rows.forEach(function(r) {
      var g = r.g, res = gtResult(g);
      html += '<tr><td style="cursor:pointer" onclick="gtGo(\'/gametracker/review/' + g.id + '\')">' + gtFmtDate(g.played_at || g.created_at) + '</td>' +
        '<td style="font-weight:700;cursor:pointer" onclick="gtGo(\'/gametracker/review/' + g.id + '\')">' + gtEsc(gtTheirName(g)) + '</td>' +
        '<td class="num"><span class="gt-result-' + res.toLowerCase() + '">' + res + '</span> ' + gtOurScore(g) + '–' + gtTheirScore(g) + '</td>' +
        '<td class="num">' + (r.st.goal || '') + '</td><td class="num">' + (r.st.assist || '') + '</td><td class="num">' + (r.st.shot_on_target || '') + '</td><td class="num">' + (r.st.shot || '') + '</td><td class="num">' + (r.st.save || '') + '</td><td class="num">' + (r.st.tackle || '') + '</td>' +
        '<td class="num">' + (r.st.pass || '') + '</td><td class="num">' + (r.st.pass_comp || '') + '</td><td class="num">' + (r.st.own_goal || '') + '</td>' +
        '<td class="num">' + r.mins + '</td>' +
        '<td style="font-size:.78rem;white-space:nowrap">' + ((typeof gtOnFieldIntervals === 'function') ? gtFmtIntervals(g, gtOnFieldIntervals(g.id, pid)) : '—') + '</td>' +
        '<td>' + r.highlights.map(function(e) {
          return '<a class="gt-yt-thumb" href="' + gtAttr(e.youtube_url) + '" target="_blank" rel="noopener"><img src="https://img.youtube.com/vi/' + gtYtId(e.youtube_url) + '/default.jpg" alt=""/>▶ ' + gtNominalMinute(g, e.period, e.game_clock_seconds) + '&prime;</a> ';
        }).join('') + '</td></tr>';
    });
    html += '</tbody></table></div>';
  }
  var _feat = pr.featured_highlights || [];
  if (_feat.length) {
    html += '<div class="section-title" style="margin:24px 0 12px">🎬 Highlight Reel</div><div class="pf-reel">' +
      _feat.map(function(u){ var yid = gtYtId(u); return yid ? '<a class="gt-yt-thumb" href="' + gtAttr(u) + '" target="_blank" rel="noopener"><img src="https://img.youtube.com/vi/' + yid + '/mqdefault.jpg" alt=""/>▶</a>' : '<a class="gt-minibtn" href="' + gtAttr(u) + '" target="_blank" rel="noopener">▶ Clip</a>'; }).join('') + '</div>';
  }
  html += '<div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap">' +
    '<button class="btn-primary" onclick="gtSharePlayer(\'' + pid + '\')">🔗 Copy Shareable Link</button>' +
    '<a class="btn-primary" style="text-decoration:none" href="#/gametracker/card/' + pid + '">📇 Share Card</a>' +
    '<button class="gt-minibtn" style="padding:10px 16px" onclick="gtGo(\'/gametracker/season\')">← Season Stats</button></div>';
  view.innerHTML = html;
}
function gtSharePlayer(pid) {
  var url = window.location.origin + window.location.pathname + '#/gametracker/player/' + pid;
  navigator.clipboard.writeText(url).then(function(){ showToast('Player profile link copied!'); });
}

function gtEditMinutes(gid, pid) {
  if (!gtCanEdit()) return;
  var cur = Math.round((gtMinutesMap(gid)[pid] || 0) / 60);
  var ans = prompt('Minutes played for ' + gtPlayerShort(pid) + '\n(leave blank to auto-calculate from subs):', gtMinutesOverridden(gid, pid) ? cur : '');
  if (ans === null) return;
  ans = ('' + ans).trim();
  var ae = gtGameAvailEntry(gid, pid);
  if (ans === '' && !ae) { showToast('Already auto-calculated.'); return; }
  var val = ans === '' ? firebase.firestore.FieldValue.delete() : Math.max(0, parseInt(ans, 10) || 0);
  var data = { minutes_override: val };
  var op;
  if (ae) op = db.collection('gt_availability').doc(ae.id).set(data, { merge: true });
  else {
    data.game_id = gid; data.player_id = pid; data.available = true; data.notes = '';
    data.created_at = firebase.firestore.FieldValue.serverTimestamp();
    op = db.collection('gt_availability').add(data);
  }
  op.then(function(){ showToast(ans === '' ? 'Minutes reset to auto.' : 'Minutes updated.'); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}

// Lazy-load jsPDF + autotable only when a PDF is actually exported (keeps them off
// every page load). Cross-origin scripts are SW-cached after the first use.
var GT_pdfLoading = false;
function gtEnsureJsPdf(cb) {
  if (window.jspdf && window.jspdf.jsPDF) { cb(true); return; }
  var urls = [
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
  ];
  function loadSeq(i) {
    if (i >= urls.length) { cb(!!(window.jspdf && window.jspdf.jsPDF)); return; }
    var sc = document.createElement('script');
    sc.src = urls[i]; sc.async = false;
    sc.onload = function(){ loadSeq(i + 1); };
    sc.onerror = function(){ cb(false); };
    document.head.appendChild(sc);
  }
  loadSeq(0);
}

// ===================== SHAREABLE PLAYER CARD (Phase 3) =====================
function gtPlayerCareerTotals(pid) {
  var games = GT.games.filter(function(g){ return g.status === 'complete' && (typeof gtWhoPlayedIds === 'function' ? gtWhoPlayedIds(g.id) : gtAvailIds(g.id)).indexOf(pid) >= 0; });
  var t = { games: games.length, goals: 0, assists: 0, sot: 0, sh: 0, saves: 0, tackles: 0, min: 0, gf: 0, ga: 0, highlights: [] };
  games.forEach(function(g) {
    var ev = (typeof gtGameEventsForStats === 'function') ? gtGameEventsForStats(g.id) : gtGameEvents(g.id);
    var st = gtStatLine(pid, ev);
    t.goals += st.goal; t.assists += st.assist; t.sot += st.shot_on_target; t.sh += st.shot; t.saves += st.save; t.tackles += st.tackle;
    t.min += Math.round((gtMinutesMap(g.id)[pid] || 0) / 60);
    if (typeof gtOnFieldGoals === 'function') { var o = gtOnFieldGoals(g.id, pid); t.gf += o.gf; t.ga += o.ga; }
    ev.forEach(function(e){ if (e.player_id === pid && gtYtId(e.youtube_url)) t.highlights.push(e.youtube_url); });
  });
  return t;
}
function gtRenderPlayerCard(view, pid) {
  var p = gtP(pid);
  if (!p) { view.innerHTML = GT.loaded.players ? '<div class="gt-empty">Player not found. <a href="#/gametracker/roster">Back</a></div>' : '<div class="gt-empty">Loading…</div>'; return; }
  var pr = (typeof gtProfile === 'function') ? gtProfile(pid) : {};
  var t = gtPlayerCareerTotals(pid);
  var team = gtRoster(p.roster_id) ? gtRoster(p.roster_id).name : 'F6AD';
  var subline = [p.position || '', pr.class_year ? 'Class of ' + pr.class_year : '', team].filter(Boolean).join(' · ');
  var reel = (pr.featured_highlights || []).concat(t.highlights);
  var seen = {}, thumbs = [];
  reel.forEach(function(u){ var id = gtYtId(u); if (id && !seen[id] && thumbs.length < 3) { seen[id] = 1; thumbs.push({ u: u, id: id }); } });
  function tile(n, l){ return '<div class="pfc-tile"><div class="pfc-num2">' + n + '</div><div class="pfc-lbl">' + l + '</div></div>'; }
  var pm = (t.gf - t.ga);
  var html =
    '<div class="pfc-wrap"><div class="pfc-card" id="pf-share-card">' +
    '<div class="pfc-head">' +
    (pr.photo_url ? '<img class="pfc-photo" src="' + gtAttr(pr.photo_url) + '" alt="" crossorigin="anonymous" onerror="this.style.display=\'none\'"/>' : '<div class="pfc-photo pfc-ph">' + gtEsc(gtPlayerName(pid).slice(0,1)) + '</div>') +
    '<div class="pfc-id"><div class="pfc-name">' + (p.jersey_number != null ? '<span class="pfc-num">#' + p.jersey_number + '</span> ' : '') + gtEsc(gtPlayerName(pid)) + '</div>' +
    '<div class="pfc-sub">' + gtEsc(subline) + '</div></div></div>' +
    (pr.bio ? '<div class="pfc-bio">' + gtEsc(pr.bio) + '</div>' : '') +
    '<div class="pfc-stats">' +
    tile(t.games, 'Games') + tile(t.goals, 'Goals') + tile(t.assists, 'Assists') + tile(t.sot, 'On Target') +
    tile(t.saves, 'Saves') + tile(t.tackles, 'Tackles') + tile(t.min, 'Minutes') + tile((pm >= 0 ? '+' : '') + pm, 'Team +/-') +
    '</div>' +
    (thumbs.length ? '<div class="pfc-reel">' + thumbs.map(function(x){ return '<a class="gt-yt-thumb" href="' + gtAttr(x.u) + '" target="_blank" rel="noopener"><img src="https://img.youtube.com/vi/' + x.id + '/mqdefault.jpg" alt=""/>▶</a>'; }).join('') + '</div>' : '') +
    '<div class="pfc-foot">⚽ f6ad.space · GameTracker</div>' +
    '</div>' +
    '<div class="pfc-actions">' +
    '<button class="btn-primary" onclick="gtShareCard(\'' + pid + '\')">🔗 Copy card link</button>' +
    '<button class="btn-primary" onclick="gtDownloadCard(\'' + pid + '\')">⬇ Download image</button>' +
    '<a class="gt-minibtn" style="padding:10px 16px" href="#/gametracker/player/' + pid + '">← Full profile</a>' +
    '</div></div>';
  view.innerHTML = html;
}
function gtShareCard(pid) {
  var url = window.location.origin + window.location.pathname + '#/gametracker/card/' + pid;
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function(){ showToast('Card link copied!'); }).catch(function(){ window.prompt('Copy this card link:', url); });
  else window.prompt('Copy this card link:', url);
}
var GT_h2cLoading = false;
function gtEnsureHtml2Canvas(cb) {
  if (window.html2canvas) { cb(true); return; }
  var s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  s.onload = function(){ cb(!!window.html2canvas); };
  s.onerror = function(){ cb(false); };
  document.head.appendChild(s);
}
function gtDownloadCard(pid) {
  var el = document.getElementById('pf-share-card'); if (!el) return;
  if (!window.html2canvas) { showToast('Loading image tool…'); gtEnsureHtml2Canvas(function(ok){ if (ok) gtDownloadCard(pid); else showToast('Could not load the image tool — check your connection.'); }); return; }
  window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true }).then(function(canvas) {
    var a = document.createElement('a'); a.download = gtPlayerName(pid).replace(/\s+/g, '_') + '_card.png'; a.href = canvas.toDataURL('image/png'); a.click();
    showToast('Card image saved ✓');
  }).catch(function(e){ showToast('Error: ' + e.message); });
}

// ===================== PUBLIC PROFILES DIRECTORY =====================
function gtProfileCard(p) {
  var pr = (typeof gtProfile === 'function') ? gtProfile(p.id) : {};
  var avatar = pr.photo_url
    ? '<img class="pfdir-photo" src="' + gtAttr(pr.photo_url) + '" alt="" onerror="this.style.display=\'none\'"/>'
    : '<div class="pfdir-photo pfdir-ph">' + gtEsc(gtPlayerName(p.id).slice(0, 1)) + '</div>';
  return '<a class="pfdir-card" href="#/gametracker/player/' + p.id + '">' + avatar +
    '<div class="pfdir-name">' + (p.jersey_number != null ? '<span class="pfdir-num">#' + p.jersey_number + '</span> ' : '') + gtEsc(gtPlayerShort(p.id)) + '</div>' +
    '<div class="pfdir-sub">' + gtEsc(p.position || '') + (pr.visibility === 'unlisted' ? ' <span class="fam-badge pending">Unlisted</span>' : '') + '</div></a>';
}
function gtRenderProfiles(view) {
  var all = (GT.players || []).filter(function(p){ return !p.is_guest; }).sort(function(a, b) {
    var an = a.jersey_number == null ? 999 : a.jersey_number, bn = b.jersey_number == null ? 999 : b.jersey_number;
    if (an !== bn) return an - bn;
    return gtPlayerName(a.id).localeCompare(gtPlayerName(b.id));
  });
  var owns = function(pid){ return (typeof familyOwnsPlayer === 'function' && familyOwnsPlayer(pid)); };
  var staff = (typeof gtCanEdit === 'function' && gtCanEdit());
  var mine = all.filter(function(p){ return owns(p.id); });
  var pub = all.filter(function(p){ var pr = gtProfile(p.id); return pr.visibility !== 'unlisted'; });
  var html = '<div class="gt-title">🪪 Player Profiles</div>' +
    '<div class="gt-sub">Public profiles for our players — tap one for stats, highlights &amp; a shareable card.</div>' +
    '<div style="margin:8px 0 22px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn-primary" onclick="openFamily()">➕ Create Profile</button><button class="btn-primary" onclick="openPlayerDev()">🃏 Player evaluations &amp; card</button></div>';
  if (mine.length) {
    html += '<div class="section-title" style="margin:4px 0 10px">👨‍👩‍👧 My Players</div>' +
      '<div class="pfdir" style="margin-bottom:24px">' + mine.map(gtProfileCard).join('') + '</div>';
  }
  if (mine.length) html += '<div class="section-title" style="margin:4px 0 10px">All Profiles</div>';
  if (!pub.length) { html += '<div class="gt-empty">' + (GT.loaded.players ? 'No public profiles yet.' : 'Loading…') + '</div>'; view.innerHTML = html; return; }
  html += '<div class="pfdir">' + pub.map(gtProfileCard).join('') + '</div>';
  view.innerHTML = html;
}
