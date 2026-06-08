#!/usr/bin/env python3
"""
generate_data.py
────────────────
Converts two Scientia/SITS xlsx exports into data.js files for all three
induction timetable solutions.

Expected input files (place in the /data directory):
  - *modules*.xlsx   — Induction Modules export (Sheet2, columns: Mod Code,
                        Mod Name, Inst, Crs Code, Crs Name, Comp-Avail, Course Year)
  - *tt*.xlsx        — Timetable events export (columns: Event Id, Weeks, Day,
                        Time, Finish, Length, Module, Mod, Details, Site, Room)

Usage:
  python scripts/generate_data.py
  python scripts/generate_data.py --modules data/modules.xlsx --events data/events.xlsx

Output:
  solution1/data.js
  solution2/data.js
  solution3/data.js
  (all three are identical — one shared data format used by all solutions)
"""

import argparse
import glob
import json
import os
import sys

try:
    import pandas as pd
except ImportError:
    print("ERROR: pandas is required.  Run:  pip install pandas openpyxl")
    sys.exit(1)


# ── Helpers ───────────────────────────────────────────────────────────────────

def find_file(directory: str, pattern: str) -> str | None:
    """Return the first file in *directory* whose name matches *pattern* (glob)."""
    matches = glob.glob(os.path.join(directory, pattern))
    return matches[0] if matches else None


def get_course_type(crs_code: str) -> str:
    s = str(crs_code).strip()
    if s.startswith("U"):
        return "UG"
    elif s.startswith("P"):
        return "PGT"
    else:
        return "Other"


def format_time(t) -> str:
    """Convert HH:MM:SS / timedelta string to 12-hour format e.g. '10:00am'."""
    if pd.isna(t) or str(t).strip() in ("nan", "NaT", ""):
        return ""
    s = str(t).strip()
    # pandas may return timedelta like '0 days 10:00:00'
    if "days" in s:
        s = s.split("days")[-1].strip()
    parts = s.split(":")
    if len(parts) >= 2:
        try:
            h = int(parts[0])
            m = int(parts[1])
            period = "am" if h < 12 else "pm"
            h12 = h % 12 or 12
            return f"{h12}:{m:02d}{period}"
        except ValueError:
            pass
    return s


def format_date(d) -> str:
    if pd.isna(d):
        return ""
    return pd.Timestamp(d).strftime("%A %d %B %Y")


def format_date_sort(d) -> str:
    if pd.isna(d):
        return ""
    return pd.Timestamp(d).strftime("%Y-%m-%d")


# ── Core data builder ─────────────────────────────────────────────────────────

