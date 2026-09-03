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

── Known data-quality workarounds (see README changelog v1.9) ────────────────
1. Duplicate event rows
   The events export repeats the same Event Id many times over — once per
   course descriptor attached to the induction module.  Rows are de-duplicated
   on (Module, Event Id); the timetable-bearing columns are identical within
   each group, so nothing is lost.

2. Transposed Site / Room columns
   The export puts the ROOM NUMBER in the "Site" column and the BUILDING NAME
   in the "Room" column.  These are swapped back on read.

3. Parallel (unpaired) room lists
   Multi-room bookings arrive as two comma-separated lists of equal length —
   e.g. Site "2.01, 2.02, 2.03" / Room "St. Andrew's Court, St. Andrew's
   Court, St. Andrew's Court".  Previously only the first Site was kept and
   the Room string was printed whole, so rooms disappeared and the building
   was repeated.  The two lists are now zipped index-for-index into
   room/building pairs and emitted as `locations[]`.

4. URLs buried in Details
   Meeting links appear inline, sometimes wrapped in [square brackets], and
   occasionally at the very start of the field (which used to swallow the
   session title).  URLs are now stripped out of the text — delimiters and
   dangling "Meeting link:" labels included — and emitted as `links[]` for
   the renderers to show on their own line.

5. Course identity is the course CODE, not the course NAME  (WD-1076)
   The modules export spells the same course several different ways —
   "BA (Hons) Fashion and Textile Design" vs "BA (hons) Fashion and Textile
   Design", "MSc Engineering Management (Full Time)" vs "MSc Engineering
   Management".  Courses used to be keyed on the raw name string, which
   caused two opposite failures at once:
     • one real course split into several cards, and
     • several real courses (e.g. the full-time and part-time routes, which
       share a name but not a code) collapsed into a single card.
   Courses are now keyed on `Crs Code`.  One canonical display name is
   chosen per code from the observed spellings; the rest are kept in
   `name_variants[]` so search still matches what the School typed.

6. Several induction modules per course-year  (WD-1076)
   `years[year]` used to hold a single module, so where a course-year had
   more than one induction module the later row silently overwrote the
   earlier one.  Each year now carries a `modules[]` list and the union of
   their events, de-duplicated on Event Id.

7. Colliding URL slugs  (WD-1076)
   The renderers built the address-bar slug by lower-casing the course name,
   so two courses whose names differed only in case or punctuation produced
   the same slug and only the first was ever reachable.  The pipeline now
   emits an explicit, guaranteed-unique `slug` per course — disambiguated
   with the course code where two courses genuinely share a name — and the
   renderers use that instead of re-deriving one.
