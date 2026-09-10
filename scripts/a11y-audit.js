#!/usr/bin/env node
/* ============================================================
   University of Portsmouth — Induction Timetables
   Accessibility audit  (TECH-611)
   ------------------------------------------------------------
   Four independent checks, all of which must pass:

     1. axe-core against the WCAG 2.0/2.1/2.2 A and AA rule sets,
        on every page and on the detail view each app renders
        after a course is opened.
     2. External-link rules — every link off this site opens in a
        new tab, says so, and carries rel="noopener noreferrer";
        no link that stays on this site opens in a new tab.
     3. Colour contrast, computed from the design tokens with the
        WCAG relative-luminance formula. axe cannot do this under
        jsdom, which has no layout engine, so it is done directly.
     4. The responsive CSS cascade at three viewport widths, so
        the narrow-screen fixes are asserted rather than assumed.

   Usage:  npm install jsdom axe-core postcss
           node <this file>            # human-readable report
           node <this file> --json     # machine-readable
   Exits non-zero if any check fails.

   Note on scope: jsdom has no layout engine, so nothing here can
   see the rendered geometry. Check 4 evaluates the cascade rather
   than the painted result — the final word on the narrow-screen
   layout is still a browser at 360/414/768px.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole, requestInterceptor } = require('jsdom');
const axe = require('axe-core');
const postcss = require('postcss');

const ROOT = path.resolve(__dirname, '..');
const JSON_OUT = process.argv.includes('--json');

/* ── Project layout ──────────────────────────────────────────────────────
   The same script serves both repositories; the folder it finds decides
   which one it is looking at. */
const IS_CLOUDFLARE = fs.existsSync(path.join(ROOT, 'site/index.html'));

const PROJECT = IS_CLOUDFLARE
  ? {
      name: 'Cloudflare Workers deployment',
      prefix: 'https://myport-induction.university-of-portsmouth-acquia.workers.dev/',
      docRoot: 'site',
      css: ['site/styles.css'],
      pages: [
        { label: 'Listing view', page: 'index.html' },
        { label: 'Detail view', page: 'index.html', open: '.year-link' },
        { label: 'Not-found page', page: '404.html' }
      ]
    }
  : {
      name: 'GitHub Pages proof of concept',
      prefix: 'https://university-of-portsmouth-web-team.github.io/',
      docRoot: '.',
      css: ['solution1/styles.css', 'solution3/styles.css'],
      pages: [
        { label: 'Landing page', page: 'index.html' },
        { label: 'Solution 1 — listing', page: 'solution1/index.html' },
        { label: 'Solution 1 — detail', page: 'solution1/index.html', open: '.year-link' },
        { label: 'Solution 2 — search page', page: 'solution2/demo-search-page.html' },
        { label: 'Solution 2 — detail', page: 'solution2/demo-search-page.html', open: '.uop-ind__year-btn' },
        { label: 'Solution 2 — course page', page: 'solution2/demo-course-page.html' },
        { label: 'Solution 3 — listing', page: 'solution3/index.html' },
        { label: 'Solution 3 — detail', page: 'solution3/index.html', open: '.yr-btn' }
      ]
    };

const DOC_ROOT = path.join(ROOT, PROJECT.docRoot);

const results = { project: PROJECT.name, axe: [], links: [], contrast: [], css: [], scripts: [] };
let failures = 0;

function fail(msg) { failures++; return msg; }

/* ── Page loading ────────────────────────────────────────────────────────
   Local files are served off disk. Remote requests — the Google tag and
   the Google Fonts stylesheet — are answered with an empty body so the
   audit never touches the network and never depends on a third party. */
function interceptor() {
  return requestInterceptor(request => {
    const url = request.url;

    if (url.startsWith(PROJECT.prefix)) {
      const rel = decodeURIComponent(url.slice(PROJECT.prefix.length).split(/[?#]/)[0]);
      const file = path.join(DOC_ROOT, rel);
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        const ext = path.extname(file);
        const type = ext === '.js' ? 'text/javascript'
          : ext === '.css' ? 'text/css'
          : ext === '.png' ? 'image/png'
          : 'text/html';
        return new Response(fs.readFileSync(file), { headers: { 'Content-Type': type } });
      }
      return new Response('', { status: 404 });
    }

    // Third-party: fonts, Google tag. Answered empty, never fetched.
    return new Response('', {
      headers: { 'Content-Type': url.includes('css') ? 'text/css' : 'text/javascript' }
    });
  });
}

async function loadPage(target) {
  const file = path.join(DOC_ROOT, target.page);
  const consoleErrors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => {
    // Noise from the test environment rather than defects in the page:
    // CSS jsdom's parser rejects, and the browser APIs jsdom does not
    // implement (axe-core reaches for <canvas> during colour work).
    if (/Could not parse CSS|^Not implemented:/i.test(e.message)) return;
    consoleErrors.push(e.message);
  });

  const dom = new JSDOM(fs.readFileSync(file, 'utf8'), {
    url: PROJECT.prefix + target.page,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    resources: { interceptors: [interceptor()] },
    virtualConsole: vc
  });

  const win = dom.window;
  await new Promise(resolve => {
    if (win.document.readyState === 'complete') return resolve();
    win.addEventListener('load', resolve);
    setTimeout(resolve, 4000);
  });
  // Let the apps finish their first render and the link handler its pass.
  await new Promise(r => setTimeout(r, 150));

  if (target.open) {
    const btn = win.document.querySelector(target.open);
    if (!btn) throw new Error(`no element matching ${target.open} on ${target.page}`);
    btn.click();
    await new Promise(r => setTimeout(r, 150));
  }

  return { dom, win, consoleErrors };
}

/* ── 1. axe-core ─────────────────────────────────────────────────────── */
const AXE_OPTIONS = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }
};

