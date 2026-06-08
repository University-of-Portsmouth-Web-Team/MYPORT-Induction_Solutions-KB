# Solution 3 — Progressive Web App (App Shell)

A richer, app-style experience with a persistent sidebar and panel-based navigation.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Entry point with app-shell layout |
| `styles.css` | All styles |
| `app.js` | Application logic |
| `data.js` | Timetable data |

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

## Updating the data

Replace `data.js` with a freshly generated file from updated spreadsheets. No other changes needed.

## Changelog

**v1.2 (2026-06-08)**
- Courses with no timetable events are now hidden from search results entirely

**v1.1 (2026-06-08)**
- Removed Module ID / Event ID from individual timetable rows (kept in course detail footnote)
- Fixed A–Z letter index to sort by course subject title, not award prefix; fixed non-alpha characters appearing as index entries
