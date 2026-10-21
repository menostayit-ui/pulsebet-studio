/**
 * PulseBet Pro — Player Performance & Defensive Vulnerability Engine
 * High-performance player contribution and xG/xA impact telemetry engine.
 * Evaluates Live Player Impact Score (Threat Index TI, Playmaker Index PI),
 * identifies key attacking leaders, playmakers, and Defensive Vulnerability (DVS).
 */

class PlayerImpactEngine {
  clamp(min, max, val) {
    return Math.max(min, Math.min(max, val));
  }

  /**
   * Build unified player list from lineups + incidents + shotmap
   */
  extractPlayers(match) {
    const playerMap = new Map();

    const upsertPlayer = (name, team, defaults = {}) => {
      if (!name || name === 'Bilinmeyen Oyuncu' || name === 'Oyuncu') return null;
      const key = `${team}:${name.toLowerCase().trim()}`;
      if (!playerMap.has(key)) {
        playerMap.set(key, {
          id: defaults.id || key,
          name,
          team,
          position: defaults.position || 'M',
          rating: defaults.rating || 6.6,
          goals: 0,
          assists: 0,
          shotsTotal: 0,
          shotsOnTarget: 0,
          shotsOffTarget: 0,
          shotsBlocked: 0,
          keyPasses: 0,
          bigChancesCreated: 0,
          foulsCommitted: 0,
          foulsDrawn: 0,
          yellowCards: 0,
          redCards: 0,
          dribblesSuccess: 0,
          dribbledPast: 0,
          touches: 0,
          recentActionMinute: 0
        });
      }
      return playerMap.get(key);
    };

    // 1. Seed from SofaScore lineups if available
    if (match.lineups) {
      for (const side of ['home', 'away']) {
        const teamCode = side === 'home' ? 'HOME' : 'AWAY';
        for (const p of (match.lineups[side] || [])) {
          const entry = upsertPlayer(p.name, teamCode, {
            id: p.id,
            position: p.position,
            rating: p.rating || 6.6
          });
          if (!entry) continue;
          entry.goals = Math.max(entry.goals, p.goals || 0);
          entry.assists = Math.max(entry.assists, p.assists || 0);
          entry.shotsTotal = Math.max(entry.shotsTotal, p.shotsTotal || 0);
          entry.shotsOnTarget = Math.max(entry.shotsOnTarget, p.shotsOnTarget || 0);
          entry.shotsOffTarget = Math.max(entry.shotsOffTarget, p.shotsOffTarget || 0);
          entry.shotsBlocked = Math.max(entry.shotsBlocked, p.shotsBlocked || 0);
          entry.keyPasses = Math.max(entry.keyPasses, p.keyPasses || 0);
          entry.bigChancesCreated = Math.max(entry.bigChancesCreated, p.bigChancesCreated || 0);
          entry.foulsCommitted = Math.max(entry.foulsCommitted, p.foulsCommitted || 0);
          entry.foulsDrawn = Math.max(entry.foulsDrawn, p.foulsDrawn || 0);
          entry.yellowCards = Math.max(entry.yellowCards, p.yellowCards || 0);
          entry.redCards = Math.max(entry.redCards, p.redCards || 0);
          entry.dribblesSuccess = Math.max(entry.dribblesSuccess, p.dribblesSuccess || 0);
          entry.dribbledPast = Math.max(entry.dribbledPast, p.dribbledPast || 0);
          entry.touches = Math.max(entry.touches, p.touches || 0);
        }
      }
    }

    // 2. Enrich from live incidents (Goals, Assists, Cards, Disallowed Goals, Substitutions)
    for (const inc of (match.incidents || [])) {
      if (inc.eventType === 'SUBSTITUTION') {
        const subInName = inc.playerIn || inc.subIn || inc.playerName;
        const subOutName = inc.playerOut || inc.subOut;
        const subMin = inc.minute || 0;

        if (subInName) {
          const subInPlayer = upsertPlayer(subInName, inc.team, {
            position: 'F',
            rating: 6.8
          });
          if (subInPlayer) {
            subInPlayer.recentActionMinute = Math.max(subInPlayer.recentActionMinute, subMin);
            subInPlayer.isSubIn = true;
            subInPlayer.subMinute = subMin;
            if (subMin >= 60) {
              subInPlayer.isFreshAttacker = true;
            }
          }
        }

        if (subOutName) {
          const subOutPlayer = upsertPlayer(subOutName, inc.team, { position: 'M' });
          if (subOutPlayer) {
            subOutPlayer.isSubOut = true;
            subOutPlayer.subMinute = subMin;
          }
        }
        continue;
      }

      const p = upsertPlayer(inc.playerName, inc.team, {
        position: inc.eventType === 'GOAL' ? 'F' : (inc.eventType.includes('CARD') ? 'D' : 'M')
      });
      if (p) {
        p.recentActionMinute = Math.max(p.recentActionMinute, inc.minute || 0);
        if (inc.eventType === 'GOAL') {
          p.goals += 1;
          p.shotsOnTarget = Math.max(p.shotsOnTarget, p.goals);
          p.shotsTotal = Math.max(p.shotsTotal, p.shotsOnTarget + p.shotsOffTarget);
          p.rating = Math.min(9.8, Math.max(p.rating, 7.4 + p.goals * 0.5));
        } else if (inc.eventType === 'GOAL_DISALLOWED') {
          p.shotsOnTarget += 1;
          p.shotsTotal += 1;
        } else if (inc.eventType === 'YELLOW_CARD') {
          p.yellowCards = Math.max(1, p.yellowCards);
          p.foulsCommitted = Math.max(2, p.foulsCommitted);
        } else if (inc.eventType === 'RED_CARD') {
          p.redCards = Math.max(1, p.redCards);
        }
      }

      if (inc.assistPlayerName) {
        const aPlayer = upsertPlayer(inc.assistPlayerName, inc.team, { position: 'M' });
        if (aPlayer) {
          aPlayer.assists += 1;
          aPlayer.keyPasses = Math.max(aPlayer.keyPasses, aPlayer.assists + 1);
          aPlayer.rating = Math.min(9.5, Math.max(aPlayer.rating, 7.3 + aPlayer.assists * 0.4));
          aPlayer.recentActionMinute = Math.max(aPlayer.recentActionMinute, inc.minute || 0);
        }
      }
    }

    // 3. Enrich from shotmap events
    for (const shot of (match.shotmap || [])) {
      const p = upsertPlayer(shot.playerName, shot.team, { position: shot.position || 'F' });
      if (!p) continue;
      p.recentActionMinute = Math.max(p.recentActionMinute, shot.minute || 0);
      if (!match.lineups) {
        p.shotsTotal += 1;
        if (shot.isOnTarget) p.shotsOnTarget += 1;
        else if (shot.shotType === 'block') p.shotsBlocked += 1;
        else p.shotsOffTarget += 1;
      }
    }

    return Array.from(playerMap.values());
  }

