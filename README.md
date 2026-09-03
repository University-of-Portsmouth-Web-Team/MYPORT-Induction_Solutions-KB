# UoP Induction Timetable — Proof of Concept

Three HTML/CSS/JS proof-of-concept solutions for the University of Portsmouth induction timetable, built for **UX-571**. All three read from the same shared `data.js` file, generated automatically from Scientia/SITS xlsx exports via a GitHub Actions workflow.

---

## Repository structure

```
├── .github/
│   └── workflows/
│       └── generate-data.yml   ← GitHub Action: generates data + deploys to Pages
├── scripts/
│   └── generate_data.py        ← Data build script (runs in the Action or locally)
├── data/
│   ├── README.txt              ← Where to place xlsx exports
│   └── (your .xlsx files here)
├── solution1/                  ← Standalone static site
├── solution2/                  ← Embeddable JS widget + demo pages
├── solution3/                  ← Progressive web app (app-shell)
├── index.html                  ← GitHub Pages landing page (links to all 3)
├── .gitignore
└── README.md                   ← This file
```

---

## Quick start

### 1. Create the GitHub repository

Create a new **public** repository on GitHub (public is required for the free GitHub Pages tier). Private repos need a paid plan for Pages.

### 2. Push this code

```bash
# From inside the unzipped folder:
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_ORG/YOUR_REPO.git
git push -u origin main
```

### 3. Enable GitHub Pages

1. Go to **Settings → Pages** in your repository
2. Under **Source**, select **GitHub Actions**
3. Save

That's it — the next time the workflow runs it will publish the site.

### 4. Trigger the first deployment

Go to **Actions → Generate Data & Deploy to GitHub Pages → Run workflow → Run workflow**.

After ~1 minute your three solutions will be live at:

```
https://YOUR_ORG.github.io/YOUR_REPO/               ← Landing page
https://YOUR_ORG.github.io/YOUR_REPO/solution1/     ← Standalone site
https://YOUR_ORG.github.io/YOUR_REPO/solution2/demo-search-page.html  ← Widget demo
https://YOUR_ORG.github.io/YOUR_REPO/solution3/     ← PWA
```

These URLs work on any device — desktop, tablet, mobile.

---

## Why the "Run workflow" button wasn't visible

The `workflow_dispatch` trigger (which creates the manual "Run workflow" button) **only appears in the Actions tab once the workflow file exists on the default branch** (`main` or `master`). It will not appear if the file was only ever on a different branch, or if the repo was just created and not yet pushed.

The fix: push to `main` first, then refresh the Actions tab — the button will appear.

---

## Updating the timetable data

### Option A — Automatic (push xlsx files to trigger the Action)

```bash
# Add your new exports to data/
cp /path/to/Induction_Modules_Jan_2026.xlsx data/
cp /path/to/ind_tt_20250922.xlsx            data/

git add data/
git commit -m "chore: add new timetable exports"
git push
```

Pushing xlsx files to the `data/` directory on `main` triggers the workflow automatically. It will regenerate all three `data.js` files, commit them, and redeploy GitHub Pages.

### Option B — Manual trigger

1. Commit xlsx files to `data/` and push (so the workflow can read them)
2. Go to **Actions → Generate Data & Deploy to GitHub Pages**
3. Click **Run workflow → Run workflow**

The **Deploy to GitHub Pages** toggle lets you regenerate data without redeploying if needed.

### Option C — Run locally

```bash
pip install pandas openpyxl

python scripts/generate_data.py
# or with explicit paths:
python scripts/generate_data.py \
  --modules data/my_modules.xlsx \
  --events  data/my_events.xlsx

git add solution1/data.js solution2/data.js solution3/data.js
git commit -m "chore: regenerate data.js"
git push
```

---

## Expected xlsx column names

### Modules file (`*modules*.xlsx` or `*Induction*.xlsx`, Sheet2)

| Column | Description |
|--------|-------------|
| `Mod Code` | Primary key, e.g. `I00017` |
| `Crs Code` | Course code prefix determines type: `U…` = UG, `P…` = PGT |
| `Crs Name` | Course title displayed in the UI |
| `Course Year` | Year of study (integer, 0–6) |

### Events file (`*tt*.xlsx`)

| Column | Description |
|--------|-------------|
| `Event Id` | Unique event ID |
| `Weeks` | Date (datetime column) |
| `Time` / `Finish` | Start and end times (HH:MM:SS) |
| `Module` | FK → `Mod Code` |
| `Details` | `Event title, description` — split on the first comma, **after** any URLs have been lifted out |
| `Site` | **Room number(s)** — despite the column name. Comma-separated list for multi-room bookings |
| `Room` | **Building name(s)** — despite the column name. Parallel list, same length as `Site`; `Online…` = virtual event |

