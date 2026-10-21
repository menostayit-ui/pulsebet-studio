/**
 * PulseBet Pro — Flashscore Real-Time Scraper Engine
 * Directly scrapes Flashscore's high-speed Ninja Feed (2.flashscore.ninja)
 * and GraphQL Odds API (global.ds.lsapp.eu) with zero external API keys.
 */

const MODERN_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'
];

class FlashscoreScraper {
  constructor() {
    this.feedBaseUrl = 'https://2.flashscore.ninja/2/x/feed';
    this.oddsGraphQlUrl = 'https://global.ds.lsapp.eu/odds/pq_graphql';
    this.uaIndex = 0;
    this.timeoutMs = 4500;
    this.maxRetries = 2;

    this.primaryToken = 'SW9D1eZo';
    this.currentToken = this.primaryToken;
    this.tokenFallbackList = [
      'SW9D1eZo',
      'SW9D1eZp',
      '46c4b5c2',
      'a1b2c3d4',
      'd3b07384d113edec49eaa6238ad5ff00'
    ];
    this.fallbackIndex = 0;
    this.lastTokenRefreshTs = 0;
    this.tokenRefreshPromise = null;

    this.originList = [
      'https://www.flashscore.com.tr',
      'https://www.flashscore.com',
      'https://www.flashscore.co.uk',
      'https://www.flashscore.mobi'
    ];
    this.originIndex = 0;

    this.headers = {
      'x-fsign': this.currentToken,
      'Referer': `${this.originList[0]}/`,
      'Origin': this.originList[0],
      'Accept': '*/*',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
  }

  getNextUserAgent() {
    const ua = MODERN_USER_AGENTS[this.uaIndex % MODERN_USER_AGENTS.length];
    this.uaIndex = (this.uaIndex + 1) % MODERN_USER_AGENTS.length;
    return ua;
  }

  getNextOrigin() {
    const origin = this.originList[this.originIndex % this.originList.length];
    this.originIndex = (this.originIndex + 1) % this.originList.length;
    return origin;
  }

  /**
   * Dynamic token discovery: attempts to scrape latest x-fsign token from web client,
   * falling back to secondary signature rotations upon failure or HTTP 403.
   */
  async refreshDynamicToken() {
    if (this.tokenRefreshPromise) return this.tokenRefreshPromise;

    this.tokenRefreshPromise = (async () => {
      const now = Date.now();
      // Throttle discovery requests to at most once every 30 seconds
      if (now - this.lastTokenRefreshTs < 30000) {
        this.rotateFallbackToken();
        return this.currentToken;
      }
      this.lastTokenRefreshTs = now;

      const endpoints = [
        'https://www.flashscore.com.tr/',
        'https://www.flashscore.com/',
        'https://www.flashscore.mobi/'
      ];

      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            headers: {
              'User-Agent': this.getNextUserAgent(),
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            signal: AbortSignal.timeout(3500)
          });
          if (res.ok) {
            const html = await res.text();
            const match =
              html.match(/["']?x-fsign["']?\s*[:=]\s*["']([A-Za-z0-9_\-]{6,40})["']/i) ||
              html.match(/["']?fsign["']?\s*[:=]\s*["']([A-Za-z0-9_\-]{6,40})["']/i) ||
              html.match(/x-fsign["']?\s*:\s*["']([^"']+)["']/i);

            if (match && match[1]) {
              const discoveredToken = match[1].trim();
              if (discoveredToken && discoveredToken.length >= 6) {
                this.currentToken = discoveredToken;
                this.headers['x-fsign'] = this.currentToken;
                if (!this.tokenFallbackList.includes(discoveredToken)) {
                  this.tokenFallbackList.unshift(discoveredToken);
                }
                return this.currentToken;
              }
            }
          }
        } catch (_) {}
      }

      // If dynamic extraction yielded no new token, rotate to next verified fallback token
      this.rotateFallbackToken();
      return this.currentToken;
    })().finally(() => {
      this.tokenRefreshPromise = null;
    });

    return this.tokenRefreshPromise;
  }

  rotateFallbackToken() {
    this.fallbackIndex = (this.fallbackIndex + 1) % this.tokenFallbackList.length;
    this.currentToken = this.tokenFallbackList[this.fallbackIndex];
    this.headers['x-fsign'] = this.currentToken;
    const origin = this.getNextOrigin();
    this.headers['Origin'] = origin;
    this.headers['Referer'] = `${origin}/`;
  }

  async fetchWithRetry(url, customHeaders = {}, maxRetries = this.maxRetries, timeoutMs = this.timeoutMs) {
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const headers = {
          ...this.headers,
          'x-fsign': this.currentToken,
          ...customHeaders,
          'User-Agent': this.getNextUserAgent(),
          'Accept-Encoding': 'gzip, deflate'
        };
        const res = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(timeoutMs)
        });
        if (res.status === 403 || res.status === 401) {
          // Token rejected upstream: trigger dynamic token refresh & header rotation
          await this.refreshDynamicToken();
          throw new Error(`HTTP ${res.status} Forbidden (Signature Token Expired or Rejected)`);
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        return res;
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          const jitter = Math.floor(Math.random() * 180) + 70;
          const delay = 150 * Math.pow(2, attempt) + jitter;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  /**
   * Parse key÷value pairs separated by ¬
   */
  parseKeyValues(block) {
    const map = {};
    const parts = block.split('¬');
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const idx = part.indexOf('÷');
      if (idx !== -1) {
        const key = part.slice(0, idx);
        const val = part.slice(idx + 1);
        map[key] = val;
      }
    }
    return map;
  }

  /**
   * Fetch all today's & live matches from Flashscore feed
   */
  async fetchMainFeed() {
    const url = `${this.feedBaseUrl}/f_1_0_3_tr_1?_t=${Date.now()}`;
    const res = await this.fetchWithRetry(url);
    const text = await res.text();
    return this.parseMainFeedText(text);
  }

  formatKickoffTime(startTs) {
    if (!startTs || startTs <= 0) return '00:00';
    try {
      const d = new Date(startTs * 1000);
      return d.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/Istanbul'
      });
    } catch (_) {
      const d = new Date(startTs * 1000);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  }

  parseMainFeedText(text) {
    const matches = [];
    // Split by tournament headers ~ZA÷
    const sections = text.split('~ZA÷').slice(1);
    const nowSec = Math.floor(Date.now() / 1000);

    const FINISHED_STAGES = new Set([3, 10, 11, 37, 100]);
    const CANCELLED_STAGES = new Set([4, 5, 8, 9, 36, 43, 45, 46]);

    for (const sec of sections) {
      const matchBlocks = sec.split('~AA÷');
      const headerKv = this.parseKeyValues('ZA÷' + matchBlocks[0]);
      const leagueTitle = headerKv.ZA || 'Uluslararası Lig';
      const country = headerKv.ZY || headerKv.ZAF || 'Dünya';
      const leagueId = headerKv.ZEE || headerKv.ZC || leagueTitle;

      for (let i = 1; i < matchBlocks.length; i++) {
        const kv = this.parseKeyValues('AA÷' + matchBlocks[i]);
        const id = kv.AA;
        if (!id) continue;

        const statusRaw = parseInt(kv.AB || '1', 10); // 1=Sched, 2=Live, 3=Finished/Other
        const stageRaw = parseInt(kv.AC || '0', 10);  // 12=1st Half, 38=HT, 13=2nd Half, 3=FT, 9=Postponed
        const startTs = parseInt(kv.AD || '0', 10);
        const periodStartTs = parseInt(kv.AO || '0', 10);
        const bxMin = parseInt(kv.BX || '-1', 10);
        const kickoffTime = this.formatKickoffTime(startTs);

        let status = 'SCHEDULED';
        let statusText = kickoffTime;
        let minute = 0;

        if (CANCELLED_STAGES.has(stageRaw)) {
          status = 'POSTPONED';
          statusText = 'Ertelendi';
        } else if (statusRaw === 3 || FINISHED_STAGES.has(stageRaw)) {
          status = 'FT';
          statusText = 'Maç Sonu';
          minute = 90;
        } else if (statusRaw === 2) {
          status = 'LIVE';
          if (stageRaw === 38) {
            status = 'HT';
            statusText = 'Devre Arası';
            minute = 45;
          } else if (stageRaw === 12) {
            statusText = '1. Yarı';
            if (bxMin > 0 && bxMin <= 55) {
              minute = bxMin;
            } else if (periodStartTs > 0 && nowSec >= periodStartTs && (nowSec - periodStartTs) <= 3600) {
              minute = Math.max(1, Math.min(45, Math.floor((nowSec - periodStartTs) / 60) + 1));
            } else if (startTs > 0 && nowSec >= startTs) {
              minute = Math.max(1, Math.min(45, Math.floor((nowSec - startTs) / 60) + 1));
            } else {
              minute = 45;
            }
          } else if (stageRaw === 13) {
            statusText = '2. Yarı';
            if (bxMin >= 45 && bxMin <= 105) {
              minute = bxMin;
            } else if (periodStartTs > 0 && nowSec >= periodStartTs && (nowSec - periodStartTs) <= 4200) {
              minute = Math.max(46, Math.min(94, 45 + Math.floor((nowSec - periodStartTs) / 60) + 1));
            } else if (startTs > 0 && nowSec > startTs) {
              // 1st half (45m) + HT break & stoppage (~17m) = 62m offset from kickoff
              const elapsedTotal = Math.floor((nowSec - startTs) / 60);
              minute = Math.max(46, Math.min(94, elapsedTotal - 17));
            } else {
              minute = 90;
            }
          } else if (stageRaw === 6 || stageRaw === 7) {
            statusText = 'Uzatma';
            minute = bxMin > 90 ? bxMin : 95;
          } else {
            statusText = 'Canlı';
            if (bxMin > 0) {
              minute = bxMin;
            } else if (startTs > 0 && nowSec > startTs) {
              const elapsed = Math.floor((nowSec - startTs) / 60);
              minute = elapsed <= 48 ? Math.max(1, elapsed) : Math.max(46, Math.min(94, elapsed - 17));
            } else {
              minute = 45;
            }
          }

          // Safety auto-FT guard: if kickoff was >130 mins ago and not in Extra Time, mark FT
          if (startTs > 0 && (nowSec - startTs) > 7800 && stageRaw !== 6 && stageRaw !== 7) {
            status = 'FT';
            statusText = 'Maç Sonu';
            minute = 90;
          }
        }

        const homeScore = kv.AG !== undefined ? parseInt(kv.AG, 10) : 0;
        const awayScore = kv.AH !== undefined ? parseInt(kv.AH, 10) : 0;
        const htHomeScore = kv.AT !== undefined ? parseInt(kv.AT, 10) : (kv.BA !== undefined ? parseInt(kv.BA, 10) : 0);
        const htAwayScore = kv.AU !== undefined ? parseInt(kv.AU, 10) : (kv.BB !== undefined ? parseInt(kv.BB, 10) : 0);

        matches.push({
          source: 'flashscore',
          sourceId: id,
          matchId: `fs_${id}`,
          startTimestamp: startTs,
          kickoffTime,
          status,
          statusText,
          minute: isNaN(minute) ? 0 : minute,
          league: {
            id: leagueId,
            name: leagueTitle,
            country
          },
          home: {
            id: kv.PX || kv.WM || kv.AE,
            name: kv.AE || kv.CX || 'Ev Sahibi',
            shortName: kv.WM || (kv.AE || 'EV').slice(0, 3).toUpperCase(),
            logo: kv.OA && kv.OA.endsWith('.png') ? `https://static.flashscore.com/res/image/data/${kv.OA}` : null,
            score: isNaN(homeScore) ? 0 : homeScore,
            htScore: isNaN(htHomeScore) ? 0 : htHomeScore,
            redCards: parseInt(kv.GRA || '0', 10) || 0
          },
          away: {
            id: kv.PY || kv.WN || kv.AF,
            name: kv.AF || kv.FK || 'Deplasman',
            shortName: kv.WN || (kv.AF || 'DEP').slice(0, 3).toUpperCase(),
            logo: kv.OB && kv.OB.endsWith('.png') ? `https://static.flashscore.com/res/image/data/${kv.OB}` : null,
            score: isNaN(awayScore) ? 0 : awayScore,
            htScore: isNaN(htAwayScore) ? 0 : htAwayScore,
            redCards: parseInt(kv.GRB || '0', 10) || 0
          }
        });
      }
    }

    return matches;
  }

  /**
   * Fetch incidents (Goals, Assists, Disallowed Goals/VAR, Yellow/Red Cards, Subs) for a match
   * Endpoint: df_sui_1_<id>
   */
  async fetchMatchIncidents(fsId) {
    try {
      const url = `${this.feedBaseUrl}/df_sui_1_${fsId}?_t=${Date.now()}`;
      const res = await this.fetchWithRetry(url);
      const text = await res.text();
      if (!text || text.length < 15) return [];
      return this.parseIncidentsText(text);
    } catch (_) {
      return [];
    }
  }

  parseIncidentsText(text) {
    const incidents = [];
    const items = text.split('~III÷').slice(1);

    for (const item of items) {
      // One incident block may contain multiple sub-events (e.g. Goal + Assistance, or Sub In + Sub Out)
      const parts = item.split('¬');
      const id = parts[0];
      let teamSide = 'HOME';
      let minuteStr = '0';
      let homeScoreAfter = null;
      let awayScoreAfter = null;

      // Sub-entities inside the incident
      const entities = [];
      let currentEntity = {};

      for (let i = 1; i < parts.length; i++) {
        const p = parts[i];
        const idx = p.indexOf('÷');
        if (idx === -1) continue;
        const k = p.slice(0, idx);
        const v = p.slice(idx + 1);

        if (k === 'IA') {
          teamSide = v === '1' ? 'HOME' : 'AWAY';
        } else if (k === 'IB') {
          minuteStr = v.replace("'", '');
        } else if (k === 'INX') {
          homeScoreAfter = parseInt(v, 10);
        } else if (k === 'IOX') {
          awayScoreAfter = parseInt(v, 10);
        } else if (k === 'IE') {
          if (currentEntity.typeCode) entities.push(currentEntity);
          currentEntity = { typeCode: v };
        } else if (k === 'IF') {
          currentEntity.playerName = v;
        } else if (k === 'IK') {
          currentEntity.label = v;
        } else if (k === 'IM') {
          currentEntity.playerId = v;
        } else if (k === 'ICT') {
          currentEntity.comment = v;
        }
      }
      if (currentEntity.typeCode || currentEntity.label) {
        entities.push(currentEntity);
      }

      const minute = parseInt(minuteStr.split('+')[0], 10) || 0;
      const addedTime = minuteStr.includes('+') ? (parseInt(minuteStr.split('+')[1], 10) || 0) : 0;

      const primary = entities[0] || {};
      const secondary = entities[1] || null;
      const labelLower = (primary.label || '').toLowerCase();
      const commentLower = (primary.comment || '').toLowerCase();

      const fullText = `${labelLower} ${commentLower}`;
      const isDisallowedText =
        fullText.includes('disallowed') ||
        fullText.includes('overturned') ||
        fullText.includes('no goal') ||
        fullText.includes('iptal edildi') ||
        fullText.includes('gol iptal') ||
        fullText.includes('goal cancelled') ||
        fullText.includes('goal canceled');

      const isConfirmedOrValid =
        fullText.includes('confirmed') ||
        fullText.includes('awarded') ||
        fullText.includes('stands') ||
        fullText.includes('valid') ||
        fullText.includes('onaylandı') ||
        fullText.includes('onaylandi') ||
        fullText.includes('geçerli') ||
        fullText.includes('gecerli');

      let eventType = 'OTHER';
      if (isDisallowedText && !isConfirmedOrValid) {
        eventType = 'GOAL_DISALLOWED';
      } else if (labelLower.includes('goal') || labelLower.includes('gol') || primary.typeCode === '3' || primary.typeCode === '4') {
        eventType = 'GOAL';
      } else if (primary.typeCode === '1' || labelLower.includes('yellow card') || labelLower.includes('sarı kart') || (labelLower.includes('yellow') && labelLower.includes('card'))) {
        eventType = 'YELLOW_CARD';
      } else if (primary.typeCode === '2' || labelLower.includes('red card') || labelLower.includes('kırmızı kart') || (labelLower.includes('red') && labelLower.includes('card'))) {
        eventType = 'RED_CARD';
      } else if (labelLower.includes('substitution') || labelLower.includes('değişiklik') || primary.typeCode === '6' || primary.typeCode === '7') {
        eventType = 'SUBSTITUTION';
      }

      let playerIn = null;
      let playerOut = null;
      let playerInId = null;
      let playerOutId = null;

      if (eventType === 'SUBSTITUTION') {
        const inEntity = entities.find(e => {
          const lbl = `${e.label || ''} ${e.comment || ''}`.toLowerCase();
          return lbl.includes(' in') || lbl.includes('(in)') || lbl.includes('giren') || lbl.startsWith('in');
        });
        const outEntity = entities.find(e => {
          const lbl = `${e.label || ''} ${e.comment || ''}`.toLowerCase();
          return lbl.includes(' out') || lbl.includes('(out)') || lbl.includes('çıkan') || lbl.includes('cikan') || lbl.startsWith('out');
        });

        if (inEntity && outEntity) {
          playerIn = inEntity.playerName || '';
          playerInId = inEntity.playerId || null;
          playerOut = outEntity.playerName || '';
          playerOutId = outEntity.playerId || null;
        } else if (entities.length >= 2) {
          playerIn = entities[0]?.playerName || '';
          playerInId = entities[0]?.playerId || null;
          playerOut = entities[1]?.playerName || '';
          playerOutId = entities[1]?.playerId || null;
        } else {
          playerIn = primary.playerName || '';
          playerInId = primary.playerId || null;
          playerOut = '';
        }
      }

      const assistPlayer = secondary && (
        (secondary.label || '').toLowerCase().includes('assist') ||
        secondary.typeCode === '8'
      ) ? secondary.playerName : null;

      const anyPlayer = entities.find(e => e.playerName && e.playerName.trim())?.playerName;
      const finalPlayerName = primary.playerName || anyPlayer || '';
      const isSub = eventType === 'SUBSTITUTION';
      const eventPlayerName = isSub ? (playerIn || finalPlayerName) : finalPlayerName;
      const eventPlayerId = isSub ? (playerInId || primary.playerId) : (primary.playerId || null);

      incidents.push({
        id: `fs_inc_${id}`,
        eventType,
        minute,
        addedTime,
        team: teamSide,
        playerName: eventPlayerName,
        playerId: eventPlayerId,
        assistPlayerName: assistPlayer,
        playerIn: isSub ? (playerIn || finalPlayerName) : null,
        playerOut: isSub ? (playerOut || null) : null,
        playerInId: isSub ? (playerInId || null) : null,
        playerOutId: isSub ? (playerOutId || null) : null,
        subIn: isSub ? (playerIn || finalPlayerName) : null,
        subOut: isSub ? (playerOut || null) : null,
        reason: primary.comment || primary.label || (eventType === 'GOAL_DISALLOWED' ? 'Gol iptal edildi' : (isSub ? 'Oyuncu Değişikliği' : '')),
        homeScore: homeScoreAfter,
        awayScore: awayScoreAfter
      });
    }

    return incidents;
  }

  /**
   * Fetch detailed match statistics (Match, 1st Half, 2nd Half)
   * Endpoint: df_st_1_<id>
   */
  async fetchMatchStats(fsId) {
    try {
      const url = `${this.feedBaseUrl}/df_st_1_${fsId}?_t=${Date.now()}`;
      const res = await this.fetchWithRetry(url);
      const text = await res.text();
      if (!text || text.length < 15) return null;
      return this.parseStatsText(text);
    } catch (_) {
      return null;
    }
  }

  parseStatsText(text) {
    if (!text) return null;
    // Flashscore feed divides sections with SE÷ (first section) and ~SE÷ (subsequent)
    const periodSections = text.split(/~?SE÷/).map(s => s.trim()).filter(Boolean);
    if (periodSections.length === 0) {
      return this._parseStatSection(text);
    }

    let fullMatch = null;
    let half1 = null;
    let half2 = null;

    for (const sec of periodSections) {
      const headerEnd = sec.indexOf('¬');
      const periodName = (headerEnd !== -1 ? sec.slice(0, headerEnd) : sec.slice(0, 30)).toLowerCase();
      const parsed = this._parseStatSection(sec);

      if (periodName.includes('match') || periodName.includes('maç')) {
        fullMatch = parsed;
      } else if (periodName.includes('1st') || periodName.includes('1.') || periodName.includes('ilk')) {
        half1 = parsed;
      } else if (periodName.includes('2nd') || periodName.includes('2.') || periodName.includes('ikinci')) {
        half2 = parsed;
      }
    }

    const result = fullMatch || half1 || this._parseStatSection(periodSections[0]);
    result.half1 = half1;
    result.half2 = half2;
    return result;
  }

  _parseStatSection(sectionText) {
    const stats = {
      home: {
        possession: 50,
        totalShots: 0,
        shotsOnTarget: 0,
        shotsOffTarget: 0,
        blockedShots: 0,
        shotsInsideBox: 0,
        shotsOutsideBox: 0,
        bigChances: 0,
        woodwork: 0,
        corners: 0,
        fouls: 0,
        yellowCards: 0,
        redCards: 0,
        offsides: 0,
        freeKicks: 0,
        touchesInBox: 0,
        saves: 0,
        goalkeeperSaves: 0,
        passesCompleted: 0,
        passesTotal: 0,
        passAccuracy: 0,
        dangerousAttacks: 0,
        attacks: 0,
        substitutions: 0,
        xg: 0,
        xgot: 0,
        xa: 0
      },
      away: {
        possession: 50,
        totalShots: 0,
        shotsOnTarget: 0,
        shotsOffTarget: 0,
        blockedShots: 0,
        shotsInsideBox: 0,
        shotsOutsideBox: 0,
        bigChances: 0,
        woodwork: 0,
        corners: 0,
        fouls: 0,
        yellowCards: 0,
        redCards: 0,
        offsides: 0,
        freeKicks: 0,
        touchesInBox: 0,
        saves: 0,
        goalkeeperSaves: 0,
        passesCompleted: 0,
        passesTotal: 0,
        passAccuracy: 0,
        dangerousAttacks: 0,
        attacks: 0,
        substitutions: 0,
        xg: 0,
        xgot: 0,
        xa: 0
      }
    };

    const items = sectionText.split('~SD÷').slice(1);
    const parseNum = (str) => {
      if (!str) return 0;
      const clean = String(str).replace('%', '').trim();
      const val = parseFloat(clean);
      return isNaN(val) ? 0 : val;
    };

    for (const item of items) {
      const kv = this.parseKeyValues('SD÷' + item);
      const name = (kv.SG || '').toLowerCase();
      const hVal = parseNum(kv.SH);
      const aVal = parseNum(kv.SI);

      if (name.includes('expected goals') || kv.SD === '432') {
        stats.home.xg = hVal;
        stats.away.xg = aVal;
      } else if (name.includes('xg on target') || kv.SD === '499') {
        stats.home.xgot = hVal;
        stats.away.xgot = aVal;
      } else if (name.includes('expected assists') || kv.SD === '503') {
        stats.home.xa = hVal;
        stats.away.xa = aVal;
      } else if (name.includes('possession') || kv.SD === '12') {
        stats.home.possession = hVal;
        stats.away.possession = aVal;
      } else if (name.includes('total shots') || name === 'goal attempts' || kv.SD === '34') {
        stats.home.totalShots = hVal;
        stats.away.totalShots = aVal;
      } else if (name.includes('shots on target') || name.includes('shots on goal') || kv.SD === '13') {
        stats.home.shotsOnTarget = hVal;
        stats.away.shotsOnTarget = aVal;
      } else if (name.includes('shots off target') || name.includes('shots off goal') || kv.SD === '14') {
        stats.home.shotsOffTarget = hVal;
        stats.away.shotsOffTarget = aVal;
      } else if (name.includes('blocked shots') || kv.SD === '158') {
        stats.home.blockedShots = hVal;
        stats.away.blockedShots = aVal;
      } else if (name.includes('shots inside') || kv.SD === '461') {
        stats.home.shotsInsideBox = hVal;
        stats.away.shotsInsideBox = aVal;
      } else if (name.includes('shots outside') || kv.SD === '463') {
        stats.home.shotsOutsideBox = hVal;
        stats.away.shotsOutsideBox = aVal;
      } else if (name.includes('big chances') || kv.SD === '459') {
        stats.home.bigChances = hVal;
        stats.away.bigChances = aVal;
      } else if (name.includes('woodwork') || kv.SD === '457') {
        stats.home.woodwork = hVal;
        stats.away.woodwork = aVal;
      } else if (name.includes('corner') || kv.SD === '16') {
        stats.home.corners = hVal;
        stats.away.corners = aVal;
      } else if (name.includes('fouls') || kv.SD === '21') {
        stats.home.fouls = hVal;
        stats.away.fouls = aVal;
      } else if (name.includes('yellow cards') || kv.SD === '23') {
        stats.home.yellowCards = hVal;
        stats.away.yellowCards = aVal;
      } else if (name.includes('red cards') || kv.SD === '24') {
        stats.home.redCards = hVal;
        stats.away.redCards = aVal;
      } else if (name.includes('offsides') || kv.SD === '17') {
        stats.home.offsides = hVal;
        stats.away.offsides = aVal;
      } else if (name.includes('free kicks') || kv.SD === '15') {
        stats.home.freeKicks = hVal;
        stats.away.freeKicks = aVal;
      } else if (name.includes('touches in opposition box') || kv.SD === '471') {
        stats.home.touchesInBox = hVal;
        stats.away.touchesInBox = aVal;
      } else if (name.includes('saves') || kv.SD === '19') {
        stats.home.saves = hVal;
        stats.home.goalkeeperSaves = hVal;
        stats.away.saves = aVal;
        stats.away.goalkeeperSaves = aVal;
      } else if (name.includes('dangerous attack') || name.includes('tehlikeli atak') || kv.SD === '36' || kv.SD === '43') {
        stats.home.dangerousAttacks = hVal;
        stats.away.dangerousAttacks = aVal;
      } else if (name === 'attacks' || name.includes('ataklar') || name.includes('hücum') || kv.SD === '35' || kv.SD === '42') {
        stats.home.attacks = hVal;
        stats.away.attacks = aVal;
      } else if (name.includes('substitution') || name.includes('oyuncu değişikliği') || name.includes('degisiklik') || kv.SD === '22') {
        stats.home.substitutions = hVal;
        stats.away.substitutions = aVal;
      } else if (name.includes('passes') || name.includes('paslar') || name.includes('pas') || kv.SD === '25' || kv.SD === '436' || kv.SD === '437') {
        const parsePassSide = (rawVal, side) => {
          if (!rawVal) return;
          const str = String(rawVal).trim();
          if (str.includes('/')) {
            const parts = str.split('/');
            const comp = parseFloat(parts[0]) || 0;
            const tot = parseFloat(parts[1]) || 0;
            stats[side].passesCompleted = comp;
            stats[side].passesTotal = tot;
            if (tot > 0) stats[side].passAccuracy = Math.round((comp / tot) * 100);
          } else if (str.endsWith('%') || name.includes('accuracy') || name.includes('yüzde') || kv.SD === '437') {
            stats[side].passAccuracy = parseNum(str);
          } else if (name.includes('completed') || name.includes('isabetli') || kv.SD === '436') {
            stats[side].passesCompleted = parseNum(str);
          } else {
            stats[side].passesTotal = parseNum(str);
          }
        };
        parsePassSide(kv.SH, 'home');
        parsePassSide(kv.SI, 'away');
      }
    }

    // Ensure totalShots consistency if provider only gave on+off+blocked or total+on
    for (const side of ['home', 'away']) {
      const s = stats[side];
      if (s.totalShots === 0 && (s.shotsOnTarget > 0 || s.shotsOffTarget > 0)) {
        s.totalShots = s.shotsOnTarget + s.shotsOffTarget + s.blockedShots;
      } else if (s.totalShots > 0 && s.shotsOffTarget === 0 && s.totalShots > s.shotsOnTarget + s.blockedShots) {
        s.shotsOffTarget = s.totalShots - s.shotsOnTarget - s.blockedShots;
      }
      if (!s.passAccuracy && s.passesTotal > 0 && s.passesCompleted > 0) {
        s.passAccuracy = Math.round((s.passesCompleted / s.passesTotal) * 100);
      }
      s.goalkeeperSaves = s.saves;
    }

    return stats;
  }

  /**
   * Fetch live & pre-match odds from Flashscore GraphQL API
   * Markets covered: 1X2 (FT & HT), Over/Under (FT & HT), BTTS (FT & HT)
   */
  async fetchMatchOdds(fsId) {
    try {
      const url = `${this.oddsGraphQlUrl}?_hash=oce&eventId=${fsId}&projectId=2&geoIpCode=TR&geoIpSubdivisionCode=TR34&_t=${Date.now()}`;
      const res = await this.fetchWithRetry(url);
      const json = await res.json();
      const list = json?.data?.findOddsByEventId?.odds;
      if (!Array.isArray(list) || list.length === 0) return null;

    const parsed = {
      ms1: null, msX: null, ms2: null,
      openMs1: null, openMsX: null, openMs2: null,
      ht1: null, htX: null, ht2: null,
      bttsYes: null, bttsNo: null,
      htBttsYes: null, htBttsNo: null,
      ouLines: {},   // e.g. { '2.5': { over: 1.85, under: 1.95, openOver: 1.90, openUnder: 1.90 } }
      htOuLines: {}, // e.g. { '0.5': { over: 1.42, under: 2.75 } }
      suspended: false
    };

    for (const entry of list) {
      const type = entry.bettingType;
      const scope = entry.bettingScope;
      const items = entry.odds || [];
      if (!Array.isArray(items) || items.length === 0) continue;

      const isFtScope = scope === 'FULL_TIME' || scope === 'ORDINARY_TIME' || scope === 'REGULAR_TIME';
      const isHtScope = scope === 'FIRST_HALF' || scope === '1ST_HALF';

      if (type === 'HOME_DRAW_AWAY') {
        const isDraw = (i) => i.eventParticipantId === null || i.selection === 'X' || i.selection === 'DRAW' || String(i.name || '').toLowerCase() === 'draw' || String(i.label || '').toLowerCase() === 'beraberlik' || String(i.label || '').toLowerCase() === 'x';
        const isHome = (i) => i.selection === '1' || i.selection === 'HOME' || String(i.name || '').toLowerCase() === 'home' || String(i.label || '') === '1';
        const isAway = (i) => i.selection === '2' || i.selection === 'AWAY' || String(i.name || '').toLowerCase() === 'away' || String(i.label || '') === '2';

        const drawItem = items.find(isDraw) || (items.length >= 3 ? items[1] : null);
        const nonDrawItems = items.filter(i => i !== drawItem);
        const homeItem = items.find(isHome) || nonDrawItems[0] || items[0];
        const awayItem = items.find(isAway) || nonDrawItems[1] || items[2] || items[1];

        if (isFtScope && !parsed.ms1 && items.length >= 3) {
          parsed.ms1 = parseFloat(homeItem?.value) || null;
          parsed.msX = parseFloat(drawItem?.value) || null;
          parsed.ms2 = parseFloat(awayItem?.value) || null;
          parsed.openMs1 = parseFloat(homeItem?.opening) || parsed.ms1;
          parsed.openMsX = parseFloat(drawItem?.opening) || parsed.msX;
          parsed.openMs2 = parseFloat(awayItem?.opening) || parsed.ms2;
          if (homeItem?.active === false && awayItem?.active === false) {
            parsed.suspended = true;
          }
        } else if (isHtScope && !parsed.ht1 && items.length >= 3) {
          parsed.ht1 = parseFloat(homeItem?.value) || null;
          parsed.htX = parseFloat(drawItem?.value) || null;
          parsed.ht2 = parseFloat(awayItem?.value) || null;
        }
      } else if (type === 'BOTH_TEAMS_TO_SCORE') {
        const isYes = (i) => i.bothTeamsToScore === true || i.selection === 'YES' || String(i.name || '').toLowerCase() === 'yes' || String(i.label || '').toLowerCase() === 'evet' || String(i.choice || '').toLowerCase() === 'yes';
        const isNo = (i) => i.bothTeamsToScore === false || i.selection === 'NO' || String(i.name || '').toLowerCase() === 'no' || String(i.label || '').toLowerCase() === 'hayır' || String(i.label || '').toLowerCase() === 'hayir' || String(i.choice || '').toLowerCase() === 'no';

        const yesItem = items.find(isYes) || items[0];
        const noItem = items.find(isNo) || items[1];

        if (isFtScope && !parsed.bttsYes && items.length >= 2) {
          parsed.bttsYes = parseFloat(yesItem?.value) || null;
          parsed.bttsNo = parseFloat(noItem?.value) || null;
        } else if (isHtScope && !parsed.htBttsYes && items.length >= 2) {
          parsed.htBttsYes = parseFloat(yesItem?.value) || null;
          parsed.htBttsNo = parseFloat(noItem?.value) || null;
        }
      } else if (type === 'OVER_UNDER' && (isFtScope || isHtScope)) {
        const targetMap = isFtScope ? parsed.ouLines : parsed.htOuLines;
        for (const item of items) {
          const rawLine = item.handicap?.value ?? item.handicapValue ?? item.handicap ?? item.line ?? item.total;
          if (rawLine === undefined || rawLine === null) continue;
          const line = String(parseFloat(rawLine) || rawLine).trim();
          if (!line) continue;
          if (!targetMap[line]) targetMap[line] = {};

          const sel = String(item.selection || item.choice || item.name || item.label || '').toUpperCase();
          const val = parseFloat(item.value);
          const openVal = parseFloat(item.opening) || val;
          if (!val) continue;

          const isOver = sel.includes('OVER') || sel === 'O' || sel.includes('ÜST') || sel === '1';
          const isUnder = sel.includes('UNDER') || sel === 'U' || sel.includes('ALT') || sel === '2';

          if (isOver || (!isUnder && !targetMap[line].over)) {
            targetMap[line].over = val;
            targetMap[line].openOver = openVal;
          } else {
            targetMap[line].under = val;
            targetMap[line].openUnder = openVal;
          }
        }
      } else if (type === 'NEXT_GOAL' && isFtScope) {
        for (const item of items) {
          const sel = String(item.selection || item.name || '').toUpperCase();
          const val = parseFloat(item.value);
          if (!val) continue;
          if (sel === '1' || sel.includes('HOME')) parsed.nextGoalHome = val;
          else if (sel === 'X' || sel.includes('NO') || sel.includes('NONE')) parsed.nextGoalNo = val;
          else if (sel === '2' || sel.includes('AWAY')) parsed.nextGoalAway = val;
        }
      }
    }

    return parsed;
    } catch (_) {
      return null;
    }
  }
}

module.exports = FlashscoreScraper;
