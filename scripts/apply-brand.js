// Stamps the deployment's identity into the static HTML head.
//
// applyAppBrand() in 00-config.js fixes the title once the page runs, which is
// fine for a person but useless to a link-preview crawler — iMessage, SMS,
// WhatsApp and Slack read the raw HTML and never execute JS. Without this, a
// Montco game link shared by text previews as "F6AD — U14 Boys 2026".
//
// Runs at deploy time, after 00-config.js has been swapped for the team's copy.
//   node scripts/apply-brand.js [htmlFile]

const fs = require('fs');

const HTML = process.argv[2] || 'soccer-fun-time.html';
const CONFIG = 'js/00-config.js';

// Pull just the APP_CONFIG literal out of the config file. Requiring the whole
// file would run applyAppBrand(), which needs a document.
const src = fs.readFileSync(CONFIG, 'utf8');
const start = src.indexOf('var APP_CONFIG = {');
const end = src.indexOf('\n};\n', start);
if (start < 0 || end < 0) { console.error('apply-brand: could not find APP_CONFIG in ' + CONFIG); process.exit(1); }
const cfg = eval('(' + src.slice(start + 'var APP_CONFIG = '.length, end + 2) + ')');

const pick = (...keys) => { for (const k of keys) if (cfg[k] && String(cfg[k]).trim()) return String(cfg[k]).trim(); return ''; };
const short = pick('shortName', 'teamName', 'appName');
const title = pick('siteTitle', 'teamName', 'appName');
const team  = pick('teamName', 'appName');
const origin = 'https://' + (cfg.domain || 'f6ad.space').replace(/^https?:\/\//, '').replace(/\/$/, '');
const desc = 'Schedule, availability, stats and GameTracker for ' + team + '.';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

let html = fs.readFileSync(HTML, 'utf8');
const before = html;

const set = (pattern, replacement) => { html = html.replace(pattern, replacement); };

set(/<title>[^<]*<\/title>/i, '<title>' + esc(title) + '</title>');
set(/(<meta name="apple-mobile-web-app-title" content=")[^"]*(")/i, '$1' + esc(short) + '$2');
set(/(<meta name="description" content=")[^"]*(")/i, '$1' + esc(desc) + '$2');
set(/(<meta property="og:site_name" content=")[^"]*(")/i, '$1' + esc(short) + '$2');
set(/(<meta property="og:title" content=")[^"]*(")/i, '$1' + esc(title) + '$2');
set(/(<meta property="og:description" content=")[^"]*(")/i, '$1' + esc(desc) + '$2');
set(/(<meta property="og:url" content=")[^"]*(")/i, '$1' + esc(origin + '/') + '$2');
set(/(<meta property="og:image" content=")[^"]*(")/i, '$1' + esc(origin + '/icon-512.png') + '$2');
set(/(<meta name="twitter:title" content=")[^"]*(")/i, '$1' + esc(title) + '$2');
set(/(<meta name="twitter:description" content=")[^"]*(")/i, '$1' + esc(desc) + '$2');
if (cfg.brand && cfg.brand.primary) {
  set(/(<meta name="theme-color" content=")[^"]*(")/i, '$1' + esc(cfg.brand.primary) + '$2');
}

if (html === before) { console.log('apply-brand: nothing changed (already stamped?)'); }
else { fs.writeFileSync(HTML, html); }
console.log('apply-brand: ' + HTML + ' stamped for "' + title + '" (' + origin + ')');
