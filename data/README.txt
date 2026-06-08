Place your xlsx export files here before running the data generation workflow.

Expected files
──────────────
  *modules*.xlsx   — Induction Modules export from SITS/Scientia
                     (Sheet2, columns: Mod Code, Mod Name, Inst, Crs Code,
                      Crs Name, Comp-Avail, Course Year)

  *tt*.xlsx        — Timetable events export from SITS/Scientia
                     (columns: Event Id, Weeks, Day, Time, Finish, Length,
                      Module, Mod, Details, Site, Room)

The generate_data.py script auto-detects these files by name pattern.
If your filenames differ, pass them explicitly:

  python scripts/generate_data.py \
    --modules data/my_modules_file.xlsx \
    --events  data/my_events_file.xlsx
