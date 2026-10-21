/**
 * PulseBet Pro — Sub-Millisecond State Diff & Live Event Detection Engine
 * Strictly detects ONLY real-time live deltas (Goals, Disallowed Goals/VAR, Assists,
 * Shots On/Off Target with Home & Away breakdown, Fouls, Yellow/Red Cards)
 * on actively playing LIVE matches. Zero historical spam on initial load or deep hydration.
 */

class StateDiffEngine {
  constructor() {
    this.emittedFingerprints = new Set();
    this.maxFingerprints = 5000;
  }

  hasEmitted(fp) {
    if (this.emittedFingerprints.has(fp)) return true;
    this.emittedFingerprints.add(fp);
    if (this.emittedFingerprints.size > this.maxFingerprints) {
      const first = this.emittedFingerprints.values().next().value;
      this.emittedFingerprints.delete(first);
    }
    return false;
  }

  pruneByMatchIds(removedMatchIds) {
    if (!removedMatchIds || removedMatchIds.size === 0) return;
    for (const fp of this.emittedFingerprints) {
      const prefix = fp.split(':', 1)[0];
      if (removedMatchIds.has(prefix)) {
        this.emittedFingerprints.delete(fp);
      }
    }
  }

  buildShotSummary(match) {
    const h = match.home.stats || {};
    const a = match.away.stats || {};
    return {
      home: {
        total: h.totalShots || 0,
        onTarget: h.shotsOnTarget || 0,
        offTarget: h.shotsOffTarget || 0,
        blocked: h.blockedShots || 0
      },
      away: {
        total: a.totalShots || 0,
        onTarget: a.shotsOnTarget || 0,
        offTarget: a.shotsOffTarget || 0,
        blocked: a.blockedShots || 0
      }
    };
  }

  /**
   * Silently seed baseline counters & existing incidents when a match is first seen
   * or first deep-hydrated so historical events never spam the live notification feed.
   */
  seedBaselineSilently(match) {
    if (!match) return [];
    for (const inc of (match.incidents || [])) {
      this.hasEmitted(`${match.matchId}:inc:${inc.id}`);
    }
    this.recordStatCounters(match);
    return [];
  }

  recordStatCounters(match) {
    const h = match.home.stats || {};
    const a = match.away.stats || {};
    this.hasEmitted(`${match.matchId}:score_up:HOME:${match.home.score || 0}`);
    this.hasEmitted(`${match.matchId}:score_up:AWAY:${match.away.score || 0}`);
    this.hasEmitted(`${match.matchId}:sot:HOME:${h.shotsOnTarget || 0}`);
    this.hasEmitted(`${match.matchId}:sot:AWAY:${a.shotsOnTarget || 0}`);
    this.hasEmitted(`${match.matchId}:soff:HOME:${(h.shotsOffTarget || 0) + (h.blockedShots || 0)}`);
    this.hasEmitted(`${match.matchId}:soff:AWAY:${(a.shotsOffTarget || 0) + (a.blockedShots || 0)}`);
    this.hasEmitted(`${match.matchId}:foul:HOME:${h.fouls || 0}`);
    this.hasEmitted(`${match.matchId}:foul:AWAY:${a.fouls || 0}`);
    this.hasEmitted(`${match.matchId}:yc:HOME:${h.yellowCards || 0}`);
    this.hasEmitted(`${match.matchId}:yc:AWAY:${a.yellowCards || 0}`);
    this.hasEmitted(`${match.matchId}:rc:HOME:${Math.max(match.home.redCards || 0, h.redCards || 0)}`);
    this.hasEmitted(`${match.matchId}:rc:AWAY:${Math.max(match.away.redCards || 0, a.redCards || 0)}`);
  }

