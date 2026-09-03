// ===================== SHAREABLE ROSTER / LINEUP =====================
// A read-only page you can send to a tournament organiser, a referee or another
// coach: who is in the squad for one game or one tournament.
//
// PRIVACY: this renders name, shirt number and position only. gt_players also
// holds parent names, emails and phone numbers, and none of that belongs on a
// link you hand to a stranger — so nothing here reads those fields.

function gtLineupUrl(kind, id) {
  return window.location.origin + window.location.pathname +
    '#/gametracker/lineup/' + (kind === 't' ? 't' : 'g') + '/' + id;
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
  var siteName = (typeof appText === 'function') ? appText('shortName') : '';
  var head = function(title, sub) {
    return '<div class="gt-ln-head"><div class="gt-ln-badge">📋 Squad list</div>' +
      '<div class="gt-title" style="margin:0">' + gtEsc(title) + '</div>' +
      (sub ? '<div class="gt-sub">' + gtEsc(sub) + '</div>' : '') + '</div>';
  };
  var foot = '<div class="gt-ln-foot">Shared from ' + gtEsc(siteName) +
    ' · names and shirt numbers only, no contact details.</div>';

  if (kind === 't') {
    var t = gtTournament(id);
    if (!t) {
      view.innerHTML = GT.loaded.tournaments ? '<div class="gt-empty">Tournament not found.</div>' : '<div class="gt-empty">Loading…</div>';
      return;
    }
    var tGames = gtTournamentGames(id);
    // Squad = whoever is down for any of its games, else the base roster.
    var seen = {};
    tGames.forEach(function(g){ gtAvailIds(g.id).forEach(function(pid){ seen[pid] = true; }); });
    var tPlayers = Object.keys(seen).map(gtP).filter(Boolean);
    if (!tPlayers.length && t.base_roster_id) {
      tPlayers = gtRosterPlayers(t.base_roster_id).filter(function(p){ return !p.is_guest; });
    }
    tPlayers.sort(function(a, b){
      return (a.jersey_number == null ? 999 : a.jersey_number) - (b.jersey_number == null ? 999 : b.jersey_number);
    });
    var dates = [t.start_date, t.end_date].filter(Boolean);
    var meta = [t.team_name, dates.length ? dates.join(' – ') : '', t.location || t.venue || '',
      (t.players_per_side ? t.players_per_side + 'v' + t.players_per_side : '')].filter(Boolean).join(' · ');
    var html = head(t.name || 'Tournament', meta) +
      '<div class="gt-ln-count">' + tPlayers.length + ' player' + (tPlayers.length === 1 ? '' : 's') + '</div>' +
      (tPlayers.length ? gtLineupRowsHtml(tPlayers, null, false) : '<div class="gt-empty">No squad set yet.</div>');
    if (tGames.length) {
      html += '<div class="section-title" style="margin:24px 0 10px">Games</div><div class="gt-ln-games">' +
        tGames.map(function(g) {
          return '<div class="gt-ln-game"><span class="lg-date">' + gtEsc(gtFmtDate(g.played_at || g.created_at)) + '</span>' +
            '<span class="lg-opp">vs ' + gtEsc(gtTheirName(g)) + '</span>' +
            (g.kickoff_time ? '<span class="lg-time">' + gtEsc(g.kickoff_time) + '</span>' : '') + '</div>';
        }).join('') + '</div>';
    }
    view.innerHTML = html + foot;
    return;
  }

  var g = gtGame(id);
  if (!g) {
    view.innerHTML = GT.loaded.games ? '<div class="gt-empty">Game not found.</div>' : '<div class="gt-empty">Loading…</div>';
    return;
  }
  var entries = {}, anyStarter = false;
  gtGameAvail(g.id).forEach(function(a) {
    if (!a.available) return;
    entries[a.player_id] = a;
    if (a.started) anyStarter = true;
  });
  var players = Object.keys(entries).map(gtP).filter(Boolean);
  players.sort(function(a, b) {
    var sa = entries[a.id].started ? 0 : 1, sb = entries[b.id].started ? 0 : 1;
    if (anyStarter && sa !== sb) return sa - sb;
    return (a.jersey_number == null ? 999 : a.jersey_number) - (b.jersey_number == null ? 999 : b.jersey_number);
  });
  var bits = [gtFmtDate(g.played_at || g.created_at), g.kickoff_time || '',
    [g.venue, g.field].filter(Boolean).join(' · '),
    ((g.num_periods || 2) + ' × ' + (g.period_duration_minutes || 0) + ' min'),
    (g.players_per_side ? g.players_per_side + 'v' + g.players_per_side : '')].filter(Boolean);
  view.innerHTML = head(gtOurName(g) + ' vs ' + gtTheirName(g), bits.join(' · ')) +
    '<div class="gt-ln-count">' + players.length + ' available' +
      (anyStarter ? ' · ' + players.filter(function(p){ return entries[p.id].started; }).length + ' starting' : '') + '</div>' +
    (players.length ? gtLineupRowsHtml(players, entries, anyStarter) : '<div class="gt-empty">No squad set for this game yet.</div>') +
    foot;
}
