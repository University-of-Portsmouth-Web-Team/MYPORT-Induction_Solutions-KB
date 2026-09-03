/* ============================================================
   University of Portsmouth — Induction Timetable App
   Analytics module (GA4 custom events)

   Jira: INS-873
   GA4 data stream: "Induction Timetables" (G-BVP9PTRZJL),
   a second web data stream on the existing MyPort property.

   ------------------------------------------------------------
   WHY CUSTOM EVENTS RATHER THAN PAGE VIEWS
   ------------------------------------------------------------
   The app is a single-page application that routes on the URL
   fragment (…/solution1/#detail/{course-slug}/{year-n}). GA4's
   page-path reporting dimensions strip everything after the "#",
   so every screen would otherwise collapse into a single row for
   /MYPORT-Induction_Solutions-KB/solution1/.

   Instead we emit an explicit `course_view` event carrying the
   course and year as event parameters, which are registered as
   custom dimensions in GA4.

   ------------------------------------------------------------
   EVENTS EMITTED
   ------------------------------------------------------------
   course_view        — a course timetable was opened
                        course_name   e.g. "BA (Hons) Criminology"
                        year          e.g. "Year 1" / "Foundation Year"
                        course_type   "UG" | "PGT" | "Other"
                        entry_method  "listing" | "year_tab" | "deep_link"

   course_search      — a keyword search settled (debounced)
                        search_term   lower-cased search string
                        result_count  number of courses matched

   alpha_index_click  — the A–Z index was used
                        letter        "A"…"Z"

   course_filter      — the UG/PG filter was changed
                        filter        "all" | "UG" | "PGT"

   `course_view` is the one Ben requires. The other three answer the
   original question in the ticket description about whether people
   prefer keyword search or the A–Z index; they can be removed
   without affecting `course_view`.

   ------------------------------------------------------------
   DESIGN NOTES
   ------------------------------------------------------------
   • Every call is wrapped in try/catch and guarded on gtag being
     present. If the Google tag is blocked (ad blocker, CSP, no
     network) the timetable itself must still work perfectly.
   • Parameter values are trimmed to GA4's 100-character limit so
     nothing is silently dropped.
   • course_view is de-duplicated so re-renders of the same
     course + year do not inflate the count. The guard is cleared
     whenever the user returns to the listing, so genuinely
     re-opening the same timetable is counted again.
   • No personal data is collected. Only course names, years and
     search terms are sent. Search terms are truncated and are
     free-text, so see the note in README.md about search_term.

   Debugging: append ?uop_debug=1 to the URL (or set
   window.UOP_ANALYTICS_DEBUG = true) to log every event to the
   browser console without needing GA4 DebugView access.
   ============================================================ */
window.UOPAnalytics = (function () {
  'use strict';

  var MAX_PARAM_LENGTH = 100;   // GA4 hard limit for event parameter values
  var MAX_SEARCH_LENGTH = 60;   // keep free-text search terms short

  var lastCourseViewKey = null;

  // ── Helpers ────────────────────────────────────────────────

  function isDebug() {
    try {
      if (window.UOP_ANALYTICS_DEBUG === true) return true;
      return window.location.search.indexOf('uop_debug=1') !== -1;
    } catch (e) {
      return false;
    }
  }

  function gtagReady() {
    return typeof window.gtag === 'function';
  }

  /* Coerce to a clean string within GA4's parameter length limit. */
  function clean(value, maxLength) {
    if (value === null || value === undefined) return '';
    var s = String(value).replace(/\s+/g, ' ').trim();
    var limit = maxLength || MAX_PARAM_LENGTH;
    return s.length > limit ? s.slice(0, limit) : s;
  }

  /* Single exit point for every event. Never throws. */
  function send(eventName, params) {
    try {
      if (isDebug()) {
        // eslint-disable-next-line no-console
        console.log('[UOP analytics] ' + eventName, params);
      }
      if (!gtagReady()) return false;
      window.gtag('event', eventName, params);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ── Public API ─────────────────────────────────────────────

  /**
   * A course timetable was opened.
   *
   * @param {string} courseName  Plain course title as shown to the user.
   * @param {string} yearLabel   "Year 1", "Foundation Year", etc.
   * @param {object} [options]   { courseType, entryMethod }
   */
  function trackCourseView(courseName, yearLabel, options) {
    try {
      var opts = options || {};
      var name = clean(courseName);
      var year = clean(yearLabel);
      if (!name || !year) return false;

      // Suppress duplicates from re-renders of the same course + year.
      var key = name + '|' + year;
      if (key === lastCourseViewKey) {
        if (isDebug()) {
          // eslint-disable-next-line no-console
          console.log('[UOP analytics] course_view suppressed (duplicate)', key);
        }
        return false;
      }
      lastCourseViewKey = key;

      return send('course_view', {
        course_name: name,
        year: year,
        course_type: clean(opts.courseType || 'Unknown'),
        entry_method: clean(opts.entryMethod || 'listing')
      });
    } catch (e) {
      return false;
    }
  }

  /**
   * Clear the course_view de-duplication guard.
   * Called when the user returns to the listing, so that re-opening
   * the same timetable later in the session counts as a new view.
   */
  function resetCourseView() {
    lastCourseViewKey = null;
  }

  /** A keyword search settled (already debounced by the caller). */
  function trackSearch(term, resultCount) {
    try {
      var t = clean(term, MAX_SEARCH_LENGTH).toLowerCase();
      if (!t) return false;
      return send('course_search', {
        search_term: t,
        result_count: typeof resultCount === 'number' ? resultCount : 0
      });
    } catch (e) {
      return false;
    }
  }

  /** The A–Z index was used to jump to a letter. */
  function trackAlphaClick(letter) {
    try {
      var l = clean(letter, 1).toUpperCase();
      if (!l) return false;
      return send('alpha_index_click', { letter: l });
    } catch (e) {
      return false;
    }
  }

  /** The undergraduate / postgraduate filter was changed. */
  function trackFilter(filter) {
    try {
      var f = clean(filter, 20);
      if (!f) return false;
      return send('course_filter', { filter: f });
    } catch (e) {
      return false;
    }
  }

  return {
    trackCourseView: trackCourseView,
    resetCourseView: resetCourseView,
    trackSearch: trackSearch,
    trackAlphaClick: trackAlphaClick,
    trackFilter: trackFilter
  };
})();
