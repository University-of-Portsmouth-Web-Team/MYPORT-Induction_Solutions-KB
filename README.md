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
| `Details` | `Event title, description` — split on the first comma |
| `Site` | Building name |
| `Room` | Room number; `Online` / `Online13` = virtual event |

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
