/* ============================================================
   WD-1076 smoke test
   ------------------------------------------------------------
   Renders all three solutions in jsdom against the current
   data.js and asserts that course identity holds: unique slugs,
   unique ids, every year keeping all its induction modules, and
   every year button resolving to a real course code.

   Requires jsdom (not a runtime dependency of the app):
     npm install jsdom
     node scripts/smoke-test.js
   Exits non-zero if any check fails.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
function check(name, cond, detail) {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

// ── Data-level assertions ────────────────────────────────────────────────
const raw = fs.readFileSync(path.join(ROOT, 'solution1/data.js'), 'utf8');
const data = JSON.parse(raw.slice('window.__COURSES_DATA__ = '.length, -1));

console.log('\n── data.js ──');
const slugs = data.map(c => c.slug);
check('every course has a slug', slugs.every(Boolean));
check('every course has an id', data.every(c => c.id));
check('slugs are unique', new Set(slugs).size === slugs.length,
  `${slugs.length} courses, ${new Set(slugs).size} distinct slugs`);
check('ids are unique', new Set(data.map(c => c.id)).size === data.length);
check('every year exposes mod_codes[]',
  data.every(c => Object.values(c.years).every(y => Array.isArray(y.mod_codes) && y.mod_codes.length)));
check('mod_code still present for older renderers',
  data.every(c => Object.values(c.years).every(y => typeof y.mod_code === 'string')));
check('no event id repeats within a course-year',
  data.every(c => Object.values(c.years).every(y => {
    const ids = y.events.map(e => e.event_id);
    return new Set(ids).size === ids.length;
  })));

// ── TECH-610: an induction is always an "I" module code ──────────────────
const allModCodes = new Set();
data.forEach(c => Object.values(c.years).forEach(y => {
  (y.mod_codes || []).forEach(m => allModCodes.add(m));
  allModCodes.add(y.mod_code);
  y.events.forEach(e => allModCodes.add(e.mod_code));
}));
const nonInduction = [...allModCodes].filter(m => /^m/i.test(String(m)));
check('no non-induction "M" module code reaches the data', nonInduction.length === 0,
  nonInduction.slice(0, 8).join(', ') || `${allModCodes.size} codes, all "I"`);

// ── TECH-609: a room ending in a zero keeps it ───────────────────────────
// "3.30" is stored in the spreadsheet as the number 3.3, so a room rendered
// with a single decimal place is the signature of the zero having been lost.
const singleDp = new Set();
let roomCount = 0;
data.forEach(c => Object.values(c.years).forEach(y => y.events.forEach(e => {
  (e.locations || []).forEach(l => {
    if (!l.room) return;
    roomCount++;
    if (/^\d+\.\d$/.test(l.room)) singleDp.add(l.room);
  });
})));
check('no room number has lost a trailing zero', singleDp.size === 0,
  [...singleDp].join(', ') || `${roomCount} room references checked`);

// Every course code from Ben's report must be individually addressable.
const reported = ['U2437PYC','U2371FTC','U3275FTC','U3802PDC','U2896PDC','U1826PYC',
  'U3248PYC','U3518PYC','N3518FTC','P3211FTC','P0620FTC','P0620PTC','P0054FTC',
  'P0054PTC','P2921PDC','P3074FTC'];
const byId = Object.fromEntries(data.map(c => [c.id, c]));
check('all 16 reported course codes present', reported.every(c => byId[c]),
  reported.filter(c => !byId[c]).join(', ') || 'none missing');
check('all 16 reported courses have distinct slugs',
  new Set(reported.map(c => byId[c] && byId[c].slug)).size === reported.length);

// ── Renderer assertions ──────────────────────────────────────────────────
function boot(dir, entry, extraScripts = [], page = 'index.html') {
  const html = fs.readFileSync(path.join(ROOT, dir, page), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.org/' });
  const { window } = dom;
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }));
  for (const f of [...extraScripts, 'data.js', entry]) {
    const p = path.join(ROOT, dir, f);
    if (fs.existsSync(p)) window.eval(fs.readFileSync(p, 'utf8'));
  }
  // Solutions that defer boot to DOMContentLoaded never see it under
  // runScripts:'outside-only', so fire it by hand.
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return window;
}

function testSolution(label, dir, entry, cardSel, extras, page) {
  console.log(`\n── ${label} ──`);
  let window;
  try {
    window = boot(dir, entry, extras, page);
  } catch (e) {
    check('boots without throwing', false, e.message);
    return;
  }
  check('boots without throwing', true);
  const doc = window.document;
  const cards = doc.querySelectorAll(cardSel);
  check('renders course cards', cards.length > 0, `${cards.length} cards`);

  const yearBtns = doc.querySelectorAll('[data-course-id]');
  check('year buttons carry data-course-id', yearBtns.length > 0, `${yearBtns.length} buttons`);
  check('no stale name-keyed data-course attributes',
    doc.querySelectorAll('[data-course]').length === 0);

  // Every data-course-id must resolve to a real course code.
  const ids = new Set([...yearBtns].map(b => b.dataset.courseId));
  const known = new Set(data.map(c => c.id));
  check('every data-course-id resolves to a course code',
    [...ids].every(i => known.has(i)),
    [...ids].filter(i => !known.has(i)).slice(0, 3).join(', ') || 'all resolve');

  return window;
}

const w1 = testSolution('solution1', 'solution1', 'app.js', '.course-card', ['analytics.js', 'external-links.js']);
const w3 = testSolution('solution3', 'solution3', 'app.js', '.course-card', ['external-links.js']);
testSolution('solution2 (widget)', 'solution2', 'induction-widget.js',
  '.uop-ind__course-item', [], 'demo-search-page.html');

// Deep-link routing on solution1: the previously-hidden course must open.
if (w1) {
  console.log('\n── solution1 deep links (WD-1076) ──');
  const cases = [
    ['bsc-hons-psychological-sciences', 'N3518FTC'],
    ['bsc-hons-psychological-sciences-u3518pyc', 'U3518PYC'],
    ['msc-information-systems', 'P0054FTC'],
    ['msc-information-systems-p0054ptc', 'P0054PTC'],
  ];
  for (const [slug, expected] of cases) {
    const c = data.find(x => x.slug === slug);
    check(`#detail/${slug} → ${expected}`, c && c.id === expected,
      c ? c.id : 'no course with that slug');
  }
}

// ── TECH-611: links off this site open in a new tab ─────────────────────
// The site prefix baked into external-links.js, plus the origin the page is
// served from, are "this site"; everything else must open in a new tab and
// say so. The test URL above is example.org, so relative links stay internal
// and the myport.port.ac.uk links in the markup count as external.
function checkExternalLinks(label, window) {
  if (!window) return;
  console.log(`\n── ${label} external links (TECH-611) ──`);
  const doc = window.document;
  const prefixes = ['https://university-of-portsmouth-web-team.github.io/', 'https://example.org/'];

  let external = 0, internal = 0, bad = [];
  for (const a of doc.querySelectorAll('a[href]')) {
    const raw = a.getAttribute('href') || '';
    if (!raw || raw.charAt(0) === '#') { internal++; continue; }
    let url;
    try { url = new window.URL(raw, doc.baseURI).href; } catch (e) { continue; }
    if (!/^https?:\/\//i.test(url)) continue;   // mailto:, tel:

    const name = (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 32) || raw;
    if (prefixes.some(p => url.indexOf(p) === 0)) {
      internal++;
      if (a.getAttribute('target') === '_blank') bad.push(`internal "${name}" opens a new tab`);
    } else {
      external++;
      const warns = /opens in a new (tab|window)/i.test(
        (a.getAttribute('aria-label') || '') + ' ' + (a.textContent || ''));
      if (a.getAttribute('target') !== '_blank') bad.push(`external "${name}" stays in the tab`);
      if (!/noopener/.test((a.getAttribute('rel') || '').toLowerCase())) bad.push(`external "${name}" missing rel=noopener`);
      if (!warns) bad.push(`external "${name}" gives no new-tab warning`);
    }
  }

  check('found external links to check', external > 0, `${external} external, ${internal} internal`);
  check('every external link opens in a new tab, warned and rel-protected',
    bad.length === 0, bad.slice(0, 4).join('; ') || `${external} links correct`);
}

checkExternalLinks('solution1', w1);
checkExternalLinks('solution3', w3);

// The detail view is rendered after a click, so its links are annotated by
// the MutationObserver rather than the initial pass.
if (w1) {
  const btn = w1.document.querySelector('.year-link');
  if (btn) {
    btn.click();
    if (typeof w1.UOPExternalLinks !== 'undefined') w1.UOPExternalLinks.refresh();
    checkExternalLinks('solution1 detail view', w1);

    console.log('\n── TECH-611 narrow-screen timetable ──');
    const scroll = w1.document.querySelector('.timetable-scroll');
    check('timetable sits in a scroll region', !!scroll);
    check('scroll region is keyboard reachable', scroll && scroll.getAttribute('tabindex') === '0');
    check('scroll region has an accessible name',
      scroll && !!w1.document.getElementById(scroll.getAttribute('aria-labelledby') || ''));
    check('year switcher is a button group, not an unbacked tablist',
      w1.document.querySelectorAll('[role="tablist"]').length === 0 &&
      !!w1.document.querySelector('#detail-year-tabs[role="group"]'));
    check('selected year is marked with aria-current',
      w1.document.querySelectorAll('.year-tab[aria-current="true"]').length === 1);
  }
}

// ── TECH-611: the narrow-screen CSS the fix depends on ──────────────────
// boot() evals the scripts by hand, so a missing <script> tag would not
// otherwise show up here — assert the pages actually load the handler.
console.log('\n── TECH-611 script registration ──');
for (const [dir, page] of [['solution1', 'index.html'], ['solution3', 'index.html'], ['.', 'index.html']]) {
  const html = fs.readFileSync(path.join(ROOT, dir, page), 'utf8');
  check(`${dir === '.' ? 'landing page' : dir}: loads external-links.js`,
    /<script[^>]+src="external-links\.js"/.test(html));
  const f = path.join(ROOT, dir, 'external-links.js');
  check(`${dir === '.' ? 'landing page' : dir}: external-links.js is present`, fs.existsSync(f));
}

console.log('\n── TECH-611 stylesheet rules ──');
for (const [dir, tableSel, scrollSel] of [['solution1', 'timetable-table', '.timetable-scroll'],
                                          ['solution3', 'tt-table', '.tt-scroll']]) {
  const css = fs.readFileSync(path.join(ROOT, dir, 'styles.css'), 'utf8');
  const hidesColumns = new RegExp(`\\\\.${tableSel}\\\\s+(thead th|tbody td):nth-child\\\\(\\\\d\\\\)[^}]*display:\\\\s*none`).test(css);
  check(`${dir}: no timetable column hidden on narrow screens`, !hidesColumns);
  check(`${dir}: timetable scroll region is styled`, css.includes(scrollSel + ' {'));
}
{
  // The sticky reset must come after the base rule or the cascade ignores it.
  const css = fs.readFileSync(path.join(ROOT, 'solution1/styles.css'), 'utf8');
  const base = css.indexOf('.detail-sidebar {\n  position: sticky;');
  const reset = css.indexOf('position: static;', base);
  check('solution1: sidebar sticky reset follows the base rule (cascade order)',
    base !== -1 && reset > base, base === -1 ? 'base rule not found' : `base @${base}, reset @${reset}`);
}


/* ── TECH-614: mal-formed online joining links ──────────────────────────────
   Two things have to hold in all three renderers. The pipeline must have taken
   the clipped address out of the description, and the renderer must put the
   notice where the join button would have been — without swallowing the links
   that do work. The legacy case at the end is the one that actually exercises
   the renderer's own guard: a deployed page can be running last week's data.js
   against this week's renderer. */
