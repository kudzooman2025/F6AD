// ===================== SHAREABLE ROSTER / LINEUP =====================
// A read-only page you can send to a tournament organiser, a referee or another
// coach: who is in the squad for one game, season/league, or tournament.
//
// PRIVACY: this renders name, shirt number and position only. gt_players also
// holds parent names, emails and phone numbers, and none of that belongs on a
// link you hand to a stranger — so nothing here reads those fields.

function gtLineupUrl(kind, id) {
  return window.location.origin + window.location.pathname +
    '#/gametracker/lineup/' + (kind === 't' || kind === 's' ? kind : 'g') + '/' + id;
}
function gtShareLineup(kind, id, btn) {
  var url = gtLineupUrl(kind, id);
  var title = (typeof appText === 'function' ? appText('shortName') : '') + ' roster';
  if (navigator.share) {
    navigator.share({ title: title, text: 'Squad list:', url: url }).catch(function(){});
    return;
  }
  var done = function() {
    if (btn) { var o = btn.textContent; btn.textContent = 'Link copied!'; setTimeout(function(){ btn.textContent = o; }, 1800); }
    else showToast('Roster link copied!');
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(done).catch(function(){ window.prompt('Copy this roster link:', url); });
  } else { window.prompt('Copy this roster link:', url); }
}

