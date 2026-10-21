/**
 * PulseBet Studio — Elite Tactical Match Momentum, Narrative & Archetype Engine (V7)
 * Institutional Quantitative Architecture:
 *  - Goalkeeper Resistance Index (GRI):
 *      * Monitors opposing goalkeeper saves (>= 4 saves or >= 85% save rate) under continuous high-danger shots
 *      * Distinguishes unsustainable variance (+18% next goal edge, mean reversion goal imminent) from impenetrable wall (conviction damping)
 *  - Possession Quality & Pass Control Efficiency (PCE):
 *      * Incorporates passAccuracy, passesCompleted vs dangerousAttacks
 *      * Distinguishes sterile back-line circulation from vertical progressive siege
 *  - High Defensive Line & Offside Trap Vulnerability (HLOV):
 *      * Evaluates space exploitation for counter-attack transition goals on >= 3 offsides
 *  - High-Danger Index (HDI): Dynamic shot danger metric:
 *      * Inside-Box Shots: 2.50x
 *      * Shots On Target: 1.80x
 *      * Woodwork: 1.60x
 *      * Big Chances: 2.80x
 *  - Corner Cluster Surge Model (CCSM):
 *      * 2+ corners in 5m or 3+ corners in 10m rolling window
 *      * Evaluates set-piece siege pressure and injects +22% to +35% goal expectancy boost
 *  - Late Game Volatility Index (LGV):
 *      * Minutes 68-88 with 1-goal margin (1-0, 0-1, 2-1, 1-2)
 *      * Trailing team equalizer surge (IGP >= 65 + dangerous attack surge)
 *      * Leading team counter-attack boost on trailing team reckless turnovers/fouls
 *  - Strict False-Positive Dampers:
 *      * 1-1 Draw Guard: 1-1 tactical stalemate under 2.5 bias, 3.5 Over strictly prohibited
 *      * Blowout Cruise-Control: Exponential residual damping on 3+ margin or late 2-goal leads
 *      * Red Card dynamic penalty (rho = 0.55 penalty, +32% opposition boost)
 *  - Period Separation (half1 / half2) eliminating legacy cumulative illusion
 */

class MatchMomentumEngine {
  clamp(min, max, val) {
    return Math.max(min, Math.min(max, val));
  }

  /**
   * High-Danger Index (HDI):
   * Dynamic shot danger metric combining:
   *  - Inside-Box Shots (2.50x)
   *  - Shots On Target (1.80x)
   *  - Woodwork (1.60x)
   *  - Big Chances (2.80x)
   */
  computeHighDangerIndex(stats = {}) {
    const sot = stats.shotsOnTarget || 0;
    const cor = stats.corners || 0;
    const box = stats.shotsInsideBox != null ? stats.shotsInsideBox : Math.round(0.62 * sot + 0.35 * cor);
    const wood = stats.woodwork || 0;
    const bc = stats.bigChances || 0;
    const hdi = (2.50 * box) + (1.80 * sot) + (1.60 * wood) + (2.80 * bc);
    return Number(hdi.toFixed(2));
  }

  /**
   * Corner Cluster Surge Model (CCSM):
   * Evaluates set-piece pressure when a team earns:
   *  - 2+ corners in a 5-minute rolling window, OR
   *  - 3+ corners in a 10-minute rolling window
   * Injects a +22% to +35% goal expectancy boost into remaining lambda.
   */
  evaluateCornerClusterSurge(d5 = {}, d10 = {}) {
    const c5 = d5.corners || 0;
    const c10 = d10.corners || 0;
    const da5 = d5.dangerousAttacks || 0;
    const blk5 = d5.blockedShots || 0;

    const isCluster = c5 >= 2 || c10 >= 3;
    if (!isCluster) {
      return {
        active: false,
        boost: 1.0,
        corners5m: c5,
        corners10m: c10,
        pressureIntensity: 0
      };
    }

    const excess5 = Math.max(0, c5 - 2);
    const excess10 = Math.max(0, c10 - 3);
    const pressureIntensity = Math.min(
      1.0,
      (excess5 * 0.50) + (excess10 * 0.30) + (Math.min(1.0, da5 / 3.0) * 0.20) + (Math.min(1.0, blk5 / 2.0) * 0.20)
    );
    const boost = Number((1.22 + 0.13 * pressureIntensity).toFixed(3));
    return {
      active: true,
      boost,
      corners5m: c5,
      corners10m: c10,
      pressureIntensity: Number(pressureIntensity.toFixed(2))
    };
  }

  /**
   * Late Game Volatility Index (LGV):
   * In minutes 68-88 when a match has a 1-goal margin (1-0, 0-1, 2-1, 1-2):
   *  - If the trailing team has IGP >= 65 and dangerous attack surge, boost trailing team equalizer lambda.
   *  - If the trailing team commits reckless turnovers (high fouls/turnovers), boost counter-attack goal lambda for the leading team.
   */
  evaluateLateGameVolatility(match, d5, d10, gpiH, gpiA, igpH, igpA) {
    const minute = match.minute || 0;
    const isLive = match.status === 'LIVE';
    if (!isLive || minute < 68 || minute > 88) {
      return { active: false, equalizerBoost: 1.0, counterBoost: 1.0, regime: 'NONE' };
    }

    const scoreH = match.home?.score || 0;
    const scoreA = match.away?.score || 0;
    const scoreDiff = scoreH - scoreA;
    const absDiff = Math.abs(scoreDiff);
    if (absDiff !== 1) {
      return { active: false, equalizerBoost: 1.0, counterBoost: 1.0, regime: 'NONE' };
    }

    const homeLeading = scoreDiff === 1;
    const trailSide = homeLeading ? 'AWAY' : 'HOME';
    const leadSide = homeLeading ? 'HOME' : 'AWAY';
    const trailIgp = homeLeading ? igpA : igpH;
    const trailD5 = homeLeading ? (d5?.away || {}) : (d5?.home || {});
    const trailD10 = homeLeading ? (d10?.away || {}) : (d10?.home || {});

    // Condition A: Trailing team equalizer surge (IGP >= 65 and dangerous attack surge)
    const daSurge = (trailD5.dangerousAttacks >= 2) ||
      (trailD10.dangerousAttacks >= 4) ||
      (trailD5.totalShots >= 2) ||
      (trailD5.corners >= 1) ||
      (trailD10.shotsInsideBox >= 1);
    const isEqualizerSurge = trailIgp >= 65 && daSurge;

    // Condition B: Trailing team reckless turnovers / desperate fouls
    const recklessTurnovers = (trailD5.fouls >= 2) ||
      (trailD10.fouls >= 4) ||
      (trailD10.yellowCards >= 1);
    const isCounterSurge = recklessTurnovers;

    let equalizerBoost = 1.0;
    if (isEqualizerSurge) {
      const igpExcess = Math.min(1.0, (trailIgp - 65) / 20.0);
      equalizerBoost = Number((1.25 + 0.20 * igpExcess).toFixed(3)); // +25% to +45% boost
    }

    let counterBoost = 1.0;
    if (isCounterSurge) {
      const foulDensity = Math.min(1.0, ((trailD5.fouls || 0) + (trailD10.yellowCards || 0)) / 3.0);
      counterBoost = Number((1.20 + 0.18 * foulDensity).toFixed(3)); // +20% to +38% boost
    }

    const active = isEqualizerSurge || isCounterSurge;
    let regime = 'NONE';
    if (isEqualizerSurge && isCounterSurge) regime = 'BILATERAL_ENDGAME_CHAOS';
    else if (isEqualizerSurge) regime = 'EQUALIZER_SIEGE';
    else if (isCounterSurge) regime = 'COUNTER_ATTACK_OPPORTUNITY';

    return {
      active,
      regime,
      trailSide,
      leadSide,
      trailTeam: homeLeading ? match.away?.name : match.home?.name,
      leadTeam: homeLeading ? match.home?.name : match.away?.name,
      equalizerBoost,
      counterBoost,
      isEqualizerSurge,
      isCounterSurge
    };
  }

  estimateTeamXg(stats = {}, oppStats = {}) {
    if (stats.xg && stats.xg > 0.05) return Number(stats.xg.toFixed(2));
    const sot = stats.shotsOnTarget || 0;
    const soff = stats.shotsOffTarget || 0;
    const blk = stats.blockedShots || 0;
    const box = stats.shotsInsideBox != null ? stats.shotsInsideBox : Math.round(0.62 * sot + 0.35 * (stats.corners || 0));
    const outBox = Math.max(0, (stats.totalShots || 0) - box);
    const bc = stats.bigChances || 0;
    const wood = stats.woodwork || 0;
    const cor = stats.corners || 0;
    const oppSaves = oppStats.saves || Math.max(0, sot - (stats.goals || 0));

    // Bayesian xG calibrated with High-Danger Index (HDI) components: Box (2.5x), SOT (1.8x), Woodwork (1.6x), Big Chance (2.8x)
    const est = (0.135 * sot) +
      (0.125 * box) +
      (0.330 * bc) +
      (0.240 * wood) +
      (0.028 * outBox) +
      (0.035 * blk) +
      (0.045 * oppSaves) +
      (0.020 * cor) +
      (0.012 * soff);
    return Number(est.toFixed(2));
  }

  computeRawSts(w = {}) {
    const sot = w.shotsOnTarget || 0;
    const soff = w.shotsOffTarget || 0;
    const blk = w.blockedShots || 0;
    const cor = w.corners || 0;
    const da = w.dangerousAttacks || 0;

    // High-Danger Index (HDI): Inside-Box 2.5x, SOT 1.8x, Woodwork 1.6x, Big Chance 2.8x
    const hdi = this.computeHighDangerIndex(w);
    let sts = hdi + (0.85 * blk) + (0.45 * soff) + (0.95 * cor) + (0.08 * da);

    // Corner Cluster Surge Model (CCSM):
    // 2+ corners in rolling window injects set-piece pressure boost
    if (cor >= 2) {
      sts += 0.85 * (cor - 1);
    }
    if (cor >= 3) {
      sts += 1.15; // Set-piece siege clustering acceleration
    }
    return sts;
  }

  computeQualityMultipliers(stats = {}) {
    const tot = Math.max(1, stats.totalShots || 0);
    if (tot < 3) return { alphaBox: 1.0, alphaEff: 1.0 };

    const sot = stats.shotsOnTarget || 0;
    const cor = stats.corners || 0;
    const box = stats.shotsInsideBox != null ? stats.shotsInsideBox : Math.round(0.62 * sot + 0.35 * cor);
    const bc = stats.bigChances || 0;
    const wood = stats.woodwork || 0;
    const hdi = this.computeHighDangerIndex(stats);

    const rBox = box / tot;
    let alphaBox = 1.0;
    if (rBox >= 0.65) alphaBox = 1.28;
    else if (rBox < 0.35) alphaBox = 0.78;

    const rEff = (sot + 0.55 * (stats.blockedShots || 0)) / tot;
    let alphaEff = 1.0;
    if (rEff >= 0.50) alphaEff = 1.20;
    else if (rEff < 0.22 && tot >= 5) alphaEff = 0.80;

    // High danger impact boost incorporating High-Danger Index (HDI)
    const dangerBoost = Math.min(0.25, 0.08 * (bc * (2.8 / 2.0) + wood * (1.6 / 2.0)) + 0.015 * Math.min(3, hdi / Math.max(1, tot * 2.5)));
    return { alphaBox: Number((alphaBox + dangerBoost).toFixed(3)), alphaEff };
  }

  /**
   * Goalkeeper Resistance Index (GRI):
   * When opposing goalkeeper records >= 4 saves or save rate >= 85% despite continuous high-danger shots,
   * measures whether this is unsustainable variance (mean reversion goal imminent, +18% next goal edge)
   * or total impenetrable wall (adjusting conviction downwards).
   */
  computeGoalkeeperResistanceIndex(attStats = {}, oppStats = {}, attScore = 0, oppScore = 0, attD5 = {}, attD10 = {}) {
    const oppSaves = oppStats.saves || 0;
    const goals = attScore || 0;
    const sotFaced = (attStats.shotsOnTarget || 0) > 0 ? attStats.shotsOnTarget : (oppSaves + goals);
    const saveRate = (oppSaves + goals) > 0 ? (oppSaves / (oppSaves + goals)) : 0;

    const isTriggerCandidate = (oppSaves >= 4 || (saveRate >= 0.85 && sotFaced >= 3));
    if (!isTriggerCandidate) {
      return {
        active: false,
        regime: 'NORMAL',
        griScore: Math.round(saveRate * 50),
        saveCount: oppSaves,
        saveRate: Number((saveRate * 100).toFixed(1)),
        isMeanReversionImminent: false,
        lambdaBoost: 1.0,
        edgeBonus: 0,
        convictionAdjustment: 1.0,
        summary: 'Standart kaleci performansı'
      };
    }

    const hdi = this.computeHighDangerIndex(attStats);
    const boxShots = attStats.shotsInsideBox != null ? attStats.shotsInsideBox : Math.round(0.62 * sotFaced + 0.35 * (attStats.corners || 0));
    const bc = attStats.bigChances || 0;
    const wood = attStats.woodwork || 0;
    const xg = attStats.xg || this.estimateTeamXg(attStats, oppStats);
    const xgDebt = Math.max(0, xg - goals);
    const d10Sot = attD10.shotsOnTarget || 0;
    const d5Sot = attD5.shotsOnTarget || 0;
    const totShots = Math.max(1, attStats.totalShots || 0);
    const dangerPerShot = hdi / totShots;

    // High danger criteria: shots inside box, big chances, woodwork, acute deltas
    const isContinuousHighDanger = (hdi >= 8.5 || boxShots >= 3 || bc >= 1 || wood >= 1 || xgDebt >= 0.50 || (d10Sot + d5Sot) >= 2) &&
      (dangerPerShot >= 1.35 || (boxShots / totShots) >= 0.38);

    if (isContinuousHighDanger) {
      // Unsustainable Variance: Goalkeeper facing acute post-shot xG debt; mean reversion goal arrival imminent
      const excessSaves = Math.max(0, oppSaves - 3);
      const griScore = Math.round(this.clamp(74, 98, 68 + excessSaves * 5 + dangerPerShot * 10));
      return {
        active: true,
        regime: 'UNSUSTAINABLE_VARIANCE',
        griScore,
        saveCount: oppSaves,
        saveRate: Number((saveRate * 100).toFixed(1)),
        isMeanReversionImminent: true,
        lambdaBoost: 1.18, // +18% next goal edge
        edgeBonus: 18.0,
        convictionAdjustment: 1.12,
        summary: `Kaleci Direnci Aşırı Varyans: Rakip kaleci ${oppSaves} kurtarışla (%${Math.round(saveRate * 100)} kurtarış yüzdesi) dirense de yoğun ceza sahası baskısı ve yüksek xG borcu sürüyor. Bu durum sürdürülemez varyanstır; ortalamaya dönüş (mean reversion) ile sıradaki gol an meselesidir (+%18 Değer Avantajı).`
      };
    }

    // Impenetrable Wall: Routine or speculative shots from distance, solid defensive perimeter
    const griScore = Math.round(this.clamp(42, 65, 45 + oppSaves * 3.0));
    return {
      active: true,
      regime: 'IMPENETRABLE_WALL',
      griScore,
      saveCount: oppSaves,
      saveRate: Number((saveRate * 100).toFixed(1)),
      isMeanReversionImminent: false,
      lambdaBoost: 0.92, // Damped attacking expectation
      edgeBonus: -5.0,
      convictionAdjustment: 0.88,
      summary: `Geçilmez Kaleci Duvarı: Kaleci ${oppSaves} kurtarış (%${Math.round(saveRate * 100)}) ile yüksek odak seviyesinde; hücumlar ceza sahası dışından cılız kaldığı için savunma hattı güven veriyor.`
    };
  }

