# Solution 3 — Progressive Web App (App Shell)

A richer, app-style experience with a persistent sidebar and panel-based navigation.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Entry point with app-shell layout |
| `styles.css` | All styles |
| `app.js` | Application logic |
| `data.js` | Timetable data |
| `favicon.png` | UoP logo — favicon and header logo mark |

## Usage

Open `index.html` in a browser, or deploy to any static host. No server or build step required.

## Features

- App-shell layout with persistent left sidebar:
  - **Find My Course** — keyword search + A–Z index + UG/PGT filter
  - **Recently Viewed** — session-based history (up to 8 courses, clears on tab close)
  - **About Inductions** — contextual help text
- A–Z letter index sorted by course subject title (not award prefix)
- Only courses with scheduled events are shown
- Year-of-study tabs with event count badges
- Timetable ordered by date → time
- Online event badge
- Module ID and Course code footnote on each course detail page
- Queries, International Students, and Further Information sections
- Hash-based deep linking (`#detail/course-slug/year`) — shareable URLs, browser back/forward
- Collapses to single-column layout on mobile
- WCAG 2.2 AA compliant

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

Replace `data.js` with a freshly generated file from updated spreadsheets. No other changes needed.

## Changelog

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
- Fixed A–Z letter index to sort by course subject title, not award prefix; fixed non-alpha characters appearing as index entries
