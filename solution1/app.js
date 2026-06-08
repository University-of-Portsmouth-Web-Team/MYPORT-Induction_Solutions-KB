/* ============================================================
   University of Portsmouth — Induction Timetable App
   Version: 1.0 (January 2026 data)
   ============================================================ */
(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────
  let allCourses = [];
  let filteredCourses = [];
  let currentFilter = 'all';
  let currentSearch = '';
  let currentView = 'listing'; // 'listing' | 'detail'
  let currentCourse = null;
  let currentYear = null;
  let searchTimer = null;

  // ── DOM refs ───────────────────────────────────────────────
  const $listingView = document.getElementById('view-listing');
  const $detailView = document.getElementById('view-detail');
  const $searchInput = document.getElementById('course-search');
  const $clearBtn = document.getElementById('clear-search');
  const $searchStatus = document.getElementById('search-status');
  const $resultsCount = document.getElementById('results-count');
  const $coursesListing = document.getElementById('courses-listing');
  const $loadingState = document.getElementById('loading-state');
  const $alphaIndex = document.getElementById('alpha-index');
  const $backBtn = document.getElementById('back-btn');
  const $detailCourseName = document.getElementById('detail-course-name');
  const $detailYearTabs = document.getElementById('detail-year-tabs');
  const $detailWelcome = document.getElementById('detail-welcome');
  const $detailAccounts = document.getElementById('detail-accounts');
  const $timetableContent = document.getElementById('timetable-content');
  const $sidebarDl = document.getElementById('sidebar-dl');
  const $detailBreadcrumb = document.getElementById('detail-breadcrumb');

  const YEAR_LABELS = { 0: 'Foundation Year', 1: 'Year 1', 2: 'Year 2', 3: 'Year 3', 4: 'Year 4', 5: 'Year 5', 6: 'Year 6' };

  // ── Welcome text templates ─────────────────────────────────
  function getWelcomeText(courseType, year) {
    if (courseType === 'UG' && year === 1) {
      return {
        welcome: `<h2>Welcome to the University of Portsmouth!</h2>
          <p>We're delighted to welcome you as a new student. Your induction week is your opportunity to get settled in, meet your fellow students, and find out everything you need to know about your course and the University. Please make sure you attend all sessions listed below — they are designed to set you up for success in your studies.</p>`,
        accounts: `<h2>Accessing your online accounts</h2>
          <p>Before your induction, please make sure you have set up your University of Portsmouth account. You'll need this to access all online systems, including Moodle (our virtual learning environment), your University email, and the library. If you need help, visit <a href="https://myport.port.ac.uk/student-services/it-support">IT Support</a> or attend one of the drop-in sessions during induction week.</p>`
      };
    } else if (courseType === 'UG' && year > 1) {
      return {
        welcome: `<h2>Welcome back!</h2>
          <p>Welcome back to the University of Portsmouth for another year. Your returning student induction sessions are a great opportunity to reconnect with your course, meet any new staff or students, and get up to speed with what's happening this academic year. Please check your timetable for session times and locations.</p>`,
        accounts: `<h2>Your online accounts</h2>
          <p>Your University account should still be active from your previous year of study. If you have any issues logging in or accessing Moodle, please contact <a href="mailto:itsupport@port.ac.uk">IT Support</a>. Remember to check your University email regularly for important updates.</p>`
      };
    } else if (courseType === 'PGT') {
      return {
        welcome: `<h2>Welcome to Postgraduate Study at Portsmouth!</h2>
          <p>Congratulations on beginning your postgraduate journey with us. Your induction is tailored to help you transition smoothly into postgraduate-level study, understand the expectations and resources available to you, and connect with your cohort. We encourage you to engage fully with all sessions.</p>`,
        accounts: `<h2>Accessing your online accounts</h2>
          <p>You will need access to your University of Portsmouth account to use Moodle, your University email, and library resources. Please ensure your account is set up before your induction begins. Contact <a href="mailto:itsupport@port.ac.uk">IT Support</a> if you experience any difficulties.</p>`
      };
    } else {
      return {
        welcome: `<h2>Welcome to your induction!</h2>
          <p>Please attend all sessions listed below. These sessions are designed to help you get started with your studies and make the most of everything the University of Portsmouth has to offer.</p>`,
        accounts: `<h2>Your online accounts</h2>
          <p>Make sure you have set up your University of Portsmouth account to access all online systems. Contact <a href="mailto:itsupport@port.ac.uk">IT Support</a> if you need assistance.</p>`
      };
    }
  }

  // ── Data loading ───────────────────────────────────────────
  function loadData() {
    if (window.__COURSES_DATA__) {
      allCourses = window.__COURSES_DATA__.filter(c => Object.values(c.years).some(y => y.events.length > 0));
      filteredCourses = allCourses;
      initApp();
    } else {
      if ($loadingState) {
        $loadingState.innerHTML = '<p role="alert" style="color:#C0392B">Unable to load course data. Please ensure data.js is present.</p>';
      }
    }
  }

  function initApp() {
    if ($loadingState) $loadingState.remove();
    buildAlphaIndex();
    renderCourses();
    setupEventListeners();
    handleUrlHash();
  }

  // ── Event listeners ────────────────────────────────────────
  function setupEventListeners() {
    // Search
    $searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(handleSearch, 300);
      $clearBtn.hidden = $searchInput.value.length === 0;
    });

    $clearBtn.addEventListener('click', () => {
      $searchInput.value = '';
      $clearBtn.hidden = true;
      currentSearch = '';
      applyFilters();
      $searchInput.focus();
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        currentFilter = btn.dataset.filter;
        applyFilters();
      });
    });

    // Back button
    $backBtn.addEventListener('click', showListing);

    // Browser back/forward
    window.addEventListener('popstate', handleUrlHash);
  }

  // ── Search & filter ────────────────────────────────────────
  function handleSearch() {
    currentSearch = $searchInput.value.trim().toLowerCase();
    applyFilters();
  }

  function applyFilters() {
    filteredCourses = allCourses.filter(course => {
      const matchesSearch = !currentSearch || course.name.toLowerCase().includes(currentSearch);
      const matchesFilter = currentFilter === 'all' || course.course_type === currentFilter;
      return matchesSearch && matchesFilter;
    });
    buildAlphaIndex();
    renderCourses();
    announceResults();
  }

  function announceResults() {
    const count = filteredCourses.length;
    $searchStatus.textContent = count === 0
      ? 'No courses found. Try a different search term.'
      : `${count} course${count !== 1 ? 's' : ''} found.`;
    $resultsCount.textContent = `${count} course${count !== 1 ? 's' : ''} shown`;
  }


  // Extract subject title for sorting/grouping (strips leading award prefix)
  function subjectSortKey(name) {
    // Strip award prefix, then any leading non-alpha chars, so A-Z index is always clean
    return name
      .replace(/^(BA|BSc|BEng|BN|BM|BDS|BVM&S|MEng|MSc|MA|MBA|MFA|MPhil|MRes|LLB|LLM|FdA|FdSc|FdEng|HND|HNC|CertHE|DipHE|PGCE|PGDE|PGCert|PGDip|PhD|DProf|EdD|DNurse|DClinPsy|ProfDoc)(\s*\([^)]+\))*\s*/i, '')
      .replace(/^[^A-Za-z]+/, '')
      .trim()
      .toUpperCase();
  }

  // ── Alpha index ────────────────────────────────────────────
  function buildAlphaIndex() {
    const letters = new Set(filteredCourses.map(c => subjectSortKey(c.name)[0]).filter(Boolean));
    const all = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $alphaIndex.innerHTML = '';
    for (const l of all) {
      const a = document.createElement('a');
      a.textContent = l;
      a.className = 'alpha-link' + (letters.has(l) ? ' has-courses' : ' disabled');
      if (letters.has(l)) {
        a.href = `#letter-${l}`;
        a.setAttribute('aria-label', `Jump to courses beginning with ${l}`);
      } else {
        a.setAttribute('aria-disabled', 'true');
        a.role = 'none';
      }
      $alphaIndex.appendChild(a);
    }
  }

  // ── Render courses listing ─────────────────────────────────
  function renderCourses() {
    // Group by first letter
    const grouped = {};
    for (const course of filteredCourses) {
      const letter = subjectSortKey(course.name)[0] || '?';
      if (!grouped[letter]) grouped[letter] = [];
      grouped[letter].push(course);
    }

    $coursesListing.innerHTML = '';

    if (filteredCourses.length === 0) {
      $coursesListing.innerHTML = `
        <div class="no-results" role="alert">
          <span class="no-results-icon" aria-hidden="true">🔍</span>
          <h2>No courses found</h2>
          <p>Try searching with a different keyword or adjust the filter above.</p>
        </div>`;
      return;
    }

    for (const letter of Object.keys(grouped).sort()) {
      const section = document.createElement('section');
      section.id = `letter-${letter}`;
      section.className = 'letter-section';
      section.setAttribute('aria-labelledby', `letter-heading-${letter}`);

      const heading = document.createElement('h2');
      heading.id = `letter-heading-${letter}`;
      heading.className = 'letter-heading';
      heading.textContent = letter;
      section.appendChild(heading);

      const list = document.createElement('ul');
      list.setAttribute('role', 'list');

      for (const course of grouped[letter]) {
        const li = buildCourseCard(course);
        list.appendChild(li);
      }

      section.appendChild(list);
      $coursesListing.appendChild(section);
    }
  }

  function buildCourseCard(course) {
    const li = document.createElement('li');
    li.className = 'course-card';

    const typeLabel = course.course_type === 'UG' ? 'Undergraduate'
      : course.course_type === 'PGT' ? 'Postgraduate' : 'Other';

    const years = Object.values(course.years).sort((a, b) => a.year - b.year);
    const yearLinksHtml = years.map(y => {
      const count = y.events.length;
      const label = YEAR_LABELS[y.year] || `Year ${y.year}`;
      return `<button type="button" class="year-link" 
        data-course="${escHtml(course.name)}" 
        data-year="${y.year}"
        aria-label="View induction timetable for ${escHtml(course.name)}, ${label}">
        ${escHtml(label)}
        ${count > 0 ? `<span class="event-count" aria-label="${count} session${count !== 1 ? 's' : ''}">${count}</span>` : ''}
      </button>`;
    }).join('');

    li.innerHTML = `
      <div class="course-card-header">
        <span class="course-name">${escHtml(course.name)}</span>
        <span class="course-type-badge badge-${course.course_type}" aria-label="Course type: ${typeLabel}">${typeLabel}</span>
      </div>
      <div class="year-links">
        ${yearLinksHtml.length ? yearLinksHtml : '<span class="no-events-badge">No induction events scheduled</span>'}
      </div>`;

    // Bind click
    li.querySelectorAll('.year-link').forEach(btn => {
      btn.addEventListener('click', () => {
        const courseName = btn.dataset.course;
        const year = parseInt(btn.dataset.year, 10);
        const course = allCourses.find(c => c.name === courseName);
        if (course) showDetail(course, year);
      });
    });

    return li;
  }

  // ── Detail view ────────────────────────────────────────────
  function showDetail(course, year) {
    currentCourse = course;
    currentYear = year;

    // Update URL (no reload)
    const slug = slugify(course.name);
    const yearStr = YEAR_LABELS[year] ? YEAR_LABELS[year].toLowerCase().replace(' ', '-') : `year-${year}`;
    const newHash = `#detail/${slug}/${yearStr}`;
    history.pushState({ view: 'detail', courseName: course.name, year }, '', newHash);

    renderDetail(course, year);
    showView('detail');
    $detailCourseName.focus();
  }

  function renderDetail(course, year) {
    const yearData = course.years[year];
    const yearLabel = YEAR_LABELS[year] || `Year ${year}`;

    // Heading
    $detailCourseName.textContent = course.name;

    // Breadcrumb
    $detailBreadcrumb.textContent = `${course.name} › ${yearLabel}`;

    // Year tabs
    $detailYearTabs.innerHTML = '';
    const sortedYears = Object.values(course.years).sort((a, b) => a.year - b.year);
    sortedYears.forEach(y => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'year-tab' + (y.year === year ? ' active' : '');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', y.year === year ? 'true' : 'false');
      btn.setAttribute('aria-label', `${YEAR_LABELS[y.year] || 'Year ' + y.year} — ${y.events.length} session${y.events.length !== 1 ? 's' : ''}`);
      btn.textContent = YEAR_LABELS[y.year] || `Year ${y.year}`;
      btn.addEventListener('click', () => {
        currentYear = y.year;
        renderDetail(course, y.year);
      });
      $detailYearTabs.appendChild(btn);
    });

    // Welcome text
    const texts = getWelcomeText(course.course_type, year);
    $detailWelcome.innerHTML = texts.welcome;
    $detailAccounts.innerHTML = texts.accounts;

    // Sidebar module info
    const modCode = yearData ? yearData.mod_code : '—';
    $sidebarDl.innerHTML = `
      <dt>Course</dt><dd>${escHtml(course.name)}</dd>
      <dt>Year of study</dt><dd>${escHtml(yearLabel)}</dd>
    `;
    // Footnote below detail block
    const existingNote = document.getElementById('detail-footnote');
    if (existingNote) existingNote.remove();
    const fnote = document.createElement('p');
    fnote.id = 'detail-footnote';
    fnote.className = 'meta-note';
    fnote.innerHTML = `Induction Module ID: <code>${escHtml(modCode)}</code> | Course code: ${escHtml(course.crs_code)}`;
    $sidebarDl.insertAdjacentElement('afterend', fnote);

    // Timetable
    if (!yearData || yearData.events.length === 0) {
      $timetableContent.innerHTML = `
        <div class="no-timetable" role="alert">
          <p>No induction events have been scheduled for this year of study yet. Please check back closer to your start date or contact your School office.</p>
        </div>`;
      return;
    }

    // Group by date
    const byDate = {};
    for (const ev of yearData.events) {
      const key = ev.date_sort || ev.date;
      if (!byDate[key]) byDate[key] = { label: ev.date, events: [] };
      byDate[key].events.push(ev);
    }

    let html = '';
    for (const [dateKey, group] of Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]))) {
      html += `<div class="timetable-day-group">
        <h3 class="timetable-day-heading">${escHtml(group.label)}</h3>
        <table class="timetable-table" aria-label="Induction events on ${escHtml(group.label)}">
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Session</th>
              <th scope="col">Location</th>
              <th scope="col">Finishes</th>
            </tr>
          </thead>
          <tbody>`;
      for (const ev of group.events.sort((a, b) => (a.time > b.time ? 1 : -1))) {
        const locationHtml = buildLocationHtml(ev);
        html += `<tr>
          <td class="event-time">${escHtml(ev.time)}</td>
          <td>
            <div class="event-title">${escHtml(ev.title)}</div>
            ${ev.description ? `<div class="event-description">${escHtml(ev.description)}</div>` : ''}

          </td>
          <td class="event-location">${locationHtml}</td>
          <td class="event-time">${escHtml(ev.finish)}</td>
        </tr>`;
      }
      html += `</tbody></table></div>`;
    }
    $timetableContent.innerHTML = html;
  }

  function buildLocationHtml(ev) {
    if (ev.is_online) {
      return `<span class="online-badge" aria-label="Online session">
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
        </svg>Online</span>`;
    }
    const parts = [];
    if (ev.room && ev.room !== 'nan' && ev.room !== '') parts.push(`Room ${ev.room}`);
    if (ev.site && ev.site !== 'nan' && ev.site !== '') parts.push(ev.site);
    return parts.length ? `<span aria-hidden="true">📍 </span>${escHtml(parts.join(', '))}` : '<span class="event-location" aria-label="Location not specified">—</span>';
  }

  // ── View switching ─────────────────────────────────────────
  function showView(view) {
    if (view === 'listing') {
      $listingView.removeAttribute('hidden');
      $detailView.setAttribute('hidden', '');
      $searchInput.focus();
    } else {
      $listingView.setAttribute('hidden', '');
      $detailView.removeAttribute('hidden');
    }
    currentView = view;
  }

  function showListing() {
    history.pushState({ view: 'listing' }, '', window.location.pathname);
    showView('listing');
  }

  // ── URL hash handling ──────────────────────────────────────
  function handleUrlHash() {
    const hash = window.location.hash;
    if (hash.startsWith('#detail/')) {
      const parts = hash.replace('#detail/', '').split('/');
      const slug = parts[0];
      const course = allCourses.find(c => slugify(c.name) === slug);
      if (course) {
        const yearStr = parts[1] || 'year-1';
        const year = yearFromStr(yearStr);
        const actualYear = course.years[year] ? year : Object.keys(course.years)[0];
        renderDetail(course, parseInt(actualYear, 10));
        showView('detail');
        return;
      }
    }
    showView('listing');
  }

  function yearFromStr(s) {
    if (s.includes('foundation')) return 0;
    const m = s.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 1;
  }

  // ── Utilities ──────────────────────────────────────────────
  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // ── Boot ───────────────────────────────────────────────────
  loadData();

})();
