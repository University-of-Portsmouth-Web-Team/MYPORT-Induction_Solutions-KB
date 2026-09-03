# Solution 1 — Standalone Static Site

A self-contained multi-file site for the University of Portsmouth induction timetable.

The page is deliberately **chrome-free**: there is no site header, breadcrumb, page hero or footer. The first thing a user sees is the search bar. This makes the page safe to embed in MyPort, where the host page already supplies the masthead, breadcrumb, page title, intro copy and footer.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Entry point |
| `styles.css` | All styles |
| `app.js` | Application logic |
| `analytics.js` | GA4 custom-event tracking (INS-873) |
| `data.js` | Timetable data |
| `favicon.png` | UoP logo — favicon |

## Usage

Open `index.html` in a browser, or deploy to any static host (GitHub Pages, Netlify, SharePoint, etc.). No server or build step required.

## Features

- Chrome-free layout — starts at the search bar, no header/hero/footer to duplicate the host page
- Keyword search with debounce
- A–Z letter index sorted by course subject title (not award prefix)
- UG / PGT / All filter chips with live result count
- Year-of-study selector with event count badges
- Contextual welcome text (UG Year 1 / UG returning / PGT)
- Timetable ordered by date → time
- Online event badge
- Module ID and Course code footnote on each course detail page
- Queries, International Students, and Further Information sections
- Hash-based routing for deep linking and browser back/forward
- WCAG 2.2 AA compliant
- GA4 custom-event analytics that degrade silently if the tag is blocked

## Design system

Styled with the **MyPort design system** (Storybook palette + production stylesheets from myport.port.ac.uk):

| Token | Value | Usage |
|-------|-------|-------|
| Primary (blue) | `#0078B4` | Headers, buttons, links, table headers |
| Primary dark | `#005681` | Hover accents |
| Heading purple | `#3C023C` | All headings & course names (Storybook Primary Dark) |
| Button hover | `#004F76` | Button/link hover states |
| Accent blue | `#00A0FF` | Highlights |
| Secondary (purple) | `#621360` | PGT accents |
| Light blue | `#F2FAFF` | Tinted backgrounds, info panels |
| Dark grey | `#505457` | Body text |
| Off white | `#FAFAFA` | Page background |

