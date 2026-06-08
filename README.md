# UoP Induction Timetable — Proof of Concept

Three HTML/CSS/JS proof-of-concept solutions for the University of Portsmouth induction timetable, built for **UX-571**. All three read from the same shared `data.js` file, which is generated automatically from your Scientia/SITS xlsx exports via a GitHub Actions workflow.

---

## Repository structure

```
├── .github/
│   └── workflows/
│       └── generate-data.yml   ← GitHub Action: xlsx → data.js
├── scripts/
│   └── generate_data.py        ← Data generation script (run locally or via Action)
├── data/
│   ├── README.txt              ← Where to place your xlsx exports
│   └── (your .xlsx files go here)
├── solution1/                  ← Standalone static site
├── solution2/                  ← Embeddable JS widget
├── solution3/                  ← Progressive web app (app-shell layout)
└── README.md                   ← This file
```

---

## The three solutions

| | Solution 1 | Solution 2 | Solution 3 |
|---|---|---|---|
| **Type** | Standalone site | Embeddable widget | PWA / app shell |
| **Deploy** | Any static host | Drop into MyPort page | Any static host |
| **Entry point** | `solution1/index.html` | `<div data-uop-induction>` | `solution3/index.html` |
| **Best for** | Microsite / iframe | Native MyPort integration | Richer standalone portal |

All three are WCAG 2.2 AA compliant and share identical data and search behaviour. See the `README.md` inside each solution folder for details.

---

## Updating the timetable data

When new Scientia/SITS exports are available, there are two ways to regenerate `data.js`.

### Option A — GitHub Actions (recommended)

1. Commit your new xlsx files into the `data/` directory:

   ```bash
   git add data/your_modules_file.xlsx data/your_events_file.xlsx
   git commit -m "chore: add new timetable exports"
   git push
   ```

   The workflow triggers automatically on any push that changes files in `data/`.

2. **Or** trigger it manually from the Actions tab:
   - Go to **Actions → Generate Timetable Data → Run workflow**
   - Optionally tick **Dry run** to preview output without committing

The action installs dependencies, runs `generate_data.py`, and commits the updated `data.js` files back to all three solution folders in a single automated commit.

### Option B — Run locally

```bash
# 1. Install dependencies (one-off)
pip install pandas openpyxl

# 2. Place xlsx files in data/
cp /path/to/Induction_Modules_Jan_2026.xlsx data/
cp /path/to/ind_tt_20250922.xlsx            data/

# 3. Generate
python scripts/generate_data.py

# 4. Commit
git add solution1/data.js solution2/data.js solution3/data.js
git commit -m "chore: regenerate data.js"
git push
```

The script auto-detects xlsx filenames by pattern (`*modules*`, `*tt*`, etc.). If your filenames differ, pass them explicitly:

```bash
python scripts/generate_data.py \
  --modules data/my_modules.xlsx \
  --events  data/my_events.xlsx
```

---

## Expected xlsx column names

### Modules file (`*modules*.xlsx`, Sheet2)

| Column | Description |
|--------|-------------|
| `Mod Code` | Primary key, e.g. `I00017` |
| `Mod Name` | Full module descriptor string |
| `Inst` | Instance (Teaching Block 1 / 2) |
| `Crs Code` | Course code, e.g. `U0906PYC` |
| `Crs Name` | Course title, e.g. `BA (Hons) Accounting with Finance` |
| `Comp - Avail` | Compulsory / Available |
| `Course Year` | Integer year of study (0–6) |

### Events file (`*tt*.xlsx`)

| Column | Description |
|--------|-------------|
| `Event Id` | Unique event ID |
| `Weeks` | Date (datetime) |
| `Day` | Day abbreviation, e.g. `Mon` |
| `Time` | Start time, e.g. `10:00:00` |
| `Finish` | End time |
| `Length` | Duration |
| `Module` | FK → `Mod Code` |
| `Mod` | Full module label string |
| `Details` | `Event title, description` (split on first comma) |
| `Site` | Building name |
| `Room` | Room code; `Online` / `Online13` marks virtual events |

---

## How course type is determined

| Course code prefix | Type shown in UI |
|--------------------|-----------------|
| `U…` | Undergraduate (UG) |
| `P…` | Postgraduate Taught (PGT) |
| anything else | Other |

---

## Running locally (no build step)

Simply open the entry point file in a browser:

```bash
open solution1/index.html   # macOS
# or
start solution1/index.html  # Windows
```

No web server or build tool is needed. All three solutions are pure HTML/CSS/JS.

---

## GitHub Pages deployment (optional)

To host Solution 1 or Solution 3 on GitHub Pages:

1. Go to **Settings → Pages**
2. Set **Source** to `main` branch
3. Set the folder to `/solution1` (or `/solution3`)
4. Save — the site will be live at `https://<org>.github.io/<repo>/`

---

## Changelog

| Version | Date | Notes |
|---------|------|-------|
| v1.2 | 2026-06-08 | Courses with no timetable events hidden from search results |
| v1.1 | 2026-06-08 | A–Z index sorts by subject title not award prefix; removed per-event IDs from timetable rows; added footnotes; S1 sidebar cleaned up |
| v1.0 | 2026-06-03 | Initial three-solution proof of concept |

---

## Jira

This work tracks against **[UX-571](https://digitaluop.atlassian.net/browse/UX-571)** — Induction Timetable PoC.
