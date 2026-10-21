/**
 * PulseBet Studio — Next-Gen Sports, Upcoming Schedule & Signal Hit-Rate Controller (V4)
 * Features:
 *  - Zero Finished (FT) Matches in Match List or Radar: Strictly LIVE/HT + Today's Upcoming (SCHEDULED) Matches
 *  - Custom Glassmorphic League Picker Popover with Live Search & Match Counts
 *  - Real-Time Signal Settlement Tracker (✅ TUTTU / ❌ TUTMADI / ⏳ AKTİF) & Hit-Rate % Scoreboard
 *  - 7-Point Market Audit UI (Settled markets & 75'+ late-minute markets automatically locked)
 *  - Ephemeral Match Event Notifications & XSS-Hardened Logo Fallback
 */

(function () {
  function t(key, fallback = '') {
    return window.pulseI18n ? window.pulseI18n.t(key, fallback) : (fallback || key);
  }

  const state = {
    matches: [],
    events: [],
    signals: [],
    signalLedger: [],
    signalStats: { total: 0, won: 0, lost: 0, pending: 0, hitRatePct: 0 },
    starredIds: new Set(),
    dismissedIds: new Set(),
    selectedMatchId: null,
    activeView: 'center',          // 'center' | 'favorites' | 'radar'
    matchFilter: 'ALL',            // 'ALL' | 'LIVE' | 'UPCOMING' | 'SIGNALS'
    selectedLeague: 'ALL',
    leagueSearchQuery: '',
    leaguePopoverOpen: false,
    searchQuery: '',
    sigPanelFilter: 'ALL',         // 'ALL' | 'WON' | 'LOST' | 'PENDING'
    radarLedgerFilter: 'ALL',      // 'ALL' | 'PENDING' | 'WON' | 'LOST'
    theme: 'dark',                 // 'dark' | 'light' (Default to Deep Obsidian)
    starredOnlyNotifs: false,
    signalNotifsEnabled: true,
    enabledEventCategories: new Set(['goal', 'disallowed_goal', 'assist', 'shot', 'foul', 'card']),
    crestCache: new Map(),
    sessionStartTs: Date.now(),
    leftSidebarCollapsed: false,
    rightSidebarCollapsed: false,
    notifView: 'signals',          // 'signals' | 'events' | 'both'
    studioActiveTab: 'overview',   // 'overview' | 'stats' | 'signals' | 'markets' | 'timeline'
    studioTab: 'overview'
  };

  // Load UI preferences ONLY
  try {
    const saved = JSON.parse(localStorage.getItem('pulsebet_studio_prefs_v4') || '{}');
    if (Array.isArray(saved.enabledEventCategories)) {
      state.enabledEventCategories = new Set(saved.enabledEventCategories);
    }
    if (typeof saved.starredOnlyNotifs === 'boolean') {
      state.starredOnlyNotifs = saved.starredOnlyNotifs;
    }
    if (typeof saved.signalNotifsEnabled === 'boolean') {
      state.signalNotifsEnabled = saved.signalNotifsEnabled;
    }
    if (saved.theme === 'dark' || saved.theme === 'light') {
      state.theme = saved.theme;
    }
    if (typeof saved.soundEnabled === 'boolean' && window.pulseSound) {
      window.pulseSound.enabled = saved.soundEnabled;
    }
    if (typeof saved.leftSidebarCollapsed === 'boolean') {
      state.leftSidebarCollapsed = saved.leftSidebarCollapsed;
    }
    if (typeof saved.rightSidebarCollapsed === 'boolean') {
      state.rightSidebarCollapsed = saved.rightSidebarCollapsed;
    }
    if (saved.notifView === 'signals' || saved.notifView === 'events' || saved.notifView === 'both') {
      state.notifView = saved.notifView;
    }
    const savedStudioTab = saved.studioActiveTab || saved.studioTab;
    if (['overview', 'stats', 'signals', 'markets', 'timeline'].includes(savedStudioTab)) {
      state.studioActiveTab = savedStudioTab;
      state.studioTab = savedStudioTab;
    }
  } catch (_) {}

  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    const iconEl = document.getElementById('themeIcon');
    const labelEl = document.getElementById('themeLabel');
    if (iconEl && labelEl) {
      if (theme === 'dark') {
        iconEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
        labelEl.textContent = t('theme_light', 'Açık Tema');
      } else {
        iconEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
        labelEl.textContent = t('theme_dark', 'Koyu Tema');
      }
    }
  }
  applyTheme(state.theme);

  function saveUiPrefs() {
    try {
      localStorage.setItem('pulsebet_studio_prefs_v4', JSON.stringify({
        enabledEventCategories: Array.from(state.enabledEventCategories),
        starredOnlyNotifs: state.starredOnlyNotifs,
        signalNotifsEnabled: state.signalNotifsEnabled,
        theme: state.theme,
        soundEnabled: window.pulseSound ? window.pulseSound.enabled : true,
        leftSidebarCollapsed: state.leftSidebarCollapsed,
        rightSidebarCollapsed: state.rightSidebarCollapsed,
        notifView: state.notifView,
        studioActiveTab: state.studioActiveTab,
        studioTab: state.studioActiveTab
      }));
    } catch (_) {}
  }

  function switchStudioTab(tabName) {
    const valid = ['overview', 'stats', 'signals', 'markets', 'timeline'];
    if (!valid.includes(tabName)) tabName = 'overview';
    state.studioActiveTab = tabName;
    state.studioTab = tabName;

    const navTabs = document.querySelectorAll('#studioTabs .studio-tab-btn, #studioTabs .snav-tab, #studioNavBar .snav-tab, #studioNavBar .studio-tab-btn');
    navTabs.forEach(btn => {
      const match = (btn.getAttribute('data-studio-tab') === tabName) || (btn.getAttribute('data-stab') === tabName);
      btn.classList.toggle('active', match);
      btn.setAttribute('aria-selected', match ? 'true' : 'false');
    });

    const panes = {
      overview: document.getElementById('paneOverview'),
      stats: document.getElementById('paneStats'),
      signals: document.getElementById('paneSignals'),
      markets: document.getElementById('paneMarkets'),
      timeline: document.getElementById('paneTimeline')
    };

    Object.entries(panes).forEach(([k, pane]) => {
      if (pane) {
        pane.classList.toggle('hidden', k !== tabName);
        pane.classList.toggle('active', k === tabName);
      }
    });

    saveUiPrefs();
  }

  function toggleLeftSidebar(force) {
    state.leftSidebarCollapsed = typeof force === 'boolean' ? force : !state.leftSidebarCollapsed;
    applyLayoutPrefs();
    saveUiPrefs();
  }

  function toggleRightSidebar(force) {
    state.rightSidebarCollapsed = typeof force === 'boolean' ? force : !state.rightSidebarCollapsed;
    applyLayoutPrefs();
    saveUiPrefs();
  }

  function applyLayoutPrefs() {
    const container = document.getElementById('centerViewContainer');
    if (!container) return;
    container.classList.toggle('left-collapsed', state.leftSidebarCollapsed);
    container.classList.toggle('right-collapsed', state.rightSidebarCollapsed);

    const btnLeft = document.getElementById('btnToggleLeftSidebar');
    if (btnLeft) btnLeft.classList.toggle('active', state.leftSidebarCollapsed);

    const btnRight = document.getElementById('btnToggleRightSidebar');
    if (btnRight) btnRight.classList.toggle('active', state.rightSidebarCollapsed);

    const expLeft = document.getElementById('btnExpandLeft');
    if (expLeft) expLeft.classList.toggle('hidden', !state.leftSidebarCollapsed);

    const expRight = document.getElementById('btnExpandRight');
    if (expRight) expRight.classList.toggle('hidden', !state.rightSidebarCollapsed);

    const notifCol = document.getElementById('notificationsColumn');
    if (notifCol) {
      notifCol.setAttribute('data-nview', state.notifView || 'signals');
    }
    const segButtons = document.querySelectorAll('#notifSegmentTabs .nseg-tab');
    segButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-nview') === state.notifView);
    });
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeSearch(str = '') {
    return String(str)
      .toLowerCase()
      .replace(/ı/g, 'i').replace(/İ/g, 'i')
      .replace(/ş/g, 's').replace(/ğ/g, 'g')
      .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function formatShortSummary(str, maxLen = 85) {
    if (!str) return '';
    let text = String(str).trim();
    text = text.replace(/^(Gidişat Beklentisi:\s*|Taktiksel Analiz:\s*|Analiz:\s*)/i, '').trim();
    if (text.length > maxLen) {
      return text.slice(0, maxLen - 3).trim() + '...';
    }
    return text;
  }

  function cleanBadgeText(str, fallback = 'AKTİF') {
    if (!str) return fallback;
    const clean = String(str)
      .replace(/[✅❌⏳⚡🏆🔴🕒⏸️🏁⭐🔥🎯🛡️⚽🚀🛑🟨🟥]/g, '')
      .trim();
    return clean || fallback;
  }

  function getSafePlayerName(obj, fallback = '') {
    if (!obj) return fallback;
    const raw = typeof obj === 'string' ? obj : (obj.name || obj.playerName || obj.athlete || obj.player || obj.scorer);
    if (!raw || typeof raw !== 'string') return fallback;
    const clean = raw.trim();
    const lower = clean.toLowerCase();
    if (['undefined', 'null', 'bilinmeyen oyuncu', 'oyuncu', 'unknown', 'unknown player', 'n/a', ''].includes(lower)) {
      return fallback;
    }
    return clean;
  }

  function getSafeAssistName(inc) {
    if (!inc) return null;
    const raw = inc.assistPlayerName || inc.assistName || inc.assist || inc.assistPlayer;
    if (!raw || typeof raw !== 'string') return null;
    const clean = raw.trim();
    const lower = clean.toLowerCase();
    if (['undefined', 'null', 'bilinmeyen oyuncu', 'oyuncu', 'unknown', 'unknown player', 'n/a', ''].includes(lower)) {
      return null;
    }
    return clean;
  }

  function getSafeTeamName(teamCodeOrName, match, defaultFallback = 'Takım') {
    if (!match) return defaultFallback;
    if (teamCodeOrName === 'HOME') return match.home?.name || 'Ev Sahibi';
    if (teamCodeOrName === 'AWAY') return match.away?.name || 'Deplasman';
    if (typeof teamCodeOrName === 'string' && teamCodeOrName.trim()) {
      const lower = teamCodeOrName.trim().toLowerCase();
      if (!['undefined', 'null', ''].includes(lower)) return teamCodeOrName.trim();
    }
    return defaultFallback;
  }

  function isSafeHttpUrl(url) {
    return typeof url === 'string' && /^https?:\/\//i.test(url);
  }

  function createTeamCrestDataUri(teamName) {
    const clean = String(teamName || 'FC').trim();
    if (state.crestCache.has(clean)) return state.crestCache.get(clean);

    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = clean.charCodeAt(i) + ((hash << 5) - hash);
    }
    const palettes = [
      ['#4f46e5', '#3730a3'],
      ['#10b981', '#047857'],
      ['#2563eb', '#1d4ed8'],
      ['#e11d48', '#be123c'],
      ['#d97706', '#b45309'],
      ['#7c3aed', '#5b21b6'],
      ['#0891b2', '#0e7490'],
      ['#db2777', '#9d174d']
    ];
    const [c1, c2] = palettes[Math.abs(hash) % palettes.length];
    const words = clean.replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g, '').split(/\s+/).filter(Boolean);
    const initials = words.length >= 2
      ? (words[0][0] + words[1][0]).toUpperCase()
      : clean.slice(0, 2).toUpperCase();

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${c1}"/>
          <stop offset="100%" stop-color="${c2}"/>
        </linearGradient>
      </defs>
      <path d="M32 4 L56 12 V30 C56 46 45 55 32 60 C19 55 8 46 8 30 V12 Z" fill="url(#g)" stroke="rgba(255,255,255,0.4)" stroke-width="2.5"/>
      <text x="32" y="38" text-anchor="middle" fill="#ffffff" font-family="Plus Jakarta Sans, Arial, sans-serif" font-weight="800" font-size="20">${escapeHtml(initials)}</text>
    </svg>`;
    const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    if (state.crestCache.size >= 500) {
      const oldestKey = state.crestCache.keys().next().value;
      state.crestCache.delete(oldestKey);
    }
    state.crestCache.set(clean, uri);
    return uri;
  }

  function resolveLogo(logoUrl, teamName) {
    return isSafeHttpUrl(logoUrl) ? logoUrl : createTeamCrestDataUri(teamName);
  }

  function handleLogoFallback(imgEl, teamName, backupLogo) {
    if (!imgEl) return;
    if (isSafeHttpUrl(backupLogo) && imgEl.src !== backupLogo && !imgEl.dataset.triedBackup) {
      imgEl.dataset.triedBackup = '1';
      imgEl.src = backupLogo;
      return;
    }
    imgEl.src = createTeamCrestDataUri(teamName || 'FC');
  }

  function setImgWithFallback(imgEl, logoUrl, teamName, backupLogo) {
    if (!imgEl) return;
    delete imgEl.dataset.triedBackup;
    imgEl.dataset.teamName = teamName || 'FC';
    imgEl.dataset.backupLogo = backupLogo || '';
    imgEl.src = resolveLogo(logoUrl, teamName);
  }

  // ================= STRICT NON-FT FILTER & SIGNAL HELPERS =================
  function filterOutFinishedMatches(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(m => m && (m.status === 'LIVE' || m.status === 'HT' || m.status === 'SCHEDULED'));
  }

  function isMatchValidForSignalNotif(m) {
    if (!m) return false;
    if (m.status !== 'LIVE' && m.status !== 'HT') return false;
    const min = m.minute || 0;
    if (m.status === 'LIVE' && (min < 10 || min >= 75)) return false;
    // The server ledger is the single source of truth: a match only shows as "signal" if the server actually emitted one
    return state.signalLedger.some(r => r.matchId === m.matchId && r.settlementStatus === 'PENDING') &&
      Boolean(m.analysis?.quant?.primarySignal);
  }

  function purgeStaleClientNotifications() {
    const now = Date.now();
    const matchMap = new Map(state.matches.map(m => [m.matchId, m]));

    // 1. Purge Match Event Notifications for finished/non-live matches or older than 3 mins
    state.events = state.events.filter(ev => {
      if (state.dismissedIds.has(ev.id)) return false;
      if (now - (ev.timestamp || now) > 180000) return false;
      const m = matchMap.get(ev.matchId);
      if (!m || m.status !== 'LIVE' || (m.minute || 0) >= 90) return false;
      return true;
    });

    // 2. Signal ledger is owned by the server (cooldown, warm-up, per-match limits, settlement).
    //    The client never fabricates ledger entries from transient analysis states.

    recomputeClientSignalStats();
  }

  function recomputeClientSignalStats() {
    let won = 0, lost = 0, pending = 0;
    for (const item of state.signalLedger) {
      if (state.dismissedIds.has(item.id)) continue;
      if (item.settlementStatus === 'WON') won++;
      else if (item.settlementStatus === 'LOST') lost++;
      else if (item.settlementStatus === 'PENDING') pending++;
    }
    const settled = won + lost;
    const hitRatePct = settled > 0 ? Math.round((won / settled) * 100) : 0;
    state.signalStats = {
      total: won + lost + pending,
      won,
      lost,
      pending,
      hitRatePct
    };
  }

  // ================= SOURCE PILLS =================
  function renderSourceStatus(sourceStatus) {
    if (!sourceStatus) return;
    const el = document.getElementById('src-live');
    if (!el) return;
    const anyActive = Object.values(sourceStatus).some(info => info && info.active);
    el.classList.toggle('online', anyActive);
    const nameEl = el.querySelector('.name');
    if (nameEl) nameEl.textContent = anyActive ? 'Canlı' : 'Bağlanıyor';
  }

  // ================= CUSTOM LEAGUE PICKER POPOVER & MATCH LIST =================
  function getLeaguePrestigeScore(leagueName) {
    const l = String(leagueName || '').toLowerCase().trim();
    if (!l) return 0;
    if (
      l.includes('u23') || l.includes('u22') || l.includes('u21') || l.includes('u20') ||
      l.includes('u19') || l.includes('u18') || l.includes('u17') || l.includes('u16') ||
      l.includes('reserve') || l.includes('rezerv') || l.includes('reserva') ||
      l.includes('amateur') || l.includes('amatör') || l.includes('akademi') || l.includes('academy')
    ) return -20;

    if (
      l === 'uluslararası lig' || l === 'uluslararası' || l === 'uluslararasi' ||
      l === 'uluslararası futbol' || l === 'uluslararası kulüpler' ||
      l === 'international' || l === 'world' || l === 'dünya' || l === 'lig' ||
      l === 'diğer ligler' || l === 'futbol'
    ) return 5;

    if (l.includes('champions league') || l.includes('şampiyonlar ligi') || l.includes('sampiyonlar ligi') || l.includes('ucl')) return 100;
    if (l.includes('world cup') || l.includes('dünya kupası') || l.includes('dunya kupasi')) return 98;
    if (l.includes('euro 20') || l.includes('avrupa şampiyonası') || l.includes('avrupa futbol şampiyonası')) return 96;
    if (l.includes('europa league') || l.includes('avrupa ligi') || l.includes('uel')) return 90;
    if (l.includes('copa libertadores') || l.includes('libertadores')) return 88;
    if (l.includes('conference league') || l.includes('konferans ligi') || l.includes('uecl')) return 85;
    if (l.includes('copa sudamericana') || l.includes('sudamericana')) return 82;

    if (l.includes('premier league') || l.includes('premier lig') || l.includes('epl')) return 80;
    if (l.includes('la liga') || l.includes('laliga') || l.includes('primera division')) return 78;
    if (l.includes('serie a') && !l.includes('serie a -') && !l.includes('brezilya') && !l.includes('brazil')) return 76;
    if (l.includes('bundesliga') && !l.includes('avusturya') && !l.includes('austria')) return 74;
    if (l.includes('ligue 1') || l.includes('lig 1')) return 72;

    if (l.includes('süper lig') || l.includes('super lig') || l.includes('trendyol süper lig')) return 70;
    if (l.includes('fa cup') || l.includes('copa del rey') || l.includes('dfb-pokal') || l.includes('coppa italia')) return 68;
    if (l.includes('championship')) return 62;
    if (l.includes('eredivisie') || l.includes('liga portugal') || l.includes('primeira liga')) return 60;
    if (l.includes('türkiye kupası') || l.includes('turkiye kupasi') || l.includes('ziraat türkiye kupası')) return 58;
    if (l.includes('brasileirao') || l.includes('serie a (brezilya)') || (l.includes('serie a') && (l.includes('brezilya') || l.includes('brazil')))) return 56;
    if (l.includes('super league (yunanistan)') || l.includes('yunanistan') || l.includes('saudi pro league') || l.includes('suudi')) return 54;
    if (l.includes('belçika') || l.includes('pro league') || l.includes('austrian bundesliga') || l.includes('avusturya')) return 52;
    if (l.includes('mls') || l.includes('major league soccer')) return 50;

    return 20;
  }

  function getLeagueKey(m) {
    return (m.league?.name || 'Diğer Ligler').trim();
  }

  function renderLeagueFilters() {
    const leagueStats = new Map(); // lg -> { total, live }
    for (const m of state.matches) {
      if (state.matchFilter === 'LIVE' && m.status !== 'LIVE' && m.status !== 'HT') continue;
      if (state.matchFilter === 'UPCOMING' && m.status !== 'SCHEDULED') continue;
      if (state.matchFilter === 'SIGNALS' && !isMatchValidForSignalNotif(m)) continue;

      const lg = getLeagueKey(m);
      if (!leagueStats.has(lg)) leagueStats.set(lg, { total: 0, live: 0 });
      const st = leagueStats.get(lg);
      st.total++;
      if (m.status === 'LIVE' || m.status === 'HT') st.live++;
    }

    const sortedLeagues = Array.from(leagueStats.entries())
      .sort((a, b) => {
        if (b[1].live !== a[1].live) return b[1].live - a[1].live;
        const pA = getLeaguePrestigeScore(a[0]);
        const pB = getLeaguePrestigeScore(b[0]);
        if (pA !== pB) return pB - pA;
        return b[1].total - a[1].total;
      });

    if (state.selectedLeague !== 'ALL' && !leagueStats.has(state.selectedLeague)) {
      state.selectedLeague = 'ALL';
    }

    const totalCount = Array.from(leagueStats.values()).reduce((a, b) => a + b.total, 0);
    const activeCount = state.selectedLeague === 'ALL'
      ? totalCount
      : (leagueStats.get(state.selectedLeague)?.total || 0);

    // 1. Update Custom Trigger Button
    const triggerLabel = document.getElementById('selectedLeagueLabel');
    const triggerCount = document.getElementById('selectedLeagueCount');
    if (triggerLabel) {
      triggerLabel.textContent = state.selectedLeague === 'ALL' ? 'Tüm Ligler' : state.selectedLeague;
    }
    if (triggerCount) {
      triggerCount.textContent = activeCount;
    }

    // 2. Render Popover List filtered by leagueSearchQuery
    const listEl = document.getElementById('leaguePickerList');
    if (listEl) {
      const lq = normalizeSearch(state.leagueSearchQuery);
      const filteredLeagues = sortedLeagues.filter(([lg]) => !lq || normalizeSearch(lg).includes(lq));

      const rows = [
        `
          <button type="button" class="lpp-item ${state.selectedLeague === 'ALL' ? 'active' : ''}" data-pick-league="ALL">
            <span class="lpp-item-name">${t('league_all', 'Tüm Ligler')}</span>
            <div class="lpp-item-badges">
              <span class="lpp-badge-total">${totalCount} ${t('count_matches', 'Maç')}</span>
            </div>
          </button>
        `,
        ...filteredLeagues.map(([lg, st]) => `
          <button type="button" class="lpp-item ${state.selectedLeague === lg ? 'active' : ''}" data-pick-league="${escapeHtml(lg)}">
            <span class="lpp-item-name">${escapeHtml(lg)}</span>
            <div class="lpp-item-badges">
              ${st.live > 0 ? `<span class="lpp-badge-live">${st.live} ${t('minute_live', 'Canlı')}</span>` : ''}
              <span class="lpp-badge-total">${st.total}</span>
            </div>
          </button>
        `)
      ];
      listEl.innerHTML = rows.join('');
    }

    // 3. Quick League Pills (top 7 leagues)
    const pillsEl = document.getElementById('leagueQuickPills');
    if (pillsEl) {
      const topLeagues = sortedLeagues.slice(0, 7);
      pillsEl.innerHTML = [
        `<button type="button" class="league-pill ${state.selectedLeague === 'ALL' ? 'active' : ''}" data-league="ALL">${t('filter_all', 'Tümü')}</button>`,
        ...topLeagues.map(([lg, st]) => {
          const shortName = lg.length > 18 ? lg.slice(0, 16) + '…' : lg;
          return `<button type="button" class="league-pill ${state.selectedLeague === lg ? 'active' : ''}" data-league="${escapeHtml(lg)}">${escapeHtml(shortName)} (${st.total})</button>`;
        })
      ].join('');
    }
  }

  function isJunkMatch(m) {
    if (!m) return true;
    const l = String(m.league?.name || '').toLowerCase();
    const h = String(m.home?.name || '').toLowerCase();
    const a = String(m.away?.name || '').toLowerCase();

    const junkKeywords = [
      'u16', 'u17', 'u18', 'u19', 'u20', 'u21', 'u22', 'u23',
      'reserve', 'reserves', 'reserva', 'reservas', 'rezerv',
      'youth', 'akademi', 'academy', 'amateur', 'amatör',
      'women', 'kadin', 'bayan', 'feminin', ' w ',
      'isthmian', 'southern league', 'northern premier', 'tercera',
      'carioca b', 'division 4', 'division 5', 'regional',
      'national league cup', 'international cup', 'challenge league',
      'premier south', 'premier central', 'qualifying', 'ist stage',
      'clausura - reserve'
    ];
    for (const kw of junkKeywords) {
      if (l.includes(kw) || h.includes(kw) || a.includes(kw)) return true;
    }
    if (h.endsWith(' 2') || a.endsWith(' 2') || h.endsWith(' b') || a.endsWith(' b') || h.endsWith(' ii') || a.endsWith(' ii')) {
      return true;
    }
    return false;
  }

  function getFilteredMatches() {
    const q = normalizeSearch(state.searchQuery);
    return state.matches.filter(m => {
      if (m.status === 'FT' || m.status === 'POSTPONED') return false;
      if (isJunkMatch(m)) return false;
      if (state.matchFilter === 'LIVE' && m.status !== 'LIVE' && m.status !== 'HT') return false;
      if (state.matchFilter === 'UPCOMING' && m.status !== 'SCHEDULED') return false;
      if (state.matchFilter === 'SIGNALS' && !isMatchValidForSignalNotif(m)) return false;

      if (state.selectedLeague !== 'ALL' && getLeagueKey(m) !== state.selectedLeague) return false;

      if (q) {
        const hay = normalizeSearch(`${m.home.name} ${m.away.name} ${m.league?.name || ''}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function updateGlobalCounts() {
    const activeMatches = state.matches.filter(m => !isJunkMatch(m) && m.status !== 'FT' && m.status !== 'POSTPONED');
    const liveCount = activeMatches.filter(m => m.status === 'LIVE' || m.status === 'HT').length;
    const upcomingCount = activeMatches.filter(m => m.status === 'SCHEDULED').length;
    const sigCount = activeMatches.filter(m => isMatchValidForSignalNotif(m)).length;
    const starCount = activeMatches.filter(m => state.starredIds.has(m.matchId)).length;

    const elAll = document.getElementById('countAll');
    const elLive = document.getElementById('countLive');
    const elUpcoming = document.getElementById('countUpcoming');
    const elSignals = document.getElementById('countSignals');

    if (elAll) elAll.textContent = activeMatches.length;
    if (elLive) elLive.textContent = liveCount;
    if (elUpcoming) elUpcoming.textContent = upcomingCount;
    if (elSignals) elSignals.textContent = sigCount;

    document.getElementById('navBadgeAll').textContent = liveCount || activeMatches.length;
    document.getElementById('navBadgeFav').textContent = starCount;
    document.getElementById('navBadgeSignals').textContent = state.signalStats.total || sigCount;
  }

  function buildMatchRowCardHtml(m) {
    const isSelected = m.matchId === state.selectedMatchId;
    const isStarred = state.starredIds.has(m.matchId);
    const quant = m.analysis?.quant || {};
    const hasValidSig = isMatchValidForSignalNotif(m);
    const isWatchlist = m.status === 'LIVE' && (m.minute || 0) < 75 && quant.signalStatus === 'WATCHLIST';
    const primarySig = quant.primarySignal;
    const isUpcoming = m.status === 'SCHEDULED';

    const statusClass = m.status === 'LIVE' ? 'live' : (m.status === 'HT' ? 'ht' : 'upcoming');
    const statusLabel = m.status === 'LIVE'
      ? `${m.minute || 1}'`
      : (m.status === 'HT' ? t('minute_ht', 'İY') : (m.kickoffTime || m.statusText || t('filter_scheduled', 'Yaklaşan')));

    const hShots = m.home.stats?.totalShots || 0;
    const aShots = m.away.stats?.totalShots || 0;
    const hSot = m.home.stats?.shotsOnTarget || 0;
    const aSot = m.away.stats?.shotsOnTarget || 0;

    const homeLogoSrc = resolveLogo(m.home.logo, m.home.name);
    const awayLogoSrc = resolveLogo(m.away.logo, m.away.name);

    let sigPillHtml = '';
    if (hasValidSig && primarySig) {
      sigPillHtml = `<span class="mi-signal-pill triggered">${t('tab_signals_header', 'SİNYAL').toUpperCase()}: ${escapeHtml(primarySig.selection || t('btn_active', 'Aktif'))} (%${primarySig.confidence || 75})</span>`;
    } else if (isWatchlist) {
      sigPillHtml = `<span class="mi-signal-pill watchlist">${t('spotlight_radar_badge', 'RADARDA')}</span>`;
    } else if (isUpcoming) {
      sigPillHtml = `<span class="mi-signal-pill prematch">${t('filter_scheduled', 'YAKLAŞAN').toUpperCase()}</span>`;
    }

    const footerLeftText = isUpcoming
      ? (m.odds?.ms1 ? `${Number(m.odds.ms1).toFixed(2)} • ${Number(m.odds.msX || 3.30).toFixed(2)} • ${Number(m.odds.ms2 || 2.80).toFixed(2)}` : t('spotlight_model_prematch', 'Maç Önü'))
      : `${t('metric_total_shots', 'Şut')}: ${hShots}(${hSot}) - ${aShots}(${aSot})`;

    const liveIndicatorHtml = m.status === 'LIVE'
      ? `<span class="mi-live-indicator"><span class="mi-pulse-dot"></span><span class="mi-live-min">${m.minute || 1}'</span></span>`
      : `<span class="mi-status ${statusClass}">${escapeHtml(statusLabel)}</span>`;

    const safeHomeName = m.home?.name || t('team_home', 'Ev Sahibi');
    const safeAwayName = m.away?.name || t('team_away', 'Deplasman');

    return `
      <div class="match-item ${isSelected ? 'selected' : ''} ${hasValidSig ? 'has-signal' : ''}" data-match-id="${escapeHtml(m.matchId)}">
        <div class="mi-top">
          <span class="mi-league">${escapeHtml(m.league?.name || t('league_other', 'Futbol Ligi'))}</span>
          <div class="mi-right-meta">
            ${liveIndicatorHtml}
            <button class="mi-star ${isStarred ? 'starred' : ''}" data-star-id="${escapeHtml(m.matchId)}" title="${isStarred ? t('action_star_remove', 'Favoriden Çıkar') : t('action_star_add', 'Favoriye Ekle')}">
              ${isStarred ? '★' : '☆'}
            </button>
          </div>
        </div>

        <div class="mi-teams">
          <div class="mi-team-row">
            <img class="team-logo-xs" src="${escapeHtml(homeLogoSrc)}" alt="" data-team-name="${escapeHtml(safeHomeName)}" data-backup-logo="${escapeHtml(m.home?.backupLogo || '')}" />
            <span class="mi-team-name">${escapeHtml(safeHomeName)}</span>
            <span class="mi-score ${isUpcoming ? 'upcoming-dash' : ''}">${isUpcoming ? '-' : (m.home?.score ?? 0)}</span>
          </div>
          <div class="mi-team-row">
            <img class="team-logo-xs" src="${escapeHtml(awayLogoSrc)}" alt="" data-team-name="${escapeHtml(safeAwayName)}" data-backup-logo="${escapeHtml(m.away?.backupLogo || '')}" />
            <span class="mi-team-name">${escapeHtml(safeAwayName)}</span>
            <span class="mi-score ${isUpcoming ? 'upcoming-dash' : ''}">${isUpcoming ? '-' : (m.away?.score ?? 0)}</span>
          </div>
        </div>

        <div class="mi-footer">
          <span class="mi-shots-tag">${escapeHtml(footerLeftText)}</span>
          ${sigPillHtml}
        </div>
      </div>
    `;
  }

  function renderGroupedLeagueList(matchesList) {
    const groups = new Map();
    for (const m of matchesList) {
      const lg = getLeagueKey(m);
      if (!groups.has(lg)) groups.set(lg, []);
      groups.get(lg).push(m);
    }

    const parts = [];
    for (const [leagueName, matchesInLeague] of groups.entries()) {
      parts.push(`
        <div class="league-group-header">
          <span class="league-group-title">${escapeHtml(leagueName || t('league_other', 'Diğer Ligler'))}</span>
          <span class="league-group-count">${matchesInLeague.length}</span>
        </div>
      `);
      for (const m of matchesInLeague) {
        parts.push(buildMatchRowCardHtml(m));
      }
    }
    return parts.join('');
  }

  function renderMatchList() {
    updateGlobalCounts();
    renderLeagueFilters();

    const container = document.getElementById('matchListContainer');
    const filtered = getFilteredMatches();

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card">
          <div class="es-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <h4>Eşleşen Karşılaşma Bulunamadı</h4>
          <p>Farklı bir lig veya filtre seçimi yapabilirsiniz.</p>
        </div>
      `;
      return;
    }

    if (!state.selectedMatchId || !state.matches.some(m => m.matchId === state.selectedMatchId)) {
      state.selectedMatchId = filtered[0].matchId;
    }

    const liveList = filtered.filter(m => m.status === 'LIVE' || m.status === 'HT');
    const upcomingList = filtered.filter(m => m.status === 'SCHEDULED');

    const htmlSections = [];

    if (liveList.length > 0) {
      if (state.matchFilter === 'ALL' && upcomingList.length > 0) {
        htmlSections.push(`
          <div class="match-section-divider live-sec">
            <span>Canlı Karşılaşmalar</span>
            <span class="msd-count">${liveList.length} Maç</span>
          </div>
        `);
      }
      htmlSections.push(renderGroupedLeagueList(liveList));
    }

    if (upcomingList.length > 0) {
      if (state.matchFilter === 'ALL') {
        htmlSections.push(`
          <div class="match-section-divider upcoming-sec">
            <span>Bugünün Yaklaşan Karşılaşmaları</span>
            <span class="msd-count">${upcomingList.length} Maç</span>
          </div>
        `);
      }
      // For upcoming matches, sort chronologically by kickoff time
      const sortedUpcoming = [...upcomingList].sort((a, b) => (a.startTimestamp || 0) - (b.startTimestamp || 0));
      htmlSections.push(sortedUpcoming.map(buildMatchRowCardHtml).join(''));
    }

    container.innerHTML = htmlSections.join('');
  }

  function computeTeamXg(stats = {}, oppStats = {}, providedXg = null) {
    if (typeof providedXg === 'number' && providedXg > 0.05) return providedXg.toFixed(2);
    if (stats.xg && stats.xg > 0.05) return Number(stats.xg).toFixed(2);
    const sot = stats.shotsOnTarget || 0;
    const box = stats.shotsInsideBox || Math.round(0.62 * sot + 0.35 * (stats.corners || 0));
    const bc = stats.bigChances || 0;
    const wood = stats.woodwork || 0;
    const cor = stats.corners || 0;
    const tot = stats.totalShots || 0;
    const outBox = Math.max(0, tot - box);
    const est = (0.135 * sot) + (0.125 * box) + (0.33 * bc) + (0.24 * wood) + (0.028 * outBox) + (0.02 * cor);
    return Number(Math.max(0.05, est)).toFixed(2);
  }

  // ================= CENTER COLUMN: MATCH STUDIO =================
  function renderCenterStudio() {
    const match = state.matches.find(m => m.matchId === state.selectedMatchId);
    if (!match) return;

    const hStats = match.home?.stats || {};
    const aStats = match.away?.stats || {};
    const flow = match.analysis?.flow || {};
    const quant = match.analysis?.quant || {};
    const players = match.analysis?.players || {};
    const isUpcoming = match.status === 'SCHEDULED';

    document.getElementById('heroLeague').textContent = match.league?.name || t('official_match', 'Futbol Karşılaşması');

    const stageEl = document.getElementById('heroMatchStage');
    if (stageEl) {
      if (isUpcoming) stageEl.textContent = t('filter_scheduled', 'YAKLAŞAN').toUpperCase();
      else if (match.status === 'HT') stageEl.textContent = t('minute_ht', 'DEVRE ARASI');
      else if ((match.minute || 0) >= 90) stageEl.textContent = t('minute_extra', 'UZATMALAR');
      else stageEl.textContent = `${t('minute_live', 'CANLI')} ${t('btn_matches', 'MAÇ').toUpperCase()}`;
    }

    const statusPill = document.getElementById('heroSignalStatusPill');
    const hasValidSig = isMatchValidForSignalNotif(match);
    if (hasValidSig) {
      statusPill.className = 'signal-status-pill triggered';
      statusPill.textContent = t('spotlight_active_badge', 'SİNYAL AKTİF');
    } else if (match.status === 'LIVE' && (match.minute || 0) < 75 && quant.signalStatus === 'WATCHLIST') {
      statusPill.className = 'signal-status-pill watchlist';
      statusPill.textContent = `${t('spotlight_radar_badge', 'RADARDA')} · ${t('tracking_flow', 'İZLENİYOR')}`;
    } else if (match.status === 'LIVE' && (match.minute || 0) >= 85) {
      statusPill.className = 'signal-status-pill';
      statusPill.textContent = (match.minute || 0) >= 90 ? t('extra_time', 'Uzatma Dakikaları') : t('late_minutes', 'Son Dakikalar (85\'+)');
    } else {
      statusPill.className = 'signal-status-pill';
      let badge = cleanBadgeText(quant.statusBadge || (isUpcoming ? (match.kickoffTime || t('filter_scheduled', 'Yaklaşan')) : t('tracking_flow', 'Gidişat İzleniyor')), t('tracking_flow', 'Gidişat İzleniyor'));
      if (match.status === 'LIVE' && badge.includes('Tamamlandı')) {
        badge = (match.minute || 0) >= 90 ? t('extra_time', 'Uzatma Dakikaları') : t('tracking_flow', 'Gidişat İzleniyor');
      }
      statusPill.textContent = badge;
    }

    const starBtn = document.getElementById('heroStarBtn');
    const isStarred = state.starredIds.has(match.matchId);
    starBtn.className = `hero-star-btn ${isStarred ? 'starred' : ''}`;
    starBtn.textContent = isStarred ? t('action_star_remove', '★ Favoride') : t('action_star_add', '☆ Favoriye Ekle');
    starBtn.onclick = () => toggleStarMatch(match.matchId);

    setImgWithFallback(document.getElementById('heroHomeLogo'), match.home?.logo, match.home?.name || t('team_home', 'Ev Sahibi'), match.home?.backupLogo);
    setImgWithFallback(document.getElementById('heroAwayLogo'), match.away?.logo, match.away?.name || t('team_away', 'Deplasman'), match.away?.backupLogo);

    document.getElementById('heroHomeName').textContent = match.home?.name || t('team_home', 'Ev Sahibi');
    document.getElementById('heroAwayName').textContent = match.away?.name || t('team_away', 'Deplasman');
    document.getElementById('heroHomeScore').textContent = isUpcoming ? '-' : (match.home?.score ?? 0);
    document.getElementById('heroAwayScore').textContent = isUpcoming ? '-' : (match.away?.score ?? 0);

    const minBadgeEl = document.getElementById('heroMinuteBadge');
    if (isUpcoming) {
      minBadgeEl.className = 'minute-badge upcoming';
      minBadgeEl.innerHTML = `<span class="min-pulse-dot"></span><span class="min-text">${match.kickoffTime || match.statusText || t('filter_scheduled', 'Yaklaşan')}</span>`;
    } else if (match.status === 'HT') {
      minBadgeEl.className = 'minute-badge ht';
      minBadgeEl.innerHTML = `<span class="min-pulse-dot"></span><span class="min-text">${t('minute_ht', 'Devre Arası')}</span>`;
    } else if (match.status === 'FT') {
      minBadgeEl.className = 'minute-badge ft';
      minBadgeEl.innerHTML = `<span class="min-pulse-dot"></span><span class="min-text">${t('minute_ft', 'Maç Sonu')}</span>`;
    } else {
      minBadgeEl.className = 'minute-badge live';
      const minText = (match.minute || 0) >= 90 ? `${match.minute}' ${t('minute_extra', 'UZATMA')}` : `${match.minute || 1}' ${t('minute_live', 'CANLI')}`;
      minBadgeEl.innerHTML = `<span class="min-pulse-dot"></span><span class="min-text">${minText}</span>`;
    }

    document.getElementById('heroTempoBadge').textContent = isUpcoming ? t('prematch_expectation', 'Maç Önü Beklentisi') : (flow.tempoLabel ? t('tempo_' + (flow.tempoKey || 'balanced'), flow.tempoLabel) : t('tempo_balanced', 'Dengeli Tempo'));

    // Synthetic or Live xG calculation & presentation
    const hXg = computeTeamXg(hStats, aStats, flow.xgHome);
    const aXg = computeTeamXg(aStats, hStats, flow.xgAway);
    const hXgEl = document.getElementById('heroHomeXg');
    const aXgEl = document.getElementById('heroAwayXg');
    if (hXgEl) hXgEl.textContent = `xG ${hXg}`;
    if (aXgEl) aXgEl.textContent = `xG ${aXg}`;

    const hRc = Math.max(match.home?.redCards || 0, hStats.redCards || 0);
    const aRc = Math.max(match.away?.redCards || 0, aStats.redCards || 0);
    const hRcEl = document.getElementById('heroHomeRc');
    const aRcEl = document.getElementById('heroAwayRc');
    if (hRcEl) {
      hRcEl.classList.toggle('hidden', hRc === 0);
      hRcEl.innerHTML = `<span class="rc-box" style="display:inline-block;width:8px;height:11px;background:var(--rose);border-radius:2px;margin-right:4px;vertical-align:middle"></span>${hRc} ${t('red_cards_tag', 'Kırmızı')}`;
    }
    if (aRcEl) {
      aRcEl.classList.toggle('hidden', aRc === 0);
      aRcEl.innerHTML = `<span class="rc-box" style="display:inline-block;width:8px;height:11px;background:var(--rose);border-radius:2px;margin-right:4px;vertical-align:middle"></span>${aRc} ${t('red_cards_tag', 'Kırmızı')}`;
    }

    // Flow Reader & Pressure Momentum Radar
    document.getElementById('flowArchetypeLabel').textContent = isUpcoming
      ? `${t('prematch_analysis', 'Yaklaşan Maç Önü Analizi')} (${match.kickoffTime || t('today', 'Bugün')})`
      : cleanBadgeText(flow.archetypeLabel || t('tracking_flow', 'Maç Gidişatı İzleniyor'), t('tracking_flow', 'Maç Gidişatı İzleniyor'));
    document.getElementById('flowNarrativeText').textContent = isUpcoming
      ? (quant.signalStatusReason || t('spotlight_prematch_reason', 'Maç henüz başlamadı.'))
      : (flow.narrative || t('radar_default_narrative', 'Maç içi şut, korner ve tempo değişimleri gerçek zamanlı okunuyor.'));

    const igpH = isUpcoming ? Math.round((quant.lambdas?.priorH || 1.4) * 35) : (flow.igpHome || 0);
    const igpA = isUpcoming ? Math.round((quant.lambdas?.priorA || 1.1) * 35) : (flow.igpAway || 0);
    const igpSum = Math.max(1, igpH + igpA);
    const pctH = igpH === 0 && igpA === 0 ? 50 : Math.round((igpH / igpSum) * 100);
    document.getElementById('igpHomeLabel').textContent = `${t('home_pressure', 'Ev Baskısı')} %${pctH}`;
    document.getElementById('igpAwayLabel').textContent = `${t('away_pressure', 'Dep Baskısı')} %${100 - pctH}`;
    document.getElementById('igpHomeBar').style.width = `${pctH}%`;
    document.getElementById('igpAwayBar').style.width = `${100 - pctH}%`;

    const evGrid = document.getElementById('flowEvidenceGrid');
    if (evGrid) {
      const factors = Array.isArray(flow.evidenceFactors) ? flow.evidenceFactors : [];
      if (isUpcoming || factors.length === 0) {
        evGrid.innerHTML = '';
      } else {
        evGrid.innerHTML = factors.map(f => `
          <div class="ev-factor-card tone-${escapeHtml(f.tone || 'blue')}">
            <div class="evf-head">
              <span class="evf-title">${escapeHtml(f.title)}</span>
              <span class="evf-badge">${escapeHtml(f.badge)}</span>
            </div>
            <div class="evf-summary">${escapeHtml(f.summary)}</div>
          </div>
        `).join('');
      }
    }

    renderSelectiveSignalSpotlight(match, flow, quant);
    renderMatchStatsMatrix(match, hStats, aStats, flow);
    renderMarketsGrid(match, quant);
    renderTimelineAndPlayers(match, players);
  }

  function renderSelectiveSignalSpotlight(match, flow, quant) {
    const box = document.getElementById('selectiveSignalBox');
    const overviewBox = document.getElementById('overviewSignalBox');
    const hasValidSig = isMatchValidForSignalNotif(match);
    // Also check if this match has a tracked signal in signalLedger (e.g. already WON!)
    const ledgerEntry = state.signalLedger.find(r => r.matchId === match.matchId);

    let html = '';
    if (ledgerEntry && ledgerEntry.settlementStatus === 'WON') {
      const wonSelection = ledgerEntry.selection || t('valuable_selection', 'Değerli Seçim');
      html = `
        <div class="signal-spotlight-card">
          <div class="ss-top">
            <div class="ss-pick-group">
              <span class="ss-badge">${t('spotlight_won_badge', 'HEDEF TUTTU')}</span>
              <span class="ss-pick-name">${escapeHtml(wonSelection)}</span>
              <span class="ss-market-label">(${t('trigger_minute_label', 'Tetikleme: Dk')} ${ledgerEntry.triggerMinute || 1}' [${ledgerEntry.triggerScoreHome ?? 0}-${ledgerEntry.triggerScoreAway ?? 0}] → ${match.home?.score ?? 0}-${match.away?.score ?? 0})</span>
            </div>
            <div class="ss-metrics">
              <span class="sig-outcome-badge won">${cleanBadgeText(ledgerEntry.settlementBadge, t('score_won', 'TUTTU'))}</span>
              <span class="ss-metric-pill">${t('odds', 'Oran')}: <b>@${ledgerEntry.odds || '1.80'}</b></span>
            </div>
          </div>
          <div class="ss-reason">${escapeHtml(ledgerEntry.settlementDetail || ledgerEntry.narrative || t('spotlight_default_reason', 'Sinyal hedefine başarıyla ulaştı.'))}</div>
        </div>
      `;
    } else if (hasValidSig && quant.primarySignal) {
      const p = quant.primarySignal;
      const c = quant.complementarySignal;
      html = `
        <div class="signal-spotlight-card">
          <div class="ss-top">
            <div class="ss-pick-group">
              <span class="ss-badge">${t('spotlight_active_badge', 'SİNYAL AKTİF')}</span>
              <span class="ss-pick-name">${escapeHtml(p.selection || t('valuable_selection', 'Değerli Seçim'))}</span>
              <span class="ss-market-label">(${escapeHtml(p.marketTitle || t('tab_markets', 'Market'))})</span>
            </div>
            <div class="ss-metrics">
              <span class="ss-metric-pill">${t('confidence', 'Güven')}: <b style="color:var(--emerald-bright)">%${p.confidence || 75}</b></span>
              <span class="ss-metric-pill">${t('odds', 'Oran')}: <b>@${p.marketOdds || p.fairOdds || '1.80'}</b></span>
              ${c ? `<span class="ss-metric-pill">${t('tab_both_header', 'Ek')}: <b>${escapeHtml(c.selection)} (%${c.confidence})</b></span>` : ''}
            </div>
          </div>
          <div class="ss-reason">${escapeHtml(p.reasoning || '')}</div>
        </div>
      `;
    } else if (match.status === 'LIVE' && (match.minute || 0) < 75 && quant.signalStatus === 'WATCHLIST' && quant.primarySignal) {
      const w = quant.primarySignal;
      html = `
        <div class="signal-spotlight-card watchlist">
          <div class="ss-top">
            <div class="ss-pick-group">
              <span class="ss-badge" style="background:var(--amber-soft);color:var(--amber)">${t('spotlight_radar_badge', 'RADARDA')} ${t('tracking_flow', 'İZLENİYOR')}</span>
              <span class="ss-pick-name">${escapeHtml(w.selection || t('valuable_selection', 'Değerli Seçim'))}</span>
              <span class="ss-market-label">(${t('confidence', 'Güven')}: %${w.confidence || 65})</span>
            </div>
          </div>
          <div class="ss-reason">${escapeHtml(quant.signalStatusReason || t('spotlight_default_reason', 'Saha içi baskı artışı takip ediliyor; sinyal tetiklemek için şut kalitesi ve oran eşiği bekleniyor.'))}</div>
        </div>
      `;
    } else {
      const isScheduled = match.status === 'SCHEDULED';
      html = `
        <div class="signal-spotlight-card neutral">
          <div class="ss-top">
            <div class="ss-pick-group">
              <span class="ss-badge" style="background:rgba(255,255,255,0.06);color:var(--text-secondary);border:1px solid var(--border-subtle)">${t('spotlight_radar_badge', 'RADAR AKTİF')}</span>
              <span class="ss-pick-name" style="font-size:14.5px;letter-spacing:-0.01em">${isScheduled ? t('spotlight_radar_title_prematch', 'Yaklaşan Karşılaşma Analizi') : t('spotlight_radar_title', 'Gidişat İzleniyor')}</span>
              <span class="ss-market-label">${t('spotlight_radar_data', 'Canlı Veri Radarı')}</span>
            </div>
            <div class="ss-metrics">
              <span class="ss-metric-pill">Model: <b>${isScheduled ? t('spotlight_model_prematch', 'Maç Önü') : t('spotlight_model_scanning', 'Tarama Sürüyor')}</b></span>
            </div>
          </div>
          <div class="ss-reason">${escapeHtml(quant.signalStatusReason || (isScheduled ? t('spotlight_prematch_reason', 'Karşılaşma henüz başlamadı.') : t('spotlight_default_reason', 'Kantitatif analiz motoru saha baskısını, şut kalitesini ve Poisson beklentilerini anlık ölçümlüyor.')))}</div>
          <div class="radar-live-scan-bar">
            <span class="rls-pulse"></span>
            <span>${isScheduled ? t('spotlight_scanning_sub_prematch', 'Karşılaşma başlama saati bekleniyor') : t('spotlight_scanning_sub', 'Canlı saha metrikleri ve değer eşikleri dinleniyor')}</span>
          </div>
        </div>
      `;
    }

    if (box) box.innerHTML = html;
    if (overviewBox) overviewBox.innerHTML = html;
  }

  // ================= UNIFIED FOTMOB & SOFASCORE MATCH STATISTICS MATRIX =================
  function renderMatchStatsMatrix(match, hStats, aStats, flow) {
    const mhLogo = document.getElementById('matrixHomeLogo');
    const maLogo = document.getElementById('matrixAwayLogo');
    if (mhLogo) setImgWithFallback(mhLogo, match.home?.logo, match.home?.name || t('team_home', 'Ev Sahibi'), match.home?.backupLogo);
    if (maLogo) setImgWithFallback(maLogo, match.away?.logo, match.away?.name || t('team_away', 'Deplasman'), match.away?.backupLogo);

    const mHn = document.getElementById('matrixHomeName');
    const mAn = document.getElementById('matrixAwayName');
    if (mHn) mHn.textContent = match.home?.name || t('team_home', 'Ev Sahibi');
    if (mAn) mAn.textContent = match.away?.name || t('team_away', 'Deplasman');

    const mtsBadge = document.querySelector('.mts-badge');
    if (mtsBadge) mtsBadge.textContent = t('stats_matrix_title', 'RESMİ İSTATİSTİK MATRİSİ');

    const hXg = Number(computeTeamXg(hStats, aStats, flow?.xgHome));
    const aXg = Number(computeTeamXg(aStats, hStats, flow?.xgAway));

    const hTot = hStats.totalShots || 0;
    const aTot = aStats.totalShots || 0;
    const hSot = hStats.shotsOnTarget || 0;
    const aSot = aStats.shotsOnTarget || 0;
    const hBox = hStats.shotsInsideBox || Math.round(0.62 * hSot + 0.35 * (hStats.corners || 0));
    const aBox = aStats.shotsInsideBox || Math.round(0.62 * aSot + 0.35 * (aStats.corners || 0));
    const hBc = hStats.bigChances || 0;
    const aBc = aStats.bigChances || 0;
    const hCorn = hStats.corners || 0;
    const aCorn = aStats.corners || 0;
    const hDa = hStats.dangerousAttacks || Math.round(Math.max(4, hTot * 3.4));
    const aDa = aStats.dangerousAttacks || Math.round(Math.max(4, aTot * 3.4));
    const hFoul = hStats.fouls || 0;
    const aFoul = aStats.fouls || 0;
    const hYc = hStats.yellowCards || 0;
    const aYc = aStats.yellowCards || 0;
    const hRc = Math.max(match.home?.redCards || 0, hStats.redCards || 0);
    const aRc = Math.max(match.away?.redCards || 0, aStats.redCards || 0);
    const hPoss = hStats.possession || 50;
    const aPoss = aStats.possession || (100 - hPoss);

    const fullMetrics = [
      { key: 'xg', label: t('metric_xg', 'Beklenen Gol (xG)'), hVal: hXg.toFixed(2), aVal: aXg.toFixed(2), rawH: hXg, rawA: aXg },
      { key: 'poss', label: `${t('metric_possession', 'Topla Oynama')} (%)`, hVal: `%${hPoss}`, aVal: `%${aPoss}`, rawH: hPoss, rawA: aPoss },
      { key: 'shots', label: t('metric_total_shots', 'Toplam Şut'), hVal: hTot, aVal: aTot, rawH: hTot, rawA: aTot },
      { key: 'sot', label: t('metric_shots_on_target', 'İsabetli Şut'), hVal: hSot, aVal: aSot, rawH: hSot, rawA: aSot },
      { key: 'box', label: t('metric_shots_inside_box', 'Ceza Sahası İçi Şut'), hVal: hBox, aVal: aBox, rawH: hBox, rawA: aBox },
      { key: 'bc', label: t('metric_big_chances', 'Büyük Fırsat (Net Pozisyon)'), hVal: hBc, aVal: aBc, rawH: hBc, rawA: aBc },
      { key: 'corners', label: t('metric_corners', 'Korner'), hVal: hCorn, aVal: aCorn, rawH: hCorn, rawA: aCorn },
      { key: 'da', label: t('metric_dangerous_attacks', 'Tehlikeli Atak'), hVal: hDa, aVal: aDa, rawH: hDa, rawA: aDa },
      { key: 'fouls', label: t('metric_fouls', 'Faul Sayısı'), hVal: hFoul, aVal: aFoul, rawH: hFoul, rawA: aFoul },
      {
        key: 'cards',
        label: `${t('metric_yellow_cards', 'Sarı')} / ${t('metric_red_cards', 'Kırmızı')} Kart`,
        hVal: hRc > 0 ? `${hYc} ${t('metric_yellow_cards', 'Sarı')} / ${hRc} ${t('metric_red_cards', 'Kırmızı')}` : `${hYc} ${t('metric_yellow_cards', 'Sarı')}`,
        aVal: aRc > 0 ? `${aYc} ${t('metric_yellow_cards', 'Sarı')} / ${aRc} ${t('metric_red_cards', 'Kırmızı')}` : `${aYc} ${t('metric_yellow_cards', 'Sarı')}`,
        rawH: hYc * 10 + hRc * 25,
        rawA: aYc * 10 + aRc * 25
      }
    ];

    const generateRowsHtml = (metricsList) => {
      return metricsList.map(m => {
        const sum = Math.max(0.01, (m.rawH || 0) + (m.rawA || 0));
        const hPct = m.rawH === 0 && m.rawA === 0 ? 50 : Math.round(((m.rawH || 0) / sum) * 100);
        const aPct = 100 - hPct;
        const isHLead = (m.rawH || 0) > (m.rawA || 0);
        const isALead = (m.rawA || 0) > (m.rawH || 0);
        return `
          <div class="stat-matrix-row">
            <span class="smr-val home ${isHLead ? 'lead' : ''}">${escapeHtml(m.hVal)}</span>
            <div class="smr-bar-track home">
              <div class="smr-bar home" style="width: ${hPct}%"></div>
            </div>
            <span class="smr-metric-name">${escapeHtml(m.label)}</span>
            <div class="smr-bar-track away">
              <div class="smr-bar away" style="width: ${aPct}%"></div>
            </div>
            <span class="smr-val away ${isALead ? 'lead' : ''}">${escapeHtml(m.aVal)}</span>
          </div>
        `;
      }).join('');
    };

    // 1. Full 10 Metrics for Stats Tab
    const rowsContainer = document.getElementById('statsMatrixRows');
    if (rowsContainer) {
      rowsContainer.innerHTML = generateRowsHtml(fullMetrics);
    }

    // 2. Top 4 Essential Metrics for Overview Bento Card
    const overviewRowsContainer = document.getElementById('overviewStatsRows');
    if (overviewRowsContainer) {
      const top4 = fullMetrics.filter(m => ['xg', 'poss', 'shots', 'corners'].includes(m.key));
      overviewRowsContainer.innerHTML = generateRowsHtml(top4);
    }
  }

  // Backwards compatibility alias
  function renderShotBreakdown(match, hStats, aStats) {
    const flow = match.analysis?.flow || {};
    renderMatchStatsMatrix(match, hStats, aStats, flow);
  }

  // ================= 6 CORE BETTING MARKETS (BENTO BUTTONS) =================
  function renderMarketsGrid(match, quant) {
    const lambdaBadgeEl = document.getElementById('lambdaBadge');
    if (lambdaBadgeEl) lambdaBadgeEl.classList.add('hidden');

    const container = document.getElementById('marketsGridContainer');
    const overviewContainer = document.getElementById('overviewMarketsGrid');
    const markets = quant.markets || {};
    const orderedKeys = ['MS', 'BTTS', 'OU', 'HT_BTTS', 'HT_OU', 'NEXT_GOAL'];
    const overviewKeys = ['MS', 'OU', 'NEXT_GOAL'];
    const hasValidSig = isMatchValidForSignalNotif(match);

    const renderCardHtml = (key, isCompact = false) => {
      const m = markets[key];
      if (!m) return '';
      const isSelectedMarket = hasValidSig && (quant.primarySignal?.marketKey === key || quant.complementarySignal?.marketKey === key);
      const isSettledWon = m.marketStatus === 'SETTLED_WON';
      const isPreMatch = m.marketStatus === 'PRE_MATCH';
      const isLocked = m.closed && !isSettledWon;

      let tagClass = '';
      let tagText = `${t('confidence', 'Güven')} %${m.confidence || 70}`;
      if (isSettledWon) {
        tagClass = 'won';
        tagText = cleanBadgeText(m.statusLabel, t('settled_label', 'Gerçekleşti'));
      } else if (isLocked) {
        tagClass = '';
        tagText = cleanBadgeText(m.statusLabel, t('locked_label', 'Kilitli'));
      } else if (isSelectedMarket) {
        tagClass = 'hot';
        tagText = t('value_signal', 'Değerli Sinyal');
      } else if (isPreMatch) {
        tagClass = 'prematch';
        tagText = t('spotlight_model_prematch', 'Maç Önü');
      }

      return `
        <div class="market-card ${isCompact ? 'compact' : ''} ${isSelectedMarket ? 'triggered' : ''} ${isSettledWon ? 'settled-won' : ''} ${isLocked ? 'locked-market' : ''}">
          <div class="mc-head">
            <span class="mc-title">${escapeHtml(m.marketTitle)}</span>
            <span class="mc-tag ${tagClass}">${escapeHtml(tagText)}</span>
          </div>
          <div class="mc-options">
            ${(m.allOptions || []).map(opt => {
              const isBest = !m.closed && (isSelectedMarket || isPreMatch) && (m.selection && m.selection.startsWith(opt.selection));
              const probVal = Math.max(1, Math.min(99, Math.round((opt.prob || 0.35) * 100)));
              
              // Ensure odds is ALWAYS calculated and never blank / '-'
              let numericOdds = Number(opt.odds);
              if (!numericOdds || numericOdds <= 1.01 || isNaN(numericOdds)) {
                const fairOdds = opt.prob > 0 ? (1 / (opt.prob * 1.05)) : 2.0;
                numericOdds = Math.max(1.02, Math.min(65.0, fairOdds));
              }
              const displayOdds = numericOdds.toFixed(2);

              // Value calculation: edge %
              const isUnlikely = probVal <= 4;
              const edgePct = opt.edgePct !== undefined
                ? Number(opt.edgePct)
                : Number((((opt.prob || (1 / numericOdds)) * numericOdds - 1) * 100).toFixed(1));
              const showValue = !m.closed && !isUnlikely && edgePct >= 3.0;

              return `
                <div class="mc-bento-opt ${isBest ? 'best' : ''} ${m.closed ? 'opt-locked' : ''} ${isUnlikely ? 'opt-unlikely' : ''}" title="${escapeHtml(opt.selection)}: %${probVal} ${t('probability', 'Olasılık')} @${displayOdds}">
                  <div class="mc-opt-left">
                    <span class="mc-opt-name">${escapeHtml(opt.selection)}</span>
                    ${showValue ? `<span class="mc-value-tag">+${edgePct.toFixed(1)}% ${t('value_edge', 'Değer')}</span>` : ''}
                  </div>
                  <div class="mc-opt-right">
                    <span class="mc-prob-pill">${isUnlikely ? '&lt;%5' : `%${probVal}`}</span>
                    <span class="mc-odds-chip">@${displayOdds}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    };

    if (container) {
      container.innerHTML = orderedKeys.map(k => renderCardHtml(k, false)).join('');
    }
    if (overviewContainer) {
      overviewContainer.innerHTML = overviewKeys.map(k => renderCardHtml(k, true)).join('');
    }
  }

  function renderTimelineAndPlayers(match, players = {}) {
    const tlBox = document.getElementById('matchTimelineList');
    const incs = match.incidents || [];

    if (incs.length === 0) {
      tlBox.innerHTML = `<div class="empty-box small">${match.status === 'SCHEDULED' ? t('empty_incidents_scheduled', 'Maç henüz başlamadı.') : t('empty_incidents', 'Bu maçta henüz gol, kart veya VAR olayı kaydedilmedi.')}</div>`;
    } else {
      tlBox.innerHTML = incs.slice(0, 12).map(inc => {
        const badgeType = inc.eventType === 'GOAL' ? 'goal'
          : inc.eventType === 'GOAL_DISALLOWED' ? 'disallowed'
          : inc.eventType === 'RED_CARD' ? 'red-card'
          : inc.eventType === 'YELLOW_CARD' ? 'yellow-card' : 'other';
        const eventLabel = inc.eventType === 'GOAL' ? t('pill_goal', 'GOL').toUpperCase()
          : inc.eventType === 'GOAL_DISALLOWED' ? t('pill_disallowed', 'İPTAL GOL').toUpperCase()
          : inc.eventType === 'RED_CARD' ? t('red_cards_tag', 'KIRMIZI').toUpperCase()
          : inc.eventType === 'YELLOW_CARD' ? t('metric_yellow_cards', 'SARI').toUpperCase() : t('pill_card', 'OLAY').toUpperCase();
        const teamName = getSafeTeamName(inc.team, match, t('team_home', 'Takım'));
        const defaultEventDesc = inc.eventType === 'GOAL' ? t('pill_goal', 'Gol')
          : inc.eventType === 'GOAL_DISALLOWED' ? t('pill_disallowed', 'İptal Edilen Gol')
          : inc.eventType === 'RED_CARD' ? `${t('red_cards_tag', 'Kırmızı')} ${t('pill_card', 'Kart')}`
          : inc.eventType === 'YELLOW_CARD' ? `${t('metric_yellow_cards', 'Sarı')} ${t('pill_card', 'Kart')}` : t('pill_card', 'Olay');
        const pName = getSafePlayerName(inc, '');
        const assistName = getSafeAssistName(inc);
        const titleText = pName ? pName : `${teamName} ${defaultEventDesc}`;
        const subText = pName ? `(${teamName})${assistName ? ` • ${t('pill_assist', 'Asist')}: ${assistName}` : ''}` : (assistName ? `${t('pill_assist', 'Asist')}: ${assistName}` : (inc.reason || ''));

        return `
          <div class="tl-row">
            <span class="tl-min">${inc.minute || 1}'</span>
            <span class="tl-glyph ${badgeType}">${eventLabel}</span>
            <div class="tl-desc">
              <strong>${escapeHtml(titleText)}</strong>
              ${subText ? `<span>${escapeHtml(subText)}</span>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    const pBox = document.getElementById('playersImpactBox');
    const items = [];
    if (players && players.threatLeader) {
      const pName = getSafePlayerName(players.threatLeader, 'Kilit Hücumcu');
      const tName = getSafeTeamName(players.threatLeader.team, match, 'Takım');
      items.push({
        role: t('role_threat_leader', 'Hücum Lideri'),
        name: `${pName} (${tName})`,
        metric: `${players.threatLeader.shotsTotal || 0} ${t('metric_total_shots', 'şut')}`
      });
    }
    if (players && players.playmakerLeader) {
      const pName = getSafePlayerName(players.playmakerLeader, 'Oyun Kurucu');
      const tName = getSafeTeamName(players.playmakerLeader.team, match, 'Takım');
      items.push({
        role: t('role_playmaker', 'Oyun Kurucu & Asist'),
        name: `${pName} (${tName})`,
        metric: `${players.playmakerLeader.keyPasses || players.playmakerLeader.assists || 0} pas`
      });
    }
    const hDvs = players?.teamDefVulnHome || players?.homeDvs || 0;
    const aDvs = players?.teamDefVulnAway || players?.awayDvs || 0;
    const exposedGap = Math.abs(hDvs - aDvs);
    const homeTeam = match.home?.name || t('team_home', 'Ev Sahibi');
    const awayTeam = match.away?.name || t('team_away', 'Deplasman');
    items.push({
      role: t('role_defensive_balance', 'Savunma Dengesi'),
      name: exposedGap < 8
        ? t('def_balanced', 'İki takım savunması dengeli')
        : `${hDvs > aDvs ? homeTeam : awayTeam} ${t('def_under_pressure', 'savunması baskı altında')}`,
      metric: exposedGap < 8 ? t('badge_balanced', 'Dengeli') : (exposedGap >= 20 ? t('risk_high', 'Yüksek Risk') : t('risk_medium', 'Orta Risk'))
    });

    pBox.innerHTML = items.map(it => `
      <div class="player-row">
        <div>
          <div class="pr-role">${escapeHtml(it.role)}</div>
          <div class="pr-name">${escapeHtml(it.name)}</div>
        </div>
        <span class="pr-score">${escapeHtml(it.metric)}</span>
      </div>
    `).join('');
  }

  // ================= VIEW 2 & VIEW 3: FAVORITES & SIGNAL RADAR BENTO GRIDS =================
  function buildBentoMatchCardHtml(m) {
    const isStarred = state.starredIds.has(m.matchId);
    const homeName = m.home?.name || t('team_home', 'Ev Sahibi');
    const awayName = m.away?.name || t('team_away', 'Deplasman');
    const hLogo = resolveLogo(m.home?.logo, homeName);
    const aLogo = resolveLogo(m.away?.logo, awayName);
    const hStats = m.home?.stats || {};
    const aStats = m.away?.stats || {};
    const hOff = (hStats.shotsOffTarget || 0) + (hStats.blockedShots || 0);
    const aOff = (aStats.shotsOffTarget || 0) + (aStats.blockedShots || 0);
    const flow = m.analysis?.flow || {};
    const quant = m.analysis?.quant || {};
    const hasValidSig = isMatchValidForSignalNotif(m);
    const primarySig = quant.primarySignal;
    const isUpcoming = m.status === 'SCHEDULED';

    const statusLabel = m.status === 'LIVE'
      ? `${m.minute || 1}' ${t('minute_live', 'CANLI')}`
      : (m.status === 'HT' ? t('minute_ht', 'Devre Arası') : `${m.kickoffTime || m.statusText || t('filter_scheduled', 'Yaklaşan')}`);

    return `
      <div class="bento-match-card ${hasValidSig ? 'has-signal' : ''}" data-match-id="${escapeHtml(m.matchId)}">
        <div class="bmc-top">
          <span>${escapeHtml(m.league?.name || t('league_other', 'Futbol Ligi'))}</span>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="color:${m.status === 'LIVE' ? 'var(--rose)' : 'var(--blue)'};font-weight:700">${escapeHtml(statusLabel)}</span>
            <button class="mi-star ${isStarred ? 'starred' : ''}" data-star-id="${escapeHtml(m.matchId)}" title="${isStarred ? t('action_star_remove', 'Favoriden Çıkar') : t('action_star_add', 'Favoriye Ekle')}">
              ${isStarred ? '★' : '☆'}
            </button>
          </div>
        </div>

        <div class="bmc-teams">
          <div class="bmc-team home">
            <img src="${escapeHtml(hLogo)}" alt="" data-team-name="${escapeHtml(homeName)}" data-backup-logo="${escapeHtml(m.home?.backupLogo || '')}" />
            <strong>${escapeHtml(homeName)}</strong>
          </div>
          <div class="bmc-score-box">${isUpcoming ? 'vs' : `${m.home?.score ?? 0} : ${m.away?.score ?? 0}`}</div>
          <div class="bmc-team away">
            <strong>${escapeHtml(awayName)}</strong>
            <img src="${escapeHtml(aLogo)}" alt="" data-team-name="${escapeHtml(awayName)}" data-backup-logo="${escapeHtml(m.away?.backupLogo || '')}" />
          </div>
        </div>

        <div class="bmc-shots-strip">
          <div class="bmc-shot-col">
            <span>${t('side_home', 'EV SAHİBİ')} ${t('metric_total_shots', 'ŞUTLAR')}</span>
            <b>${hStats.totalShots || 0} ${t('total_label', 'Toplam')}</b> (${hStats.shotsOnTarget || 0} ${t('sot_short', 'İsb')} / ${hOff} ${t('soff_short', 'İsz')})
          </div>
          <div class="bmc-shot-col" style="text-align:right">
            <span>${t('side_away', 'DEPLASMAN')} ${t('metric_total_shots', 'ŞUTLAR')}</span>
            <b>${aStats.totalShots || 0} ${t('total_label', 'Toplam')}</b> (${aStats.shotsOnTarget || 0} ${t('sot_short', 'İsb')} / ${aOff} ${t('soff_short', 'İsz')})
          </div>
        </div>

        ${hasValidSig && primarySig ? `
          <div class="nc-signal-box" style="margin-bottom:0">
            <div>
              <span class="nc-sig-tag">${escapeHtml(cleanBadgeText(flow.archetypeLabel, t('signal_active_tag', 'CANLI SİNYAL')))}</span>
              <h4 class="nc-sig-market">${escapeHtml(primarySig.selection || t('valuable_selection', 'Değerli Seçim'))}</h4>
            </div>
            <div class="nc-sig-metrics">
              <span class="nc-odd-badge">@${primarySig.marketOdds || primarySig.fairOdds || '1.80'}</span>
              <span class="nc-conf-badge">%${primarySig.confidence || 75} ${t('confidence', 'Güven')}</span>
            </div>
          </div>
        ` : `
          <div style="font-size:11.5px;color:var(--text-secondary)">
            <strong>${escapeHtml(isUpcoming ? t('prematch_expectation', 'Maç Önü Beklentisi') : (cleanBadgeText(flow.archetypeLabel, t('tracking_flow', 'Gidişat'))))}:</strong>
            ${escapeHtml(isUpcoming ? (quant.signalStatusReason || t('spotlight_scanning_sub_prematch', 'Başlama saati bekleniyor.')) : (flow.narrative || t('tracking_flow', 'Maç takip ediliyor.')))}
          </div>
        `}
      </div>
    `;
  }

  function buildTrackedSignalLedgerCardHtml(item) {
    const hName = item.homeName || t('team_home', 'Ev Sahibi');
    const aName = item.awayName || t('team_away', 'Deplasman');
    const hLogo = resolveLogo(item.homeLogo, hName);
    const aLogo = resolveLogo(item.awayLogo, aName);
    const st = item.settlementStatus || 'PENDING';
    const cls = st === 'WON' ? 'sig-won' : (st === 'LOST' ? 'sig-lost' : 'sig-pending');
    const badgeCls = st === 'WON' ? 'won' : (st === 'LOST' ? 'lost' : 'pending');
    const badgeLabel = st === 'WON' ? t('score_won', 'TUTTU') : (st === 'LOST' ? t('score_lost', 'TUTMADI') : t('score_in_play', 'AKTİF'));

    return `
      <div class="bento-match-card ${cls}" data-match-id="${escapeHtml(item.matchId)}">
        <div class="bmc-top">
          <span>${escapeHtml(item.leagueName || t('league_other', 'Futbol Ligi'))}</span>
          <span class="sig-outcome-badge ${badgeCls}">${cleanBadgeText(item.settlementBadge, badgeLabel)}</span>
        </div>

        <div class="bmc-teams">
          <div class="bmc-team home">
            <img src="${escapeHtml(hLogo)}" alt="" data-team-name="${escapeHtml(hName)}" data-backup-logo="${escapeHtml(item.homeBackupLogo || '')}" />
            <strong>${escapeHtml(hName)}</strong>
          </div>
          <div class="bmc-score-box">${item.currentScoreHome ?? item.triggerScoreHome ?? 0} : ${item.currentScoreAway ?? item.triggerScoreAway ?? 0}</div>
          <div class="bmc-team away">
            <strong>${escapeHtml(aName)}</strong>
            <img src="${escapeHtml(aLogo)}" alt="" data-team-name="${escapeHtml(aName)}" data-backup-logo="${escapeHtml(item.awayBackupLogo || '')}" />
          </div>
        </div>

        <div class="nc-signal-box" style="margin-bottom:0">
          <div>
            <span class="nc-sig-tag">${escapeHtml(cleanBadgeText(item.archetypeLabel || item.marketTitle, t('signal_active_tag', 'CANLI SİNYAL')))}</span>
            <h4 class="nc-sig-market">${escapeHtml(item.selection || t('valuable_selection', 'Değerli Seçim'))}</h4>
          </div>
          <div class="nc-sig-metrics">
            <span class="nc-odd-badge">@${item.odds || '-'}</span>
            <span class="nc-conf-badge">%${item.confidence || 72} ${t('confidence', 'Güven')}</span>
          </div>
        </div>

        <div class="nc-trigger-meta" style="margin-bottom:0">
          <span>${t('trigger_minute_label', 'Tetikleme: Dk')} ${item.triggerMinute || 1}' (${item.triggerScoreHome ?? 0}-${item.triggerScoreAway ?? 0})</span>
          <span>${t('current_label', 'Güncel')}: ${item.matchStatus === 'FT' ? t('minute_ft', 'MS') : `${item.currentMinute || item.triggerMinute || 1}'`} (${item.currentScoreHome ?? 0}-${item.currentScoreAway ?? 0})</span>
        </div>
        <div style="font-size:11.5px;color:var(--text-secondary)">
          ${escapeHtml(item.settlementDetail || item.narrative || '')}
        </div>
      </div>
    `;
  }

  function renderFavoritesView() {
    const grid = document.getElementById('favoritesBentoGrid');
    const pill = document.getElementById('favViewCountPill');
    const starredMatches = state.matches.filter(m => state.starredIds.has(m.matchId));
    if (pill) pill.textContent = `${starredMatches.length} ${t('nav_favorites', 'Favori Maç')}`;

    if (starredMatches.length === 0) {
      grid.innerHTML = `
        <div class="empty-state-card" style="grid-column: 1 / -1">
          <div class="es-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </div>
          <h4>${t('fav_empty_title', 'Henüz Favori Maç Eklenmedi')}</h4>
          <p>${t('fav_empty_desc', 'Sol maç listesindeki veya maç detayındaki yıldız ikonuna tıklayarak maçları buraya sabitleyebilirsiniz.')}</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = starredMatches.map(buildBentoMatchCardHtml).join('');
  }

  function renderRadarView() {
    const st = state.signalStats;
    document.getElementById('rkpiTotal').textContent = st.total;
    document.getElementById('rkpiWon').textContent = st.won;
    document.getElementById('rkpiLost').textContent = st.lost;
    document.getElementById('rkpiPending').textContent = st.pending;
    document.getElementById('rkpiRate').textContent = `%${st.hitRatePct}`;

    // 1. Render Tracked Signals Ledger Grid
    const ledgerGrid = document.getElementById('radarLedgerGrid');
    const visibleLedger = state.signalLedger.filter(item => {
      if (state.dismissedIds.has(item.id)) return false;
      if (state.radarLedgerFilter !== 'ALL' && item.settlementStatus !== state.radarLedgerFilter) return false;
      return true;
    });

    if (visibleLedger.length === 0) {
      ledgerGrid.innerHTML = `
        <div class="empty-state-card" style="grid-column: 1 / -1">
          <div class="es-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <h4>${t('empty_signals_heading', 'Bu Filtrede Kayıtlı Sinyal Yok')}</h4>
          <p>${t('empty_signals_text', 'Seçilen kritere uygun sonuçlandırma kaydı oluştuğunda burada anlık olarak listelenecektir.')}</p>
        </div>
      `;
    } else {
      ledgerGrid.innerHTML = visibleLedger.map(buildTrackedSignalLedgerCardHtml).join('');
    }

    // 2. Render Currently Active Live Signal & Watchlist Matches (Strictly LIVE only, never FT!)
    const grid = document.getElementById('radarBentoGrid');
    const pill = document.getElementById('radarViewCountPill');
    const signalMatches = state.matches.filter(m =>
      m.status === 'LIVE' &&
      (isMatchValidForSignalNotif(m) || ((m.minute || 0) < 75 && m.analysis?.quant?.signalStatus === 'WATCHLIST'))
    );
    const activeCount = state.matches.filter(m => isMatchValidForSignalNotif(m)).length;
    if (pill) pill.textContent = `${activeCount} ${t('minute_live', 'Canlı')} ${t('tab_signals_header', 'Sinyal')} • ${st.won} ${t('score_won', 'Tuttu')} (%${st.hitRatePct})`;

    if (signalMatches.length === 0) {
      grid.innerHTML = `
        <div class="empty-state-card" style="grid-column: 1 / -1">
          <div class="es-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 12h2a8 8 0 0 1 8-8V2a10 10 0 0 0-10 10Z"></path>
              <circle cx="12" cy="12" r="3"></circle>
              <circle cx="12" cy="12" r="9"></circle>
            </svg>
          </div>
          <h4>${t('empty_radar_heading', 'Canlı Radar Taraması Devam Ediyor')}</h4>
          <p>${t('empty_radar_text', 'Yüksek güvenli bir değer kırılması tespit edildiğinde maçlar burada canlı olarak listelenir.')}</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = signalMatches.map(buildBentoMatchCardHtml).join('');
  }

  // ================= RIGHT COLUMN: TWO SEPARATE DESIGNER NOTIFICATION PANELS =================

  // PANEL 1: CANLI SİNYAL BİLDİRİMLERİ & TUTTU/TUTMADI KARNESİ
  function renderSignalNotifications() {
    const stream = document.getElementById('signalNotificationStream');
    const countEl = document.getElementById('signalNotifCount');

    const st = state.signalStats;
    document.getElementById('ssbTotal').textContent = st.total;
    document.getElementById('ssbWon').textContent = st.won;
    document.getElementById('ssbLost').textContent = st.lost;
    document.getElementById('ssbPending').textContent = st.pending;
    document.getElementById('ssbRate').textContent = `%${st.hitRatePct}`;

    const filtered = state.signalLedger.filter(sig => {
      if (!state.signalNotifsEnabled) return false;
      if (state.dismissedIds.has(sig.id)) return false;
      if (state.starredOnlyNotifs && !state.starredIds.has(sig.matchId)) return false;
      if (state.sigPanelFilter !== 'ALL' && sig.settlementStatus !== state.sigPanelFilter) return false;
      return true;
    });

    if (countEl) countEl.textContent = filtered.length;
    const nsegSig = document.getElementById('nsegCountSignals');
    if (nsegSig) nsegSig.textContent = filtered.length;

    if (!state.signalNotifsEnabled) {
      stream.innerHTML = `<div class="empty-box small">${t('sig_paused', 'Canlı sinyal bildirimleri kullanıcı tarafından duraklatıldı.')}</div>`;
      return;
    }

    if (filtered.length === 0) {
      stream.innerHTML = `
        <div class="empty-state-card">
          <div class="es-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>
          <h4>${t('empty_signals_heading', 'Canlı Sinyal Radarı Dinleniyor')}</h4>
          <p>${t('empty_signals_text', 'Tetiklenen sinyaller TUTTU, TUTMADI ve AKTİF durumlarıyla burada anlık olarak takip edilir.')}</p>
        </div>
      `;
      return;
    }

    stream.innerHTML = filtered.slice(0, 40).map(sig => {
      const hName = sig.homeName || t('team_home', 'Ev Sahibi');
      const aName = sig.awayName || t('team_away', 'Deplasman');
      const hLogo = resolveLogo(sig.homeLogo, hName);
      const aLogo = resolveLogo(sig.awayLogo, aName);
      const stStatus = sig.settlementStatus || 'PENDING';
      const cardStClass = stStatus === 'WON' ? 'sig-won' : (stStatus === 'LOST' ? 'sig-lost' : 'sig-pending');
      const badgeStClass = stStatus === 'WON' ? 'won' : (stStatus === 'LOST' ? 'lost' : 'pending');
      const defaultBadge = stStatus === 'WON' ? t('score_won', 'TUTTU') : (stStatus === 'LOST' ? t('score_lost', 'TUTMADI') : t('score_in_play', 'AKTİF'));

      return `
        <div class="notif-card signal-card ${cardStClass}" data-match-id="${escapeHtml(sig.matchId)}">
          <div class="nc-top">
            <div class="nc-match-identity">
              <div class="nc-crests">
                <img class="nc-crest home" src="${escapeHtml(hLogo)}" alt="" data-team-name="${escapeHtml(hName)}" data-backup-logo="${escapeHtml(sig.homeBackupLogo || '')}" />
                <img class="nc-crest away" src="${escapeHtml(aLogo)}" alt="" data-team-name="${escapeHtml(aName)}" data-backup-logo="${escapeHtml(sig.awayBackupLogo || '')}" />
              </div>
              <div class="nc-match-titles">
                <span class="nc-league">${escapeHtml(sig.leagueName || t('league_other', 'Canlı Lig'))}</span>
                <strong class="nc-teams">${escapeHtml(hName)} - ${escapeHtml(aName)}</strong>
              </div>
            </div>
            <div class="nc-meta-right">
              <span class="sig-outcome-badge ${badgeStClass}">${cleanBadgeText(sig.settlementBadge, defaultBadge)}</span>
              <button class="nc-dismiss-btn" data-dismiss-sig="${escapeHtml(sig.id)}" title="${t('dismiss_signal', 'Sinyali Gizle')}">×</button>
            </div>
          </div>

          <div class="nc-signal-box">
            <div>
              <span class="nc-sig-tag">${escapeHtml(cleanBadgeText(sig.tierBadge, t('spotlight_active_badge', 'SİNYAL AKTİF')))} • ${escapeHtml(cleanBadgeText(sig.archetypeLabel, t('flow_signal_tag', 'GİDİŞAT SİNYALİ')))}</span>
              <h4 class="nc-sig-market">${escapeHtml(sig.selection || t('valuable_selection', 'Değerli Seçim'))}</h4>
            </div>
            <div class="nc-sig-metrics">
              <span class="nc-odd-badge">@${sig.odds || '-'}</span>
              <span class="nc-conf-badge">%${sig.confidence || 75} ${t('confidence', 'Güven')}</span>
            </div>
          </div>

          <div class="nc-trigger-meta">
            <span>${t('trigger_minute_label', 'Tetikleme: Dk')} ${sig.triggerMinute || 1}' (${sig.triggerScoreHome ?? 0}-${sig.triggerScoreAway ?? 0})</span>
            <span>${t('current_score_label', 'Skor:')} <b>${sig.currentScoreHome ?? sig.triggerScoreHome ?? 0} - ${sig.currentScoreAway ?? sig.triggerScoreAway ?? 0}</b></span>
          </div>
          <p class="nc-reason">${escapeHtml(sig.settlementDetail || sig.narrative || '')}</p>
        </div>
      `;
    }).join('');
  }

  function getEventGlyph(cat, type) {
    if (type === 'RED_CARD' || cat === 'red_card') {
      return '<span class="ec-icon ec-red-card" title="Kırmızı Kart"><svg width="12" height="15" viewBox="0 0 12 15" fill="#f43f5e"><rect width="12" height="15" rx="2"></rect></svg></span>';
    }
    if (cat === 'goal') {
      return '<span class="ec-icon ec-goal" title="Gol"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.3"><circle cx="12" cy="12" r="9"></circle><polygon points="12 7 15 10 13 14 9 14 8 10 12 7" fill="#10b981"></polygon></svg></span>';
    }
    if (cat === 'disallowed_goal') {
      return '<span class="ec-icon ec-disallowed" title="İptal Gol"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2.3"><circle cx="12" cy="12" r="9"></circle><line x1="5.5" y1="5.5" x2="18.5" y2="18.5"></line></svg></span>';
    }
    if (cat === 'assist') {
      return '<span class="ec-icon ec-assist" title="Asist"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.3"><path d="M5 12h14M12 5l7 7-7 7"></path></svg></span>';
    }
    if (cat === 'card') {
      return '<span class="ec-icon ec-yellow-card" title="Sarı Kart"><svg width="12" height="15" viewBox="0 0 12 15" fill="#eab308"><rect width="12" height="15" rx="2"></rect></svg></span>';
    }
    if (cat === 'shot') {
      return '<span class="ec-icon ec-shot" title="Şut"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2.2"><circle cx="12" cy="12" r="9"></circle><path d="M12 3v4M12 17v4M3 12h4M17 12h4"></path></svg></span>';
    }
    if (cat === 'foul') {
      return '<span class="ec-icon ec-foul" title="Faul"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></span>';
    }
    return '<span class="ec-icon ec-other" title="Olay"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></span>';
  }

  // PANEL 2: CANLI MAÇ OLAY BİLDİRİMLERİ
  function renderMatchNotifications() {
    const stream = document.getElementById('matchNotificationStream');
    const countEl = document.getElementById('matchNotifCount');

    const filtered = state.events.filter(ev => {
      if (ev.category === 'signal' || ev.type === 'BETTING_SIGNAL') return false;
      if (!state.enabledEventCategories.has(ev.category)) return false;
      if (state.starredOnlyNotifs && !state.starredIds.has(ev.matchId)) return false;
      return true;
    });

    if (countEl) countEl.textContent = filtered.length;
    const nsegEvt = document.getElementById('nsegCountEvents');
    if (nsegEvt) nsegEvt.textContent = filtered.length;

    if (filtered.length === 0) {
      stream.innerHTML = `
        <div class="empty-state-card">
          <div class="es-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </div>
          <h4>${t('empty_events_heading', 'Canlı Maç Olayları Bekleniyor')}</h4>
          <p>${t('empty_events_text', 'Canlı maçlarda gerçekleşen gol, iptal gol, asist, şut, faul ve kartlar anında burada listelenir.')}</p>
        </div>
      `;
      return;
    }

    stream.innerHTML = filtered.slice(0, 50).map(ev => {
      const hName = ev.homeName || t('team_home', 'Ev Sahibi');
      const aName = ev.awayName || t('team_away', 'Deplasman');
      const tName = ev.teamName || hName;
      const teamCrest = resolveLogo(ev.teamLogo || ev.homeLogo, tName);

      return `
        <div class="notif-card event-card cat-${escapeHtml(ev.category)}" data-match-id="${escapeHtml(ev.matchId)}">
          <div class="ec-icon-wrap">
            ${getEventGlyph(ev.category, ev.type)}
            <img class="ec-team-mini-crest" src="${escapeHtml(teamCrest)}" alt="" data-team-name="${escapeHtml(tName)}" />
          </div>
          <div class="ec-body">
            <div class="ec-header-row">
              <span class="ec-match-name">${escapeHtml(hName)} ${ev.homeScore ?? 0}-${ev.awayScore ?? 0} ${escapeHtml(aName)}</span>
              <div class="ec-right-meta">
                <span class="ec-time-score">${escapeHtml(ev.minuteLabel || `${ev.minute || 1}'`)}</span>
                <button class="nc-dismiss-btn" data-dismiss-evt="${escapeHtml(ev.id)}" title="${t('dismiss_event', 'Bildirimi Kapat')}">×</button>
              </div>
            </div>
            <div class="ec-title">${escapeHtml(ev.title || '')}</div>
            <div class="ec-detail">${escapeHtml(ev.message || '')}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function showToast(item, isSignal) {
    const stack = document.getElementById('toastStack');
    if (!stack || !item) return;
    const hName = item.homeName || t('team_home', 'Ev Sahibi');
    const aName = item.awayName || t('team_away', 'Deplasman');
    const title = item.title || item.selection || t('tab_signals_header', 'Canlı Bildirim');
    const min = item.minuteLabel || (item.minute ? `${item.minute}'` : '');
    const el = document.createElement('div');
    el.className = 'toast-item';
    el.style.borderLeftColor = isSignal ? 'var(--emerald-bright)' : 'var(--brand)';
    el.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:3px">
        ${escapeHtml(hName)} ${item.homeScore ?? 0}-${item.awayScore ?? 0} ${escapeHtml(aName)}${min ? ` • ${escapeHtml(min)}` : ''}
      </div>
      <div style="font-size:13px;font-weight:800;color:var(--text-primary)">${escapeHtml(title)}</div>
    `;
    stack.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 4000);
  }

  // ================= VIEW SWITCHING & ACTIONS =================
  let ws = null;
  let renderRafId = null;

  function scheduleRenderAllViews() {
    if (renderRafId !== null) return;
    renderRafId = requestAnimationFrame(() => {
      renderRafId = null;
      renderAllViews();
    });
  }

  function switchMainView(viewName) {
    state.activeView = viewName;
    document.querySelectorAll('#mainViewSwitcher .view-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    document.getElementById('centerViewContainer').classList.toggle('hidden', viewName !== 'center');
    document.getElementById('favoritesViewContainer').classList.toggle('hidden', viewName !== 'favorites');
    document.getElementById('radarViewContainer').classList.toggle('hidden', viewName !== 'radar');

    if (viewName === 'favorites') renderFavoritesView();
    if (viewName === 'radar') renderRadarView();
  }

  function renderAllViews() {
    purgeStaleClientNotifications();
    renderMatchList();
    renderCenterStudio();
    renderSignalNotifications();
    renderMatchNotifications();
    if (state.activeView === 'favorites') renderFavoritesView();
    if (state.activeView === 'radar') renderRadarView();
  }

  function toggleStarMatch(matchId) {
    if (state.starredIds.has(matchId)) {
      state.starredIds.delete(matchId);
    } else {
      state.starredIds.add(matchId);
    }
    scheduleRenderAllViews();

    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ action: 'STAR_MATCH', matchId }));
    } else {
      fetch(`/api/star/${encodeURIComponent(matchId)}`, { method: 'POST' }).catch(() => {});
    }
  }

  function selectMatch(matchId, switchToCenter = false) {
    if (!state.matches.some(m => m.matchId === matchId)) return;
    state.selectedMatchId = matchId;
    if (switchToCenter && state.activeView !== 'center') {
      switchMainView('center');
    }
    renderMatchList();
    renderCenterStudio();
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ action: 'INSPECT_MATCH', matchId }));
    }
  }

  function handleIncomingNewItems(newEvents, newSignals) {
    const matchMap = new Map(state.matches.map(m => [m.matchId, m]));

    if (Array.isArray(newSignals) && newSignals.length > 0) {
      for (const sig of newSignals) {
        if (state.dismissedIds.has(sig.id)) continue;
        if (state.signalNotifsEnabled && (!state.starredOnlyNotifs || state.starredIds.has(sig.matchId))) {
          if (window.pulseSound) window.pulseSound.play('signal');
          showToast(sig, true);
        }
      }
    }

    if (Array.isArray(newEvents) && newEvents.length > 0) {
      for (const ev of newEvents) {
        if (ev.category === 'signal' || ev.type === 'BETTING_SIGNAL') continue;
        if ((ev.timestamp || 0) < state.sessionStartTs - 2000) continue;
        if (state.dismissedIds.has(ev.id)) continue;

        const m = matchMap.get(ev.matchId);
        if (m && (m.status !== 'LIVE' || (m.minute || 0) >= 90)) continue;

        if (!state.events.some(x => x.id === ev.id)) {
          state.events.unshift(ev);
          if (state.enabledEventCategories.has(ev.category) && (!state.starredOnlyNotifs || state.starredIds.has(ev.matchId))) {
            if (window.pulseSound) window.pulseSound.play(ev.category);
            if (ev.category === 'goal' || ev.category === 'disallowed_goal' || ev.category === 'card') {
              showToast(ev, false);
            }
          }
        }
      }
      if (state.events.length > 80) state.events.length = 80;
    }

    purgeStaleClientNotifications();
    renderSignalNotifications();
    renderMatchNotifications();
  }

  function connectWebSocket() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}`);

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'INIT_SNAPSHOT') {
          state.sessionStartTs = Date.now();
          state.matches = filterOutFinishedMatches(msg.matches || []);
          state.events = [];
          state.signalLedger = Array.isArray(msg.signalLedger) ? msg.signalLedger : [];
          if (msg.signalStats) state.signalStats = msg.signalStats;
          state.starredIds = new Set(msg.starredIds || []);
          renderSourceStatus(msg.sourceStatus);
          scheduleRenderAllViews();
        } else if (msg.type === 'STATE_SYNC') {
          state.matches = filterOutFinishedMatches(msg.matches || state.matches);
          if (Array.isArray(msg.signalLedger)) state.signalLedger = msg.signalLedger;
          if (msg.signalStats) state.signalStats = msg.signalStats;
          renderSourceStatus(msg.sourceStatus);
          handleIncomingNewItems(msg.events, msg.signals);
          scheduleRenderAllViews();
        } else if (msg.type === 'NEW_EVENTS') {
          if (Array.isArray(msg.signalLedger)) state.signalLedger = msg.signalLedger;
          if (msg.signalStats) state.signalStats = msg.signalStats;
          renderSourceStatus(msg.sourceStatus);
          handleIncomingNewItems(msg.events, msg.signals);
          scheduleRenderAllViews();
        } else if (msg.type === 'MATCH_UPDATED' && msg.match) {
          if (msg.match.status === 'FT' || msg.match.status === 'POSTPONED') {
            state.matches = state.matches.filter(m => m.matchId !== msg.match.matchId);
          } else {
            const idx = state.matches.findIndex(m => m.matchId === msg.match.matchId);
            if (idx !== -1) state.matches[idx] = msg.match;
          }
          scheduleRenderAllViews();
        } else if (msg.type === 'STAR_UPDATED') {
          state.starredIds = new Set(msg.starredIds || []);
          scheduleRenderAllViews();
        }
      } catch (_) {}
    };

    ws.onclose = () => {
      setTimeout(connectWebSocket, 2500);
    };
  }

  // ================= UI EVENT LISTENERS =================
  function closeLeaguePopover() {
    state.leaguePopoverOpen = false;
    const pop = document.getElementById('leaguePickerPopover');
    const trig = document.getElementById('btnLeaguePickerTrigger');
    if (pop) pop.classList.add('hidden');
    if (trig) {
      trig.classList.remove('open');
      trig.setAttribute('aria-expanded', 'false');
    }
  }

  function bindUiEvents() {
    // Global Capture-Phase Logo Error Handler
    document.addEventListener('error', (e) => {
      const img = e.target;
      if (img && img.tagName === 'IMG' && img.dataset.teamName) {
        handleLogoFallback(img, img.dataset.teamName, img.dataset.backupLogo || '');
      }
    }, true);

    // Close Custom League Popover on outside click
    document.addEventListener('click', (e) => {
      if (!state.leaguePopoverOpen) return;
      const wrap = document.getElementById('customLeagueDropdown');
      if (wrap && !wrap.contains(e.target)) {
        closeLeaguePopover();
      }
    });

    // Custom League Picker Trigger & Search & Selection
    const trigBtn = document.getElementById('btnLeaguePickerTrigger');
    const popEl = document.getElementById('leaguePickerPopover');
    const lgSearch = document.getElementById('leagueSearchInput');
    const lgList = document.getElementById('leaguePickerList');

    if (trigBtn && popEl) {
      trigBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.leaguePopoverOpen = !state.leaguePopoverOpen;
        popEl.classList.toggle('hidden', !state.leaguePopoverOpen);
        trigBtn.classList.toggle('open', state.leaguePopoverOpen);
        trigBtn.setAttribute('aria-expanded', String(state.leaguePopoverOpen));
        if (state.leaguePopoverOpen && lgSearch) {
          lgSearch.focus();
        }
      });
    }

    if (lgSearch) {
      lgSearch.addEventListener('input', (e) => {
        state.leagueSearchQuery = e.target.value || '';
        renderLeagueFilters();
      });
    }

    if (lgList) {
      lgList.addEventListener('click', (e) => {
        const item = e.target.closest('[data-pick-league]');
        if (!item) return;
        state.selectedLeague = item.dataset.pickLeague || 'ALL';
        closeLeaguePopover();
        renderMatchList();
      });
    }

    document.getElementById('leagueQuickPills').addEventListener('click', (e) => {
      const pill = e.target.closest('[data-league]');
      if (!pill) return;
      state.selectedLeague = pill.dataset.league;
      renderMatchList();
    });

    // Top Navigation View Switcher
    document.getElementById('mainViewSwitcher').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-view]');
      if (!btn) return;
      switchMainView(btn.dataset.view);
    });

    // Theme Toggle
    document.getElementById('btnThemeToggle').addEventListener('click', () => {
      const nextTheme = state.theme === 'light' ? 'dark' : 'light';
      applyTheme(nextTheme);
      saveUiPrefs();
    });

    // Match List Click Delegation
    document.getElementById('matchListContainer').addEventListener('click', (e) => {
      const starBtn = e.target.closest('[data-star-id]');
      if (starBtn) {
        e.stopPropagation();
        toggleStarMatch(starBtn.dataset.starId);
        return;
      }
      const item = e.target.closest('[data-match-id]');
      if (item) {
        selectMatch(item.dataset.matchId, false);
      }
    });

    // Bento Grids (Favorites, Radar Ledger, Radar Live) Click Delegation
    const handleBentoClick = (e) => {
      const starBtn = e.target.closest('[data-star-id]');
      if (starBtn) {
        e.stopPropagation();
        toggleStarMatch(starBtn.dataset.starId);
        return;
      }
      const card = e.target.closest('[data-match-id]');
      if (card) {
        selectMatch(card.dataset.matchId, true);
      }
    };
    document.getElementById('favoritesBentoGrid').addEventListener('click', handleBentoClick);
    document.getElementById('radarBentoGrid').addEventListener('click', handleBentoClick);
    document.getElementById('radarLedgerGrid').addEventListener('click', handleBentoClick);

    // Mini Signal Scoreboard Filter Chips (Right Panel)
    document.getElementById('miniSignalScoreboard').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-sig-filter]');
      if (!chip) return;
      state.sigPanelFilter = chip.dataset.sigFilter;
      document.querySelectorAll('#miniSignalScoreboard .ssb-chip').forEach(c => c.classList.toggle('active', c === chip));
      renderSignalNotifications();
    });

    // Radar Ledger Filter Tabs (Full Radar View)
    document.getElementById('radarLedgerFilterTabs').addEventListener('click', (e) => {
      const tab = e.target.closest('[data-rfilter]');
      if (!tab) return;
      state.radarLedgerFilter = tab.dataset.rfilter;
      document.querySelectorAll('#radarLedgerFilterTabs .rl-tab').forEach(t => t.classList.toggle('active', t === tab));
      renderRadarView();
    });

    // Notification Panels Click & Dismiss Delegation
    document.getElementById('signalNotificationStream').addEventListener('click', (e) => {
      const dismissBtn = e.target.closest('[data-dismiss-sig]');
      if (dismissBtn) {
        e.stopPropagation();
        state.dismissedIds.add(dismissBtn.dataset.dismissSig);
        recomputeClientSignalStats();
        renderSignalNotifications();
        if (state.activeView === 'radar') renderRadarView();
        return;
      }
      const card = e.target.closest('[data-match-id]');
      if (card) selectMatch(card.dataset.matchId, true);
    });

    document.getElementById('matchNotificationStream').addEventListener('click', (e) => {
      const dismissBtn = e.target.closest('[data-dismiss-evt]');
      if (dismissBtn) {
        e.stopPropagation();
        state.dismissedIds.add(dismissBtn.dataset.dismissEvt);
        state.events = state.events.filter(ev => ev.id !== dismissBtn.dataset.dismissEvt);
        renderMatchNotifications();
        return;
      }
      const card = e.target.closest('[data-match-id]');
      if (card) selectMatch(card.dataset.matchId, true);
    });

    // Status Filter Tabs (Tümü | Canlı | Yaklaşan | Sinyal)
    document.getElementById('matchFilterTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      state.matchFilter = btn.dataset.filter;
      document.querySelectorAll('#matchFilterTabs .filter-tab').forEach(b => b.classList.toggle('active', b === btn));
      renderMatchList();
    });

    // Search Input & Clear Button
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('btnClearSearch');
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value || '';
      clearSearchBtn.classList.toggle('hidden', !state.searchQuery);
      renderMatchList();
    });
    clearSearchBtn.addEventListener('click', () => {
      state.searchQuery = '';
      searchInput.value = '';
      clearSearchBtn.classList.add('hidden');
      renderMatchList();
    });

    // Starred-only notifications toggle
    const btnStarredOnly = document.getElementById('btnStarredOnly');
    btnStarredOnly.classList.toggle('active', state.starredOnlyNotifs);
    btnStarredOnly.addEventListener('click', () => {
      state.starredOnlyNotifs = !state.starredOnlyNotifs;
      btnStarredOnly.classList.toggle('active', state.starredOnlyNotifs);
      saveUiPrefs();
      renderSignalNotifications();
      renderMatchNotifications();
    });

    // Sidebar Collapse / Expand Actions
    const btnToggleLeft = document.getElementById('btnToggleLeftSidebar');
    if (btnToggleLeft) btnToggleLeft.addEventListener('click', () => toggleLeftSidebar());

    const btnToggleRight = document.getElementById('btnToggleRightSidebar');
    if (btnToggleRight) btnToggleRight.addEventListener('click', () => toggleRightSidebar());

    const btnCollapseLeft = document.getElementById('btnCollapseLeft');
    if (btnCollapseLeft) btnCollapseLeft.addEventListener('click', () => toggleLeftSidebar(true));

    const btnExpandLeft = document.getElementById('btnExpandLeft');
    if (btnExpandLeft) {
      btnExpandLeft.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleLeftSidebar(false);
      });
    }

    const btnCollapseRight = document.getElementById('btnCollapseRight');
    if (btnCollapseRight) btnCollapseRight.addEventListener('click', () => toggleRightSidebar(true));

    const btnExpandRight = document.getElementById('btnExpandRight');
    if (btnExpandRight) {
      btnExpandRight.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleRightSidebar(false);
      });
    }

    // Quick Settings Popover Trigger & Dismiss
    const qsTrigger = document.getElementById('btnQuickSettingsTrigger');
    const qsPopover = document.getElementById('quickSettingsPopover');
    if (qsTrigger && qsPopover) {
      qsTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = qsPopover.classList.contains('hidden');
        qsPopover.classList.toggle('hidden', !isHidden);
        qsTrigger.setAttribute('aria-expanded', String(isHidden));
      });

      document.addEventListener('click', (e) => {
        if (!qsPopover.classList.contains('hidden') && !qsPopover.contains(e.target) && !qsTrigger.contains(e.target)) {
          qsPopover.classList.add('hidden');
          qsTrigger.setAttribute('aria-expanded', 'false');
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !qsPopover.classList.contains('hidden')) {
          qsPopover.classList.add('hidden');
          qsTrigger.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Language Toggle Actions (TR / EN)
    const btnLang = document.getElementById('btnLangToggle');
    if (btnLang && !btnLang.dataset.i18nBound) {
      btnLang.dataset.i18nBound = 'true';
      btnLang.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.pulseI18n) window.pulseI18n.toggle();
      });
    }

    const btnPopoverLang = document.getElementById('btnPopoverLangToggle');
    if (btnPopoverLang && !btnPopoverLang.dataset.i18nBound) {
      btnPopoverLang.dataset.i18nBound = 'true';
      btnPopoverLang.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.pulseI18n) window.pulseI18n.toggle();
      });
    }

    if (window.pulseI18n) {
      window.pulseI18n.subscribe(() => {
        scheduleRenderAllViews();
      });
      window.pulseI18n.applyTranslations();
    }

    // Segmented Notification View Switcher (Signals vs Events vs Split Both)
    const segContainer = document.getElementById('notifSegmentTabs');
    if (segContainer) {
      segContainer.addEventListener('click', (e) => {
        const tab = e.target.closest('[data-nview]');
        if (!tab) return;
        state.notifView = tab.dataset.nview || 'signals';
        applyLayoutPrefs();
        saveUiPrefs();
      });
    }

    // Keyboard Shortcuts: '[' for left sidebar, ']' for right sidebar
    document.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName : '';
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
      if (e.key === '[') {
        toggleLeftSidebar();
      } else if (e.key === ']') {
        toggleRightSidebar();
      }
    });

    // Studio Tabs Navigation Delegation
    const studioNav = document.getElementById('studioTabs') || document.getElementById('studioNavBar');
    if (studioNav) {
      studioNav.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('[data-studio-tab], [data-stab]');
        if (!tabBtn) return;
        const targetTab = tabBtn.dataset.studioTab || tabBtn.dataset.stab;
        switchStudioTab(targetTab);
      });
    }

    // Quick Jump Links to Specific Studio Tabs
    document.addEventListener('click', (e) => {
      const gotoBtn = e.target.closest('[data-goto-stab], [data-jump-tab]');
      if (gotoBtn) {
        switchStudioTab(gotoBtn.dataset.gotoStab || gotoBtn.dataset.jumpTab);
      }
    });

    // Apply layout and studio tab preferences on boot
    applyLayoutPrefs();
    switchStudioTab(state.studioActiveTab || 'overview');

    // Sound toggle
    const btnSound = document.getElementById('btnSoundToggle');
    const syncSoundBtn = () => {
      const on = window.pulseSound ? window.pulseSound.enabled : true;
      btnSound.classList.toggle('active', on);
      const iconSvg = on
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
      btnSound.innerHTML = `<span class="qsp-icon" id="soundIcon">${iconSvg}</span> <span class="qsp-text">Sesli Bildirimler</span>`;
    };
    syncSoundBtn();
    btnSound.addEventListener('click', () => {
      if (window.pulseSound) {
        window.pulseSound.enabled = !window.pulseSound.enabled;
        if (window.pulseSound.enabled) window.pulseSound.play('shot');
      }
      syncSoundBtn();
      saveUiPrefs();
    });

    // Force refresh
    document.getElementById('btnForceRefresh').addEventListener('click', () => {
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ action: 'FORCE_REFRESH' }));
      }
    });

    // Panel 1: Toggle & Clear Signal Notifications
    const toggleSigBtn = document.getElementById('toggleSignalNotifs');
    const syncSigToggle = () => {
      toggleSigBtn.classList.toggle('active', state.signalNotifsEnabled);
      toggleSigBtn.textContent = state.signalNotifsEnabled ? 'Aktif' : 'Kapalı';
    };
    syncSigToggle();
    toggleSigBtn.addEventListener('click', () => {
      state.signalNotifsEnabled = !state.signalNotifsEnabled;
      syncSigToggle();
      saveUiPrefs();
      renderSignalNotifications();
    });

    document.getElementById('btnClearSignals').addEventListener('click', () => {
      for (const s of state.signalLedger) {
        state.dismissedIds.add(s.id);
      }
      state.signalLedger = [];
      recomputeClientSignalStats();
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ action: 'CLEAR_NOTIFICATIONS', target: 'SIGNALS' }));
      }
      renderSignalNotifications();
      if (state.activeView === 'radar') renderRadarView();
    });

    // Panel 2: Match Event Category Toggles & Clear
    const catContainer = document.getElementById('eventCategoryToggles');
    catContainer.querySelectorAll('[data-cat]').forEach(btn => {
      btn.classList.toggle('active', state.enabledEventCategories.has(btn.dataset.cat));
    });
    catContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cat]');
      if (!btn) return;
      const cat = btn.dataset.cat;
      if (state.enabledEventCategories.has(cat)) {
        state.enabledEventCategories.delete(cat);
      } else {
        state.enabledEventCategories.add(cat);
      }
      btn.classList.toggle('active', state.enabledEventCategories.has(cat));
      saveUiPrefs();
      renderMatchNotifications();
    });

    document.getElementById('btnClearEvents').addEventListener('click', () => {
      for (const ev of state.events) {
        state.dismissedIds.add(ev.id);
      }
      state.events = [];
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ action: 'CLEAR_NOTIFICATIONS', target: 'EVENTS' }));
      }
      renderMatchNotifications();
    });

    // Periodic client-side TTL cleanup every 15 seconds
    setInterval(() => {
      purgeStaleClientNotifications();
      renderSignalNotifications();
      renderMatchNotifications();
    }, 15000);
  }

  bindUiEvents();
  connectWebSocket();
})();
