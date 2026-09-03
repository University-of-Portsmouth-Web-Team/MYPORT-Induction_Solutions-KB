/* ============================================================
   University of Portsmouth — Induction Timetable Embeddable Widget
   Version: 1.0 (January 2026 data)

   USAGE: 
   1. Include data.js on the page (or supply data via window.__COURSES_DATA__)
   2. Include this script on the page
   3. Add <div data-uop-induction></div> wherever you want the widget

   Optional attributes on the container div:
     data-uop-induction-mode="search"     → Show only search/listing (for search page)
     data-uop-induction-mode="full"       → Search + detail inline (default)
     data-uop-induction-course="BA (Hons) Animation"  → Pre-filter to a course
     data-uop-induction-type="UG"        → Pre-filter by course type
   ============================================================ */
(function () {
  'use strict';

  const WIDGET_VERSION = '1.0.0';
  const YEAR_LABELS = { 0: 'Foundation Year', 1: 'Year 1', 2: 'Year 2', 3: 'Year 3', 4: 'Year 4', 5: 'Year 5', 6: 'Year 6' };

  // ── CSS injected into the page (scoped with .uop-ind prefix) ─
  const WIDGET_CSS = `
    .uop-ind *,
    .uop-ind *::before,
    .uop-ind *::after { box-sizing: border-box; }
    .uop-ind {
      --ui-navy: #0078B4;
      --ui-navy-d: #004F76;
      --ui-gold: #621360;
      --ui-gold-l: #00A0FF;
      --ui-teal: #005681;
      --ui-white: #ffffff;
      --ui-bg: #FAFAFA;
      --ui-bg-w: #F2FAFF;
      --ui-surf: #ffffff;
      --ui-bdr: #D1D1D1;
      --ui-bdr-s: #ABAAAA;
      --ui-txt: #3C3C3C;
      --ui-txt2: #505457;
      --ui-txtm: #505457;
      --ui-link: #0078B4;
      --ui-link-h: #004F76;
      --ui-focus: #0078B4;
      --ui-head: #3C023C;
      font-family: 'Open Sans', 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: var(--ui-txt);
      background: var(--ui-bg);
      border-radius: 0;
      overflow: hidden;
    }
    .uop-ind a { color: var(--ui-link); text-decoration: underline; text-underline-offset: 2px; }
    .uop-ind a:hover { color: var(--ui-link-h); }
    .uop-ind *:focus-visible {
      outline: 3px solid var(--ui-focus);
      outline-offset: 2px;
      border-radius: 0;
    }
    .uop-ind h1,
    .uop-ind h2,
    .uop-ind h3 { font-weight: 700; line-height: 1.25; color: var(--ui-head); margin: 0; }
    .uop-ind [hidden] { display: none !important; }
    .uop-ind .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0;
      margin: -1px; overflow: hidden; clip: rect(0,0,0,0);
      white-space: nowrap; border: 0;
    }

    /* Widget header bar */
    .uop-ind__header {
      background: var(--ui-navy);
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .uop-ind__header-title {
      font-size: 1.0625rem;
      font-weight: 700;
      color: var(--ui-white);
    }
    .uop-ind__header-sub {
      font-size: 0.8125rem;
      color: var(--ui-white);
      margin-top: 2px;
    }
    .uop-ind__back-btn {
      display: inline-flex; align-items: center; gap: 6px;
      background: var(--ui-navy-d);
      border: 1.5px solid var(--ui-white);
      border-radius: 0;
      color: white; font-size: 0.8125rem; font-weight: 500;
      padding: 6px 12px; cursor: pointer; white-space: nowrap;
      transition: background 0.2s;
    }
    .uop-ind__back-btn:hover { background: var(--ui-white); color: var(--ui-navy-d); }

    /* Search panel */
    .uop-ind__search-wrap { padding: 16px 20px; background: var(--ui-surf); border-bottom: 1px solid var(--ui-bdr); }
    .uop-ind__search-label { display: block; font-weight: 600; font-size: 0.9375rem; margin-bottom: 6px; color: var(--ui-txt); }
    .uop-ind__search-row { position: relative; display: flex; align-items: center; }
    .uop-ind__search-ico { position: absolute; left: 11px; color: var(--ui-txtm); pointer-events: none; }
    .uop-ind__search-input {
      width: 100%; font-size: 0.9375rem; font-family: inherit;
      padding: 10px 36px; border: 2px solid var(--ui-bdr-s);
      border-radius: 0; background: var(--ui-bg); color: var(--ui-txt);
      transition: border-color 0.15s, box-shadow 0.15s;
      -webkit-appearance: none; appearance: none;
    }
    .uop-ind__search-input::-webkit-search-cancel-button { -webkit-appearance: none; }
    .uop-ind__search-input:focus { outline: none; border-color: var(--ui-focus); box-shadow: 0 0 0 3px rgba(0,94,184,0.18); }
    .uop-ind__search-input::placeholder { color: var(--ui-txtm); }
    .uop-ind__clear-btn {
      position: absolute; right: 8px; background: none; border: none;
      cursor: pointer; color: var(--ui-txtm); padding: 4px;
      display: flex; align-items: center; border-radius: 0;
    }
    .uop-ind__clear-btn:hover { color: var(--ui-txt); }

    /* Filters */
    .uop-ind__filters {
      display: flex; flex-wrap: wrap; align-items: center;
      gap: 8px; padding: 10px 20px;
      background: var(--ui-bg-w); border-bottom: 1px solid var(--ui-bdr);
    }
    .uop-ind__filter-label { font-size: 0.8125rem; font-weight: 600; color: var(--ui-txt2); }
    .uop-ind__filter-btn {
      background: var(--ui-surf); border: 1.5px solid var(--ui-bdr-s);
      border-radius: 0; padding: 4px 14px;
      font-size: 0.8125rem; font-weight: 500; font-family: inherit;
      color: var(--ui-txt2); cursor: pointer; transition: all 0.15s;
    }
    .uop-ind__filter-btn:hover { border-color: var(--ui-navy); color: var(--ui-navy); }
    .uop-ind__filter-btn.active {
      background: var(--ui-navy); border-color: var(--ui-navy); color: white;
    }
    .uop-ind__count { font-size: 0.8125rem; color: var(--ui-txtm); margin-left: auto; }

    /* Course list */
    .uop-ind__list { max-height: 520px; overflow-y: auto; }
    .uop-ind__alpha { display: flex; flex-wrap: wrap; gap: 2px; padding: 8px 20px; border-bottom: 1px solid var(--ui-bdr); }
    .uop-ind__alpha-lnk {
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; font-size: 0.8125rem; font-weight: 600;
      color: var(--ui-txt2); text-decoration: none; border-radius: 0;
      transition: all 0.15s;
    }
    .uop-ind__alpha-lnk.has {
      color: var(--ui-navy); background: var(--ui-white);
      border: 1.5px solid var(--ui-navy); cursor: pointer;
    }
    .uop-ind__alpha-lnk.has:hover,
    .uop-ind__alpha-lnk.has:focus-visible { background: var(--ui-navy); color: var(--ui-white); }
    .uop-ind__alpha-lnk.off {
      color: #949494; border: 1.5px solid transparent;
      cursor: default; pointer-events: none;
    }
    .uop-ind__letter-hd {
      font-size: 1.125rem; font-weight: 700; color: var(--ui-head);
      padding: 12px 20px 4px; border-bottom: 2px solid var(--ui-gold);
      display: inline-block; margin: 4px 20px 0;
    }
    .uop-ind__course-item {
      border-bottom: 1px solid var(--ui-bdr);
      list-style: none;
    }
    .uop-ind__course-item:last-child { border-bottom: none; }
    .uop-ind__course-hd {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 20px 8px; gap: 12px;
    }
    .uop-ind__course-nm { font-size: 0.9375rem; font-weight: 600; color: var(--ui-head); }
    .uop-ind__badge {
      font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.05em;
      text-transform: uppercase; padding: 2px 8px; border-radius: 0; flex-shrink: 0;
    }
    .uop-ind__badge-UG { background: #F2FAFF; color: #005681; border: 1px solid #99CDE9; }
    .uop-ind__badge-PGT { background: #F7EFF7; color: #621360; border: 1px solid #D4A8D3; }
    .uop-ind__badge-Other { background: #F7F7F7; color: #3C3C3C; border: 1px solid #D1D1D1; }
    .uop-ind__year-row { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 20px 12px; }
    .uop-ind__year-btn {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 0.8125rem; font-weight: 500; font-family: inherit;
      color: var(--ui-link); text-decoration: none;
      padding: 5px 12px; background: var(--ui-surf);
      border: 1.5px solid var(--ui-bdr); border-radius: 0;
      cursor: pointer; transition: all 0.15s;
    }
    .uop-ind__year-btn:hover { background: var(--ui-navy); border-color: var(--ui-navy); color: white; }
    .uop-ind__year-btn:hover .uop-ind__ev-cnt { background: #fff; color: var(--ui-head); }
    .uop-ind__ev-cnt {
      background: var(--ui-head); color: #fff;
      font-size: 0.6875rem; font-weight: 700; padding: 1px 6px; border-radius: 0;
    }

    /* Detail view */
    .uop-ind__detail { overflow-y: auto; max-height: 600px; }
    .uop-ind__detail-inner { padding: 20px; }
    .uop-ind__detail-h1 { font-size: 1.3125rem; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 3px solid var(--ui-gold); }
    .uop-ind__yr-tabs { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 16px; }
    .uop-ind__yr-tab {
      background: var(--ui-surf); border: 1.5px solid var(--ui-bdr-s); border-bottom: none;
      border-radius: 0 6px 0 0; padding: 7px 18px;
      font-size: 0.875rem; font-weight: 500; font-family: inherit;
      color: var(--ui-txt2); cursor: pointer; transition: all 0.15s;
    }
    .uop-ind__yr-tab:hover { color: var(--ui-navy); border-color: var(--ui-navy); }
    .uop-ind__yr-tab.active { background: var(--ui-navy); border-color: var(--ui-navy); color: white; }

    /* Welcome/accounts */
    .uop-ind__welcome,
    .uop-ind__accounts {
      border-left: 4px solid var(--ui-teal); border-radius: 0 6px 6px 0;
      padding: 12px 16px; margin-bottom: 12px; background: #F0F8F8;
    }
    .uop-ind__welcome p, .uop-ind__accounts p { font-size: 0.875rem; color: var(--ui-txt2); margin-top: 4px; }

    /* Timetable table */
    .uop-ind__tt { width: 100%; border-collapse: collapse; font-size: 0.875rem; margin-bottom: 16px; }
    .uop-ind__tt thead th {
      font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--ui-txt2); padding: 8px 10px; border-bottom: 2px solid var(--ui-bdr);
      text-align: left; background: var(--ui-bg);
    }
    .uop-ind__tt tbody tr { border-bottom: 1px solid var(--ui-bdr); }
    .uop-ind__tt tbody tr:last-child { border-bottom: none; }
    .uop-ind__tt tbody tr:hover { background: var(--ui-bg); }
    .uop-ind__tt tbody td { padding: 10px; vertical-align: top; }
    .uop-ind__ev-time { font-weight: 700; white-space: nowrap; color: var(--ui-navy); font-variant-numeric: tabular-nums; }
    .uop-ind__ev-title { font-weight: 600; margin-bottom: 3px; }
    .uop-ind__ev-desc { font-size: 0.8125rem; color: var(--ui-txt2); }
    .uop-ind__ev-ids { font-size: 0.6875rem; color: var(--ui-txtm); font-family: monospace; margin-top: 3px; }
    .uop-ind__ev-loc { font-size: 0.8125rem; color: var(--ui-txt2); }
    .uop-ind__online-badge {
      display: inline-flex; align-items: center; gap: 3px;
      background: #F2FAFF; color: #005EB8;
      border: 1px solid #99CDE9; font-size: 0.6875rem; font-weight: 700;
      padding: 2px 7px; border-radius: 0; text-transform: uppercase; letter-spacing: 0.04em;
    }
    .uop-ind__day-hd {
      font-size: 0.9375rem; font-weight: 700; color: var(--ui-white);
      background: var(--ui-head); padding: 8px 10px;
      border-radius: 0; margin: 12px 0 0;
    }
    .uop-ind__loc-list { list-style: none; margin: 0; padding: 0; }
    .uop-ind__loc-list li { display: block; }
    .uop-ind__loc-list li + li { margin-top: 2px; }
    .uop-ind__ev-links { margin-top: 6px; }
    .uop-ind__join-link {
      display: block; color: var(--ui-link); font-weight: 600;
      text-decoration: underline; text-underline-offset: 2px; margin-top: 4px;
      overflow-wrap: anywhere;
    }
    .uop-ind__join-link:hover { color: var(--ui-link-h); }
    .uop-ind__no-events { text-align: center; padding: 32px 16px; color: var(--ui-txtm); font-size: 0.9375rem; }
    .uop-ind__info-block {
      border: 1px solid var(--ui-bdr); border-radius: 0;
      padding: 14px 16px; margin-bottom: 12px; font-size: 0.875rem;
    }
    .uop-ind__info-block h3 { font-size: 0.9375rem; margin-bottom: 6px; color: var(--ui-head); }
    .uop-ind__info-block p, .uop-ind__info-block ul { color: var(--ui-txt2); }
    .uop-ind__info-block ul { padding-left: 18px; margin-top: 4px; }
    .uop-ind__info-block li + li { margin-top: 4px; }
    .uop-ind__no-courses { text-align: center; padding: 40px 20px; color: var(--ui-txtm); }
    .uop-ind__loading { display: flex; flex-direction: column; align-items: center; padding: 48px; gap: 12px; color: var(--ui-txtm); }
    .uop-ind__spinner {
      width: 36px; height: 36px;
      border: 3px solid var(--ui-bdr); border-top-color: var(--ui-navy);
      border-radius: 0;
      animation: uop-spin 0.8s linear infinite;
    }
    @keyframes uop-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .uop-ind__spinner { animation: none; border-top-color: var(--ui-navy); }
    }
  `;

  // ── Inject CSS once ────────────────────────────────────────
  function injectFonts() {
    if (document.getElementById('uop-ind-fonts')) return;
    var l = document.createElement('link');
    l.id = 'uop-ind-fonts';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&family=Encode+Sans+Expanded:wght@500;700&display=swap';
    document.head.appendChild(l);
  }

  function injectStyles() {
    injectFonts();
    if (document.getElementById('uop-induction-styles')) return;
    const style = document.createElement('style');
    style.id = 'uop-induction-styles';
    style.textContent = WIDGET_CSS;
    document.head.appendChild(style);
  }

  // ── Widget class ───────────────────────────────────────────
  function subjectSortKey(name) {
    return name
      .replace(/^(BA|BSc|BEng|BN|BM|BDS|BVM&S|MEng|MSc|MA|MBA|MFA|MPhil|MRes|LLB|LLM|FdA|FdSc|FdEng|HND|HNC|CertHE|DipHE|PGCE|PGDE|PGCert|PGDip|PhD|DProf|EdD|DNurse|DClinPsy|ProfDoc)(\s*\([^)]+\))*\s*/i, '')
      .replace(/^[^A-Za-z]+/, '')
      .trim()
      .toUpperCase();
  }

  class InductionWidget {
    constructor(container) {
      this.container = container;
      this.mode = container.dataset.uopInductionMode || 'full';
      this.presetCourse = container.dataset.uopInductionCourse || null;
      this.presetType = container.dataset.uopInductionType || null;
      this.allCourses = [];
      this.filteredCourses = [];
      this.currentFilter = this.presetType || 'all';
      this.currentSearch = this.presetCourse || '';
      this.currentView = 'listing';
      this.currentCourse = null;
      this.currentYear = null;
      this.searchTimer = null;
      this.widgetId = 'uop-ind-' + Math.random().toString(36).substr(2, 8);
      this.init();
    }

    init() {
      injectStyles();
      this.container.classList.add('uop-ind');
      this.container.setAttribute('role', 'region');
      this.container.setAttribute('aria-label', 'Course induction timetables');
      this.render();
      this.loadData();
    }

    render() {
      this.container.innerHTML = `
        <div class="uop-ind__header">
          <div>
            <div class="uop-ind__header-title">Course Induction Timetables</div>
            <div class="uop-ind__header-sub">University of Portsmouth</div>
          </div>
          <button type="button" class="uop-ind__back-btn" id="${this.widgetId}-back" hidden aria-label="Return to course search">
            ← Back to search
          </button>
        </div>
        <div id="${this.widgetId}-listing">
          <div class="uop-ind__search-wrap" role="search" aria-label="Search courses">
            <label class="uop-ind__search-label" for="${this.widgetId}-search">Search for your course</label>
            <div class="uop-ind__search-row">
              <svg class="uop-ind__search-ico" aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" stroke-linecap="round"/>
              </svg>
              <input type="search" class="uop-ind__search-input"
                id="${this.widgetId}-search"
                placeholder="e.g. Architecture, Nursing…"
                autocomplete="off"
                aria-describedby="${this.widgetId}-status"
                value="${this.escHtml(this.currentSearch)}"
              >
              <button type="button" class="uop-ind__clear-btn" id="${this.widgetId}-clear" aria-label="Clear search" ${!this.currentSearch ? 'hidden' : ''}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div id="${this.widgetId}-status" class="sr-only" role="status" aria-live="polite"></div>
          </div>
          <div class="uop-ind__filters">
            <span class="uop-ind__filter-label">Filter:</span>
            <button type="button" class="uop-ind__filter-btn${this.currentFilter === 'all' ? ' active' : ''}" data-filter="all" aria-pressed="${this.currentFilter === 'all'}">All</button>
            <button type="button" class="uop-ind__filter-btn${this.currentFilter === 'UG' ? ' active' : ''}" data-filter="UG" aria-pressed="${this.currentFilter === 'UG'}">Undergraduate</button>
            <button type="button" class="uop-ind__filter-btn${this.currentFilter === 'PGT' ? ' active' : ''}" data-filter="PGT" aria-pressed="${this.currentFilter === 'PGT'}">Postgraduate</button>
            <span class="uop-ind__count" id="${this.widgetId}-count" aria-live="polite" aria-atomic="true"></span>
          </div>
          <div class="uop-ind__alpha" id="${this.widgetId}-alpha" role="navigation" aria-label="Alphabetical index"></div>
          <ul class="uop-ind__list" id="${this.widgetId}-list" role="list" aria-label="Course list"></ul>
        </div>
        <div id="${this.widgetId}-detail" class="uop-ind__detail" hidden></div>
      `;
      this.bindUI();
    }

    bindUI() {
      const id = this.widgetId;
      this.$back = this.container.querySelector(`#${id}-back`);
      this.$search = this.container.querySelector(`#${id}-search`);
      this.$clear = this.container.querySelector(`#${id}-clear`);
      this.$status = this.container.querySelector(`#${id}-status`);
      this.$count = this.container.querySelector(`#${id}-count`);
      this.$alpha = this.container.querySelector(`#${id}-alpha`);
      this.$list = this.container.querySelector(`#${id}-list`);
      this.$listingDiv = this.container.querySelector(`#${id}-listing`);
      this.$detailDiv = this.container.querySelector(`#${id}-detail`);

      this.$search.addEventListener('input', () => {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => this.doSearch(), 250);
        this.$clear.hidden = this.$search.value.length === 0;
      });
      this.$clear.addEventListener('click', () => {
        this.$search.value = '';
        this.$clear.hidden = true;
        this.currentSearch = '';
        this.applyFilters();
        this.$search.focus();
      });
      this.$back.addEventListener('click', () => this.showListing());
      this.container.querySelectorAll('.uop-ind__filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.container.querySelectorAll('.uop-ind__filter-btn').forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-pressed', 'false');
          });
          btn.classList.add('active');
          btn.setAttribute('aria-pressed', 'true');
          this.currentFilter = btn.dataset.filter;
          this.applyFilters();
        });
      });
    }

    loadData() {
      this.$list.innerHTML = `<li class="uop-ind__loading" role="status"><div class="uop-ind__spinner" aria-hidden="true"></div><span>Loading courses…</span></li>`;
      const data = window.__COURSES_DATA__;
      if (!data) {
        this.$list.innerHTML = `<li class="uop-ind__no-courses" role="alert">Unable to load course data. Please ensure data.js is included on the page.</li>`;
        return;
      }
      this.allCourses = data.filter(c => Object.values(c.years).some(y => y.events.length > 0));
      this.filteredCourses = data;
      if (this.currentSearch) this.applyFilters();
      else this.applyFilters();
    }

    doSearch() {
      this.currentSearch = this.$search.value.trim().toLowerCase();
      this.applyFilters();
    }

    applyFilters() {
      this.filteredCourses = this.allCourses.filter(c => {
        const ms = !this.currentSearch || c.name.toLowerCase().includes(this.currentSearch);
        const mf = this.currentFilter === 'all' || c.course_type === this.currentFilter;
        return ms && mf;
      });
      this.buildAlpha();
      this.renderList();
      const n = this.filteredCourses.length;
      this.$status.textContent = n === 0 ? 'No courses found.' : `${n} course${n !== 1 ? 's' : ''} found.`;
      this.$count.textContent = `${n} course${n !== 1 ? 's' : ''}`;
    }

    buildAlpha() {
      const letters = new Set(this.filteredCourses.map(c => subjectSortKey(c.name)[0]).filter(Boolean));
      const all = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let html = '';
      for (const l of all) {
        if (letters.has(l)) {
          html += `<a class="uop-ind__alpha-lnk has" href="#${this.widgetId}-letter-${l}" aria-label="Jump to ${l}">${l}</a>`;
        } else {
          html += `<span class="uop-ind__alpha-lnk off" aria-hidden="true">${l}</span>`;
        }
      }
      this.$alpha.innerHTML = html;
    }

    renderList() {
      if (this.filteredCourses.length === 0) {
        this.$list.innerHTML = `<li class="uop-ind__no-courses" role="alert">No courses match your search. Try a different keyword.</li>`;
        return;
      }
      const grouped = {};
      for (const c of this.filteredCourses) {
        const l = subjectSortKey(c.name)[0] || '?';
        if (!grouped[l]) grouped[l] = [];
        grouped[l].push(c);
      }
      let html = '';
      for (const l of Object.keys(grouped).sort()) {
        html += `<li><div class="uop-ind__letter-hd" id="${this.widgetId}-letter-${l}" aria-hidden="true">${l}</div><ul role="list">`;
        for (const c of grouped[l]) {
          const years = Object.values(c.years).sort((a, b) => a.year - b.year);
          const typeLabel = c.course_type === 'UG' ? 'Undergraduate' : c.course_type === 'PGT' ? 'Postgraduate' : 'Other';
          const yearBtns = years.map(y => {
            const cnt = y.events.length;
            const lbl = YEAR_LABELS[y.year] || `Year ${y.year}`;
            return `<button type="button" class="uop-ind__year-btn"
              data-course="${this.escHtml(c.name)}"
              data-year="${y.year}"
              aria-label="${this.escHtml(c.name)}, ${lbl}${cnt ? ', ' + cnt + ' session' + (cnt !== 1 ? 's' : '') : ''}">
              ${this.escHtml(lbl)}
              ${cnt ? `<span class="uop-ind__ev-cnt" aria-hidden="true">${cnt}</span>` : ''}
            </button>`;
          }).join('');
          html += `<li class="uop-ind__course-item">
            <div class="uop-ind__course-hd">
              <span class="uop-ind__course-nm">${this.escHtml(c.name)}</span>
              <span class="uop-ind__badge uop-ind__badge-${c.course_type}" aria-label="${typeLabel}">${typeLabel}</span>
            </div>
            <div class="uop-ind__year-row">${yearBtns}</div>
          </li>`;
        }
        html += '</ul></li>';
      }
      this.$list.innerHTML = html;
      this.$list.querySelectorAll('.uop-ind__year-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const course = this.allCourses.find(c => c.name === btn.dataset.course);
          if (course) this.showDetail(course, parseInt(btn.dataset.year, 10));
        });
      });
    }

    showDetail(course, year) {
      this.currentCourse = course;
      this.currentYear = year;
      this.renderDetail(course, year);
      this.$listingDiv.hidden = true;
      this.$detailDiv.hidden = false;
      this.$back.hidden = false;
      this.$detailDiv.scrollTop = 0;
      this.$detailDiv.querySelector('.uop-ind__detail-h1').focus();
    }

    showListing() {
      this.$listingDiv.hidden = false;
      this.$detailDiv.hidden = true;
      this.$back.hidden = true;
      this.currentView = 'listing';
      this.$search.focus();
    }

    renderDetail(course, year) {
      const yd = course.years[year];
      const yl = YEAR_LABELS[year] || `Year ${year}`;
      const texts = this.getWelcomeTexts(course.course_type, year);
      const sortedYears = Object.values(course.years).sort((a, b) => a.year - b.year);
      const tabs = sortedYears.map(y => {
        const lbl = YEAR_LABELS[y.year] || `Year ${y.year}`;
        return `<button type="button" class="uop-ind__yr-tab${y.year === year ? ' active' : ''}"
          aria-label="${lbl}${y.events.length ? ', ' + y.events.length + ' sessions' : ''}"
          data-year="${y.year}">${this.escHtml(lbl)}</button>`;
      }).join('');

      let ttHtml = '';
      if (!yd || yd.events.length === 0) {
        ttHtml = `<div class="uop-ind__no-events" role="alert">No induction events scheduled yet. Please check back later or contact your School office.</div>`;
      } else {
        const byDate = {};
        // Duplicate rows suppressed by Induction Module ID + Event ID
        for (const ev of this.dedupeEvents(yd.events)) {
          const k = ev.date_sort || ev.date;
          if (!byDate[k]) byDate[k] = { label: ev.date, events: [] };
          byDate[k].events.push(ev);
        }
        for (const [dk, grp] of Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]))) {
          ttHtml += `<div class="uop-ind__day-hd">${this.escHtml(grp.label)}</div>
            <table class="uop-ind__tt" aria-label="${this.escHtml(grp.label)}">
              <thead><tr>
                <th scope="col">Time</th><th scope="col">Session</th><th scope="col">Location</th><th scope="col">Ends</th>
              </tr></thead><tbody>`;
          for (const ev of grp.events.slice().sort((a, b) => this.compareEventsByTime(a, b))) {
            ttHtml += `<tr>
              <td class="uop-ind__ev-time">${this.escHtml(ev.time)}</td>
              <td>
                <div class="uop-ind__ev-title">${this.escHtml(ev.title)}</div>
                ${ev.description ? `<div class="uop-ind__ev-desc">${this.linkifyDescription(ev.description)}</div>` : ''}
                ${this.buildLinksHtml(ev)}
              </td>
              <td class="uop-ind__ev-loc">${this.buildLoc(ev)}</td>
              <td class="uop-ind__ev-time">${this.escHtml(ev.finish)}</td>
            </tr>`;
          }
          ttHtml += `</tbody></table>`;
        }
      }

      this.$detailDiv.innerHTML = `<div class="uop-ind__detail-inner">
        <h2 class="uop-ind__detail-h1" tabindex="-1">${this.escHtml(course.name)}</h2>
        <div class="uop-ind__yr-tabs" role="tablist">${tabs}</div>
        <div class="uop-ind__welcome">${texts.welcome}</div>
        <div class="uop-ind__accounts">${texts.accounts}</div>
        <h3 style="font-size:1rem;margin:16px 0 8px;color:var(--ui-head)">Your induction timetable — ${this.escHtml(yl)}</h3>
        ${ttHtml}
        <div class="uop-ind__info-block">
          <h3>If you have any queries</h3>
          <p>Contact your School or Department office. Visit <a href="https://myport.port.ac.uk">MyPort</a> for further guidance, or email <a href="mailto:itsupport@port.ac.uk">itsupport@port.ac.uk</a> for IT queries.</p>
        </div>
        <div class="uop-ind__info-block">
          <h3>International students</h3>
          <p>Please check your email and the <a href="https://myport.port.ac.uk/student-services/international-student-advice">International Students pages</a> for additional orientation sessions, visa sign-in information and English language support.</p>
        </div>
        <div class="uop-ind__info-block">
          <h3>Further information</h3>
          <ul>
            <li><a href="https://myport.port.ac.uk/welcome/maps-and-directions">Campus maps</a></li>
            <li><a href="https://myport.port.ac.uk/student-services">Student services</a></li>
            <li><a href="https://www.upsu.net">Portsmouth Students' Union</a></li>
          </ul>
        </div>
        <p style="font-size:0.75rem;color:var(--ui-txtm);margin-top:12px;">Module ID: <code>${this.escHtml(yd ? yd.mod_code : '—')}</code> | Course code: ${this.escHtml(course.crs_code)}</p>
      </div>`;

      this.$detailDiv.querySelectorAll('.uop-ind__yr-tab').forEach(btn => {
        btn.addEventListener('click', () => this.showDetail(course, parseInt(btn.dataset.year, 10)));
      });
    }

    buildLoc(ev) {
      if (ev.is_online) {
        return `<span class="uop-ind__online-badge" aria-label="Online session">⬛ Online</span>`;
      }
      const locs = this.getLocations(ev);
      if (!locs.length) return '—';
      if (locs.length === 1) return this.escHtml(this.formatLocation(locs[0]));
      // Multi-room booking: one room/building pair per line
      const items = locs.map(l => `<li>${this.escHtml(this.formatLocation(l))}</li>`).join('');
      return `<ul class="uop-ind__loc-list" aria-label="${locs.length} rooms booked for this session">${items}</ul>`;
    }

    // Convert a 12-hour clock string ("9:00am", "12:30pm") to minutes past
    // midnight.  Missing/unparseable values sort last rather than first.
    timeToMinutes(value) {
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

    // Chronological comparator for events within a single day.
    compareEventsByTime(a, b) {
      const diff = this.timeToMinutes(a.time) - this.timeToMinutes(b.time);
      if (diff !== 0) return diff;
      const finishDiff = this.timeToMinutes(a.finish) - this.timeToMinutes(b.finish);
      if (finishDiff !== 0) return finishDiff;
      return String(a.title || '').localeCompare(String(b.title || ''));
    }

    // Suppress duplicate rows by Induction Module ID + Event ID.  The pipeline
    // already does this; this guards against older data.js files.
    dedupeEvents(events) {
      const seen = new Set();
      const out = [];
      for (const ev of events || []) {
        const key = (ev.mod_code || '') + '|' + ev.event_id;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(ev);
      }
      return out;
    }

    notSet(v) { return !v || v === 'nan' || v === 'None'; }

    // Room number + building name pairs, falling back to the legacy flat fields
    getLocations(ev) {
      if (Array.isArray(ev.locations)) {
        return ev.locations.filter(l => l && (!this.notSet(l.room) || !this.notSet(l.building)));
      }
      const rooms     = this.notSet(ev.room) ? [] : String(ev.room).split(',').map(x => x.trim()).filter(Boolean);
      const buildings = this.notSet(ev.site) ? [] : String(ev.site).split(',').map(x => x.trim()).filter(Boolean);
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

    formatLocation(loc) {
      return [loc.room, loc.building].filter(v => !this.notSet(v)).join(', ');
    }

    safeUrl(url) {
      const u = String(url || '').trim();
      return /^https?:\/\//i.test(u) ? u : '';
    }

    // Meeting / resource links lifted out of Details, each on its own line
    buildLinksHtml(ev) {
      const links = Array.isArray(ev.links) ? ev.links : [];
      const html = links.map(l => {
        const url = this.safeUrl(l && l.url);
        if (!url) return '';
        return `<a href="${this.escHtml(url)}" target="_blank" rel="noopener noreferrer" class="uop-ind__join-link"
          >${this.escHtml(l.label || 'Open link')}<span aria-hidden="true"> \u2197</span><span class="sr-only"> (opens in a new tab)</span></a>`;
      }).join('');
      return html ? `<div class="uop-ind__ev-links">${html}</div>` : '';
    }

    getWelcomeTexts(type, year) {
      if (type === 'UG' && year === 1) {
        return {
          welcome: '<strong>Welcome to Portsmouth!</strong> Your induction sessions will help you settle in, meet your peers and find out everything you need about your course.',
          accounts: '<strong>Online accounts:</strong> Set up your University account before arriving to access Moodle, email and the library. Contact <a href="mailto:itsupport@port.ac.uk">IT Support</a> if you need help.'
        };
      } else if (type === 'UG') {
        return {
          welcome: '<strong>Welcome back!</strong> These returning-student sessions will get you up to speed for the new academic year.',
          accounts: '<strong>Your accounts:</strong> Your account should still be active. Check your University email regularly for important updates.'
        };
      } else {
        return {
          welcome: '<strong>Welcome to Postgraduate Study!</strong> Your induction is designed to help you transition into postgraduate study and connect with your cohort.',
          accounts: '<strong>Online accounts:</strong> Set up your University account to access Moodle, email and library resources before induction begins.'
        };
      }
    }

    // Fallback for older data.js files: any URL still inline in the description
    // becomes a hyperlink on its own line, delimiters stripped.
    linkifyDescription(text) {
      const escaped = this.escHtml(text);
      return escaped.replace(/[\[\(&quot;&#39;]?\s*(https?:\/\/[^\s\[\]<>&]+)/gi, (m, rawUrl) => {
        const url = this.safeUrl(rawUrl.replace(/[\]\),.;:!?]+$/, ''));
        if (!url) return m;
        return `<a href="${this.escHtml(url)}" target="_blank" rel="noopener noreferrer" class="uop-ind__join-link"
          >Join online session<span aria-hidden="true"> \u2197</span><span class="sr-only"> (opens in a new tab)</span></a>`;
      });
    }

    escHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
  }

  // ── Auto-init all [data-uop-induction] elements ────────────
  function initAll() {
    document.querySelectorAll('[data-uop-induction]').forEach(el => {
      if (!el._uopInductionWidget) {
        el._uopInductionWidget = new InductionWidget(el);
      }
    });
  }

  // Expose for manual init
  window.UoPInductionWidget = InductionWidget;
  window.UoPInductionWidget.initAll = initAll;

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

})();