  /**
   * Compare prevMatch and nextMatch in <1ms and return array of newly detected real-time events.
   * Strictly emits ONLY for actively playing LIVE matches (minute < 90).
   */
  diff(prevMatch, nextMatch) {
    if (!nextMatch) return [];

    // 1. Strict Live Shield: Never emit notifications for FT, HT, SCHEDULED, or 90+ finished matches
    const isStrictlyLive = nextMatch.status === 'LIVE' && (nextMatch.minute || 0) >= 1 && (nextMatch.minute || 0) < 90;
    if (!isStrictlyLive) {
      return this.seedBaselineSilently(nextMatch);
    }

    // 2. First time seeing this match -> silently seed baseline
    if (!prevMatch) {
      return this.seedBaselineSilently(nextMatch);
    }

    // 3. First deep hydration guard: when deep stats/incidents arrive for the first time,
    // silently seed existing historical stats/incidents instead of firing bulk delta notifications.
    const isFirstDeepHydration = !prevMatch._deepHydrated && nextMatch._deepHydrated;
    if (isFirstDeepHydration) {
      this.seedBaselineSilently(nextMatch);
      return [];
    }

    const events = [];
    const shotSummary = this.buildShotSummary(nextMatch);
    const minLabel = `${nextMatch.minute || 1}'`;
    const baseMeta = {
      matchId: nextMatch.matchId,
      leagueName: nextMatch.league?.name || 'Lig',
      homeName: nextMatch.home.name,
      awayName: nextMatch.away.name,
      homeLogo: nextMatch.home.logo || null,
      awayLogo: nextMatch.away.logo || null,
      homeBackupLogo: nextMatch.home.backupLogo || null,
      awayBackupLogo: nextMatch.away.backupLogo || null,
      homeScore: nextMatch.home.score,
      awayScore: nextMatch.away.score,
      shotSummary
    };

    // 1. Score-based Instant Goal or Disallowed Goal (Score Rollback)
    const scoreIncreasedTeams = new Set();
    for (const side of ['home', 'away']) {
      const teamCode = side === 'home' ? 'HOME' : 'AWAY';
      const teamName = nextMatch[side].name;
      const teamLogo = nextMatch[side].logo || null;
      const prevScore = prevMatch[side].score || 0;
      const nextScore = nextMatch[side].score || 0;

      if (nextScore > prevScore) {
        scoreIncreasedTeams.add(teamCode);
      }

      if (nextScore > prevScore && (nextScore - prevScore) === 1) {
        const fp = `${nextMatch.matchId}:score_up:${teamCode}:${nextScore}`;
        if (!this.hasEmitted(fp)) {
          const goalInc = (nextMatch.incidents || []).find(
            i => i.eventType === 'GOAL' && i.team === teamCode && Math.abs((i.minute || nextMatch.minute) - nextMatch.minute) <= 4
          );
          events.push({
            id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(),
            type: 'GOAL',
            category: 'goal',
            minute: nextMatch.minute || 1,
            minuteLabel: minLabel,
            team: teamCode,
            teamName,
            teamLogo,
            playerName: goalInc?.playerName || null,
            assistPlayerName: goalInc?.assistPlayerName || null,
            title: `GOL! ${teamName} (${nextMatch.home.score} - ${nextMatch.away.score})`,
            message: goalInc?.playerName
              ? `${goalInc.playerName} skoru ${nextMatch.home.score}-${nextMatch.away.score} yaptı!${goalInc.assistPlayerName ? ` (Asist: ${goalInc.assistPlayerName})` : ''}`
              : `${teamName} ağları havalandırdı! Canlı skor: ${nextMatch.home.score} - ${nextMatch.away.score}`,
            ...baseMeta
          });
        }
      } else if (nextScore < prevScore && prevMatch.status === 'LIVE') {
        const fp = `${nextMatch.matchId}:score_rollback:${teamCode}:${prevScore}_to_${nextScore}`;
        if (!this.hasEmitted(fp)) {
          events.push({
            id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(),
            type: 'GOAL_DISALLOWED',
            category: 'disallowed_goal',
            minute: nextMatch.minute || 1,
            minuteLabel: minLabel,
            team: teamCode,
            teamName,
            teamLogo,
            title: `İPTAL EDİLEN GOL (VAR) — ${teamName}`,
            message: `${teamName} golü VAR incelemesi sonrası iptal edildi. Skor ${nextMatch.home.score}-${nextMatch.away.score} olarak güncellendi.`,
            ...baseMeta
          });
        }
      }
    }

    // 2. Check new Incidents (only recent incidents within 3 minutes of current match clock)
    for (const inc of (nextMatch.incidents || [])) {
      const fp = `${nextMatch.matchId}:inc:${inc.id}`;
      if (this.hasEmitted(fp)) continue;

      const incMin = inc.minute || nextMatch.minute || 1;
      if (Math.abs((nextMatch.minute || 1) - incMin) > 4) continue;

      const teamName = inc.team === 'HOME' ? nextMatch.home.name : nextMatch.away.name;
      const teamLogo = inc.team === 'HOME' ? nextMatch.home.logo : nextMatch.away.logo;
      const incMinLabel = inc.addedTime ? `${incMin}+${inc.addedTime}'` : `${incMin}'`;

      if (inc.eventType === 'GOAL_DISALLOWED') {
        const teamScoreIncreased = inc.team === 'HOME'
          ? (nextMatch.home.score || 0) > (prevMatch.home?.score || 0)
          : (nextMatch.away.score || 0) > (prevMatch.away?.score || 0);

        // Skor artıran takıma ASLA GOAL_DISALLOWED gönderilmez! Skor artışı KESİNLİKLE GEÇERLİ GOLDÜR!
        if (teamScoreIncreased || scoreIncreasedTeams.has(inc.team)) {
          continue;
        }

        const reasonLower = (inc.reason || '').toLowerCase();
        const isConfirmedOrValid =
          reasonLower.includes('confirmed') ||
          reasonLower.includes('awarded') ||
          reasonLower.includes('stands') ||
          reasonLower.includes('valid') ||
          reasonLower.includes('onaylandı') ||
          reasonLower.includes('onaylandi') ||
          reasonLower.includes('geçerli') ||
          reasonLower.includes('gecerli');

        if (isConfirmedOrValid) {
          continue;
        }

        const hasDisallowedKeyword =
          reasonLower.includes('disallowed') ||
          reasonLower.includes('overturned') ||
          reasonLower.includes('no goal') ||
          reasonLower.includes('iptal edildi') ||
          reasonLower.includes('goal cancelled') ||
          reasonLower.includes('goal canceled') ||
          reasonLower.includes('iptal');

        if (!hasDisallowedKeyword) {
          continue;
        }

        events.push({
          id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          timestamp: Date.now(),
          type: 'GOAL_DISALLOWED',
          category: 'disallowed_goal',
          minute: incMin,
          minuteLabel: incMinLabel,
          team: inc.team,
          teamName,
          teamLogo,
          playerName: inc.playerName,
          title: `İPTAL EDİLEN GOL (VAR) — ${teamName}`,
          message: `${inc.playerName || teamName} golü iptal edildi (${inc.reason || 'VAR / İptal'}).`,
          ...baseMeta
        });
      } else if (inc.eventType === 'GOAL' && inc.assistPlayerName) {
        events.push({
          id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          timestamp: Date.now(),
          type: 'ASSIST',
          category: 'assist',
          minute: incMin,
          minuteLabel: incMinLabel,
          team: inc.team,
          teamName,
          teamLogo,
          playerName: inc.assistPlayerName,
          scorerName: inc.playerName,
          title: `ASİST! ${inc.assistPlayerName} (${teamName})`,
          message: `${inc.assistPlayerName}, ${inc.playerName} golünde kilit pası veren isim oldu.`,
          ...baseMeta
        });
      } else if (inc.eventType === 'YELLOW_CARD' || inc.eventType === 'RED_CARD') {
        const isRed = inc.eventType === 'RED_CARD';
        events.push({
          id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          timestamp: Date.now(),
          type: inc.eventType,
          category: 'card',
          minute: incMin,
          minuteLabel: incMinLabel,
          team: inc.team,
          teamName,
          teamLogo,
          playerName: inc.playerName,
          title: `${isRed ? 'KIRMIZI KART!' : 'SARI KART'} — ${inc.playerName || teamName}`,
          message: `${teamName} oyuncusu ${inc.playerName || ''} ${isRed ? 'kırmızı' : 'sarı'} kart gördü.`,
          ...baseMeta
        });
      }
    }

    // 3. Shot Notifications (Shots on Target & Shots off Target) & Foul/Card Counter Deltas
    for (const side of ['home', 'away']) {
      const teamCode = side === 'home' ? 'HOME' : 'AWAY';
      const teamName = nextMatch[side].name;
      const teamLogo = nextMatch[side].logo || null;
      const pStats = prevMatch[side].stats || {};
      const nStats = nextMatch[side].stats || {};

      // A. Shots on Target (İsabetli Şut) — ignore bulk initial jump > 2
      const prevSot = pStats.shotsOnTarget || 0;
      const nextSot = nStats.shotsOnTarget || 0;
      if (nextSot > prevSot && (nextSot - prevSot) <= 2) {
        const fp = `${nextMatch.matchId}:sot:${teamCode}:${nextSot}`;
        if (!this.hasEmitted(fp)) {
          const latestShot = (nextMatch.shotmap || []).find(s => s.team === teamCode && s.isOnTarget);
          events.push({
            id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(),
            type: 'SHOT_ON_TARGET',
            category: 'shot',
            minute: nextMatch.minute || 1,
            minuteLabel: minLabel,
            team: teamCode,
            teamName,
            teamLogo,
            playerName: latestShot?.playerName || null,
            title: `İsabetli Şut — ${teamName}${latestShot?.playerName ? ` (${latestShot.playerName})` : ''}`,
            message: `Ev: ${shotSummary.home.total} Şut (${shotSummary.home.onTarget} İsb / ${shotSummary.home.offTarget} İsz) • Dep: ${shotSummary.away.total} Şut (${shotSummary.away.onTarget} İsb / ${shotSummary.away.offTarget} İsz)`,
            ...baseMeta
          });
        }
      } else if (nextSot > prevSot) {
        this.hasEmitted(`${nextMatch.matchId}:sot:${teamCode}:${nextSot}`);
      }

      // B. Shots off Target / Blocked (İsabetsiz Şut)
      const prevSoff = (pStats.shotsOffTarget || 0) + (pStats.blockedShots || 0);
      const nextSoff = (nStats.shotsOffTarget || 0) + (nStats.blockedShots || 0);
      if (nextSoff > prevSoff && (nextSoff - prevSoff) <= 2) {
        const fp = `${nextMatch.matchId}:soff:${teamCode}:${nextSoff}`;
        if (!this.hasEmitted(fp)) {
          const latestShot = (nextMatch.shotmap || []).find(s => s.team === teamCode && !s.isOnTarget);
          events.push({
            id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(),
            type: 'SHOT_OFF_TARGET',
            category: 'shot',
            minute: nextMatch.minute || 1,
            minuteLabel: minLabel,
            team: teamCode,
            teamName,
            teamLogo,
            playerName: latestShot?.playerName || null,
            title: `İsabetsiz Şut — ${teamName}${latestShot?.playerName ? ` (${latestShot.playerName})` : ''}`,
            message: `Ev: ${shotSummary.home.total} Şut (${shotSummary.home.onTarget} İsb / ${shotSummary.home.offTarget} İsz) • Dep: ${shotSummary.away.total} Şut (${shotSummary.away.onTarget} İsb / ${shotSummary.away.offTarget} İsz)`,
            ...baseMeta
          });
        }
      } else if (nextSoff > prevSoff) {
        this.hasEmitted(`${nextMatch.matchId}:soff:${teamCode}:${nextSoff}`);
      }

      // C. Fouls (Faul Bildirimi)
      const prevFouls = pStats.fouls || 0;
      const nextFouls = nStats.fouls || 0;
      if (nextFouls > prevFouls && (nextFouls - prevFouls) <= 2) {
        const fp = `${nextMatch.matchId}:foul:${teamCode}:${nextFouls}`;
        if (!this.hasEmitted(fp)) {
          events.push({
            id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(),
            type: 'FOUL',
            category: 'foul',
            minute: nextMatch.minute || 1,
            minuteLabel: minLabel,
            team: teamCode,
            teamName,
            teamLogo,
            title: `Faul — ${teamName} (${nextFouls}. Faul)`,
            message: `Faul Dengesi: Ev Sahibi ${nextMatch.home.stats.fouls || 0} • Deplasman ${nextMatch.away.stats.fouls || 0}`,
            ...baseMeta
          });
        }
      } else if (nextFouls > prevFouls) {
        this.hasEmitted(`${nextMatch.matchId}:foul:${teamCode}:${nextFouls}`);
      }

      // D. Counter-based Card Detection
      const prevYc = pStats.yellowCards || 0;
      const nextYc = nStats.yellowCards || 0;
      if (nextYc > prevYc && (nextYc - prevYc) === 1) {
        const fp = `${nextMatch.matchId}:yc:${teamCode}:${nextYc}`;
        if (!this.hasEmitted(fp)) {
          events.push({
            id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(),
            type: 'YELLOW_CARD',
            category: 'card',
            minute: nextMatch.minute || 1,
            minuteLabel: minLabel,
            team: teamCode,
            teamName,
            teamLogo,
            title: `Sarı Kart — ${teamName}`,
            message: `${teamName} sarı kart gördü (Toplam Kart: Ev ${nextMatch.home.stats.yellowCards || 0} - ${nextMatch.away.stats.yellowCards || 0} Dep).`,
            ...baseMeta
          });
        }
      } else if (nextYc > prevYc) {
        this.hasEmitted(`${nextMatch.matchId}:yc:${teamCode}:${nextYc}`);
      }

      const prevRc = Math.max(prevMatch[side].redCards || 0, pStats.redCards || 0);
      const nextRc = Math.max(nextMatch[side].redCards || 0, nStats.redCards || 0);
      if (nextRc > prevRc && (nextRc - prevRc) === 1) {
        const fp = `${nextMatch.matchId}:rc:${teamCode}:${nextRc}`;
        if (!this.hasEmitted(fp)) {
          events.push({
            id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(),
            type: 'RED_CARD',
            category: 'card',
            minute: nextMatch.minute || 1,
            minuteLabel: minLabel,
            team: teamCode,
            teamName,
            teamLogo,
            title: `KIRMIZI KART! ${teamName}`,
            message: `${teamName} 10 kişi kaldı! Maç içi gol beklentisi ve taktik denge yeniden hesaplandı.`,
            ...baseMeta
          });
        }
      } else if (nextRc > prevRc) {
        this.hasEmitted(`${nextMatch.matchId}:rc:${teamCode}:${nextRc}`);
      }
    }

    return events;
  }
}

module.exports = StateDiffEngine;
