/**
 * PulseBet Studio — Multi-Source Real-Time Scraper & Entity Fusion Orchestrator (V4)
 * Features:
 *  - High-speed 2.5s spine polling with instant STATE_SYNC broadcast (zero UI lag on score/minute changes)
 *  - Zero Finished (FT) Matches in Match List & Radar: Finished matches immediately settle their signals (WON/LOST) and are deleted from store.matches
 *  - Today's Upcoming (SCHEDULED) Matches sorted chronologically with kickoffTime (HH:MM) & pre-match odds
 *  - Referee-Clock Priority (365Scores/ESPN exact clock + Flashscore BX=-1 stoppage time fix)
 */

const FlashscoreScraper = require('./FlashscoreScraper');
const Scores365Scraper = require('./Scores365Scraper');
const EspnScraper = require('./EspnScraper');
const TeamNameMatcher = require('./TeamNameMatcher');

class MultiSourceOrchestrator {
  constructor({ store, diffEngine, momentumEngine, playerEngine, quantEngine, onBroadcast }) {
    this.store = store;
    this.diffEngine = diffEngine;
    this.momentumEngine = momentumEngine;
    this.playerEngine = playerEngine;
    this.quantEngine = quantEngine;
    this.onBroadcast = onBroadcast || (() => {});

    this.flashscore = new FlashscoreScraper();
    this.scores365 = new Scores365Scraper();
    this.espn = new EspnScraper();
    this.teamMatcher = new TeamNameMatcher();

    this.linkCache = new Map(); // sourceKey -> canonicalMatchId
    this.deepRoundRobinIdx = 0;
    this.isRunning = false;
    this.commitQueue = Promise.resolve();

    this.sourceStatus = {
      flashscore: { active: false, lastSync: null, matchCount: 0, latencyMs: 0 },
      scores365: { active: false, lastSync: null, matchCount: 0, latencyMs: 0 },
      espn: { active: false, lastSync: null, matchCount: 0, latencyMs: 0 }
    };
  }

  enqueueCommit(task) {
    const next = this.commitQueue.then(() => task(), () => task());
    this.commitQueue = next.catch(() => {});
    return next;
  }