// All roster outputs use the same selection; never substitute the club roster
// for an explicitly empty game, tournament, or committed season roster.
function gtLineupGameEntries(gid) {
  var entries = {}, hidden = {};
  (GT.rsvp || []).forEach(function(r){ if (r.game_id === gid && r.hidden) hidden[r.player_id] = true; });
  gtGameAvail(gid).forEach(function(a){
    if (a.available && !hidden[a.player_id]) entries[a.player_id] = a;
  });
  return entries;
}
function gtLineupData(kind, id) {
  var entity, ids, entries = {}, games = [], title, meta;
  if (kind === 's') {
    entity = gtSeason(id); if (!entity) return null;
    var roster = gtSeasonRoster(entity);
    ids = roster ? Object.keys(roster).filter(function(pid){ return roster[pid]; }) :
      gtRosterPlayers(entity.base_roster_id).filter(function(p){ return !p.is_guest; }).map(function(p){ return p.id; });
    games = gtSeasonEntGames(id);
  } else if (kind === 't') {
    entity = gtTournament(id); if (!entity) return null;
    games = gtTournamentGames(id);
    var lu = gtTournLineup(entity);
    ids = Object.keys(lu).filter(function(pid){ return lu[pid] && lu[pid].available; });
    if (!entity.lineup) {
      var seen = {};
      games.forEach(function(g){ Object.keys(gtLineupGameEntries(g.id)).forEach(function(pid){ seen[pid] = true; }); });
      ids = Object.keys(seen);
    }
  } else {
    entity = gtGame(id); if (!entity) return null;
    entries = gtLineupGameEntries(id);
    ids = Object.keys(entries);
  }
  if (kind === 's' || kind === 't') {
    title = entity.name || (kind === 's' ? 'Season' : 'Tournament');
    meta = [entity.team_name, [entity.start_date, entity.end_date].filter(Boolean).join(' – '),
      entity.location || entity.venue || '', entity.players_per_side ? entity.players_per_side + 'v' + entity.players_per_side : ''].filter(Boolean).join(' · ');
  } else {
    title = gtOurName(entity) + ' vs ' + gtTheirName(entity);
    meta = [gtFmtDate(entity.played_at || entity.created_at), entity.kickoff_time,
      entity.venue, entity.field, (entity.num_periods || 2) + ' × ' + (entity.period_duration_minutes || 0) + ' min',
      entity.players_per_side ? entity.players_per_side + 'v' + entity.players_per_side : ''].filter(Boolean).join(' · ');
  }
  var players = ids.map(gtP).filter(Boolean).sort(function(a, b) {
    if (kind === 'g') {
      var startOrder = (entries[a.id].started ? 0 : 1) - (entries[b.id].started ? 0 : 1);
      if (startOrder) return startOrder;
    }
    var ag = a.is_guest ? 1 : 0, bg = b.is_guest ? 1 : 0;
    return ag - bg || (a.jersey_number == null ? 999 : a.jersey_number) - (b.jersey_number == null ? 999 : b.jersey_number) ||
      gtPlayerName(a.id).localeCompare(gtPlayerName(b.id));
  });
  return { title: title, meta: meta, players: players, entries: entries, games: games,
    anyStarter: players.some(function(p){ return entries[p.id] && entries[p.id].started; }) };
}
function gtLineupReady(kind, id) {
  var keys = ['players', kind === 's' ? 'seasons' : kind === 't' ? 'tournaments' : 'games'];
  if (kind === 'g') keys = keys.concat(['avail', 'rsvp', 'seasons', 'tournaments']);
  if (kind === 't' && gtTournament(id) && !gtTournament(id).lineup) keys = keys.concat(['games', 'avail', 'rsvp']);
  return keys.every(function(key){ return !!GT.loaded[key]; });
}
function gtLineupText(data) {
  var lines = [data.title + ' — Roster'];
  if (data.meta) lines.push(data.meta);
  lines.push(data.players.length + ' player' + (data.players.length === 1 ? '' : 's'), '');
  data.players.forEach(function(p){
    lines.push((p.jersey_number != null ? '#' + p.jersey_number + ' ' : '') + gtPlayerName(p.id) + (p.is_guest ? ' (Guest)' : ''));
  });
  if (!data.players.length) lines.push('No players selected.');
  return lines.join('\n');
}
function gtCopyLineup(kind, id) {
  if (!gtLineupReady(kind, id)) { showToast('Roster is still loading. Please try again.'); return; }
  var data = gtLineupData(kind, id); if (!data) return;
  var text = gtLineupText(data);
  var fallback = function() {
    gtOpenModal('<h3>Copy Roster<button class="gm-close" onclick="gtCloseModal()">✕</button></h3>' +
      '<p>Select the list below, then copy and paste it into your text or email.</p>' +
      '<textarea id="gt-copy-roster" aria-label="Roster to copy" readonly rows="14">' + gtEsc(text) + '</textarea>');
    var box = document.getElementById('gt-copy-roster'); if (box) { box.focus(); box.select(); }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(function(){ showToast('Roster copied — ready to paste!'); }).catch(fallback);
  }
  fallback();
}
function gtLineupActions(kind, id) {
  var args = gtEsc(JSON.stringify(kind) + ',' + JSON.stringify(id));
  return '<button class="gt-minibtn" onclick="gtShareLineup(' + args + ',this)">🔗 Share Roster</button>' +
    '<button class="gt-minibtn" onclick="gtCopyLineup(' + args + ')">📋 Copy Roster</button>' +
    '<button class="gt-minibtn" onclick="gtExportLineup(' + args + ')">📄 Export Roster PDF</button>' +
    '<button class="gt-minibtn" onclick="gtExportLineupCsv(' + args + ')">📊 Export Spreadsheet (CSV)</button>';
}
function gtLineupCsv(data) {
  var rows = [['Roster', 'Details', 'Jersey number', 'Player', 'Guest']];
  data.players.forEach(function(p){
    rows.push([data.title, data.meta, p.jersey_number == null ? '' : p.jersey_number,
      gtPlayerName(p.id), p.is_guest ? 'Yes' : 'No']);
  });
  return '\uFEFF' + rows.map(function(row){
    return row.map(function(value){
      var cell = String(value == null ? '' : value);
      // Keep names/team labels as text, even if they resemble spreadsheet formulas.
      if (/^\s*[=+@-]/.test(cell) || /^[\t\r\n]/.test(cell)) cell = "'" + cell;
      return '"' + cell.replace(/"/g, '""') + '"';
    }).join(',');
  }).join('\r\n') + '\r\n';
}
function gtExportLineupCsv(kind, id) {
  if (!gtLineupReady(kind, id)) { showToast('Roster is still loading. Please try again.'); return; }
  var data = gtLineupData(kind, id); if (!data) return;
  var url = URL.createObjectURL(new Blob([gtLineupCsv(data)], { type: 'text/csv;charset=utf-8' }));
  var link = document.createElement('a');
  link.href = url; link.download = data.title.replace(/[^a-z0-9]+/gi, '_') + '_roster.csv';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  showToast('Roster spreadsheet exported!');
}
function gtExportLineup(kind, id) {
  if (!gtLineupReady(kind, id)) { showToast('Roster is still loading. Please try again.'); return; }
  var data = gtLineupData(kind, id); if (!data) return;
  if (!(window.jspdf && window.jspdf.jsPDF)) {
    showToast('Loading PDF tool…');
    gtEnsureJsPdf(function(ok){ if (ok) gtExportLineup(kind, id); else showToast('Could not load the PDF tool — check your connection.'); });
    return;
  }
  var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  var title = doc.splitTextToSize(data.title + ' - Roster', 532);
  doc.text(title, 40, 48);
  var y = 48 + title.length * 22;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  if (data.meta) {
    var meta = doc.splitTextToSize(data.meta, 532);
    doc.text(meta, 40, y); y += meta.length * 13 + 8;
  }
  doc.text(data.players.length + ' player' + (data.players.length === 1 ? '' : 's'), 40, y);
  doc.autoTable({ startY: y + 16, head: [['#', 'Player', 'Guest']],
    body: data.players.length ? data.players.map(function(p){
      return [p.jersey_number == null ? '' : String(p.jersey_number), gtPlayerName(p.id), p.is_guest ? 'Guest' : ''];
    }) : [['', 'No players selected', '']],
    headStyles: { fillColor: [123, 47, 212] }, styles: { fontSize: 10, cellPadding: 6 },
    margin: { left: 40, right: 40 }
  });
  doc.save(data.title.replace(/[^a-z0-9]+/gi, '_') + '_roster.pdf');
  showToast('Roster PDF exported!');
}

// One row per player. `entry` is the availability doc when we have one.
function gtLineupRowsHtml(players, entriesByPid, showStatus) {
  return '<div class="gt-table-wrap"><table class="gt-table"><thead><tr>' +
    '<th class="num">#</th><th>Player</th><th>Position</th>' +
    (showStatus ? '<th>Start</th>' : '') + '</tr></thead><tbody>' +
    players.map(function(p) {
      var ae = entriesByPid ? (entriesByPid[p.id] || {}) : {};
      var pos = ae.start_position || p.position || p.default_position || '';
      return '<tr>' +
        '<td class="num">' + (p.jersey_number != null ? p.jersey_number : '·') + '</td>' +
        '<td>' + gtEsc(gtPlayerName(p.id)) + (p.is_guest ? ' <span class="gt-guest-badge">Guest</span>' : '') + '</td>' +
        '<td>' + gtEsc(pos) + '</td>' +
        (showStatus ? '<td>' + (ae.started ? '<span class="gt-ln-start">START</span>' : '<span class="gt-ln-bench">Bench</span>') + '</td>' : '') +
        '</tr>';
    }).join('') + '</tbody></table></div>';
}

function gtRenderLineup(view, kind, id) {
  if (!gtLineupReady(kind, id)) { view.innerHTML = '<div class="gt-empty">Loading roster…</div>'; return; }
  var data = gtLineupData(kind, id);
  if (!data) { view.innerHTML = '<div class="gt-empty">Roster not found.</div>'; return; }
  var siteName = (typeof appText === 'function') ? appText('shortName') : '';
  var html = '<div class="gt-ln-head"><div class="gt-ln-badge">📋 Squad list</div>' +
    '<div class="gt-title" style="margin:0">' + gtEsc(data.title) + '</div>' +
    '<div class="gt-sub">' + gtEsc(data.meta) + '</div></div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:16px 0">' + gtLineupActions(kind, id) + '</div>' +
    '<div class="gt-ln-count">' + data.players.length + ' player' + (data.players.length === 1 ? '' : 's') + '</div>' +
    (data.players.length ? gtLineupRowsHtml(data.players, data.entries, data.anyStarter) : '<div class="gt-empty">No squad set yet.</div>');
  if (data.games.length) {
    html += '<div class="section-title" style="margin:24px 0 10px">Games</div><div class="gt-ln-games">' +
      data.games.map(function(g) {
        return '<div class="gt-ln-game"><span class="lg-date">' + gtEsc(gtFmtDate(g.played_at || g.created_at)) + '</span>' +
          '<span class="lg-opp">vs ' + gtEsc(gtTheirName(g)) + '</span>' +
          '<a class="gt-minibtn" href="' + gtEsc('#/gametracker/lineup/g/' + g.id) + '">Game roster</a></div>';
      }).join('') + '</div>';
  }
  view.innerHTML = html + '<div class="gt-ln-foot">Shared from ' + gtEsc(siteName) +
    ' · no contact details.</div>';
}
