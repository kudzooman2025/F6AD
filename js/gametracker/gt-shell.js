// ---------- listeners ----------
function gtAttachListeners(defs) {
  defs.forEach(function(def) {
    tdb(def[0]).onSnapshot(function(snap) {
      GT[def[1]] = snap.docs.map(function(d) {
        var o = d.data({ serverTimestamps: 'estimate' }); o.id = d.id; return o;
      });
      GT.loaded[def[1]] = true;
      if (def[1] === 'chat') { if (typeof gtRenderChatMessages === 'function') gtRenderChatMessages(); return; }
      gtRerender();
      if (def[1] === 'games' || def[1] === 'seasons') {
        if (typeof renderSchedule === 'function') renderSchedule();
        if (typeof renderAdminSchedule === 'function' && document.getElementById('admin-schedule-list')) renderAdminSchedule();
      }
      if (def[1] === 'parentEvents') {
        if (typeof renderGtReviewAlert === 'function') renderGtReviewAlert();
      }
      if (def[1] === 'games' || def[1] === 'tournaments') {
        if (typeof renderConfirmedSummer === 'function') renderConfirmedSummer();
      }
    }, function(err) { showToast('GameTracker sync error: ' + err.message); });
  });
}
// Light, site-wide collections — needed by the schedule, tournaments, and nav even for
// casual visitors. These stay small (bounded by roster/#games), so they load globally.
function gtListen() {
  if (GT.listening) return;
  GT.listening = true;
  gtAttachListeners([
    ['gt_rosters', 'rosters'], ['gt_players', 'players'], ['gt_games', 'games'],
    ['gt_tournaments', 'tournaments'], ['gt_seasons', 'seasons']
  ]);
}
// Heavy collections (per-game events, subs, availability, chat, RSVP, parent stats) —
// only attached once someone actually opens the GameTracker area. Big read savings for
// visitors who just check Home/Schedule.
function gtListenHeavy() {
  if (GT.listeningHeavy) return;
  GT.listeningHeavy = true;
  if (typeof gtSyncServerClock === 'function') gtSyncServerClock(true);
  gtAttachListeners([
    ['gt_events', 'events'], ['gt_subs', 'subs'], ['gt_availability', 'avail'],
    ['gt_chat', 'chat'], ['gt_rsvp', 'rsvp'],
    ['gt_parent_events', 'parentEvents'], ['gt_parent_claims', 'parentClaims']
  ]);
}