  /**
   * Evaluate all players in a match & compute Threat Leader, Playmaker Leader,
   * Defensive Vulnerability (DVS), and Matchup Exploit Multipliers
   */
  analyzePlayers(match) {
    const minute = match.minute || 1;
    const rawPlayers = this.extractPlayers(match);

    const scoredPlayers = rawPlayers.map(p => {
      const deltaMin = p.recentActionMinute > 0 ? Math.max(0, minute - p.recentActionMinute) : 15;
      const decayMult = deltaMin <= 12 ? 1.30 : (deltaMin <= 28 ? 1.00 : 0.72);
      const isFreshAttacker = Boolean(p.isFreshAttacker);
      const freshMult = isFreshAttacker ? 1.25 : 1.0;

      // 1. Threat Index (TI)
      const rawTi = (
        p.goals * 25.0 +
        p.assists * 6.0 +
        p.shotsOnTarget * 10.5 +
        p.shotsOffTarget * 3.8 +
        p.shotsBlocked * 3.5 +
        p.keyPasses * 2.2 +
        p.dribblesSuccess * 4.2 +
        p.foulsDrawn * 3.5
      ) * decayMult * freshMult + ((p.rating - 6.5) * 8.0) + (isFreshAttacker ? 5.0 : 0);

      // 2. Playmaker Index (PI)
      const rawPi = (
        p.assists * 22.0 +
        p.bigChancesCreated * 15.0 +
        p.keyPasses * 9.5 +
        p.goals * 5.0 +
        p.dribblesSuccess * 4.5 +
        p.foulsDrawn * 3.5 +
        p.shotsOnTarget * 2.0
      ) * decayMult + ((p.rating - 6.5) * 8.0);

      // 3. Defensive Vulnerability Score (DVS 0-100)
      const posUpper = (p.position || 'M').toUpperCase();
      const posWeight = posUpper.includes('D') || posUpper === 'CB' || posUpper === 'LB' || posUpper === 'RB'
        ? 1.25
        : (posUpper.includes('M') ? 1.12 : 0.80);
      const timeWeight = minute <= 30 ? 1.22 : (minute >= 65 ? 1.32 : 1.10);

      const rawDvs = (
        p.yellowCards * 36 +
        p.redCards * 65 +
        p.foulsCommitted * 9 +
        p.dribbledPast * 6 -
        (p.rating - 6.5) * 8
      ) * posWeight * timeWeight;

      const tiScore = Number(Math.max(0, rawTi).toFixed(1));
      const piScore = Number(Math.max(0, rawPi).toFixed(1));
      const dvsScore = Math.round(this.clamp(0, 100, rawDvs));

      return {
        ...p,
        tiScore,
        piScore,
        dvsScore,
        isOnFire: tiScore >= 20.0 && deltaMin <= 15
      };
    });

    const homePlayers = scoredPlayers.filter(p => p.team === 'HOME');
    const awayPlayers = scoredPlayers.filter(p => p.team === 'AWAY');

    const topThreatHome = [...homePlayers].sort((a, b) => b.tiScore - a.tiScore)[0] || null;
    const topThreatAway = [...awayPlayers].sort((a, b) => b.tiScore - a.tiScore)[0] || null;
    const topPlaymaker = [...scoredPlayers].sort((a, b) => b.piScore - a.piScore)[0] || null;
    const mostVulnerableHome = [...homePlayers].sort((a, b) => b.dvsScore - a.dvsScore)[0] || null;
    const mostVulnerableAway = [...awayPlayers].sort((a, b) => b.dvsScore - a.dvsScore)[0] || null;

    // Also include team-level yellow/red/foul defensive vulnerability when individual lineups are sparse
    const hStats = match.home.stats || {};
    const aStats = match.away.stats || {};

    const teamDefVulnHome = Math.max(
      mostVulnerableHome?.dvsScore || 0,
      Math.min(95, (hStats.yellowCards || 0) * 18 + (hStats.redCards || 0) * 50 + (hStats.fouls || 0) * 2.2)
    );
    const teamDefVulnAway = Math.max(
      mostVulnerableAway?.dvsScore || 0,
      Math.min(95, (aStats.yellowCards || 0) * 18 + (aStats.redCards || 0) * 50 + (aStats.fouls || 0) * 2.2)
    );

    const attThreatHome = Math.max(topThreatHome?.tiScore || 12, (hStats.shotsOnTarget || 0) * 6 + (hStats.totalShots || 0) * 2);
    const attThreatAway = Math.max(topThreatAway?.tiScore || 12, (aStats.shotsOnTarget || 0) * 6 + (aStats.totalShots || 0) * 2);

    // Matchup Exploit Multiplier (Home attacking Away defense, Away attacking Home defense)
    const matchupMultHome = Number(this.clamp(
      0.92,
      1.35,
      1.0 + (teamDefVulnAway / 100) * (Math.min(45, attThreatHome) / 90)
    ).toFixed(2));

    const matchupMultAway = Number(this.clamp(
      0.92,
      1.35,
      1.0 + (teamDefVulnHome / 100) * (Math.min(45, attThreatAway) / 90)
    ).toFixed(2));

    const threatLeader = [...scoredPlayers].sort((a, b) => b.tiScore - a.tiScore)[0] || null;

    const freshAttackers = scoredPlayers.filter(p => p.isFreshAttacker);
    const freshAttackersHome = freshAttackers.filter(p => p.team === 'HOME');
    const freshAttackersAway = freshAttackers.filter(p => p.team === 'AWAY');

    return {
      threatLeader: threatLeader && threatLeader.tiScore >= 10 ? threatLeader : null,
      playmakerLeader: topPlaymaker && topPlaymaker.piScore >= 10 ? topPlaymaker : null,
      topThreatHome,
      topThreatAway,
      vulnerableDefenderHome: mostVulnerableHome && mostVulnerableHome.dvsScore >= 35 ? mostVulnerableHome : null,
      vulnerableDefenderAway: mostVulnerableAway && mostVulnerableAway.dvsScore >= 35 ? mostVulnerableAway : null,
      teamDefVulnHome: Math.round(teamDefVulnHome),
      teamDefVulnAway: Math.round(teamDefVulnAway),
      matchupMultHome,
      matchupMultAway,
      freshAttackers,
      freshAttackersHome,
      freshAttackersAway,
      hasFreshAttackingPersonnel: freshAttackers.length > 0,
      players: scoredPlayers.slice(0, 24)
    };
  }
}

module.exports = PlayerImpactEngine;
