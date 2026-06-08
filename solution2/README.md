# Solution 2 — Embeddable JavaScript Widget

A drop-in JS widget that embeds directly into any existing MyPort page with zero style bleed.

## Files

| File | Purpose |
|------|---------|
| `induction-widget.js` | Self-contained widget (IIFE, CSS injected automatically) |
| `data.js` | Timetable data |
| `demo-search-page.html` | Demo: full search listing in a simulated MyPort host page |
| `demo-course-page.html` | Demo: pre-filtered to a single course in a simulated host page |

## Usage

Add to any MyPort page:

```html
<!-- 1. Target element -->
<div data-uop-induction></div>

<!-- 2. Data and widget scripts (order matters) -->
<script src="data.js"></script>
<script src="induction-widget.js"></script>
```

### Configuration via data-attributes

| Attribute | Effect |
|-----------|--------|
| `data-uop-induction-course="BA (Hons) Architecture"` | Pre-filter to a specific course |
| `data-uop-induction-type="UG"` | Restrict to UG or PGT courses only |
| `data-uop-induction-mode="full"` | Force full search mode |

### iFrame fallback

Host `solution1/` on a subdomain and embed via:

```html
<iframe src="https://induction.port.ac.uk/" title="Induction Timetable" style="width:100%;border:none;min-height:600px;"></iframe>
```

### Programmatic reinitialisation (AJAX navigation)

```js
window.UoPInductionWidget.initAll();
```

## Features

- Fully namespaced CSS (`.uop-ind__` prefix) — no style bleed into host page
- Multiple independent instances per page
- A–Z letter index sorted by course subject title (not award prefix)
- Only courses with scheduled events are shown
- Module ID and Course code footnote on each course detail view
- WCAG 2.2 AA compliant

## Updating the data

Replace `data.js` with a freshly generated file from updated spreadsheets. No other changes needed.

## Changelog

**v1.2 (2026-06-08)**
- Courses with no timetable events are now hidden from search results entirely

**v1.1 (2026-06-08)**
- Removed Module ID / Event ID from individual timetable rows (kept in course detail footnote)
- Fixed A–Z letter index to sort by course subject title, not award prefix; fixed non-alpha characters appearing as index entries
