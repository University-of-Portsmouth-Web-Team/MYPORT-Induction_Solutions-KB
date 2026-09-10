# Accessibility — GitHub Pages proof of concept

**Standard:** WCAG 2.2 Level AA
**Audited:** 2026-09-10 (v2.3)
**Target:** https://university-of-portsmouth-web-team.github.io/MYPORT-Induction_Solutions-KB/
**Result:** no failures found across 8 page states.

---

## What this report does and does not say

Automated testing covers somewhere between a third and a half of the WCAG
success criteria. It reliably finds machine-detectable faults — missing names,
broken ARIA contracts, insufficient contrast, structural errors — and it cannot
find whether a heading actually describes its section, whether an error message
is comprehensible, or whether the page is usable with a screen reader in
practice.

So the honest claim is the one at the top: **no failures were found by the
checks described below.** That is not the same as certified conformance, and if
anyone asks for the latter it needs the manual pass listed at the end of this
document. The checks are repeatable, which is the point — they run before every
release and will catch a regression.

The audit runs in [jsdom](https://github.com/jsdom/jsdom), which has no layout
engine. Nothing here has seen the pages painted. Colour contrast is therefore
computed from the design tokens with the WCAG relative-luminance formula rather
than sampled from rendered pixels, and the narrow-screen behaviour is verified
by resolving the CSS cascade rather than by measuring boxes.

---

## Surfaces audited

| Surface | Page | States audited |
|---------|------|----------------|
| Landing page | `index.html` | Static |
| Solution 1 — static site | `solution1/index.html` | Listing and detail |
| Solution 2 — embeddable widget | `solution2/demo-search-page.html` | Listing and detail, inside its host page |
| Solution 2 — course page host | `solution2/demo-course-page.html` | Static |
| Solution 3 — progressive web app | `solution3/index.html` | Listing and detail |

Each state is audited after the app has finished rendering, so what is checked
is the DOM a student actually gets, not the empty shell in the HTML file.

---

## Method

Run it yourself:

```
npm install jsdom axe-core postcss
node scripts/a11y-audit.js
```

It exits non-zero if anything fails, and takes `--json` for CI. Four
independent checks:

### 1. axe-core 4.13.0

Rule sets `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` and
`best-practice`. Rules axe cannot decide without layout are reported as
"needs review" rather than quietly counted as passes.

Three rules always land in that bucket under jsdom and are covered elsewhere:

| Rule | Why it cannot resolve | Where it is covered |
|------|----------------------|---------------------|
| `color-contrast` | needs rendered pixels | check 3, by calculation |
| `landmark-one-main` | needs layout to judge visibility | `<main id="main-content">` present in the markup |
| `page-has-heading-one` | same | visually hidden `<h1>` present, deliberately, because the host page supplies the visible heading |

### 2. External-link rules

Every anchor is resolved against the site prefix. For each link that leaves the
site: `target="_blank"`, `rel="noopener noreferrer"`, and a new-tab warning in
its accessible name. For each link that stays: it must **not** open a new tab.
`mailto:` and `tel:` are excluded — the operating system handles those, not the
browser.

### 3. Colour contrast

Computed from the tokens in `:root` for every foreground/background pairing the
stylesheets actually put on screen. 4.5:1 for body text (SC 1.4.3), 3:1 for
component boundaries and focus indicators (SC 1.4.11).

### 4. Responsive CSS cascade

The stylesheet is parsed and walked in source order, keeping declarations whose
media query applies at a given width, so the check reports which declaration
actually **wins** at 375px rather than merely that a rule exists somewhere. This
matters: the first attempt at the sidebar fix in this release was defeated by
cascade order and looked correct to inspection.

---

## Full output

```
========================================================================
  Accessibility audit — GitHub Pages proof of concept
  axe-core 4.13.0 · WCAG 2.0/2.1/2.2 A + AA · 2026-09-10
========================================================================

1. axe-core rule set

   Landing page  (index.html)
     PASS  0 violations, 33 rules passed
     needs review (no layout engine under jsdom): color-contrast ×1, landmark-one-main ×1, page-has-heading-one ×1

   Solution 1 — listing  (solution1/index.html)
     PASS  0 violations, 34 rules passed
     needs review (no layout engine under jsdom): color-contrast ×1, landmark-one-main ×1, page-has-heading-one ×1

   Solution 1 — detail  (solution1/index.html)
     PASS  0 violations, 38 rules passed
     needs review (no layout engine under jsdom): color-contrast ×1, landmark-one-main ×1, page-has-heading-one ×1

   Solution 2 — search page  (solution2/demo-search-page.html)
     PASS  0 violations, 39 rules passed
     needs review (no layout engine under jsdom): color-contrast ×1, landmark-one-main ×1, page-has-heading-one ×1

   Solution 2 — detail  (solution2/demo-search-page.html)
     PASS  0 violations, 41 rules passed
     needs review (no layout engine under jsdom): color-contrast ×1, landmark-one-main ×1, page-has-heading-one ×1

   Solution 2 — course page  (solution2/demo-course-page.html)
     PASS  0 violations, 39 rules passed
     needs review (no layout engine under jsdom): color-contrast ×1, landmark-one-main ×1, page-has-heading-one ×1

   Solution 3 — listing  (solution3/index.html)
     PASS  0 violations, 35 rules passed
     needs review (no layout engine under jsdom): color-contrast ×1, landmark-one-main ×1, page-has-heading-one ×1

   Solution 3 — detail  (solution3/index.html)
     PASS  0 violations, 36 rules passed
     needs review (no layout engine under jsdom): color-contrast ×1, landmark-one-main ×1, page-has-heading-one ×1

2. External links
   PASS  Landing page: 2 external, 7 internal, 0 mailto/tel
   PASS  Solution 1 — listing: 10 external, 22 internal, 1 mailto/tel
   PASS  Solution 1 — detail: 12 external, 22 internal, 1 mailto/tel
   PASS  Solution 2 — search page: 0 external, 29 internal, 0 mailto/tel
   PASS  Solution 2 — detail: 6 external, 29 internal, 2 mailto/tel
   PASS  Solution 2 — course page: 0 external, 8 internal, 0 mailto/tel
   PASS  Solution 3 — listing: 3 external, 23 internal, 1 mailto/tel
   PASS  Solution 3 — detail: 10 external, 23 internal, 2 mailto/tel

3. Colour contrast (computed from the design tokens)

   solution1/styles.css
     PASS   10.57:1  (min 4.5)  Body text on page background  #3C3C3C on #FAFAFA
     PASS   11.03:1  (min 4.5)  Body text on card surface  #3C3C3C on #ffffff
     PASS    7.65:1  (min 4.5)  Secondary text on surface  #505457 on #ffffff
     PASS    7.32:1  (min 4.5)  Muted text on page background  #505457 on #FAFAFA
     PASS   15.89:1  (min 4.5)  Headings on page background  #3C023C on #FAFAFA
     PASS   16.59:1  (min 4.5)  Headings on card surface  #3C023C on #ffffff
     PASS    4.63:1  (min 4.5)  Link text on page background  #0078B4 on #FAFAFA
     PASS    4.83:1  (min 4.5)  Link text on card surface  #0078B4 on #ffffff
     PASS    8.82:1  (min 4.5)  Link hover on card surface  #004F76 on #ffffff
     PASS    7.04:1  (min 4.5)  Error text on surface  #B20145 on #ffffff
     PASS    4.83:1  (min 4.5)  White on navy header  #ffffff on #0078B4
     PASS    8.82:1  (min 4.5)  White on dark navy button  #ffffff on #004F76
     PASS   16.59:1  (min 4.5)  White on heading-purple day band  #ffffff on #3C023C
     PASS    4.63:1  (min 3)  Focus ring against page background  #0078B4 on #FAFAFA — non-text (1.4.11)
     PASS    4.83:1  (min 3)  Focus ring against card surface  #0078B4 on #ffffff — non-text (1.4.11)
     PASS    3.36:1  (min 3)  Strong border against surface  #8C8C8C on #ffffff — non-text (1.4.11)

4. Script errors while the page loaded
   PASS  Landing page
   PASS  Solution 1 — listing
   PASS  Solution 1 — detail
   PASS  Solution 2 — search page
   PASS  Solution 2 — detail
   PASS  Solution 2 — course page
   PASS  Solution 3 — listing
   PASS  Solution 3 — detail

5. Responsive CSS cascade
   PASS  sidebar is sticky beside the content on desktop
         position: sticky
   PASS  sidebar is NOT sticky at 375px (was floating over the timetable)
         position: static
   PASS  sidebar does not visually precede the content at 375px (1.3.2 / 2.4.3)
         order: 0
   PASS  detail grid collapses to one column at 375px
         1fr
   PASS  no timetable column is hidden with display:none on narrow screens
   PASS  timetable has a horizontal scroll region instead (1.4.10 data-table exception)
   PASS  scroll region has a visible focus indicator
   PASS  external-link marker is styled
   PASS  no timetable column is hidden with display:none on narrow screens
   PASS  timetable has a horizontal scroll region

------------------------------------------------------------------------
  RESULT: PASS — no WCAG 2.2 AA failures found across 8 page states.
------------------------------------------------------------------------
```

---

## Issues found and fixed in v2.3

Everything below was found by the audit above and is fixed. Each was a
pre-existing fault except where noted.

### Blocking — WCAG A/AA failures

| # | Issue | Criterion | Fix |
|---|-------|-----------|-----|
| 1 | `role="list"` on containers whose children are `<section>` or `<article>` elements, not list items. axe: `aria-required-children`, critical | 1.3.1 Info and Relationships (A) | Role removed. The real lists are the `<ul role="list">` inside each letter section |
| 2 | The year switcher was marked up as an ARIA `tablist`, but no implementation provided arrow-key navigation or an associated `tabpanel`, and in solutions 2 and 3 the buttons carried no `role="tab"` at all. A screen reader announced "tab, 1 of 3" and offered an interaction model the app does not honour | 1.3.1 (A), 4.1.2 Name, Role, Value (A) | Now a labelled group of buttons with `aria-current="true"` on the selected year — which is what they behave like. Tab still moves between them |
| 3 | `aria-label` and `aria-labelledby` on generic elements, which ARIA 1.2 prohibits: course-type badges, online badges, session counts, the breadcrumb, both sidebar cards. Where these sat on a `<span>` with no role, the label was liable to be dropped entirely | 4.1.2 (A) | Replaced with visually hidden text. The session count moved into the year button's own label, where it is actually announced — a button's `aria-label` replaces its content, so the count on the inner `<span>` was never read out |
| 4 | `--color-border-strong` (`#ABAAAA`) at **2.32:1**. This is the border of the search field, the filter buttons and the year tabs. An empty text field is identified by its border alone | 1.4.11 Non-text Contrast (AA) | `#8C8C8C` — 3.36:1 on white, 3.22:1 on the page background. `.year-link` moved onto the same token as the other buttons instead of the lighter divider one |
| 5 | The timetable **deleted columns** on small screens: Location below 600px, Finishes below 480px, via `display: none`. A student on a phone could not see which room their induction was in | 1.3.1 (A) — content unavailable | All four columns retained in a focusable horizontal-scroll region. SC 1.4.10 Reflow explicitly permits two-dimensional scrolling for data tables |
| 6 | The decorative block character in the online badges (`⬛`) was in the accessible name and read aloud | 1.1.1 Non-text Content (A) | `aria-hidden` on the character; the badge now reads "Online session" |

### Reported behaviour

| # | Issue | Criterion | Fix |
|---|-------|-----------|-----|
| 7 | **"Need help?" and "Module information" floated over the timetable on narrow screens.** `.detail-sidebar` kept `position: sticky` after the grid collapsed to one column, so a short sticky block inside a tall container pinned itself to the viewport and scrolled over the content | 1.4.10 Reflow (AA) — content obscured | `position: static` below 860px. The reset must sit **after** the base rule to win the cascade, which is asserted by test |
| 8 | The same block used `order: -1`, putting the two support cards above the main content visually while leaving them after it in the DOM. Reading order, tab order and visual order disagreed | 1.3.2 Meaningful Sequence (A), 2.4.3 Focus Order (A) | Order removed; the cards follow the timetable, which is what a student came for |
| 9 | **Links leaving the site opened in the same tab** — and inside the MyPort iframe that loaded the parent site *within* the timetable frame | — (see note below) | `target="_blank"`, `rel="noopener noreferrer"`, and a warning in the accessible name |

**A note on requirement 9.** Opening new tabs is not required by WCAG, and
SC 3.2.5 Change on Request (AAA) would rather it did not happen unattended. The
accepted way to do it is technique
[G201](https://www.w3.org/WAI/WCAG22/Techniques/general/G201) — warn the user in
advance. Every external link therefore carries a visible `↗` and a visually
hidden "(opens in a new tab)", so the behaviour satisfies G201 and the AAA
criterion with it. `rel="noopener"` also closes the reverse-tabnabbing hole the
plain `target="_blank"` would have opened.

---

## How external links are decided

`external-links.js` treats as **internal**:

- anything under `https://university-of-portsmouth-web-team.github.io/`
- anything on the origin the page is currently served from, added at runtime, so
  preview deployments and a future `port.ac.uk` hostname need no code change
- in-page anchors (`#letter-A`, `#detail/...`)
- `mailto:` and `tel:`

Everything else opens in a new tab. Two consequences worth knowing:

1. **Inside the MyPort iframe, MyPort's own links are external** — the frame is
   on a different origin from its parent. This is correct and wanted: without
   it, a MyPort link loads the portal inside the timetable frame.
2. The static links in the HTML carry the attributes **in the markup**, so they
   behave correctly with JavaScript disabled. The script exists for the links
   built at runtime from `data.js`, and is written to be safe to run repeatedly
   over the same DOM — the "Join online session" links, which already announce
   themselves, are not annotated twice.

An element can opt out with `data-no-external-links`.

---

## Still to be done by hand

These cannot be automated and are **not** covered by the result above:

- [ ] **Screen reader pass** — NVDA or JAWS with Chrome, and VoiceOver on iOS.
      Particularly the year-switcher change and the scrollable timetable region.
- [ ] **Keyboard-only pass** — reach and operate every control, including
      scrolling the timetable region, with no mouse.
- [ ] **Reflow at 320px** (SC 1.4.10) and **200% zoom** (SC 1.4.4) in a real
      browser. Worth eyeballing at 360, 414 and 768px too.
- [ ] **Target size** (SC 2.5.8, AA in WCAG 2.2) — the A–Z index links and the
      filter buttons are the ones to measure.
- [ ] **Contrast of rendered text over the navy header and purple date bands**,
      sampled rather than calculated, to confirm no opacity is applied anywhere
      the tokens do not describe.
- [ ] **Testing inside the live MyPort iframe**, which is the context students
      actually meet and the only place the embed height logic runs.

---

## Regression cover

The audit is not the only guard. `scripts/smoke-test.js` asserts, on every
run:

- every external link opens in a new tab, warned and `rel`-protected, in both
  the listing and the detail view
- no internal link opens in a new tab
- the pages actually load `external-links.js` — the harness evals scripts by
  hand, so a deleted `<script>` tag would otherwise go unnoticed
- the timetable scroll region exists, is keyboard reachable and has an
  accessible name
- no timetable column is hidden with `display: none`
- the year switcher is a button group, with exactly one `aria-current`
- **the sticky reset follows the base rule in source order** — the specific
  mistake that made the first attempt at issue 7 a no-op

Both suites were mutation-tested: reverting the cascade fix and removing the
link handler each make them fail, so the passes above are load-bearing rather
than vacuous.