def build_courses(modules_path: str, events_path: str) -> list[dict]:
    print(f"  Reading modules: {modules_path}")
    # The modules file uses Sheet2 in the original export; fall back to first sheet
    try:
        df_modules = pd.read_excel(modules_path, sheet_name="Sheet2")
    except Exception:
        df_modules = pd.read_excel(modules_path)

    print(f"  Reading events:  {events_path}")
    # The events file has one named sheet; read whichever is first
    df_events = pd.read_excel(events_path)

    # Normalise column names (strip whitespace)
    df_modules.columns = [c.strip() for c in df_modules.columns]
    df_events.columns  = [c.strip() for c in df_events.columns]

    # Validate required columns
    required_mod = {"Mod Code", "Crs Name", "Crs Code", "Course Year"}
    required_ev  = {"Event Id", "Weeks", "Day", "Time", "Finish", "Module",
                    "Details", "Site", "Room"}
    missing_mod = required_mod - set(df_modules.columns)
    missing_ev  = required_ev  - set(df_events.columns)
    if missing_mod:
        print(f"ERROR: modules file is missing columns: {missing_mod}")
        sys.exit(1)
    if missing_ev:
        print(f"ERROR: events file is missing columns: {missing_ev}")
        sys.exit(1)

    df_modules["course_type"] = df_modules["Crs Code"].apply(get_course_type)

    # Build an event lookup keyed by module code for speed
    events_by_mod: dict[str, list] = {}
    for _, ev in df_events.iterrows():
        mod_code = str(ev["Module"]).strip()
        if mod_code not in events_by_mod:
            events_by_mod[mod_code] = []

        details    = str(ev["Details"]) if not pd.isna(ev["Details"]) else ""
        comma_pos  = details.find(",")
        if comma_pos > 0:
            title       = details[:comma_pos].strip()
            description = details[comma_pos + 1:].strip()
        else:
            title       = details.strip()
            description = ""

        site = str(ev["Site"]) if not pd.isna(ev["Site"]) else ""
        room = str(ev["Room"]) if not pd.isna(ev["Room"]) else ""

        # De-duplicate repeated site values (some rows have "Park Building, Park Building, …")
        if "," in site:
            site = site.split(",")[0].strip()

        is_online = (
            room.lower() in ("online", "online13")
            or site.lower() == "online"
        )

        events_by_mod[mod_code].append({
            "event_id":   int(ev["Event Id"]),
            "date":       format_date(ev["Weeks"]),
            "date_sort":  format_date_sort(ev["Weeks"]),
            "day":        str(ev["Day"]),
            "time":       format_time(ev["Time"]),
            "finish":     format_time(ev["Finish"]),
            "title":      title,
            "description": description,
            "site":       site,
            "room":       room,
            "is_online":  is_online,
            "mod_code":   mod_code,
        })

    # Sort each module's events by date then time
    for mod_code in events_by_mod:
        events_by_mod[mod_code].sort(key=lambda x: (x["date_sort"], x["time"]))

    # Assemble per-course structure
    courses_data: dict[str, dict] = {}
    for _, mod_row in df_modules.iterrows():
        crs_name = str(mod_row["Crs Name"]).strip()
        if not crs_name or crs_name == "nan":
            continue

        if crs_name not in courses_data:
            courses_data[crs_name] = {
                "name":        crs_name,
                "crs_code":    str(mod_row["Crs Code"]).strip(),
                "course_type": mod_row["course_type"],
                "years":       {},
            }

        year     = int(mod_row["Course Year"])
        mod_code = str(mod_row["Mod Code"]).strip()
        events   = events_by_mod.get(mod_code, [])

        courses_data[crs_name]["years"][year] = {
            "year":     year,
            "mod_code": mod_code,
            "events":   events,
        }

    # Sort alphabetically by course name, return as list
    courses_list = sorted(courses_data.values(), key=lambda x: x["name"].upper())

    # Summary
    total_events   = sum(len(y["events"]) for c in courses_list for y in c["years"].values())
    with_events    = sum(1 for c in courses_list if any(len(y["events"]) > 0 for y in c["years"].values()))
    without_events = len(courses_list) - with_events

    print(f"  Courses total:         {len(courses_list)}")
    print(f"  Courses with events:   {with_events}  (shown in search)")
    print(f"  Courses without events:{without_events}  (hidden from search by the UI)")
    print(f"  Total events:          {total_events}")

    return courses_list


def write_data_js(courses_list: list[dict], output_path: str) -> None:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    payload = json.dumps(courses_list, separators=(",", ":"), ensure_ascii=False)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("window.__COURSES_DATA__ = ")
        f.write(payload)
        f.write(";")
    size_kb = os.path.getsize(output_path) / 1024
    print(f"  Written → {output_path}  ({size_kb:.0f} KB)")


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate data.js for all three induction timetable solutions.")
    parser.add_argument("--modules", default=None,
                        help="Path to the induction modules xlsx (auto-detected from data/ if omitted)")
    parser.add_argument("--events",  default=None,
                        help="Path to the timetable events xlsx (auto-detected from data/ if omitted)")
    args = parser.parse_args()

    # Locate files
    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")

    modules_path = args.modules or find_file(data_dir, "*modules*") or find_file(data_dir, "*Modules*") or find_file(data_dir, "*Induction*")
    events_path  = args.events  or find_file(data_dir, "*tt*")      or find_file(data_dir, "*timetable*") or find_file(data_dir, "*events*") or find_file(data_dir, "*ind_tt*")

    if not modules_path or not os.path.exists(modules_path):
        print("ERROR: Could not find the modules xlsx.")
        print("  Place it in the data/ directory, or pass --modules <path>")
        print(f"  Looked in: {os.path.abspath(data_dir)}")
        sys.exit(1)

    if not events_path or not os.path.exists(events_path):
        print("ERROR: Could not find the events/timetable xlsx.")
        print("  Place it in the data/ directory, or pass --events <path>")
        print(f"  Looked in: {os.path.abspath(data_dir)}")
        sys.exit(1)

    print("\n─── Induction Timetable Data Generator ───────────────────────────")
    print(f"Modules file: {modules_path}")
    print(f"Events file:  {events_path}")
    print()

    # Build
    print("Building course data…")
    courses_list = build_courses(modules_path, events_path)

    # Write to all three solution folders
    print("\nWriting data.js files…")
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for solution in ("solution1", "solution2", "solution3"):
        out = os.path.join(repo_root, solution, "data.js")
        write_data_js(courses_list, out)

    print("\n✓ Done.  All three data.js files updated.")
    print("  Commit and push to trigger a deployment, or open any solution locally.")


if __name__ == "__main__":
    main()