  /**
   * Possession Quality & Pass Control Efficiency (PCE):
   * Incorporates passAccuracy and passesCompleted vs dangerousAttacks:
   * Distinguishes sterile back-line possession from vertical progressive siege.
   */
  computePassControlEfficiency(stats = {}, oppStats = {}, minute = 1) {
    const t = Math.max(10, minute || 1);
    const possession = stats.possession || 50;
    const da = stats.dangerousAttacks || 0;
    const att = stats.attacks || Math.round(da * 1.6);
    const box = stats.shotsInsideBox != null ? stats.shotsInsideBox : Math.round(0.62 * (stats.shotsOnTarget || 0) + 0.35 * (stats.corners || 0));
    const passesCompleted = stats.passesCompleted || stats.passesAccurate || Math.round((possession / 100) * Math.min(90, t) * 9.2);
    const passAccuracy = stats.passAccuracy || (possession >= 55 ? 82 : (possession <= 45 ? 74 : 78));

    const daConversion = att > 0 ? (da / att) : 0.45;
    const daRate = da / t;
    const passesPerDa = da > 0 ? (passesCompleted / da) : 25;

    // Distinguish sterile possession from vertical progressive siege
    const isSterilePossession = (possession >= 54 && passAccuracy >= 79) &&
      (daConversion < 0.40 || daRate < 0.35 || passesPerDa > 18.0) &&
      (box <= 2);

    const isProgressiveSiege = (daConversion >= 0.52 || daRate >= 0.55 || (box >= 4 && daRate >= 0.42)) &&
      (passesPerDa <= 12.0 || da >= 25);

    let pce = 1.0;
    let regime = 'BALANCED_POSSESSION';

    if (isSterilePossession) {
      pce = this.clamp(0.72, 0.88, 0.80 * (daConversion / 0.44));
      regime = 'STERILE_POSSESSION';
    } else if (isProgressiveSiege) {
      pce = this.clamp(1.12, 1.38, 1.0 + 0.22 * (daRate / 0.50) + 0.05 * Math.min(3, box / 2));
      regime = 'VERTICAL_PROGRESSIVE_SIEGE';
    } else {
      pce = this.clamp(0.88, 1.10, 0.90 + 0.20 * (daConversion / 0.48));
      regime = 'BALANCED_POSSESSION';
    }

    return {
      pce: Number(pce.toFixed(3)),
      regime,
      possession,
      passAccuracy,
      passesCompleted,
      daConversion: Number((daConversion * 100).toFixed(1)),
      daRate: Number(daRate.toFixed(2)),
      passesPerDa: Number(passesPerDa.toFixed(1)),
      isSterilePossession,
      isProgressiveSiege
    };
  }

  /**
   * High Defensive Line & Offside Trap Vulnerability (HLOV):
   * When a team incurs >= 3 offsides, models high defensive line space exploitation for counter-attack transition goals.
   */
  computeHighLineOffsideVulnerability(stats = {}, oppStats = {}, minute = 1, delta10 = {}) {
    const offsides = stats.offsides || 0;
    const oppOffsides = oppStats.offsides || 0;
    const d10Off = delta10.offsides || 0;

    const isTrapStressed = (offsides >= 3) || (offsides >= 2 && d10Off >= 1);
    if (!isTrapStressed) {
      return {
        active: false,
        regime: 'NORMAL',
        offsideCount: offsides,
        oppOffsideCount: oppOffsides,
        spaceExploitationMult: 1.0,
        counterVulnerability: 1.0
      };
    }

    const excess = Math.max(0, offsides - 2);
    const spaceExploitationMult = Number(this.clamp(1.12, 1.28, 1.10 + 0.05 * excess).toFixed(3));
    const counterVulnerability = Number(this.clamp(1.08, 1.22, 1.06 + 0.04 * excess).toFixed(3));

    return {
      active: true,
      regime: 'HIGH_LINE_SPACE_EXPLOITATION',
      offsideCount: offsides,
      oppOffsideCount: oppOffsides,
      spaceExploitationMult, // Boost for team exploiting space in behind
      counterVulnerability   // Boost for opponent transition on turnovers
    };
  }

  /**
   * Extract true 2nd-Half vs 1st-Half stats when available and hydrate cold-start sliding windows
   */
  extractActivePeriodStats(match, d5, d10) {
    const minute = match.minute || 0;
    const half1 = match.periodStats?.half1 || null;
    const half2 = match.periodStats?.half2 || null;

    const hasHalf2Data = Boolean(
      minute >= 46 &&
      half2 &&
      ((half2.home?.totalShots || 0) + (half2.away?.totalShots || 0) + (half2.home?.corners || 0) + (half2.away?.corners || 0) > 0)
    );

    const t2h = Math.max(3, minute - 45);
    let effD10 = d10;
    let effD5 = d5;

    const isHt = match.status === 'HT';
    if (isHt) {
      const d10Sum = (d10.home?.totalShots || 0) + (d10.away?.totalShots || 0) + (d10.home?.corners || 0) + (d10.away?.corners || 0);
      if (d10Sum === 0) {
        const scale10 = 10 / 45;
        const scale5 = 5 / 45;
        const scaleStats = (s, factor) => ({
          totalShots: Math.round((s?.totalShots || 0) * factor),
          shotsOnTarget: Math.round((s?.shotsOnTarget || 0) * factor),
          shotsOffTarget: Math.round((s?.shotsOffTarget || 0) * factor),
          blockedShots: Math.round((s?.blockedShots || 0) * factor),
          shotsInsideBox: Math.round((s?.shotsInsideBox || 0) * factor),
          bigChances: Math.round((s?.bigChances || 0) * factor),
          woodwork: Math.round((s?.woodwork || 0) * factor),
          corners: Math.round((s?.corners || 0) * factor),
          fouls: Math.round((s?.fouls || 0) * factor),
          yellowCards: Math.round((s?.yellowCards || 0) * factor),
          redCards: Math.round((s?.redCards || 0) * factor),
          saves: Math.round((s?.saves || 0) * factor),
          dangerousAttacks: Math.round((s?.dangerousAttacks || 0) * factor),
          xg: Number(((s?.xg || 0) * factor).toFixed(2))
        });
        effD10 = {
          home: scaleStats(match.home?.stats, scale10),
          away: scaleStats(match.away?.stats, scale10)
        };
        effD5 = {
          home: scaleStats(match.home?.stats, scale5),
          away: scaleStats(match.away?.stats, scale5)
        };
      }
    } else if (hasHalf2Data) {
      const d10Sum = (d10.home?.totalShots || 0) + (d10.away?.totalShots || 0) + (d10.home?.corners || 0) + (d10.away?.corners || 0);
      if (d10Sum === 0) {
        const scale10 = Math.min(1.0, 10 / t2h);
        const scale5 = Math.min(1.0, 5 / t2h);
        const scaleStats = (s, factor) => ({
          totalShots: Math.round((s?.totalShots || 0) * factor),
          shotsOnTarget: Math.round((s?.shotsOnTarget || 0) * factor),
          shotsOffTarget: Math.round((s?.shotsOffTarget || 0) * factor),
          blockedShots: Math.round((s?.blockedShots || 0) * factor),
          shotsInsideBox: Math.round((s?.shotsInsideBox || 0) * factor),
          bigChances: Math.round((s?.bigChances || 0) * factor),
          woodwork: Math.round((s?.woodwork || 0) * factor),
          corners: Math.round((s?.corners || 0) * factor),
          fouls: Math.round((s?.fouls || 0) * factor),
          yellowCards: Math.round((s?.yellowCards || 0) * factor),
          redCards: Math.round((s?.redCards || 0) * factor),
          saves: Math.round((s?.saves || 0) * factor),
          dangerousAttacks: Math.round((s?.dangerousAttacks || 0) * factor),
          xg: Number(((s?.xg || 0) * factor).toFixed(2))
        });
        effD10 = {
          home: scaleStats(half2.home, scale10),
          away: scaleStats(half2.away, scale10)
        };
        effD5 = {
          home: scaleStats(half2.home, scale5),
          away: scaleStats(half2.away, scale5)
        };
      }
    }

    return {
      hasHalf2Data,
      t2h,
      half1,
      half2,
      effD5,
      effD10
    };
  }

  /**
   * V5 Period-Aware Goal Pressure Index (GPI 0-100):
   * In the 2nd half (minute >= 48), heavily weights 5m, 10m, and 2nd-Half rate (95% combined)
   * and reduces 1st-half cumulative dilution to 5%.
   * Incorporates Pass Control Efficiency (PCE) and Goalkeeper Resistance Index (GRI) multipliers.
   */
  computeTeamGpi(minute, d5, d10, fullStats, half2Stats = null, varBoost = 1.0, scoreStateDecay = 1.0, isHt = false, pceMult = 1.0, griBoost = 1.0) {
    const t = isHt ? 45 : Math.max(5, minute || 1);
    const t5m = this.computeRawSts(d5) * 2.0;
    const t10m = this.computeRawSts(d10);
    const tMatch = (this.computeRawSts(fullStats) / t) * 10.0;

    let baseTempo = isHt
      ? (0.35 * t5m + 0.35 * t10m + 0.30 * tMatch)
      : (0.52 * t5m + 0.32 * t10m + 0.16 * tMatch);
    let activeQualityStats = fullStats;

    if (minute >= 48 && half2Stats && ((half2Stats.totalShots || 0) + (half2Stats.corners || 0) + (half2Stats.dangerousAttacks || 0) > 0)) {
      const t2h = Math.max(3, minute - 45);
      const t2hRate = (this.computeRawSts(half2Stats) / t2h) * 10.0;
      baseTempo = 0.45 * t5m + 0.25 * t10m + 0.25 * t2hRate + 0.05 * tMatch;
      if ((half2Stats.totalShots || 0) >= 3) {
        activeQualityStats = half2Stats;
      }
    }

    // Pass Control Efficiency (PCE) dynamic impact: sterile possession damped, vertical progressive siege amplified
    const pceCoeff = 0.82 + 0.18 * (pceMult || 1.0);
    baseTempo *= pceCoeff;

    const { alphaBox, alphaEff } = this.computeQualityMultipliers(activeQualityStats);
    const pRaw = baseTempo * alphaBox * alphaEff * varBoost * scoreStateDecay * (griBoost || 1.0);
    const gpi = 100 * (1 - Math.exp(-pRaw / 17.2));
    return Math.round(this.clamp(0, 100, gpi));
  }

  computeDefensivePanic(attackerGpi, attD10, defD5, defD10) {
    const fouls5 = defD5.fouls || 0;
    const fouls6to10 = Math.max(0, (defD10.fouls || 0) - fouls5);
    const yc10 = defD10.yellowCards || 0;
    const rc10 = defD10.redCards || 0;
    const blk10 = attD10.blockedShots || 0;
    const cor10 = attD10.corners || 0;
    const saves10 = defD10.saves || 0;

    const mAtt = this.clamp(0.35, 2.05, attackerGpi / 43.0);
    const panicRaw = (
      1.65 * fouls5 +
      0.85 * fouls6to10 +
      4.50 * yc10 +
      9.00 * rc10 +
      2.20 * blk10 +
      1.85 * cor10 +
      1.75 * saves10
    ) * mAtt;

    const dpi = 100 * (1 - Math.exp(-panicRaw / 15.2));
    return Math.round(this.clamp(0, 100, dpi));
  }

