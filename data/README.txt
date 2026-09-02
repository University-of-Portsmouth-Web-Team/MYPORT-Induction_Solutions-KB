Place your xlsx export files here before running the data generation workflow.

Expected files
──────────────
  *modules*.xlsx   — Induction Modules export from SITS/Scientia
                     (Sheet2, columns: Mod Code, Mod Name, Inst, Crs Code,
                      Crs Name, Comp-Avail, Course Year)

  *tt*.xlsx        — Timetable events export from SITS/Scientia
                     (columns: Event Id, Weeks, Day, Time, Finish, Length,
                      Module, Mod, Details, Site, Room)

Known faults in the 2026/27 export (worked around on read — see the
"Data-quality workarounds" section of the root README):

  * Event rows are duplicated once per course descriptor. De-duplicated on
    (Module, Event Id).
  * "Site" and "Room" are TRANSPOSED: Site holds the room number, Room holds
    the building name. Swapped back on read.
  * Multi-room bookings arrive as two parallel comma-separated lists of equal
    length. Zipped index-for-index into room/building pairs.
  * URLs are embedded in the Details text, sometimes in [square brackets].
    Extracted into their own field before the title/description split.

The generate_data.py script auto-detects these files by name pattern.
If your filenames differ, pass them explicitly:

  python scripts/generate_data.py \
    --modules data/my_modules_file.xlsx \
    --events  data/my_events_file.xlsx
