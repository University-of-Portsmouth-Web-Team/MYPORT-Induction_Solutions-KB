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

console.log(`\n${failures === 0 ? 'All checks passed.' : failures + ' CHECK(S) FAILED.'}`);

process.exit(failures ? 1 : 0);