  classifyMatchPace(d10Home, d10Away, fullHome, fullAway, minute, gpiH, gpiA, scoreH = 0, scoreA = 0, pceHome = null, pceAway = null) {
    const t = Math.max(10, minute || 10);
    const totShots10 = (d10Home.totalShots || 0) + (d10Away.totalShots || 0) ||
      (((fullHome.totalShots || 0) + (fullAway.totalShots || 0)) / t) * 10;
    const totCorners10 = (d10Home.corners || 0) + (d10Away.corners || 0) ||
      (((fullHome.corners || 0) + (fullAway.corners || 0)) / t) * 10;
    const totDa10 = (d10Home.dangerousAttacks || 0) + (d10Away.dangerousAttacks || 0) ||
      (((fullHome.dangerousAttacks || 0) + (fullAway.dangerousAttacks || 0)) / t) * 10;
    const totFouls10 = (d10Home.fouls || 0) + (d10Away.fouls || 0) ||
      (((fullHome.fouls || 0) + (fullAway.fouls || 0)) / t) * 10;
    const totYc10 = (d10Home.yellowCards || 0) + (d10Away.yellowCards || 0) ||
      (((fullHome.yellowCards || 0) + (fullAway.yellowCards || 0)) / t) * 10;
    const totRc10 = (d10Home.redCards || 0) + (d10Away.redCards || 0);

    const actionDensity = Number(((totShots10 + totCorners10) / 10).toFixed(2));
    const disruptionIndex = Number(((totFouls10 + 2.2 * totYc10 + 5.0 * totRc10) / 10).toFixed(2));
    const fdr = Number(((totShots10 + 0.7 * totCorners10 + 0.15 * totDa10) / Math.max(1.0, totFouls10 + 2.0 * totYc10)).toFixed(2));

    // 1-1 Beraberlikte Taktiksel Kilit ve 1 Puan Hesabı (2.5 Alt lehine güçlü düzeltme, 3.5 Üst hayal kırıklığını önler)
    if (scoreH === 1 && scoreA === 1 && minute >= 48) {
      const isDeadlock = (totShots10 <= 2.2 && Math.max(gpiH, gpiA) < 52) ||
        (disruptionIndex >= 0.38 && actionDensity < 0.35) ||
        (fdr < 0.90 && totFouls10 >= 3.0);
      if (isDeadlock) {
        return {
          code: 'TACTICAL_DRAW_STALEMATE',
          label: '1-1 Taktik Kilit & 1 Puan Hesabı',
          badgeColor: 'rose',
          actionDensity,
          disruptionIndex,
          fdr,
          tempoMultHome: 0.70,
          tempoMultAway: 0.70,
          overMult: 0.55,
          underMult: 1.48
        };
      }
    }

    // Possession Quality & Pass Control Efficiency (PCE) Deadlock: Sterile back-line circulation
    if (
      (pceHome?.isSterilePossession || pceAway?.isSterilePossession) &&
      actionDensity < 0.32 &&
      fdr < 1.10
    ) {
      return {
        code: 'STERILE_POSSESSION_DEADLOCK',
        label: 'Steril Top Çevirme / Düşük Tehdit',
        badgeColor: 'slate',
        actionDensity,
        disruptionIndex,
        fdr,
        tempoMultHome: 0.82,
        tempoMultAway: 0.82,
        overMult: 0.68,
        underMult: 1.34
      };
    }

    if (disruptionIndex >= 0.42 && (actionDensity >= 0.40 || Math.max(gpiH, gpiA) >= 66)) {
      return {
        code: 'SET_PIECE_CHAOS',
        label: 'Baskılı & Duran Top Ağırlıklı',
        badgeColor: 'amber',
        actionDensity,
        disruptionIndex,
        fdr,
        tempoMultHome: gpiH >= gpiA ? 1.18 : 1.05,
        tempoMultAway: gpiA > gpiH ? 1.18 : 1.05,
        overMult: 1.22,
        underMult: 0.65
      };
    }

    if (actionDensity >= 0.40 && (pceHome?.isProgressiveSiege || pceAway?.isProgressiveSiege || (actionDensity >= 0.44 && disruptionIndex <= 0.30 && fdr >= 1.55))) {
      return {
        code: 'HIGH_FLOW',
        label: 'Akıcı / Yüksek Tempo',
        badgeColor: 'emerald',
        actionDensity,
        disruptionIndex,
        fdr,
        tempoMultHome: 1.15,
        tempoMultAway: 1.15,
        overMult: 1.28,
        underMult: 0.60
      };
    }

    if (disruptionIndex >= 0.40 && actionDensity < 0.28 && fdr < 0.85) {
      return {
        code: 'CHOPPY_DEADLOCK',
        label: 'Sert / Faullü Kilit Oyun',
        badgeColor: 'rose',
        actionDensity,
        disruptionIndex,
        fdr,
        tempoMultHome: 0.76,
        tempoMultAway: 0.76,
        overMult: 0.68,
        underMult: 1.32
      };
    }

    return {
      code: 'BALANCED',
      label: 'Dengeli Taktiksel Akış',
      badgeColor: 'blue',
      actionDensity,
      disruptionIndex,
      fdr,
      tempoMultHome: 1.00,
      tempoMultAway: 1.00,
      overMult: 1.00,
      underMult: 1.00
    };
  }

