// ---------- listeners ----------
function gtListen() {
  if (GT.listening) return;
  GT.listening = true;
  var defs = [
    ['gt_rosters', 'rosters'], ['gt_players', 'players'], ['gt_games', 'games'],
    ['gt_events', 'events'], ['gt_subs', 'subs'], ['gt_availability', 'avail'],
    ['gt_tournaments', 'tournaments'], ['gt_seasons', 'seasons'], ['gt_chat', 'chat'], ['gt_rsvp', 'rsvp']
  ];
  defs.forEach(function(def) {
    db.collection(def[0]).onSnapshot(function(snap) {
      GT[def[1]] = snap.docs.map(function(d) {
        var o = d.data({ serverTimestamps: 'estimate' }); o.id = d.id; return o;
      });
      GT.loaded[def[1]] = true;
      if (def[1] === 'chat') { if (typeof gtRenderChatMessages === 'function') gtRenderChatMessages(); return; }
      gtRerender();
      if (def[1] === 'games') {
        if (typeof renderSchedule === 'function') renderSchedule();
        if (typeof renderAdminSchedule === 'function' && document.getElementById('admin-schedule-list')) renderAdminSchedule();
      }
      if (def[1] === 'games' || def[1] === 'tournaments') {
        if (typeof renderConfirmedSummer === 'function') renderConfirmedSummer();
      }
    }, function(err) { showToast('GameTracker sync error: ' + err.message); });
  });
}