console.log('\n── TECH-614 mal-formed session links ──');

const MEETING = /teams\.microsoft|teams\.live|zoom\.us|zoom\.com|meet\.google|webex|gotomeeting/i;

let flaggedEvents = 0, linkedEvents = 0, inlineMeeting = 0, missingFlag = 0;
for (const c of data) {
  for (const yn of Object.keys(c.years)) {
    for (const ev of c.years[yn].events || []) {
      if (typeof ev.online_link_issue !== 'boolean') missingFlag++;
      if (ev.online_link_issue) flaggedEvents++;
      if ((ev.links || []).length) linkedEvents++;
      if (MEETING.test(ev.description || '')) inlineMeeting++;
    }
  }
}
check('every event carries the online_link_issue flag', missingFlag === 0, missingFlag + ' without it');
check('no meeting URL left sitting in a description', inlineMeeting === 0, inlineMeeting + ' found');
check('some events flagged and some links still work',
  flaggedEvents > 0 && linkedEvents > 0, flaggedEvents + ' flagged, ' + linkedEvents + ' linked');

// Pick a course-year that will show the notice, and one with a working link.
let flagged = null, working = null;
for (const c of data) {
  for (const yn of Object.keys(c.years)) {
    const evs = c.years[yn].events || [];
    if (!flagged && evs.some(e => e.online_link_issue)) flagged = { c, yn };
    if (!working && evs.some(e => (e.links || []).length)) working = { c, yn };
  }
}