  /**
   * Detect Specific In-Play Signal Hunter Archetype (15 Total States + V7 Late Game Volatility, GRI & HLOV)
   */
  detectArchetypeAndNarrative(match, gpiHome, gpiAway, dpiHome, dpiAway, igpHome, igpAway, pace, d5, d10, periodInfo, lgv = null, ccsm = null, gri = null, pce = null, hlov = null) {
    const hS = match.home.stats || {};
    const aS = match.away.stats || {};
    const totShots = (hS.totalShots || 0) + (aS.totalShots || 0);
    const totSot = (hS.shotsOnTarget || 0) + (aS.shotsOnTarget || 0);
    const totFouls = (hS.fouls || 0) + (aS.fouls || 0);
    const scoreH = match.home.score || 0;
    const scoreA = match.away.score || 0;
    const scoreDiff = scoreH - scoreA;
    const absDiff = Math.abs(scoreDiff);
    const min = match.minute || 0;

    const xgH = this.estimateTeamXg(hS, aS);
    const xgA = this.estimateTeamXg(aS, hS);
    const xgDebtH = Math.max(0, xgH - scoreH);
    const xgDebtA = Math.max(0, xgA - scoreA);

    const hReds = Math.max(match.home.redCards || 0, hS.redCards || 0);
    const aReds = Math.max(match.away.redCards || 0, aS.redCards || 0);

    const d10HShots = d10?.home?.totalShots || 0;
    const d10HCor = d10?.home?.corners || 0;
    const d10HSot = d10?.home?.shotsOnTarget || 0;
    const d10AShots = d10?.away?.totalShots || 0;
    const d10ACor = d10?.away?.corners || 0;
    const d10ASot = d10?.away?.shotsOnTarget || 0;
    const boxH = hS.shotsInsideBox || Math.round(0.62 * (hS.shotsOnTarget || 0) + 0.35 * (hS.corners || 0));
    const boxA = aS.shotsInsideBox || Math.round(0.62 * (aS.shotsOnTarget || 0) + 0.35 * (aS.corners || 0));

    // 1. Scheduled / Pre-Match
    if (match.status === 'SCHEDULED') {
      return {
        archetype: 'PRE_MATCH',
        archetypeLabel: 'Maç Başlangıcı Bekleniyor',
        narrative: 'Karşılaşma henüz başlamadı. Başlama düdüğüyle birlikte şut, pozisyon kalitesi, tempo ve oran hareketleri canlı olarak izlenecek.'
      };
    }

    // 2. Finished Match (FT)
    if (match.status === 'FT' || match.status === 'FINISHED') {
      return {
        archetype: 'MATCH_COMPLETED',
        archetypeLabel: 'Maç Sonu',
        narrative: `Karşılaşma ${scoreH}-${scoreA} skoruyla tamamlandı (Toplam Şut: Ev ${hS.totalShots || 0} - Dep ${aS.totalShots || 0}). Karşılaşma sona erdiği için canlı takip tamamlandı.`
      };
    }

    // 3. Halftime (HT) Deep Tactical Analysis
    if (match.status === 'HT') {
      const open1 = match.odds?.openMs1 || match.odds?.ms1 || 2.50;
      const open2 = match.odds?.openMs2 || match.odds?.ms2 || 2.90;
      const xgHVal = this.estimateTeamXg(hS, aS);
      const xgAVal = this.estimateTeamXg(aS, hS);
      const boxHVal = hS.shotsInsideBox || Math.round(0.62 * (hS.shotsOnTarget || 0) + 0.35 * (hS.corners || 0));
      const boxAVal = aS.shotsInsideBox || Math.round(0.62 * (aS.shotsOnTarget || 0) + 0.35 * (aS.corners || 0));
      const sotH = hS.shotsOnTarget || 0;
      const sotA = aS.shotsOnTarget || 0;

      // Case 1-1 Halftime Tactical Psychological Breakdown
      if (scoreH === 1 && scoreA === 1) {
        if ((boxHVal >= 4 || xgHVal >= xgAVal + 0.35 || sotH >= 3) && (boxHVal >= boxAVal + 2 || xgHVal >= xgAVal + 0.20)) {
          return {
            archetype: 'HALFTIME_DRAW_BREAKOUT_HOME',
            archetypeLabel: `Devre Arası 1-1 Beraberliği Bozma Kuşatması (${match.home.name})`,
            narrative: `1-1 Beraberliği Bozma Baskısı: İlk yarı 1-1 tamamlandı ancak ${match.home.name} ceza sahası içinden ${boxHVal} şut üreterek (${sotH} isabet, ${xgHVal.toFixed(2)} xG) deplasman kalesini kuşattı. Deplasman savunması geri çekildi; 2. yarıda 3. gol (2.5 Üst / Sıradaki Gol Ev) ihtimali çok kuvvetli (%78 Güven).`
          };
        }
        if ((boxAVal >= 4 || xgAVal >= xgHVal + 0.35 || sotA >= 3) && (boxAVal >= boxHVal + 2 || xgAVal >= xgHVal + 0.20)) {
          return {
            archetype: 'HALFTIME_DRAW_BREAKOUT_AWAY',
            archetypeLabel: `Devre Arası 1-1 Beraberliği Bozma Baskısı (${match.away.name})`,
            narrative: `1-1 Beraberliği Bozma Baskısı: Karşılaşma ilk yarıda 1-1'e geldi ancak ${match.away.name} ceza sahası içinden ${boxAVal} şut ve hızlı geçişlerle (${sotA} isabet, ${xgAVal.toFixed(2)} xG) rakip savunmayı sarstı. 2. yarıda 3. golün deplasmandan gelmesi (2.5 Üst / Sıradaki Gol Dep) çok yüksek olasılık (%76 Güven).`
          };
        }
        if (totSot <= 3 && (boxHVal + boxAVal) <= 4 && totFouls >= 10) {
          return {
            archetype: 'HALFTIME_DRAW_DEADLOCK',
            archetypeLabel: 'Devre Arası 1-1 Taktik Kilit & 1 Puan Hesabı',
            narrative: `1-1 Taktiksel Kilit & 1 Puan Hesabı: Karşılaşmada atılan karşılıklı 1'er golün ardından oyun kilitlendi (${totFouls} faul, ${boxHVal + boxAVal} ceza sahası şutu). İki takım da ikinci yarıda savunma emniyetini ön planda tutacak; 2.5 Alt ve maçın 1-1 beraberlikle tamamlanma ihtimali yüksek (%80 Güven).`
          };
        }
      }

      // Case A: Home Siege Dominance (e.g. Napoli 2-1 Bodo/Glimt)
      if ((boxHVal >= 5 || xgHVal >= 1.20 || sotH >= 4) && (xgHVal >= xgAVal + 0.50 || boxHVal >= boxAVal + 3)) {
        return {
          archetype: 'HALFTIME_SIEGE_DOMINANCE_HOME',
          archetypeLabel: `Devre Arası Kuşatması (${match.home.name})`,
          narrative: `Ceza Sahası Kuşatması: Ev sahibi ilk yarıda ceza sahası içinden ${boxHVal} şut bularak ${xgHVal.toFixed(2)} xG üretti (${sotH} isabet). Deplasman savunması geriye yaslandı; 2. yarıda 3. gol baskısı kaçınılmaz (Hedef: Sıradaki Gol Ev @1.55 / %78 Güven).`
        };
      }

      // Case B: Away Siege Dominance
      if ((boxAVal >= 5 || xgAVal >= 1.20 || sotA >= 4) && (xgAVal >= xgHVal + 0.50 || boxAVal >= boxHVal + 3)) {
        return {
          archetype: 'HALFTIME_SIEGE_DOMINANCE_AWAY',
          archetypeLabel: `Devre Arası Kuşatması (${match.away.name})`,
          narrative: `Ceza Sahası Kuşatması: Deplasman ekibi ilk yarıda ceza sahası içinden ${boxAVal} şut bularak ${xgAVal.toFixed(2)} xG üretti (${sotA} isabet). Ev sahibi savunması geriye yaslandı; 2. yarıda deplasman gol baskısı kaçınılmaz (Hedef: Sıradaki Gol Dep).`
        };
      }

      // Case C: Favorite Trailing at HT
      if (absDiff === 1 && ((scoreDiff === -1 && open1 <= 1.85) || (scoreDiff === 1 && open2 <= 1.85))) {
        const favHome = scoreDiff === -1;
        const favTeam = favHome ? match.home.name : match.away.name;
        return {
          archetype: favHome ? 'HALFTIME_FAVORITE_CHASE_HOME' : 'HALFTIME_FAVORITE_CHASE_AWAY',
          archetypeLabel: `Devre Arası Favori Reaksiyonu (${favTeam})`,
          narrative: `Favori Soyunma Odası Reaksiyonu: İlk yarıyı ${scoreH}-${scoreA} geride kapatan favori ${favTeam}, 2. yarıya fırtına gibi başlayacak. Rakip ceza sahası ablukaya alınacak; beraberlik baskısı zirvede.`
        };
      }

      // Case D: Bilateral Shootout
      if (totSot >= 4 && (xgHVal >= 0.70 && xgAVal >= 0.70)) {
        return {
          archetype: 'HALFTIME_SHOOTOUT',
          archetypeLabel: 'Devre Arası Açık Düello',
          narrative: `Karşılıklı Hücum Düellosu: İki takım da ilk yarıda savunma güvenliğini ikinci plana attı (Toplam ${totShots} şut, ${totSot} isabet, ${Number((xgHVal + xgAVal).toFixed(2))} xG). 2. yarıda açık alanlar ve karşılıklı gollerin devam etmesi kuvvetle muhtemel.`
        };
      }

      // Case E: Tactical Deadlock
      if (totSot <= 2 && (boxHVal + boxAVal) <= 3 && totFouls >= 10) {
        return {
          archetype: 'HALFTIME_DEADLOCK',
          archetypeLabel: 'Devre Arası Taktik Kilit',
          narrative: `Taktiksel Kilit & Savunma Disiplini: İlk 45 dakikada düşük ceza sahası üretimi (${boxHVal + boxAVal} şut) ve ${totFouls} faul ile oyun kilitlendi; 2. yarıda da düşük tempolu ve kontrollü oyun bekleniyor.`
        };
      }

      // Default Halftime
      return {
        archetype: 'HALFTIME_ANALYSIS',
        archetypeLabel: 'Devre Arası Taktik Analiz',
        narrative: `İlk yarı ${scoreH}-${scoreA} tamamlandı (${match.home.name} ${boxHVal} ceza sahası şutu / ${xgHVal.toFixed(2)} xG, ${match.away.name} ${boxAVal} ceza sahası şutu / ${xgAVal.toFixed(2)} xG). 2. yarı başlangıcıyla canlı baskı radarı aktifleşecek.`
      };
    }

    // 4. Overtime / Stoppage Time (Minute >= 90 in LIVE match)
    if (match.status === 'LIVE' && min >= 90) {
      return {
        archetype: 'STOPPAGE_TIME',
        archetypeLabel: `Uzatma Dakikaları (${min}')`,
        narrative: `Karşılaşma ${scoreH}-${scoreA} skoruyla uzatma dakikalarında (Dk ${min}') oynanıyor. Yüksek varyans ve son anlar nedeniyle yeni sinyal girişi kilitli.`
      };
    }

    // 4c. Late Game Volatility Index (LGV) - Minutes 68-88 with 1-goal margin
    if (lgv && lgv.active && min >= 68 && min <= 88 && absDiff === 1) {
      const trailT = lgv.trailTeam || 'Gerideki Takım';
      const leadT = lgv.leadTeam || 'Öndeki Takım';
      if (lgv.regime === 'BILATERAL_ENDGAME_CHAOS') {
        return {
          archetype: 'LATE_GAME_VOLATILITY',
          archetypeLabel: `Geç Oyun Volatilitesi: Beraberlik Kuşatması & Kontra (${min}')`,
          narrative: `Geç Oyun Volatilitesi: 1 farklı skor dezavantajındaki ${trailT} tüm hatlarıyla yükleniyor (IGP: ${Math.max(igpHome, igpAway)}/100, tehlikeli atak dalgası). Savunma arkasındaki açık alanlar ${leadT} için öldürücü kontra fırsatları yaratıyor; geç oyun gol beklentisi tavan yaptı.`
        };
      }
      if (lgv.regime === 'EQUALIZER_SIEGE') {
        return {
          archetype: 'LATE_GAME_VOLATILITY_EQUALIZER',
          archetypeLabel: `Geç Oyun Beraberlik Baskısı (${trailT})`,
          narrative: `Geç Oyun Beraberlik Baskısı: 1 gol gerideki ${trailT} son bölümde ceza sahası ablukası kurdu (IGP: ${Math.max(igpHome, igpAway)}/100); beraberlik golü için riskler maksimize edildi (+%${Math.round((lgv.equalizerBoost - 1) * 100)} İvme).`
        };
      }
      if (lgv.regime === 'COUNTER_ATTACK_OPPORTUNITY') {
        return {
          archetype: 'LATE_GAME_VOLATILITY_COUNTER',
          archetypeLabel: `Geç Oyun Kontra Tehdidi (${leadT})`,
          narrative: `Geç Oyun Kontra Tehdidi: Gerideki ${trailT} panik faulleri ve top kayıplarıyla savunma dengesini yitirdi; öndeki ${leadT} için kontra atak golü beklentisi zirvede (+%${Math.round((lgv.counterBoost - 1) * 100)} İvme).`
        };
      }
    }

    // 5. Late Game Lock (Minute 75 - 89, when not in active LGV volatility)
    if (min >= 75) {
      return {
        archetype: 'LATE_GAME_LOCK',
        archetypeLabel: `Son Bölüm Kilidi (${min}')`,
        narrative: `Dakika ${min}' itibarıyla efektif oyun süresi azaldığı ve risk/getiri asimetrisi bozulduğu için yeni bahis sinyali üretimi kilitlendi (Mevcut Skor: ${scoreH}-${scoreA}).`
      };
    }

    // 4b. Limited Data — the source publishes no live stats for this match; never infer "low tempo" from missing data
    const totCornersAll = (hS.corners || 0) + (aS.corners || 0);
    const dataPoints = totShots + totCornersAll + totFouls;
    if (!match._statsHydrated || (min >= 15 && dataPoints < 6)) {
      return {
        archetype: 'LIMITED_DATA',
        archetypeLabel: 'Sınırlı Veri',
        narrative: 'Bu maç için canlı istatistik yayınlanmıyor. Skor, dakika ve önemli olaylar takip ediliyor; istatistik olmadan gidişat yorumu ve sinyal üretilmez.'
      };
    }

    // 5. Game Management / Rölanti Modu (2+ goal lead at 58'+ or 3+ goal blowout)
    if (absDiff >= 3 || (absDiff === 2 && min >= 58)) {
      const leadTeam = scoreDiff > 0 ? match.home.name : match.away.name;
      const trailTeam = scoreDiff > 0 ? match.away.name : match.home.name;
      const trailD10Sot = scoreDiff > 0 ? (d10?.away?.shotsOnTarget || 0) : (d10?.home?.shotsOnTarget || 0);
      if (absDiff >= 3 || trailD10Sot < 2) {
        return {
          archetype: 'GAME_MANAGEMENT',
          archetypeLabel: `Skor Koruma / Rölanti (${leadTeam})`,
          narrative: `Skor Koruma / Rölanti: ${leadTeam} ${scoreH}-${scoreA}'lık net skor avantajıyla oyunu soğutarak süreyi eritiyor; gerideki ${trailTeam} son 10 dakikada sadece ${trailD10Sot} isabet bularak organize olamadı.`
        };
      }
    }

    // 6. [V5 NEW] RED_CARD_POWERPLAY — Kırmızı Kart Üstünlüğü & Kuşatma (12' - 72')
    if (hReds !== aReds && min >= 12 && min <= 72) {
      const advHome = aReds > hReds;
      const advIgp = advHome ? igpHome : igpAway;
      const advLead = advHome ? scoreDiff : -scoreDiff;
      const advTeam = advHome ? match.home.name : match.away.name;
      const advStats = advHome ? hS : aS;
      const oppTeam = advHome ? match.away.name : match.home.name;
      const advD10Shots = advHome ? d10HShots : d10AShots;
      const advD10Cor = advHome ? d10HCor : d10ACor;

      if (advIgp >= 52 && advLead <= 1) {
        return {
          archetype: advHome ? 'RED_CARD_POWERPLAY_HOME' : 'RED_CARD_POWERPLAY_AWAY',
          archetypeLabel: `Kırmızı Kart Kuşatması (${advTeam})`,
          narrative: `Kırmızı Kart Kuşatması: 10 kişi kalan ${oppTeam} karşısında sayısal üstünlüğü alan ${advTeam}, son 10 dakikada ${advD10Shots} şut ve ${advD10Cor} kornerle oyunu tamamen rakip yarı sahaya yıktı (${advStats.totalShots || 0} şut, ${advStats.shotsOnTarget || 0} isabet).`
        };
      }
    }

    // 6b. [V7 NEW] GOALKEEPER_SIEGE_BREAKOUT — Kaleci Direnci Kırılması & Varyans Düzeltmesi (15' - 74')
    if (gri && min >= 15 && min <= 74 && absDiff <= 1) {
      if (gri.home?.regime === 'UNSUSTAINABLE_VARIANCE' && igpHome >= 50) {
        return {
          archetype: 'GOALKEEPER_SIEGE_BREAKOUT_HOME',
          archetypeLabel: `Kaleci Direnci Kırılması & Varyans Düzeltmesi (${match.home.name})`,
          narrative: `Kaleci Direnci Kırılması: Rakip kaleci ${gri.home.saveCount} kurtarış (%${Math.round(gri.home.saveRate)} kurtarış yüzdesi) ile direnmeye çalışsa da ${match.home.name} ceza sahası içinden ${boxH} şut ve yoğun xG borcu üretti. İstatistiksel aşırı varyansın ortalamaya dönüşüyle sıradaki gol an meselesidir (+%18 Değer Avantajı / %84 Güven).`
        };
      }
      if (gri.away?.regime === 'UNSUSTAINABLE_VARIANCE' && igpAway >= 50) {
        return {
          archetype: 'GOALKEEPER_SIEGE_BREAKOUT_AWAY',
          archetypeLabel: `Kaleci Direnci Kırılması & Varyans Düzeltmesi (${match.away.name})`,
          narrative: `Kaleci Direnci Kırılması: Rakip kaleci ${gri.away.saveCount} kurtarış (%${Math.round(gri.away.saveRate)} kurtarış yüzdesi) ile direnmeye çalışsa da ${match.away.name} ceza sahası içinden ${boxA} şut ve yoğun xG borcu üretti. İstatistiksel aşırı varyansın ortalamaya dönüşüyle sıradaki gol an meselesidir (+%18 Değer Avantajı / %84 Güven).`
        };
      }
    }

    // 6c. [V7 NEW] HIGH_LINE_TRANSITION_VULNERABILITY — Yüksek Savunma Hattı & Ofsayt Tuzağı Açığı (18' - 74')
    if (hlov && min >= 18 && min <= 74 && absDiff <= 1) {
      if (hlov.home?.active && (hlov.home.offsideCount >= 3 || (d10?.home?.offsides || 0) >= 1)) {
        return {
          archetype: 'HIGH_LINE_TRANSITION_VULNERABILITY_HOME',
          archetypeLabel: `Yüksek Savunma Hattı & Ofsayt Tuzağı Açığı (${match.home.name})`,
          narrative: `Yüksek Savunma Hattı & Geçiş Tehdidi: ${match.home.name} ${hlov.home.offsideCount} kez ofsayta düşerek rakip savunma arkasını zorladı. Deplasman ekibinin kurduğu riskli yüksek çizgi, tek bir kırılmada mutlak karşı karşıya geçiş golü yaratabilir (+%${Math.round((hlov.home.spaceExploitationMult - 1) * 100)} İvme / %80 Güven).`
        };
      }
      if (hlov.away?.active && (hlov.away.offsideCount >= 3 || (d10?.away?.offsides || 0) >= 1)) {
        return {
          archetype: 'HIGH_LINE_TRANSITION_VULNERABILITY_AWAY',
          archetypeLabel: `Yüksek Savunma Hattı & Ofsayt Tuzağı Açığı (${match.away.name})`,
          narrative: `Yüksek Savunma Hattı & Geçiş Tehdidi: ${match.away.name} ${hlov.away.offsideCount} kez ofsayta düşerek rakip savunma arkasını zorladı. Ev sahibinin yüksek savunma bloğu arkasında geniş boşluklar oluştu; kontra geçiş golü ihtimali yüksek (+%${Math.round((hlov.away.spaceExploitationMult - 1) * 100)} İvme / %80 Güven).`
        };
      }
    }

    // 6d. [V7 NEW] STERILE_POSSESSION_DEADLOCK — Steril Top Çevirme & Kompakt Savunma Duvarı
    if (pace.code === 'STERILE_POSSESSION_DEADLOCK' && min >= 25 && min <= 70) {
      const sterileHome = pce?.home?.isSterilePossession;
      const sterileTeam = sterileHome ? match.home.name : match.away.name;
      return {
        archetype: 'STERILE_POSSESSION_DEADLOCK',
        archetypeLabel: `Steril Top Çevirme (${sterileTeam})`,
        narrative: `Steril Top Çevirme & Savunma Bloğu: ${sterileTeam} topla oynama oranında üstün görünse de hücumları üçüncü bölgeye taşımakta zorlanıyor (düşük tehlikeli atak penetrasyonu). Ceza sahası dışı yatay pas trafiği oyunu soğutuyor; düşük skor beklentisi teyitli.`
      };
    }

    // 7. [V5 NEW] FAVORITE_TRAILING_SURGE — Ağır Favori Geri Dönüş Baskısı (14' - 68')
    const open1 = match.odds?.openMs1 || match.odds?.ms1 || 2.50;
    const open2 = match.odds?.openMs2 || match.odds?.ms2 || 2.90;
    if (min >= 14 && min <= 68 && absDiff === 1) {
      if (scoreDiff === -1 && (open1 <= 1.82 || (hS.possession >= 58 && hS.totalShots >= aS.totalShots + 3)) && igpHome >= 56 && (hS.shotsOnTarget >= 2 || (d10.home?.shotsOnTarget || 0) >= 1)) {
        return {
          archetype: 'FAVORITE_TRAILING_SURGE_HOME',
          archetypeLabel: `Favori Reaksiyon Kuşatması (${match.home.name})`,
          narrative: `Favori Reaksiyon Kuşatması: Sürpriz şekilde ${scoreH}-${scoreA} geriye düşen favori ${match.home.name}, son 10 dakikada ${d10HShots} şut ve %${hS.possession || 58} topla oynama ile rakip kaleyi ablukaya aldı; beraberlik baskısı zirvede.`
        };
      }
      if (scoreDiff === 1 && (open2 <= 1.88 || (aS.possession >= 58 && aS.totalShots >= hS.totalShots + 3)) && igpAway >= 56 && (aS.shotsOnTarget >= 2 || (d10.away?.shotsOnTarget || 0) >= 1)) {
        return {
          archetype: 'FAVORITE_TRAILING_SURGE_AWAY',
          archetypeLabel: `Favori Reaksiyon Kuşatması (${match.away.name})`,
          narrative: `Favori Reaksiyon Kuşatması: Sürpriz şekilde ${scoreH}-${scoreA} geriye düşen favori ${match.away.name}, son 10 dakikada ${d10AShots} şut ve %${aS.possession || 58} topla oynama ile rakip kaleyi ablukaya aldı; beraberlik baskısı zirvede.`
        };
      }
    }

    // 8. [V5 NEW] LATE_FIRST_HALF_BLITZ — İlk Yarı Sonu Gol Fırtınası (26' - 42')
    if (min >= 26 && min <= 42 && (scoreH + scoreA) <= 1) {
      const d5Shots = (d5.home?.totalShots || 0) + (d5.away?.totalShots || 0);
      const d5Cor = (d5.home?.corners || 0) + (d5.away?.corners || 0);
      const d10Sot = (d10.home?.shotsOnTarget || 0) + (d10.away?.shotsOnTarget || 0);
      if (Math.max(igpHome, igpAway) >= 57 && (d5Shots >= 2 || d10Sot >= 2 || totSot >= 4)) {
        const blitzTeam = igpHome >= igpAway ? match.home.name : match.away.name;
        return {
          archetype: 'LATE_FIRST_HALF_BLITZ',
          archetypeLabel: `İlk Yarı Sonu Fırtınası (${blitzTeam})`,
          narrative: `İlk Yarı Sonu Fırtınası: Devre öncesinde tempo tırmandı (${min}'). ${blitzTeam} son 5 dakikada ${d5Shots} şut ve ${d5Cor} korner üretti; devre bitmeden gol beklentisi doygunluğa ulaştı.`
        };
      }
    }

    // 8b. 1-1 SKORUNDA TAKTİKSEL PSİKOLOJİ & DERİN ANALİZ MODELİ (40' - 74')
    if (scoreH === 1 && scoreA === 1 && min >= 40 && min <= 74) {
      const boxD10H = d10?.home?.shotsInsideBox || Math.round(0.62 * d10HSot + 0.35 * d10HCor);
      const boxD10A = d10?.away?.shotsInsideBox || Math.round(0.62 * d10ASot + 0.35 * d10ACor);
      const d10TotShots = d10HShots + d10AShots;
      const d10TotSot = d10HSot + d10ASot;

      // Model 1: SECOND_HALF_DRAW_BREAKOUT_HOME (Ev sahibi 1-1 beraberliği bozmak için rakip kaleyi kuşatıyor)
      const homeBreakout = igpHome >= 52 &&
        (igpHome >= igpAway + 4 || d10HShots >= d10AShots + 2) &&
        (d10HShots >= 2 || boxD10H >= 1 || d10HCor >= 1 || boxH >= boxA + 2);

      // Model 2: SECOND_HALF_DRAW_BREAKOUT_AWAY (Deplasman 1-1'de kontra tehdidiyle rakip savunmayı deliyor)
      const awayBreakout = igpAway >= 52 &&
        (igpAway >= igpHome + 4 || d10AShots >= d10HShots + 2) &&
        (d10AShots >= 2 || boxD10A >= 1 || d10ACor >= 1 || boxA >= boxH + 2);

      if (homeBreakout && (!awayBreakout || igpHome >= igpAway)) {
        const boxCount = Math.max(1, boxD10H || Math.round(d10HShots * 0.65));
        return {
          archetype: 'SECOND_HALF_DRAW_BREAKOUT_HOME',
          archetypeLabel: `1-1 Beraberliği Bozma Kuşatması (${match.home.name})`,
          narrative: `Beraberliği Bozma Baskısı: 1-1 giden karşılaşmada ev sahibi son 10 dakikada ceza sahası içinden ${boxCount} şut ve ${d10HCor} korner bularak baskıyı kurdu. Deplasman savunması geri çekildi; 2. yarıda 3. gol (2.5 Üst / Sıradaki Gol Ev) ihtimali çok kuvvetli (%78 Güven).`
        };
      }

      if (awayBreakout) {
        const boxCount = Math.max(1, boxD10A || Math.round(d10AShots * 0.65));
        return {
          archetype: 'SECOND_HALF_DRAW_BREAKOUT_AWAY',
          archetypeLabel: `1-1 Beraberliği Bozma Baskısı (${match.away.name})`,
          narrative: `Beraberliği Bozma Baskısı: 1-1 eşitlikle süren mücadelede deplasman ekibi son 10 dakikada ceza sahası içinden ${boxCount} şut ve kontra tehditleriyle rakip savunma hattını deliyor. Ev sahibi savunması açıklar veriyor; 3. golün deplasmandan gelmesi (2.5 Üst / Sıradaki Gol Dep) çok kuvvetli ihtimal (%76 Güven).`
        };
      }

      // Model 3: TACTICAL_STALEMATE_DRAW (İki takım da 1 puana razı, risk almaktan kaçınıyor - 2.5 Alt gidişatı)
      if (min >= 48 && (d10TotShots <= 2 || (Math.max(igpHome, igpAway) <= 48 && d10TotSot <= 1) || pace.code === 'CHOPPY_DEADLOCK' || pace.code === 'TACTICAL_DRAW_STALEMATE' || totFouls >= 13)) {
        return {
          archetype: 'TACTICAL_STALEMATE_DRAW',
          archetypeLabel: '1-1 Taktiksel Kilit & 1 Puan Hesabı',
          narrative: `1-1 Taktiksel Kilit & 1 Puan Hesabı: Karşılaşma 1-1'e geldikten sonra iki takım da savunma bloklarını geriye çekti, risk almaktan kaçınıyor. Son 10 dakikada ceza sahası içi tehlike üretilmedi; orta saha faulleriyle oyun soğuyor. 2.5 Alt ve karşılaşmanın 1-1 tamamlanma ihtimali çok kuvvetli (%82 Güven).`
        };
      }
    }

    // 9. [V5 NEW] SECOND_HALF_AWAKENING — 2. Yarı Vites Artışı & Baskı Patlaması (48' - 72')
    if (min >= 48 && min <= 72 && absDiff <= 1) {
      const h2H = periodInfo?.half2?.home || d10.home || {};
      const h2A = periodInfo?.half2?.away || d10.away || {};
      const hAwake = (h2H.totalShots >= 3 && h2H.shotsOnTarget >= 1 && igpHome >= 58 && scoreDiff <= 0);
      const aAwake = (h2A.totalShots >= 3 && h2A.shotsOnTarget >= 1 && igpAway >= 58 && scoreDiff >= 0);

      if (hAwake || aAwake) {
        const awakeHome = hAwake && (!aAwake || igpHome >= igpAway);
        const awakeTeam = awakeHome ? match.home.name : match.away.name;
        const awakeH2 = awakeHome ? h2H : h2A;
        return {
          archetype: awakeHome ? 'SECOND_HALF_AWAKENING_HOME' : 'SECOND_HALF_AWAKENING_AWAY',
          archetypeLabel: `2. Yarı Vites Artışı (${awakeTeam})`,
          narrative: `2. Yarı Vites Artışı: ${awakeTeam} ikinci yarıya fırtına gibi başladı! Bu periyotta ${awakeH2.totalShots || 0} şut (${awakeH2.shotsOnTarget || 0} isabet) ve ${awakeH2.corners || 0} kornerle rakip savunma hattını ceza sahasına kilitledi.`
        };
      }
    }

    // 10. [V5 NEW] HIGH_XG_UNDERPERFORMANCE — Yüksek xG & Gol Borcu Patlaması (20' - 71')
    if (min >= 20 && min <= 71 && absDiff <= 1) {
      const debtHomeHigh = scoreH === 0 && (xgDebtH >= 0.92 || (hS.shotsOnTarget >= 4 && (hS.bigChances + hS.woodwork) >= 1)) && igpHome >= 54;
      const debtAwayHigh = scoreA === 0 && (xgDebtA >= 0.92 || (aS.shotsOnTarget >= 4 && (aS.bigChances + aS.woodwork) >= 1)) && igpAway >= 54;
      if (debtHomeHigh || debtAwayHigh) {
        const isHomeDebt = debtHomeHigh && (!debtAwayHigh || xgDebtH >= xgDebtA);
        const tName = isHomeDebt ? match.home.name : match.away.name;
        const tStats = isHomeDebt ? hS : aS;
        const tXg = isHomeDebt ? xgH : xgA;
        const tBox = isHomeDebt ? boxH : boxA;
        return {
          archetype: isHomeDebt ? 'HIGH_XG_UNDERPERFORMANCE_HOME' : 'HIGH_XG_UNDERPERFORMANCE_AWAY',
          archetypeLabel: `Gole Dönüşmeyen Üstünlük (${tName})`,
          narrative: `Gole Dönüşmeyen Üstünlük (xG Borcu): ${tName} henüz gol bulamamasına rağmen ${tBox} ceza sahası şutu, ${tStats.shotsOnTarget || 0} isabet ve ${tStats.corners || 0} korner üretti (xG: ${tXg}). Hak edilen skor gecikti; istatistiksel düzeltme ivmesiyle gol an meselesi.`
        };
      }
    }

    // 11. Tek Kale Kuşatma (One-Sided Siege: IGP >= 60, SOT >= 3)
    const domHome = igpHome >= igpAway;
    const domTeam = domHome ? match.home.name : match.away.name;
    const domStats = domHome ? hS : aS;
    const domLead = domHome ? scoreDiff : -scoreDiff;
    const domIgp = domHome ? igpHome : igpAway;
    const domSot = domStats.shotsOnTarget || 0;
    const domD10Shots = domHome ? d10HShots : d10AShots;
    const domD10Cor = domHome ? d10HCor : d10ACor;
    const domBox = domHome ? boxH : boxA;

    if (domIgp >= 60 && (domSot >= 3 || totSot >= 3) && Math.abs(igpHome - igpAway) >= 10 && (totShots >= 3 || domSot >= 3)) {
      if (domLead < 2) {
        return {
          archetype: domHome ? 'SIEGE_HOME' : 'SIEGE_AWAY',
          archetypeLabel: `Tek Kale Baskı (${domTeam})`,
          narrative: `Baskı Kuşatması: ${domTeam} son 10 dakikada ${domD10Shots} şut ve ${domD10Cor} korner üretti (Ceza sahası: ${domBox}, İsabet: ${domSot}). Rakip ceza sahasında yoğun baskı kuruldu, gol beklentisi doygunluğa ulaştı.`
        };
      }
    }

    // 12. Geriden Gelen Baskın Takım (Bounce-Back Pressure)
    if (scoreDiff !== 0 && absDiff === 1 && ((scoreDiff < 0 && igpHome >= 52 && hS.totalShots >= aS.totalShots) || (scoreDiff > 0 && igpAway >= 52 && aS.totalShots >= hS.totalShots))) {
      const chasingHome = scoreDiff < 0;
      const chasingTeam = chasingHome ? match.home.name : match.away.name;
      const chasingStats = chasingHome ? hS : aS;
      const chasingD10Shots = chasingHome ? d10HShots : d10AShots;
      const chasingD10Cor = chasingHome ? d10HCor : d10ACor;
      return {
        archetype: chasingHome ? 'BOUNCE_BACK_HOME' : 'BOUNCE_BACK_AWAY',
        archetypeLabel: `Geri Dönüş Reaksiyonu (${chasingTeam})`,
        narrative: `Geri Dönüş Reaksiyonu: Skor dezavantajına düşen ${chasingTeam}, son 10 dakikada ${chasingD10Shots} şut ve ${chasingD10Cor} kornerle (${chasingStats.totalShots || 0} toplam şut, ${chasingStats.shotsOnTarget || 0} isabet) yoğun beraberlik baskısı kuruyor.`
      };
    }

    // 13. Karşılıklı Açık Düello (End-to-End Shootout: Her iki taraf IGP >= 45, totSot >= 4)
    if (Math.max(hS.totalShots || 0, hS.shotsOnTarget || 0) >= 1 && Math.max(aS.totalShots || 0, aS.shotsOnTarget || 0) >= 1 && totSot >= 4 && (igpHome >= 45 && igpAway >= 45) && absDiff <= 1) {
      return {
        archetype: 'END_TO_END_SHOOTOUT',
        archetypeLabel: 'Karşılıklı Açık Tempo',
        narrative: `Karşılıklı Açık Oyun & Düello: İki takım da savunma emniyetini bıraktı (Toplam ${totShots} şut, ${totSot} isabet). Orta sahalar hızlı geçiliyor, karşılıklı gol ihtimali zirvede.`
      };
    }

    // 14. Taktiksel Kilit & Faul Duvarı (Tactical Deadlock Under: sadece gerçek veri akışı varken uygulanır, veri yoksa LIMITED_DATA kalır)
    const shotsPerMin = totShots / Math.max(20, min);
    const hasRealDataFlow = totShots >= Math.round(min * 0.12);
    if (
      min >= 25 && min <= 68 &&
      totSot <= 2 &&
      shotsPerMin <= 0.16 &&
      (pace.code === 'CHOPPY_DEADLOCK' || totFouls >= 12 || Math.max(igpHome, igpAway) <= 30)
    ) {
      if (hasRealDataFlow) {
        return {
          archetype: 'TACTICAL_DEADLOCK',
          archetypeLabel: 'Taktiksel Kilit & Düşük Tempo',
          narrative: `Taktiksel Kilit & Savunma Duvarı: Karşılaşmada ${totFouls} faul ve sadece ${totSot} isabetli şut üretildi. Hücumlar ceza sahasına yaklaşmakta zorlanıyor; düşük skorlu gidişat hakim.`
        };
      }
      return {
        archetype: 'LIMITED_DATA',
        archetypeLabel: 'Sınırlı Veri',
        narrative: 'Bu maç için yeterli canlı şut istatistiği akışı bulunmuyor; veri olmadan taktiksel kilit veya düşük tempo çıkarımı yapılmaz.'
      };
    }

    // 15. Normal / Dengeli İzleme Modu
    return {
      archetype: 'MONITORING',
      archetypeLabel: 'Maç Gidişatı İzleniyor',
      narrative: totShots > 0
        ? `Oyun dengeli seyrediyor (Toplam ${totShots} şut, ${totSot} isabetli). Net bir baskı artışı veya fırsat bekleniyor.`
        : `Takımlar birbirini tartıyor. Henüz anlamlı bir şut veya baskı kırılması oluşmadı; sinyal avcısı beklemede.`
    };
  }

