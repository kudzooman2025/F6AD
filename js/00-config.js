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
  siteTitle:   'F6AD — U14 Boys 2026',
  teamName:    'F6AD',
  clubName:    'FC Delco',
  domain:      'f6ad.space',
  githubRepo:  'kudzooman2025/F6AD',

  // Bootstrap admins: these addresses get owner rights before any staff record
  // exists, so a brand-new deployment can let its first admin in. Must be the
  // OWNING TEAM's admin, not ours, on any site we don't run.
  ownerEmails: ['kudzooman@gmail.com', 'kudzooman@proton.me'],

  // ---- firebase -----------------------------------------------------------
  // One project per team keeps data isolation structural rather than a rule we
  // have to get right. Swapping this block repoints the whole app.
  firebase: {
    apiKey: "AIzaSyBrvvXKGZwKX1VOU-C6WZvB98r1KO9I5HI",
    authDomain: "f6ad-2913b.firebaseapp.com",
    projectId: "f6ad-2913b",
    storageBucket: "f6ad-2913b.firebasestorage.app",
    messagingSenderId: "1000483275960",
    appId: "1:1000483275960:web:f9f9974965854a5cbfa04d",
    measurementId: "G-B9H05C9HYM"
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

    conditioning: true,
    voting:       true,
    devcards:     true
  },

  // ---- brand --------------------------------------------------------------
  // These drive the CSS custom properties the whole stylesheet is built on, so
  // a team's colours are three values here rather than an edit to styles.css.
  brand: {
    primary:  '#5A3FD6',   // links, buttons, headings, the logo mark
    dark:     '#4831A8',   // hover / pressed
    soft:     '#F1EEFF',   // tinted panels and badges (light theme)
    softDark: '#241D3F',   // the same tint on the dark theme
    accent:   ''           // optional second colour; blank = use primary
  },

  // ---- club-specific content ----------------------------------------------
  conditioningVenue: 'Germantown Academy'
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
    (b.soft    ? '--brand-soft:' + b.soft + ';--accent-soft:' + b.soft + ';' : '') + '}' +
    (b.softDark ? 'html[data-theme="dark"]{--brand-soft:' + b.softDark + ';--accent-soft:' + b.softDark + ';}' : '');
  var el = document.createElement('style');
  el.id = 'app-brand';
  el.textContent = css;
  document.head.appendChild(el);
  var mc = document.querySelector('meta[name="theme-color"]');
  if (mc && b.primary) mc.setAttribute('content', b.primary);
  if (APP_CONFIG.siteTitle) document.title = APP_CONFIG.siteTitle;
}
applyAppBrand();

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
