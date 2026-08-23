// ===================== DEPLOYMENT CONFIG =====================
// Everything that differs between one team's site and another's lives here.
// A new team = a copy of this file with new values; no other file should need
// to know which club it is running for.
//
// Loaded FIRST, before 01-core.js, which builds the Firebase app from it.

var APP_CONFIG = {

  // ---- identity -----------------------------------------------------------
  // appName is the PRODUCT. teamName is the squad this deployment belongs to.
  // For F6AD those happen to be the same word; for anyone else they won't be.
  appName:     'F6AD',
  siteTitle:   'FC Montco 2016G Blaze',
  teamName:    'FC Montco 2016G Blaze',
  clubName:    'FC Montco',

  // What the site actually SAYS. shortName is the header/footer wordmark,
  // heroTitle the big line on the home page, tagline the line under it.
  shortName:   'FC Montco',
  heroTitle:   'FC Montco Blaze',
  tagline:     '2016 Girls · 2026–2027',
  domain:      'montco.f6ad.space',
  githubRepo:  'kudzooman2025/F6AD',

  // Bootstrap admins: these addresses get owner rights before any staff record
  // exists, so a brand-new deployment can let its first admin in. Must be the
  // OWNING TEAM's admin, not ours, on any site we don't run.
  ownerEmails: ['kudzooman@gmail.com'],   // + FC Montco's own admin

  // ---- firebase -----------------------------------------------------------
  // One project per team keeps data isolation structural rather than a rule we
  // have to get right. Swapping this block repoints the whole app.
  firebase: {
    apiKey: "AIzaSyAS9DApZhKf78YACE2oXro5xSezIZ4Ppz4",
    authDomain: "f6ad-montco.firebaseapp.com",
    projectId: "f6ad-montco",
    storageBucket: "f6ad-montco.firebasestorage.app",
    messagingSenderId: "1010237177830",
    appId: "1:1010237177830:web:7252c0d35c11ae0b166027"
    // no measurementId — Google Analytics is deliberately off for this team
  },

  // ---- modules ------------------------------------------------------------
  // Turning one off hides its nav entry for this deployment. The top group
  // travels to any team as-is. The bottom group is shaped around FC Delco —
  // a different club would inherit our calendar, venue and roster names, so a
  // new site starts with them off until they are made properly generic.
  modules: {
    gametracker:  true,
    schedule:     true,
    availability: true,
    profiles:     true,
    discussions:  true,

    conditioning: false,
    voting:       false,
    devcards:     false
  },

  // ---- brand --------------------------------------------------------------
  // These drive the CSS custom properties the whole stylesheet is built on, so
  // a team's colours are three values here rather than an edit to styles.css.
  brand: {
    primary:  '#12275C',   // navy
    dark:     '#0B1A40',   // deeper navy
    soft:     '#EAEFF9',   // pale navy tint
    softDark: '#151E33',
    accent:   '#C9A227',   // gold
    // Sunlight/high-contrast mode — navy is already dark, so go deeper still.
    contrast:     '#0B1A40',
    contrastDark: '#060F28'
  },

  // ---- match format -------------------------------------------------------
  // What a NEW game defaults to for this team. A season (or tournament) can
  // override any of it; this is what you get before one is chosen, so a 9v9
  // team never has to correct 11v11 and 35-minute halves on every game.
  game: {
    periods:       2,
    periodMinutes: 30,
    playersPerSide: 9
  },

  // ---- club-specific content ----------------------------------------------
  conditioningVenue: ''
};