// ---------- routing ----------
function gtGo(path) { window.location.hash = path; }
var SITE_PAGES = {
  home: ['home-cards', 'announcements'],
  schedule: ['schedule'],
  conditioning: ['conditioning', 'summer-overview'],
  tournaments: ['confirmed-summer', 'tournaments'],
  discussions: ['discussions']
};
var SITE_LEGACY = { announcements: 'home', news: 'home', schedule: 'schedule', conditioning: 'conditioning', tournaments: 'tournaments' };
function sitePage() {
  var h = window.location.hash || '';
  if (h.indexOf('#/') === 0) {
    var p = h.slice(2).split('/')[0];
    return SITE_PAGES[p] ? p : 'home';
  }
  return SITE_LEGACY[h.replace('#', '')] || 'home';
}
function siteRender() {
  var page = sitePage();
  var hero = document.querySelector('.hero');
  if (hero) hero.style.display = page === 'home' ? '' : 'none';
  Object.keys(SITE_PAGES).forEach(function(p) {
    SITE_PAGES[p].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = SITE_PAGES[page].indexOf(id) >= 0 ? '' : 'none';
    });
  });
  document.querySelectorAll('nav a.site-link').forEach(function(a) {
    a.classList.toggle('nav-active', a.getAttribute('data-page') === page);
  });
  if (page === 'discussions' && typeof renderDiscussions === 'function') renderDiscussions();
}
function gtRoute() {
  var h = window.location.hash || '';
  var isGT = h.indexOf('#/gametracker') === 0;
  var hero = document.querySelector('.hero');
  var container = document.querySelector('.container');
  var root = document.getElementById('gt-root');
  if (container) container.style.display = isGT ? 'none' : '';
  if (root) root.style.display = isGT ? 'block' : 'none';
  if (!isGT) {
    if (GT.clockTimer) { clearInterval(GT.clockTimer); GT.clockTimer = null; }
    siteRender();
    window.scrollTo(0, 0);
    return;
  }
  if (hero) hero.style.display = 'none';
  gtListen();
  var parts = h.replace(/^#\//, '').split('/');
  var page = parts[1] || 'home';
  GT.route = { page: page, arg: parts[2] || null };
  if (page !== 'live' && GT.clockTimer) { clearInterval(GT.clockTimer); GT.clockTimer = null; }
  window.scrollTo(0, 0);
  gtRenderNav();
  gtRerender(true);
}
function gtRerender(force) {
  var root = document.getElementById('gt-root');
  if (!root || root.style.display === 'none') return;
  var page = GT.route.page;
  if (page === 'new' && !force) return; // don't clobber the setup form on data sync
  gtRenderNav();
  var view = document.getElementById('gt-view');
  if (!view) return;
  if (page === 'home') gtRenderHome(view);
  else if (page === 'new') gtRenderNew(view);
  else if (page === 'live') gtRenderLive(view, GT.route.arg);
  else if (page === 'review') gtRenderReview(view, GT.route.arg);
  else if (page === 'season') gtRenderSeason(view);
  else if (page === 'tournaments') gtRenderTournaments(view);
  else if (page === 'tournament') gtRenderTournament(view, GT.route.arg);
  else if (page === 'seasons') { if (GT.route.arg) gtRenderSeasonEntity(view, GT.route.arg); else gtRenderSeasons(view); }
  else if (page === 'availability') gtRenderAvailability(view);
  else if (page === 'rsvp') gtRenderRsvp(view, GT.route.arg);
  else if (page === 'roster') gtRenderRoster(view);
  else if (page === 'player') gtRenderPlayerProfile(view, GT.route.arg);
  else gtRenderHome(view);
}
function gtRenderNav() {
  var nav = document.getElementById('gt-topnav');
  if (!nav) return;
  var page = GT.route.page;
  var items = [
    ['home', '#/gametracker', '⚽ GameTracker'],
    ['availability', '#/gametracker/availability', '📋 Availability'],
    ['season', '#/gametracker/season', '📊 Season Stats'],
    ['tournaments', '#/gametracker/tournaments', '🏆 Tournaments'],
    ['seasons', '#/gametracker/seasons', '📅 Seasons'],
    ['roster', '#/gametracker/roster', '👥 Roster'],
    ['site', '#/home', '🏠 Team Site']
  ];
  nav.innerHTML = items.map(function(it) {
    var active = (it[0] === page) || (it[0] === 'home' && ['live', 'review', 'new'].indexOf(page) >= 0) || (it[0] === 'tournaments' && page === 'tournament') || (it[0] === 'availability' && page === 'rsvp');
    return '<a href="' + it[1] + '" class="' + (active && it[0] !== 'site' ? 'active' : '') + '">' + it[2] + '</a>';
  }).join('');
}

// ---------- coach lock ----------
function gtLockBanner() {
  if (gtCanEdit()) return '';
  if (authUser) {
    return '<div class="gt-lock"><span>🔒 <strong>View-only.</strong> Signed in as ' + gtEsc(authUser.email) + ' — this account has no staff access. Ask the team owner to add you.</span>' +
      '<button onclick="authSignOut()">Sign Out</button></div>';
  }
  return '<div class="gt-lock"><span>🔑 <strong>View-only.</strong> Staff sign-in:</span>' +
    '<input type="text" id="gt-email" placeholder="Email" style="width:180px"/>' +
    '<input type="password" id="gt-pin" placeholder="Password" style="width:120px" onkeydown="if(event.key===\'Enter\')gtCoachLogin()"/>' +
    '<button onclick="gtCoachLogin()">Sign In</button></div>';
}
function gtCoachLogin() {
  authSignIn(
    (document.getElementById('gt-email') || { value: '' }).value.trim(),
    (document.getElementById('gt-pin') || { value: '' }).value
  );
}

// ---------- modal ----------
function gtOpenModal(html) {
  document.getElementById('gt-modal').innerHTML = html;
  document.getElementById('gt-modal-overlay').classList.add('open');
}
function gtCloseModal() {
  var sug = document.getElementById('gt-pf-sug');
  if (sug && sug.parentNode === document.body) document.body.removeChild(sug);
  document.getElementById('gt-modal-overlay').classList.remove('open');
  document.getElementById('gt-modal').innerHTML = '';
  GT.pendingEvent = null;
}

// ---------- status pill ----------
function gtStatusPill(g) {
  var map = {
    setup: ['gt-st-setup', 'Ready'], in_progress: ['gt-st-live', '● Live'],
    paused: ['gt-st-paused', 'Paused'], between_periods: ['gt-st-paused', 'Break'],
    pk_shootout: ['gt-st-live', '● PKs'],
    complete: ['gt-st-complete', 'Full Time']
  };
  var m = map[g.status] || map.setup;
  return '<span class="gt-status-pill ' + m[0] + '">' + m[1] + '</span>';
}
function gtGameItem(g) {
  var inProgress = g.status !== 'complete';
  var target = (inProgress && g.status !== 'complete') ? '#/gametracker/live/' + g.id : '#/gametracker/review/' + g.id;
  if (g.status === 'complete') target = '#/gametracker/review/' + g.id;
  var res = g.status === 'complete' ? '<span class="gt-result-' + gtResult(g).toLowerCase() + '">' + gtResult(g) + '</span> ' : '';
  var completed = g.status === 'complete';
  var nPlayed = (completed && typeof gtWhoPlayedIds === 'function') ? gtWhoPlayedIds(g.id).length : 0;
  var nStart = (completed && typeof gtStarters === 'function') ? gtStarters(g.id).length : 0;
  var cta = completed
    ? '<span class="gi-cta">📊 View stats &amp; roster' + (nPlayed ? ' · 👥 ' + nPlayed + ' played' : '') + (nStart ? ' · ⭐ ' + nStart + ' XI' : '') + ' →</span>'
    : '';
  return '<div class="gt-gitem' + (gtGameCanceled(g) ? ' canceled' : '') + (completed ? ' done' : '') + '" onclick="gtGo(\'' + target.slice(1) + '\')">' +
    gtStatusPill(g) + (gtGameCanceled(g) ? '<span class="gt-status-pill gt-st-canceled">🚫 Canceled</span>' : '') + (g.round ? '<span class="gt-status-pill gt-st-round">' + gtEsc(gtRoundLabel(g.round)) + '</span>' : '') +
    '<span class="gi-teams">' + gtEsc(gtHomeName(g)) + ' vs ' + gtEsc(gtAwayName(g)) + '</span>' +
    '<span class="gi-score">' + res + (g.home_score || 0) + ' – ' + (g.away_score || 0) + '</span>' +
    '<span class="gi-meta">' + gtFmtDate(g.played_at || g.created_at) + (g.kickoff_time ? ' · ' + gtFmtKickoff(g.kickoff_time) : '') + ' · ' + gtEsc(g.game_type || '') + (g.players_per_side ? ' · ' + g.players_per_side + 'v' + g.players_per_side : '') + (g.venue ? ' · ' + gtEsc(g.venue) : '') + (g.field ? ' · ' + gtEsc(g.field) : '') + '</span>' +
    cta +
    '</div>';
}

// ---------- LANDING ----------
function gtRenderHome(view) {
  var live = GT.games.filter(function(g){ return g.status !== 'complete'; })
    .sort(function(a, b){ return gtGameSortMs(a) - gtGameSortMs(b); });
  var past = GT.games.filter(function(g){ return g.status === 'complete'; })
    .sort(function(a, b){ return gtGameSortMs(b) - gtGameSortMs(a); });
  var html = gtLockBanner() +
    '<div class="gt-title">⚽ GameTracker</div>' +
    '<div class="gt-sub">Log live game events, track the clock, and build season stats.</div>' +
    '<div class="gt-bigbtns">' +
    (gtCanEdit() ? '<button class="gt-bigbtn" onclick="gtStartSetup()"><span class="bb-icon">➕</span><span class="bb-label">Create New Game</span><span class="bb-desc">Set up teams, format &amp; roster</span></button>' : '') +
    '<button class="gt-bigbtn" onclick="gtGo(\'/gametracker/season\')"><span class="bb-icon">📊</span><span class="bb-label">Season Stats</span><span class="bb-desc">Game log &amp; player leaderboard</span></button>' +
    '<button class="gt-bigbtn" onclick="gtGo(\'/gametracker/tournaments\')"><span class="bb-icon">🏆</span><span class="bb-label">Tournaments</span><span class="bb-desc">Rosters, availability &amp; fees</span></button>' +
    '<button class="gt-bigbtn" onclick="gtGo(\'/gametracker/seasons\')"><span class="bb-icon">📅</span><span class="bb-label">Seasons</span><span class="bb-desc">Group league games &amp; track record</span></button>' +
    '<button class="gt-bigbtn" onclick="gtGo(\'/gametracker/roster\')"><span class="bb-icon">👥</span><span class="bb-label">Roster Manager</span><span class="bb-desc">Players, parents &amp; contact info</span></button>' +
    '</div>';
  if (live.length) {
    html += '<div class="section-title" style="margin-bottom:14px">🟢 Games In Progress</div><div class="gt-glist" style="margin-bottom:28px">' +
      live.map(gtGameItem).join('') + '</div>';
  }
  html += '<div class="section-title" style="margin-bottom:14px">📜 Past Games</div>';
  html += past.length ? '<div class="gt-glist">' + past.map(gtGameItem).join('') + '</div>'
    : '<div class="gt-empty">No completed games yet.' + (gtCanEdit() ? ' Create your first game above!' : '') + '</div>';
  view.innerHTML = html;
}

