/* ============================================================
   University of Portsmouth — Induction Timetables
   External links open in a new tab (TECH-611)
   ------------------------------------------------------------
   Every link that points somewhere other than this site is set
   to open in a new tab, and is announced as doing so to both
   sighted and screen reader users. That warning is what makes
   the behaviour accessible: WCAG 2.2 technique G201 ("Giving
   users advanced warning when opening a new window"), which is
   how SC 3.2.5 Change on Request is satisfied.

   Left untouched:
     - anything on this site (see SITE_PREFIXES below)
     - in-page anchors (#letter-A, #detail/...)
     - mailto: and tel: links, which the operating system
       handles rather than the browser
     - links already marked up as opening in a new tab, so the
       "Join online session" links app.js builds are not
       annotated twice
     - anything inside an element carrying data-no-external-links,
       and anything with a download attribute

   The static links in index.html already carry the attributes in
   the markup, so they work with JavaScript switched off. This
   file covers the links rendered at runtime from data.js, and is
   safe to run repeatedly over the same DOM.
   ============================================================ */
(function () {
  'use strict';

  /* ── Configuration ────────────────────────────────────────────
     Absolute prefixes that count as "this site". The deployed
     home is listed explicitly because the app is also served
     inside the MyPort iframe, where the parent page is on a
     different origin and its links must therefore open in a new
     tab rather than replacing the timetable inside the frame.

     The current origin is added at runtime as well, so preview
     deployments and a future move to a port.ac.uk hostname
     behave the same way without an edit here.

     NOTE: this list is the one line that differs between the
     GitHub Pages proof of concept and the Cloudflare deployment.
     Keep it pointing at the host this copy is served from.
     ──────────────────────────────────────────────────────────── */
  var SITE_PREFIXES = [
    'https://university-of-portsmouth-web-team.github.io/'
  ];

  var NEW_TAB_NOTICE = ' (opens in a new tab)';
  var MARKER = '\u2197'; // ↗

  function internalPrefixes() {
    var list = SITE_PREFIXES.slice();

    // Optional per-page override, set before this script loads.
    if (Array.isArray(window.UOP_SITE_PREFIXES)) {
      list = list.concat(window.UOP_SITE_PREFIXES);
    }

    // Whatever host we are actually being served from. Skipped for
    // file:// and other non-web schemes, where origin is "null".
    try {
      if (/^https?:$/.test(window.location.protocol)) {
        list.push(window.location.origin + '/');
      }
    } catch (e) { /* non-fatal */ }

    return list;
  }

  function isInternal(url, prefixes) {
    for (var i = 0; i < prefixes.length; i++) {
      if (url.indexOf(prefixes[i]) === 0) return true;
    }
    return false;
  }

  // True once a link already says it opens in a new tab, whether
  // that came from the markup, from app.js, or from an earlier
  // pass of this function.
  function alreadyHandled(a) {
    if (a.hasAttribute('data-external-link')) return true;
    if (a.getAttribute('target') !== '_blank') return false;
    var described = (a.getAttribute('aria-label') || '') + ' ' + (a.textContent || '');
    return /opens in a new (tab|window)/i.test(described);
  }

  function annotate(a) {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
    a.setAttribute('data-external-link', '');

    // An aria-label replaces the link text for screen reader users,
    // so a hidden span appended inside would never be read out. Where
    // one is present the notice goes on the label instead.
    var label = a.getAttribute('aria-label');
    if (label) {
      a.setAttribute('aria-label', label.replace(/\s+$/, '') + NEW_TAB_NOTICE);
    } else {
      var notice = document.createElement('span');
      notice.className = 'sr-only';
      notice.textContent = NEW_TAB_NOTICE;
      a.appendChild(notice);
    }

    // Visible cue for everyone else. Decorative, so hidden from the
    // accessibility tree — the wording above carries the meaning.
    var marker = document.createElement('span');
    marker.className = 'external-link-marker';
    marker.setAttribute('aria-hidden', 'true');
    marker.textContent = MARKER;
    a.appendChild(marker);
  }

  function isExternal(a) {
    if (a.hasAttribute('download')) return false;
    if (a.closest && a.closest('[data-no-external-links]')) return false;

    var raw = a.getAttribute('href') || '';
    if (!raw || raw.charAt(0) === '#') return false;

    var resolved;
    try {
      resolved = new URL(a.getAttribute('href'), document.baseURI).href;
    } catch (e) {
      return false;
    }

    // mailto:, tel:, javascript: and friends are not navigations.
    if (!/^https?:\/\//i.test(resolved)) return false;

    return !isInternal(resolved, internalPrefixes());
  }

  function process(root) {
    if (!root || root.nodeType !== 1) return 0;

    var anchors = [];
    if (root.matches && root.matches('a[href]')) anchors.push(root);
    if (root.querySelectorAll) {
      Array.prototype.push.apply(anchors, root.querySelectorAll('a[href]'));
    }

    var changed = 0;
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      if (alreadyHandled(a)) continue;
      if (!isExternal(a)) continue;
      annotate(a);
      changed++;
    }
    return changed;
  }

  // The listing and the timetable are both built after load, so new
  // links keep arriving. Appending the notice spans inside a link
  // fires the observer again, but those spans are not anchors, so
  // the second pass is a no-op rather than a loop.
  function watch() {
    if (!window.MutationObserver) return;
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          process(added[j]);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    process(document.body);
    watch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Exposed for the accessibility and smoke tests.
  window.UOPExternalLinks = {
    process: process,
    refresh: function () { return process(document.body); },
    isExternal: isExternal,
    prefixes: internalPrefixes
  };
})();
