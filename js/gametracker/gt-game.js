// ---------- GAME SETUP FLOW ----------
function gtStartSetup() {
  if (!gtCanEdit()) { showToast('Coach login required.'); return; }
  var act = gtActiveRoster();
  GT.setup = {
    step: 1,
    home_team: act ? act.name : 'F6AD',
    away_team: '', f6ad_side: 'home', game_type: 'league', venue: '', venue_address: '', venue_city: '', venue_state: '', venue_zip: '', field: '', kickoff_time: '', game_date: gtTodayStr(),
    num_periods: 2, period_duration_minutes: 35, players_per_side: 11,
    roster_id: act ? act.id : '',
    avail: {}, notes: {}, guests: [], guestIds: {}, tournament_id: null, season_id: null,
    started: {}, startPos: {}, team_name: ''
  };
  gtGo('/gametracker/new');
}
function gtSetupField(k, v) {
  if (!GT.setup) return;
  GT.setup[k] = v;
  if (k === 'roster_id') { GT.setup.avail = {}; GT.setup.notes = {}; gtRerender(true); }
}
function gtSetupSteps() {
  var names = ['Basics', 'Availability', 'Guests', 'Review'];
  return '<div class="gt-steps">' + names.map(function(n, i) {
    var s = i + 1;
    var cls = s === GT.setup.step ? 'cur' : s < GT.setup.step ? 'done' : '';
    return '<span class="gt-step ' + cls + '">' + s + '. ' + n + '</span>';
  }).join('') + '</div>';
}
function gtRenderNew(view) {
  if (!GT.setup) { gtGo('/gametracker'); return; }
  if (!gtCanEdit()) { view.innerHTML = gtLockBanner(); return; }
  var s = GT.setup;
  var html = '<div class="gt-title">➕ New Game</div>' + gtSetupSteps() + '<div class="gt-card">';
  if (s.step === 1) {
    var ourRosters = GT.rosters.filter(function(r){ return !r.archived; });
    var oppSeen = {}, oppNames = [];
    GT.games.forEach(function(g) {
      var opp = gtTheirName(g);
      if (opp && !oppSeen[opp.toLowerCase()]) { oppSeen[opp.toLowerCase()] = true; oppNames.push(opp); }
    });
    oppNames.sort(function(a,b){ return a.localeCompare(b); });
    var currentOpp = s.f6ad_side === 'home' ? s.away_team : s.home_team;
    html += '<div class="gm-row"><div><label style="display:block;font-size:.74rem;font-weight:800;text-transform:uppercase;color:var(--muted);margin-bottom:4px">Our Team</label>' +
      '<select id="gt-su-us" style="width:100%;border:2px solid var(--border);border-radius:7px;padding:9px 11px;font-family:inherit" onchange="gtSetupCapture();gtRerender(true)">' +
      (ourRosters.length === 0 ? '<option value="">No rosters yet</option>' : '') +
      ourRosters.map(function(r){ return '<option value="' + r.id + '"' + (s.roster_id === r.id ? ' selected' : '') + '>' + gtEsc(r.name) + '</option>'; }).join('') +
      '</select></div>' +
      '<div><label style="display:block;font-size:.74rem;font-weight:800;text-transform:uppercase;color:var(--muted);margin-bottom:4px">Opponent</label>' +
      '<input type="text" style="width:100%;border:2px solid var(--border);border-radius:7px;padding:9px 11px;font-family:inherit" id="gt-su-them" value="' + gtAttr(currentOpp) + '" list="gt-opp-datalist" placeholder="FC Pennsylvania" autocomplete="off"/>' +
      '<datalist id="gt-opp-datalist">' + oppNames.map(function(n){ return '<option value="' + gtEsc(n) + '">'; }).join('') + '</datalist>' +
      '</div></div>' +
      '<label style="display:block;font-size:.74rem;font-weight:800;text-transform:uppercase;color:var(--muted);margin:14px 0 4px">Team Name (shown in game)</label>' +
      '<input type="text" id="gt-su-teamname" style="width:100%;border:2px solid var(--border);border-radius:7px;padding:9px 11px;font-family:inherit" value="' + gtAttr(s.team_name || '') + '" placeholder="' + (gtRoster(s.roster_id) ? gtAttr(gtRoster(s.roster_id).name) : 'F6AD') + '" onchange="gtSetupCapture()"/>' +
      '<label style="display:block;font-size:.74rem;font-weight:800;text-transform:uppercase;color:var(--muted);margin:14px 0 6px">We are playing</label>' +
      '<div class="gt-avail-toggle"><button class="' + (s.f6ad_side === 'home' ? 'on-yes' : '') + '" onclick="gtSetupField(\'f6ad_side\',\'home\');gtSetupCapture();gtRerender(true)">🏠 Home</button>' +
      '<button class="' + (s.f6ad_side === 'away' ? 'on-yes' : '') + '" onclick="gtSetupField(\'f6ad_side\',\'away\');gtSetupCapture();gtRerender(true)">✈️ Away</button></div>' +
      '<div class="gm-row" style="margin-top:14px"><div><label style="display:block;font-size:.74rem;font-weight:800;text-transform:uppercase;color:var(--muted);margin-bottom:4px">Game Type</label>' +
      '<select id="gt-su-type" style="width:100%;border:2px solid var(--border);border-radius:7px;padding:9px 11px;font-family:inherit">' +
      ['league', 'tournament', 'friendly'].map(function(t){ return '<option value="' + t + '"' + (s.game_type === t ? ' selected' : '') + '>' + t.charAt(0).toUpperCase() + t.slice(1) + '</option>'; }).join('') +
      '</select></div>' +
      '<div><label style="display:block;font-size:.74rem;font-weight:800;text-transform:uppercase;color:var(--muted);margin-bottom:4px">Venue</label>' +
      '<input type="text" id="gt-su-venue" list="venue-datalist" onchange="gtFillVenueFields(\'gt-su-venue\',\'gt-su-vaddr\',\'gt-su-vcity\',\'gt-su-vstate\',\'gt-su-vzip\')" style="width:100%;border:2px solid var(--border);border-radius:7px;padding:9px 11px;font-family:inherit" value="' + gtAttr(s.venue) + '" placeholder="Kohler Field, Blue Bell"/></div></div>' +
      '<label style="display:block;font-size:.74rem;font-weight:800;text-transform:uppercase;color:var(--muted);margin:14px 0 4px">Address</label>' +
      '<input type="text" id="gt-su-vaddr" style="width:100%;border:2px solid var(--border);border-radius:7px;padding:9px 11px;font-family:inherit" value="' + gtAttr(s.venue_address || '') + '" placeholder="223 Keith Valley Rd"/>' +
      '<div class="gm-row" style="margin-top:10px"><div><label style="display:block;font-size:.74rem;font-weight:800;text-transform:uppercase;color:var(--muted);margin-bottom:4px">City</label><input type="text" id="gt-su-vcity" style="width:100%;border:2px solid var(--border);border-radius:7px;padding:9px 11px;font-family:inherit" value="' + gtAttr(s.venue_city || '') + '"/></div>' +
      '<div><label style="display:block;font-size:.74rem;font-weight:800;text-transform:uppercase;color:var(--muted);margin-bottom:4px">State</label><input type="text" id="gt-su-vstate" style="width:100%;border:2px solid var(--border);border-radius:7px;padding:9px 11px;font-family:inherit" value="' + gtAttr(s.venue_state || '') + '"/></div>' +
      '<div><label style="display:block;font-size:.74rem;font-weight:800;text-transform:uppercase;color:var(--muted);margin-bottom:4px">Zip</label><input type="text" id="gt-su-vzip" style="width:100%;border:2px solid var(--border);border-radius:7px;padding:9px 11px;font-family:inherit" value="' + gtAttr(s.venue_zip || '') + '"/></div></div>' +
      '<div class="gm-row" style="margin-top:14px"><div><label style="display:block;font-size:.74rem;font-weight:800;text-transform:uppercase;color:var(--muted);margin-bottom:4px">Periods</label>' +
      '<div class="gt-avail-toggle">' + [1, 2, 3, 4].map(function(n){ return '<button class="' + (s.num_periods === n ? 'on-yes' : '') + '" onclick="gtSetupField(\'num_periods\',' + n + ');gtSetupCapture();gtRerender(true)">' + n + '</button>'; }).join('') + '</div></div>' +
      '<div><label style="display:block;font-size:.74rem;font-weight:800;text-transform:uppercase;color:var(--muted);margin-bottom:4px">Minutes per period</label>' +
      '<input type="number" id="gt-su-dur" min="1" max="60" style="width:100%;border:2px solid var(--border);border-radius:7px;padding:9px 11px;font-family:inherit" value="' + s.period_duration_minutes + '"/></div></div>' +
      '<label style="display:block;font-size:.74rem;font-weight:800;text-transform:uppercase;color:var(--muted);margin:14px 0 4px">Players per side</label>' +
      '<input type="number" id="gt-su-side" min="1" max="11" style="width:100%;border:2px solid var(--border);border-radius:7px;padding:9px 11px;font-family:inherit" value="' + (s.players_per_side || 11) + '"/>' +
      '<label style="display:block;font-size:.74rem;font-weight:800;text-transform:uppercase;color:var(--muted);margin:14px 0 4px">Start Time (kickoff)</label>' +
      '<input type="time" id="gt-su-time" style="width:100%;border:2px solid var(--border);border-radius:7px;padding:9px 11px;font-family:inherit" value="' + gtAttr(s.kickoff_time || '') + '"/>' +
      '<label style="display:block;font-size:.74rem;font-weight:800;text-transform:uppercase;color:var(--muted);margin:14px 0 4px">Field Assignment</label>' +
      '<input type="text" id="gt-su-field" style="width:100%;border:2px solid var(--border);border-radius:7px;padding:9px 11px;font-family:inherit" value="' + gtAttr(s.field || '') + '" placeholder="Field 11"/>' +
      '<label style="display:block;font-size:.74rem;font-weight:800;text-transform:uppercase;color:var(--muted);margin:14px 0 4px">Game Date</label>' +
      '<input type="date" id="gt-su-date" style="width:100%;border:2px solid var(--border);border-radius:7px;padding:9px 11px;font-family:inherit" value="' + gtAttr(s.game_date || '') + '"/>';
  } else if (s.step === 2) {
    var rosters = GT.rosters.filter(function(r){ return !r.archived; });
    html += '<label style="display:block;font-size:.74rem;font-weight:800;text-transform:uppercase;color:var(--muted);margin-bottom:4px">Roster</label>' +
      '<select style="border:2px solid var(--border);border-radius:7px;padding:9px 11px;font-family:inherit;width:100%;max-width:340px" onchange="gtSetupField(\'roster_id\',this.value)">' +
      '<option value="">— Select roster —</option>' +
      rosters.map(function(r){ return '<option value="' + r.id + '"' + (s.roster_id === r.id ? ' selected' : '') + '>' + gtEsc(r.name) + (r.is_active ? ' (active)' : '') + '</option>'; }).join('') + '</select>';
    if (s.roster_id) {
      var players = gtRosterPlayers(s.roster_id).filter(function(p){ return !p.is_guest; });
      if (!players.length) html += '<div class="gt-empty" style="margin-top:14px">This roster has no players. Add them in the Roster Manager.</div>';
      else {
        html += '<div style="margin-top:14px">' + players.map(function(p) {
          var av = s.avail[p.id] !== false; // default available
          return '<div class="gt-avail-row"><span class="gt-avail-name">' + (p.jersey_number != null ? '<span style="color:var(--purple);font-weight:900">#' + p.jersey_number + '</span> ' : '') + gtEsc(gtPlayerName(p.id)) + '</span>' +
            '<span class="gt-avail-toggle"><button class="' + (av ? 'on-yes' : '') + '" onclick="GT.setup.avail[\'' + p.id + '\']=true;gtRerender(true)">Available</button>' +
            '<button class="' + (!av ? 'on-no' : '') + '" onclick="GT.setup.avail[\'' + p.id + '\']=false;gtRerender(true)">Out</button></span>' +
            (av ? '<label style="display:inline-flex;align-items:center;gap:5px;font-size:.78rem;text-transform:none;margin:0 0 0 4px"><input type="checkbox"' + (s.started[p.id] ? ' checked' : '') + ' onchange="GT.setup.started[\'' + p.id + '\']=this.checked;gtRerender(true)"/> Started</label>' +
              (s.started[p.id] ? '<select onchange="GT.setup.startPos[\'' + p.id + '\']=this.value">' + gtPositionOptions(s.startPos[p.id] || '') + '</select>' : '') : '') +
            (!av ? '<input type="text" class="gt-avail-note" placeholder="Reason (injured, school event…)" value="' + gtAttr(s.notes[p.id] || '') + '" onchange="GT.setup.notes[\'' + p.id + '\']=this.value"/>' : '') +
            '</div>';
        }).join('') + '</div>';
      }
    }
  } else if (s.step === 3) {
    html += '<p style="font-size:.85rem;color:var(--muted);margin-bottom:14px">Pick guests from your saved pool, or add a new one below (new guests are saved to the pool for next time).</p>';
    var pool = gtGuestPool();
    if (pool.length) {
      html += '<label style="display:block;font-size:.74rem;font-weight:800;text-transform:uppercase;color:var(--muted);margin-bottom:6px">Guest Pool</label>';
      html += '<div style="margin-bottom:16px">' + pool.map(function(p) {
        var on = !!s.guestIds[p.id];
        return '<div class="gt-avail-row"><span class="gt-avail-name">' + (p.jersey_number != null ? '<span style="color:var(--purple);font-weight:900">#' + p.jersey_number + '</span> ' : '') + gtEsc(gtPlayerName(p.id)) + ' <span class="gt-guest-badge">Guest</span></span>' +
          '<span class="gt-avail-toggle"><button class="' + (on ? 'on-yes' : '') + '" onclick="GT.setup.guestIds[\'' + p.id + '\']=true;gtRerender(true)">In</button>' +
          '<button class="' + (!on ? 'on-no' : '') + '" onclick="delete GT.setup.guestIds[\'' + p.id + '\'];gtRerender(true)">Out</button></span></div>';
      }).join('') + '</div>';
    }
    html += '<label style="display:block;font-size:.74rem;font-weight:800;text-transform:uppercase;color:var(--muted);margin-bottom:6px">Add a new guest</label>';
    html += s.guests.map(function(g, i) {
      return '<div class="gt-avail-row"><span class="gt-avail-name">' + (g.jersey_number != null && g.jersey_number !== '' ? '<span style="color:var(--purple);font-weight:900">#' + gtEsc(g.jersey_number) + '</span> ' : '') +
        gtEsc(g.first_name + ' ' + g.last_name) + ' <span class="gt-guest-badge">Guest</span></span>' +
        '<button class="gt-minibtn danger" onclick="GT.setup.guests.splice(' + i + ',1);gtRerender(true)">Remove</button></div>';
    }).join('');
    html += '<div class="gm-row" style="margin-top:14px"><div><input type="text" id="gt-gf-first" placeholder="First name" style="width:100%;border:2px solid var(--border);border-radius:7px;padding:9px 11px;font-family:inherit"/></div>' +
      '<div><input type="text" id="gt-gf-last" placeholder="Last name" style="width:100%;border:2px solid var(--border);border-radius:7px;padding:9px 11px;font-family:inherit"/></div></div>' +
      '<div class="gm-row" style="margin-top:10px"><div><input type="number" id="gt-gf-num" placeholder="Jersey # (optional)" min="0" max="99" style="width:100%;border:2px solid var(--border);border-radius:7px;padding:9px 11px;font-family:inherit"/></div>' +
      '<div><input type="text" id="gt-gf-pos" placeholder="Position (optional)" style="width:100%;border:2px solid var(--border);border-radius:7px;padding:9px 11px;font-family:inherit"/></div></div>' +
      '<button class="btn-primary" style="margin-top:12px" onclick="gtAddGuest()">➕ Add Guest Player</button>';
  } else {
    var ros = gtRoster(s.roster_id);
    var availables = s.roster_id ? gtRosterPlayers(s.roster_id).filter(function(p){ return !p.is_guest && s.avail[p.id] !== false; }) : [];
    html += '<p style="font-weight:800;font-size:1rem;margin-bottom:8px">' + gtEsc(s.f6ad_side === 'home' ? s.home_team : s.away_team) + ' vs ' + gtEsc(s.f6ad_side === 'home' ? s.away_team : s.home_team) + '</p>' +
      '<p style="font-size:.85rem;color:var(--muted)">' + gtEsc(s.game_type) + (s.venue ? ' · ' + gtEsc(s.venue) : '') + ' · ' + s.num_periods + ' × ' + s.period_duration_minutes + ' min · ' + (s.f6ad_side === 'home' ? 'Home' : 'Away') + '</p>' +
      '<p style="font-size:.85rem;margin-top:12px"><strong>Roster:</strong> ' + (ros ? gtEsc(ros.name) : '⚠️ none selected') + '</p>' +
      '<p style="font-size:.85rem;margin-top:6px"><strong>Available (' + availables.length + '):</strong> ' + availables.map(function(p){ return gtEsc(gtPlayerShort(p.id)); }).join(', ') + '</p>' +
      (function() {
        var names = s.guests.map(function(g){ return gtEsc((g.first_name + ' ' + g.last_name).trim()); })
          .concat(Object.keys(s.guestIds || {}).map(function(id){ return gtEsc(gtPlayerName(id)); }));
        return names.length ? '<p style="font-size:.85rem;margin-top:6px"><strong>Guests (' + names.length + '):</strong> ' + names.join(', ') + '</p>' : '';
      })();
  }
  html += '</div><div style="display:flex;gap:10px;flex-wrap:wrap">';
  if (s.step > 1) html += '<button class="gt-minibtn" style="padding:10px 18px" onclick="gtSetupNav(-1)">← Back</button>';
  if (s.step < 4) html += '<button class="btn-primary" onclick="gtSetupNav(1)">Next →</button>';
  else html += '<button class="gt-cbtn gt-cbtn-go" onclick="gtCreateGame()">⚽ Create Game</button>';
  html += '<button class="gt-minibtn" style="padding:10px 18px;margin-left:auto" onclick="GT.setup=null;gtGo(\'/gametracker\')">Cancel</button></div>';
  view.innerHTML = html;
}
function gtSetupCapture() {
  var s = GT.setup; if (!s) return;
  var us = document.getElementById('gt-su-us'), them = document.getElementById('gt-su-them');
  if (us && them) {
    var usName, usRid;
    if (us.tagName === 'SELECT') {
      usRid = us.value;
      usName = us.selectedIndex >= 0 ? us.options[us.selectedIndex].text : '';
      if (usRid) s.roster_id = usRid;
    } else {
      usName = us.value.trim();
    }
    var tn = document.getElementById('gt-su-teamname');
    if (tn) s.team_name = tn.value.trim();
    if (s.team_name) usName = s.team_name;
    if (s.f6ad_side === 'home') { s.home_team = usName; s.away_team = them.value.trim(); }
    else { s.away_team = usName; s.home_team = them.value.trim(); }
  }
  var t = document.getElementById('gt-su-type'); if (t) s.game_type = t.value;
  var v = document.getElementById('gt-su-venue'); if (v) s.venue = v.value.trim();
  var va = document.getElementById('gt-su-vaddr'); if (va) s.venue_address = va.value.trim();
  var vc = document.getElementById('gt-su-vcity'); if (vc) s.venue_city = vc.value.trim();
  var vst = document.getElementById('gt-su-vstate'); if (vst) s.venue_state = vst.value.trim();
  var vz = document.getElementById('gt-su-vzip'); if (vz) s.venue_zip = vz.value.trim();
  var d = document.getElementById('gt-su-dur'); if (d) s.period_duration_minutes = Math.max(1, parseInt(d.value, 10) || 35);
  var sd = document.getElementById('gt-su-side'); if (sd) s.players_per_side = Math.max(1, Math.min(11, parseInt(sd.value, 10) || 11));
  var kt = document.getElementById('gt-su-time'); if (kt) s.kickoff_time = kt.value || '';
  var fld = document.getElementById('gt-su-field'); if (fld) s.field = fld.value.trim();
  var gd = document.getElementById('gt-su-date'); if (gd) s.game_date = gd.value || '';
}
function gtSetupNav(dir) {
  var s = GT.setup;
  if (s.step === 1 && dir > 0) {
    gtSetupCapture();
    var usName = s.f6ad_side === 'home' ? s.home_team : s.away_team;
    var themName = s.f6ad_side === 'home' ? s.away_team : s.home_team;
    if (!usName || !themName) { showToast('Select a team and enter an opponent.'); return; }
  }
  if (s.step === 2 && dir > 0 && !s.roster_id) { showToast('Select a roster.'); return; }
  s.step = Math.max(1, Math.min(4, s.step + dir));
  gtRerender(true);
}
function gtAddGuest() {
  var first = document.getElementById('gt-gf-first').value.trim();
  var last = document.getElementById('gt-gf-last').value.trim();
  if (!first) { showToast('Guest first name is required.'); return; }
  GT.setup.guests.push({
    first_name: first, last_name: last,
    jersey_number: document.getElementById('gt-gf-num').value,
    position: document.getElementById('gt-gf-pos').value.trim()
  });
  gtRerender(true);
}
function gtCreateGame() {
  var s = GT.setup;
  if (!s.roster_id) { showToast('Select a roster first.'); return; }
  var ts = firebase.firestore.FieldValue.serverTimestamp();
  var batch = db.batch();
  var gameRef = db.collection('gt_games').doc();
  batch.set(gameRef, {
    roster_id: s.roster_id, tournament_id: s.tournament_id || null, season_id: s.season_id || null, home_team: s.home_team, away_team: s.away_team, f6ad_side: s.f6ad_side,
    game_type: s.game_type, venue: s.venue, venue_address: s.venue_address || '', venue_city: s.venue_city || '', venue_state: s.venue_state || '', venue_zip: s.venue_zip || '', num_periods: s.num_periods,
    period_duration_minutes: s.period_duration_minutes, players_per_side: s.players_per_side || 11, kickoff_time: s.kickoff_time || '', field: s.field || '',
    status: 'setup', current_period: 1, clock_started_at: null, clock_elapsed_seconds: 0,
    period_elapsed: {}, home_score: 0, away_score: 0,
    played_at: s.game_date ? firebase.firestore.Timestamp.fromDate(new Date(s.game_date + 'T12:00:00')) : null, created_at: ts, updated_at: ts
  });
  var guestRefs = [];
  s.guests.forEach(function(g) {
    var ref = db.collection('gt_players').doc();
    guestRefs.push(ref);
    batch.set(ref, {
      roster_id: '__guests__', first_name: g.first_name, last_name: g.last_name,
      jersey_number: g.jersey_number === '' || g.jersey_number == null ? null : parseInt(g.jersey_number, 10),
      position: g.position || '', parent_name: '', parent_phone: '',
      whatsapp_opt_in: false, is_guest: true, created_at: ts
    });
  });
  gtRosterPlayers(s.roster_id).filter(function(p){ return !p.is_guest; }).forEach(function(p) {
    var ref = db.collection('gt_availability').doc();
    batch.set(ref, {
      game_id: gameRef.id, player_id: p.id,
      available: s.avail[p.id] !== false,
      started: s.avail[p.id] !== false && !!s.started[p.id],
      start_position: (s.avail[p.id] !== false && s.started[p.id]) ? (s.startPos[p.id] || '') : '',
      notes: s.avail[p.id] === false ? (s.notes[p.id] || '') : '', created_at: ts
    });
  });
  guestRefs.forEach(function(ref) {
    var aref = db.collection('gt_availability').doc();
    batch.set(aref, { game_id: gameRef.id, player_id: ref.id, available: true, notes: 'Guest player', created_at: ts });
  });
  Object.keys(s.guestIds || {}).forEach(function(pid) {
    var aref = db.collection('gt_availability').doc();
    batch.set(aref, { game_id: gameRef.id, player_id: pid, available: true, notes: 'Guest player', created_at: ts });
  });
  batch.commit().then(function() {
    GT.setup = null;
    showToast('Game created ✓ Hit Start when you kick off!');
    gtGo('/gametracker/live/' + gameRef.id);
  }).catch(function(e){ showToast('Error: ' + e.message); });
}