// Paint the deployment's colours over the stylesheet defaults. Injected as a
// stylesheet rather than inline styles on :root, because an inline custom
// property would also beat the dark-theme override and strand dark mode on the
// light tint.
function applyAppBrand() {
  var b = APP_CONFIG.brand;
  if (!b) return;
  var css = ':root{' +
    (b.primary ? '--brand:' + b.primary + ';' : '') +
    (b.dark    ? '--brand-dark:' + b.dark + ';' : '') +
    (b.soft    ? '--brand-soft:' + b.soft + ';--accent-soft:' + b.soft + ';' : '') +
    (b.accent  ? '--accent:' + b.accent + ';' : '') + '}' +
    (b.softDark ? 'html[data-theme="dark"]{--brand-soft:' + b.softDark + ';--accent-soft:' + b.softDark + ';}' : '');
  // Sunlight mode hardcodes a deeper purple in styles.css; override it too, or
  // a navy team goes violet the moment someone taps the high-contrast theme.
  var cp = b.contrast || b.primary, cd = b.contrastDark || b.dark;
  if (cp || cd) css += 'html[data-theme="contrast"]{' +
    (cp ? '--brand:' + cp + ';' : '') + (cd ? '--brand-dark:' + cd + ';' : '') + '}';
  var el = document.createElement('style');
  el.id = 'app-brand';
  el.textContent = css;
  document.head.appendChild(el);
  var mc = document.querySelector('meta[name="theme-color"]');
  if (mc && b.primary) mc.setAttribute('content', b.primary);
  if (APP_CONFIG.siteTitle) document.title = APP_CONFIG.siteTitle;
  var at = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (at) at.setAttribute('content', appText('shortName'));
}

// ---- what the site says ---------------------------------------------------
// One resolver so every caller degrades the same way: the specific field, then
// the team, then the product name. Nothing should ever render an empty string.
function appText(key) {
  var c = APP_CONFIG || {};
  return (c[key] || '').trim() || c.teamName || c.appName || '';
}
function appTeamName() { return APP_CONFIG.teamName || APP_CONFIG.appName || ''; }

// Match format for a brand-new game, before a season or tournament overrides it.
function appGameDefaults() {
  var g = (APP_CONFIG && APP_CONFIG.game) || {};
  return {
    num_periods: g.periods || 2,
    period_duration_minutes: g.periodMinutes || 35,
    players_per_side: g.playersPerSide || 11
  };
}

// Paint the deployment's wording over the markup's defaults. The HTML ships
// F6AD's text so the page reads correctly before JS runs; every element that
// names the team carries data-app="<config key>" and gets rewritten here.
function applyAppIdentity() {
  var nodes = document.querySelectorAll('[data-app]');
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i], v = appText(n.getAttribute('data-app'));
    if (v) n.textContent = v; else n.style.display = 'none';
  }
}

// The PWA manifest is a static file, so an installed shortcut would carry the
// wrong team's name. Rebuild it from config and swap the link to a blob.
function applyAppManifest() {
  var link = document.querySelector('link[rel="manifest"]');
  if (!link || typeof Blob === 'undefined' || !window.URL || !URL.createObjectURL) return;
  var name = appText('shortName');
  var m = {
    name: name + ' GameTracker', short_name: name,
    start_url: '/', scope: '/', display: 'standalone', orientation: 'portrait',
    background_color: (APP_CONFIG.brand && APP_CONFIG.brand.dark) || '#0a0a23',
    theme_color: (APP_CONFIG.brand && APP_CONFIG.brand.primary) || '#5A3FD6',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ]
  };
  try {
    link.setAttribute('href', URL.createObjectURL(new Blob([JSON.stringify(m)], { type: 'application/manifest+json' })));
  } catch (e) { /* keep the static manifest */ }
}

applyAppBrand();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function(){ applyAppIdentity(); applyAppManifest(); });
} else { applyAppIdentity(); applyAppManifest(); }

// Is a module switched on for this deployment? Unknown keys default to on, so
// adding a module doesn't silently disable it everywhere.
function appModuleOn(key) {
  return !APP_CONFIG.modules || APP_CONFIG.modules[key] !== false;
}

// ---- tenancy seam ---------------------------------------------------------
// Every Firestore read and write goes through tdb() instead of db.collection().
// Today it is a straight pass-through: one Firebase project per team, so the
// root collections ARE that team's data.
//
// If we ever consolidate teams into a single project, team scoping becomes a
// change to this one function — e.g.
//     return db.collection('teams').doc(APP_CONFIG.teamId).collection(name);
// rather than an edit to 200 call sites, any one of which could be missed and
// leak another team's data.
function tdb(name) { return db.collection(name); }
