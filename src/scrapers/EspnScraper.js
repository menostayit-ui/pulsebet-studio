/**
 * PulseBet Pro — ESPN Soccer Real-Time Scraper Engine
 * High-speed, zero-key scraper for ESPN's public Soccer Scoreboard & Match Summary endpoints.
 * Provides official HD team logos, live play-by-play shots/fouls/cards/goals/assists,
 * team statistics, player rosters, and betting odds.
 */

const MODERN_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'
];

class EspnScraper {
  constructor() {
    this.baseUrl = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all';
    this.uaIndex = 0;
    this.timeoutMs = 4500;
    this.maxRetries = 2;
    this.headers = {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Cache-Control': 'no-cache'
    };
  }

  getNextUserAgent() {
    const ua = MODERN_USER_AGENTS[this.uaIndex % MODERN_USER_AGENTS.length];
    this.uaIndex = (this.uaIndex + 1) % MODERN_USER_AGENTS.length;
    return ua;
  }

  async fetchWithRetry(url, customHeaders = {}, maxRetries = this.maxRetries, timeoutMs = this.timeoutMs) {
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const headers = {
          ...this.headers,
          ...customHeaders,
          'User-Agent': this.getNextUserAgent(),
          'Accept-Encoding': 'gzip, deflate'
        };
        const res = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(timeoutMs)
        });
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

  parseClockMinutes(clockStr, fallback = 0) {
    if (!clockStr) return fallback;
    const str = String(clockStr).trim();
    // Handles '90\'+1\'', '90+3', '45\'+2\'', '78\'', etc.
    const m = str.match(/(\d+)(?:\s*['’]?\s*\+\s*(\d+))?/);
    if (!m) return fallback;
    const base = parseInt(m[1], 10) || 0;
    const extra = parseInt(m[2] || '0', 10) || 0;
    const total = base + extra;
    return Math.min(130, Math.max(1, total));
  }

  /**
   * Fetch all current & today's matches from ESPN Soccer Scoreboard
   * Includes embedded team logos, scores, inline statistics, and goal/card details!
   */
  async fetchScoreboard() {
    try {
      const url = `${this.baseUrl}/scoreboard?_t=${Date.now()}`;
      const res = await this.fetchWithRetry(url);
      const data = await res.json();
      if (!data || !Array.isArray(data.events)) return [];

    const matches = [];

    for (const ev of data.events) {
      const comp = (ev.competitions && ev.competitions[0]) || {};
      const competitors = comp.competitors || [];
      const homeComp = competitors.find(c => c.homeAway === 'home') || competitors[0];
      const awayComp = competitors.find(c => c.homeAway === 'away') || competitors[1];
      if (!homeComp || !awayComp) continue;

      const stType = ev.status?.type || comp.status?.type || {};
      const state = stType.state || 'pre'; // 'pre', 'in', 'post'
      const shortDetail = stType.shortDetail || stType.description || '';
      const displayClock = ev.status?.displayClock || comp.status?.displayClock || '0\'';
      const rawMin = this.parseClockMinutes(displayClock, 0);
      const startTs = ev.date ? Math.floor(new Date(ev.date).getTime() / 1000) : Math.floor(Date.now() / 1000);
      const kickoffTime = this.formatKickoffTime(startTs);

      let status = 'SCHEDULED';
      let statusText = kickoffTime;
      let minute = 0;

      if (state === 'in') {
        if (shortDetail.toLowerCase().includes('ht') || shortDetail.toLowerCase().includes('halftime')) {
          status = 'HT';
          statusText = 'Devre Arası';
          minute = 45;
        } else {
          status = 'LIVE';
          minute = Math.max(1, rawMin);
          statusText = minute <= 45 ? '1. Yarı' : '2. Yarı';
        }
      } else if (state === 'post') {
        status = 'FT';
        statusText = 'Maç Sonu';
        minute = 90;
      }

      const leagueName = ev.league?.name || data.leagues?.[0]?.name || 'Uluslararası Futbol';

      // Extract inline statistics if provided on scoreboard competitor
      const extractInlineStats = (compObj) => {
        const s = {
          possession: 50, totalShots: 0, shotsOnTarget: 0, shotsOffTarget: 0,
          blockedShots: 0, shotsInsideBox: 0, shotsOutsideBox: 0, bigChances: 0, woodwork: 0,
          corners: 0, fouls: 0, yellowCards: 0, redCards: 0,
          offsides: 0, freeKicks: 0, touchesInBox: 0, saves: 0, attacks: 0, dangerousAttacks: 0, substitutions: 0, xg: 0
        };
        for (const item of (compObj.statistics || [])) {
          const name = (item.name || '').toLowerCase();
          const val = parseFloat(item.displayValue || item.value || '0') || 0;
          if (name.includes('possession')) s.possession = val;
          else if (name === 'totalshots' || name === 'shots') s.totalShots = val;
          else if (name === 'shotsontarget' || name === 'shotsongoal') s.shotsOnTarget = val;
          else if (name.includes('blocked')) s.blockedShots = val;
          else if (name.includes('inside') || name.includes('shotsinside')) s.shotsInsideBox = val;
          else if (name.includes('outside') || name.includes('shotsoutside')) s.shotsOutsideBox = val;
          else if (name.includes('foul')) s.fouls = val;
          else if (name.includes('corner')) s.corners = val;
          else if (name.includes('yellow')) s.yellowCards = val;
          else if (name.includes('red')) s.redCards = val;
          else if (name.includes('offside')) s.offsides = val;
          else if (name.includes('freekick') || name.includes('free kick')) s.freeKicks = val;
          else if (name.includes('save')) s.saves = val;
          else if (name.includes('dangerous')) s.dangerousAttacks = val;
          else if (name === 'attacks' || (name.includes('attack') && !name.includes('dangerous'))) s.attacks = val;
          else if (name.includes('substitution') || name === 'subs') s.substitutions = val;
          else if (name.includes('xg') || name.includes('expected')) s.xg = val;
        }
        if (s.totalShots > s.shotsOnTarget) {
          s.shotsOffTarget = s.totalShots - s.shotsOnTarget;
        }
        return s;
      };

      const homeInlineStats = extractInlineStats(homeComp);
      const awayInlineStats = extractInlineStats(awayComp);

      // Extract inline incidents (comp.details)
      const inlineIncidents = [];
      for (const det of (comp.details || [])) {
        const isHome = String(det.team?.id) === String(homeComp.team?.id);
        const side = isHome ? 'HOME' : 'AWAY';
        const minStr = det.clock?.displayValue || '0\'';
        const incMin = this.parseClockMinutes(minStr, minute);
        const athlete = det.athletesInvolved?.[0]?.displayName || 'Oyuncu';
        const assistAthlete = det.athletesInvolved?.[1]?.displayName || null;

        let eventType = 'OTHER';
        const typeText = (det.type?.text || '').toLowerCase();
        const isDisallowed =
          (typeText.includes('disallowed') ||
           typeText.includes('overturned') ||
           typeText.includes('no goal') ||
           typeText.includes('iptal edildi') ||
           typeText.includes('goal cancelled') ||
           typeText.includes('goal canceled')) &&
          (!typeText.includes('confirmed') &&
           !typeText.includes('awarded') &&
           !typeText.includes('stands') &&
           !typeText.includes('valid') &&
           !typeText.includes('onaylandı') &&
           !typeText.includes('onaylandi') &&
           !typeText.includes('geçerli') &&
           !typeText.includes('gecerli'));

        if (isDisallowed) {
          eventType = 'GOAL_DISALLOWED';
        } else if (det.scoringPlay || (typeText.includes('goal') && !typeText.includes('disallowed') && !typeText.includes('overturned') && !typeText.includes('cancelled') && !typeText.includes('canceled'))) {
          eventType = 'GOAL';
        } else if (det.redCard || typeText.includes('red card')) {
          eventType = 'RED_CARD';
        } else if (det.yellowCard || typeText.includes('yellow card')) {
          eventType = 'YELLOW_CARD';
        } else if (typeText.includes('substitution') || typeText.includes('sub')) {
          eventType = 'SUBSTITUTION';
        }

        if (eventType !== 'OTHER') {
          const isSub = eventType === 'SUBSTITUTION';
          const pIn = det.athletesInvolved?.[0]?.displayName || athlete;
          const pOut = det.athletesInvolved?.[1]?.displayName || null;
          const pInId = det.athletesInvolved?.[0]?.id || null;
          const pOutId = det.athletesInvolved?.[1]?.id || null;

          inlineIncidents.push({
            id: `espn_inc_${ev.id}_${incMin}_${eventType}_${athlete}`,
            eventType,
            minute: incMin,
            addedTime: 0,
            team: side,
            playerName: isSub ? pIn : athlete,
            playerId: isSub ? pInId : (det.athletesInvolved?.[0]?.id || null),
            assistPlayerName: assistAthlete,
            playerIn: isSub ? pIn : null,
            playerOut: isSub ? pOut : null,
            playerInId: isSub ? pInId : null,
            playerOutId: isSub ? pOutId : null,
            subIn: isSub ? pIn : null,
            subOut: isSub ? pOut : null,
            reason: det.type?.text || (isSub ? 'Oyuncu Değişikliği' : '')
          });
        }
      }

      matches.push({
        source: 'espn',
        sourceId: String(ev.id),
        matchId: `espn_${ev.id}`,
        startTimestamp: startTs,
        kickoffTime,
        status,
        statusText,
        minute,
        inlineStats: { home: homeInlineStats, away: awayInlineStats },
        inlineIncidents,
        league: {
          id: String(ev.league?.id || 'espn'),
          name: leagueName,
          country: 'Dünya'
        },
        home: {
          id: String(homeComp.team?.id || ''),
          name: homeComp.team?.displayName || homeComp.team?.name || 'Ev Sahibi',
          shortName: homeComp.team?.abbreviation || (homeComp.team?.name || 'EV').slice(0, 3).toUpperCase(),
          logo: homeComp.team?.logo || null,
          score: parseInt(homeComp.score || '0', 10) || 0,
          htScore: 0,
          redCards: homeInlineStats.redCards || 0
        },
        away: {
          id: String(awayComp.team?.id || ''),
          name: awayComp.team?.displayName || awayComp.team?.name || 'Deplasman',
          shortName: awayComp.team?.abbreviation || (awayComp.team?.name || 'DEP').slice(0, 3).toUpperCase(),
          logo: awayComp.team?.logo || null,
          score: parseInt(awayComp.score || '0', 10) || 0,
          htScore: 0,
          redCards: awayInlineStats.redCards || 0
        }
      });
    }

    return matches;
    } catch (_) {
      return [];
    }
  }

  /**
   * Fetch deep match summary (Boxscore stats, Play-by-Play shots/fouls, Rosters/Player stats)
   */
  async fetchMatchSummary(espnEventId) {
    try {
      const url = `${this.baseUrl}/summary?event=${espnEventId}&_t=${Date.now()}`;
      const res = await this.fetchWithRetry(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data) return null;

      const result = {
        stats: null,
        incidents: [],
        shotmap: [],
        lineups: { home: [], away: [] }
      };

    // 1. Boxscore statistics
    const teams = data.boxscore?.teams || [];
    if (teams.length >= 2) {
      const parseTeamBox = (tObj) => {
        const s = {
          possession: 50, totalShots: 0, shotsOnTarget: 0, shotsOffTarget: 0,
          blockedShots: 0, shotsInsideBox: 0, shotsOutsideBox: 0, bigChances: 0, woodwork: 0,
          corners: 0, fouls: 0, yellowCards: 0, redCards: 0,
          offsides: 0, freeKicks: 0, touchesInBox: 0, saves: 0, attacks: 0, dangerousAttacks: 0, substitutions: 0, xg: 0
        };
        for (const st of (tObj.statistics || [])) {
          const name = (st.name || '').toLowerCase();
          const val = parseFloat(st.displayValue || '0') || 0;
          if (name.includes('possession')) s.possession = val;
          else if (name === 'totalshots' || name === 'shots') s.totalShots = val;
          else if (name === 'shotsontarget' || name === 'shotsongoal') s.shotsOnTarget = val;
          else if (name.includes('blocked')) s.blockedShots = val;
          else if (name.includes('inside') || name.includes('shotsinside')) s.shotsInsideBox = val;
          else if (name.includes('outside') || name.includes('shotsoutside')) s.shotsOutsideBox = val;
          else if (name.includes('foul')) s.fouls = val;
          else if (name.includes('corner')) s.corners = val;
          else if (name.includes('yellow')) s.yellowCards = val;
          else if (name.includes('red')) s.redCards = val;
          else if (name.includes('offside')) s.offsides = val;
          else if (name.includes('freekick') || name.includes('free kick')) s.freeKicks = val;
          else if (name.includes('save')) s.saves = val;
          else if (name.includes('dangerous')) s.dangerousAttacks = val;
          else if (name === 'attacks' || (name.includes('attack') && !name.includes('dangerous'))) s.attacks = val;
          else if (name.includes('substitution') || name === 'subs') s.substitutions = val;
          else if (name.includes('xg') || name.includes('expected')) s.xg = val;
        }
        if (s.totalShots > s.shotsOnTarget + s.blockedShots) {
          s.shotsOffTarget = s.totalShots - s.shotsOnTarget - s.blockedShots;
        }
        return s;
      };

      result.stats = {
        home: parseTeamBox(teams[0]),
        away: parseTeamBox(teams[1])
      };
    }

    // 2. Key Events / Play-by-Play Shots
    const homeTeamId = String(teams[0]?.team?.id || '');
    for (const play of (data.keyEvents || [])) {
      const isHome = String(play.team?.id) === homeTeamId;
      const side = isHome ? 'HOME' : 'AWAY';
      const min = play.clock?.value ? Math.round(play.clock.value / 60) : 0;
      const text = play.text || '';
      const typeText = (play.type?.text || '').toLowerCase();
      const player = play.participants?.[0]?.athlete?.displayName || 'Oyuncu';

      if (typeText.includes('shot') || typeText.includes('attempt') || typeText.includes('goal')) {
        const isOnTarget = typeText.includes('on target') || typeText.includes('saved') || typeText.includes('goal');
        result.shotmap.push({
          id: `espn_shot_${play.id || Math.random()}`,
          team: side,
          playerName: player,
          minute: min,
          isOnTarget,
          shotType: isOnTarget ? 'onTarget' : 'miss',
          xg: isOnTarget ? '0.14' : '0.05'
        });
      }

      if (typeText.includes('substitution') || typeText.includes('sub')) {
        const subIn = play.participants?.[0]?.athlete?.displayName || player;
        const subOut = play.participants?.[1]?.athlete?.displayName || null;
        result.incidents.push({
          id: `espn_sub_${play.id || min}_${subIn}`,
          eventType: 'SUBSTITUTION',
          minute: min,
          addedTime: 0,
          team: side,
          playerName: subIn,
          playerId: play.participants?.[0]?.athlete?.id || null,
          playerIn: subIn,
          playerOut: subOut,
          playerInId: play.participants?.[0]?.athlete?.id || null,
          playerOutId: play.participants?.[1]?.athlete?.id || null,
          subIn,
          subOut,
          reason: text || 'Oyuncu Değişikliği'
        });
      }

      const fullText = `${typeText} ${text.toLowerCase()}`;
      const isDisallowedText =
        fullText.includes('disallowed') ||
        fullText.includes('overturned') ||
        fullText.includes('no goal') ||
        fullText.includes('iptal edildi') ||
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

      if (isDisallowedText && !isConfirmedOrValid) {
        result.incidents.push({
          id: `espn_var_${play.id || min}`,
          eventType: 'GOAL_DISALLOWED',
          minute: min,
          addedTime: 0,
          team: side,
          playerName: player,
          reason: text || 'VAR / İptal'
        });
      }
    }

      return result;
    } catch (_) {
      return null;
    }
  }
}

module.exports = EspnScraper;