// ---------- LIVE GAME VIEW ----------
function gtRenderLive(view, gameId) {
  var g = gtGame(gameId);
  if (!g) {
    view.innerHTML = GT.loaded.games ? '<div class="gt-empty">Game not found. <a href="#/gametracker">Back to GameTracker</a></div>' : '<div class="gt-empty">Loading game…</div>';
    return;
  }
  if (g.status === 'complete') { gtGo('/gametracker/review/' + g.id); return; }
  var canEdit = gtCanEdit();
  var inPK = gtIsPK(g), inOT = gtIsOT(g);
  var html = gtLockBanner();
  // clock bar
  html += '<div class="gt-clockbar">' +
    '<div class="gt-period" id="gt-period-label">' + gtEsc(gtPeriodLabel(g)) + '</div>' +
    '<div class="gt-clock" id="gt-clock-display">' + gtFmtDisplayClock(g) + '</div>' +
    '<div class="gt-scoreline">' +
    '<span class="sc-team">' + gtEsc(g.home_team) + '</span><span class="sc-num">' + (g.home_score || 0) + '</span>' +
    '<span style="color:#666">–</span>' +
    '<span class="sc-num">' + (g.away_score || 0) + '</span><span class="sc-team">' + gtEsc(g.away_team) + '</span>' +
    '</div>';
  html += gtManDownHtml(g);
  if (canEdit && !inPK) {
    html += '<div class="gt-clock-controls">';
    var lastPeriod = inOT ? (gtOtIndex(g) >= (g.ot_num_periods || 1)) : ((g.current_period || 1) >= (g.num_periods || 1));
    if (g.status === 'setup') {
      html += '<button class="gt-cbtn gt-cbtn-go" onclick="gtClockStart(\'' + g.id + '\')">▶ Start Game</button>';
    } else if (g.status === 'in_progress') {
      html += '<button class="gt-cbtn gt-cbtn-warn" style="font-size:.82rem" onpointerdown="gtHoldStart(event,\'pause\',\'' + g.id + '\')" onpointerup="gtHoldCancel()" onpointerleave="gtHoldCancel()" onpointercancel="gtHoldCancel()">⏸ Hold to Pause</button>' +
        (lastPeriod
          ? '<button class="gt-cbtn gt-cbtn-danger" onpointerdown="gtHoldStart(event,\'endGame\',\'' + g.id + '\')" onpointerup="gtHoldCancel()" onpointerleave="gtHoldCancel()" onpointercancel="gtHoldCancel()">🏁 End Game (hold)</button>'
          : '<button class="gt-cbtn gt-cbtn-dark" onpointerdown="gtHoldStart(event,\'endPeriod\',\'' + g.id + '\')" onpointerup="gtHoldCancel()" onpointerleave="gtHoldCancel()" onpointercancel="gtHoldCancel()">End ' + gtEsc(gtPeriodLabel(g, g.current_period, 'in_progress').replace(' — Paused', '')) + ' (hold)</button>');
    } else if (g.status === 'paused') {
      html += '<button class="gt-cbtn gt-cbtn-go" onclick="gtClockResume(\'' + g.id + '\')">▶ Resume</button>' +
        (lastPeriod ? '' : '<button class="gt-cbtn gt-cbtn-dark" onpointerdown="gtHoldStart(event,\'endPeriod\',\'' + g.id + '\')" onpointerup="gtHoldCancel()" onpointerleave="gtHoldCancel()" onpointercancel="gtHoldCancel()">End Period (hold)</button>') +
        '<button class="gt-cbtn gt-cbtn-danger" onpointerdown="gtHoldStart(event,\'endGame\',\'' + g.id + '\')" onpointerup="gtHoldCancel()" onpointerleave="gtHoldCancel()" onpointercancel="gtHoldCancel()">🏁 End Game (hold)</button>';
    } else if (g.status === 'between_periods') {
      html += '<button class="gt-cbtn gt-cbtn-go" onclick="gtStartNextPeriod(\'' + g.id + '\')">▶ Start ' + gtEsc(gtPeriodLabel(g, g.current_period, 'in_progress')) + '</button>' +
        '<button class="gt-cbtn gt-cbtn-danger" onpointerdown="gtHoldStart(event,\'endGame\',\'' + g.id + '\')" onpointerup="gtHoldCancel()" onpointerleave="gtHoldCancel()" onpointercancel="gtHoldCancel()">🏁 End Game (hold)</button>';
    }
    html += '</div>';
  }
  html += '</div>';
  if (inPK) html += gtPkPanel(g, canEdit);
  html += gtChatPanelHtml(g.id);
  // player grid
  var availIds = gtAvailIds(g.id);
  var events = gtGameEvents(g.id);
  var onField = gtOnField(g.id);
  var players = availIds.map(function(pid){ return gtP(pid); }).filter(Boolean).sort(function(a, b) {
    var an = a.jersey_number == null ? 999 : a.jersey_number, bn = b.jersey_number == null ? 999 : b.jersey_number;
    return an - bn;
  });
  html += gtStartingXiHtml(g.id);
  html += '<div class="section-title" style="margin-bottom:12px">👕 Players' + (canEdit ? ' <span style="font-size:.72rem;color:var(--muted);font-weight:600;text-transform:none">' + (g.status === 'setup' ? 'tap to set starters &amp; positions' : 'tap to log an event or sub') + '</span>' : '') + '</div>';
  if (!players.length) html += '<div class="gt-empty">No available players for this game.</div>';
  else {
    html += '<div class="gt-pgrid">' + players.map(function(p) {
      var st = gtStatLine(p.id, events);
      var badges = '';
      if (st.goal) badges += '<span class="gt-pbadge">⚽' + st.goal + '</span>';
      if (st.assist) badges += '<span class="gt-pbadge">🅰️' + st.assist + '</span>';
      if (st.shot_on_target) badges += '<span class="gt-pbadge">🎯' + st.shot_on_target + '</span>';
      if (st.shot) badges += '<span class="gt-pbadge">💨' + st.shot + '</span>';
      if (st.save) badges += '<span class="gt-pbadge">🧤' + st.save + '</span>';
      if (st.tackle) badges += '<span class="gt-pbadge">🛡️' + st.tackle + '</span>';
      if (st.yellow_card) badges += '<span class="gt-pbadge card-y">🟨</span>';
      if (st.red_card) badges += '<span class="gt-pbadge card-r">🟥</span>';
      var setup = g.status === 'setup';
      var ae = gtGameAvailEntry(g.id, p.id) || {};
      var off = setup ? !ae.started : (onField[p.id] === false);
      var starterCls = (setup && ae.started) ? ' starter' : '';
      var posShow = setup ? (p.default_position || '') : gtLastPosition(g.id, p.id);
      var statusLabel = setup ? (ae.started ? 'START' : 'BENCH') : gtStatusShort(gtPlayerGameStatus(g.id, p.id));
      return '<button class="gt-pcard' + (gtIsGK(p) ? ' gk' : '') + starterCls + (off ? ' off' : '') + '"' +
        (canEdit ? ' onclick="' + (setup ? 'gtToggleStarter' : 'gtOpenEventPopup') + '(\'' + g.id + '\',\'' + p.id + '\')"' : '') + '>' +
        '<span class="pc-num">' + (p.jersey_number != null ? '#' + p.jersey_number : '·') + '</span>' +
        '<span class="pc-name">' + gtEsc(gtPlayerShort(p.id)) + (p.is_guest ? ' <span class="gt-guest-badge">G</span>' : '') + '</span>' +
        '<span class="pc-pos">' + (posShow ? gtEsc(posShow) + ' · ' : '') + statusLabel + '</span>' +
        '<span class="pc-badges">' + badges + '</span></button>';
    }).join('') + '</div>';
  }
  if (canEdit && g.status !== 'setup' && !inPK) {
    html += '<div style="display:flex;gap:10px;margin-bottom:24px;flex-wrap:wrap">' +
      '<button class="gt-minibtn" style="padding:9px 16px" onclick="gtOpenMassSub(\'' + g.id + '\')">🔄 Mass Sub</button>' +
      '<button class="gt-minibtn" style="padding:9px 16px" onclick="gtLogOpponentGoal(\'' + g.id + '\')">😣 Opponent Goal</button>' +
      '<button class="gt-minibtn" style="padding:9px 16px" onclick="gtLogOpponentCard(\'' + g.id + '\')">🟨 Opponent Card</button></div>';
  }
  // event feed
  html += '<div class="section-title" style="margin-bottom:12px">📋 Event Feed' + (canEdit ? ' <span style="font-size:.72rem;color:var(--muted);font-weight:600;text-transform:none">tap an event to edit or delete</span>' : '') + '</div>';
  var feedEvents = events.slice().reverse();
  if (!feedEvents.length) html += '<div class="gt-empty">No events logged yet.</div>';
  else html += '<div class="gt-feed">' + feedEvents.map(function(e){ return gtFeedItem(g, e, canEdit); }).join('') + '</div>';
  // substitution log
  var subLog = gtGameSubs(g.id);
  if (subLog.length) {
    html += '<div class="section-title" style="margin:22px 0 12px">🔄 Substitutions</div><div class="gt-feed">' +
      subLog.slice().reverse().map(function(sb) {
        return '<div class="gt-fitem"><span class="fi-min">[' + gtFmtMMSS(gtDisplayCumSec(g, sb.period, sb.game_clock_seconds)) + ']</span>🔄 <strong>' + gtEsc(gtPlayerShort(sb.player_in_id)) + '</strong>' + (sb.position ? ' (' + gtEsc(sb.position) + ')' : '') + ' ← ' + gtEsc(gtPlayerShort(sb.player_out_id)) + (canEdit ? ' <button class="gt-minibtn" style="padding:2px 8px;font-size:.7rem" onclick="event.stopPropagation();gtEditSubPosition(\'' + sb.id + '\')">✏️ Pos</button>' : '') + '</div>';
      }).join('') + '</div>';
  }
  // unavailable footnote
  var outs = gtGameAvail(g.id).filter(function(a){ return !a.available; });
  if (canEdit && outs.length) {
    html += '<p style="font-size:.78rem;color:var(--muted);margin-top:18px"><strong>Unavailable:</strong> ' +
      outs.map(function(a){ return gtEsc(gtPlayerShort(a.player_id)) + (a.notes ? ' (' + gtEsc(a.notes) + ')' : ''); }).join(', ') + '</p>';
  }
  html += '<div style="margin-top:22px;text-align:center"><button class="gt-minibtn" onclick="gtCopyGameLink(\'' + g.id + '\')">🔗 Copy Game Link</button></div>';
  if (canEdit) {
    html += '<div style="margin-top:14px;display:flex;gap:10px;justify-content:flex-end"><button class="gt-minibtn" onclick="gtOpenGameEdit(\'' + g.id + '\')">✏️ Edit Game</button><button class="gt-minibtn danger" onclick="gtDeleteGame(\'' + g.id + '\')">🗑 Delete Game</button></div>';
  }
  view.innerHTML = html;
  var _cm = document.getElementById('gt-chat-msgs'); if (_cm) _cm.scrollTop = _cm.scrollHeight;
  // ticking clock
  if (!GT.clockTimer) {
    GT.clockTimer = setInterval(function() {
      var cur = gtGame(gameId);
      var el = document.getElementById('gt-clock-display');
      var pl = document.getElementById('gt-period-label');
      if (cur && el) el.innerHTML = gtFmtDisplayClock(cur);
      if (cur && pl) pl.textContent = gtPeriodLabel(cur);
    }, 500);
  }
}
function gtFeedItem(g, e, canEdit) {
  var t = gtEventType(e.event_type);
  var isOppEvt = (e.event_type || '').indexOf('opponent') === 0;
  var who = isOppEvt ? gtEsc(gtTheirName(g)) : gtEsc(gtPlayerShort(e.player_id));
  var open = GT.openFeedItem === e.id;
  var yt = gtYtId(e.youtube_url);
  var gameClockStr = (e.period > (g.num_periods || 2))
    ? ('OT' + (e.period - (g.num_periods || 2)) + ' ' + gtFmtMMSS(e.game_clock_seconds))
    : gtFmtMMSS(gtDisplayCumSec(g, e.period, e.game_clock_seconds));
  return '<div class="gt-fitem' + (open ? ' open' : '') + '" onclick="gtToggleFeedItem(\'' + e.id + '\')">' +
    '<span class="fi-min">[' + gameClockStr + ']</span>' + t.emoji + ' <strong>' + who + '</strong> — ' + t.label +
    (e.notes ? ' <span class="fi-note">· ' + gtEsc(e.notes) + '</span>' : '') +
    (yt ? '<br><a class="gt-yt-thumb" href="' + gtAttr(e.youtube_url) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()"><img src="https://img.youtube.com/vi/' + yt + '/default.jpg" alt=""/>▶ Highlight</a>' : '') +
    (canEdit ? '<div class="fi-actions">' +
      '<button class="gt-minibtn" onclick="event.stopPropagation();gtOpenEditEvent(\'' + e.id + '\')">✏️ Edit</button>' +
      '<button class="gt-minibtn" onclick="event.stopPropagation();gtLinkYoutube(\'' + e.id + '\')">🎥 ' + (e.youtube_url ? 'Edit' : 'Link') + ' Highlight</button>' +
      '<button class="gt-minibtn danger" onclick="event.stopPropagation();gtDeleteEvent(\'' + e.id + '\')">🗑 Delete</button>' +
      '</div>' : '') +
    '</div>';
}
function gtToggleFeedItem(id) {
  GT.openFeedItem = GT.openFeedItem === id ? null : id;
  gtRerender();
}

// ---------- clock writes ----------
function gtGameUpdate(gid, data) {
  data.updated_at = firebase.firestore.FieldValue.serverTimestamp();
  return db.collection('gt_games').doc(gid).update(data)
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function gtClockStart(gid) {
  gtGameUpdate(gid, {
    status: 'in_progress', current_period: 1, clock_elapsed_seconds: 0,
    clock_started_at: firebase.firestore.FieldValue.serverTimestamp(),
    played_at: firebase.firestore.FieldValue.serverTimestamp()
  });
  showToast('Kickoff! ⚽');
}
var GT_hold = null, GT_holdBtn = null;
function gtHoldStart(e, action, gid) {
  if (e && e.preventDefault) e.preventDefault();
  gtHoldCancel();
  GT_holdBtn = e && e.currentTarget ? e.currentTarget : null;
  if (GT_holdBtn) GT_holdBtn.classList.add('holding');
  GT_hold = setTimeout(function(){
    GT_hold = null;
    if (GT_holdBtn) { GT_holdBtn.classList.remove('holding'); GT_holdBtn = null; }
    if (action === 'endPeriod') gtEndPeriod(gid);
    else if (action === 'endGame') gtEndGame(gid);
    else gtClockPause(gid);
  }, 650);
}
function gtHoldCancel() {
  if (GT_hold) { clearTimeout(GT_hold); GT_hold = null; }
  if (GT_holdBtn) { GT_holdBtn.classList.remove('holding'); GT_holdBtn = null; }
}
function gtClockPause(gid) {
  var g = gtGame(gid); if (!g) return;
  gtGameUpdate(gid, { status: 'paused', clock_elapsed_seconds: gtClockSeconds(g), clock_started_at: null });
}
function gtClockResume(gid) {
  gtGameUpdate(gid, { status: 'in_progress', clock_started_at: firebase.firestore.FieldValue.serverTimestamp() });
}
function gtEndPeriod(gid) {
  var g = gtGame(gid); if (!g) return;
  var pe = Object.assign({}, g.period_elapsed || {});
  pe[g.current_period || 1] = gtClockSeconds(g);
  gtGameUpdate(gid, {
    status: 'between_periods', period_elapsed: pe,
    current_period: (g.current_period || 1) + 1,
    clock_elapsed_seconds: 0, clock_started_at: null
  });
}
function gtStartNextPeriod(gid) {
  gtGameUpdate(gid, { status: 'in_progress', clock_elapsed_seconds: 0, clock_started_at: firebase.firestore.FieldValue.serverTimestamp() });
}
function gtOpenGameEdit(gid) {
  if (!gtCanEdit()) { showToast('Coach login required.'); return; }
  var g = gtGame(gid); if (!g) return;
  var opp = gtTheirName(g);
  var d = g.played_at ? (g.played_at.toDate ? g.played_at.toDate() : new Date(g.played_at)) : null;
  var dateVal = (d && !isNaN(d.getTime())) ? (d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2)) : '';
  gtOpenModal(
    '<h3>✏️ Edit Game<button class="gm-close" onclick="gtCloseModal()">✕</button></h3>' +
    '<label>Our Team Name</label><input type="text" id="gt-ge-us" value="' + gtAttr(gtOurName(g)) + '" placeholder="F6AD"/>' +
    '<label>Opponent</label><input type="text" id="gt-ge-opp" value="' + gtAttr(opp) + '"/>' +
    '<label>We are playing</label><div class="gt-avail-toggle"><button type="button" id="gt-ge-home" class="' + (g.f6ad_side === 'home' ? 'on-yes' : '') + '" onclick="this.classList.add(\'on-yes\');document.getElementById(\'gt-ge-away\').classList.remove(\'on-yes\')">🏠 Home</button><button type="button" id="gt-ge-away" class="' + (g.f6ad_side === 'away' ? 'on-yes' : '') + '" onclick="this.classList.add(\'on-yes\');document.getElementById(\'gt-ge-home\').classList.remove(\'on-yes\')">✈️ Away</button></div>' +
    '<div class="gm-row"><div><label>Game Type</label><select id="gt-ge-type">' + ['league', 'tournament', 'friendly'].map(function(t){ return '<option value="' + t + '"' + (g.game_type === t ? ' selected' : '') + '>' + t.charAt(0).toUpperCase() + t.slice(1) + '</option>'; }).join('') + '</select></div>' +
    '<div><label>Date</label><input type="date" id="gt-ge-date" value="' + dateVal + '"/></div></div>' +
    '<label>Start Time (kickoff)</label><input type="time" id="gt-ge-time" value="' + gtAttr(g.kickoff_time || '') + '"/>' +
    '<label>Field Assignment</label><input type="text" id="gt-ge-field" value="' + gtAttr(g.field || '') + '" placeholder="Field 11"/>' +
    '<label>Venue</label><input type="text" id="gt-ge-venue" list="venue-datalist" onchange="gtFillVenueFields(\'gt-ge-venue\',\'gt-ge-vaddr\',\'gt-ge-vcity\',\'gt-ge-vstate\',\'gt-ge-vzip\')" value="' + gtAttr(g.venue || '') + '"/>' +
    '<label>Address</label><input type="text" id="gt-ge-vaddr" value="' + gtAttr(g.venue_address || '') + '"/>' +
    '<div class="gm-row"><div><label>City</label><input type="text" id="gt-ge-vcity" value="' + gtAttr(g.venue_city || '') + '"/></div>' +
    '<div><label>State</label><input type="text" id="gt-ge-vstate" value="' + gtAttr(g.venue_state || '') + '"/></div>' +
    '<div><label>Zip</label><input type="text" id="gt-ge-vzip" value="' + gtAttr(g.venue_zip || '') + '"/></div></div>' +
    '<div class="gm-row"><div><label>Periods</label><select id="gt-ge-periods">' + [1, 2, 3, 4].map(function(n){ return '<option value="' + n + '"' + ((g.num_periods || 2) === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div>' +
    '<div><label>Minutes per period</label><input type="number" id="gt-ge-dur" min="1" max="60" value="' + (g.period_duration_minutes || 35) + '"/></div></div>' +
    '<label>Players per side</label><input type="number" id="gt-ge-side" min="1" max="11" value="' + (g.players_per_side || 11) + '"/>' +
    '<div class="gm-actions"><button class="btn-primary" onclick="gtSaveGameEdit(\'' + gid + '\')">Save Changes</button><button class="gt-minibtn" onclick="gtCloseModal()">Cancel</button></div>'
  );
}
function gtSaveGameEdit(gid) {
  if (!gtCanEdit()) return;
  var g = gtGame(gid); if (!g) return;
  var opp = document.getElementById('gt-ge-opp').value.trim();
  if (!opp) { showToast('Enter an opponent.'); return; }
  var side = document.getElementById('gt-ge-home').classList.contains('on-yes') ? 'home' : 'away';
  var ourName = document.getElementById('gt-ge-us').value.trim() || gtOurName(g);
  var data = {
    f6ad_side: side,
    home_team: side === 'home' ? ourName : opp,
    away_team: side === 'home' ? opp : ourName,
    game_type: document.getElementById('gt-ge-type').value,
    venue: document.getElementById('gt-ge-venue').value.trim(),
    venue_address: document.getElementById('gt-ge-vaddr').value.trim(),
    venue_city: document.getElementById('gt-ge-vcity').value.trim(),
    venue_state: document.getElementById('gt-ge-vstate').value.trim(),
    venue_zip: document.getElementById('gt-ge-vzip').value.trim(),
    num_periods: parseInt(document.getElementById('gt-ge-periods').value, 10) || 2,
    period_duration_minutes: Math.max(1, parseInt(document.getElementById('gt-ge-dur').value, 10) || 35),
    players_per_side: Math.max(1, Math.min(11, parseInt(document.getElementById('gt-ge-side').value, 10) || 11)),
    kickoff_time: document.getElementById('gt-ge-time').value || '',
    field: document.getElementById('gt-ge-field').value.trim(),
    updated_at: firebase.firestore.FieldValue.serverTimestamp()
  };
  var dateStr = document.getElementById('gt-ge-date').value;
  if (dateStr) data.played_at = firebase.firestore.Timestamp.fromDate(new Date(dateStr + 'T12:00:00'));
  db.collection('gt_games').doc(gid).set(data, { merge: true })
    .then(function(){ showToast('Game updated ✓'); gtCloseModal(); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function gtDeleteGame(gid) {
  if (!gtCanEdit()) return;
  var g = gtGame(gid); if (!g) return;
  var n = GT.events.filter(function(e){ return e.game_id === gid; }).length;
  if (!confirm('Delete ' + g.home_team + ' vs ' + g.away_team + ' and its ' + n + ' logged event(s)? This cannot be undone.')) return;
  var batch = db.batch();
  batch.delete(db.collection('gt_games').doc(gid));
  GT.events.filter(function(e){ return e.game_id === gid; }).forEach(function(e){ batch.delete(db.collection('gt_events').doc(e.id)); });
  GT.subs.filter(function(s){ return s.game_id === gid; }).forEach(function(s){ batch.delete(db.collection('gt_subs').doc(s.id)); });
  GT.avail.filter(function(a){ return a.game_id === gid; }).forEach(function(a){ batch.delete(db.collection('gt_availability').doc(a.id)); });
  batch.commit().then(function() {
    showToast('Game deleted.');
    gtGo('/gametracker');
  }).catch(function(e){ showToast('Error: ' + e.message); });
}
function gtEndGame(gid) {
  var g = gtGame(gid); if (!g) return;
  var tied = gtOurScore(g) === gtTheirScore(g);
  if (tied && g.phase !== 'pk') { gtOpenDrawDecision(gid, g.phase === 'ot'); return; }
  gtFinishGame(gid);
}
function gtFinishGame(gid) {
  var g = gtGame(gid); if (!g) return;
  var pe = Object.assign({}, g.period_elapsed || {});
  if (g.status !== 'between_periods' && g.status !== 'pk_shootout') pe[g.current_period || 1] = gtClockSeconds(g);
  gtGameUpdate(gid, { status: 'complete', period_elapsed: pe, clock_elapsed_seconds: 0, clock_started_at: null })
    .then(function() { gtGo('/gametracker/review/' + gid); });
}

// ---------- event logging ----------
function gtBumpScore(g, side, delta) {
  var ourField = g.f6ad_side === 'away' ? 'away_score' : 'home_score';
  var theirField = g.f6ad_side === 'away' ? 'home_score' : 'away_score';
  var u = {};
  u[side === 'us' ? ourField : theirField] = firebase.firestore.FieldValue.increment(delta);
  return db.collection('gt_games').doc(g.id).update(u);
}
function gtOpenEventPopup(gid, pid) {
  if (!gtCanEdit()) return;
  var g = gtGame(gid); if (!g) return;
  if (g.status === 'setup') { showToast('Start the game clock first.'); return; }
  if (gtIsPK(g)) { showToast('Penalty shootout — use the shootout panel.'); return; }
  var p = gtP(pid);
  var ae = gtGameAvailEntry(gid, pid);
  var started = !!(ae && ae.started);
  var startPos = ae && ae.start_position ? ae.start_position : ((p && p.default_position) || '');
  GT.pendingEvent = { gameId: gid, playerId: pid, clock: gtClockSeconds(g), period: g.current_period || 1, type: null };
  // Use the same available-player list the live game grid uses, minus the scorer
  var assistPlayers = gtAvailIds(gid)
    .filter(function(id){ return id !== pid; })
    .map(function(id){ return gtP(id); })
    .filter(Boolean)
    .sort(function(a, b) {
      var an = a.jersey_number == null ? 999 : a.jersey_number;
      var bn = b.jersey_number == null ? 999 : b.jersey_number;
      return an - bn;
    });
  var assistOpts = '<option value="">None</option>' + assistPlayers.map(function(pl) {
    return '<option value="' + pl.id + '">' + (pl.jersey_number != null ? '#' + pl.jersey_number + ' ' : '') + gtEsc(gtPlayerName(pl.id)) + '</option>';
  }).join('');
  gtOpenModal(
    '<h3><span>' + (p && p.jersey_number != null ? '#' + p.jersey_number + ' ' : '') + gtEsc(gtPlayerName(pid)) + '</span><button class="gm-close" onclick="gtCloseModal()">✕</button></h3>' +
    '<div class="gm-clock">🕐 ' + gtEsc(gtPeriodLabel(g, GT.pendingEvent.period, 'in_progress')) + ' · ' + gtFmtMMSS(GT.pendingEvent.clock) + ' (captured at tap)</div>' +
    '<div class="gt-evtypes">' + GT_EVENT_TYPES.map(function(t) {
      return '<button class="gt-evtype" id="gt-et-' + t.id + '" onclick="gtSelEventType(\'' + t.id + '\')"><span class="et-emoji">' + t.emoji + '</span>' + t.label + '</button>';
    }).join('') + '</div>' +
    '<label style="display:flex;align-items:center;gap:8px;text-transform:none;margin-top:4px"><input type="checkbox" id="gt-starter-cb"' + (started ? ' checked' : '') + ' onchange="document.getElementById(\'gt-starter-pos\').style.display=this.checked?\'\':\'none\';gtSetStarter(\'' + gid + '\',\'' + pid + '\',this.checked,document.getElementById(\'gt-starter-pos\').value)"/> Started this game</label>' +
    '<select id="gt-starter-pos" style="display:' + (started ? '' : 'none') + '" onchange="gtSetStarter(\'' + gid + '\',\'' + pid + '\',document.getElementById(\'gt-starter-cb\').checked,this.value)">' + gtPositionOptions(startPos) + '</select>' +
    '<label>Notes</label><textarea id="gt-ev-notes" placeholder="Top corner off a cross…"></textarea>' +
    '<div class="gt-override-row"><input type="checkbox" id="gt-ev-override" onchange="document.getElementById(\'gt-ev-time\').style.display=this.checked?\'inline-block\':\'none\'"/>' +
    '<label for="gt-ev-override" style="margin:0;text-transform:none">Adjust time</label>' +
    '<input type="text" id="gt-ev-time" value="' + gtFmtMMSS(GT.pendingEvent.clock) + '" style="display:none" placeholder="MM:SS"/></div>' +
    '<div class="gm-actions"><button class="btn-primary" onclick="gtSaveLiveEvent()">💾 Save Event</button>' +
    '<button class="gt-minibtn" style="padding:10px 16px" onclick="gtOpenSubForm(\'' + gid + '\',\'' + pid + '\')">🔄 Log Substitution</button></div>'
  );
}
function gtSelEventType(t) {
  if (!GT.pendingEvent) return;
  GT.pendingEvent.type = t;
  GT_EVENT_TYPES.forEach(function(et) {
    var el = document.getElementById('gt-et-' + et.id);
    if (el) el.classList.toggle('sel', et.id === t);
  });
  var ar = document.getElementById('gt-assist-row');
  if (ar) ar.style.display = (t === 'goal') ? '' : 'none';
}
function gtParseMMSS(str) {
  var m = String(str || '').trim().match(/^(\d{1,3}):([0-5]?\d)$/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}
function gtSaveLiveEvent() {
  var pe = GT.pendingEvent;
  if (!pe) return;
  if (!pe.type) { showToast('Pick an event type.'); return; }
  var clock = pe.clock;
  if (document.getElementById('gt-ev-override').checked) {
    var manual = gtParseMMSS(document.getElementById('gt-ev-time').value);
    if (manual == null) { showToast('Time must be MM:SS.'); return; }
    clock = manual;
  }
  var g = gtGame(pe.gameId);
  var period = pe.period;
  // an assist can't exist without a goal — snap its timestamp to the most recent goal
  if (pe.type === 'assist') {
    var goals = GT.events.filter(function(e){ return e.game_id === pe.gameId && e.event_type === 'goal'; });
    if (!goals.length) { showToast('Log the goal first — an assist needs a goal.'); return; }
    if (!document.getElementById('gt-ev-override').checked) {
      var lastGoal = goals.slice().sort(function(a, b){ return gtCumSec(g, b.period, b.game_clock_seconds) - gtCumSec(g, a.period, a.game_clock_seconds); })[0];
      clock = lastGoal.game_clock_seconds;
      period = lastGoal.period;
    }
  }
  var notes = document.getElementById('gt-ev-notes').value.trim();
  var assistPid = (pe.type === 'goal') ? (document.getElementById('gt-assist-pid') || {}).value || '' : '';
  var evData = {
    game_id: pe.gameId, player_id: pe.playerId, event_type: pe.type,
    game_clock_seconds: clock, period: period,
    notes: notes, youtube_url: '',
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  };
  db.collection('gt_events').add(evData).then(function() {
    if (pe.type === 'goal' && g) gtBumpScore(g, 'us', 1);
    var ops = [];
    if (pe.type === 'goal' && assistPid) {
      ops.push(db.collection('gt_events').add({
        game_id: pe.gameId, player_id: assistPid, event_type: 'assist',
        game_clock_seconds: clock, period: pe.period,
        notes: '', youtube_url: '',
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      }));
    }
    return Promise.all(ops);
  }).then(function() {
    var msg = gtEventType(pe.type).emoji + ' ' + gtEventType(pe.type).label + ' logged for ' + gtPlayerShort(pe.playerId);
    if (assistPid) msg += ' (assist: ' + gtPlayerShort(assistPid) + ')';
    showToast(msg);
    gtCloseModal();
  }).catch(function(e){ showToast('Error: ' + e.message); });
}
function gtLogOpponentGoal(gid) {
  if (!gtCanEdit()) return;
  var g = gtGame(gid); if (!g) return;
  if (!confirm('Log a goal for ' + gtTheirName(g) + '?')) return;
  db.collection('gt_events').add({
    game_id: gid, player_id: null, event_type: 'opponent_goal',
    game_clock_seconds: gtClockSeconds(g), period: g.current_period || 1,
    notes: '', youtube_url: '', created_at: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(){ gtBumpScore(g, 'them', 1); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function gtDeleteEvent(eid) {
  if (!gtCanEdit()) return;
  var e = GT.events.find(function(x){ return x.id === eid; });
  if (!e) return;
  if (!confirm('Delete this ' + gtEventType(e.event_type).label + ' event?')) return;
  var g = gtGame(e.game_id);
  db.collection('gt_events').doc(eid).delete().then(function() {
    if (g && e.event_type === 'goal') gtBumpScore(g, 'us', -1);
    if (g && e.event_type === 'opponent_goal') gtBumpScore(g, 'them', -1);
    showToast('Event deleted.');
  }).catch(function(err){ showToast('Error: ' + err.message); });
}
function gtOpenEditEvent(eid) {
  if (!gtCanEdit()) return;
  var e = GT.events.find(function(x){ return x.id === eid; });
  if (!e) return;
  var g = gtGame(e.game_id); if (!g) return;
  var isOpp = (e.event_type || '').indexOf('opponent') === 0;
  var nPeriods = g.num_periods || 2;
  var typeOpts = GT_EVENT_TYPES.map(function(t) {
    return '<option value="' + t.id + '"' + (t.id === e.event_type ? ' selected' : '') + '>' + t.emoji + ' ' + t.label + '</option>';
  }).join('');
  var pids = gtAvailIds(e.game_id).slice();
  if (e.player_id && pids.indexOf(e.player_id) < 0) pids.unshift(e.player_id);
  var playerOpts = pids.map(function(id){ return gtP(id); }).filter(Boolean)
    .sort(function(a, b){ return (a.jersey_number == null ? 999 : a.jersey_number) - (b.jersey_number == null ? 999 : b.jersey_number); })
    .map(function(pl){ return '<option value="' + pl.id + '"' + (pl.id === e.player_id ? ' selected' : '') + '>' + (pl.jersey_number != null ? '#' + pl.jersey_number + ' ' : '') + gtEsc(gtPlayerName(pl.id)) + '</option>'; }).join('');
  var periodOpts = '';
  for (var pp = 1; pp <= nPeriods; pp++) periodOpts += '<option value="' + pp + '"' + (pp === (e.period || 1) ? ' selected' : '') + '>' + gtEsc(gtPeriodLabel(g, pp, 'in_progress')) + '</option>';
  gtOpenModal(
    '<h3><span>✏️ Edit Event</span><button class="gm-close" onclick="gtCloseModal()">✕</button></h3>' +
    (isOpp
      ? '<div class="gm-clock">' + gtEventType(e.event_type).emoji + ' ' + gtEsc(gtTheirName(g)) + ' — ' + gtEsc(gtEventType(e.event_type).label) + '</div>'
      : '<label>Event type</label><select id="gt-edit-type">' + typeOpts + '</select>' +
        '<label>Player</label><select id="gt-edit-player">' + playerOpts + '</select>') +
    '<label>Period</label><select id="gt-edit-period">' + periodOpts + '</select>' +
    '<label>Time on game clock (MM:SS within period)</label><input type="text" id="gt-edit-time" value="' + gtFmtMMSS(e.game_clock_seconds || 0) + '" placeholder="MM:SS"/>' +
    '<label>Notes</label><textarea id="gt-edit-notes">' + gtEsc(e.notes || '') + '</textarea>' +
    '<div class="gm-actions"><button class="btn-primary" onclick="gtSaveEditEvent(\'' + eid + '\')">💾 Save Changes</button>' +
    '<button class="gt-minibtn danger" style="padding:10px 16px" onclick="gtDeleteEvent(\'' + eid + '\');gtCloseModal()">🗑 Delete</button></div>'
  );
}
function gtSaveEditEvent(eid) {
  if (!gtCanEdit()) return;
  var e = GT.events.find(function(x){ return x.id === eid; });
  if (!e) return;
  var g = gtGame(e.game_id);
  var isOpp = (e.event_type || '').indexOf('opponent') === 0;
  var sec = gtParseMMSS(document.getElementById('gt-edit-time').value);
  if (sec == null) { showToast('Time must be MM:SS.'); return; }
  var period = parseInt(document.getElementById('gt-edit-period').value, 10) || 1;
  var notes = document.getElementById('gt-edit-notes').value.trim();
  var upd = { game_clock_seconds: sec, period: period, notes: notes };
  var newType = e.event_type;
  if (!isOpp) {
    newType = document.getElementById('gt-edit-type').value || e.event_type;
    upd.event_type = newType;
    upd.player_id = document.getElementById('gt-edit-player').value || e.player_id;
  }
  db.collection('gt_events').doc(eid).update(upd).then(function() {
    if (!isOpp && g) {
      var wasGoal = e.event_type === 'goal', isGoal = newType === 'goal';
      if (isGoal && !wasGoal) return gtBumpScore(g, 'us', 1);
      if (!isGoal && wasGoal) return gtBumpScore(g, 'us', -1);
    }
  }).then(function() {
    showToast('Event updated ✓');
    gtCloseModal();
  }).catch(function(err){ showToast('Error: ' + err.message); });
}
function gtLinkYoutube(eid) {
  if (!gtCanEdit()) return;
  var e = GT.events.find(function(x){ return x.id === eid; });
  if (!e) return;
  var v = prompt('Paste the YouTube highlight URL (blank to remove):', e.youtube_url || '');
  if (v === null) return;
  v = v.trim();
  if (v && !gtYtId(v)) { showToast("That doesn't look like a YouTube URL."); return; }
  db.collection('gt_events').doc(eid).update({ youtube_url: v })
    .then(function(){ showToast(v ? 'Highlight linked 🎥' : 'Highlight removed.'); })
    .catch(function(err){ showToast('Error: ' + err.message); });
}
function gtYtId(url) {
  var m = String(url || '').match(/(?:youtu\.be\/|[?&]v=|shorts\/|embed\/|live\/)([\w-]{11})/);
  return m ? m[1] : null;
}
function gtOpenSubForm(gid, outPid) {
  if (!gtCanEdit()) return;
  var g = gtGame(gid); if (!g) return;
  var onField = gtOnField(gid);
  var clock = GT.pendingEvent ? GT.pendingEvent.clock : gtClockSeconds(g);
  var period = GT.pendingEvent ? GT.pendingEvent.period : (g.current_period || 1);
  GT.pendingEvent = null;
  var candidates = gtAvailIds(gid).filter(function(pid){ return pid !== outPid; });
  gtOpenModal(
    '<h3><span>🔄 Substitution</span><button class="gm-close" onclick="gtCloseModal()">✕</button></h3>' +
    '<div class="gm-clock">🕐 ' + gtEsc(gtPeriodLabel(g, period, 'in_progress')) + ' · ' + gtFmtMMSS(clock) + '</div>' +
    '<label>Player Out</label><input type="text" disabled value="' + gtAttr(gtPlayerName(outPid)) + '"/>' +
    '<label>Player In</label><select id="gt-sub-in" onchange="gtSubInChanged(\'' + gid + '\')">' +
    '<option value="">— Select player —</option>' +
    candidates.map(function(pid) {
      var p = gtP(pid);
      return '<option value="' + pid + '">' + gtEsc((p && p.jersey_number != null ? '#' + p.jersey_number + ' ' : '') + gtPlayerName(pid)) + (onField[pid] === false ? ' (off field)' : ' (on field)') + '</option>';
    }).join('') + '</select>' +
    '<label>Position (in)</label><select id="gt-sub-pos">' + gtPositionOptions('') + '</select>' +
    '<div class="gm-actions"><button class="btn-primary" onclick="gtSaveSub(\'' + gid + '\',\'' + outPid + '\',' + clock + ',' + period + ')">Save Substitution</button>' +
    '<button class="gt-minibtn" onclick="gtCloseModal()">Cancel</button></div>'
  );
}
function gtSubInChanged(gid) {
  var inPid = document.getElementById('gt-sub-in').value;
  var posSel = document.getElementById('gt-sub-pos');
  if (inPid && posSel) { var ip = gtP(inPid); posSel.value = (ip && ip.default_position) || gtLastPosition(gid, inPid) || ''; }
}
function gtSaveSub(gid, outPid, clock, period) {
  var inPid = document.getElementById('gt-sub-in').value;
  if (!inPid) { showToast('Select the player coming in.'); return; }
  var position = document.getElementById('gt-sub-pos').value;
  if (!position) { showToast('Pick the position for the player coming in.'); return; }
  db.collection('gt_subs').add({
    game_id: gid, player_out_id: outPid, player_in_id: inPid,
    position: position,
    game_clock_seconds: clock, period: period,
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function() {
    showToast('🔄 ' + gtPlayerShort(inPid) + ' on (' + position + ') for ' + gtPlayerShort(outPid));
    gtCloseModal();
  }).catch(function(e){ showToast('Error: ' + e.message); });
}
function gtOpenMassSub(gid) {
  if (!gtCanEdit()) return;
  var g = gtGame(gid); if (!g) return;
  if (g.status === 'setup') { showToast('Start the game clock first.'); return; }
  var onField = gtOnField(gid);
  var clock = gtClockSeconds(g), period = g.current_period || 1;
  var players = gtAvailIds(gid).map(function(id){ return gtP(id); }).filter(Boolean).sort(function(a, b){ return (a.jersey_number == null ? 999 : a.jersey_number) - (b.jersey_number == null ? 999 : b.jersey_number); });
  var onList = players.filter(function(p){ return onField[p.id] !== false; });
  var bench = players.filter(function(p){ return onField[p.id] === false; });
  var offHtml = onList.length ? onList.map(function(p){
    return '<div class="gt-avail-row"><label class="gt-avail-name" style="cursor:pointer"><input type="checkbox" class="gt-ms-off" value="' + p.id + '" style="margin-right:8px"/>' + (p.jersey_number != null ? '#' + p.jersey_number + ' ' : '') + gtEsc(gtPlayerShort(p.id)) + ' <span style="color:var(--muted);font-size:.75rem">' + gtEsc(gtLastPosition(gid, p.id)) + '</span></label></div>';
  }).join('') : '<div class="gt-empty">No players on the field.</div>';
  var onHtml = bench.length ? bench.map(function(p){
    var def = p.default_position || gtLastPosition(gid, p.id) || '';
    return '<div class="gt-avail-row"><label class="gt-avail-name" style="cursor:pointer"><input type="checkbox" class="gt-ms-on" value="' + p.id + '" style="margin-right:8px"/>' + (p.jersey_number != null ? '#' + p.jersey_number + ' ' : '') + gtEsc(gtPlayerShort(p.id)) + '</label><select class="gt-ms-pos" data-pid="' + p.id + '">' + gtPositionOptions(def) + '</select></div>';
  }).join('') : '<div class="gt-empty">No bench players.</div>';
  gtOpenModal(
    '<h3><span>🔄 Mass Substitution</span><button class="gm-close" onclick="gtCloseModal()">✕</button></h3>' +
    '<div class="gm-clock">🕐 ' + gtEsc(gtPeriodLabel(g, period, 'in_progress')) + ' · ' + gtFmtMMSS(clock) + '</div>' +
    '<p style="font-size:.8rem;color:var(--muted);margin:6px 0">Check the players coming OFF and the players coming ON (equal numbers). Positions default to the saved position.</p>' +
    '<label style="font-weight:800;font-size:.8rem;display:block;margin-top:6px">⬇ Coming OFF</label>' + offHtml +
    '<label style="font-weight:800;font-size:.8rem;display:block;margin-top:12px">⬆ Coming ON</label>' + onHtml +
    '<div class="gm-actions"><button class="btn-primary" onclick="gtSaveMassSub(\'' + gid + '\',' + clock + ',' + period + ')">🔄 Apply Subs</button><button class="gt-minibtn" onclick="gtCloseModal()">Cancel</button></div>'
  );
}
function gtSaveMassSub(gid, clock, period) {
  if (!gtCanEdit()) return;
  var offs = Array.prototype.slice.call(document.querySelectorAll('.gt-ms-off:checked')).map(function(c){ return c.value; });
  var ons = Array.prototype.slice.call(document.querySelectorAll('.gt-ms-on:checked')).map(function(c){ return c.value; });
  if (!offs.length || !ons.length) { showToast('Select players coming off and on.'); return; }
  if (offs.length !== ons.length) { showToast('Pick equal numbers: ' + offs.length + ' off, ' + ons.length + ' on.'); return; }
  var posByPid = {};
  Array.prototype.slice.call(document.querySelectorAll('.gt-ms-pos')).forEach(function(sel){ posByPid[sel.getAttribute('data-pid')] = sel.value; });
  for (var k = 0; k < ons.length; k++) {
    if (!posByPid[ons[k]]) { showToast('Pick a position for ' + gtPlayerShort(ons[k]) + '.'); return; }
  }
  var ts = firebase.firestore.FieldValue.serverTimestamp();
  var batch = db.batch();
  for (var i = 0; i < ons.length; i++) {
    var ref = db.collection('gt_subs').doc();
    batch.set(ref, { game_id: gid, player_out_id: offs[i], player_in_id: ons[i], position: posByPid[ons[i]] || '', game_clock_seconds: clock, period: period, created_at: ts });
  }
  batch.commit().then(function(){ showToast(ons.length + ' substitution' + (ons.length === 1 ? '' : 's') + ' applied 🔄'); gtCloseModal(); }).catch(function(e){ showToast('Error: ' + e.message); });
}
function gtEditSubPosition(sid) {
  if (!gtCanEdit()) return;
  var sb = GT.subs.find(function(x){ return x.id === sid; });
  if (!sb) return;
  gtOpenModal(
    '<h3>✏️ Edit Sub Position<button class="gm-close" onclick="gtCloseModal()">✕</button></h3>' +
    '<p style="font-size:.85rem;color:var(--muted)">' + gtEsc(gtPlayerShort(sb.player_in_id)) + ' came on for ' + gtEsc(gtPlayerShort(sb.player_out_id)) + '. Adjust the position if it was logged incorrectly.</p>' +
    '<label>Position</label><select id="gt-subpos-edit">' + gtPositionOptions(sb.position || '') + '</select>' +
    '<div class="gm-actions"><button class="btn-primary" onclick="gtSaveSubPosition(\'' + sid + '\')">Save</button><button class="gt-minibtn" onclick="gtCloseModal()">Cancel</button></div>'
  );
}
function gtSaveSubPosition(sid) {
  if (!gtCanEdit()) return;
  var pos = document.getElementById('gt-subpos-edit').value;
  db.collection('gt_subs').doc(sid).update({ position: pos })
    .then(function(){ showToast('Sub position updated ✓'); gtCloseModal(); })
    .catch(function(e){ showToast('Error: ' + e.message); });
}
function gtSetStarter(gid, pid, started, pos) {
  if (!gtCanEdit()) return;
  var ae = gtGameAvailEntry(gid, pid);
  var data = { started: !!started, start_position: started ? (pos || '') : '' };
  var op;
  if (ae) op = db.collection('gt_availability').doc(ae.id).set(data, { merge: true });
  else {
    data.game_id = gid; data.player_id = pid; data.available = true; data.notes = '';
    data.created_at = firebase.firestore.FieldValue.serverTimestamp();
    op = db.collection('gt_availability').add(data);
  }
  op.catch(function(e){ showToast('Error: ' + e.message); });
}
function gtToggleStarter(gid, pid) {
  // Fast lineup: tap toggles a player in/out of the starting XI, using their
  // pre-set default lineup position (overridable in-game via the event popup).
  if (!gtCanEdit()) return;
  var ae = gtGameAvailEntry(gid, pid);
  var nowStarted = !(ae && ae.started);
  if (nowStarted) {
    var g = gtGame(gid);
    var limit = (g && g.players_per_side) || 11;
    if (gtStarters(gid).length >= limit) {
      gtOpenModal('<h3>Lineup full<button class="gm-close" onclick="gtCloseModal()">✕</button></h3>' +
        '<p style="font-size:.9rem;line-height:1.5;margin-bottom:14px">All <strong>' + limit + '</strong> starters have already been selected. Tap a selected (green) player to take them out before adding another.</p>' +
        '<div class="gm-actions"><button class="btn-primary" onclick="gtCloseModal()">Got it</button></div>');
      return;
    }
  }
  var p = gtP(pid);
  var pos = nowStarted ? ((p && p.default_position) || (ae && ae.start_position) || '') : '';
  gtSetStarter(gid, pid, nowStarted, pos);
}
function gtStatusShort(st) {
  return { STARTER: 'START', ON_FIELD: 'ON', BENCHED: 'BENCH', NOT_USED: 'BENCH' }[st] || '';
}


// ===================== OVERTIME / SHOOTOUT / OPP CARDS =====================
function gtOpenDrawDecision(gid, afterOT) {
  var g = gtGame(gid); if (!g) return;
  var us = gtOurScore(g), them = gtTheirScore(g);
  var opts = '';
  if (!afterOT) opts += '<button class="gt-cbtn gt-cbtn-go" onclick="gtCloseModal();gtOpenOTSetup(\'' + gid + '\')">➕ Go to Overtime</button>';
  opts += '<button class="gt-cbtn gt-cbtn-dark" onclick="gtCloseModal();gtOpenPKSetup(\'' + gid + '\')">🥅 Penalty Shootout</button>';
  opts += '<button class="gt-cbtn gt-cbtn-danger" onclick="gtCloseModal();gtFinishGame(\'' + gid + '\')">➖ End as Tie</button>';
  gtOpenModal('<h3>Tied ' + us + '–' + them + '<button class="gm-close" onclick="gtCloseModal()">✕</button></h3>' +
    '<p style="font-size:.88rem;color:var(--muted);margin-bottom:12px">How should this game be decided?</p>' +
    '<div class="gt-pk-controls" style="flex-direction:column">' + opts + '</div>');
}
function gtOpenOTSetup(gid) {
  gtOpenModal('<h3>Overtime<button class="gm-close" onclick="gtCloseModal()">✕</button></h3>' +
    '<div class="gm-row"><div><label>OT periods</label><select id="gt-ot-n"><option value="1">1</option><option value="2" selected>2</option></select></div>' +
    '<div><label>Minutes each</label><input type="number" id="gt-ot-dur" min="1" max="30" value="10"/></div></div>' +
    '<div class="gm-actions"><button class="btn-primary" onclick="gtStartOT(\'' + gid + '\')">Start Overtime</button><button class="gt-minibtn" onclick="gtCloseModal()">Cancel</button></div>');
}
function gtStartOT(gid) {
  var g = gtGame(gid); if (!g) return;
  var n = Math.max(1, parseInt((document.getElementById('gt-ot-n') || {}).value, 10) || 1);
  var dur = Math.max(1, parseInt((document.getElementById('gt-ot-dur') || {}).value, 10) || 10);
  var reg = g.num_periods || 2;
  var pe = Object.assign({}, g.period_elapsed || {});
  if (g.status === 'in_progress' || g.status === 'paused') pe[g.current_period || reg] = gtClockSeconds(g);
  gtCloseModal();
  gtGameUpdate(gid, {
    phase: 'ot', ot_num_periods: n, ot_duration_minutes: dur,
    current_period: reg + 1, status: 'between_periods', period_elapsed: pe,
    clock_elapsed_seconds: 0, clock_started_at: null
  }).then(function(){ gtRerender(); });
  showToast('Overtime ready — tap Start.');
}
function gtOpenPKSetup(gid) {
  var g = gtGame(gid); if (!g) return;
  gtOpenModal('<h3>Penalty Shootout<button class="gm-close" onclick="gtCloseModal()">✕</button></h3>' +
    '<label>Who shoots first?</label><div class="gt-pk-controls" style="margin-top:8px">' +
    '<button class="gt-cbtn gt-cbtn-go" onclick="gtStartPK(\'' + gid + '\',\'us\')">' + gtEsc(gtOurName(g)) + '</button>' +
    '<button class="gt-cbtn gt-cbtn-dark" onclick="gtStartPK(\'' + gid + '\',\'them\')">' + gtEsc(gtTheirName(g)) + '</button></div>');
}
function gtStartPK(gid, first) {
  var g = gtGame(gid); if (!g) return;
  var pe = Object.assign({}, g.period_elapsed || {});
  if (g.status === 'in_progress' || g.status === 'paused') pe[g.current_period || 1] = gtClockSeconds(g);
  gtCloseModal();
  gtGameUpdate(gid, {
    phase: 'pk', pk_first: first, pk_kicks: (g.pk_kicks || []),
    status: 'pk_shootout', period_elapsed: pe, clock_elapsed_seconds: 0, clock_started_at: null
  }).then(function(){ gtRerender(); });
}
function gtPkPanel(g, canEdit) {
  var kicks = gtPkKicks(g), sc = gtPkScore(g);
  var ourName = gtEsc(gtOurName(g)), theirName = gtEsc(gtTheirName(g));
  function markers(team) {
    var ks = kicks.filter(function(k){ return k.team === team; });
    var cells = ks.map(function(k){
      if (k.outcome === 'goal') return '<span class="pk-mk goal" title="Goal"></span>';
      return '<span class="pk-mk miss" title="' + (k.outcome === 'saved' ? 'Saved' : 'Missed') + '">✕</span>';
    }).join('');
    return cells + '<span class="pk-mk empty"></span>';
  }
  function names(team) {
    var ks = kicks.filter(function(k){ return k.team === team; });
    if (!ks.length) return '';
    return '<div class="gt-pk-log">' + ks.map(function(k){
      var nm = k.team === 'us' && k.player_id ? gtEsc(gtPlayerShort(k.player_id)) : (k.team === 'us' ? ourName : theirName);
      var oc = k.outcome === 'goal' ? '✅' : (k.outcome === 'saved' ? '🧤' : '✕');
      return '<span>' + oc + ' ' + nm + '</span>';
    }).join('') + '</div>';
  }
  var html = '<div class="gt-pk">';
  html += '<div class="gt-pk-head">🥅 Penalty Shootout <span class="gt-pk-score">' + sc.us + ' – ' + sc.them + '</span></div>';
  html += '<div class="gt-pk-row"><span class="pk-team">' + ourName + '</span><span class="pk-marks">' + markers('us') + '</span></div>' + names('us');
  html += '<div class="gt-pk-row"><span class="pk-team">' + theirName + '</span><span class="pk-marks">' + markers('them') + '</span></div>' + names('them');
  if (canEdit) {
    html += '<div class="gt-pk-controls" style="margin-top:12px">' +
      '<button class="gt-cbtn gt-cbtn-go" onclick="gtPkOurShot(\'' + g.id + '\')">' + ourName + ' kick</button>' +
      '<button class="gt-cbtn gt-cbtn-dark" onclick="gtPkTheirShot(\'' + g.id + '\')">' + theirName + ' kick</button>' +
      '<button class="gt-minibtn" onclick="gtPkUndo(\'' + g.id + '\')">↩ Undo</button>' +
      '<button class="gt-cbtn gt-cbtn-danger" onclick="gtPkFinish(\'' + g.id + '\')">🏁 End Shootout</button></div>';
    html += '<p class="gt-pk-hint">' + (g.pk_first === 'them' ? theirName : ourName) + ' shoots first.</p>';
  }
  return html + '</div>';
}
function gtPkOurShot(gid) {
  var g = gtGame(gid); if (!gtCanEdit() || !g) return;
  var chips = gtAvailIds(gid).map(function(pid){
    var p = gtP(pid); if (!p) return '';
    return '<button class="gt-pk-pchip" onclick="gtPkPickOutcome(\'' + gid + '\',\'' + pid + '\')">' + (p.jersey_number != null ? '#' + p.jersey_number + ' ' : '') + gtEsc(gtPlayerShort(pid)) + '</button>';
  }).join('');
  gtOpenModal('<h3>Who is taking the kick?<button class="gm-close" onclick="gtCloseModal()">✕</button></h3><div class="gt-pk-pchips">' + chips + '</div>');
}
function gtPkPickOutcome(gid, pid) {
  var nm = gtEsc(gtPlayerShort(pid));
  gtOpenModal('<h3>' + nm + ' — result<button class="gm-close" onclick="gtCloseModal()">✕</button></h3><div class="gt-pk-controls" style="flex-direction:column">' +
    '<button class="gt-cbtn gt-cbtn-go" onclick="gtPkRecord(\'' + gid + '\',\'us\',\'' + pid + '\',\'goal\')">✅ Goal</button>' +
    '<button class="gt-cbtn gt-cbtn-dark" onclick="gtPkRecord(\'' + gid + '\',\'us\',\'' + pid + '\',\'saved\')">🧤 Saved</button>' +
    '<button class="gt-cbtn gt-cbtn-danger" onclick="gtPkRecord(\'' + gid + '\',\'us\',\'' + pid + '\',\'missed\')">✕ Missed</button></div>');
}
function gtPkTheirShot(gid) {
  var g = gtGame(gid); if (!gtCanEdit() || !g) return;
  var nm = gtEsc(gtTheirName(g));
  gtOpenModal('<h3>' + nm + ' kick — result<button class="gm-close" onclick="gtCloseModal()">✕</button></h3><div class="gt-pk-controls" style="flex-direction:column">' +
    '<button class="gt-cbtn gt-cbtn-go" onclick="gtPkRecord(\'' + gid + '\',\'them\',\'\',\'goal\')">⚽ Goal</button>' +
    '<button class="gt-cbtn gt-cbtn-dark" onclick="gtPkRecord(\'' + gid + '\',\'them\',\'\',\'saved\')">🧤 Saved (our keeper)</button>' +
    '<button class="gt-cbtn gt-cbtn-danger" onclick="gtPkRecord(\'' + gid + '\',\'them\',\'\',\'missed\')">✕ Missed</button></div>');
}
function gtPkRecord(gid, team, pid, outcome) {
  var g = gtGame(gid); if (!g) return;
  var kicks = (g.pk_kicks || []).slice();
  kicks.push({ team: team, player_id: pid || null, outcome: outcome, order: kicks.length + 1 });
  gtCloseModal();
  gtGameUpdate(gid, { pk_kicks: kicks }).then(function(){ gtRerender(); });
}
function gtPkUndo(gid) {
  var g = gtGame(gid); if (!g) return;
  var kicks = (g.pk_kicks || []).slice(); if (!kicks.length) return; kicks.pop();
  gtGameUpdate(gid, { pk_kicks: kicks }).then(function(){ gtRerender(); });
}
function gtPkFinish(gid) {
  var g = gtGame(gid); if (!g) return;
  var sc = gtPkScore(g);
  if (sc.us === sc.them) { if (!confirm('Shootout is level ' + sc.us + '–' + sc.them + '. End anyway as a tie?')) return; }
  var winner = sc.us > sc.them ? 'us' : (sc.them > sc.us ? 'them' : null);
  gtGameUpdate(gid, { pk_winner: winner }).then(function(){ gtFinishGame(gid); });
}
function gtLogOpponentCard(gid) {
  var g = gtGame(gid); if (!gtCanEdit() || !g) return;
  gtOpenModal('<h3>' + gtEsc(gtTheirName(g)) + ' card<button class="gm-close" onclick="gtCloseModal()">✕</button></h3><div class="gt-pk-controls" style="flex-direction:column">' +
    '<button class="gt-cbtn gt-cbtn-warn" onclick="gtRecordOppCard(\'' + gid + '\',\'yellow\')">🟨 Yellow Card</button>' +
    '<button class="gt-cbtn gt-cbtn-danger" onclick="gtRecordOppCard(\'' + gid + '\',\'red\')">🟥 Red Card</button></div>');
}
function gtRecordOppCard(gid, kind) {
  var g = gtGame(gid); if (!g) return;
  if (kind === 'yellow') {
    var priorY = gtGameEvents(gid).filter(function(e){ return e.event_type === 'opponent_yellow_card'; }).length;
    if (priorY >= 1 && confirm('Second yellow to the SAME player? (Makes it a red card — man down.)')) {
      gtCloseModal();
      gtAddOppCardEvent(gid, 'opponent_yellow_card', function(){
        gtAddOppCardEvent(gid, 'opponent_red_card', function(){ showToast('Second yellow → Red. ' + gtTheirName(g) + ' a man down.'); });
      });
      return;
    }
    gtCloseModal();
    gtAddOppCardEvent(gid, 'opponent_yellow_card', function(){ showToast('Opponent yellow logged.'); });
  } else {
    gtCloseModal();
    gtAddOppCardEvent(gid, 'opponent_red_card', function(){ showToast(gtTheirName(g) + ' a man down 🟥'); });
  }
}
function gtAddOppCardEvent(gid, type, cb) {
  var g = gtGame(gid); if (!g) return;
  db.collection('gt_events').add({
    game_id: gid, player_id: null, event_type: type,
    game_clock_seconds: gtClockSeconds(g), period: g.current_period || 1,
    notes: '', youtube_url: '', created_at: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(){ if (cb) cb(); }).catch(function(e){ showToast('Error: ' + e.message); });
}