/* Open a course-year the way a student does — by clicking its year button.
   Deep links go through the same renderer, but hash routing under JSDOM does
   not fire reliably, and a click is closer to what we are asserting about. */
function openDetail(window, btnSel, contentId, courseId, year) {
  const doc = window.document;
  const btns = [...doc.querySelectorAll(btnSel)]
    .filter(b => b.dataset.courseId === courseId);
  const btn = btns.find(b => String(b.dataset.year) === String(year)) || btns[0];
  if (!btn) return '';
  btn.click();
  const el = doc.getElementById(contentId);
  return el ? el.innerHTML : '';
}

const RENDERERS = [
  { label: 'solution1', win: () => w1, btn: '.year-link', content: 'timetable-content' },
  { label: 'solution3', win: () => w3, btn: '.yr-btn',    content: 'detail-content'    }
];

for (const { label, win: getWin, btn, content } of RENDERERS) {
  const win = getWin();
  if (!win || !flagged) continue;
  const html = openDetail(win, btn, content, flagged.c.id, flagged.yn);
  check(label + ': notice rendered for a clipped link',
    /Check with your course leader for online link/.test(html));
  check(label + ': notice is a paragraph, not an anchor',
    !/<a[^>]*(event|ev)-link-notice/.test(html));
  check(label + ': no Teams or Zoom href survives',
    !/href="[^"]*(teams\.microsoft|teams\.live|zoom\.us)/i.test(html));
  check(label + ': no "Join online session" label survives',
    !/Join online session/.test(html));

  const wHtml = openDetail(win, btn, content, working.c.id, working.yn);
  check(label + ': a usable link still opens in a new tab',
    /target="_blank"/.test(wHtml) && /rel="noopener noreferrer"/.test(wHtml));
  check(label + ': a usable link still warns about the new tab',
    /opens in a new tab/.test(wHtml));
}

