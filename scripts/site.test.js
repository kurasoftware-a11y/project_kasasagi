const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/site.js'), 'utf8');

function fixture({ reduced = false, unsupported = false, failing = false, hash = '#discography' } = {}) {
  const windowEvents = new Map();
  const documentEvents = new Map();
  const observers = [];
  const preferences = { matches: reduced, addEventListener: (_, handler) => { preferences.change = handler; } };
  const nodes = [100, 1000, 1600].map(top => ({
    dataset: {}, top,
    getBoundingClientRect() { return { top: this.top }; },
    contains() { return false; }
  }));
  const links = [new URL('https://example.com/'), new URL('https://example.com/en/')];
  const location = { hash };
  const document = {
    activeElement: {},
    querySelectorAll: selector => selector === '[data-language-link]' ? links : nodes,
    getElementById: id => ['discography', 'track-4'].includes(id) ? {} : null,
    addEventListener: (event, handler) => documentEvents.set(event, handler)
  };
  class Observer {
    constructor(callback) { this.callback = callback; this.observed = new Set(); observers.push(this); }
    observe(node) {
      if (failing && this.observed.size) throw new Error('Observer registration failed');
      this.observed.add(node);
    }
    unobserve(node) { this.observed.delete(node); }
    disconnect() { this.observed.clear(); }
  }
  const window = {
    innerHeight: 800,
    matchMedia: () => preferences,
    addEventListener: (event, handler) => windowEvents.set(event, handler),
    ...(!unsupported ? { IntersectionObserver: Observer } : {})
  };
  vm.runInNewContext(source, { window, document, location, IntersectionObserver: Observer });
  return { nodes, links, location, preferences, observers, windowEvents, documentEvents };
}

test('language links preserve only valid section fragments, including updates', () => {
  const f = fixture();
  assert.ok(f.links.every(link => link.hash === '#discography'));
  f.location.hash = '#track-4';
  f.windowEvents.get('hashchange')();
  assert.ok(f.links.every(link => link.hash === '#track-4'));
  for (const hash of ['#unknown', '#%invalid', '']) {
    f.location.hash = hash;
    f.windowEvents.get('hashchange')();
    assert.ok(f.links.every(link => !link.hash));
  }
});

test('unsupported observers leave content visible and language links functional', () => {
  const f = fixture({ unsupported: true });
  assert.equal(f.observers.length, 0);
  assert.ok(f.nodes.every(node => !node.dataset.revealState));
  assert.ok(f.links.every(link => link.hash === '#discography'));
});

test('only content below the viewport waits; it reveals once on entry', () => {
  const f = fixture();
  const observer = f.observers[0];
  assert.equal(f.nodes[0].dataset.revealState, 'visible');
  assert.equal(f.nodes[1].dataset.revealState, 'waiting');
  observer.callback([{ target: f.nodes[1], isIntersecting: true }]);
  assert.equal(f.nodes[1].dataset.revealState, 'visible');
  assert.ok(!observer.observed.has(f.nodes[1]));
});

test('reduced motion is respected initially and when changed live', () => {
  const f = fixture({ reduced: true });
  assert.equal(f.observers.length, 0);
  assert.ok(f.nodes.every(node => !node.dataset.revealState));
  f.preferences.matches = false;
  f.preferences.change();
  assert.equal(f.nodes[1].dataset.revealState, 'waiting');
  const oldObserver = f.observers[0];
  f.preferences.matches = true;
  f.preferences.change();
  oldObserver.callback([{ target: f.nodes[1], isIntersecting: true }]);
  assert.ok(f.nodes.every(node => !node.dataset.revealState));
  assert.equal(oldObserver.observed.size, 0);
});

test('keyboard focus makes a waiting card permanently readable', () => {
  const f = fixture();
  f.documentEvents.get('focusin')({ target: { closest: () => f.nodes[1] } });
  assert.equal(f.nodes[1].dataset.revealState, 'visible');
  assert.ok(!f.observers[0].observed.has(f.nodes[1]));
});

test('restored scroll positions remain readable on back/forward navigation', () => {
  const f = fixture();
  f.nodes[1].top = 100;
  f.windowEvents.get('pageshow')();
  assert.equal(f.nodes[1].dataset.revealState, 'visible');
  assert.equal(f.nodes[2].dataset.revealState, 'waiting');
});

test('observer failure restores every element instead of leaving hidden content', () => {
  const f = fixture({ failing: true });
  assert.ok(f.nodes.every(node => !node.dataset.revealState));
  assert.equal(f.observers[0].observed.size, 0);
});