> ⚠️ **`Site` and `Room` are transposed in the export.** The pipeline swaps them
> back on read — see [Data-quality workarounds](#data-quality-workarounds-v19).

---

## The three solutions

| | Solution 1 | Solution 2 | Solution 3 |
|---|---|---|---|
| **Type** | Standalone site | Embeddable widget | PWA / app shell |
| **Entry point** | `index.html` | `demo-search-page.html` | `index.html` |
| **Best for** | Microsite or iframe | Native MyPort integration | Richer standalone portal |
| **Pages URL** | `/solution1/` | `/solution2/demo-search-page.html` | `/solution3/` |

All three are WCAG 2.2 AA compliant. See the `README.md` in each solution folder for details.


---

## Design system

All three solutions are styled with the **MyPort design system**, using the Storybook colour palette and production stylesheets from `myport.port.ac.uk`. MyPort uses blue as its primary colour:

| Token | Hex | Storybook name |
|-------|-----|----------------|
| Primary | `#0078B4` | secondary-dark (MyPort primary blue) |
| Primary dark | `#005681` | MyPort primary-dark |
| Heading purple | `#3C023C` | Primary Dark — all headings & course names |
| Button hover | `#004F76` | Darker blue — button hover |
| Accent | `#00A0FF` | secondary (light blue) |
| Secondary | `#621360` | primary (light purple) |
| Light blue | `#F2FAFF` | light-blue |
| Body text | `#505457` | dark-grey |
| Background | `#FAFAFA` | off-white |

Typography: **Open Sans** (body) and **Encode Sans Expanded** (headings/buttons), matching MyPort's production CSS. Components use square corners per MyPort's flat design language. WCAG 2.2 AA contrast maintained throughout.

---

## Changelog

| Version | Date | Notes |
|---------|------|-------|
| v2.1 | 2026-09-03 | **Course identity fixed — WD-1076.** A course is now identified by its **course code**, not by its name. Keying on the name split one course across several cards where the export spelled it inconsistently (`BA (Hons)` vs `BA (hons)`), and merged genuinely different courses that share a name (the full-time and part-time routes of one degree). Each course-year now keeps **all** its induction modules instead of only the last one read, and the pipeline stamps a guaranteed-unique `slug` that the renderers use instead of deriving one from the name at render time. Restores **25 courses** and **150 events** that were unreachable; eliminates all 12 colliding URLs |
| v2.0 | 2026-09-03 | **GA4 analytics on Solution 1 (INS-873).** Engagement is now measured with custom events rather than page views, because GA4 strips the `#` fragment the app routes on. New `course_view` event carries `course_name`, `year`, `course_type` and `entry_method`; supporting `course_search`, `alpha_index_click` and `course_filter` events answer whether students prefer keyword search or the A–Z index. Tracking lives in a new self-contained `solution1/analytics.js` and degrades silently if the Google tag is blocked. Also fixes the detail-view year tabs, which previously left the URL pointing at the year the user arrived on |
| v1.9 | 2026-09-02 | **Data-quality workarounds for the 2026/27 export.** Duplicate event rows suppressed by Induction Module ID + Event ID (10,077 → 3,206 rows). Transposed `Site`/`Room` columns un-swapped and their parallel lists zipped into room + building pairs, listed one per line — multi-room bookings no longer lose rooms or repeat the building. URLs in `Details` extracted into their own field, delimiters stripped, and rendered as a hyperlink on a new line |
| v1.8 | 2026-08-27 | **Solution 1** stripped of site header, breadcrumb, page hero and footer — page now opens on the search bar; visually hidden `<h1>` retained for accessibility. **All solutions:** four broken MyPort links corrected (IT Support, International, Campus maps, Library) |
| v1.7 | 2026-06-11 | Bracketed online-session URLs in event descriptions converted to accessible "Join online session" hyperlinks (new tab, noopener) |
| v1.6 | 2026-06-11 | Course names purple everywhere; A–Z index buttons clearly clickable; zero radius across all components; purple date separator bands; official UoP logo/favicon |
| v1.5 | 2026-06-11 | WCAG 2.2 AA audit: fixed invisible event-count badges, headings now dark purple `#3C023C` (not link-blue), all translucent text on blue made solid white, sidebar states darken not lighten |
| v1.4 | 2026-06-11 | Restyled all three solutions + landing page to the MyPort design system (blue palette, Open Sans / Encode Sans Expanded) |
| v1.3 | 2026-06-08 | Added GitHub Pages deployment; root landing page; workflow now visible on default branch |
| v1.2 | 2026-06-08 | Courses with no timetable events hidden from search |
| v1.1 | 2026-06-08 | A–Z index by subject title; removed per-event IDs; footnotes; S1 sidebar cleaned up |
| v1.0 | 2026-06-03 | Initial three-solution proof of concept |

---

## Data-quality workarounds (v1.9, extended in v2.1)

The 2026/27 timetable export (`data/ind_tt_20260902.xlsx`) arrived with several
faults that are not present in the requirement and cannot be fixed upstream in
time. The pipeline works around them on read. **None of these workarounds
change what the timetabling team needs to supply** — if a future export is
clean, they simply become no-ops.

### 1. Duplicate event rows

The export emits one row per *induction module × course descriptor*, so the
same `Event Id` repeats many times over. Rows are now de-duplicated on
`(Module, Event Id)`, keeping the first.

| | Rows |
|---|---|
| Raw export | 10,077 |
| Unique `Module` + `Event Id` | 3,206 |
| Suppressed | 6,871 |

This is **lossless**: every timetable-bearing column (`Weeks`, `Day`, `Time`,
`Finish`, `Details`, `Site`, `Room`) was verified identical within all 3,206
groups. Only the `Mod` course-descriptor string varies, and that is not used
by the timetable view.

All three renderers also de-duplicate defensively at render time, so an older
`data.js` still displays correctly.

### 2. Transposed `Site` / `Room` columns

The export puts the **room number** in `Site` and the **building name** in
`Room`. These are swapped back on read, so the emitted data has `room` =
room number and `site` = building name.

### 3. Parallel room lists (the reported bug)

Multi-room bookings arrive as two comma-separated lists of **equal length** —
one entry per booked room:

```
Site: "2.01, 2.02, 2.03, 2.04, 2.05, 2.14, 2.15, 2.16, 2.17, 3.04, 3.05"
Room: "St. Andrew's Court, St. Andrew's Court, St. Andrew's Court, …"   (×11)
```

The previous pipeline kept only the **first** `Site` value and printed the
whole `Room` string, which is why room numbers disappeared and the building
appeared repeated. The two lists are now zipped index-for-index into
`locations[]` room/building pairs and rendered one pair per line:

> 📍 2.01, St. Andrew's Court
> 2.02, St. Andrew's Court
> … (11 lines)

Verified across all 10,077 rows: the two lists are **always** the same length,
so the zip never drops a value. If a future export does mismatch, a single
value on one side is broadcast across the other, and anything else is padded
rather than truncated. Identical repeated pairs are collapsed.

327 events are multi-room. Example: module `I00360` (BSc (Hons) Diagnostic
Radiography and Medical Imaging, Year 1) now shows **11 events**, with the
"Restart a Heart" session listing **11 rooms** against St. Andrew's Court.

### 4. URLs inside `Details`

Meeting links appear inline, sometimes wrapped in `[square brackets]`, and in
one case *in front of* the session name — where the title/description comma
split swallowed it as the title. URLs are now lifted out of `Details`
**before** that split, then emitted as `links[]` and rendered as a hyperlink on
its own line (`target="_blank"`, `rel="noopener noreferrer"`, with a
screen-reader "opens in a new tab" warning).

Handled on extraction:

- Surrounding delimiters `[ ] ( ) < > " '` and trailing punctuation stripped
- Dangling connector labels removed (`Meeting link:`, `Microsoft Teams Link:`,
  `Help session link:` — left behind once the URL is gone)
- Doubled commas around the removal point tidied
- Duplicate URLs within one event collapsed
- Link text derived from the host: *Join the Teams meeting*, *Join the Zoom
  meeting*, or *Open &lt;hostname&gt;* for anything else

**358 events** now carry a working link.

### 5. Course identity: the name is not a key (WD-1076)

Reported as "false duplicate pages not showing". The report was right that
pages were unreachable, but the duplicates were not duplicates — and the
underlying fault was wider than the twelve rows listed.

The pipeline used to key its course dictionary on the `Crs Name` string, and
the renderers built the address-bar slug by lower-casing that same name at
render time. Because the name carried the identity, two opposite failures
happened at once.

**One real course split into several cards.** `BA (Hons) Fashion and Textile
Design` and `BA (hons) Fashion and Textile Design` are both course `U2437PYC`,
but a single lower-case *h* made them separate entries. Both slugified to
`ba-hons-fashion-and-textile-design`, so the router's `find()` returned
whichever came first and the other was unreachable. Eight of the twelve
reported rows are this.

**Several real courses collapsed into one card.** 53 course names in the
export are shared by two or three *different* course codes — almost all
full-time versus part-time routes (`MSc Civil Engineering` is both `P3388FTC`
and `P3388PTC`). Those merged into a single card, and since `years[year]`
held only one module, one route's induction silently overwrote the other's.
This is the more serious of the two: it did not hide a page, it showed
students **the wrong timetable**.

Courses are now keyed on `Crs Code`. One canonical display name is chosen per
code from the spellings the export actually used — visibly malformed ones
lose (a trailing `Year 1`, a doubled final word), then the most frequent wins,
then the longest. So `BA (Hons)` beats a one-off `BA (hons)`, and
`(Full Time)` is kept in preference to the bare name. The rejected spellings
survive in `name_variants[]` and remain searchable.

| | Before | After |
|---|---|---|
| Cards in the listing | 734 | **668** (one per course code) |
| Colliding URL slugs | 12 | **0** |
| Courses visible in search | 387 | **412** |
| Events reachable | 2,998 | **3,148** |
| Induction modules never reachable | 251 | **0** |

### 6. More than one induction module per course-year (WD-1076)

`years[year]` held a single module, so where a course-year had more than one
the later row overwrote the earlier one. **251 modules** were unreachable this
way, 80 of which had timetabled sessions — **212 event rows silently dropped**.

Each year now carries a `modules[]` list and `mod_codes[]`, and the union of
their events de-duplicated on `Event Id`. The scalar `mod_code` is still
emitted so an older renderer keeps working. 263 course-years are affected.

### 7. Guaranteed-unique slugs (WD-1076)

The pipeline now stamps an explicit `slug` and `id` (the course code) on every
course, and all three renderers use them instead of re-deriving a slug from the
name. Where two courses would still produce the same slug, the resolver first
looks for another spelling of one of them that the export already provides —
this is what separated `BEng (Hons) Civil Engineering DA` (`U3802PDC`) from
`BEng (Hons) Civil Engineering (Degree Apprenticeship)` (`U2896PDC`) with no
hand-coding. Failing that, the course code is appended, so a link can never
resolve to the wrong course.

Links shared before this change still work: the router matches the stamped
slug first and falls back to the old name-derived rule.

Where two courses the student can actually see still share a display name
(**33 cases**, almost all full-time/part-time pairs), the course code is shown
beside the name so they can tell which is which. It is deliberately *not*
shown when the twin has no timetabled sessions and is therefore hidden, since
that would be noise rather than a disambiguator.

### Known faults left alone deliberately

| Fault | Why | Action |
|---|---|---|
| Three Teams `meetup-join` URLs truncated mid-string by the export's field-length limit | A "Join the Teams meeting" button that 404s is worse for a student than visible raw text | Left as plain text so the School notices. Detected by the absence of `%40thread` |
| One `https://student-system` with no TLD | Same — cannot resolve | Left as plain text |
| Mojibake in at least one description (`KarenÂ¿s recent research`) | Character-encoding fault at source; guessing the intended character risks corrupting other rows | **Raise with the timetabling team** |
| Descriptions truncated mid-word (`…get the most out of librar`) | Field-length limit at source | **Raise with the timetabling team** |
| 33 pairs of courses share a name with no distinguishing wording, e.g. `MSc Civil Engineering` for both `P3388FTC` and `P3388PTC` | The code suffixes correlate with study mode but not cleanly enough to derive a "Full Time"/"Part Time" label safely — `PYC` and `FTC` both appear on full-time courses. Inventing a label risks labelling a timetable wrongly | Course code shown beside the name. **Raise with the timetabling team** — a proper mode field, or distinct names, would let us drop the codes |
| `BSc (Hons)Psychological Sciences` (`U3518PYC`) is missing a space after `(Hons)` | It is the only spelling the export gives for that code, and silently correcting course names risks changing one that is deliberate | Search normalises punctuation so students still find it by typing the name normally. **Raise with the timetabling team** |
| `BA (Hons) Fashion and Textile Design` (`U2437PYC`) has no timetabled sessions on any of its three modules | Not an app fault — `I00010`, `I01121` and `I01122` do not appear in the timetable export at all. Courses with no events are hidden by design (v1.2) | **Raise with the School** — the course stays hidden until sessions are timetabled |

---

## Link corrections (v1.8)

The following MyPort URLs were out of date across the solutions and have been corrected repo-wide:

| Old (broken) | New |
|--------------|-----|
| `/student-services/it-support` | `/it-support/student-it-support` |
| `/international` | `/student-services/international-student-advice` |
| `/campus-maps` | `/welcome/maps-and-directions` |
| `/study/library` | `/student-services/student-life/supporting-your-studies/library` |

All paths are relative to `https://myport.port.ac.uk`. 11 occurrences were replaced in total: 6 in Solution 1, 2 in Solution 2, 3 in Solution 3.

---

## Jira

**[UX-571](https://digitaluop.atlassian.net/browse/UX-571)** — Induction Timetable PoC