  /**
   * Build 3-to-5-Dimensional Analytical Proof Array (`evidenceFactors`) for UI & Signal Explainability
   * Strictly produces between 3 and 5 evidence factors for every archetype.
   * Incorporates Goalkeeper Resistance Index (GRI), Pass Control Efficiency (PCE), and High-Line Offside Vulnerability (HLOV).
   */
  buildEvidenceFactors(match, gpiHome, gpiAway, dpiHome, dpiAway, igpHome, igpAway, pace, d5, d10, periodInfo, archetype = 'MONITORING', lgv = null, ccsm = null, gri = null, pce = null, hlov = null) {
    const hS = match.home?.stats || {};
    const aS = match.away?.stats || {};
    const scoreH = match.home?.score || 0;
    const scoreA = match.away?.score || 0;
    const scoreDiff = scoreH - scoreA;
    const totShots = (hS.totalShots || 0) + (aS.totalShots || 0);
    const totSot = (hS.shotsOnTarget || 0) + (aS.shotsOnTarget || 0);

    // 1. LIMITED_DATA Archetype
    if (archetype === 'LIMITED_DATA') {
      return [
        {
          key: 'DATA_FEED_STATUS',
          title: 'Veri Akış Durumu',
          badge: 'Sınırlı',
          summary: 'Detaylı canlı şut ve korner istatistikleri mevcut değil; temel maç olayları takip ediliyor.',
          score: 25,
          tone: 'amber'
        },
        {
          key: 'MATCH_CONTROL',
          title: 'Skor & Olay Takibi',
          badge: 'Aktif',
          summary: `Skor: ${scoreH}-${scoreA} (${match.minute || 0}') • Kartlar ve goller canlı işleniyor.`,
          score: 50,
          tone: 'blue'
        },
        {
          key: 'RISK_MANAGEMENT',
          title: 'Güvenlik Kilidi',
          badge: 'Koruma Devrede',
          summary: 'Eksik veri nedeniyle yanıltıcı canlı sinyal üretimi önleniyor.',
          score: 92,
          tone: 'slate'
        }
      ];
    }

    // 2. PRE_MATCH Archetype
    if (archetype === 'PRE_MATCH') {
      return [
        {
          key: 'PRE_MATCH_STATUS',
          title: 'Karşılaşma Durumu',
          badge: 'Başlamadı',
          summary: `Başlama saati: ${match.kickoffTime || match.statusText || 'Yaklaşan maç'}.`,
          score: 40,
          tone: 'blue'
        },
        {
          key: 'MARKET_ODDS_STATUS',
          title: 'Piyasa Oranları',
          badge: 'Hazır',
          summary: `Açılış Oranları: MS 1: ${match.odds?.ms1 || '-'} • MS X: ${match.odds?.msX || '-'} • MS 2: ${match.odds?.ms2 || '-'}`,
          score: 65,
          tone: 'slate'
        },
        {
          key: 'RADAR_SYSTEM',
          title: 'Canlı Takip Radarı',
          badge: 'Hazırda',
          summary: 'Karşılaşma başladığı anda şut, xG ve tempo verileri anlık hesaplanacak.',
          score: 85,
          tone: 'emerald'
        }
      ];
    }

    // 3. MATCH_COMPLETED Archetype
    if (archetype === 'MATCH_COMPLETED') {
      return [
        {
          key: 'FINAL_SCORE',
          title: 'Karşılaşma Sonucu',
          badge: 'Maç Sonu',
          summary: `Maç ${scoreH}-${scoreA} skoruyla tamamlandı.`,
          score: 100,
          tone: 'slate'
        },
        {
          key: 'TOTAL_PRODUCTION',
          title: 'Toplam Şut Üretimi',
          badge: 'Nihai',
          summary: `Toplam Şut: Ev ${hS.totalShots || 0} (${hS.shotsOnTarget || 0} isabet) • Dep ${aS.totalShots || 0} (${aS.shotsOnTarget || 0} isabet)`,
          score: 75,
          tone: 'blue'
        },
        {
          key: 'SETTLEMENT_STATE',
          title: 'Sonuçlandırma',
          badge: 'Tamamlandı',
          summary: 'Tüm canlı tahmin ve sinyal kayıtları kapatıldı.',
          score: 100,
          tone: 'emerald'
        }
      ];
    }

    // 3b. STOPPAGE_TIME Archetype (Uzatma Dakikaları)
    if (archetype === 'STOPPAGE_TIME') {
      return [
        {
          key: 'STOPPAGE_STATUS',
          title: 'Uzatma Bölümü',
          badge: `Dk ${match.minute || 90}'`,
          summary: `Karşılaşma ${scoreH}-${scoreA} skoruyla uzatma dakikalarında devam ediyor.`,
          score: 95,
          tone: 'amber'
        },
        {
          key: 'MATCH_CONTROL',
          title: 'Mevcut Skor Durumu',
          badge: 'Canlı (Uzatma)',
          summary: `Skor ${scoreH}-${scoreA} • Toplam Şut: ${totShots} (${totSot} isabetli).`,
          score: 80,
          tone: 'blue'
        },
        {
          key: 'SAFETY_GATE',
          title: 'Risk Filtresi',
          badge: 'Devrede',
          summary: 'Uzatma dakikalarında yüksek varyans nedeniyle yeni canlı bahis sinyali kilitlidir.',
          score: 99,
          tone: 'slate'
        }
      ];
    }

    // 4. LATE_GAME_LOCK Archetype
    if (archetype === 'LATE_GAME_LOCK') {
      return [
        {
          key: 'LATE_LOCK_TIME',
          title: 'Son Bölüm Kilidi',
          badge: `Dk ${match.minute || 75}'`,
          summary: 'Son 15 dakikada artan varyans ve azalan efektif oyun süresi nedeniyle yeni sinyal üretimi kilitlendi.',
          score: 85,
          tone: 'amber'
        },
        {
          key: 'MATCH_CONTROL',
          title: 'Mevcut Skor Durumu',
          badge: 'Aktif',
          summary: `Skor ${scoreH}-${scoreA} • Toplam Şut: ${totShots} (${totSot} isabetli).`,
          score: 60,
          tone: 'blue'
        },
        {
          key: 'SAFETY_GATE',
          title: 'Risk Filtresi',
          badge: 'Devrede',
          summary: 'Sermaye koruma ve kâr realizasyonu amacıyla piyasa izleme modunda kalınmaktadır.',
          score: 95,
          tone: 'slate'
        }
      ];
    }

    // 4c. LATE_GAME_VOLATILITY Evidence Matrix (Minutes 68-88 with 1-goal margin)
    if (archetype.startsWith('LATE_GAME_VOLATILITY')) {
      const isEq = lgv?.isEqualizerSurge;
      const isCnt = lgv?.isCounterSurge;
      const trailT = lgv?.trailTeam || 'Gerideki Takım';
      const leadT = lgv?.leadTeam || 'Öndeki Takım';
      const eqBoost = lgv ? Math.round((lgv.equalizerBoost - 1) * 100) : 30;
      const cntBoost = lgv ? Math.round((lgv.counterBoost - 1) * 100) : 24;
      const hdiHVal = this.computeHighDangerIndex(hS);
      const hdiAVal = this.computeHighDangerIndex(aS);

      return [
        {
          key: 'LGV_VOLATILITY_SURGE',
          title: 'Geç Oyun Volatilitesi (68-88)',
          badge: isEq && isCnt ? 'Çift Yönlü Kaos' : (isEq ? 'Beraberlik Baskısı' : 'Kontra Tehdidi'),
          summary: isEq && isCnt
            ? `${trailT} beraberlik için yüklenirken (+%${eqBoost} eşitlik lambda boost'u), açık alanlar ${leadT} için ölümcül kontra fırsatı yaratıyor (+%${cntBoost} kontra ivmesi).`
            : (isEq
              ? `${trailT} 1 farklı skoru eşitlemek için yoğun ceza sahası baskısı kurdu (+%${eqBoost} eşitlik lambda boost'u, IGP: ${Math.max(igpHome, igpAway)}).`
              : `${trailT} panik faulleri ve top kayıplarıyla savunma dengesini yitirdi; ${leadT} hızlı geçişlerle kontra golüne çok yakın (+%${cntBoost} kontra ivmesi).`),
          score: Math.round(this.clamp(72, 98, Math.max(igpHome, igpAway) * 0.85 + (isEq ? 15 : 0) + (isCnt ? 12 : 0))),
          tone: 'rose'
        },
        {
          key: 'ATTACK_QUALITY',
          title: 'Ceza Sahası Tehlike Endeksi (HDI)',
          badge: (hdiHVal + hdiAVal) >= 12 ? 'Çok Yüksek' : 'Aktif',
          summary: `Ceza sahası içi şut: Ev ${hS.shotsInsideBox || 0} • Dep ${aS.shotsInsideBox || 0} (HDI: Ev ${hdiHVal} • Dep ${hdiAVal}) • ${totSot} isabetli şut`,
          score: Math.round(this.clamp(40, 98, (hdiHVal + hdiAVal) * 4.5)),
          tone: 'emerald'
        },
        {
          key: 'DEFENSIVE_RESISTANCE',
          title: 'Savunma Direnci & Panik (DPI)',
          badge: Math.max(dpiHome, dpiAway) >= 64 ? 'Ağır Panik' : 'Zorlanıyor',
          summary: `${dpiHome >= dpiAway ? (match.home?.name || 'Ev') : (match.away?.name || 'Dep')} savunması gerideki baskı altında hata riski taşıyor (DPI: ${Math.max(dpiHome, dpiAway)}/100).`,
          score: Math.max(dpiHome, dpiAway),
          tone: Math.max(dpiHome, dpiAway) >= 64 ? 'rose' : 'amber'
        },
        {
          key: 'NEXT_GOAL_PROJECTION',
          title: 'Geç Oyun Gol Projeksiyonu',
          badge: isEq ? `Sıradaki Gol ${trailT}` : `Sıradaki Gol ${leadT}`,
          summary: `Dakika ${match.minute || 0}' itibarıyla geç oyun volatilite dinamikleri devrede; karşılaşmanın bu skorla (${scoreH}-${scoreA}) bitmeme ve gol çıkma olasılığı yüksek (%84 Güven).`,
          score: 85,
          tone: 'emerald'
        }
      ];
    }

    const xgH = this.estimateTeamXg(hS, aS);
    const xgA = this.estimateTeamXg(aS, hS);
    const boxH = hS.shotsInsideBox || Math.round(0.62 * (hS.shotsOnTarget || 0) + 0.35 * (hS.corners || 0));
    const boxA = aS.shotsInsideBox || Math.round(0.62 * (aS.shotsOnTarget || 0) + 0.35 * (aS.corners || 0));
    const bcTot = (hS.bigChances || 0) + (aS.bigChances || 0);
    const woodTot = (hS.woodwork || 0) + (aS.woodwork || 0);
    const hdiH = this.computeHighDangerIndex(hS);
    const hdiA = this.computeHighDangerIndex(aS);

    // 1. ATTACK_QUALITY (Pozisyon & xG Kalitesi - Ceza sahası 2.5x, İsabet 1.8x, Direk 1.6x, Net Fırsat 2.8x, PCE)
    const maxPce = Math.max(pce?.home?.pce || 1.0, pce?.away?.pce || 1.0);
    const pceBadgeText = maxPce >= 1.15 ? 'Dikey Kuşatma' : (maxPce <= 0.88 ? 'Steril Top Çevirme' : 'Dengeli');
    const qualityScore = Math.round(this.clamp(10, 99, (xgH + xgA) * 26 + (boxH + boxA) * 3.5 + totSot * 5 + bcTot * 12 + woodTot * 10));
    const attackSummary = `Ceza sahası içi şut: Ev ${boxH} • Dep ${boxA} (HDI: Ev ${hdiH} • Dep ${hdiA})` +
      ` • Pas Verimliliği (PCE): ${pceBadgeText} (${maxPce.toFixed(2)})` +
      (bcTot + woodTot > 0 ? ` (${bcTot} net pozisyon, ${woodTot} direk)` : '') +
      ` • Toplam ${totSot} isabetli şut`;

    // 2. TEMPO_VELOCITY (Son 5'/10' & 2. Yarı İvmesi)
    const d5Shots = (d5?.home?.totalShots || 0) + (d5?.away?.totalShots || 0);
    const d5Cor = (d5?.home?.corners || 0) + (d5?.away?.corners || 0);
    const d10Shots = (d10?.home?.totalShots || 0) + (d10?.away?.totalShots || 0);
    const d10Cor = (d10?.home?.corners || 0) + (d10?.away?.corners || 0);
    const h2Text = periodInfo?.hasHalf2Data
      ? ` • 2. Yarı: ${(periodInfo.half2?.home?.totalShots || 0) + (periodInfo.half2?.away?.totalShots || 0)} şut`
      : '';
    const velocityScore = Math.round(this.clamp(12, 99, Math.max(gpiHome, gpiAway) * 0.72 + d5Shots * 8 + d10Cor * 4));
    const tempoSummary = `Son 10 dakikada ${Math.round(d10Shots)} şut ve ${Math.round(d10Cor)} korner üretildi${h2Text} (${pace?.label || 'Dengeli Akış'})`;

    // 3. DEFENSIVE_RESISTANCE (Savunma Direnci, DPI & Kaleci Direnci GRI)
    const maxDpi = Math.max(dpiHome, dpiAway);
    const panicSide = dpiHome >= dpiAway ? match.home?.name || 'Ev Sahibi' : match.away?.name || 'Deplasman';
    const totSaves = (hS.saves || 0) + (aS.saves || 0);
    const totBlk = (hS.blockedShots || 0) + (aS.blockedShots || 0);
    const defLevel = maxDpi >= 64 ? 'ağır baskı altında' : (maxDpi >= 42 ? 'zorlanıyor' : 'dengede');

    const griH = gri?.home;
    const griA = gri?.away;
    const isGriUnsustainable = (griH?.regime === 'UNSUSTAINABLE_VARIANCE') || (griA?.regime === 'UNSUSTAINABLE_VARIANCE');
    const isGriWall = (griH?.regime === 'IMPENETRABLE_WALL') || (griA?.regime === 'IMPENETRABLE_WALL');

    let defBadge = maxDpi >= 64 ? 'Zorlanıyor' : (maxDpi >= 42 ? 'Baskı altında' : 'Dengeli');
    let tempoSummaryDef = `${panicSide} savunması ${defLevel} (${totSaves} kaleci kurtarışı, ${totBlk} engellenen şut)`;

    if (isGriUnsustainable) {
      const activeGri = griH?.regime === 'UNSUSTAINABLE_VARIANCE' ? griH : griA;
      defBadge = 'Aşırı Varyans (+%18 Edge)';
      tempoSummaryDef = `Rakip kaleci ${activeGri.saveCount} kurtarış (%${Math.round(activeGri.saveRate)}%) ile dirense de sürdürülemez varyans devrede; ortalamaya dönüş golü an meselesidir (+%18 Değer Avantajı).`;
    } else if (isGriWall) {
      defBadge = 'Geçilmez Duvar';
    }

    // 4. MARKET_PSYCHOLOGY (Skor Psikolojisi & Gol Borcu)
    const debtH = Math.max(0, xgH - scoreH);
    const debtA = Math.max(0, xgA - scoreA);
    const maxDebt = Math.max(debtH, debtA);
    const debtTeam = debtH >= debtA ? match.home?.name || 'Ev Sahibi' : match.away?.name || 'Deplasman';
    const psychScore = Math.round(this.clamp(15, 99, Math.max(igpHome, igpAway) * 0.7 + maxDebt * 25));
    const psychSummary = maxDebt >= 0.75
      ? `${debtTeam} yüksek gol beklentisine rağmen skor üretemedi (xG Borcu: +${maxDebt.toFixed(2)}); istatistiksel geri dönüş golü an meselesi`
      : `Mevcut Skor: ${scoreH}-${scoreA} • Saha içi gol beklentisi dengeli ilerliyor`;

    // 5. 1-1 BERABERLİK SKORUNA ÖZEL 4 BOYUTLU KANIT MATRİSİ (evidenceFactors)
    const is11DrawArchetype = (
      archetype === 'SECOND_HALF_DRAW_BREAKOUT_HOME' ||
      archetype === 'SECOND_HALF_DRAW_BREAKOUT_AWAY' ||
      archetype === 'TACTICAL_STALEMATE_DRAW' ||
      archetype === 'HALFTIME_DRAW_BREAKOUT_HOME' ||
      archetype === 'HALFTIME_DRAW_BREAKOUT_AWAY' ||
      archetype === 'HALFTIME_DRAW_DEADLOCK'
    );

    if (is11DrawArchetype) {
      const isHome = archetype.includes('HOME');
      const isAway = archetype.includes('AWAY');
      const isStalemate = archetype.includes('DEADLOCK') || archetype.includes('STALEMATE');
      const activeTeam = isHome ? (match.home?.name || 'Ev Sahibi') : (isAway ? (match.away?.name || 'Deplasman') : null);
      const oppTeam = isHome ? (match.away?.name || 'Deplasman') : (isAway ? (match.home?.name || 'Ev Sahibi') : null);
      const activeBox = isHome ? boxH : (isAway ? boxA : Math.max(boxH, boxA));
      const oppBox = isHome ? boxA : (isAway ? boxH : Math.min(boxH, boxA));
      const activeD10Cor = isHome ? (d10?.home?.corners || 0) : (isAway ? (d10?.away?.corners || 0) : d10Cor);
      const activeIgp = isHome ? igpHome : (isAway ? igpAway : Math.max(igpHome, igpAway));
      const oppDpi = isHome ? dpiAway : (isAway ? dpiHome : Math.max(dpiHome, dpiAway));

      // 1. ATTACK_QUALITY: 1-1'de takımların ceza sahası içine girebilme başarısı
      const drawQualityScore = isStalemate
        ? Math.min(42, qualityScore)
        : Math.round(this.clamp(62, 98, qualityScore + (activeBox >= 4 ? 10 : 4)));
      const drawQualityBadge = isStalemate ? 'Kısıtlı Üretim' : (drawQualityScore >= 72 ? 'Yüksek Ceza Sahası Nüfuzu' : 'Baskı Kuruluyor');
      const drawQualitySummary = isStalemate
        ? `1-1 sonrası iki takım da ceza sahasına girmekte zorlandı (Toplam ${boxH + boxA} ceza sahası şutu, ${totSot} isabet); ceza sahası aksiyonu kilitlendi.`
        : `${activeTeam} 1-1 beraberlikte ceza sahası içinden ${activeBox} şut üreterek (%65+ kutu içi penetrasyon) rakip defansı ablukaya aldı (${oppTeam} sadece ${oppBox} kutu içi şut bulabildi).`;

      // 2. DRAW_PRESSURE: Beraberliği bozma isteği ve son 10 dakika şut temposu
      const drawPressureScore = isStalemate
        ? Math.min(36, velocityScore)
        : Math.round(this.clamp(64, 96, activeIgp * 0.74 + (activeD10Cor * 6) + (d5Shots * 7)));
      const drawPressureBadge = isStalemate ? '1 Puana Razı' : (isHome ? 'Ev Kuşatması' : 'Kontra Tehdidi');
      const drawPressureSummary = isStalemate
        ? `İki takım da 1 puana razı görünüyor; son 10 dakikada sadece ${Math.round(d10Shots)} cılız şut ve ${Math.round(d10Cor)} korner çıktı, tempo dip yaptı.`
        : `${activeTeam} beraberliği kabul etmiyor; son 10 dakikada rakip ceza sahası çevresinde yoğunlaşarak ${Math.round(activeD10Cor)} korner ve şutlarla beraberliği bozma baskısını zirveye taşıdı.`;

      // 3. DEFENSIVE_RESISTANCE: Savunmaların panik ve faul katsayısı
      const drawDefScore = isStalemate ? 38 : oppDpi;
      const drawDefBadge = isStalemate ? 'Kompakt Savunma' : (oppDpi >= 62 ? 'Panik & Gedikler' : 'Zorlanıyor');
      const drawDefSummary = isStalemate
        ? `Savunma hatları ceza sahasını başarıyla kapatıyor; orta sahada taktik faullerle oyun soğutuldu ve iki taraf da derinde güvenli bekliyor.`
        : `${oppTeam} savunması ${activeTeam} hücumları karşısında ağır panik halinde (DPI: ${oppDpi}/100, ${totSaves} kaleci kurtarışı, ${totBlk} blok); savunma direnci kırılma noktasında.`;

      // 4. NEXT_GOAL_PROJECTION: Sıradaki golün hangi kanattan geleceği / kimin atacağı veya 2.5 Alt projeksiyonu
      const drawProjScore = isStalemate ? 82 : (isHome ? 78 : 76);
      const drawProjBadge = isStalemate ? '2.5 Alt / 1-1 Bitiş' : (isHome ? '2.5 Üst / Ev Golü' : '2.5 Üst / Dep Golü');
      const drawProjSummary = isStalemate
        ? `Taktiksel kilit ve karşılıklı savunma tedbiri nedeniyle karşılaşmanın 2.5 Alt ve 1-1 skorla sonuçlanma olasılığı çok yüksek (%82 Güven).`
        : `Yoğun ceza sahası baskısı ve duran top kümelenmesiyle sıradaki 3. golün ${activeTeam} tarafından gelmesi ve maçın 2.5 Üst bitmesi kuvvetle muhtemel (%${drawProjScore} Güven).`;

      return [
        {
          key: 'ATTACK_QUALITY',
          title: '1-1 Ceza Sahası Hücum Kalitesi',
          badge: drawQualityBadge,
          summary: drawQualitySummary,
          score: drawQualityScore,
          tone: isStalemate ? 'slate' : 'emerald'
        },
        {
          key: 'DRAW_PRESSURE',
          title: 'Beraberliği Bozma Baskısı',
          badge: drawPressureBadge,
          summary: drawPressureSummary,
          score: drawPressureScore,
          tone: isStalemate ? 'amber' : 'emerald'
        },
        {
          key: 'DEFENSIVE_RESISTANCE',
          title: 'Savunma Direnci & Panik',
          badge: drawDefBadge,
          summary: drawDefSummary,
          score: drawDefScore,
          tone: isStalemate ? 'blue' : (oppDpi >= 60 ? 'rose' : 'amber')
        },
        {
          key: 'NEXT_GOAL_PROJECTION',
          title: 'Sıradaki Gol & Skor Projeksiyonu',
          badge: drawProjBadge,
          summary: drawProjSummary,
          score: drawProjScore,
          tone: isStalemate ? 'blue' : 'emerald'
        }
      ];
    }

    // 6. Halftime Archetypes
    if (archetype.startsWith('HALFTIME_')) {
      const isHomeDom = archetype === 'HALFTIME_SIEGE_DOMINANCE_HOME';
      const isAwayDom = archetype === 'HALFTIME_SIEGE_DOMINANCE_AWAY';
      const domTeam = isHomeDom ? (match.home?.name || 'Ev Sahibi') : (isAwayDom ? (match.away?.name || 'Deplasman') : null);
      const domBox = isHomeDom ? boxH : (isAwayDom ? boxA : Math.max(boxH, boxA));
      const domXg = isHomeDom ? xgH : (isAwayDom ? xgA : Math.max(xgH, xgA));
      const totCornersAll = (hS.corners || 0) + (aS.corners || 0);

      return [
        {
          key: 'ATTACK_QUALITY',
          title: 'Ceza Sahası Pozisyon Kalitesi',
          badge: qualityScore >= 65 ? 'Çok Yüksek' : (qualityScore >= 42 ? 'Orta' : 'Düşük'),
          summary: `Ceza sahası içi şut: Ev ${boxH} • Dep ${boxA} (${totSot} isabet, ${Number((xgH + xgA).toFixed(2))} xG)${bcTot + woodTot > 0 ? ` [${bcTot} net fırsat]` : ''}`,
          score: qualityScore,
          tone: qualityScore >= 65 ? 'emerald' : 'blue'
        },
        {
          key: 'TEMPO_VELOCITY',
          title: 'İlk Yarı Hücum İvmesi',
          badge: velocityScore >= 65 ? 'Yüksek Baskı' : 'Dengeli',
          summary: `İlk 45 dakikada toplam ${totShots} şut ve ${totCornersAll} korner üretildi (${pace?.label || 'Dengeli Akış'}).`,
          score: velocityScore,
          tone: velocityScore >= 65 ? 'emerald' : 'amber'
        },
        {
          key: 'DEFENSIVE_RESISTANCE',
          title: 'Savunma Direnci & Baskı',
          badge: maxDpi >= 60 ? 'Savunma Zorlanıyor' : 'Dengeli',
          summary: `${panicSide} savunması ilk yarıda ${totSaves} kaleci kurtarışı ve ${totBlk} blokla direnmeye çalıştı.`,
          score: maxDpi,
          tone: maxDpi >= 60 ? 'rose' : 'blue'
        },
        {
          key: 'SECOND_HALF_PREDICTION',
          title: '2. Yarı Taktiksel Projeksiyon',
          badge: domTeam ? 'Baskı Kaçınılmaz' : 'Gidişat Bekleniyor',
          summary: domTeam
            ? `${domTeam} ilk yarıdaki ceza sahası ablukasını (${domBox} şut, ${domXg.toFixed(2)} xG) 2. yarıda sürdürecek; sıradaki gol baskısı çok yüksek.`
            : `Mevcut Skor: ${scoreH}-${scoreA} • 2. yarı başında takımların hamleleri ve tempo sıçraması takip edilecek.`,
          score: domTeam ? 88 : 70,
          tone: domTeam ? 'emerald' : 'slate'
        }
      ];
    }

    // 6. GAME_MANAGEMENT Archetype
    if (archetype === 'GAME_MANAGEMENT') {
      const leadTeam = scoreDiff > 0 ? match.home?.name : match.away?.name;
      return [
        {
          key: 'GAME_CONTROL',
          title: 'Skor Koruma / Rölanti',
          badge: 'Rölanti',
          summary: `${leadTeam || 'Öndeki takım'} oyunu soğutarak skoru koruyor.`,
          score: 80,
          tone: 'blue'
        },
        {
          key: 'ATTACK_QUALITY',
          title: 'Pozisyon Kalitesi',
          badge: qualityScore >= 68 ? 'Yüksek' : (qualityScore >= 45 ? 'Orta' : 'Düşük'),
          summary: attackSummary,
          score: qualityScore,
          tone: qualityScore >= 68 ? 'emerald' : (qualityScore >= 45 ? 'blue' : 'slate')
        },
        {
          key: 'TEMPO_VELOCITY',
          title: 'Maç Temposu',
          badge: 'Düşük',
          summary: tempoSummary,
          score: Math.min(45, velocityScore),
          tone: 'slate'
        },
        {
          key: 'DEFENSIVE_RESISTANCE',
          title: 'Savunma Durumu',
          badge: 'Dengeli',
          summary: tempoSummaryDef,
          score: maxDpi,
          tone: 'blue'
        }
      ];
    }

    // Core 4 Evidence Factors for In-Play Scenarios
    const factors = [
      {
        key: 'ATTACK_QUALITY',
        title: 'Pozisyon Kalitesi',
        badge: qualityScore >= 68 ? 'Yüksek' : (qualityScore >= 45 ? 'Orta' : 'Düşük'),
        summary: attackSummary,
        score: qualityScore,
        tone: qualityScore >= 68 ? 'emerald' : (qualityScore >= 45 ? 'blue' : 'slate')
      },
      {
        key: 'TEMPO_VELOCITY',
        title: 'Maç Temposu',
        badge: velocityScore >= 68 ? 'Yüksek' : (velocityScore >= 45 ? 'Orta' : 'Düşük'),
        summary: tempoSummary,
        score: velocityScore,
        tone: velocityScore >= 68 ? 'emerald' : (velocityScore >= 45 ? 'amber' : 'slate')
      },
      {
        key: 'DEFENSIVE_RESISTANCE',
        title: 'Savunma & Kaleci Direnci',
        badge: defBadge,
        summary: tempoSummaryDef,
        score: isGriUnsustainable ? (griH?.regime === 'UNSUSTAINABLE_VARIANCE' ? griH.griScore : griA.griScore) : maxDpi,
        tone: isGriUnsustainable ? 'emerald' : (maxDpi >= 64 ? 'rose' : (maxDpi >= 42 ? 'amber' : 'blue'))
      },
      {
        key: 'MARKET_PSYCHOLOGY',
        title: 'Gol Beklentisi',
        badge: psychScore >= 68 ? 'Yüksek' : 'Normal',
        summary: psychSummary,
        score: psychScore,
        tone: psychScore >= 68 ? 'emerald' : 'blue'
      }
    ];

    // Archetype-Specific 5th Factor (Cap at 5 factors max)
    if (isGriUnsustainable && factors.length < 5) {
      const activeGri = griH?.regime === 'UNSUSTAINABLE_VARIANCE' ? griH : griA;
      const attTeam = griH?.regime === 'UNSUSTAINABLE_VARIANCE' ? match.home?.name : match.away?.name;
      factors.push({
        key: 'GRI_VARIANCE_EDGE',
        title: 'Kaleci Direnci & Ortalamaya Dönüş',
        badge: '+%18 Değer Avantajı',
        summary: `${attTeam || 'Hücum takımı'} yoğun xG borcu ve ceza sahası baskısıyla rakip kaleciyi (${activeGri.saveCount} kurtarış) aşırı varyansa zorladı; ortalamaya dönüş sıradaki golü tetikleyecek.`,
        score: activeGri.griScore || 88,
        tone: 'emerald'
      });
    } else if ((hlov?.home?.active || hlov?.away?.active) && factors.length < 5) {
      const activeHlov = hlov.home?.active ? hlov.home : hlov.away;
      const tName = hlov.home?.active ? match.home?.name : match.away?.name;
      factors.push({
        key: 'HIGH_LINE_EXPLOITATION',
        title: 'Yüksek Savunma Hattı & Ofsayt Açığı',
        badge: 'Geçiş Golü Tehdidi',
        summary: `${tName || 'Takım'} ${activeHlov.offsideCount} kez ofsayta düşerek rakip yüksek hattını yıprattı; savunma arkası boşluklardan kontra geçiş golü ihtimali yüksek (+%${Math.round((activeHlov.spaceExploitationMult - 1) * 100)} İvme).`,
        score: Math.round(this.clamp(72, 94, 70 + activeHlov.offsideCount * 6)),
        tone: 'amber'
      });
    } else if (archetype === 'SIEGE_HOME' || archetype === 'SIEGE_AWAY') {
      const domTeam = archetype === 'SIEGE_HOME' ? match.home?.name : match.away?.name;
      factors.push({
        key: 'SIEGE_DOMINANCE',
        title: 'Baskı Kuşatması',
        badge: 'Maksimum',
        summary: `Baskı Kuşatması: ${domTeam || 'Baskın takım'} son 10 dakikada rakip ceza sahasını abluka altına aldı (IGP: ${Math.max(igpHome, igpAway)}/100, ${totSot} isabetli şut); gol beklentisi doygunluğa ulaştı.`,
        score: Math.round(this.clamp(60, 99, Math.max(igpHome, igpAway))),
        tone: 'emerald'
      });
    } else if (archetype === 'END_TO_END_SHOOTOUT') {
      factors.push({
        key: 'BILATERAL_TEMPO',
        title: 'Karşılıklı Hücum Düellosu',
        badge: 'Yüksek Tempo',
        summary: `İki takım da savunma bloklarını öne çıkardı (Toplam ${totShots} şut, ${totSot} isabet). Orta sahalar hızlı geçiliyor, iki taraflı gol ihtimali çok yüksek.`,
        score: Math.round(this.clamp(60, 99, (igpHome + igpAway) / 2)),
        tone: 'emerald'
      });
    } else if (archetype === 'TACTICAL_DEADLOCK') {
      factors.push({
        key: 'TACTICAL_BLOCK',
        title: 'Taktik Kilit & Savunma Duvarı',
        badge: 'Kilitli',
        summary: `Faul yoğunluğu ve ceza sahası uzaklığı nedeniyle düşük skorlu gidişat teyitli; savunmalar hata yapmıyor.`,
        score: 82,
        tone: 'rose'
      });
    } else if (archetype === 'FAVORITE_TRAILING_SURGE_HOME' || archetype === 'FAVORITE_TRAILING_SURGE_AWAY') {
      const favTeam = archetype === 'FAVORITE_TRAILING_SURGE_HOME' ? match.home?.name : match.away?.name;
      factors.push({
        key: 'FAVORITE_REACTION',
        title: 'Favori Geri Dönüş Kuşatması',
        badge: 'Kritik Reaksiyon',
        summary: `Geride olan favori ${favTeam || 'takım'} tüm hatlarıyla rakip ceza sahasına yüklendi; beraberlik baskısı zirvede.`,
        score: 88,
        tone: 'amber'
      });
    } else if (archetype === 'RED_CARD_POWERPLAY_HOME' || archetype === 'RED_CARD_POWERPLAY_AWAY') {
      const advTeam = archetype === 'RED_CARD_POWERPLAY_HOME' ? match.home?.name : match.away?.name;
      factors.push({
        key: 'POWERPLAY_ADVANTAGE',
        title: 'Kırmızı Kart Kuşatması',
        badge: 'Sayısal Üstünlük',
        summary: `10 kişi kalan rakibe karşı ${advTeam || 'takım'} alan üstünlüğü kurdu; ceza sahası içi şut frekansı katlandı.`,
        score: 90,
        tone: 'rose'
      });
    } else if (archetype === 'SECOND_HALF_AWAKENING_HOME' || archetype === 'SECOND_HALF_AWAKENING_AWAY') {
      const awakeTeam = archetype === 'SECOND_HALF_AWAKENING_HOME' ? match.home?.name : match.away?.name;
      factors.push({
        key: 'PERIOD_AWAKENING',
        title: '2. Yarı Vites Artışı',
        badge: 'İvme Patlaması',
        summary: `${awakeTeam || 'Takım'} ikinci yarıda hücum temposunu ve ceza sahası penetrasyonunu dramatik biçimde artırdı; gol kapıda.`,
        score: 86,
        tone: 'emerald'
      });
    } else if (archetype === 'HIGH_XG_UNDERPERFORMANCE_HOME' || archetype === 'HIGH_XG_UNDERPERFORMANCE_AWAY') {
      const debtTeam = archetype === 'HIGH_XG_UNDERPERFORMANCE_HOME' ? match.home?.name : match.away?.name;
      factors.push({
        key: 'XG_DEBT_SURGE',
        title: 'Gole Dönüşmeyen Üstünlük (xG Borcu)',
        badge: 'Gol Borcu',
        summary: `${debtTeam || 'Takım'} biriken ceza sahası pozisyonlarına rağmen skor üretemedi; istatistiksel düzeltme ivmesiyle gol beklentisi çok yüksek.`,
        score: 91,
        tone: 'emerald'
      });
    } else if (archetype === 'LATE_FIRST_HALF_BLITZ') {
      factors.push({
        key: 'FIRST_HALF_BLITZ',
        title: 'İlk Yarı Sonu Baskısı',
        badge: 'Devre Öncesi İvme',
        summary: `Devre arasına girilirken hücum temposu ve şut frekansı tavan yaptı; devre bitmeden gol bekleniyor.`,
        score: 84,
        tone: 'emerald'
      });
    } else if (archetype === 'BOUNCE_BACK_HOME' || archetype === 'BOUNCE_BACK_AWAY') {
      const chasingTeam = archetype === 'BOUNCE_BACK_HOME' ? match.home?.name : match.away?.name;
      factors.push({
        key: 'BOUNCE_BACK_INTENSITY',
        title: 'Geri Dönüş Reaksiyonu',
        badge: 'Skor Reaksiyonu',
        summary: `Yenik duruma düşen ${chasingTeam || 'takım'} beraberlik için rakip yarı sahaya yoğun baskı kuruyor.`,
        score: 78,
        tone: 'blue'
      });
    }

    // Strictly enforce at least 3, at most 5 evidence factors
    if (factors.length > 5) {
      return factors.slice(0, 5);
    }
    while (factors.length < 3) {
      factors.push({
        key: `FACTOR_${factors.length + 1}`,
        title: 'Genel Değerlendirme',
        badge: 'Standart',
        summary: 'Karşılaşma genel dinamikleri ve tempo göstergeleri takip ediliyor.',
        score: 50,
        tone: 'blue'
      });
    }
    return factors;
  }