"""

import argparse
import glob
import json
import os
import re
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


_TIME_12H_RE = re.compile(r"^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$", re.IGNORECASE)


def time_to_minutes(value) -> int:
    """Minutes past midnight for a formatted time such as '9:00am' or '12:30pm'.

    Used as a sort key so that events order chronologically.  A plain string
    sort puts '9:00am' after '10:00am' and after every pm time, because it
    compares '9' against '1' character by character.  Blank or unparseable
    values sort last rather than jumping to the top of a day.
    """
    if not value:
        return 10 ** 9
    s = str(value).strip()
    m = _TIME_12H_RE.match(s)
    if m:
        hours = int(m.group(1)) % 12
        if m.group(3).lower() == "p":
            hours += 12
        return hours * 60 + int(m.group(2) or 0)
    # Fallback: 24-hour "HH:MM" / "HH:MM:SS"
    parts = s.split(":")
    if len(parts) >= 2:
        try:
            return int(parts[0]) * 60 + int(parts[1])
        except ValueError:
            pass
    return 10 ** 9


def format_date(d) -> str:
    if pd.isna(d):
        return ""
    return pd.Timestamp(d).strftime("%A %d %B %Y")


def format_date_sort(d) -> str:
    if pd.isna(d):
        return ""
    return pd.Timestamp(d).strftime("%Y-%m-%d")


# ── URL extraction from the Details field ─────────────────────────────────────

# Matches a URL together with any opening delimiter that precedes it.  The URL
# itself is grabbed greedily (\S+) so that closing delimiters and trailing
# punctuation come along for the ride, then get trimmed off below.
_URL_RE = re.compile(r"[\[\(<\u201c\"']?\s*(?:https?://|www\.)\S+", re.IGNORECASE)

# Characters trimmed from the right-hand end of a captured URL.  Note that a
# trailing digit or letter is never trimmed, so query strings ending in
# "...9b.1" or "...QT09" survive intact.
_URL_TRAILING = "]),.;:!?>\u201d\"'}"

# Opening delimiters trimmed from the left-hand end.
_URL_LEADING = "[(<\u201c\"'"

_SENTINEL = "\x00"


def _clean_url(raw: str) -> str:
    """Strip surrounding delimiters and trailing punctuation from a raw match."""
    u = raw.strip().lstrip(_URL_LEADING).strip()
    u = u.rstrip(_URL_TRAILING)
    if u.lower().startswith("www."):
        u = "https://" + u
    return u


def is_usable_url(url: str) -> bool:
    """Reject URLs the export has clearly truncated, so they stay as plain text.

    A broken "Join the Teams meeting" button is worse for a student than the
    raw text, so anything that cannot possibly resolve is left in the
    description for the School to notice and fix at source.
    """
    m = re.match(r"^https?://([^/?#]+)", url, flags=re.IGNORECASE)
    if not m:
        return False
    host = m.group(1).split(":")[0]
    # Needs a real dotted hostname with a plausible TLD
    if not re.match(r"^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$", host):
        return False
    # Teams "meetup-join" deep links carry a thread id; without it the link
    # has been cut off by the export's field-length limit.
    if "/l/meetup-join/" in url.lower() and "%40thread" not in url.lower():
        return False
    return True


def _tidy_fragment(text: str) -> str:
    """Tidy a text fragment left behind after a URL was lifted out of it."""
    t = re.sub(r"^[\s,]+|[\s,]+$", "", text)
    # Drop a dangling connector label such as "Meeting link:" or
    # "Microsoft Teams Link:" that no longer introduces anything.
    guard = 0
    while t.endswith(":") and guard < 3:
        guard += 1
        head, _, tail = t.rpartition(",")
        if head and len(tail.strip()) <= 40:
            t = re.sub(r"[\s,]+$", "", head)
        else:
            t = re.sub(r"[\s,]+$", "", t[:-1])
            break
    return t


def extract_links(details: str) -> tuple[str, list[str]]:
    """Split *details* into (text without URLs, ordered list of unique URLs)."""
    if not details:
        return "", []

    found: list[str] = []

    def _swap(match: "re.Match[str]") -> str:
        url = _clean_url(match.group(0))
        if not url or not is_usable_url(url):   # truncated / unusable — leave it be
            return match.group(0)
        found.append(url)
        return _SENTINEL

    stripped = _URL_RE.sub(_swap, details)

    fragments = [_tidy_fragment(part) for part in stripped.split(_SENTINEL)]
    text = ", ".join(f for f in fragments if f)

    # De-duplicate while preserving order (some rows list the same link twice)
    urls = list(dict.fromkeys(found))
    return text, urls


def link_label(url: str) -> str:
    """Human-readable, self-describing link text for a meeting/resource URL."""
    host = re.sub(r"^https?://", "", url, flags=re.IGNORECASE).split("/")[0].lower()
    host = host.split(":")[0]
    if host.startswith("www."):
        host = host[4:]
    if "teams.microsoft" in host or "teams.live" in host:
        return "Join the Teams meeting"
    if "zoom.us" in host or host.endswith("zoom.com"):
        return "Join the Zoom meeting"
    if "meet.google" in host or "webex" in host or "gotomeeting" in host:
        return "Join the online meeting"
    if "panopto" in host:
        return "Watch on Panopto"
    if "moodle" in host:
        return "Open in Moodle"
    return f"Open {host}"


# ── Site / Room pairing ───────────────────────────────────────────────────────

def _split_list(value) -> list[str]:
    if pd.isna(value):
        return []
    s = str(value).strip()
    if s == "" or s.lower() in ("nan", "nat", "none"):
        return []
    return [p.strip() for p in s.split(",") if p.strip() != ""]


def build_locations(site_value, room_value) -> list[dict]:
    """Zip the parallel Site/Room lists into ordered room/building pairs.

    The export transposes the two columns: "Site" carries the room number and
    "Room" carries the building name.  Both arrive as comma-separated lists of
    equal length for multi-room bookings, one entry per booked room.
    """
    rooms     = _split_list(site_value)   # room numbers   (mislabelled "Site")
    buildings = _split_list(room_value)   # building names (mislabelled "Room")

    if not rooms and not buildings:
        return []

    # Normalise the two lists to the same length.  Equal lengths is the norm;
    # a single value on one side is broadcast across the other; anything else
    # is padded so no value is silently dropped.
    if len(rooms) != len(buildings):
        if len(rooms) == 1 and buildings:
            rooms = rooms * len(buildings)
        elif len(buildings) == 1 and rooms:
            buildings = buildings * len(rooms)
        else:
            size = max(len(rooms), len(buildings))
            rooms     = rooms     + [""] * (size - len(rooms))
            buildings = buildings + [""] * (size - len(buildings))

    pairs: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for room, building in zip(rooms, buildings):
        key = (room, building)
        if key in seen:               # suppress an identical repeated pair
            continue
        seen.add(key)
        pairs.append({"room": room, "building": building})
    return pairs


def locations_are_online(locations: list[dict]) -> bool:
    if not locations:
        return False
    return all(
        loc["building"].strip().lower().startswith("online")
        or loc["room"].strip().lower().startswith("online")
        for loc in locations
    )


# ── Course identity, canonical naming and slugs (WD-1076) ─────────────────
def slugify(value: str) -> str:
    """Lower-case, hyphen-separated slug — identical rule to the renderers."""
    s = re.sub(r"[^a-z0-9]+", "-", str(value).lower())
    return s.strip("-")


# A trailing "Year 1" is an artefact of the export, not part of the course
# name.  So is a doubled final word ("... (11-16 Years) Years)").
_NAME_YEAR_TAIL = re.compile(r"\s+Year\s*\d+\s*$", re.IGNORECASE)


def name_is_malformed(name: str) -> bool:
    """True for spellings that are visibly damaged rather than merely different."""
    if _NAME_YEAR_TAIL.search(name):
        return True
    tokens = name.split()
    if len(tokens) >= 2 and tokens[-1] == tokens[-2]:
        return True
    return False


def _name_rank(name: str, count: int) -> tuple:
    """Sort key that puts the best spelling of a course name first.

    Deliberately boring and deterministic, in this order:
      1. visibly malformed spellings lose;
      2. the spelling the export uses most often wins — a one-off
         "BA (hons)" cannot outvote the "BA (Hons)" used on every other row;
      3. the longer spelling wins, because the extra text is nearly always a
         real qualifier such as "(Full Time)" or "(Distance Learning)";
      4. alphabetical, so the same input always yields the same output.
    """
    return (name_is_malformed(name), -count, -len(name), name)


def choose_display_names(variants_by_code: dict[str, dict[str, int]]) -> dict[str, list[str]]:
    """Order each course code's observed spellings, best first.

    Returns {course code: [canonical name, ...other spellings]}.  The tail is
    kept so the renderers can still match a search against whatever wording a
    student was given by their School.
    """
    ordered: dict[str, list[str]] = {}
    for code, counts in variants_by_code.items():
        ordered[code] = [n for n, _ in sorted(counts.items(),
                                              key=lambda kv: _name_rank(kv[0], kv[1]))]
    return ordered


def resolve_names_and_slugs(ordered_names: dict[str, list[str]]) -> dict[str, dict]:
    """Give every course code a display name and a slug that is unique.

    Two different courses can legitimately arrive with the same name — the
    full-time and part-time routes of one degree share a name but not a code.
    Where a name is shared:
      1. try a different observed spelling that is not already taken (this is
         what separates "MSc Engineering Management (Full Time)" from the bare
         "MSc Engineering Management");
      2. if the export offers nothing to tell them apart, keep the shared name
         and set `qualifier` to the course code, so the listing can show
         students which is which rather than hiding one of them.
    The slug falls back to the course code, so a link can never resolve to the
    wrong course.
    """
    # Deterministic processing order: by best name, then code.
    codes = sorted(ordered_names, key=lambda c: (ordered_names[c][0].upper(), c))

    slug_owner: dict[str, str] = {}
    resolved: dict[str, dict] = {}

    for code in codes:
        variants = ordered_names[code]
        chosen = variants[0]
        # Prefer a spelling whose slug nobody has claimed yet.
        for candidate in variants:
            if slugify(candidate) not in slug_owner:
                chosen = candidate
                break
        slug = slugify(chosen) or slugify(code)
        if slug in slug_owner:
            slug = f"{slug}-{code.lower()}"
        slug_owner[slug] = code
        resolved[code] = {"name": chosen, "slug": slug, "variants": variants}

    # Flag courses that still share a display name, so the UI can show the
    # course code alongside it instead of hiding one of them.
    by_name: dict[str, list[str]] = {}
    for code, info in resolved.items():
        by_name.setdefault(info["name"].casefold(), []).append(code)
    for shared in by_name.values():
        if len(shared) > 1:
            for code in shared:
                resolved[code]["qualifier"] = code

    return resolved


def merge_events(event_lists: list[list[dict]]) -> list[dict]:
    """Union of several modules' events, de-duplicated on Event Id.

    Where a course-year has more than one induction module the modules often
    share sessions.  Keying on Event Id keeps one copy of each session while
    still picking up anything only one of the modules carries.
    """
    merged: list[dict] = []
    seen: set[int] = set()
    for events in event_lists:
        for ev in events:
            if ev["event_id"] in seen:
                continue
            seen.add(ev["event_id"])
            merged.append(ev)
    merged.sort(key=lambda x: (x["date_sort"], time_to_minutes(x["time"]),
                               time_to_minutes(x.get("finish")), x.get("title") or ""))
    return merged


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

    # ── Workaround 1: suppress duplicate event rows ───────────────────────────
    # The export emits one row per (induction module × course descriptor), so
    # the same Event Id repeats several times for a module.  The columns that
    # drive the timetable are identical within each group, so keeping the first
    # row of each (Module, Event Id) pair is lossless.
    rows_before = len(df_events)
    df_events = df_events.drop_duplicates(subset=["Module", "Event Id"], keep="first")
    rows_dropped = rows_before - len(df_events)
    print(f"  Duplicate rows suppressed: {rows_dropped} "
          f"({rows_before} → {len(df_events)} unique Module + Event Id)")

    # Build an event lookup keyed by module code for speed
    events_by_mod: dict[str, list] = {}
    multi_room_events = 0
    linked_events     = 0

    for _, ev in df_events.iterrows():
        mod_code = str(ev["Module"]).strip()
        if mod_code not in events_by_mod:
            events_by_mod[mod_code] = []

        raw_details = str(ev["Details"]) if not pd.isna(ev["Details"]) else ""

        # ── Workaround 4: lift URLs out of Details before the title split ─────
        # Doing this first also rescues rows where the URL sits in front of the
        # session name and would otherwise have been read as the title.
        details, urls = extract_links(raw_details)
        if urls:
            linked_events += 1

        comma_pos = details.find(",")
        if comma_pos > 0:
            title       = details[:comma_pos].strip()
            description = details[comma_pos + 1:].strip()
        else:
            title       = details.strip()
            description = ""

        # The export contains a lot of doubled commas ("…leader,, Session 1"),
        # which used to leave a stray comma at the front of the description.
        title       = re.sub(r"^[\s,]+|[\s,]+$", "", title)
        description = re.sub(r"^[\s,]+|[\s,]+$", "", description)

        # ── Workarounds 2 + 3: un-transpose and pair up the location lists ────
        locations = build_locations(ev["Site"], ev["Room"])
        if len(locations) > 1:
            multi_room_events += 1

        is_online = locations_are_online(locations)

        # Legacy flat fields, kept so that any renderer that has not been
        # updated still shows something sensible.  Now correctly oriented:
        # `room` = room number(s), `site` = building name(s).
        legacy_rooms     = list(dict.fromkeys(l["room"]     for l in locations if l["room"]))
        legacy_buildings = list(dict.fromkeys(l["building"] for l in locations if l["building"]))

        events_by_mod[mod_code].append({
            "event_id":   int(ev["Event Id"]),
            "date":       format_date(ev["Weeks"]),
            "date_sort":  format_date_sort(ev["Weeks"]),
            "day":        str(ev["Day"]),
            "time":       format_time(ev["Time"]),
            "finish":     format_time(ev["Finish"]),
            "title":      title,
            "description": description,
            "locations":  locations,
            "links":      [{"url": u, "label": link_label(u)} for u in urls],
            "site":       ", ".join(legacy_buildings),
            "room":       ", ".join(legacy_rooms),
            "is_online":  is_online,
            "mod_code":   mod_code,
        })

    # Sort each module's events by date then time
    for mod_code in events_by_mod:
        events_by_mod[mod_code].sort(
            key=lambda x: (x["date_sort"], time_to_minutes(x["time"]),
                           time_to_minutes(x.get("finish")), x.get("title") or "")
        )

    # ── Workaround 5: key courses on the course CODE, not the name ────────
    # First pass — collect every spelling of every course code, and every
    # induction module attached to each (code, year).
    name_counts: dict[str, dict[str, int]] = {}
    modules_by_course_year: dict[str, dict[int, list[str]]] = {}
    course_type_by_code: dict[str, str] = {}

    for _, mod_row in df_modules.iterrows():
        crs_name = str(mod_row["Crs Name"]).strip()
        crs_code = str(mod_row["Crs Code"]).strip()
        if not crs_name or crs_name == "nan":
            continue
        if not crs_code or crs_code == "nan":
            continue

        name_counts.setdefault(crs_code, {})
        name_counts[crs_code][crs_name] = name_counts[crs_code].get(crs_name, 0) + 1
        course_type_by_code.setdefault(crs_code, mod_row["course_type"])

        year     = int(mod_row["Course Year"])
        mod_code = str(mod_row["Mod Code"]).strip()
        year_map = modules_by_course_year.setdefault(crs_code, {})
        mods     = year_map.setdefault(year, [])
        if mod_code not in mods:            # ── Workaround 6: keep them all
            mods.append(mod_code)

    # ── Workaround 7: one canonical name and one unique slug per course ────
    resolved = resolve_names_and_slugs(choose_display_names(name_counts))

    courses_data: dict[str, dict] = {}
    multi_module_years = 0

    for crs_code, year_map in modules_by_course_year.items():
        info = resolved[crs_code]

        years: dict[int, dict] = {}
        for year in sorted(year_map):
            mod_codes = year_map[year]
            if len(mod_codes) > 1:
                multi_module_years += 1

            modules = [{"mod_code": m, "events": events_by_mod.get(m, [])}
                       for m in mod_codes]
            events = merge_events([m["events"] for m in modules])

            years[year] = {
                "year":      year,
                # `mod_code` kept as a scalar for older renderers; `mod_codes`
                # is the full list and is what the UI should show.
                "mod_code":  mod_codes[0],
                "mod_codes": mod_codes,
                "events":    events,
            }

        course = {
            "id":          crs_code,
            "slug":        info["slug"],
            "name":        info["name"],
            "crs_code":    crs_code,
            "course_type": course_type_by_code.get(crs_code, "Other"),
            "years":       years,
        }
        # Other spellings the export used for this course — searchable, so a
        # student who was given the School's wording still finds the course.
        other_names = [n for n in info["variants"] if n != info["name"]]
        if other_names:
            course["name_variants"] = other_names
        # Set only when another course genuinely shares this display name.
        if info.get("qualifier"):
            course["name_qualifier"] = info["qualifier"]

        courses_data[crs_code] = course

    # Sort alphabetically by course name, return as list
    courses_list = sorted(courses_data.values(),
                          key=lambda x: (x["name"].upper(), x["crs_code"]))

    shared_name_courses = sum(1 for c in courses_list if c.get("name_qualifier"))
    print(f"  Course codes:          {len(courses_list)}  "
          f"(one card per course code, not per spelling)")
    print(f"  Course-years with >1 induction module: {multi_module_years}  "
          f"(all modules kept, events merged)")
    print(f"  Courses sharing a display name:        {shared_name_courses}  "
          f"(course code shown alongside to tell them apart)")

    # Summary
    total_events   = sum(len(y["events"]) for c in courses_list for y in c["years"].values())
    with_events    = sum(1 for c in courses_list if any(len(y["events"]) > 0 for y in c["years"].values()))
    without_events = len(courses_list) - with_events

    print(f"  Courses total:         {len(courses_list)}")
    print(f"  Courses with events:   {with_events}  (shown in search)")
    print(f"  Courses without events:{without_events}  (hidden from search by the UI)")
    print(f"  Total events:          {total_events}")
    print(f"  Multi-room events:     {multi_room_events}  (room/building pairs listed one per line)")
    print(f"  Events with a link:    {linked_events}  (URL lifted out of Details)")

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