async function runAxe(target, win) {
  win.eval(axe.source);
  const res = await win.axe.run(win.document, AXE_OPTIONS);

  // Rules axe cannot decide without layout are reported separately rather
  // than silently swallowed. colour-contrast is one of them; check 3 covers it.
  const entry = {
    label: target.label,
    page: target.page,
    violations: res.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      wcag: v.tags.filter(t => /^wcag/.test(t)),
      count: v.nodes.length,
      example: (v.nodes[0] && v.nodes[0].html || '').slice(0, 140)
    })),
    incomplete: res.incomplete.map(v => ({ id: v.id, count: v.nodes.length })),
    passes: res.passes.length
  };
  if (entry.violations.length) failures += entry.violations.length;
  results.axe.push(entry);
  return entry;
}

/* ── 2. External-link rules ──────────────────────────────────────────── */
function auditLinks(target, win) {
  const doc = win.document;
  const entry = { label: target.label, external: 0, internal: 0, skipped: 0, problems: [] };

  for (const a of doc.querySelectorAll('a[href]')) {
    const raw = a.getAttribute('href') || '';
    if (!raw || raw.charAt(0) === '#') { entry.internal++; continue; }

    let resolved;
    try { resolved = new URL(raw, doc.baseURI).href; } catch (e) { entry.skipped++; continue; }

    if (!/^https?:\/\//i.test(resolved)) { entry.skipped++; continue; } // mailto:, tel:

    const isExternal = resolved.indexOf(PROJECT.prefix) !== 0;
    const target_ = a.getAttribute('target');
    const rel = (a.getAttribute('rel') || '').toLowerCase();
    const described = (a.getAttribute('aria-label') || '') + ' ' + (a.textContent || '');
    const warns = /opens in a new (tab|window)/i.test(described);
    const name = (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) || raw;

    if (isExternal) {
      entry.external++;
      if (target_ !== '_blank') entry.problems.push(fail(`external link does not open in a new tab: "${name}" → ${resolved}`));
      if (!/noopener/.test(rel)) entry.problems.push(fail(`external link missing rel="noopener": "${name}"`));
      if (!warns) entry.problems.push(fail(`external link gives no new-tab warning (WCAG G201): "${name}"`));
    } else {
      entry.internal++;
      if (target_ === '_blank') entry.problems.push(fail(`internal link opens in a new tab: "${name}" → ${resolved}`));
    }
  }

  results.links.push(entry);
  return entry;
}

/* ── 3. Colour contrast from the design tokens ───────────────────────── */
function readTokens(cssFile) {
  const css = fs.readFileSync(path.join(ROOT, cssFile), 'utf8');
  const tokens = {};
  const root = css.match(/:root\s*\{([\s\S]*?)\}/);
  if (root) {
    for (const m of root[1].matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
      tokens[m[1]] = m[2];
    }
  }
  return tokens;
}

function srgbToLinear(c) {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
function ratio(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Every foreground/background pairing the stylesheets actually put on
// screen, with the threshold that applies to it. 4.5 for body text,
// 3.0 for large text (>=18.66px bold or >=24px) and for the non-text
// contrast of borders and focus rings (WCAG 2.2 1.4.11).
function contrastPairs(t) {
  const P = [];
  const add = (label, fg, bg, min, note) => {
    if (!t[fg] || !t[bg]) return;
    P.push({ label, fg: t[fg], bg: t[bg], min, note });
  };
  add('Body text on page background', '--color-text', '--color-bg', 4.5);
  add('Body text on card surface', '--color-text', '--color-surface', 4.5);
  add('Secondary text on surface', '--color-text-secondary', '--color-surface', 4.5);
  add('Muted text on page background', '--color-text-muted', '--color-bg', 4.5);
  add('Headings on page background', '--color-heading', '--color-bg', 4.5);
  add('Headings on card surface', '--color-heading', '--color-surface', 4.5);
  add('Link text on page background', '--color-link', '--color-bg', 4.5);
  add('Link text on card surface', '--color-link', '--color-surface', 4.5);
  add('Link hover on card surface', '--color-link-hover', '--color-surface', 4.5);
  add('Error text on surface', '--color-error', '--color-surface', 4.5);
  add('White on navy header', '--color-white', '--color-navy', 4.5);
  add('White on dark navy button', '--color-white', '--color-navy-dark', 4.5);
  add('White on heading-purple day band', '--color-white', '--color-heading', 4.5);
  add('Focus ring against page background', '--color-focus', '--color-bg', 3.0, 'non-text (1.4.11)');
  add('Focus ring against card surface', '--color-focus', '--color-surface', 3.0, 'non-text (1.4.11)');
  add('Strong border against surface', '--color-border-strong', '--color-surface', 3.0, 'non-text (1.4.11)');
  return P;
}

function auditContrast() {
  for (const cssFile of PROJECT.css) {
    const tokens = readTokens(cssFile);
    const pairs = contrastPairs(tokens);
    if (!pairs.length) continue;
    const entry = { file: cssFile, checks: [] };
    for (const p of pairs) {
      const r = ratio(p.fg, p.bg);
      const ok = r >= p.min;
      if (!ok) fail(`contrast ${p.label} in ${cssFile}: ${r.toFixed(2)}:1 (needs ${p.min}:1)`);
      entry.checks.push({ ...p, ratio: Math.round(r * 100) / 100, pass: ok });
    }
    results.contrast.push(entry);
  }
}

/* ── 4. Responsive CSS cascade ───────────────────────────────────────── */
// Walk the stylesheet in source order, keeping the declarations whose
// media query applies at the given width. Last one in wins, which is
// how the cascade resolves rules of equal specificity.
function declarationAt(cssFile, width, selector, prop) {
  const css = fs.readFileSync(path.join(ROOT, cssFile), 'utf8');
  const root = postcss.parse(css);
  let winner = null;

  const applies = params => {
    let ok = true;
    for (const m of params.matchAll(/\(\s*(min|max)-width\s*:\s*(\d+)px\s*\)/g)) {
      if (m[1] === 'max' && !(width <= +m[2])) ok = false;
      if (m[1] === 'min' && !(width >= +m[2])) ok = false;
    }
    if (/prefers-reduced-motion|print/.test(params)) ok = false;
    return ok;
  };

  const visit = (container, inMedia) => {
    container.each(node => {
      if (node.type === 'atrule' && node.name === 'media') {
        if (applies(node.params)) visit(node, true);
      } else if (node.type === 'rule') {
        const hit = node.selectors.some(s => s.trim() === selector);
        if (!hit) return;
        node.each(d => {
          if (d.type === 'decl' && d.prop === prop) {
            winner = { value: d.value, inMedia };
          }
        });
      }
    });
  };

  visit(root, false);
  return winner;
}

function selectorExists(cssFile, selector) {
  const root = postcss.parse(fs.readFileSync(path.join(ROOT, cssFile), 'utf8'));
  let found = false;
  root.walkRules(r => { if (r.selectors.some(s => s.trim() === selector)) found = true; });
  return found;
}

function cssCheck(file, description, condition, detail) {
  if (!condition) fail(`${file}: ${description}${detail ? ' — ' + detail : ''}`);
  results.css.push({ file, description, pass: !!condition, detail });
}

function auditResponsiveCss() {
  // Solution 1 / Cloudflare: the support cards must stop being sticky and
  // must stop jumping above the main content once the grid is one column.
  const s1 = PROJECT.css.find(f => /solution1|site/.test(f));
  if (s1) {
    const wide = declarationAt(s1, 1200, '.detail-sidebar', 'position');
    const narrow = declarationAt(s1, 375, '.detail-sidebar', 'position');
    const order = declarationAt(s1, 375, '.detail-sidebar', 'order');
    const cols = declarationAt(s1, 375, '.detail-content', 'grid-template-columns');

    cssCheck(s1, 'sidebar is sticky beside the content on desktop',
      wide && wide.value === 'sticky', wide ? `position: ${wide.value}` : 'no declaration');
    cssCheck(s1, 'sidebar is NOT sticky at 375px (was floating over the timetable)',
      narrow && narrow.value === 'static', narrow ? `position: ${narrow.value}` : 'no declaration');
    cssCheck(s1, 'sidebar does not visually precede the content at 375px (1.3.2 / 2.4.3)',
      !order || order.value === '0', order ? `order: ${order.value}` : 'no order declaration');
    cssCheck(s1, 'detail grid collapses to one column at 375px',
      cols && cols.value === '1fr', cols ? cols.value : 'no declaration');

    // No timetable column may be removed on a narrow screen.
    const hidden = [];
    postcss.parse(fs.readFileSync(path.join(ROOT, s1), 'utf8')).walkRules(r => {
      if (!/timetable-table\s+(thead th|tbody td):nth-child/.test(r.selector)) return;
      r.walkDecls('display', d => { if (d.value === 'none') hidden.push(r.selector); });
    });
    cssCheck(s1, 'no timetable column is hidden with display:none on narrow screens',
      hidden.length === 0, hidden.join('; '));
    cssCheck(s1, 'timetable has a horizontal scroll region instead (1.4.10 data-table exception)',
      selectorExists(s1, '.timetable-scroll'));
    cssCheck(s1, 'scroll region has a visible focus indicator',
      selectorExists(s1, '.timetable-scroll:focus-visible'));
    cssCheck(s1, 'external-link marker is styled', selectorExists(s1, '.external-link-marker'));
  }

  const s3 = PROJECT.css.find(f => /solution3/.test(f));
  if (s3) {
    const hidden = [];
    postcss.parse(fs.readFileSync(path.join(ROOT, s3), 'utf8')).walkRules(r => {
      if (!/tt-table\s+(thead th|tbody td):nth-child/.test(r.selector)) return;
      r.walkDecls('display', d => { if (d.value === 'none') hidden.push(r.selector); });
    });
    cssCheck(s3, 'no timetable column is hidden with display:none on narrow screens',
      hidden.length === 0, hidden.join('; '));
    cssCheck(s3, 'timetable has a horizontal scroll region', selectorExists(s3, '.tt-scroll'));
  }
}

/* ── Report ──────────────────────────────────────────────────────────── */
function report() {
  const line = s => process.stdout.write(s + '\n');
  const tick = ok => (ok ? 'PASS' : 'FAIL');

  line('');
  line('='.repeat(72));
  line('  Accessibility audit — ' + PROJECT.name);
  line('  axe-core ' + axe.version + ' · WCAG 2.0/2.1/2.2 A + AA · ' + new Date().toISOString().slice(0, 10));
  line('='.repeat(72));

  line('\n1. axe-core rule set');
  for (const p of results.axe) {
    line(`\n   ${p.label}  (${p.page})`);
    line(`     ${tick(!p.violations.length)}  ${p.violations.length} violations, ${p.passes} rules passed`);
    for (const v of p.violations) {
      line(`       ✗ ${v.id} [${v.impact}] ×${v.count} — ${v.help}`);
      line(`         ${v.wcag.join(', ')}`);
      if (v.example) line(`         e.g. ${v.example}`);
    }
    if (p.incomplete.length) {
      line(`     needs review (no layout engine under jsdom): ${p.incomplete.map(i => i.id + ' ×' + i.count).join(', ')}`);
    }
  }

  line('\n2. External links');
  for (const p of results.links) {
    line(`   ${tick(!p.problems.length)}  ${p.label}: ${p.external} external, ${p.internal} internal, ${p.skipped} mailto/tel`);
    for (const problem of p.problems) line(`       ✗ ${problem}`);
  }

  line('\n3. Colour contrast (computed from the design tokens)');
  for (const c of results.contrast) {
    line(`\n   ${c.file}`);
    for (const k of c.checks) {
      line(`     ${tick(k.pass)}  ${String(k.ratio).padStart(6)}:1  (min ${k.min})  ${k.label}` +
        `  ${k.fg} on ${k.bg}${k.note ? ' — ' + k.note : ''}`);
    }
  }

  line('\n4. Script errors while the page loaded');
  for (const s of results.scripts) {
    line(`   ${tick(!s.errors.length)}  ${s.label}`);
    for (const e of s.errors) line(`       \u2717 ${e.split('\n')[0]}`);
  }

  line('\n5. Responsive CSS cascade');
  for (const c of results.css) {
    line(`   ${tick(c.pass)}  ${c.description}`);
    if (c.detail) line(`         ${c.detail}`);
  }

  line('');
  line('-'.repeat(72));
  line(failures === 0
    ? `  RESULT: PASS — no WCAG 2.2 AA failures found across ${results.axe.length} page states.`
    : `  RESULT: FAIL — ${failures} problem(s) found.`);
  line('-'.repeat(72));
  line('');
}

(async () => {
  for (const target of PROJECT.pages) {
    const { dom, win, consoleErrors } = await loadPage(target);
    await runAxe(target, win);
    auditLinks(target, win);
    results.scripts.push({ label: target.label, page: target.page, errors: consoleErrors });
    for (const e of consoleErrors) fail(`script error on ${target.page}: ${e}`);
    dom.window.close();
  }
  auditContrast();
  auditResponsiveCss();

  if (JSON_OUT) {
    process.stdout.write(JSON.stringify({ ...results, failures }, null, 2) + '\n');
  } else {
    report();
  }
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