/* The renderer guard, against a legacy-shaped data.js: the clipped address is
   still inline in the description and there is no online_link_issue flag.
   Synthesised rather than shipped as a fixture so it cannot drift. */
const LEGACY = [{
  id: 'X9999FTC', slug: 'legacy-shaped-course', name: 'Legacy Shaped Course',
  crs_code: 'X9999FTC', course_type: 'UG',
  years: { 1: { year: 1, mod_code: 'I99999', mod_codes: ['I99999'], events: [{
    event_id: 1, date: 'Wednesday 16 September 2026', date_sort: '2026-09-16',
    day: 'Wed', time: '1:00pm', finish: '2:00pm', title: 'Drop-In Q&A Session',
    description: 'Ask anything, https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZTVhZDEzNDktOTJkNC00MGQ4LWE2NWEtNzIxZjAzMGEyZ',
    locations: [], links: [], site: '', room: '', is_online: true, mod_code: 'I99999'
  }] } }
}];

function bootLegacy(dir, entry, extras = []) {
  const html = fs.readFileSync(path.join(ROOT, dir, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.org/' });
  const { window } = dom;
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }));
  for (const f of extras) {
    const p = path.join(ROOT, dir, f);
    if (fs.existsSync(p)) window.eval(fs.readFileSync(p, 'utf8'));
  }
  window.eval('window.__COURSES_DATA__ = ' + JSON.stringify(LEGACY) + ';');
  window.eval(fs.readFileSync(path.join(ROOT, dir, entry), 'utf8'));
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return window;
}

