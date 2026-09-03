/* ============================================================
   UoP Induction Timetable — Solution 3: Progressive App
   Session-based history, sidebar navigation, recent courses.
   ============================================================ */
(function () {
  'use strict';

  const YEAR_LABELS = { 0: 'Foundation Year', 1: 'Year 1', 2: 'Year 2', 3: 'Year 3', 4: 'Year 4', 5: 'Year 5', 6: 'Year 6' };
  let all = [], filtered = [], activeFilter = 'all', searchVal = '', searchTimer = null;
  let recentCourses = JSON.parse(sessionStorage.getItem('uop_recent') || '[]');

  // ── DOM refs ──────────────────────────────────────────────
  const $search = document.getElementById('main-search');
  const $clearBtn = document.getElementById('btn-clear-search');
  const $liveCount = document.getElementById('live-count');
  const $alphaPills = document.getElementById('alpha-pills');

  // Extract subject title for sorting/grouping (strips leading award prefix)
  function subjectSortKey(name) {
    // Strip award prefix, then any leading non-alpha chars, so A-Z index is always clean
    return name
      .replace(/^(BA|BSc|BEng|BN|BM|BDS|BVM&S|MEng|MSc|MA|MBA|MFA|MPhil|MRes|LLB|LLM|FdA|FdSc|FdEng|HND|HNC|CertHE|DipHE|PGCE|PGDE|PGCert|PGDip|PhD|DProf|EdD|DNurse|DClinPsy|ProfDoc)(\s*\([^)]+\))*\s*/i, '')
      .replace(/^[^A-Za-z]+/, '')
      .trim()
      .toUpperCase();
  }


  const $output = document.getElementById('courses-output');
  const $detailContent = document.getElementById('detail-content');
  const $btnBack = document.getElementById('btn-back-detail');
  const $recentContent = document.getElementById('recent-content');
  const $panelSearch = document.getElementById('panel-search');
  const $panelDetail = document.getElementById('panel-detail');
  const $panelRecent = document.getElementById('panel-recent');
  const $panelAbout = document.getElementById('panel-about');

  // ── Boot ──────────────────────────────────────────────────
  function init() {
    const data = window.__COURSES_DATA__;
    if (!data) {
      $output.innerHTML = '<p role="alert" style="color:#C0392B;padding:20px">Course data unavailable. Ensure data.js is loaded.</p>';
      return;
    }
    all = data.filter(c => Object.values(c.years).some(y => y.events.length > 0));
    indexSharedNames(all);
    filtered = data;
    applyFilters();

    // Sidebar nav
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-btn').forEach(b => {
          b.classList.remove('active');
          b.removeAttribute('aria-current');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-current', 'page');
        showPanel(btn.dataset.panel);
      });
    });

    // Search
    $search.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(doSearch, 280);
      $clearBtn.hidden = $search.value.length === 0;
    });
    $clearBtn.addEventListener('click', () => {
      $search.value = ''; $clearBtn.hidden = true;
      searchVal = ''; applyFilters(); $search.focus();
    });

    // Type chips
    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.chip').forEach(c => { c.classList.remove('active'); c.setAttribute('aria-pressed', 'false'); });
        chip.classList.add('active'); chip.setAttribute('aria-pressed', 'true');
        activeFilter = chip.dataset.type;
        applyFilters();
      });
    });

    // Back btn
    $btnBack.addEventListener('click', () => {
      showPanel('search');
      activateSidebarBtn('search');
    });

    // URL hash
    window.addEventListener('popstate', handleHash);
    handleHash();
  }

  // ── Navigation ────────────────────────────────────────────
  function showPanel(id) {
    [$panelSearch, $panelDetail, $panelRecent, $panelAbout].forEach(p => {
      p.classList.remove('active');
      p.hidden = true;
    });
    const el = document.getElementById('panel-' + id);
    if (el) { el.classList.add('active'); el.hidden = false; }
    if (id === 'recent') renderRecent();
  }

  function activateSidebarBtn(id) {
    document.querySelectorAll('.sidebar-btn').forEach(b => {
      b.classList.remove('active');
      b.removeAttribute('aria-current');
      if (b.dataset.panel === id) { b.classList.add('active'); b.setAttribute('aria-current', 'page'); }
    });
  }

  function handleHash() {
    const hash = location.hash;
    if (hash.startsWith('#detail/')) {
      const parts = hash.replace('#detail/', '').split('/');
      const slug = parts[0];
      const year = parseInt(parts[1] || '1', 10);
      // Stamped slug first; the name-derived fallback keeps links shared
      // before WD-1076 working.
      const course = all.find(c => courseSlug(c) === slug)
        || all.find(c => slugify(c.name) === slug);
      if (course) {
        renderDetail(course, course.years[year] ? year : parseInt(Object.keys(course.years)[0], 10));
        showPanel('detail');
        activateSidebarBtn('search');
        return;
      }
    }
    showPanel('search');
    activateSidebarBtn('search');
  }

  // ── Search & filter ───────────────────────────────────────
  function doSearch() {
    searchVal = normaliseForSearch($search.value);
    applyFilters();
  }

  function applyFilters() {
    filtered = all.filter(c => {
      const ms = !searchVal || searchHaystack(c).includes(searchVal);
      const mf = activeFilter === 'all' || c.course_type === activeFilter;
      return ms && mf;
    });
    buildAlpha();
    renderList();
    const n = filtered.length;
    $liveCount.textContent = `${n} course${n !== 1 ? 's' : ''} shown`;
  }

  function buildAlpha() {
    const has = new Set(filtered.map(c => subjectSortKey(c.name)[0]).filter(Boolean));
    const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $alphaPills.innerHTML = '';
    for (const l of ABC) {
      const a = document.createElement(has.has(l) ? 'a' : 'span');
      a.textContent = l;
      a.className = 'alpha-pill ' + (has.has(l) ? 'has' : 'off');
      if (has.has(l)) { a.href = '#alpha-' + l; a.setAttribute('aria-label', 'Jump to ' + l); }
      else a.setAttribute('aria-hidden', 'true');
      $alphaPills.appendChild(a);
    }
  }

  function renderList() {
    if (filtered.length === 0) {
      $output.innerHTML = `<div class="no-results-msg" role="alert">
        <h2>No courses found</h2>
        <p>Try a different keyword or adjust the filter.</p>
      </div>`;
      return;
    }
    const grouped = {};
    for (const c of filtered) {
      const l = subjectSortKey(c.name)[0] || '?';
      if (!grouped[l]) grouped[l] = [];
      grouped[l].push(c);
    }
    let html = '';
    for (const l of Object.keys(grouped).sort()) {
      html += `<div class="letter-group" id="alpha-${l}" role="group" aria-labelledby="lh-${l}">
        <div class="letter-anchor" id="lh-${l}" aria-hidden="true">${l}</div>
        <ul class="course-list" role="list">`;
      for (const c of grouped[l]) {
        const typeLabel = c.course_type === 'UG' ? 'Undergraduate' : c.course_type === 'PGT' ? 'Postgraduate' : 'Other';
        const years = Object.values(c.years).sort((a, b) => a.year - b.year);
        const yBtns = years.map(y => {
          const cnt = y.events.length;
          const lbl = YEAR_LABELS[y.year] || 'Year ' + y.year;
          return `<button type="button" class="yr-btn" 
            data-course-id="${esc(courseId(c))}" data-year="${y.year}"
            aria-label="${esc(courseFullName(c))}, ${lbl}${cnt ? ', ' + cnt + ' session' + (cnt !== 1 ? 's' : '') : ''}">
            ${esc(lbl)}
            ${cnt ? `<span class="ev-badge" aria-hidden="true">${cnt}</span>` : ''}
          </button>`;
        }).join('');
        html += `<li class="course-card">
          <div class="course-card-top">
            <span class="course-card-name">${esc(c.name)}${courseQualifier(c)
              ? ` <span class="course-code-qualifier">(${esc(courseQualifier(c))})</span>` : ''}</span>
            <span class="type-pill pill-${c.course_type}" aria-label="${typeLabel}">${typeLabel}</span>
          </div>
          <div class="year-strip">${yBtns || '<span style="font-size:.8125rem;color:#888;font-style:italic">No sessions yet</span>'}</div>
        </li>`;
      }
      html += '</ul></div>';
    }
    $output.innerHTML = html;
    $output.querySelectorAll('.yr-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const course = findCourseById(btn.dataset.courseId);
        if (course) {
          const year = parseInt(btn.dataset.year, 10);
          addRecent(course, year);
          renderDetail(course, year);
          showPanel('detail');
          activateSidebarBtn('search');
          history.pushState({}, '', '#detail/' + courseSlug(course) + '/' + year);
        }
      });
    });
  }

  // ── Detail rendering ──────────────────────────────────────
  function renderDetail(course, year) {
    const yd = course.years[year];
    // A course-year can carry more than one induction module (WD-1076).
    const modCodes = yd ? (yd.mod_codes || [yd.mod_code]).filter(Boolean) : [];
    const yl = YEAR_LABELS[year] || 'Year ' + year;
    const sortedYears = Object.values(course.years).sort((a, b) => a.year - b.year);
    const tabs = sortedYears.map(y => {
      const lbl = YEAR_LABELS[y.year] || 'Year ' + y.year;
      return `<button type="button" class="year-tab${y.year === year ? ' active' : ''}"
        data-year="${y.year}"
        aria-label="${lbl}${y.events.length ? ', ' + y.events.length + ' sessions' : ''}">
        ${esc(lbl)}</button>`;
    }).join('');

    const texts = getWelcomeTexts(course.course_type, year);
    let ttHtml = '';
    if (!yd || yd.events.length === 0) {
      ttHtml = `<div class="no-events-block" role="status"><p>No events scheduled yet. Please check back or contact your School office.</p></div>`;
    } else {
      const byDate = {};
      // Duplicate rows suppressed by Induction Module ID + Event ID
      for (const ev of dedupeEvents(yd.events)) {
        const k = ev.date_sort || ev.date;
        if (!byDate[k]) byDate[k] = { label: ev.date, events: [] };
        byDate[k].events.push(ev);
      }
      for (const [dk, grp] of Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]))) {
        ttHtml += `<div class="day-block">
          <div class="day-heading">${esc(grp.label)}</div>
          <table class="tt-table" aria-label="Events on ${esc(grp.label)}">
            <thead><tr>
              <th scope="col">Time</th><th scope="col">Session</th>
              <th scope="col">Location</th><th scope="col">Ends</th>
            </tr></thead><tbody>`;
        for (const ev of grp.events.slice().sort(compareEventsByTime)) {
          ttHtml += `<tr>
            <td class="ev-time">${esc(ev.time)}</td>
            <td>
              <div class="ev-title">${esc(ev.title)}</div>
              ${ev.description ? `<div class="ev-desc">${linkifyDesc(ev.description)}</div>` : ''}
              ${buildLinksHtml(ev)}
            </td>
            <td class="ev-loc">${locHtml(ev)}</td>
            <td class="ev-time">${esc(ev.finish)}</td>
          </tr>`;
        }
        ttHtml += `</tbody></table></div>`;
      }
    }

    $detailContent.innerHTML = `
      <h1 tabindex="-1">${esc(courseFullName(course))}</h1>
      <div class="year-tab-strip" role="tablist" aria-label="Year of study">${tabs}</div>
      <div class="welcome-block">${texts.welcome}</div>
      <div class="accounts-block">${texts.accounts}</div>
      <div class="tt-section">
        <h2 class="tt-section-h2">Induction timetable — ${esc(yl)}</h2>
        ${ttHtml}
      </div>
      <div class="info-section">
        <h2>If you have any queries</h2>
        <p>Contact your School or Department office. Visit <a href="https://myport.port.ac.uk">MyPort</a> for guidance, or email <a href="mailto:itsupport@port.ac.uk">itsupport@port.ac.uk</a> for IT support.</p>
      </div>
      <div class="info-section">
        <h2>International students</h2>
        <p>Check your email and the <a href="https://myport.port.ac.uk/student-services/international-student-advice">International Students pages</a> for additional orientation sessions, visa sign-in and English language support details.</p>
      </div>
      <div class="info-section">
        <h2>Further information</h2>
        <ul>
          <li><a href="https://myport.port.ac.uk/welcome/maps-and-directions">Campus maps and building locations</a></li>
          <li><a href="https://myport.port.ac.uk/student-services">Student services</a></li>
          <li><a href="https://www.upsu.net">Portsmouth Students' Union</a></li>
        </ul>
      </div>
      <p class="meta-note">Induction Module ID${modCodes.length > 1 ? 's' : ''}: <code>${esc(modCodes.length ? modCodes.join(', ') : '—')}</code> | Course code: ${esc(course.crs_code)}</p>
    `;

    $detailContent.querySelector('h1').focus();

    $detailContent.querySelectorAll('.year-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const yr = parseInt(tab.dataset.year, 10);
        addRecent(course, yr);
        renderDetail(course, yr);
        history.replaceState({}, '', '#detail/' + courseSlug(course) + '/' + yr);
      });
    });
  }

  function locHtml(ev) {
    if (ev.is_online) {
      return `<span class="online-tag" aria-label="Online session">⬛ Online</span>`;
    }
    const locs = getLocations(ev);
    if (!locs.length) return '<span aria-label="Location not yet specified">—</span>';
    if (locs.length === 1) return esc(formatLocation(locs[0]));
    // Multi-room booking: one room/building pair per line
    const items = locs.map(l => `<li>${esc(formatLocation(l))}</li>`).join('');
    return `<ul class="loc-list" aria-label="${locs.length} rooms booked for this session">${items}</ul>`;
  }

  // ── Welcome text ─────────────────────────────────────────
  function getWelcomeTexts(type, year) {
    if (type === 'UG' && year === 1) {
      return {
        welcome: `<h2>Welcome to the University of Portsmouth!</h2><p>Your induction is your first introduction to life at Portsmouth. Sessions will help you settle in, meet your course team and fellow students, and get you ready to begin your studies. Attendance is compulsory — please attend all sessions listed below.</p>`,
        accounts: `<h2>Accessing your online accounts</h2><p>Before you arrive, set up your University of Portsmouth account. You'll need this to access Moodle (our virtual learning environment), your University email, and the library. If you need help, visit <a href="https://myport.port.ac.uk/it-support/student-it-support">IT Support</a> or attend an IT drop-in session during induction week.</p>`
      };
    } else if (type === 'UG') {
      return {
        welcome: `<h2>Welcome back!</h2><p>These returning-student induction sessions will help you reconnect with your course and get ready for the new academic year. Please attend the sessions relevant to your year of study.</p>`,
        accounts: `<h2>Your online accounts</h2><p>Your University account should still be active from your previous year. If you have any issues accessing Moodle or your email, please contact <a href="mailto:itsupport@port.ac.uk">IT Support</a>.</p>`
      };
    } else {
      return {
        welcome: `<h2>Welcome to Postgraduate Study!</h2><p>Your induction will introduce you to postgraduate life at Portsmouth, the expectations of your programme, and the support and resources available to you. We look forward to welcoming you to the University community.</p>`,
        accounts: `<h2>Accessing your online accounts</h2><p>Set up your University of Portsmouth account before your induction begins to access Moodle, your University email, and the library. Contact <a href="mailto:itsupport@port.ac.uk">IT Support</a> if you need any assistance.</p>`
      };
    }
  }

  // ── Recent courses ────────────────────────────────────────
  function addRecent(course, year) {
    const id = courseId(course);
    recentCourses = recentCourses.filter(r => !((r.id || r.name) === id && r.year === year));
    recentCourses.unshift({ id, name: courseFullName(course), year, type: course.course_type,
                            modCode: (course.years[year]?.mod_codes || [course.years[year]?.mod_code]).filter(Boolean).join(', ') });
    if (recentCourses.length > 8) recentCourses = recentCourses.slice(0, 8);
    try { sessionStorage.setItem('uop_recent', JSON.stringify(recentCourses)); } catch (e) {}
  }

  function renderRecent() {
    if (recentCourses.length === 0) {
      $recentContent.innerHTML = '<p class="muted-text">You haven\'t viewed any courses yet. Use <strong>Find my course</strong> to get started.</p>';
      return;
    }
    let html = '<ul class="recent-list" role="list">';
    for (const r of recentCourses) {
      const lbl = YEAR_LABELS[r.year] || 'Year ' + r.year;
      const typeLabel = r.type === 'UG' ? 'Undergraduate' : r.type === 'PGT' ? 'Postgraduate' : 'Other';
      html += `<li class="recent-item" role="button" tabindex="0"
        data-course-id="${esc(r.id || r.name)}" data-year="${r.year}"
        aria-label="${esc(r.name)}, ${lbl}">
        <div class="recent-item-name">${esc(r.name)}</div>
        <div class="recent-item-meta">${esc(lbl)} · ${typeLabel}</div>
      </li>`;
    }
    html += '</ul>';
    $recentContent.innerHTML = html;
    $recentContent.querySelectorAll('.recent-item').forEach(item => {
      const go = () => {
        const course = findCourseById(item.dataset.courseId)
          || all.find(c => c.name === item.dataset.courseId);
        if (course) {
          const year = parseInt(item.dataset.year, 10);
          renderDetail(course, year);
          showPanel('detail');
          activateSidebarBtn('search');
          history.pushState({}, '', '#detail/' + courseSlug(course) + '/' + year);
        }
      };
      item.addEventListener('click', go);
      item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  }

  // ── Utilities ─────────────────────────────────────────────

  // Suppress duplicate rows by Induction Module ID + Event ID.  The pipeline
  // already does this; this guards against older data.js files.
  /**
   * Convert a 12-hour clock string ("9:00am", "12:30pm") to minutes past midnight.
   * Missing/unparseable values sort last rather than first.
   */
  function timeToMinutes(value) {
    if (!value) return Number.MAX_SAFE_INTEGER;
    const m = String(value).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/i);
    if (m) {
      let hours = parseInt(m[1], 10) % 12;
      if (m[3].toLowerCase() === 'p') hours += 12;
      return hours * 60 + (m[2] ? parseInt(m[2], 10) : 0);
    }
    const m24 = String(value).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (m24) return parseInt(m24[1], 10) * 60 + parseInt(m24[2], 10);
    return Number.MAX_SAFE_INTEGER;
  }

  /** Chronological comparator for events within a single day. */
  function compareEventsByTime(a, b) {
    const diff = timeToMinutes(a.time) - timeToMinutes(b.time);
    if (diff !== 0) return diff;
    const finishDiff = timeToMinutes(a.finish) - timeToMinutes(b.finish);
    if (finishDiff !== 0) return finishDiff;
    return String(a.title || '').localeCompare(String(b.title || ''));
  }

  function dedupeEvents(events) {
    const seen = new Set();
    const out = [];
    for (const ev of events || []) {
      const key = `${ev.mod_code || ''}|${ev.event_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(ev);
    }
    return out;
  }

  const notSet = v => !v || v === 'nan' || v === 'None';

  // Room number + building name pairs, falling back to the legacy flat fields
  function getLocations(ev) {
    if (Array.isArray(ev.locations)) {
      return ev.locations.filter(l => l && (!notSet(l.room) || !notSet(l.building)));
    }
    const rooms     = notSet(ev.room) ? [] : String(ev.room).split(',').map(x => x.trim()).filter(Boolean);
    const buildings = notSet(ev.site) ? [] : String(ev.site).split(',').map(x => x.trim()).filter(Boolean);
    const size = Math.max(rooms.length, buildings.length);
    const out = [], seen = new Set();
    for (let i = 0; i < size; i++) {
      const room     = rooms.length === 1 ? rooms[0] : (rooms[i] || '');
      const building = buildings.length === 1 ? buildings[0] : (buildings[i] || '');
      const key = room + '|' + building;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ room, building });
    }
    return out;
  }

  function formatLocation(loc) {
    return [loc.room, loc.building].filter(v => !notSet(v)).join(', ');
  }

  function safeUrl(url) {
    const u = String(url || '').trim();
    return /^https?:\/\//i.test(u) ? u : '';
  }

  // Meeting / resource links lifted out of Details, each on its own line
  function buildLinksHtml(ev) {
    const links = Array.isArray(ev.links) ? ev.links : [];
    const html = links.map(l => {
      const url = safeUrl(l && l.url);
      if (!url) return '';
      return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="ev-join-link"
        >${esc(l.label || 'Open link')}<span aria-hidden="true"> \u2197</span><span class="sr-only"> (opens in a new tab)</span></a>`;
    }).join('');
    return html ? `<div class="ev-links">${html}</div>` : '';
  }

  // Fallback for older data.js files: any URL still inline in the description
  // becomes a hyperlink on its own line, delimiters stripped.
  function linkifyDesc(text) {
    const escaped = esc(text);
    return escaped.replace(/[\[\(&quot;&#39;]?\s*(https?:\/\/[^\s\[\]<>&]+)/gi, (m, rawUrl) => {
      const url = safeUrl(rawUrl.replace(/[\]\),.;:!?]+$/, ''));
      if (!url) return m;
      return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="ev-join-link"
        >Join online session<span aria-hidden="true"> \u2197</span><span class="sr-only"> (opens in a new tab)</span></a>`;
    });
  }

  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function slugify(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // ── Course identity (WD-1076) ──────────────────────────────────
  // Slugs and lookups used to be derived from the course name, so courses
  // whose names differed only in case or punctuation shared a slug and only
  // one was reachable. The pipeline now stamps a unique `slug` and `id`;
  // both helpers fall back to the old behaviour for an older data.js.
  function courseSlug(c) { return c.slug || slugify(c.name); }
  function courseId(c)   { return c.id || c.crs_code || c.name; }
  function findCourseById(id) { return all.find(c => courseId(c) === id) || null; }
  let sharedDisplayNames = new Set();

  // The course code is only worth showing when another course the student can
  // actually see shares the name. A course whose twin has no timetabled
  // sessions is hidden from the listing, so appending a code there would be
  // noise rather than a disambiguator.
  function indexSharedNames(courses) {
    const counts = new Map();
    for (const c of courses) {
      const k = c.name.toLowerCase();
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    sharedDisplayNames = new Set([...counts].filter(([, n]) => n > 1).map(([k]) => k));
  }

  function courseQualifier(c) {
    if (!c.name_qualifier) return '';
    return sharedDisplayNames.has(c.name.toLowerCase()) ? c.name_qualifier : '';
  }
  function courseFullName(c) {
    const q = courseQualifier(c);
    return q ? c.name + ' (' + q + ')' : c.name;
  }

  function normaliseForSearch(v) {
    return String(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Display name, the other spellings the export used, and the course code —
  // punctuation flattened so a missing space in the source data still matches
  // what a student would type.
  function searchHaystack(c) {
    if (!c.__haystack) {
      c.__haystack = normaliseForSearch(
        [c.name].concat(c.name_variants || [], [c.crs_code || '']).join(' '));
    }
    return c.__haystack;
  }

  // ── Start ─────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