  analyzeMatchFlow(match, windows) {
    const minute = match.minute || 0;
    const hStats = match.home.stats || {};
    const aStats = match.away.stats || {};
    const rawD5 = windows.delta5;
    const rawD10 = windows.delta10;

    // Extract period-specific stats (1st Half vs 2nd Half) & hydrate cold sliding windows
    const periodInfo = this.extractActivePeriodStats(match, rawD5, rawD10);
    const d5 = periodInfo.effD5;
    const d10 = periodInfo.effD10;

    // Blowout Cruise-Control Damping:
    // When margin >= 3 or late 2-goal leads with reduced pace, exponentially damp residual pressure
    const scoreDiff = (match.home.score || 0) - (match.away.score || 0);
    const absDiff = Math.abs(scoreDiff);
    let decayH = 1.0;
    let decayA = 1.0;
    if (absDiff >= 3) {
      // Blowout Cruise-Control: Exponential damping on 3+ goal margins
      const blowoutDecay = Math.max(0.12, 0.38 * Math.exp(-0.045 * Math.max(1, minute - 30)));
      decayH = blowoutDecay;
      decayA = blowoutDecay;
    } else if (absDiff === 2 && minute >= 55) {
      // Late 2-goal leads with reduced pace: Exponential damping
      const totSot10 = (d10.home.shotsOnTarget || 0) + (d10.away.shotsOnTarget || 0);
      if (totSot10 <= 2) {
        const leadDecay = Math.max(0.18, 0.30 * Math.exp(-0.048 * (minute - 55)));
        const trailDecay = Math.max(0.24, 0.44 * Math.exp(-0.038 * (minute - 55)));
        if (scoreDiff > 0) {
          decayH = leadDecay;
          decayA = trailDecay;
        } else {
          decayA = leadDecay;
          decayH = trailDecay;
        }
      }
    } else if (absDiff === 1 && minute >= 70) {
      if (scoreDiff > 0 && (d5.home.totalShots || 0) === 0) decayH = 0.72;
      if (scoreDiff < 0 && (d5.away.totalShots || 0) === 0) decayA = 0.72;
    }

    const recentVarHome = (match.incidents || []).some(
      inc => inc.eventType === 'GOAL_DISALLOWED' && inc.team === 'HOME' && (minute - inc.minute) <= 10
    );
    const recentVarAway = (match.incidents || []).some(
      inc => inc.eventType === 'GOAL_DISALLOWED' && inc.team === 'AWAY' && (minute - inc.minute) <= 10
    );

    const h2Home = periodInfo.hasHalf2Data ? periodInfo.half2.home : null;
    const h2Away = periodInfo.hasHalf2Data ? periodInfo.half2.away : null;

    // Goalkeeper Resistance Index (GRI) for both teams
    const griHome = this.computeGoalkeeperResistanceIndex(hStats, aStats, match.home?.score || 0, match.away?.score || 0, d5.home, d10.home);
    const griAway = this.computeGoalkeeperResistanceIndex(aStats, hStats, match.away?.score || 0, match.home?.score || 0, d5.away, d10.away);

    // Possession Quality & Pass Control Efficiency (PCE)
    const pceHome = this.computePassControlEfficiency(hStats, aStats, minute);
    const pceAway = this.computePassControlEfficiency(aStats, hStats, minute);

    // High Defensive Line & Offside Trap Vulnerability (HLOV)
    const hlovHome = this.computeHighLineOffsideVulnerability(hStats, aStats, minute, d10.home);
    const hlovAway = this.computeHighLineOffsideVulnerability(aStats, hStats, minute, d10.away);

    const isHt = match.status === 'HT';
    const effMin = isHt ? 45 : minute;
    const gpiHome = match.status === 'FT'
      ? 0
      : this.computeTeamGpi(effMin, d5.home, d10.home, hStats, h2Home, recentVarHome ? 1.18 : 1.0, decayH, isHt, pceHome.pce, griHome.lambdaBoost);
    const gpiAway = match.status === 'FT'
      ? 0
      : this.computeTeamGpi(effMin, d5.away, d10.away, aStats, h2Away, recentVarAway ? 1.18 : 1.0, decayA, isHt, pceAway.pce, griAway.lambdaBoost);

    const dpiHome = match.status === 'FT' ? 0 : this.computeDefensivePanic(gpiAway, d10.away, d5.home, d10.home);
    const dpiAway = match.status === 'FT' ? 0 : this.computeDefensivePanic(gpiHome, d10.home, d5.away, d10.away);

    const igpHome = Math.round(0.65 * gpiHome + 0.35 * dpiAway);
    const igpAway = Math.round(0.65 * gpiAway + 0.35 * dpiHome);

    const shotBurstHome = (d5.home.totalShots >= 2 && d5.home.shotsOnTarget >= 1) || (d10.home.totalShots >= 4 && d10.home.shotsOnTarget >= 2);
    const shotBurstAway = (d5.away.totalShots >= 2 && d5.away.shotsOnTarget >= 1) || (d10.away.totalShots >= 4 && d10.away.shotsOnTarget >= 2);

    // High-Danger Index (HDI) for both teams
    const hdiHome = this.computeHighDangerIndex(hStats);
    const hdiAway = this.computeHighDangerIndex(aStats);

    // Corner Cluster Surge Model (CCSM) evaluation (+22% to +35% goal expectancy boost on clusters)
    const ccsmHome = this.evaluateCornerClusterSurge(d5.home, d10.home);
    const ccsmAway = this.evaluateCornerClusterSurge(d5.away, d10.away);
    const cornerClusterHome = ccsmHome.active;
    const cornerClusterAway = ccsmAway.active;

    // Late Game Volatility Index (LGV) evaluation (minutes 68-88 with 1-goal margin)
    const lgv = this.evaluateLateGameVolatility(match, d5, d10, gpiHome, gpiAway, igpHome, igpAway);

    const pace = this.classifyMatchPace(d10.home, d10.away, hStats, aStats, minute, gpiHome, gpiAway, match.home?.score || 0, match.away?.score || 0, pceHome, pceAway);
    const { archetype, archetypeLabel, narrative } = this.detectArchetypeAndNarrative(
      match, gpiHome, gpiAway, dpiHome, dpiAway, igpHome, igpAway, pace, d5, d10, periodInfo, lgv, { home: ccsmHome, away: ccsmAway }, { home: griHome, away: griAway }, { home: pceHome, away: pceAway }, { home: hlovHome, away: hlovAway }
    );
    const evidenceFactors = this.buildEvidenceFactors(
      match, gpiHome, gpiAway, dpiHome, dpiAway, igpHome, igpAway, pace, d5, d10, periodInfo, archetype, lgv, { home: ccsmHome, away: ccsmAway }, { home: griHome, away: griAway }, { home: pceHome, away: pceAway }, { home: hlovHome, away: hlovAway }
    );

    return {
      gpiHome,
      gpiAway,
      dpiHome,
      dpiAway,
      igpHome,
      igpAway,
      shotBurstHome,
      shotBurstAway,
      cornerClusterHome,
      cornerClusterAway,
      ccsmHome,
      ccsmAway,
      lgv,
      hdiHome,
      hdiAway,
      griHome,
      griAway,
      pceHome,
      pceAway,
      hlovHome,
      hlovAway,
      hasHalf2Data: periodInfo.hasHalf2Data,
      half2Stats: periodInfo.half2 || null,
      imminentGoalAlert: (match.status === 'LIVE' && minute < 75 && (igpHome >= 66 || igpAway >= 66)),
      dominantSide: igpHome - igpAway >= 15 ? 'HOME' : (igpAway - igpHome >= 15 ? 'AWAY' : 'BALANCED'),
      tempoLabel: pace.label,
      pace,
      archetype,
      archetypeLabel,
      narrative,
      evidenceFactors
    };
  }
}

module.exports = MatchMomentumEngine;