for (const [label, dir, entry, extras, btnSel, contentId] of [
  ['solution1', 'solution1', 'app.js', ['analytics.js', 'external-links.js'], '.year-link', 'timetable-content'],
  ['solution3', 'solution3', 'app.js', ['external-links.js'], '.yr-btn', 'detail-content']
]) {
  let lw;
  try { lw = bootLegacy(dir, entry, extras); }
  catch (e) { check(label + ': legacy data.js boots', false, e.message); continue; }
  const html = openDetail(lw, btnSel, contentId, 'X9999FTC', 1);
  check(label + ': legacy data.js — clipped inline link is not linkified',
    !/href="[^"]*teams\.microsoft/i.test(html));
  check(label + ': legacy data.js — notice shown instead',
    /Check with your course leader for online link/.test(html));
  check(label + ': legacy data.js — raw address not left visible',
    !/meetup-join/.test(html));
}

/* The widget keeps its own copy of the logic and renders into the host page
   rather than a named container, so it gets its own pass. */
{
  const wsrc = fs.readFileSync(path.join(ROOT, 'solution2/induction-widget.js'), 'utf8');
  check('solution2: widget no longer labels anything "Join online session"',
    !wsrc.includes('>Join online session'));
  check('solution2: notice is styled', wsrc.includes('.uop-ind__link-notice'));

  let ww;
  try { ww = boot('solution2', 'induction-widget.js', [], 'demo-search-page.html'); }
  catch (e) { check('solution2: boots for the notice test', false, e.message); ww = null; }

  if (ww && flagged) {
    const doc = ww.document;
    const btn = [...doc.querySelectorAll('.uop-ind__year-btn')]
      .find(b => b.dataset.courseId === flagged.c.id);
    if (!btn) {
      check('solution2: year button for the flagged course exists', false);
    } else {
      btn.click();
      const html = doc.body.innerHTML;
      check('solution2: notice rendered for a clipped link',
        /Check with your course leader for online link/.test(html));
      check('solution2: no Teams or Zoom href survives',
        !/href="[^"]*(teams\.microsoft|teams\.live|zoom\.us)/i.test(html));
      const n = doc.querySelector('.uop-ind__link-notice');
      check('solution2: notice is a paragraph, not an anchor', n && n.tagName === 'P',
        n ? n.tagName : 'not found');
      check('solution2: notice icon is hidden from assistive technology',
        n && n.querySelector('svg') &&
        n.querySelector('svg').getAttribute('aria-hidden') === 'true');
    }
  }
}

console.log(`\n${failures === 0 ? 'All checks passed.' : failures + ' CHECK(S) FAILED.'}`);

process.exit(failures ? 1 : 0);