Typography matches MyPort: **Open Sans** for body text and **Encode Sans Expanded** for headings and buttons (Aero, MyPort's h1 font, is licensed and not publicly available — Encode Sans Expanded is its designated fallback in the MyPort stylesheets). Corners are square, in line with MyPort's flat component styling. All colour combinations have been checked against WCAG 2.2 AA contrast requirements.

## Updating the data

To refresh from a new Scientia/SITS export, regenerate `data.js` from the updated spreadsheets and drop it in alongside the other files. The rest of the site requires no changes.

## Analytics

Tracking is implemented as **GA4 custom events**, not page views.

The app routes on the URL fragment (`…/solution1/#detail/{course-slug}/{year-n}`). GA4's page-path reporting dimensions exclude everything after the `#`, so a page-view-based setup would have recorded every screen as `/MYPORT-Induction_Solutions-KB/solution1/` and told us nothing. Custom events sidestep the problem entirely by carrying the course and year as event parameters.

### Events

| Event | Parameters | Fires when |
|-------|-----------|------------|
| `course_view` | `course_name`, `year`, `course_type`, `entry_method` | A course timetable is opened |
| `course_search` | `search_term`, `result_count` | A keyword search settles (debounced, 300ms) |
| `alpha_index_click` | `letter` | The A–Z index is used |
| `course_filter` | `filter` | The All / Undergraduate / Postgraduate filter changes |

### `course_view` parameters

| Parameter | Example | Notes |
|-----------|---------|-------|
| `course_name` | `BA (Hons) Criminology and Forensic Investigation` | Plain course title exactly as shown to the user — not a slug or ID |
| `year` | `Year 1`, `Foundation Year` | The label, not a number, because "Foundation Year" has no numeric equivalent |
| `course_type` | `UG`, `PGT`, `Other` | From the source data |
| `entry_method` | `listing`, `year_tab`, `deep_link` | How the user reached the timetable — see below |

`entry_method` distinguishes opening a course from the search listing, switching year using the tabs once already inside a course, and arriving directly on a shared or bookmarked link.

### GA4 setup required

These parameters need registering as **custom dimensions** (Admin → Custom definitions → Create custom dimension, scope: Event) before they appear in reports. Parameters are only collected from the point the dimension is created — they are not backfilled.

Recommended: turn **off** Enhanced measurement → Page views → *"Page changes based on browser history events"* for this data stream. The app uses `pushState` for routing and the A–Z index uses real anchor links, so leaving it on generates page views that carry no useful path.

### Verifying without GA4 access

Append `?uop_debug=1` to the URL and every event is logged to the browser console as it fires:

```
https://university-of-portsmouth-web-team.github.io/MYPORT-Induction_Solutions-KB/solution1/?uop_debug=1
```

Setting `window.UOP_ANALYTICS_DEBUG = true` in the console does the same. This works whether or not the Google tag itself loaded.

### Privacy

No personal data is collected — only course names, years and search terms. `search_term` is free text, so in principle a student could type something identifying into it; the field is capped at 60 characters and this is worth a look during validation. Cookie consent for this data stream is an open question, since the app is served from `github.io` rather than `port.ac.uk` and so sits outside MyPort's consent banner.

## Changelog

**v2.0 (2026-09-03)**
- **GA4 analytics added (INS-873).** Google tag `G-BVP9PTRZJL` ("Induction Timetables" data stream on the MyPort property) added to `index.html`, with all tracking logic in a new self-contained `analytics.js`
- **`course_view` custom event** fires whenever a timetable is opened, carrying `course_name`, `year`, `course_type` and `entry_method`. This replaces the page-view approach, which could not work: GA4's page-path dimensions strip everything after the `#`, so all screens would have collapsed into a single row for `/solution1/`
- **Supporting events** `course_search`, `alpha_index_click` and `course_filter` answer the original question in the ticket about whether students prefer keyword search or the A–Z index. They are independent of `course_view` and can be removed without affecting it
- **De-duplication.** `course_view` will not fire twice for the same course + year in a row. The guard clears on return to the listing, so genuinely re-opening a timetable is counted again
- **Fail-safe by design.** Every tracking call is wrapped and guarded on `gtag` being present. If `analytics.js` is missing, the Google tag is blocked, or there is no network, the timetable works exactly as before
- **Fixed: detail-view year tabs left the URL stale.** Switching year inside a course re-rendered in place without updating the address bar, so "copy link" shared whichever year the user first arrived on. Now kept in sync with `replaceState` — chosen over `pushState` so the back button still returns to the listing rather than stepping through every year tab
- Parameter values are capped at GA4's 100-character limit (longest current course name is 84, so nothing is truncated in practice)

**v1.9 (2026-09-02)**
- **Duplicate events suppressed.** Events are de-duplicated by Induction Module ID + Event ID before rendering, so a session booked against several course descriptors appears once. Module `I00360` now shows 11 events rather than 22
- **Room/building pairs listed one per line.** Multi-room bookings previously showed a single room number followed by the building name repeated once per room. `buildLocationHtml()` now reads the paired `locations[]` array and renders a `<ul class="location-list">`, one `room, building` pair per line, with an `aria-label` giving the room count. "Restart a Heart" (module `I00360`) now correctly lists 11 rooms against St. Andrew's Court
- **URLs in event details are hyperlinked on their own line.** Links extracted by the pipeline render in a `.event-links` block below the description, each as a block-level anchor with delimiters stripped and self-describing text ("Join the Teams meeting", "Join the Zoom meeting", "Open <hostname>"), `target="_blank"`, `rel="noopener noreferrer"` and a visually hidden "(opens in a new tab)" warning
- `linkifyDescription()` kept as a fallback for any URL still sitting inline in an older `data.js`, now matching bare URLs as well as bracketed ones
- Only `http(s)` hrefs are ever emitted (`safeUrl()`)
- Location rendering falls back to zipping the legacy flat `room` / `site` fields if `locations[]` is absent
- CSS: added `.location-list` and `.event-links`; `.event-join-link` changed from `inline-block` to `block` with `overflow-wrap: anywhere`

**v1.8 (2026-08-27)**
- Removed the site header (UoP logo, "MyPort" wordmark and breadcrumb) and the site footer
- Removed the "Undergraduate Course Inductions" page hero — heading, intro paragraph and blue gradient background band
- The page now opens directly on the search bar
- A visually hidden `<h1>` ("Course Inductions") is retained so the document keeps a valid heading structure for screen readers and validators
- "Skip to main content" link removed — with no header navigation there is nothing to skip past
- Dead CSS removed (`.site-header`, `.header-inner`, `.logo-*`, `.breadcrumb`, `.page-hero`, `.hero-*`, `.site-footer`, `.footer-inner`, `.skip-link`) and the unused `--header-height` custom property dropped; the sticky sidebar offset no longer compensates for a sticky header
- Corrected four broken MyPort links (IT Support, International Students, Campus maps, Library) — see the root README for the full mapping

**v1.7 (2026-06-11)**
- Online session URLs that appear in square brackets in event descriptions (e.g. Zoom links) are now rendered as real hyperlinks labelled "Join online session ↗", opening in a new tab with `rel="noopener noreferrer"` and a screen-reader hint that a new tab opens

**v1.6 (2026-06-11)**
- Course card names on the search page now use heading purple in all three solutions (previously still blue in Solutions 2 and 3)
- A–Z index redesigned for clarity: clickable letters render as bordered buttons (blue outline, fill on hover); unavailable letters are dimmed with no border
- All remaining curved elements removed — zero border-radius throughout (pills, badges, year buttons, spinners, cards), matching MyPort's flat styling
- Timetable date separators are now solid purple bands with white text, clearly dividing each day's events
- Official UoP logo (favicon.png) added as the favicon and header/sidebar logo mark in every solution

**v1.5 (2026-06-11)**
- Accessibility audit: fixed event-count badges that were unreadable until hover (now white on dark purple `#3C023C`, 16.6:1)
- Headings and course card names changed from blue to dark purple `#3C023C` so they aren't mistaken for links
- All translucent white text on blue backgrounds replaced with solid white (breadcrumbs, hero text, footers, sidebar, "Back to MyPort" link)
- Sidebar hover/active states now darken to `#004F76` instead of lightening, keeping white text at 8.8:1
- Every foreground/background pair re-verified against WCAG 2.2 AA (4.5:1 text, 3:1 non-text)

**v1.4 (2026-06-11)**
- Restyled to the MyPort design system: blue-primary Storybook palette, Open Sans / Encode Sans Expanded typography, square corners, MyPort focus/hover states

**v1.2 (2026-06-08)**
- Courses with no timetable events are now hidden from search results entirely

**v1.1 (2026-06-08)**
- Removed Module ID / Event ID from individual timetable rows (kept in course detail footnote)
- Fixed A–Z letter index to sort by course subject title, not award prefix (BA/BSc/MSc etc.); also fixed non-alpha characters (brackets, hyphens) appearing as index entries
- Added Module ID / Course code footnote to course detail page (was missing from this solution)
- Removed "Induction module ID" and "Course code" rows from the right-hand detail card (IDs now appear only in the footnote)
