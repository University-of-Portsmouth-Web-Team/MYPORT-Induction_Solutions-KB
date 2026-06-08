# Solution 1 — Standalone Static Site

A self-contained multi-file site for the University of Portsmouth induction timetable.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Entry point |
| `styles.css` | All styles |
| `app.js` | Application logic |
| `data.js` | Timetable data |

## Usage

Open `index.html` in a browser, or deploy to any static host (GitHub Pages, Netlify, SharePoint, etc.). No server or build step required.

## Features

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

## Updating the data

To refresh from a new Scientia/SITS export, regenerate `data.js` from the updated spreadsheets and drop it in alongside the other files. The rest of the site requires no changes.

## Changelog

**v1.2 (2026-06-08)**
- Courses with no timetable events are now hidden from search results entirely

**v1.1 (2026-06-08)**
- Removed Module ID / Event ID from individual timetable rows (kept in course detail footnote)
- Fixed A–Z letter index to sort by course subject title, not award prefix (BA/BSc/MSc etc.); also fixed non-alpha characters (brackets, hyphens) appearing as index entries
- Added Module ID / Course code footnote to course detail page (was missing from this solution)
- Removed "Induction module ID" and "Course code" rows from the right-hand detail card (IDs now appear only in the footnote)