  getLeaguePrestigeScore(leagueName) {
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

  isJunkMatch(m) {
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

  normalizeTeamName(name) {
    return this.teamMatcher.normalizeTeamName(name);
  }

  diceSimilarity(a, b) {
    return this.teamMatcher.calculateSimilarity(a, b);
  }

  calculateTeamSimilarity(a, b) {
    return this.teamMatcher.calculateSimilarity(a, b);
  }

  createEmptyStats() {
    return {
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
      attacks: 0,
      dangerousAttacks: 0,
      substitutions: 0,
      xg: 0,
      xgot: 0,
      xa: 0
    };
  }

  areMatchesSame(m1, m2) {
    if (!m1 || !m2) return false;
    if (m1.matchId && m2.matchId && m1.matchId === m2.matchId) return true;

    // 1. Direct shared linked source IDs (e.g., both linked to fs_xyz or s365_abc)
    for (const src of ['flashscore', '365scores', 'espn']) {
      const id1 = m1.linkedIds?.[src] || (m1.source === src ? m1.sourceId : null);
      const id2 = m2.linkedIds?.[src] || (m2.source === src ? m2.sourceId : null);
      if (id1 && id2 && String(id1) === String(id2)) return true;
    }

    // 2. Kickoff timestamp difference guard
    const t1 = m1.startTimestamp || 0;
    const t2 = m2.startTimestamp || 0;
    const timeDiff = Math.abs(t1 - t2);
    if (t1 > 0 && t2 > 0 && timeDiff > 7200 && m1.status !== m2.status) {
      return false;
    }

    // 3. Team Name Similarity (Canonical Aliases, Acronyms & Fuzzy Dice)
    const simHome = this.calculateTeamSimilarity(m1.home?.name, m2.home?.name);
    const simAway = this.calculateTeamSimilarity(m1.away?.name, m2.away?.name);
    const combined = (simHome + simAway) / 2;

    if (
      (simHome >= 0.80 && simAway >= 0.80) ||
      (simHome >= 0.90 && simAway >= 0.45) ||
      (simAway >= 0.90 && simHome >= 0.45) ||
      combined >= 0.72
    ) {
      return true;
    }

    // Inverted check (home / away swapped between feeds)
    const invHome = this.calculateTeamSimilarity(m1.home?.name, m2.away?.name);
    const invAway = this.calculateTeamSimilarity(m1.away?.name, m2.home?.name);
    if ((invHome >= 0.85 && invAway >= 0.85) || ((invHome + invAway) / 2 >= 0.80)) {
      return true;
    }

    return false;
  }

  findExistingCanonicalMatch(raw) {
    const sourceKey = `${raw.source}:${raw.sourceId}`;
    if (this.linkCache.has(sourceKey)) {
      const cachedId = this.linkCache.get(sourceKey);
      if (this.store.matches.has(cachedId)) {
        return this.store.matches.get(cachedId);
      }
    }

    for (const existing of this.store.matches.values()) {
      if (existing.linkedIds && existing.linkedIds[raw.source] && String(existing.linkedIds[raw.source]) === String(raw.sourceId)) {
        this.linkCache.set(sourceKey, existing.matchId);
        return existing;
      }

      if (this.areMatchesSame(existing, raw)) {
        this.linkCache.set(sourceKey, existing.matchId);
        return existing;
      }
    }
    return null;
  }

  chooseCanonicalSurvivor(m1, m2) {
    const p1 = this.getLeaguePrestigeScore(m1.league?.name);
    const p2 = this.getLeaguePrestigeScore(m2.league?.name);
    if (p1 > p2) return [m1, m2];
    if (p2 > p1) return [m2, m1];

    const fs1 = (m1.sources || []).includes('flashscore') || (m1.matchId || '').startsWith('fs_');
    const fs2 = (m2.sources || []).includes('flashscore') || (m2.matchId || '').startsWith('fs_');
    if (fs1 && !fs2) return [m1, m2];
    if (fs2 && !fs1) return [m2, m1];

    if ((m1.sources || []).length >= (m2.sources || []).length) return [m1, m2];
    return [m2, m1];
  }

  mergeTwoMatches(winner, loser) {
    if (!winner || !loser || winner.matchId === loser.matchId) return;

    // 1. Sources & Linked IDs
    for (const s of (loser.sources || [])) {
      if (!winner.sources.includes(s)) winner.sources.push(s);
    }
    winner.linkedIds = { ...loser.linkedIds, ...winner.linkedIds };

    // 2. LinkCache remapping
    for (const [sKey, cId] of this.linkCache.entries()) {
      if (cId === loser.matchId) {
        this.linkCache.set(sKey, winner.matchId);
      }
    }
    if (loser.source && loser.sourceId) {
      this.linkCache.set(`${loser.source}:${loser.sourceId}`, winner.matchId);
    }
    for (const [src, id] of Object.entries(loser.linkedIds || {})) {
      if (src !== 's365HomeId' && src !== 's365AwayId') {
        this.linkCache.set(`${src}:${id}`, winner.matchId);
      }
    }

    // 3. League Prestige Override
    const pWinner = this.getLeaguePrestigeScore(winner.league?.name);
    const pLoser = this.getLeaguePrestigeScore(loser.league?.name);
    if (pLoser > pWinner || (!winner.league?.name && loser.league?.name)) {
      winner.league = { ...loser.league };
    }

    // 4. Team Name Upgrades (acronym vs full official name)
    for (const side of ['home', 'away']) {
      if (loser[side]?.name && winner[side]?.name) {
        if (winner[side].name.length <= 4 && loser[side].name.length > winner[side].name.length) {
          winner[side].name = loser[side].name;
        }
      }
    }

    // 5. Merge Logos, Odds, Incidents, Stats
    this.mergeLogos(winner, loser);
    this.mergeOdds(winner, loser.odds);
    if (loser.incidents && loser.incidents.length > 0) {
      this.mergeIncidents(winner, loser.incidents);
    }
    if (loser.home?.stats || loser.away?.stats) {
      this.mergeStats(winner, {
        home: loser.home?.stats,
        away: loser.away?.stats,
        half1: loser.periodStats?.half1,
        half2: loser.periodStats?.half2
      }, loser.sources?.[0] || 'unknown');
    }

    // 6. Analysis and Telemetry Flags
    if (loser.analysis && !winner.analysis) {
      winner.analysis = loser.analysis;
    }
    winner._deepHydrated = Boolean(winner._deepHydrated || loser._deepHydrated);
    winner._statsHydrated = Boolean(winner._statsHydrated || loser._statsHydrated);
    winner._deepCount = Math.max(winner._deepCount || 0, loser._deepCount || 0);

    // 7. Remap Signals & Ephemeral Events
    if (Array.isArray(this.store.signalLedger)) {
      for (const rec of this.store.signalLedger) {
        if (rec.matchId === loser.matchId) {
          rec.matchId = winner.matchId;
          rec.leagueName = winner.league?.name || rec.leagueName;
          rec.homeName = winner.home.name;
          rec.awayName = winner.away.name;
        }
      }
    }
    if (Array.isArray(this.store.signalHistory)) {
      for (const sig of this.store.signalHistory) {
        if (sig.matchId === loser.matchId) {
          sig.matchId = winner.matchId;
          sig.leagueName = winner.league?.name || sig.leagueName;
          sig.homeName = winner.home.name;
          sig.awayName = winner.away.name;
        }
      }
    }
    if (Array.isArray(this.store.eventHistory)) {
      for (const ev of this.store.eventHistory) {
        if (ev.matchId === loser.matchId) {
          ev.matchId = winner.matchId;
        }
      }
    }

    // 8. Snapshots & Starred state
    if (this.store.snapshots.has(loser.matchId)) {
      if (!this.store.snapshots.has(winner.matchId) || this.store.snapshots.get(winner.matchId).length === 0) {
        this.store.snapshots.set(winner.matchId, this.store.snapshots.get(loser.matchId));
      }
      this.store.snapshots.delete(loser.matchId);
    }
    if (this.store.starredMatchIds?.has(loser.matchId)) {
      this.store.starredMatchIds.delete(loser.matchId);
      this.store.starredMatchIds.add(winner.matchId);
      winner.isStarred = true;
    }

    // 9. Re-settle signals against winner
    this.store.settleSignalsForMatch(winner);

    // 10. Delete loser duplicate
    this.store.matches.delete(loser.matchId);
    this.diffEngine.pruneByMatchIds(new Set([loser.matchId]));
  }

  deduplicateStoreMatches() {
    const matches = Array.from(this.store.matches.values());
    if (matches.length < 2) return 0;

    let mergedCount = 0;
    const toDelete = new Set();

    for (let i = 0; i < matches.length; i++) {
      const m1 = matches[i];
      if (!m1 || toDelete.has(m1.matchId)) continue;

      for (let j = i + 1; j < matches.length; j++) {
        const m2 = matches[j];
        if (!m2 || toDelete.has(m2.matchId)) continue;

        if (this.areMatchesSame(m1, m2)) {
          const [winner, loser] = this.chooseCanonicalSurvivor(m1, m2);
          this.mergeTwoMatches(winner, loser);
          toDelete.add(loser.matchId);
          mergedCount++;
        }
      }
    }

    if (mergedCount > 0) {
      console.log(`[MultiSourceOrchestrator] Collapsed and deduplicated ${mergedCount} duplicate match(es) in store.`);
    }
    return mergedCount;
  }

  resolveCanonicalMatch(raw) {
    const existing = this.findExistingCanonicalMatch(raw);
    if (existing) {
      // League Prestige Override: Upgrade league if incoming raw tournament has higher prestige
      const existingPrestige = this.getLeaguePrestigeScore(existing.league?.name);
      const incomingPrestige = this.getLeaguePrestigeScore(raw.league?.name);
      if (incomingPrestige > existingPrestige || (!existing.league?.name && raw.league?.name)) {
        existing.league = { ...raw.league };
      }
      return existing;
    }

    const sourceKey = `${raw.source}:${raw.sourceId}`;
    const canonicalId = raw.matchId;
    const newMatch = {
      matchId: canonicalId,
      isStarred: this.store.isStarred(canonicalId),
      _deepHydrated: false,
      sources: [raw.source],
      linkedIds: {
        [raw.source]: raw.sourceId
      },
      startTimestamp: raw.startTimestamp,
      kickoffTime: raw.kickoffTime || '00:00',
      status: raw.status,
      statusText: raw.statusText,
      minute: raw.minute || 0,
      league: { ...raw.league },
      home: {
        ...raw.home,
        stats: this.createEmptyStats()
      },
      away: {
        ...raw.away,
        stats: this.createEmptyStats()
      },
      periodStats: {
        half1: null,
        half2: null
      },
      incidents: [],
      shotmap: [],
      lineups: null,
      odds: {
        ms1: null, msX: null, ms2: null,
        openMs1: null, openMsX: null, openMs2: null,
        bttsYes: null, bttsNo: null,
        htBttsYes: null, htBttsNo: null,
        nextGoalHome: null, nextGoalNo: null, nextGoalAway: null,
        ouLines: {},
        htOuLines: {},
        suspended: false
      },
      analysis: null,
      updatedAt: Date.now()
    };

    this.linkCache.set(sourceKey, canonicalId);
    return newMatch;
  }

  mergeStats(targetMatch, incomingStats, source = 'unknown') {
    if (!incomingStats) return;

    const isFlashscore = source === 'flashscore';
    const isAlreadyHydratedByFs = Boolean(targetMatch._hasFlashscoreStats);

    for (const side of ['home', 'away']) {
      const dst = targetMatch[side].stats;
      const src = incomingStats[side] || {};

      if (isFlashscore) {
        // Flashscore is authoritative Opta/Sportradar baseline
        const copyKeys = [
          'totalShots', 'shotsOnTarget', 'shotsOffTarget', 'blockedShots',
          'shotsInsideBox', 'shotsOutsideBox', 'bigChances', 'woodwork',
          'corners', 'fouls', 'yellowCards', 'redCards', 'offsides',
          'freeKicks', 'touchesInBox', 'saves', 'goalkeeperSaves',
          'passesCompleted', 'passesTotal', 'passAccuracy',
          'dangerousAttacks', 'attacks', 'substitutions', 'xg', 'xgot', 'xa'
        ];
        for (const k of copyKeys) {
          if (src[k] !== undefined && !isNaN(Number(src[k]))) {
            dst[k] = Number(src[k]);
          }
        }
        if (src.possession !== undefined && !isNaN(Number(src.possession)) && Number(src.possession) > 0) {
          dst.possession = Number(src.possession);
        }
      } else {
        // Secondary sources (365Scores, ESPN): only supplement if Flashscore has not provided stats
        if (!isAlreadyHydratedByFs) {
          if (src.possession !== undefined && !isNaN(Number(src.possession)) && Number(src.possession) > 0) {
            dst.possession = Number(src.possession);
          }
          const supplementKeys = [
            'totalShots', 'shotsOnTarget', 'shotsOffTarget', 'blockedShots',
            'shotsInsideBox', 'shotsOutsideBox', 'bigChances', 'woodwork',
            'corners', 'fouls', 'yellowCards', 'redCards', 'offsides',
            'freeKicks', 'touchesInBox', 'saves', 'goalkeeperSaves',
            'passesCompleted', 'passesTotal', 'passAccuracy',
            'dangerousAttacks', 'attacks', 'substitutions', 'xg', 'xgot', 'xa'
          ];
          for (const k of supplementKeys) {
            const val = Number(src[k]);
            if (!isNaN(val) && val > (dst[k] || 0)) {
              dst[k] = val;
            }
          }
        } else {
          // If Flashscore already provided stats, fill genuine missing metrics that Flashscore lacks (e.g. dangerousAttacks, fouls, xG, passes)
          const fillIfMissing = [
            'xg', 'xgot', 'xa', 'shotsInsideBox', 'shotsOutsideBox', 'bigChances',
            'woodwork', 'dangerousAttacks', 'attacks', 'substitutions', 'touchesInBox', 'fouls',
            'saves', 'goalkeeperSaves', 'offsides', 'freeKicks',
            'passesCompleted', 'passesTotal', 'passAccuracy'
          ];
          for (const k of fillIfMissing) {
            const val = Number(src[k]);
            if ((!dst[k] || dst[k] === 0) && !isNaN(val) && val > 0) {
              dst[k] = val;
            }
          }
        }
      }

      dst.goalkeeperSaves = dst.saves = Math.max(dst.saves || 0, dst.goalkeeperSaves || 0);
      if (!dst.passAccuracy && dst.passesTotal > 0 && dst.passesCompleted > 0) {
        dst.passAccuracy = Math.round((dst.passesCompleted / dst.passesTotal) * 100);
      }
    }

    if (isFlashscore) {
      targetMatch._hasFlashscoreStats = true;
    }

    // Mathematical guarantee: Possession must be complementary (sum to 100%)
    if (targetMatch.home.stats.possession > 0 && targetMatch.home.stats.possession <= 100) {
      targetMatch.away.stats.possession = 100 - targetMatch.home.stats.possession;
    } else if (targetMatch.away.stats.possession > 0 && targetMatch.away.stats.possession <= 100) {
      targetMatch.home.stats.possession = 100 - targetMatch.away.stats.possession;
    }

    // Mark that real stats arrived so cold-start snapshots never pollute sliding windows
    const hasRealStats = ['home', 'away'].some(side => {
      const s = targetMatch[side].stats || {};
      return (s.totalShots || 0) + (s.corners || 0) + (s.fouls || 0) + (s.dangerousAttacks || 0) + (s.attacks || 0) + (s.substitutions || 0) + (s.shotsInsideBox || 0) + (s.passesTotal || 0) + (s.saves || 0) > 0;
    });
    if (hasRealStats) targetMatch._statsHydrated = true;

    if (!targetMatch.periodStats) {
      targetMatch.periodStats = { half1: null, half2: null };
    }
    if (incomingStats.half1) {
      targetMatch.periodStats.half1 = incomingStats.half1;
    }
    if (incomingStats.half2) {
      targetMatch.periodStats.half2 = incomingStats.half2;
    }

    this.normalizeShotConsistency(targetMatch);
  }

  normalizeShotConsistency(match) {
    for (const side of ['home', 'away']) {
      const s = match[side].stats;
      const goals = match[side].score || 0;
      if (goals > (s.shotsOnTarget || 0)) {
        s.shotsOnTarget = goals;
      }
      const sumParts = (s.shotsOnTarget || 0) + (s.shotsOffTarget || 0) + (s.blockedShots || 0);
      if (s.totalShots < sumParts) {
        s.totalShots = sumParts;
      } else if (s.totalShots > sumParts && s.shotsOffTarget === 0) {
        s.shotsOffTarget = s.totalShots - s.shotsOnTarget - (s.blockedShots || 0);
      }
    }
  }

  mergeIncidents(targetMatch, incomingIncidents) {
    if (!Array.isArray(incomingIncidents) || incomingIncidents.length === 0) return;
    const existing = targetMatch.incidents || [];

    for (const inc of incomingIncidents) {
      const dup = existing.find(e =>
        e.id === inc.id ||
        (e.eventType === inc.eventType && e.team === inc.team && Math.abs((e.minute || 0) - (inc.minute || 0)) <= 1)
      );
      if (!dup) {
        existing.push(inc);
      } else {
        if (!dup.assistPlayerName && inc.assistPlayerName) dup.assistPlayerName = inc.assistPlayerName;
        if ((!dup.playerName || dup.playerName === 'Oyuncu') && inc.playerName) dup.playerName = inc.playerName;
        if (!dup.playerIn && inc.playerIn) dup.playerIn = inc.playerIn;
        if (!dup.playerOut && inc.playerOut) dup.playerOut = inc.playerOut;
        if (!dup.subIn && inc.subIn) dup.subIn = inc.subIn;
        if (!dup.subOut && inc.subOut) dup.subOut = inc.subOut;
      }
    }

    existing.sort((a, b) => (b.minute || 0) - (a.minute || 0));
    targetMatch.incidents = existing;

    const hYc = existing.filter(i => i.team === 'HOME' && i.eventType === 'YELLOW_CARD').length;
    const aYc = existing.filter(i => i.team === 'AWAY' && i.eventType === 'YELLOW_CARD').length;
    const hRc = existing.filter(i => i.team === 'HOME' && i.eventType === 'RED_CARD').length;
    const aRc = existing.filter(i => i.team === 'AWAY' && i.eventType === 'RED_CARD').length;
    const hSubs = existing.filter(i => i.team === 'HOME' && i.eventType === 'SUBSTITUTION').length;
    const aSubs = existing.filter(i => i.team === 'AWAY' && i.eventType === 'SUBSTITUTION').length;

    targetMatch.home.stats.yellowCards = Math.max(targetMatch.home.stats.yellowCards || 0, hYc);
    targetMatch.away.stats.yellowCards = Math.max(targetMatch.away.stats.yellowCards || 0, aYc);

    // Doğrulanmış olay geçmişi (incidents) mevcutsa, kırmızı kart adedini doğrulanmış kırmızı kart olaylarına eşitler.
    // Bu işlem, hatalı istatistik etiketlerinden (recovered, delivered vb.) sızan hayalet kırmızı kartları kesin olarak sıfırlar.
    if (existing.length > 0) {
      targetMatch.home.stats.redCards = hRc;
      targetMatch.away.stats.redCards = aRc;
      targetMatch.home.redCards = hRc;
      targetMatch.away.redCards = aRc;
    } else {
      targetMatch.home.stats.redCards = Math.max(targetMatch.home.stats.redCards || 0, hRc);
      targetMatch.away.stats.redCards = Math.max(targetMatch.away.stats.redCards || 0, aRc);
    }

    targetMatch.home.stats.substitutions = Math.max(targetMatch.home.stats.substitutions || 0, hSubs);
    targetMatch.away.stats.substitutions = Math.max(targetMatch.away.stats.substitutions || 0, aSubs);
  }

  mergeOdds(targetMatch, incomingOdds, source = 'unknown') {
    if (!incomingOdds) return;
    const dst = targetMatch.odds;
    const isFlashscore = source === 'flashscore';
    if (isFlashscore && (incomingOdds.ms1 || Object.keys(incomingOdds.ouLines || {}).length > 0)) {
      targetMatch._hasFlashscoreOdds = true;
    }

    const fields = ['ms1', 'msX', 'ms2', 'openMs1', 'openMsX', 'openMs2', 'ht1', 'htX', 'ht2', 'bttsYes', 'bttsNo', 'htBttsYes', 'htBttsNo', 'nextGoalHome', 'nextGoalNo', 'nextGoalAway'];
    for (const f of fields) {
      if (incomingOdds[f] !== undefined && incomingOdds[f] !== null) {
        if (dst[f] === null || dst[f] === undefined) {
          dst[f] = incomingOdds[f];
        } else if (isFlashscore || !targetMatch._hasFlashscoreOdds) {
          dst[f] = incomingOdds[f];
        }
      }
    }
    if (incomingOdds.ouLines && typeof incomingOdds.ouLines === 'object') {
      for (const [line, lineObj] of Object.entries(incomingOdds.ouLines)) {
        if (!dst.ouLines[line]) {
          dst.ouLines[line] = { ...lineObj };
        } else {
          for (const k of ['over', 'under', 'openOver', 'openUnder']) {
            if ((dst.ouLines[line][k] === undefined || dst.ouLines[line][k] === null) && lineObj[k] !== undefined) {
              dst.ouLines[line][k] = lineObj[k];
            } else if (isFlashscore && lineObj[k] !== undefined) {
              dst.ouLines[line][k] = lineObj[k];
            }
          }
        }
      }
    }
    if (incomingOdds.htOuLines && typeof incomingOdds.htOuLines === 'object') {
      for (const [line, lineObj] of Object.entries(incomingOdds.htOuLines)) {
        if (!dst.htOuLines[line]) {
          dst.htOuLines[line] = { ...lineObj };
        } else {
          for (const k of ['over', 'under', 'openOver', 'openUnder']) {
            if ((dst.htOuLines[line][k] === undefined || dst.htOuLines[line][k] === null) && lineObj[k] !== undefined) {
              dst.htOuLines[line][k] = lineObj[k];
            } else if (isFlashscore && lineObj[k] !== undefined) {
              dst.htOuLines[line][k] = lineObj[k];
            }
          }
        }
      }
    }
    if (incomingOdds.suspended !== undefined && (!targetMatch._hasFlashscoreOdds || isFlashscore)) {
      dst.suspended = Boolean(incomingOdds.suspended);
    }
  }

  mergeLogos(canonical, raw) {
    for (const side of ['home', 'away']) {
      const incomingLogo = raw[side]?.logo;
      if (!incomingLogo) continue;
      if (!canonical[side].logo) {
        canonical[side].logo = incomingLogo;
      } else if (
        (incomingLogo.includes('365scores.com') || incomingLogo.includes('espncdn.com')) &&
        canonical[side].logo.includes('flashscore.com')
      ) {
        canonical[side].backupLogo = canonical[side].logo;
        canonical[side].logo = incomingLogo;
      } else if (!canonical[side].backupLogo && incomingLogo !== canonical[side].logo) {
        canonical[side].backupLogo = incomingLogo;
      }
    }
  }

  /**
   * Run full tactical, player & selective quantitative analysis on a match,
   * settle any active signals in real time, and remove finished (FT) matches immediately.
   * Execution is sequentially synchronized via commitQueue mutex to eliminate race conditions.
   */
  evaluateAndCommitMatch(prevSnapshot, match) {
    return this.enqueueCommit(() => {
      this.normalizeShotConsistency(match);

      // 1. If match finished (FT) or was postponed, settle its signals and DELETE it from store.matches immediately!
      if (match.status === 'FT' || match.status === 'POSTPONED') {
        this.store.removeFinishedMatch(match.matchId, match);
        this.diffEngine.seedBaselineSilently(match);
        return { detectedEvents: [], detectedSignals: [] };
      }

      this.store.recordSnapshot(match);

      const windows = this.store.getSlidingWindows(match);
      const flow = this.momentumEngine.analyzeMatchFlow(match, windows);
      const players = this.playerEngine.analyzePlayers(match);
      const quant = this.quantEngine.analyzeMarkets(match, windows, flow, players);

      match.analysis = {
        flow,
        players,
        quant
      };
      match.updatedAt = Date.now();

      // 2. Always settle any tracked signals for this match in real time (e.g. instant Over / BTTS / Next Goal wins!)
      this.store.settleSignalsForMatch(match);

      // 3. If match reached late-game cutoff (>= 88'), purge live event notifications
      if ((match.minute || 0) >= 88) {
        this.store.pruneMatchNotifications(match.matchId, false);
        this.diffEngine.seedBaselineSilently(match);
        this.store.matches.set(match.matchId, match);
        return { detectedEvents: [], detectedSignals: [] };
      }

      const detectedEvents = this.diffEngine.diff(prevSnapshot, match);
      const detectedSignals = [];

      // 4. SELECTIVE SIGNAL HUNTER: Strictly emit only when LIVE (10 <= minute < 75) or HT, and SIGNAL_TRIGGERED
      const min = match.minute || 0;
      const isLiveOrHt = (match.status === 'LIVE' && min >= 10 && min < 75) || match.status === 'HT';
      if (
        isLiveOrHt &&
        quant.signalStatus === 'SIGNAL_TRIGGERED' &&
        quant.primarySignal
      ) {
        // =========================================================================
        // SIGNAL SAFETY GATEKEEPER:
        // 1-1 skorunda olan veya skoru ne olursa olsun, kazanması için 2+ gol gereken
        // bir "Üst" (Over) sinyalinin asla detectedSignals dizisine girmesine İZİN VERME!
        // Eğer bir sinyal selection.includes('Üst') içeriyorsa ve o anki toplam skordan
        // 2 veya daha fazla gol gerektiriyorsa (örn: skor 1-1 iken 3.5 Üst, skor 2-1 iken 4.5 Üst),
        // bu sinyali filtrele ve düşür!
        // =========================================================================
        const isOverUnsafe = (sig) => {
          if (!sig) return true;
          const sel = String(sig.selection || '');
          if (!sel.includes('Üst')) return false;

          const gH = Number(match.home?.score || 0);
          const gA = Number(match.away?.score || 0);
          const currentGoals = gH + gA;

          let line = sig.line;
          if (line === undefined || line === null || isNaN(line)) {
            const matchLine = sel.match(/(\d+\.?\d*)\s*Üst/i) || sel.match(/(\d+\.?\d*)/);
            line = matchLine ? parseFloat(matchLine[1]) : 2.5;
          }

          const isHtOu = sig.marketKey === 'HT_OU' || sel.includes('İY');
          const effectiveScore = isHtOu
            ? ((match.status === 'LIVE' && min <= 45) ? currentGoals : (Number(match.home?.htScore || 0) + Number(match.away?.htScore || 0)))
            : currentGoals;

          const goalsRequiredToWin = Math.floor(line) + 1;
          const goalsNeeded = goalsRequiredToWin - effectiveScore;

          return goalsNeeded >= 2;
        };

        let targetSig = quant.primarySignal;
        if (isOverUnsafe(targetSig)) {
          if (quant.complementarySignal && !isOverUnsafe(quant.complementarySignal)) {
            targetSig = quant.complementarySignal;
          } else {
            targetSig = null; // Filtrele ve düşür!
          }
        }

        if (targetSig) {
          const topSig = targetSig;
          const sigFp = `${match.matchId}:sig:${topSig.marketKey}:${topSig.selection}`;

          // Quality guards: market-based cooldown, no stacking on the same market while one is pending, max 4 per match
          const matchSignals = (this.store.signalLedger || []).filter(r => r.matchId === match.matchId);
          // Market-based cooldown: 5min for same market, 2.5min for different market
          const inCooldown = matchSignals.some(r => {
            const elapsed = Date.now() - (r.timestamp || 0);
            if (r.marketKey === topSig.marketKey) return elapsed < 5 * 60 * 1000;   // same market: 5min
            return elapsed < 2.5 * 60 * 1000;                                        // different market: 2.5min
          });
          const marketBusy = matchSignals.some(r => r.settlementStatus === 'PENDING' && r.marketKey === topSig.marketKey);
          const overLimit = matchSignals.length >= 4;
          // Warm-up: signal after 1 full deep-stat refresh (was 2), _statsHydrated still required
          const warmedUp = Boolean(match._statsHydrated) && (match._deepCount || 0) >= 1;

          if (warmedUp && !inCooldown && !marketBusy && !overLimit && !this.store.hasSignalFingerprint(sigFp)) {
            detectedSignals.push({
              id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              timestamp: Date.now(),
              type: 'BETTING_SIGNAL',
              category: 'signal',
              minute: min,
              minuteLabel: `${min}'`,
              matchId: match.matchId,
              leagueName: match.league?.name || 'Lig',
              homeName: match.home.name,
              awayName: match.away.name,
              homeLogo: match.home.logo || null,
              awayLogo: match.away.logo || null,
              homeBackupLogo: match.home.backupLogo || null,
              awayBackupLogo: match.away.backupLogo || null,
              homeScore: match.home.score,
              awayScore: match.away.score,
              shotSummary: this.diffEngine.buildShotSummary(match),
              archetypeLabel: topSig.archetypeLabel || flow.archetypeLabel || 'Gidişat Sinyali',
              narrative: flow.narrative || topSig.reasoning,
              signalTier: topSig.signalTier || 'VALUE_B_PLUS',
              tierBadge: topSig.tierBadge || 'DEĞER SİNYALİ (B+)',
              convictionScore: topSig.convictionScore || topSig.confidence,
              evidenceFactors: flow.evidenceFactors || [],
              signal: topSig,
              complementarySignal: (targetSig === quant.primarySignal ? quant.complementarySignal : null),
              title: `${topSig.selection} (%${topSig.confidence} Güven)`,
              message: topSig.reasoning
            });
          }
        }
      }

      this.store.matches.set(match.matchId, match);
      if (detectedEvents.length > 0) {
        this.store.pushEvents(detectedEvents);
      }
      if (detectedSignals.length > 0) {
        this.store.pushSignals(detectedSignals, this.store.matches);
      }

      return { detectedEvents, detectedSignals };
    });
  }

  cloneMatchSnapshot(m) {
    if (!m) return null;
    return {
      matchId: m.matchId,
      _deepHydrated: Boolean(m._deepHydrated),
      status: m.status,
      minute: m.minute,
      home: {
        name: m.home.name,
        logo: m.home.logo,
        score: m.home.score,
        redCards: m.home.redCards,
        stats: { ...m.home.stats }
      },
      away: {
        name: m.away.name,
        logo: m.away.logo,
        score: m.away.score,
        redCards: m.away.redCards,
        stats: { ...m.away.stats }
      },
      incidents: [...(m.incidents || [])]
    };
  }

  async pollMainSpine() {
    if (this.isPollingSpine) return;
    this.isPollingSpine = true;
    try {
      // Adaptive quality floor: tighten when recent signals underperform, relax slightly when they hit
      try {
        const st = this.store.getSignalStats();
        let bonus = 0;
        if (st.settledCount >= 8) {
          if (st.hitRatePct < 45) bonus = 5;
          else if (st.hitRatePct < 55) bonus = 2;
          else if (st.hitRatePct >= 70) bonus = -2;
        }
        this.quantEngine.adaptiveBonus = bonus;
      } catch (_) {}

    const tasks = [
      (async () => {
        const t0 = Date.now();
        try {
          const list = await this.flashscore.fetchMainFeed();
          this.sourceStatus.flashscore = {
            active: list.length > 0,
            lastSync: Date.now(),
            matchCount: list.length,
            latencyMs: Date.now() - t0
          };
          return list;
        } catch (_) {
          this.sourceStatus.flashscore.active = false;
          return [];
        }
      })(),
      (async () => {
        const t0 = Date.now();
        try {
          const list = await this.scores365.fetchAllScores();
          this.sourceStatus.scores365 = {
            active: list.length > 0,
            lastSync: Date.now(),
            matchCount: list.length,
            latencyMs: Date.now() - t0
          };
          return list;
        } catch (_) {
          this.sourceStatus.scores365.active = false;
          return [];
        }
      })(),
      (async () => {
        const t0 = Date.now();
        try {
          const list = await this.espn.fetchScoreboard();
          this.sourceStatus.espn = {
            active: list.length > 0,
            lastSync: Date.now(),
            matchCount: list.length,
            latencyMs: Date.now() - t0
          };
          return list;
        } catch (_) {
          this.sourceStatus.espn.active = false;
          return [];
        }
      })()
    ];

    const [fsList, s365List, espnList] = await Promise.all(tasks);
    if (!this.loggedFirstSync && (fsList.length > 0 || s365List.length > 0 || espnList.length > 0)) {
      this.loggedFirstSync = true;
      console.log(`[MultiSourceSync] Flashscore: ${fsList.length} | 365Scores: ${s365List.length} | ESPN: ${espnList.length} matches`);
    }

    const allIncoming = [...fsList, ...s365List, ...espnList];
    const nowSec = Math.floor(Date.now() / 1000);

    // 1. Separate incoming into:
    //    - trackedFinished: matches that were in our store and just turned FT/POSTPONED (must be settled & deleted!)
    //    - liveAndHt: all currently LIVE / HT matches
    //    - upcomingToday: today's SCHEDULED matches starting soon (sorted chronologically)
    const trackedFinished = [];
    const liveAndHt = [];
    const upcomingCandidates = [];

    for (const m of allIncoming) {
      if (m.status === 'LIVE' || m.status === 'HT') {
        liveAndHt.push(m);
      } else if (m.status === 'FT' || m.status === 'POSTPONED') {
        if (this.findExistingCanonicalMatch(m)) {
          trackedFinished.push(m);
        }
      } else if (m.status === 'SCHEDULED') {
        // Only include upcoming matches whose kickoff is in the future (or within the last 10 mins) and within next 24h
        if (!m.startTimestamp || (m.startTimestamp >= (nowSec - 600) && m.startTimestamp <= (nowSec + 86400))) {
          upcomingCandidates.push(m);
        }
      }
    }

    upcomingCandidates.sort((a, b) => {
      const pA = this.getLeaguePrestigeScore(a.league?.name);
      const pB = this.getLeaguePrestigeScore(b.league?.name);
      // Elite & Tier-1 tournaments (UCL, etc.) always stay in the top priority group
      if (pA >= 70 || pB >= 70) {
        if ((pA >= 70) !== (pB >= 70)) return pB - pA;
      }
      return (a.startTimestamp || 0) - (b.startTimestamp || 0);
    });
    // Support up to 450 matches so UEFA Champions League and all evening matches are NEVER truncated!
    const upcomingToday = upcomingCandidates.slice(0, 450);

    const prioritized = [...trackedFinished, ...liveAndHt, ...upcomingToday];
    const allNewEvents = [];
    const allNewSignals = [];

    // Pre-sync deduplication pass: collapse any existing duplicates in memory
    this.deduplicateStoreMatches();

    for (const raw of prioritized) {
      if (this.isJunkMatch(raw)) continue;
      const existing = this.findExistingCanonicalMatch(raw);
      const prevSnap = this.cloneMatchSnapshot(existing);

      const canonical = this.resolveCanonicalMatch(raw);
      if (!canonical.sources.includes(raw.source)) {
        canonical.sources.push(raw.source);
      }
      canonical.linkedIds[raw.source] = raw.sourceId;
      if (raw.source === '365scores') {
        canonical.linkedIds.s365HomeId = raw.home.id;
        canonical.linkedIds.s365AwayId = raw.away.id;
      }
      if (raw.kickoffTime && raw.kickoffTime !== '00:00') {
        canonical.kickoffTime = raw.kickoffTime;
      }

      // League Prestige Override: Higher prestige tournament overrides generic "Uluslararası Lig" or low prestige names
      const existingPrestige = this.getLeaguePrestigeScore(canonical.league?.name);
      const incomingPrestige = this.getLeaguePrestigeScore(raw.league?.name);
      if (incomingPrestige > existingPrestige || (!canonical.league?.name && raw.league?.name)) {
        canonical.league = { ...raw.league };
      }

      // Team name upgrade: If raw has a cleaner/longer official name and canonical had an acronym or short name
      for (const side of ['home', 'away']) {
        if (raw[side]?.name && canonical[side]?.name) {
          if (canonical[side].name.length <= 4 && raw[side].name.length > canonical[side].name.length) {
            canonical[side].name = raw[side].name;
          }
        }
      }

      // =========================================================================
      // INSTITUTIONAL FOOTBALL STATE ARBITER & MONOTONIC CLOCK
      // Guarantees clean progression: SCHEDULED -> 1st Half -> HT -> 2nd Half -> FT
      // Eliminates sticky half-time and prevents lagging feeds from pulling 2nd half back to HT
      // =========================================================================
      const isIncoming2ndHalf =
        (raw.status === 'LIVE' && raw.minute >= 46) ||
        (String(raw.statusText || '').toLowerCase().includes('2. yarı')) ||
        (String(raw.statusText || '').toLowerCase().includes('2nd half'));

      const isCanonical2ndHalf =
        (canonical.status === 'LIVE' && (canonical.minute || 0) >= 46) ||
        (String(canonical.statusText || '').toLowerCase().includes('2. yarı'));

      if (raw.status === 'FT' || raw.status === 'POSTPONED') {
        canonical.status = raw.status;
        canonical.statusText = raw.statusText || (raw.status === 'FT' ? 'Maç Sonu' : 'Ertelendi');
        if (raw.status === 'FT') canonical.minute = 90;
      } else if (canonical.status !== 'FT' && canonical.status !== 'POSTPONED') {
        if (isCanonical2ndHalf || isIncoming2ndHalf) {
          // 1. SECOND HALF IN PLAY (Minute >= 46'):
          // Strictly LIVE, never HT. Lagging feeds still reporting HT are strictly blocked from regressing the match.
          canonical.status = 'LIVE';
          const safeMin = Math.min(125, Math.max(46, raw.minute > 0 ? raw.minute : (canonical.minute || 46)));
          if (
            raw.source === '365scores' ||
            raw.source === 'espn' ||
            !canonical.minute ||
            safeMin > (canonical.minute || 0)
          ) {
            canonical.minute = safeMin;
          }
          canonical.statusText = (canonical.minute >= 90) ? 'Uzatma' : '2. Yarı';
        } else if (raw.status === 'HT' || canonical.status === 'HT') {
          // 2. HALF-TIME BREAK (Minute 45'):
          // If any authoritative source reports HT, lock to HT until active 2nd half play kicks off.
          canonical.status = 'HT';
          canonical.statusText = 'Devre Arası';
          canonical.minute = 45;
        } else if (raw.status === 'LIVE') {
          // 3. FIRST HALF IN PLAY (Minute 1' - 45'):
          canonical.status = 'LIVE';
          const safeMin = Math.min(45, Math.max(1, raw.minute > 0 ? raw.minute : (canonical.minute || 1)));
          if (
            raw.source === '365scores' ||
            raw.source === 'espn' ||
            !canonical.minute ||
            safeMin > (canonical.minute || 0)
          ) {
            canonical.minute = safeMin;
          }
          canonical.statusText = '1. Yarı';
        } else if (canonical.status === 'SCHEDULED') {
          canonical.statusText = canonical.kickoffTime || raw.statusText || '00:00';
          canonical.minute = 0;
        }
      }

      this.mergeLogos(canonical, raw);
      if (raw.odds) {
        this.mergeOdds(canonical, raw.odds, raw.source);
      }

      // Score conflict resolution: prioritize LIVE source (365scores > flashscore > espn)
      const SOURCE_SCORE_PRIORITY = { '365scores': 3, 'flashscore': 2, 'espn': 1 };
      const incomingPriority = SOURCE_SCORE_PRIORITY[raw.source] || 0;
      const currentPriority = canonical._lastScoreSource ? (SOURCE_SCORE_PRIORITY[canonical._lastScoreSource] || 0) : -1;
      const incomingHomeScore = Math.max(0, raw.home.score ?? 0);
      const incomingAwayScore = Math.max(0, raw.away.score ?? 0);
      if (
        incomingPriority >= currentPriority ||
        (incomingHomeScore + incomingAwayScore) >= ((canonical.home.score || 0) + (canonical.away.score || 0))
      ) {
        canonical.home.score = incomingHomeScore;
        canonical.away.score = incomingAwayScore;
        canonical._lastScoreSource = raw.source;
      }
      if (raw.home.htScore > 0 || raw.away.htScore > 0) {
        canonical.home.htScore = Math.max(canonical.home.htScore || 0, raw.home.htScore || 0);
        canonical.away.htScore = Math.max(canonical.away.htScore || 0, raw.away.htScore || 0);
      }
      canonical.home.redCards = Math.max(canonical.home.redCards || 0, raw.home.redCards || 0);
      canonical.away.redCards = Math.max(canonical.away.redCards || 0, raw.away.redCards || 0);

      if (raw.inlineStats) {
        this.mergeStats(canonical, raw.inlineStats);
        canonical._deepHydrated = true;
      }
      if (raw.inlineIncidents && raw.inlineIncidents.length > 0) {
        this.mergeIncidents(canonical, raw.inlineIncidents);
        canonical._deepHydrated = true;
      }

      const { detectedEvents, detectedSignals } = await this.evaluateAndCommitMatch(prevSnap, canonical);
      if (detectedEvents.length > 0) allNewEvents.push(...detectedEvents);
      if (detectedSignals.length > 0) allNewSignals.push(...detectedSignals);
    }

    // Auto-expire any stale LIVE match that started > 130 mins ago or hasn't updated in 90s at minute >= 89
    for (const m of Array.from(this.store.matches.values())) {
      if (m.status === 'LIVE' || m.status === 'HT') {
        const elapsedSinceStart = m.startTimestamp ? (nowSec - m.startTimestamp) : 0;
        const staleMs = Date.now() - (m.updatedAt || Date.now());
        if (elapsedSinceStart > 7800 || ((m.minute || 0) >= 95 && staleMs > 300000)) {
          m.status = 'FT';
          m.minute = 90;
          this.store.removeFinishedMatch(m.matchId, m);
        }
      } else if (m.status === 'SCHEDULED' && m.startTimestamp && (nowSec - m.startTimestamp) > 900) {
        // Scheduled match whose kickoff passed > 15 mins ago without going live (was 25 mins)
        this.store.matches.delete(m.matchId);
      }
    }

    // Post-sync deduplication pass: collapse any newly introduced duplicates across feeds
    this.deduplicateStoreMatches();

    this.store.pruneNotifications();

    if (allNewEvents.length > 0 || allNewSignals.length > 0) {
      this.onBroadcast({
        type: 'NEW_EVENTS',
        events: allNewEvents,
        signals: allNewSignals,
        signalLedger: this.store.getSignalLedger(),
        signalStats: this.store.getSignalStats(),
        sourceStatus: this.sourceStatus
      });
    }

    // Always broadcast STATE_SYNC on spine poll so scores, minutes & signal settlements reflect in <2.5s!
    this.onBroadcast({
      type: 'STATE_SYNC',
      matches: this.store.getSortedMatches(),
      events: [],
      signals: [],
      signalLedger: this.store.getSignalLedger(),
      signalStats: this.store.getSignalStats(),
      sourceStatus: this.sourceStatus
    });
    } finally {
      this.isPollingSpine = false;
    }
  }

  async enrichSingleMatch(match) {
    if (!match || match.status === 'FT' || match.status === 'POSTPONED') {
      return { detectedEvents: [], detectedSignals: [] };
    }
    const prevSnap = this.cloneMatchSnapshot(match);
    const promises = [];

    const fsId = match.linkedIds.flashscore;
    if (fsId) {
      if (match.status === 'LIVE' || match.status === 'HT') {
        promises.push(
          this.flashscore.fetchMatchIncidents(fsId)
            .then(inc => this.mergeIncidents(match, inc))
            .catch(() => {}),
          this.flashscore.fetchMatchStats(fsId)
            .then(st => this.mergeStats(match, st, 'flashscore'))
            .catch(() => {})
        );
      }
      promises.push(
        this.flashscore.fetchMatchOdds(fsId)
          .then(od => this.mergeOdds(match, od, 'flashscore'))
          .catch(() => {})
      );
    }

    const s365Id = match.linkedIds['365scores'];
    if (s365Id) {
      if (match.status === 'LIVE' || match.status === 'HT') {
        promises.push(
          this.scores365.fetchMatchStats(s365Id, match.linkedIds.s365HomeId, match.linkedIds.s365AwayId)
            .then(st => this.mergeStats(match, st, '365scores'))
            .catch(() => {})
        );
      }
      // 365Scores olay ve oranlarını tek optimize HTTP isteğiyle çek (gecikmeyi yarıya indirir)
      promises.push(
        this.scores365.fetchGameDetails(s365Id, match.linkedIds.s365HomeId, match.linkedIds.s365AwayId)
          .then(res => {
            if (res.odds) this.mergeOdds(match, res.odds, '365scores');
            if (res.incidents && res.incidents.length > 0) this.mergeIncidents(match, res.incidents);
          })
          .catch(() => {})
      );
    }

    const espnId = match.linkedIds.espn;
    if (espnId && (match.status === 'LIVE' || match.status === 'HT')) {
      promises.push(
        this.espn.fetchMatchSummary(espnId)
          .then(summary => {
            if (!summary) return;
            if (summary.stats) this.mergeStats(match, summary.stats, 'espn');
            if (summary.incidents && summary.incidents.length > 0) this.mergeIncidents(match, summary.incidents);
            if (summary.shotmap && summary.shotmap.length > 0) match.shotmap = summary.shotmap;
            if (summary.odds) this.mergeOdds(match, summary.odds, 'espn');
          })
          .catch(() => {})
      );
    }

    await Promise.allSettled(promises);
    match._deepHydrated = true;
    match._deepCount = (match._deepCount || 0) + 1;

    // Resynchronize baseline score & minute from store to eliminate race condition with spine poller
    const currentInStore = this.store.matches.get(match.matchId);
    if (currentInStore && prevSnap) {
      prevSnap.home.score = currentInStore.home.score;
      prevSnap.away.score = currentInStore.away.score;
      prevSnap.minute = currentInStore.minute;
      prevSnap.status = currentInStore.status;
    }

    return await this.evaluateAndCommitMatch(prevSnap, match);
  }

  async pollDeepTelemetry() {
    if (this.isPollingDeep) return;
    this.isPollingDeep = true;
    try {
      const allMatches = Array.from(this.store.matches.values());
      if (allMatches.length === 0) return;

      const tier1 = allMatches.filter(m => m.status === 'LIVE' || m.status === 'HT' || m.isStarred);
      const upcoming = allMatches.filter(m => !m.isStarred && m.status === 'SCHEDULED');
      const batchSize = 5;
      const tier2Batch = upcoming.slice(this.deepRoundRobinIdx, this.deepRoundRobinIdx + batchSize);
      this.deepRoundRobinIdx = (this.deepRoundRobinIdx + batchSize) % Math.max(1, upcoming.length);

      // Deep Telemetry: refresh 100% of all active LIVE / HT / Starred matches without truncation
      const targets = [...tier1, ...tier2Batch];
      const newEvents = [];
      const newSignals = [];

      // Concurrency batch size: 8 with ultra-smooth low-latency jittered pacing
      const chunkSize = 8;
      for (let i = 0; i < targets.length; i += chunkSize) {
        const chunk = targets.slice(i, i + chunkSize);
        const res = await Promise.allSettled(chunk.map(m => this.enrichSingleMatch(m)));
        for (const item of res) {
          if (item.status === 'fulfilled') {
            const r = item.value;
            if (r?.detectedEvents?.length > 0) newEvents.push(...r.detectedEvents);
            if (r?.detectedSignals?.length > 0) newSignals.push(...r.detectedSignals);
          }
        }
        if (i + chunkSize < targets.length) {
          const chunkJitter = Math.floor(Math.random() * 20) + 15;
          await new Promise(resolve => setTimeout(resolve, chunkJitter));
        }
      }

      this.store.pruneNotifications();

      this.onBroadcast({
        type: 'STATE_SYNC',
        matches: this.store.getSortedMatches(),
        events: newEvents,
        signals: newSignals,
        signalLedger: this.store.getSignalLedger(),
        signalStats: this.store.getSignalStats(),
        sourceStatus: this.sourceStatus
      });
    } finally {
      this.isPollingDeep = false;
    }
  }

  hasLiveMatches() {
    for (const match of this.store.matches.values()) {
      if (match.status === 'LIVE' || match.status === 'HT') {
        return true;
      }
    }
    return false;
  }

  getSpineInterval() {
    // Spine polling: Canlı maç varken anlık 1.3s, sadece yaklaşan maçlar varken 3.8s
    return this.hasLiveMatches() ? 1300 : 3800;
  }

  scheduleSpinePoll() {
    if (!this.isRunning) return;
    const interval = this.getSpineInterval();
    this.spineTimer = setTimeout(async () => {
      try {
        await this.pollMainSpine();
      } catch (err) {
        console.error('[Spine Poll Error]', err.message);
      } finally {
        this.scheduleSpinePoll();
      }
    }, interval);
  }

  scheduleDeepTelemetry() {
    if (!this.isRunning) return;
    // Deep telemetry: Canlı maç varken 1.7s, sakin zamanlarda 3.8s
    const deepInterval = this.hasLiveMatches() ? 1700 : 3800;
    this.deepTimer = setTimeout(async () => {
      try {
        await this.pollDeepTelemetry();
      } catch (err) {
        console.error('[Deep Poll Error]', err.message);
      } finally {
        this.scheduleDeepTelemetry();
      }
    }, deepInterval);
  }

  pruneStaleMatches(timeoutMs = 12 * 60 * 1000) {
    const removed = new Set(this.store.pruneStaleMatches(Date.now(), timeoutMs));
    if (removed.size > 0) {
      for (const [srcKey, canonicalId] of this.linkCache.entries()) {
        if (removed.has(canonicalId) || !this.store.matches.has(canonicalId)) {
          this.linkCache.delete(srcKey);
        }
      }
      this.diffEngine.pruneByMatchIds(removed);
    }
    return Array.from(removed);
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[Orchestrator] Initializing Multi-Source Scrapers (Flashscore + 365Scores + ESPN)...');

    await this.pollMainSpine();
    await this.pollDeepTelemetry();

    // High-speed adaptive spine polling: 2.0s when live matches exist, 4.5s when upcoming only
    this.scheduleSpinePoll();

    // High-speed 2.8s deep stats & odds enrichment
    this.scheduleDeepTelemetry();

    // Prune stale matches: 12 minutes inactivity timeout every 2 minutes
    this.gcTimer = setInterval(() => {
      this.pruneStaleMatches(12 * 60 * 1000);
    }, 2 * 60 * 1000);
  }

  stop() {
    this.isRunning = false;
    if (this.spineTimer) {
      clearTimeout(this.spineTimer);
      clearInterval(this.spineTimer);
    }
    if (this.deepTimer) {
      clearTimeout(this.deepTimer);
      clearInterval(this.deepTimer);
    }
    if (this.gcTimer) clearInterval(this.gcTimer);
  }
}

module.exports = MultiSourceOrchestrator;
