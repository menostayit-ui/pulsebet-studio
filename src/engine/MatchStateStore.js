/**
 * PulseBet Studio — In-Memory Match State, Ephemeral Notification & Signal Ledger Store (V4)
 * Features:
 *  - Zero FT matches in store: Finished matches immediately settle their signals and are removed from the match list & radar
 *  - Real-time Signal Settlement Ledger (✅ TUTTU / ❌ TUTMADI / ⏳ AKTİF) with Hit-Rate % scoreboard
 *  - Canonical match states & 5m/10m sliding stat windows for LIVE & SCHEDULED (Upcoming) matches
 *  - Ephemeral match event notifications with strict TTL
 */

const fs = require('fs');
const path = require('path');
const SignalSettlementEngine = require('./SignalSettlementEngine');

class MatchStateStore {
  constructor() {
    this.matches = new Map();        // matchId -> CanonicalMatch (Strictly LIVE, HT, SCHEDULED only)
    this.snapshots = new Map();      // matchId -> Array<{ ts, minute, homeStats, awayStats, odds }>
    this.eventHistory = [];          // Ephemeral live match event notifications
    this.signalHistory = [];         // Live betting signal notifications (with settlementStatus)
    this.signalLedger = [];          // Tracked signals for Tuttu / Tutmadı Hit-Rate Radar
    this.maxEvents = 80;
    this.maxSignals = 80;
    this.signalFingerprints = new Set();

    this.settlementEngine = new SignalSettlementEngine();
    this.prefsPath = path.join(__dirname, '..', '..', 'data', 'preferences.json');
    this.starredMatchIds = new Set();
    this.loadPreferences();
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

  loadPreferences() {
    try {
      if (fs.existsSync(this.prefsPath)) {
        const raw = JSON.parse(fs.readFileSync(this.prefsPath, 'utf8'));
        if (Array.isArray(raw.starredMatchIds)) {
          this.starredMatchIds = new Set(raw.starredMatchIds);
        }
      }
    } catch (_) {}
  }

  savePreferences() {
    const dir = path.dirname(this.prefsPath);
    const payload = JSON.stringify({
      starredMatchIds: Array.from(this.starredMatchIds).slice(-200)
    }, null, 2);
    fs.promises.mkdir(dir, { recursive: true })
      .then(() => fs.promises.writeFile(this.prefsPath, payload, 'utf8'))
      .catch(() => {});
  }

  hasSignalFingerprint(fp) {
    if (this.signalFingerprints.has(fp)) return true;
    this.signalFingerprints.add(fp);
    if (this.signalFingerprints.size > 3000) {
      const oldest = this.signalFingerprints.values().next().value;
      this.signalFingerprints.delete(oldest);
    }
    return false;
  }

  toggleStar(matchId) {
    if (this.starredMatchIds.has(matchId)) {
      this.starredMatchIds.delete(matchId);
    } else {
      this.starredMatchIds.add(matchId);
    }
    const m = this.matches.get(matchId);
    if (m) m.isStarred = this.starredMatchIds.has(matchId);
    this.savePreferences();
    return this.starredMatchIds.has(matchId);
  }

  isStarred(matchId) {
    return this.starredMatchIds.has(matchId);
  }

  recordSnapshot(match) {
    if (!match || (match.status !== 'LIVE' && match.status !== 'HT')) return;
    // Never record an empty cold-start baseline: cumulative stats arriving later would be misread as a last-5-min burst
    if (!match._statsHydrated) return;
    const id = match.matchId;
    if (!this.snapshots.has(id)) {
      this.snapshots.set(id, []);
    }
    const list = this.snapshots.get(id);
    const now = Date.now();

    const last = list[list.length - 1];
    const hS = match.home.stats || {};
    const aS = match.away.stats || {};

    // During HT, avoid pushing repetitive duplicate snapshots every 15s if stats have not changed
    if (match.status === 'HT' && last && last.minute === 45) {
      const statsUnchanged =
        last.homeStats.totalShots === hS.totalShots &&
        last.awayStats.totalShots === aS.totalShots &&
        last.homeStats.fouls === hS.fouls &&
        last.awayStats.fouls === aS.fouls;
      if (statsUnchanged) return;
    }

    const shouldPush = !last ||
      (now - last.ts >= 15000) ||
      (last.homeStats.totalShots !== hS.totalShots) ||
      (last.awayStats.totalShots !== aS.totalShots) ||
      (last.homeStats.fouls !== hS.fouls) ||
      (last.awayStats.fouls !== aS.fouls);

    if (shouldPush) {
      list.push({
        ts: now,
        minute: match.minute || 1,
        homeStats: { ...hS },
        awayStats: { ...aS },
        odds: match.odds ? { ...match.odds } : null
      });
      if (list.length > 80) list.shift();
    }
  }

  getSlidingWindows(match) {
    const id = match.matchId;
    const list = this.snapshots.get(id) || [];
    const now = Date.now();
    const currMin = Math.max(1, match.minute || 1);
    const minNow = Math.max(5, currMin);

    const hNow = match.home.stats || {};
    const aNow = match.away.stats || {};

    // Match minute window selector: finds snapshot closest to target match minute delta
    const findSnapForWindow = (targetWindow) => {
      if (!list || list.length === 0) return null;
      let bestSnap = list[0];
      let minDiff = Infinity;
      for (const s of list) {
        const delta = Math.max(0, currMin - (s.minute || 1));
        const diff = Math.abs(delta - targetWindow);
        if (diff < minDiff) {
          minDiff = diff;
          bestSnap = s;
        }
      }
      return bestSnap;
    };

    const snap5 = findSnapForWindow(5);
    const snap10 = findSnapForWindow(10);

    const diffStats = (curr, prevStats, prevSnap, windowMins) => {
      const prevMin = prevSnap ? (prevSnap.minute || 1) : currMin;
      const matchMinDelta = Math.max(0, currMin - prevMin);

      // Official Match Minute Delta: eliminate the 15-minute halftime wall-clock gap.
      // If matchMinDelta >= 1, use official match minutes directly.
      // For intra-minute resolution (matchMinDelta === 0), use bounded sub-minute fraction (0.5 to 1.0).
      const elapsedMatchMins = prevSnap
        ? (matchMinDelta >= 1 ? matchMinDelta : Math.min(1.0, Math.max(0.5, (now - prevSnap.ts) / 60000)))
        : 0;

      const coverage = Math.min(1.0, elapsedMatchMins / windowMins);
      const windowConfidence = Number(coverage.toFixed(2));
      const unobservedShare = coverage < 1.0 ? Math.max(0, 1.0 - coverage) : 0;

      const keys = [
        'totalShots', 'shotsOnTarget', 'shotsOffTarget', 'blockedShots',
        'shotsInsideBox', 'bigChances', 'woodwork', 'corners', 'fouls',
        'yellowCards', 'redCards', 'dangerousAttacks', 'saves', 'offsides',
        'touchesInBox', 'xg'
      ];
      const out = {};
      const observedDelta = {};
      const estimatedRate = {};

      for (const k of keys) {
        const cVal = curr[k] || 0;
        const pVal = prevStats ? (prevStats[k] || 0) : 0;
        const rawDelta = prevStats ? Math.max(0, cVal - pVal) : 0;
        const rateEst = (cVal / minNow) * windowMins;

        observedDelta[k] = rawDelta;
        estimatedRate[k] = Number(rateEst.toFixed(2));

        if (coverage >= 1.0) {
          // Fully observed window: scale observed delta if elapsed > windowMins, strictly NO rate estimation blending
          const scaled = rawDelta * (windowMins / Math.max(windowMins, elapsedMatchMins));
          out[k] = Number(scaled.toFixed(2));
        } else {
          // Partially observed or cold start: blend observed delta with match-average rate estimate ONLY for unobserved share
          const scaled = prevStats ? rawDelta * (windowMins / Math.max(windowMins, elapsedMatchMins || windowMins)) : 0;
          out[k] = Number((scaled + rateEst * unobservedShare).toFixed(2));
        }
      }

      const meta = {
        coverage,
        observedDelta,
        estimatedRate,
        windowConfidence,
        elapsedMatchMins
      };

      out._meta = meta;
      out.coverage = coverage;
      out.windowConfidence = windowConfidence;
      out.elapsedMatchMins = elapsedMatchMins;
      out.observedDelta = observedDelta;
      out.estimatedRate = estimatedRate;

      return out;
    };

    return {
      delta5: {
        home: diffStats(hNow, snap5?.homeStats, snap5, 5),
        away: diffStats(aNow, snap5?.awayStats, snap5, 5)
      },
      delta10: {
        home: diffStats(hNow, snap10?.homeStats, snap10, 10),
        away: diffStats(aNow, snap10?.awayStats, snap10, 10)
      }
    };
  }

  /**
   * Evaluate all tracked signals for a given match in real time (WON / LOST / PENDING / UNDER_REVIEW / INVALIDATED)
   * Preserves historical signals in the ledger and history without deletion.
   * If an Over signal was discovered to have been placed on an unsafe state (isFilteredUnsafeOver),
   * it is marked INVALIDATED.
   */
  settleSignalsForMatch(match) {
    if (!match) return false;
    let changed = false;
    const linkedIdValues = new Set([match.matchId, ...Object.values(match.linkedIds || {})]);

    // Safety Gatekeeper: Skoru ne olursa olsun (veya 1-1 iken), tetiklenme anında 2+ gol gereken
    // filtreli/hatalı Üst sinyallerini silmek yerine INVALIDATED olarak işaretle
    const isFilteredUnsafeOver = (sel, trigTot, line) => {
      if (!sel || !sel.includes('Üst')) return false;
      let l = line;
      if (l === undefined || l === null || isNaN(l)) {
        const m = sel.match(/(\d+\.?\d*)/);
        l = m ? parseFloat(m[1]) : 2.5;
      }
      const needed = (Math.floor(l) + 1) - (trigTot || 0);
      return needed >= 2;
    };

    for (const rec of this.signalLedger) {
      if (linkedIdValues.has(rec.matchId)) {
        rec.matchId = match.matchId;
        const trigTot = rec.triggerTotalGoals ?? ((rec.triggerScoreHome || 0) + (rec.triggerScoreAway || 0));

        if (isFilteredUnsafeOver(rec.selection, trigTot, rec.line)) {
          if (rec.settlementStatus !== 'INVALIDATED') {
            rec.settlementStatus = 'INVALIDATED';
            rec.settlementBadge = 'GEÇERSİZ KILINDI';
            rec.settlementDetail = 'Kazanmak için 2+ gol gereken filtre kuralı nedeniyle geçersiz';
            changed = true;
          }
        } else {
          const prevStatus = rec.settlementStatus;
          const prevBadge = rec.settlementBadge;
          this.settlementEngine.evaluateSignal(rec, match);
          if (rec.settlementStatus !== prevStatus || rec.settlementBadge !== prevBadge) {
            changed = true;
          }
        }
      }
    }

    // Sync settlement status onto signalHistory notifications as well (never deleting historical signals)
    for (const sig of this.signalHistory) {
      if (linkedIdValues.has(sig.matchId)) {
        sig.matchId = match.matchId;
        const ledgerItem = this.signalLedger.find(r => r.id === sig.id || (r.matchId === sig.matchId && r.selection === sig.signal?.selection));
        if (ledgerItem) {
          if (sig.settlementStatus !== ledgerItem.settlementStatus || sig.settlementBadge !== ledgerItem.settlementBadge) {
            changed = true;
          }
          sig.settlementStatus = ledgerItem.settlementStatus;
          sig.settlementBadge = ledgerItem.settlementBadge;
          sig.settlementDetail = ledgerItem.settlementDetail;
          sig.currentScoreHome = ledgerItem.currentScoreHome;
          sig.currentScoreAway = ledgerItem.currentScoreAway;
          sig.currentMinute = ledgerItem.currentMinute;
          sig.matchStatus = ledgerItem.matchStatus;
        } else {
          const trigTot = (sig.homeScore !== undefined && sig.awayScore !== undefined)
            ? (sig.homeScore + sig.awayScore)
            : ((sig.triggerScoreHome || 0) + (sig.triggerScoreAway || 0));
          const sel = sig.signal?.selection || sig.title || '';
          if (isFilteredUnsafeOver(sel, trigTot, sig.signal?.line)) {
            if (sig.settlementStatus !== 'INVALIDATED') {
              sig.settlementStatus = 'INVALIDATED';
              sig.settlementBadge = 'GEÇERSİZ KILINDI';
              sig.settlementDetail = 'Kazanmak için 2+ gol gereken filtre kuralı nedeniyle geçersiz';
              changed = true;
            }
          }
        }
      }
    }

    return changed;
  }

  /**
   * Settle signals for a match that just finished (FT) or was postponed, then completely remove it from store.matches
   */
  removeFinishedMatch(matchId, finalMatchObj = null) {
    const existing = finalMatchObj || this.matches.get(matchId);
    if (existing) {
      existing.status = finalMatchObj?.status || 'FT';
      existing.minute = 90;
      this.settleSignalsForMatch(existing);
    }
    this.matches.delete(matchId);
    this.snapshots.delete(matchId);
    this.eventHistory = this.eventHistory.filter(e => e.matchId !== matchId);
  }

  pruneMatchNotifications(matchId, signalsOnly = false) {
    if (!signalsOnly) {
      this.eventHistory = this.eventHistory.filter(e => e.matchId !== matchId);
    }
  }

  /**
   * Continuously purge stale match event notifications and any finished matches
   */
  pruneNotifications() {
    const now = Date.now();
    const EVENT_TTL = 3 * 60 * 1000; // 3 minutes max lifetime for match event notifications

    // Ensure zero FT matches ever stay in this.matches
    for (const [id, m] of this.matches.entries()) {
      if (m.status === 'FT' || m.status === 'POSTPONED' || m.status === 'FINISHED') {
        this.removeFinishedMatch(id, m);
      }
    }

    this.eventHistory = this.eventHistory.filter(ev => {
      if (now - (ev.timestamp || now) > EVENT_TTL) return false;
      const m = this.matches.get(ev.matchId);
      if (!m || m.status !== 'LIVE') return false;
      return true;
    });
  }

  clearNotifications(type = 'ALL') {
    if (type === 'SIGNALS' || type === 'ALL') {
      this.signalHistory = [];
      this.signalLedger = [];
    }
    if (type === 'EVENTS' || type === 'ALL') {
      this.eventHistory = [];
    }
  }

  pushEvents(newEvents) {
    if (!Array.isArray(newEvents) || newEvents.length === 0) return [];
    const matchEvts = newEvents.filter(e => e.category !== 'signal' && e.type !== 'BETTING_SIGNAL');
    for (const ev of matchEvts) {
      this.eventHistory.unshift(ev);
    }
    this.pruneNotifications();
    if (this.eventHistory.length > this.maxEvents) {
      this.eventHistory.length = this.maxEvents;
    }
    return matchEvts;
  }

  pushSignals(newSignals, matchMap = this.matches) {
    if (!Array.isArray(newSignals) || newSignals.length === 0) return [];

    // Safety Gatekeeper: Skoru ne olursa olsun (veya 1-1 iken), kazanması için 2+ gol gereken Üst sinyallerini filtrele
    const validSignals = newSignals.filter(sig => {
      const sel = String(sig.signal?.selection || sig.title || '');
      if (sel.includes('Üst')) {
        let match = matchMap.get(sig.matchId);
        const gH = match?.home?.score ?? sig.homeScore ?? sig.triggerScoreHome ?? 0;
        const gA = match?.away?.score ?? sig.awayScore ?? sig.triggerScoreAway ?? 0;
        const currentGoals = gH + gA;
        let line = sig.signal?.line;
        if (line === undefined || line === null || isNaN(line)) {
          const m = sel.match(/(\d+\.?\d*)/);
          line = m ? parseFloat(m[1]) : 2.5;
        }
        const needed = (Math.floor(line) + 1) - currentGoals;
        if (needed >= 2) return false;
      }
      return true;
    });

    for (const sig of validSignals) {
      let match = matchMap.get(sig.matchId);
      if (!match) {
        for (const m of matchMap.values()) {
          const linkedVals = Object.values(m.linkedIds || {});
          if (m.matchId === sig.matchId || linkedVals.includes(sig.matchId)) {
            match = m;
            sig.matchId = m.matchId;
            break;
          }
        }
      }
      const tracked = this.settlementEngine.createTrackedSignal(sig, match);

      sig.settlementStatus = tracked.settlementStatus;
      sig.settlementBadge = tracked.settlementBadge;
      sig.settlementDetail = tracked.settlementDetail;
      sig.triggerScoreHome = tracked.triggerScoreHome;
      sig.triggerScoreAway = tracked.triggerScoreAway;
      sig.triggerMinute = tracked.triggerMinute;
      sig.currentScoreHome = tracked.currentScoreHome;
      sig.currentScoreAway = tracked.currentScoreAway;

      // Avoid duplicate active signals for the exact same match & selection in ledger
      this.signalLedger = this.signalLedger.filter(
        r => !(r.matchId === tracked.matchId && r.selection === tracked.selection && r.settlementStatus === 'PENDING')
      );
      this.signalLedger.unshift(tracked);

      this.signalHistory = this.signalHistory.filter(
        s => !(s.matchId === sig.matchId && s.signal?.selection === sig.signal?.selection)
      );
      this.signalHistory.unshift(sig);
    }

    if (this.signalLedger.length > this.settlementEngine.maxLedgerSize) {
      this.signalLedger.length = this.settlementEngine.maxLedgerSize;
    }
    if (this.signalHistory.length > this.maxSignals) {
      this.signalHistory.length = this.maxSignals;
    }
    return validSignals;
  }

  getSignalStats() {
    return this.settlementEngine.computeStats(this.signalLedger);
  }

  getSignalLedger() {
    return this.signalLedger;
  }

  pruneStaleMatches(now = Date.now(), maxAgeMs = 12 * 60 * 1000) {
    const nowSec = Math.floor(now / 1000);
    const removedIds = [];

    for (const [id, match] of this.matches.entries()) {
      const age = now - (match.updatedAt || now);
      // 1. Remove any FT or POSTPONED match immediately
      if (match.status === 'FT' || match.status === 'POSTPONED') {
        this.removeFinishedMatch(id, match);
        removedIds.push(id);
        continue;
      }
      // 2. Remove any LIVE match that hasn't been updated by any feed in 12 minutes or started > 3.5 hours ago
      if ((match.status === 'LIVE' || match.status === 'HT') && (age > maxAgeMs || (match.startTimestamp && (nowSec - match.startTimestamp) > 3.5 * 3600))) {
        match.status = 'FT';
        this.removeFinishedMatch(id, match);
        removedIds.push(id);
        continue;
      }
      // 3. Remove any SCHEDULED match whose kickoff time passed > 25 minutes ago without turning LIVE
      if (match.status === 'SCHEDULED' && match.startTimestamp && (nowSec - match.startTimestamp) > 25 * 60) {
        this.matches.delete(id);
        removedIds.push(id);
      }
    }
    return removedIds;
  }

  /**
   * Returns strictly active (LIVE / HT) and upcoming (SCHEDULED) matches.
   * Zero FT matches are ever returned.
   */
  getSortedMatches() {
    const arr = Array.from(this.matches.values()).filter(
      m => m.status === 'LIVE' || m.status === 'HT' || m.status === 'SCHEDULED'
    );

    return arr.sort((a, b) => {
      // 1. Starred matches first
      if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;

      // 2. LIVE -> HT -> SCHEDULED
      const rankStatus = (s) => (s === 'LIVE' ? 0 : (s === 'HT' ? 1 : 2));
      const rA = rankStatus(a.status);
      const rB = rankStatus(b.status);
      if (rA !== rB) return rA - rB;

      // 3. For SCHEDULED (Upcoming) matches, sort chronologically by kickoff timestamp, but prioritize Elite tournaments (UCL, etc.) within adjacent time blocks
      if (a.status === 'SCHEDULED' && b.status === 'SCHEDULED') {
        const timeDiff = (a.startTimestamp || 0) - (b.startTimestamp || 0);
        // Within 45 minutes of each other, show Elite tournament matches (like Champions League) first!
        if (Math.abs(timeDiff) <= 2700) {
          const pA = this.getLeaguePrestigeScore(a.league?.name);
          const pB = this.getLeaguePrestigeScore(b.league?.name);
          if (pA !== pB) return pB - pA;
        }
        return timeDiff;
      }

      // 4. For LIVE / HT matches, Signal Triggered first, then Watchlist, then higher IGP
      const sigRank = (m) => {
        const st = m.analysis?.quant?.signalStatus;
        if (st === 'SIGNAL_TRIGGERED') return 2;
        if (st === 'WATCHLIST') return 1;
        return 0;
      };
      const sA = sigRank(a);
      const sB = sigRank(b);
      if (sB !== sA) return sB - sA;

      const igpA = Math.max(a.analysis?.flow?.igpHome || 0, a.analysis?.flow?.igpAway || 0);
      const igpB = Math.max(b.analysis?.flow?.igpHome || 0, b.analysis?.flow?.igpAway || 0);
      if (igpB !== igpA) return igpB - igpA;

      return (a.startTimestamp || 0) - (b.startTimestamp || 0);
    });
  }
}

module.exports = MatchStateStore;