// ---------- routing ----------
function gtGo(path) { window.location.hash = path; }
var SITE_PAGES = {
  home: ['home-cards', 'announcements', 'home-quicklinks'],
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
function updateSiteNav() {
  if (typeof applySiteFlags === 'function') applySiteFlags();
  var h = window.location.hash || '#/home';
  var isAvail = h.indexOf('#/gametracker/availability') === 0 || h.indexOf('#/gametracker/rsvp') === 0;
  var isProfiles = h.indexOf('#/gametracker/profiles') === 0 || h.indexOf('#/gametracker/player') === 0 || h.indexOf('#/gametracker/card') === 0;
  var isGt = h.indexOf('#/gametracker') === 0 && !isAvail && !isProfiles;
  var page = (typeof sitePage === 'function') ? sitePage() : 'home';
  document.querySelectorAll('nav a.site-link, nav a.nav-gt').forEach(function(a) {
    var href = a.getAttribute('href') || '';
    var active;
    if (a.classList.contains('nav-gt')) active = isGt;
    else if (href.indexOf('#/gametracker/availability') === 0) active = isAvail;
    else if (href.indexOf('#/gametracker/profiles') === 0) active = isProfiles;
    else active = !isGt && !isAvail && !isProfiles && a.getAttribute('data-page') === page;
    a.classList.toggle('nav-active', active);
  });
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
  updateSiteNav();
  if (page === 'conditioning' && typeof attachConditioningListeners === 'function') attachConditioningListeners();
  if (page === 'tournaments' && typeof attachVotesListeners === 'function') attachVotesListeners();
  if (page === 'discussions') {
    if (typeof attachDiscussionsListeners === 'function') attachDiscussionsListeners();
    if (typeof renderDiscussions === 'function') renderDiscussions();
  }
}
function gtRoute() {
  var h = window.location.hash || '';
  var isGT = h.indexOf('#/gametracker') === 0;
  var hero = document.querySelector('.hero');
  var container = document.querySelector('.container');
  var root = document.getElementById('gt-root');
  if (container) container.style.display = isGT ? 'none' : '';
  if (root) root.style.display = isGT ? 'block' : 'none';
  updateSiteNav();
  if (!isGT) {
    if (GT.clockTimer) { clearInterval(GT.clockTimer); GT.clockTimer = null; }
    siteRender();
    window.scrollTo(0, 0);
    return;
  }
  if (hero) hero.style.display = 'none';
  gtListen();
  gtListenHeavy();
  // Outside games are only read on a player's profile and their own screen,
  // so nobody else pays reads for them.
  if (h.indexOf('/player/') > 0 || h.indexOf('/outside') > 0) {
    if (typeof gtExtListen === 'function') gtExtListen();
  }
  var parts = h.replace(/^#\//, '').split('/');
  var page = parts[1] || 'home';
  GT.route = { page: page, arg: parts[2] || null, arg2: parts[3] || null };
  if (page !== 'live' && page !== 'outside' && GT.clockTimer) { clearInterval(GT.clockTimer); GT.clockTimer = null; }
  if (page !== 'review' && GT.filmTimer) { clearInterval(GT.filmTimer); GT.filmTimer = null; if (GT.film) GT.film.on = false; }
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
  else if (page === 'outside') gtRenderOutside(view, GT.route.arg);
  else if (page === 'lineup') gtRenderLineup(view, GT.route.arg, GT.route.arg2);
  else if (page === 'card') gtRenderPlayerCard(view, GT.route.arg);
  else if (page === 'profiles') gtRenderProfiles(view);
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
    gtStatusPill(g) + (gtGameCanceled(g) ? '<span class="gt-status-pill gt-st-canceled">🚫 Canceled</span>' : '') + (g.round ? '<span class="gt-status-pill gt-st-round">' + gtEsc(gtRoundLabel(g.round)) + '</span>' : '') + (g.end_reason ? '<span class="gt-status-pill gt-st-early">⛔ ' + gtEsc(g.end_reason) + '</span>' : '') +
    '<span class="gi-teams">' + gtEsc(gtHomeName(g)) + ' vs ' + gtEsc(gtAwayName(g)) + '</span>' +
    '<span class="gi-score">' + res + (g.home_score || 0) + ' – ' + (g.away_score || 0) + '</span>' +
    '<span class="gi-meta">' + gtFmtDate(g.played_at || g.created_at) + (g.kickoff_time ? ' · ' + gtFmtKickoff(g.kickoff_time) : '') + ' · ' + gtEsc(g.game_type || '') + (g.players_per_side ? ' · ' + g.players_per_side + 'v' + g.players_per_side : '') + (g.venue ? ' · ' + gtEsc(g.venue) : '') + (g.field ? ' · ' + gtEsc(g.field) : '') + '</span>' +
    cta +
    '</div>';
}

// ---------- LANDING ----------
function gtRenderHome(view) {
  var inProgress = GT.games.filter(function(g){ return g.status === 'in_progress' || g.status === 'paused' || g.status === 'between_periods'; })
    .sort(function(a, b){ return gtGameSortMs(a) - gtGameSortMs(b); });
  var upcoming = GT.games.filter(function(g){ return g.status !== 'complete' && g.status !== 'in_progress' && g.status !== 'paused' && g.status !== 'between_periods'; })
    .sort(function(a, b){ return gtGameSortMs(a) - gtGameSortMs(b); });
  var past = GT.games.filter(function(g){ return g.status === 'complete'; })
    .sort(function(a, b){ return gtGameSortMs(b) - gtGameSortMs(a); });
  var html = gtLockBanner() +
    (typeof gtGuestAppsQueueHtml === 'function' ? gtGuestAppsQueueHtml() : '') +
    (typeof gtReviewQueueHtml === 'function' ? gtReviewQueueHtml() : '') +
    '<div class="gt-title">⚽ GameTracker</div>' +
    '<div class="gt-sub">Log live game events, track the clock, and build season stats.</div>';
  if (gtCanEdit()) html += '<button class="btn-primary" style="margin:2px 0 20px" onclick="gtStartSetup()">➕ Create New Game</button>';
  if (inProgress.length) {
    html += '<div class="section-title" style="margin-bottom:14px">🟢 Games In Progress</div><div class="gt-glist" style="margin-bottom:28px">' +
      inProgress.map(gtGameItem).join('') + '</div>';
  }
  if (upcoming.length) {
    var col = GT.upcomingCollapsed;
    html += '<div class="ann-section' + (col ? ' collapsed' : '') + '" id="gt-upcoming-sec" style="margin-bottom:28px">' +
      '<div class="section-header" style="margin-bottom:14px"><div class="section-title" style="margin:0">📅 Upcoming Games (' + upcoming.length + ')</div>' +
      '<button class="home-expand-btn" id="gt-upcoming-toggle" onclick="gtToggleUpcoming()">' + (col ? 'Expand' : 'Collapse') + '</button></div>' +
      '<div class="home-collapse-body"><div class="gt-glist">' + upcoming.map(gtGameItem).join('') + '</div></div></div>';
  }
  if (past.length) {
    var pcol = GT.pastCollapsed;
    html += '<div class="ann-section' + (pcol ? ' collapsed' : '') + '" id="gt-past-sec">' +
      '<div class="section-header" style="margin-bottom:14px"><div class="section-title" style="margin:0">📜 Past Games (' + past.length + ')</div>' +
      '<button class="home-expand-btn" id="gt-past-toggle" onclick="gtTogglePast()">' + (pcol ? 'Expand' : 'Collapse') + '</button></div>' +
      '<div class="home-collapse-body"><div class="gt-glist">' + past.map(gtGameItem).join('') + '</div></div></div>';
  }
  if (!inProgress.length && !upcoming.length && !past.length) {
    html += '<div class="gt-empty">No games scheduled currently, check back.</div>';
  }
  view.innerHTML = html;
}
function gtTogglePast() {
  GT.pastCollapsed = !GT.pastCollapsed;
  var el = document.getElementById('gt-past-sec');
  if (el) el.classList.toggle('collapsed', GT.pastCollapsed);
  var b = document.getElementById('gt-past-toggle');
  if (b) b.textContent = GT.pastCollapsed ? 'Expand' : 'Collapse';
}
function gtToggleUpcoming() {
  GT.upcomingCollapsed = !GT.upcomingCollapsed;
  var el = document.getElementById('gt-upcoming-sec');
  if (el) el.classList.toggle('collapsed', GT.upcomingCollapsed);
  var b = document.getElementById('gt-upcoming-toggle');
  if (b) b.textContent = GT.upcomingCollapsed ? 'Expand' : 'Collapse';
}

