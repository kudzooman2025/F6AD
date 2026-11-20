const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function classes(...initial) {
  const values = new Set(initial);
  return {
    add: (...names) => names.forEach(name => values.add(name)),
    remove: (...names) => names.forEach(name => values.delete(name)),
    contains: name => values.has(name)
  };
}

function modalContext() {
  const body = {
    classList: classes('existing-page-class'),
    style: { top: '2px', left: '3px', paddingRight: '7px', color: 'navy' },
    removeChild: child => { child.parentNode = null; }
  };
  const overlay = { classList: classes(), scrollTop: 90 };
  const modal = { classList: classes(), scrollTop: 140, innerHTML: '' };
  const suggestion = { parentNode: body };
  const elements = { 'gt-modal-overlay': overlay, 'gt-modal': modal, 'gt-pf-sug': suggestion };
  const scrolls = [];
  const window = {
    scrollX: 18, scrollY: 1280, innerWidth: 1000,
    location: { hash: '#/home' },
    getComputedStyle: () => ({ paddingRight: '11px' }),
    scrollTo: (x, y) => { scrolls.push([x, y]); window.scrollX = x; window.scrollY = y; }
  };
  const context = vm.createContext({
    GT: { massSel: null, pendingEvent: null }, window,
    document: { body, documentElement: { clientWidth: 985 }, getElementById: id => elements[id] || null, querySelector: () => null }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/gametracker/gt-shell.js'), 'utf8'), context);
  return { context, body, overlay, modal, suggestion, scrolls, window };
}

test('opening a game popup preserves the scrolled page and starts the form at the top', () => {
  const { context, body, overlay, modal, scrolls } = modalContext();
  context.gtOpenModal('<h3>Player stats</h3>');
  assert.equal(body.classList.contains('gt-modal-open'), true);
  assert.equal(body.classList.contains('existing-page-class'), true);
  assert.equal(body.style.top, '-1280px');
  assert.equal(body.style.left, '-18px');
  assert.equal(body.style.paddingRight, '26px', 'Scrollbar space should add to computed page padding');
  assert.equal(body.style.color, 'navy');
  assert.equal(overlay.classList.contains('open'), true);
  assert.equal(overlay.scrollTop, 0);
  assert.equal(modal.scrollTop, 0);
  assert.equal(modal.innerHTML, '<h3>Player stats</h3>');
  assert.deepEqual(scrolls, [], 'Opening should not navigate the underlying page');
});

test('replacing a scrolled popup resets its form while retaining the original page position', () => {
  const { context, body, overlay, modal, window, scrolls } = modalContext();
  context.gtOpenModal('<h3>Mass Subs</h3>');
  overlay.classList.add('gt-ms-open');
  modal.classList.add('gt-ms-full');
  overlay.scrollTop = 210; modal.scrollTop = 300;
  // Fixed-body locking may make window scroll coordinates read zero.
  window.scrollX = 0; window.scrollY = 0;
  context.gtOpenModal('<h3>Player stats</h3>');
  assert.equal(overlay.scrollTop, 0);
  assert.equal(modal.scrollTop, 0);
  assert.equal(overlay.classList.contains('gt-ms-open'), false);
  assert.equal(modal.classList.contains('gt-ms-full'), false);
  assert.equal(body.style.top, '-1280px');
  assert.equal(body.style.left, '-18px');
  assert.equal(body.style.paddingRight, '26px', 'Replacing a popup must not accumulate scrollbar padding');
  context.gtCloseModal();
  assert.deepEqual(scrolls, [[18, 1280]], 'Closing returns to the position before the first popup');
});

test('closing a popup restores inline styles and clears Mass Subs and pending stat data', () => {
  const { context, body, overlay, modal, suggestion, scrolls } = modalContext();
  const originalStyle = { ...body.style };
  context.gtOpenModal('<h3>Mass Subs</h3>');
  overlay.classList.add('gt-ms-open'); modal.classList.add('gt-ms-full');
  context.GT.massSel = { gid: 'game', on: ['one'], off: ['two'] };
  context.GT.pendingEvent = { gameId: 'game', type: 'goal' };
  context.gtCloseModal();
  assert.deepEqual(body.style, originalStyle);
  assert.equal(body.classList.contains('gt-modal-open'), false);
  assert.equal(body.classList.contains('existing-page-class'), true);
  assert.equal(overlay.classList.contains('open'), false);
  assert.equal(overlay.classList.contains('gt-ms-open'), false);
  assert.equal(modal.classList.contains('gt-ms-full'), false);
  assert.equal(modal.innerHTML, '');
  assert.equal(context.GT.massSel, null);
  assert.equal(context.GT.pendingEvent, null);
  assert.equal(suggestion.parentNode, null);
  assert.deepEqual(scrolls, [[18, 1280]]);
});

test('closing twice does not move the page again and a later popup captures its new position', () => {
  const { context, body, window, scrolls } = modalContext();
  context.gtOpenModal('First');
  context.gtCloseModal();
  window.scrollX = 0; window.scrollY = 600;
  context.gtCloseModal();
  assert.deepEqual(scrolls, [[18, 1280]]);
  assert.equal(window.scrollY, 600);
  window.innerWidth = 985; // Touch browsers can have no scrollbar gutter.
  context.gtOpenModal('Second');
  assert.equal(body.style.top, '-600px');
  assert.equal(body.style.paddingRight, '7px');
  context.gtCloseModal();
  assert.deepEqual(scrolls, [[18, 1280], [0, 600]]);
});

test('leaving GameTracker closes the popup and releases the page before routing', () => {
  const { context, body, overlay, scrolls } = modalContext();
  let rendered = false;
  context.updateSiteNav = () => {};
  context.siteRender = () => { rendered = true; assert.equal(body.classList.contains('gt-modal-open'), false); };
  context.gtOpenModal('Player stats');
  context.gtRoute();
  assert.equal(rendered, true);
  assert.equal(overlay.classList.contains('open'), false);
  assert.deepEqual(scrolls, [[18, 1280], [0, 0]]);
});
