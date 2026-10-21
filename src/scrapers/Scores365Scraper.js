/**
 * PulseBet Pro — 365Scores Real-Time Scraper Engine
 * High-speed secondary/tertiary source for live scores & detailed shot/foul stats.
 */

const MODERN_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'
];

class Scores365Scraper {
  constructor() {
    this.baseUrl = 'https://webws.365scores.com/web';
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

  parseGameOdds(g) {
    if (!g) return null;
    const bets = g.bets || g.odds || g.gameBets || (Array.isArray(g.markets) ? g.markets : null);
    if (!bets) return null;

    const parsed = {
      ms1: null, msX: null, ms2: null,
      openMs1: null, openMsX: null, openMs2: null,
      bttsYes: null, bttsNo: null,
      ouLines: {},
      htOuLines: {},
      suspended: false
    };

    const betList = Array.isArray(bets) ? bets : Object.values(bets);

    for (const b of betList) {
      if (!b) continue;
      const name = String(b.name || b.typeName || b.betTypeName || '').toLowerCase();
      const typeId = b.type || b.betTypeId || b.id;
      const rawLine = b.line !== undefined ? b.line : (b.handicap !== undefined ? b.handicap : null);
      const lineVal = rawLine !== null && rawLine !== undefined ? String(rawLine).trim() : null;
      const options = b.options || b.rates || b.outcomes || b.lines || b.odds || [];
      const optList = Array.isArray(options) ? options : Object.values(options);

      const parseRate = (opt) => {
        if (!opt) return null;
        const val = parseFloat(opt.rate ?? opt.odds ?? opt.value ?? opt.decimal ?? opt.price);
        return (!isNaN(val) && val > 1.0) ? Number(val.toFixed(2)) : null;
      };

      const parseOpenRate = (opt) => {
        if (!opt) return null;
        const val = parseFloat(opt.openingRate ?? opt.openRate ?? opt.openOdds ?? opt.opening);
        return (!isNaN(val) && val > 1.0) ? Number(val.toFixed(2)) : null;
      };

      // 1X2 / Full Time Result
      if (typeId === 1 || name.includes('1x2') || name.includes('full time result') || name.includes('match result') || name === 'result' || name.includes('maç sonucu')) {
        for (const opt of optList) {
          const optName = String(opt.name || opt.outcomeName || opt.text || '').toLowerCase().trim();
          const rate = parseRate(opt);
          const openRate = parseOpenRate(opt) || rate;
          if (!rate) continue;

          const isHome = optName === '1' || optName === 'home' || (opt.competitorId && g.homeCompetitor?.id && String(opt.competitorId) === String(g.homeCompetitor.id));
          const isAway = optName === '2' || optName === 'away' || (opt.competitorId && g.awayCompetitor?.id && String(opt.competitorId) === String(g.awayCompetitor.id));
          const isDraw = optName === 'x' || optName === 'draw' || optName.includes('tie') || optName.includes('beraberlik');

          if (isHome) {
            parsed.ms1 = rate;
            parsed.openMs1 = openRate;
          } else if (isDraw) {
            parsed.msX = rate;
            parsed.openMsX = openRate;
          } else if (isAway) {
            parsed.ms2 = rate;
            parsed.openMs2 = openRate;
          }
        }
        if (optList.length >= 3 && !parsed.ms1 && !parsed.msX && !parsed.ms2) {
          parsed.ms1 = parseRate(optList[0]);
          parsed.msX = parseRate(optList[1]);
          parsed.ms2 = parseRate(optList[2]);
          parsed.openMs1 = parseOpenRate(optList[0]) || parsed.ms1;
          parsed.openMsX = parseOpenRate(optList[1]) || parsed.msX;
          parsed.openMs2 = parseOpenRate(optList[2]) || parsed.ms2;
        }
      }

      // Over / Under 2.5 & other total lines
      if (typeId === 2 || name.includes('over/under') || name.includes('total') || name.includes('alt/üst') || name.includes('goals over')) {
        const line = lineVal || '2.5';
        if (!parsed.ouLines[line]) parsed.ouLines[line] = {};
        for (const opt of optList) {
          const optName = String(opt.name || opt.outcomeName || opt.text || '').toLowerCase();
          const rate = parseRate(opt);
          const openRate = parseOpenRate(opt) || rate;
          if (!rate) continue;

          if (optName.includes('over') || optName.startsWith('o') || optName.includes('üst') || optName.includes('ust')) {
            parsed.ouLines[line].over = rate;
            parsed.ouLines[line].openOver = openRate;
          } else if (optName.includes('under') || optName.startsWith('u') || optName.includes('alt')) {
            parsed.ouLines[line].under = rate;
            parsed.ouLines[line].openUnder = openRate;
          }
        }
      }

      // Both Teams to Score (BTTS)
      if (typeId === 3 || name.includes('both teams to score') || name.includes('btts') || name.includes('karşılıklı gol')) {
        for (const opt of optList) {
          const optName = String(opt.name || opt.outcomeName || opt.text || '').toLowerCase();
          const rate = parseRate(opt);
          if (!rate) continue;
          if (optName === 'yes' || optName === 'evet' || optName === 'var' || optName === 'y') {
            parsed.bttsYes = rate;
          } else if (optName === 'no' || optName === 'hayır' || optName === 'hayir' || optName === 'yok' || optName === 'n') {
            parsed.bttsNo = rate;
          }
        }
      }
    }

    const hasAnyOdds = parsed.ms1 || parsed.msX || parsed.ms2 || Object.keys(parsed.ouLines).length > 0;
    return hasAnyOdds ? parsed : null;
  }

  async fetchAllScores() {
    try {
      const url = `${this.baseUrl}/games/allscores/?appTypeId=5&langId=1&timezoneName=Europe/Istanbul&userCountryId=21&sports=1&_t=${Date.now()}`;
      const res = await this.fetchWithRetry(url);
      const data = await res.json();
      if (!data || !Array.isArray(data.games)) return [];

    const compMap = new Map();
    if (Array.isArray(data.competitions)) {
      for (const c of data.competitions) {
        compMap.set(c.id, c.name || 'Lig');
      }
    }

    const matches = [];
    for (const g of data.games) {
      const startTs = g.startTime ? Math.floor(new Date(g.startTime).getTime() / 1000) : Math.floor(Date.now() / 1000);
      const kickoffTime = this.formatKickoffTime(startTs);

      let status = 'SCHEDULED';
      let statusText = kickoffTime;
      const rawShort = String(g.shortStatusText || g.statusText || '').toLowerCase();
      let minute = g.gameTime && g.gameTime > 0 ? Math.round(g.gameTime) : 0;

      if (rawShort.includes('post') || rawShort.includes('canc') || rawShort.includes('aban') || rawShort.includes('susp') || rawShort.includes('delay')) {
        status = 'POSTPONED';
        statusText = 'Ertelendi';
      } else if (g.statusGroup === 4 || rawShort === 'fro' || rawShort === 'ft' || rawShort === 'ended' || rawShort === 'aet' || rawShort === 'pen') {
        status = 'FT';
        statusText = 'Maç Sonu';
        minute = 90;
      } else if (g.statusGroup === 3) {
        const isHalftime =
          rawShort === 'ht' ||
          rawShort === 'halftime' ||
          rawShort.includes('half time') ||
          rawShort.includes('devre arası') ||
          (rawShort.includes('ht') && !rawShort.includes('2nd') && !rawShort.includes('1st'));

        if (isHalftime) {
          status = 'HT';
          statusText = 'Devre Arası';
          minute = 45;
        } else {
          status = 'LIVE';
          if (rawShort.includes('2nd') || rawShort.includes('2. yarı') || (minute > 45 && minute <= 125)) {
            minute = Math.max(46, Math.min(125, minute || 46));
            statusText = minute >= 90 ? 'Uzatma' : '2. Yarı';
          } else {
            if (minute <= 0) minute = 1;
            statusText = '1. Yarı';
          }
        }
      }

      const compName = g.competitionDisplayName || compMap.get(g.competitionId) || 'Uluslararası Lig';

      matches.push({
        source: '365scores',
        sourceId: String(g.id),
        matchId: `s365_${g.id}`,
        startTimestamp: startTs,
        kickoffTime,
        status,
        statusText,
        minute,
        hasStats: Boolean(g.hasStats),
        odds: this.parseGameOdds(g),
        league: {
          id: String(g.competitionId || '365'),
          name: compName,
          country: 'Dünya'
        },
        home: {
          id: String(g.homeCompetitor?.id || ''),
          name: g.homeCompetitor?.name || 'Ev Sahibi',
          shortName: (g.homeCompetitor?.name || 'EV').slice(0, 3).toUpperCase(),
          logo: g.homeCompetitor?.id ? `https://imagecache.365scores.com/image/upload/f_png,w_64,h_64,c_limit,q_auto:eco,dpr_2,d_Competitors:default1.png/v1/Competitors/${g.homeCompetitor.id}` : null,
          score: Math.max(0, g.homeCompetitor?.score ?? 0),
          htScore: 0,
          redCards: g.homeCompetitor?.redCards || 0
        },
        away: {
          id: String(g.awayCompetitor?.id || ''),
          name: g.awayCompetitor?.name || 'Deplasman',
          shortName: (g.awayCompetitor?.name || 'DEP').slice(0, 3).toUpperCase(),
          logo: g.awayCompetitor?.id ? `https://imagecache.365scores.com/image/upload/f_png,w_64,h_64,c_limit,q_auto:eco,dpr_2,d_Competitors:default1.png/v1/Competitors/${g.awayCompetitor.id}` : null,
          score: Math.max(0, g.awayCompetitor?.score ?? 0),
          htScore: 0,
          redCards: g.awayCompetitor?.redCards || 0
        }
      });
    }

    return matches;
    } catch (_) {
      return [];
    }
  }

  async fetchMatchStats(gameId, homeCompId, awayCompId) {
    try {
      const url = `${this.baseUrl}/game/stats/?appTypeId=5&langId=1&timezoneName=Europe/Istanbul&userCountryId=21&games=${gameId}&_t=${Date.now()}`;
      const res = await this.fetchWithRetry(url);
      const data = await res.json();
      if (!data || !Array.isArray(data.statistics)) return null;

      const stats = {
        home: {
          possession: 50, totalShots: 0, shotsOnTarget: 0, shotsOffTarget: 0,
          blockedShots: 0, shotsInsideBox: 0, shotsOutsideBox: 0, bigChances: 0, woodwork: 0,
          corners: 0, fouls: 0, yellowCards: 0, redCards: 0,
          offsides: 0, freeKicks: 0, saves: 0, goalkeeperSaves: 0,
          passesCompleted: 0, passesTotal: 0, passAccuracy: 0,
          attacks: 0, dangerousAttacks: 0, substitutions: 0, xg: 0
        },
        away: {
          possession: 50, totalShots: 0, shotsOnTarget: 0, shotsOffTarget: 0,
          blockedShots: 0, shotsInsideBox: 0, shotsOutsideBox: 0, bigChances: 0, woodwork: 0,
          corners: 0, fouls: 0, yellowCards: 0, redCards: 0,
          offsides: 0, freeKicks: 0, saves: 0, goalkeeperSaves: 0,
          passesCompleted: 0, passesTotal: 0, passAccuracy: 0,
          attacks: 0, dangerousAttacks: 0, substitutions: 0, xg: 0
        }
      };

      for (const item of data.statistics) {
        const side = String(item.competitorId) === String(homeCompId) ? 'home'
          : (String(item.competitorId) === String(awayCompId) ? 'away' : null);
        if (!side) continue;

        const val = parseFloat(String(item.value || '0').replace('%', '')) || 0;
        const id = item.id;
        const name = (item.name || '').toLowerCase();

        const isYellowCardStat = (n, statId) => {
          if (statId === 1 && (n.includes('card') || n.includes('kart') || !n)) return true;
          return n === 'yellowcard' || n === 'yellowcards' || n === 'yellow_card' || n === 'yellow_cards' ||
                 n === 'yellow cards' || n === 'yellow card' || n.includes('yellow card') || n.includes('yellow_card') ||
                 n.includes('sarı kart') || n.includes('sari kart') || (n.includes('yellow') && (n.includes('card') || n.includes('kart')));
        };
        const isRedCardStat = (n, statId) => {
          if (statId === 2 && (n.includes('card') || n.includes('kart') || !n)) return true;
          return n === 'redcard' || n === 'redcards' || n === 'red_card' || n === 'red_cards' ||
                 n === 'red cards' || n === 'red card' || n.includes('red card') || n.includes('red_card') ||
                 n.includes('kırmızı kart') || n.includes('kirmizi kart') || (n.includes('red') && (n.includes('card') || n.includes('kart')));
        };

        if (id === 10 || name.includes('possession')) stats[side].possession = val;
        else if (id === 3 || name === 'shots' || name.includes('total shot')) stats[side].totalShots = val;
        else if (id === 4 || name.includes('shots on target') || name.includes('shots on goal')) stats[side].shotsOnTarget = val;
        else if (id === 5 || name.includes('shots off target')) stats[side].shotsOffTarget = val;
        else if (id === 6 || name.includes('blocked')) stats[side].blockedShots = val;
        else if (id === 16 || name.includes('shots inside') || name.includes('inside box')) stats[side].shotsInsideBox = val;
        else if (id === 17 || name.includes('shots outside') || name.includes('outside box')) stats[side].shotsOutsideBox = val;
        else if (id === 8 || name.includes('corner')) stats[side].corners = val;
        else if (id === 12 || name.includes('foul')) stats[side].fouls = val;
        else if (isYellowCardStat(name, id)) stats[side].yellowCards = val;
        else if (isRedCardStat(name, id)) stats[side].redCards = val;
        else if (id === 9 || name.includes('offside')) stats[side].offsides = val;
        else if (id === 13 || name.includes('free kick') || name.includes('freekick')) stats[side].freeKicks = val;
        else if (id === 7 || name.includes('save')) {
          stats[side].saves = val;
          stats[side].goalkeeperSaves = val;
        }
        else if (id === 11 || name.includes('dangerous attack')) stats[side].dangerousAttacks = val;
        else if (id === 14 || id === 15 || name === 'attacks' || (name.includes('attack') && !name.includes('dangerous'))) stats[side].attacks = val;
        else if (id === 18 || name.includes('substitution') || name.includes('sub')) stats[side].substitutions = val;
        else if (name.includes('big chance')) stats[side].bigChances = val;
        else if (name.includes('woodwork')) stats[side].woodwork = val;
        else if (name.includes('xg') || name.includes('expected')) stats[side].xg = val;
        else if (id === 20 || id === 21 || id === 22 || id === 25 || id === 26 || id === 27 || name.includes('pass') || name.includes('pas')) {
          const valStr = String(item.value || '').trim();
          if (valStr.includes('/')) {
            const parts = valStr.split('/');
            const comp = parseFloat(parts[0]) || 0;
            const tot = parseFloat(parts[1]) || 0;
            stats[side].passesCompleted = comp;
            stats[side].passesTotal = tot;
            if (tot > 0) stats[side].passAccuracy = Math.round((comp / tot) * 100);
          } else if (valStr.includes('%') || name.includes('accuracy') || name.includes('yüzde')) {
            stats[side].passAccuracy = val;
          } else if (name.includes('accurate') || name.includes('completed') || name.includes('isabetli')) {
            stats[side].passesCompleted = val;
          } else if (name.includes('total') || name === 'passes') {
            stats[side].passesTotal = val;
          }
        }
      }

      for (const side of ['home', 'away']) {
        const s = stats[side];
        if (s.totalShots === 0 && (s.shotsOnTarget > 0 || s.shotsOffTarget > 0)) {
          s.totalShots = s.shotsOnTarget + s.shotsOffTarget + s.blockedShots;
        }
        if (!s.passAccuracy && s.passesTotal > 0 && s.passesCompleted > 0) {
          s.passAccuracy = Math.round((s.passesCompleted / s.passesTotal) * 100);
        }
        s.goalkeeperSaves = s.saves;
      }

      return stats;
    } catch (_) {
      return null;
    }
  }

  async fetchGameDetails(gameId, homeCompId, awayCompId) {
    try {
      const url = `${this.baseUrl}/game/?appTypeId=5&langId=1&timezoneName=Europe/Istanbul&userCountryId=21&gameId=${gameId}&_t=${Date.now()}`;
      const res = await this.fetchWithRetry(url);
      const data = await res.json();
      const g = data?.game || data;
      const odds = this.parseGameOdds(g);
      const rawEvents = data?.game?.events || data?.events || [];
      const incidents = this.parseIncidents(rawEvents, gameId, homeCompId, awayCompId);
      return { odds, incidents };
    } catch (_) {
      return { odds: null, incidents: [] };
    }
  }

  async fetchMatchOdds(gameId) {
    try {
      const url = `${this.baseUrl}/game/?appTypeId=5&langId=1&timezoneName=Europe/Istanbul&userCountryId=21&gameId=${gameId}&_t=${Date.now()}`;
      const res = await this.fetchWithRetry(url);
      const data = await res.json();
      const g = data?.game || data;
      return this.parseGameOdds(g);
    } catch (_) {
      return null;
    }
  }

  async fetchMatchIncidents(gameId, homeCompId, awayCompId) {
    try {
      const url = `${this.baseUrl}/game/?appTypeId=5&langId=1&timezoneName=Europe/Istanbul&userCountryId=21&gameId=${gameId}&_t=${Date.now()}`;
      const res = await this.fetchWithRetry(url);
      const data = await res.json();
      const rawEvents = data?.game?.events || data?.events || [];
      return this.parseIncidents(rawEvents, gameId, homeCompId, awayCompId);
    } catch (_) {
      return [];
    }
  }

  parseIncidents(rawEvents, gameId, homeCompId, awayCompId) {
    if (!Array.isArray(rawEvents) || rawEvents.length === 0) return [];

    const incidents = [];

    for (const ev of rawEvents) {
      const side = (String(ev.competitorId) === String(homeCompId)) ? 'HOME'
        : ((String(ev.competitorId) === String(awayCompId)) ? 'AWAY' : 'HOME');

      const min = Math.round(ev.gameTime || ev.minute || ev.time || 0);
      const addedTime = parseInt(ev.addedTime || ev.extraTime || '0', 10) || 0;
      const eventTypeNum = ev.eventType?.id || ev.eventTypeNum || ev.eventTypeId || ev.typeId || 0;
      const eventTypeName = String(ev.eventType?.name || ev.eventTypeDescription || ev.typeName || ev.name || '').toLowerCase();
      const reasonStr = String(ev.reason || ev.eventTypeDescription || '').toLowerCase();
      const fullEventText = `${eventTypeName} ${reasonStr}`;

      const isDisallowedWord =
        fullEventText.includes('disallowed') ||
        fullEventText.includes('overturned') ||
        fullEventText.includes('no goal') ||
        fullEventText.includes('iptal edildi') ||
        fullEventText.includes('gol iptal') ||
        fullEventText.includes('goal cancelled') ||
        fullEventText.includes('goal canceled');

      const isConfirmedWord =
        fullEventText.includes('confirmed') ||
        fullEventText.includes('awarded') ||
        fullEventText.includes('stands') ||
        fullEventText.includes('valid') ||
        fullEventText.includes('onaylandı') ||
        fullEventText.includes('onaylandi') ||
        fullEventText.includes('geçerli') ||
        fullEventText.includes('gecerli');

      let eventType = 'OTHER';
      if (isDisallowedWord && !isConfirmedWord) {
        eventType = 'GOAL_DISALLOWED';
      } else if (eventTypeNum === 1 || eventTypeNum === 2 || eventTypeNum === 3 || eventTypeName.includes('goal') || eventTypeName.includes('gol')) {
        eventType = 'GOAL';
      } else if (eventTypeNum === 4 || eventTypeName.includes('yellow card') || eventTypeName.includes('sarı kart') || (eventTypeName.includes('yellow') && eventTypeName.includes('card'))) {
        eventType = 'YELLOW_CARD';
      } else if (eventTypeNum === 5 || eventTypeName.includes('red card') || eventTypeName.includes('kırmızı kart') || (eventTypeName.includes('red') && eventTypeName.includes('card'))) {
        eventType = 'RED_CARD';
      } else if (eventTypeNum === 7 || eventTypeNum === 6 || eventTypeName.includes('sub') || eventTypeName.includes('değişiklik')) {
        eventType = 'SUBSTITUTION';
      }

      const isSub = eventType === 'SUBSTITUTION';
      let playerIn = ev.playerIn?.name || ev.subIn?.name || null;
      let playerOut = ev.playerOut?.name || ev.subOut?.name || null;
      let playerInId = ev.playerIn?.id || ev.subIn?.id || null;
      let playerOutId = ev.playerOut?.id || ev.subOut?.id || null;

      if (isSub && !playerIn && !playerOut) {
        if (Array.isArray(ev.extraPlayers) && ev.extraPlayers.length > 0) {
          const p1 = ev.player?.name || ev.playerName || '';
          const p2 = ev.extraPlayers[0]?.name || '';
          const p1Id = ev.player?.id || ev.playerId || null;
          const p2Id = ev.extraPlayers[0]?.id || null;
          const subTypeStr = String(ev.subType || ev.eventTypeDescription || '').toLowerCase();
          if (subTypeStr.includes('in') && !subTypeStr.includes('out')) {
            playerIn = p1; playerInId = p1Id;
            playerOut = p2; playerOutId = p2Id;
          } else {
            playerIn = p2 || p1; playerInId = p2Id || p1Id;
            playerOut = p1; playerOutId = p1Id;
          }
        } else if (Array.isArray(ev.playersInvolved)) {
          const inP = ev.playersInvolved.find(p => p.type === 'in' || p.subType === 'in');
          const outP = ev.playersInvolved.find(p => p.type === 'out' || p.subType === 'out');
          playerIn = inP?.name || ev.playersInvolved[0]?.name || '';
          playerInId = inP?.id || ev.playersInvolved[0]?.id || null;
          playerOut = outP?.name || ev.playersInvolved[1]?.name || null;
          playerOutId = outP?.id || ev.playersInvolved[1]?.id || null;
        } else {
          playerIn = ev.player?.name || ev.playerName || '';
          playerInId = ev.player?.id || ev.playerId || null;
        }
      }

      const primaryName = isSub ? (playerIn || '') : (ev.player?.name || ev.playerName || '');
      const primaryId = isSub ? (playerInId || null) : (ev.player?.id || ev.playerId || null);

      incidents.push({
        id: `s365_inc_${gameId}_${ev.id || `${min}_${eventType}_${primaryName}`}`,
        eventType,
        minute: min,
        addedTime,
        team: side,
        playerName: primaryName,
        playerId: primaryId,
        assistPlayerName: ev.assistPlayer?.name || ev.assistName || null,
        playerIn: isSub ? (playerIn || primaryName) : null,
        playerOut: isSub ? playerOut : null,
        playerInId: isSub ? (playerInId || primaryId) : null,
        playerOutId: isSub ? playerOutId : null,
        subIn: isSub ? (playerIn || primaryName) : null,
        subOut: isSub ? playerOut : null,
        reason: isSub ? 'Oyuncu Değişikliği' : (ev.reason || ''),
        homeScore: ev.homeScore !== undefined ? ev.homeScore : null,
        awayScore: ev.awayScore !== undefined ? ev.awayScore : null
      });
    }

    return incidents;
  }
}

module.exports = Scores365Scraper;
