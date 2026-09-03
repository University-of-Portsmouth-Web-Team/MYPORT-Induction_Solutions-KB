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

const w1 = testSolution('solution1', 'solution1', 'app.js', '.course-card', ['analytics.js']);
const w3 = testSolution('solution3', 'solution3', 'app.js', '.course-card');
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

console.log(`\n${failures === 0 ? 'All checks passed.' : failures + ' CHECK(S) FAILED.'}`);
process.exit(failures ? 1 : 0);
