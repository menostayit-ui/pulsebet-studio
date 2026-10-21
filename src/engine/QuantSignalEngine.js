/**
 * PulseBet Studio — Quantitative Live Betting, Dixon-Coles & 5-Pillar Sniper Signal Engine (V5)
 * Features:
 *  - Dixon-Coles Low-Score Correlation Adjustment (tau_DC, rho = -0.10) on (0,0), (1,0), (0,1), (1,1)
 *  - Position Quality Multiplier (Q_pos) & xG Debt Regression Boost (delta_lambda_xg_debt)
 *  - 2nd-Half (half2) Pace Separation & 5-Minute Blitz Burst Multiplier
 *  - 5-Pillar Conviction Scoring (Value Edge 28%, Momentum/IGP 22%, xG Debt & Shot Quality 20%, Archetype Alignment 18%, Odds Steam 12%)
 *  - Signal Tier Classification: ELİT SİNYAL (A+), GÜÇLÜ SİNYAL (A), DEĞER SİNYALİ (B+)
 *  - 12 Tactical Archetypes + 3 Quant Micro-Archetype Rescues (XG_DEBT_BREAKOUT, FIVE_MIN_BLITZ, BILATERAL_XG_EXCHANGE)
 *  - Strict 7-Point Safety Gatekeeper (Zero 75'+ late signals, Zero FT/HT signals, Zero MS on leading teams)
 */

class QuantSignalEngine {
  constructor() {
    this.T_FULL = 92;
    this.T_HT = 46;
  }

  clamp(min, max, val) {
    return Math.max(min, Math.min(max, val));
  }

  factorial(n) {
    if (n <= 1) return 1;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  poissonPmf(k, lambda) {
    if (lambda <= 0) return k === 0 ? 1 : 0;
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / this.factorial(k);
  }

  /**
   * V5 Enhanced Synthetic xG incorporating Inside-Box Shots (2.5x), Shots On Target (1.8x), Woodwork (1.6x), Big Chances (2.8x)
   */
  syntheticXg(stats = {}, oppStats = {}) {
    if (stats.xg && stats.xg > 0.05) return Number(stats.xg.toFixed(2));
    const sot = stats.shotsOnTarget || 0;
    const soff = stats.shotsOffTarget || 0;
    const blk = stats.blockedShots || 0;
    const cor = stats.corners || 0;
    const bc = stats.bigChances || 0;
    const wood = stats.woodwork || 0;
    const box = stats.shotsInsideBox || Math.round(0.62 * sot + 0.35 * cor);
    const outBox = Math.max(0, (stats.totalShots || 0) - box);
    const oppSaves = oppStats.saves || 0;

    // Shot Quality weights: Box 2.5x, SOT 1.8x, Woodwork 1.6x, Big Chance 2.8x
    const est = (0.135 * sot) +
      (0.125 * box) +
      (0.330 * bc) +
      (0.240 * wood) +
      (0.028 * outBox) +
      (0.038 * blk) +
      (0.048 * oppSaves) +
      (0.022 * cor) +
      (0.015 * soff);
    return Number(est.toFixed(2));
  }

  /**
   * Position Quality Multiplier Q_pos in [0.76, 1.45]
   * Incorporates Shot Quality weights: Inside-Box (2.5x), Shots On Target (1.8x), Woodwork (1.6x), Big Chance (2.8x)
   */
  computePositionQuality(stats = {}, oppStats = {}) {
    const tot = stats.totalShots || 0;
    if (tot < 2) return 1.0;

    const sot = stats.shotsOnTarget || 0;
    const blk = stats.blockedShots || 0;
    const cor = stats.corners || 0;
    const box = stats.shotsInsideBox || Math.round(0.62 * sot + 0.35 * cor);
    const bc = stats.bigChances || 0;
    const wood = stats.woodwork || 0;
    const oppSaves = oppStats.saves || 0;

    const rBox = this.clamp(0, 1, box / Math.max(1, tot));
    const rAcc = this.clamp(0, 1, (sot + 0.55 * blk) / Math.max(1, tot));
    // High danger impact weighted by shot quality: big chances (2.8x) + woodwork (1.6x) + saves
    const highDangerBonus = 0.080 * Math.min(4, (2.8 / 2.0) * bc + (1.6 / 2.0) * wood) + 0.025 * Math.min(5, oppSaves);

    const qPos = 0.78 + (0.38 * (2.5 / 2.0) * rBox) + (0.24 * (1.8 / 2.0) * rAcc) + highDangerBonus;
    return Number(this.clamp(0.76, 1.45, qPos).toFixed(3));
  }

  derivePriorLambdas(odds) {
    const o1 = odds?.openMs1 || odds?.ms1;
    const oX = odds?.openMsX || odds?.msX;
    const o2 = odds?.openMs2 || odds?.ms2;

    if (o1 > 1.02 && oX > 1.02 && o2 > 1.02) {
      const sumInv = (1 / o1) + (1 / oX) + (1 / o2);
      const p1 = (1 / o1) / sumInv;
      const p2 = (1 / o2) / sumInv;
      const totalGoals = 2.66;
      const shareH = this.clamp(0.23, 0.77, 0.5 + (p1 - p2) * 0.59);
      return {
        priorH: Number((totalGoals * shareH).toFixed(3)),
        priorA: Number((totalGoals * (1 - shareH)).toFixed(3))
      };
    }

    return { priorH: 1.42, priorA: 1.16 };
  }

  /**
   * V5 Dynamic Lambda Calculator with:
   *  - 2nd-Half (half2) Pace Separation
   *  - Position Quality Multiplier (Q_pos)
   *  - 5-Minute Blitz Burst Multiplier (burst5)
   *  - xG Debt Regression Boost (delta_lambda_xg_debt)
   */
  calculateLambdas(match, windows, flow, playerAnalysis) {
    const isScheduled = match.status === 'SCHEDULED';
    const isFinished = match.status === 'FT';
    const isHt = match.status === 'HT';
    const rawMin = isHt ? 45 : (match.minute || 0);
    const t = isScheduled ? 0 : this.clamp(1, 90, rawMin);
    const { priorH, priorA } = this.derivePriorLambdas(match.odds);

    if (isFinished) {
      return {
        priorH,
        priorA,
        lambdaRemH: 0.01,
        lambdaRemA: 0.01,
        priorRemH: 0.01,
        priorRemA: 0.01,
        lambdaHtH: 0,
        lambdaHtA: 0,
        priorHtH: 0,
        priorHtA: 0,
        momentumH: 1.0,
        momentumA: 1.0,
        qPosH: 1.0,
        qPosA: 1.0,
        xgDebtH: 0,
        xgDebtA: 0,
        debtBoostH: 0,
        debtBoostA: 0,
        burst5H: 1.0,
        burst5A: 1.0,
        isFirstHalfActive: false
      };
    }

    const hS = match.home.stats || {};
    const aS = match.away.stats || {};
    const d5H = windows?.delta5?.home || {};
    const d5A = windows?.delta5?.away || {};
    const d10H = windows?.delta10?.home || {};
    const d10A = windows?.delta10?.away || {};

    let effD10H = d10H;
    let effD10A = d10A;
    let effD5H = d5H;
    let effD5A = d5A;
    if (isHt && ((d10H.totalShots || 0) + (d10A.totalShots || 0) + (d10H.corners || 0) + (d10A.corners || 0) === 0)) {
      const scale10 = 10 / 45;
      const scale5 = 5 / 45;
      const scaleStats = (s, f) => ({
        totalShots: Math.round((s?.totalShots || 0) * f),
        shotsOnTarget: Math.round((s?.shotsOnTarget || 0) * f),
        shotsOffTarget: Math.round((s?.shotsOffTarget || 0) * f),
        blockedShots: Math.round((s?.blockedShots || 0) * f),
        shotsInsideBox: Math.round((s?.shotsInsideBox || 0) * f),
        bigChances: Math.round((s?.bigChances || 0) * f),
        woodwork: Math.round((s?.woodwork || 0) * f),
        corners: Math.round((s?.corners || 0) * f),
        saves: Math.round((s?.saves || 0) * f),
        dangerousAttacks: Math.round((s?.dangerousAttacks || 0) * f),
        xg: Number(((s?.xg || 0) * f).toFixed(2))
      });
      effD10H = scaleStats(hS, scale10);
      effD10A = scaleStats(aS, scale10);
      effD5H = scaleStats(hS, scale5);
      effD5A = scaleStats(aS, scale5);
    }

    const xgH = this.syntheticXg(hS, aS);
    const xgA = this.syntheticXg(aS, hS);
    hS.xg = xgH;
    aS.xg = xgA;

    const qPosH = this.computePositionQuality(hS, aS);
    const qPosA = this.computePositionQuality(aS, hS);

    const pIdxH = (0.35 * (hS.shotsOnTarget || 0)) +
      (0.12 * (hS.shotsOffTarget || 0)) +
      (0.14 * (hS.blockedShots || 0)) +
      (0.085 * (hS.corners || 0)) +
      (0.015 * (hS.dangerousAttacks || 0)) +
      (0.008 * Math.max(0, (hS.possession || 50) - 50));

    const pIdxA = (0.35 * (aS.shotsOnTarget || 0)) +
      (0.12 * (aS.shotsOffTarget || 0)) +
      (0.14 * (aS.blockedShots || 0)) +
      (0.085 * (aS.corners || 0)) +
      (0.015 * (aS.dangerousAttacks || 0)) +
      (0.008 * Math.max(0, (aS.possession || 50) - 50));

    const tSafe = isHt ? 45 : Math.max(8, t);
    const rFullH = ((0.62 * xgH + 0.38 * pIdxH) / tSafe) * 90 * qPosH;
    const rFullA = ((0.62 * xgA + 0.38 * pIdxA) / tSafe) * 90 * qPosA;

    // Last-10-minute instantaneous pace
    const xg10H = this.syntheticXg(effD10H, effD10A);
    const xg10A = this.syntheticXg(effD10A, effD10H);
    const rLast10H = (xg10H / 10) * 90;
    const rLast10A = (xg10A / 10) * 90;

    // 2nd-Half True Period Pace (when minute >= 48 and half2 stats exist)
    let rLiveH = rFullH;
    let rLiveA = rFullA;
    if (t >= 48 && flow?.hasHalf2Data && flow?.half2Stats) {
      const t2h = Math.max(4, t - 45);
      const h2H = flow.half2Stats.home || {};
      const h2A = flow.half2Stats.away || {};
      const xg2H = this.syntheticXg(h2H, h2A);
      const xg2A = this.syntheticXg(h2A, h2H);
      const rHalf2H = (xg2H / t2h) * 90 * this.computePositionQuality(h2H, h2A);
      const rHalf2A = (xg2A / t2h) * 90 * this.computePositionQuality(h2A, h2H);
      // Blend 68% 2nd-Half rate + 32% Full-Match rate so 2nd-half shifts dominate immediately
      rLiveH = 0.68 * rHalf2H + 0.32 * rFullH;
      rLiveA = 0.68 * rHalf2A + 0.32 * rFullA;
    }

    // Small-sample shrinkage: few shots/corners => lean on the market prior instead of noisy live rates
    const sampleSize = (hS.totalShots || 0) + (aS.totalShots || 0) + 0.5 * ((hS.corners || 0) + (aS.corners || 0));
    const sampleShrink = this.clamp(0.30, 1.0, sampleSize / 16);
    const wLive = isScheduled
      ? 0
      : (isHt ? this.clamp(0.55, 0.85, sampleSize / 14) : this.clamp(0.12, 0.80, Math.pow(t / 90, 0.72)) * sampleShrink);
    const gH = match.home.score || 0;
    const gA = match.away.score || 0;
    const scoreDiff = gH - gA;
    const absDiff = Math.abs(scoreDiff);

    // If a team leads by 2+ goals, weight last-10m pace heavily so first-half stats don't inflate remaining lambda
    const effLiveH = (scoreDiff >= 2 && t >= 55) ? (0.25 * rLiveH + 0.75 * rLast10H) : rLiveH;
    const effLiveA = (scoreDiff <= -2 && t >= 55) ? (0.25 * rLiveA + 0.75 * rLast10A) : rLiveA;

    const baseRateH = (1 - wLive) * priorH + wLive * effLiveH;
    const baseRateA = (1 - wLive) * priorA + wLive * effLiveA;

    // Dynamic Last-10-Minute Pressure Delta (IGP) & Weighted Shot Quality (box 2.5x, sot 1.8x, wood 1.6x, bc 2.8x)
    const igpH = Number(flow?.igpHome ?? 50);
    const igpA = Number(flow?.igpAway ?? 50);

    const q10H = this.computePositionQuality(effD10H, effD10A);
    const q10A = this.computePositionQuality(effD10A, effD10H);

    const d10BoxH = effD10H.shotsInsideBox || Math.round(0.62 * (effD10H.shotsOnTarget || 0) + 0.35 * (effD10H.corners || 0));
    const d10BoxA = effD10A.shotsInsideBox || Math.round(0.62 * (effD10A.shotsOnTarget || 0) + 0.35 * (effD10A.corners || 0));
    const d10SqH = (2.50 * d10BoxH) + (1.80 * (effD10H.shotsOnTarget || 0)) + (2.80 * (effD10H.bigChances || 0)) + (1.60 * (effD10H.woodwork || 0));
    const d10SqA = (2.50 * d10BoxA) + (1.80 * (effD10A.shotsOnTarget || 0)) + (2.80 * (effD10A.bigChances || 0)) + (1.60 * (effD10A.woodwork || 0));

    const deltaIgpNormH = (igpH - 46) / 28;
    const deltaIgpNormA = (igpA - 46) / 28;

    // Remaining-time dynamic momentum scaling: as match approaches late stages, acute pressure deltas have higher local intensity
    const timeFactor = 1.0 + 0.25 * (t / 90);
    const mH = isScheduled ? 1.0 : this.clamp(0.68, 1.65, 1.0 + (0.30 * Math.tanh(deltaIgpNormH) + 0.08 * Math.min(2, d10SqH / 4.0)) * timeFactor * q10H);
    const mA = isScheduled ? 1.0 : this.clamp(0.68, 1.65, 1.0 + (0.30 * Math.tanh(deltaIgpNormA) + 0.08 * Math.min(2, d10SqA / 4.0)) * timeFactor * q10A);

    // 5-Minute Blitz Burst Multiplier (Captures sudden high-tempo waves before 10m averages react)
    const burstRawH = (0.45 * (effD5H.shotsOnTarget || 0)) + (0.18 * (effD5H.totalShots || 0)) + (0.20 * (effD5H.corners || 0));
    const burstRawA = (0.45 * (effD5A.shotsOnTarget || 0)) + (0.18 * (effD5A.totalShots || 0)) + (0.20 * (effD5A.corners || 0));
    const burst5H = isScheduled ? 1.0 : Number(this.clamp(0.95, 1.28, 1.0 + Math.max(0, burstRawH - 0.35) * 0.20).toFixed(3));
    const burst5A = isScheduled ? 1.0 : Number(this.clamp(0.95, 1.28, 1.0 + Math.max(0, burstRawA - 0.35) * 0.20).toFixed(3));

    // Game-State Decay (Score Protection / Rölanti Multiplier vs Trailing Favorite Surge)
    let gammaStateH = 1.0;
    let gammaStateA = 1.0;
    if (!isScheduled) {
      if (absDiff >= 2 && t >= 55) {
        const leadDecay = 0.35 * Math.exp(-0.038 * Math.max(0, t - 55));
        if (scoreDiff > 0) {
          gammaStateH = leadDecay;
          gammaStateA = (mA >= 1.25 && (d10A.shotsOnTarget || 0) >= 2) ? 1.12 : 0.52;
        } else {
          gammaStateA = leadDecay;
          gammaStateH = (mH >= 1.25 && (d10H.shotsOnTarget || 0) >= 2) ? 1.12 : 0.52;
        }
      } else if (absDiff === 1 && t >= 15 && t < 64) {
        // Favorite trailing by 1 goal gets an urgency boost
        if (scoreDiff === -1 && priorH >= 1.50 && mH >= 1.08) gammaStateH = 1.16;
        if (scoreDiff === 1 && priorA >= 1.45 && mA >= 1.08) gammaStateA = 1.16;
      } else if (absDiff === 1 && t >= 64) {
        if (scoreDiff > 0) {
          gammaStateH = 0.70;
          gammaStateA = mA >= 1.16 ? 1.22 : 0.80;
        } else {
          gammaStateA = 0.70;
          gammaStateH = mH >= 1.16 ? 1.22 : 0.80;
        }
      } else if (scoreDiff === 0 && t >= 65) {
        gammaStateH = flow.archetype === 'END_TO_END_SHOOTOUT' ? 1.12 : 0.88;
        gammaStateA = flow.archetype === 'END_TO_END_SHOOTOUT' ? 1.12 : 0.88;
      }
    }

    const hReds = Math.max(match.home.redCards || 0, hS.redCards || 0);
    const aReds = Math.max(match.away.redCards || 0, aS.redCards || 0);
    let rhoH = 1.0;
    let rhoA = 1.0;
    if (aReds > hReds) {
      rhoH = 1.32;
      rhoA = 0.55;
    } else if (hReds > aReds) {
      rhoH = 0.55;
      rhoA = 1.32;
    }

    const remRatioFull = isScheduled ? 1.0 : (isHt ? 0.511 : Math.max(0.015, (this.T_FULL - t) / this.T_FULL));
    const omega = (t >= 75) ? 0.75 : (t >= 60 ? 1.05 : 1.0);

    const pMultH = playerAnalysis?.matchupMultHome || 1.0;
    const pMultA = playerAnalysis?.matchupMultAway || 1.0;
    const tMultH = flow?.pace?.tempoMultHome || 1.0;
    const tMultA = flow?.pace?.tempoMultAway || 1.0;

    // xG Debt (Gol Borcu) Regression Boost (delta_lambda_xg_debt):
    // Substantially strengthened for teams that earned high xG through inside-box/sot/big chances without scoring
    const xgDebtH = Number(Math.max(0, xgH - gH).toFixed(2));
    const xgDebtA = Number(Math.max(0, xgA - gA).toFixed(2));
    let debtBoostH = 0;
    let debtBoostA = 0;

    if (!isScheduled && t >= 16 && t < 74) {
      if (xgDebtH >= 0.48 && (mH >= 1.02 || igpH >= 48 || (d10H.shotsOnTarget || 0) >= 1 || (d10H.corners || 0) >= 2)) {
        debtBoostH = this.clamp(0, 0.48, 0.36 * (xgDebtH - 0.38) * remRatioFull * qPosH * Math.max(0.85, igpH / 50));
      }
      if (xgDebtA >= 0.48 && (mA >= 1.02 || igpA >= 48 || (d10A.shotsOnTarget || 0) >= 1 || (d10A.corners || 0) >= 2)) {
        debtBoostA = this.clamp(0, 0.48, 0.36 * (xgDebtA - 0.38) * remRatioFull * qPosA * Math.max(0.85, igpA / 50));
      }
    }

    const coreLambdaRemH = baseRateH * remRatioFull * omega * mH * burst5H * gammaStateH * rhoH * pMultH * tMultH;
    const coreLambdaRemA = baseRateA * remRatioFull * omega * mA * burst5A * gammaStateA * rhoA * pMultA * tMultA;

    // Time-proportional realism cap: remaining goals scale with remaining time
    // (max ~2.4 goals/90 per team and ~3.4 goals/90 combined, even under heavy pressure)
    const teamCap = 0.08 + 2.4 * remRatioFull;
    const totalCap = 0.12 + 3.4 * remRatioFull;
    let capH = this.clamp(0.02, teamCap, coreLambdaRemH + debtBoostH);
    let capA = this.clamp(0.02, teamCap, coreLambdaRemA + debtBoostA);
    if (capH + capA > totalCap) {
      const k = totalCap / (capH + capA);
      capH *= k;
      capA *= k;
    }
    const lambdaRemH = Number(capH.toFixed(3));
    const lambdaRemA = Number(capA.toFixed(3));

    const priorRemH = Number(Math.max(0.02, priorH * remRatioFull).toFixed(3));
    const priorRemA = Number(Math.max(0.02, priorA * remRatioFull).toFixed(3));

    const isFirstHalfActive = (match.status === 'LIVE' && t >= 1 && t <= 36);
    const remRatioHt = isScheduled ? 0.46 : (isFirstHalfActive ? Math.max(0.03, (this.T_HT - t) / 90) : 0);
    const lambdaHtH = Number((lambdaRemH * (remRatioHt / Math.max(0.05, remRatioFull))).toFixed(3));
    const lambdaHtA = Number((lambdaRemA * (remRatioHt / Math.max(0.05, remRatioFull))).toFixed(3));
    const priorHtH = Number((priorH * remRatioHt).toFixed(3));
    const priorHtA = Number((priorA * remRatioHt).toFixed(3));

    return {
      priorH,
      priorA,
      lambdaRemH,
      lambdaRemA,
      priorRemH,
      priorRemA,
      lambdaHtH,
      lambdaHtA,
      priorHtH,
      priorHtA,
      momentumH: Number(mH.toFixed(2)),
      momentumA: Number(mA.toFixed(2)),
      qPosH,
      qPosA,
      xgDebtH,
      xgDebtA,
      debtBoostH: Number(debtBoostH.toFixed(3)),
      debtBoostA: Number(debtBoostA.toFixed(3)),
      burst5H,
      burst5A,
      isFirstHalfActive
    };
  }

  /**
   * V5 Bivariate Poisson with Dixon-Coles Low-Score Correlation Adjustment (rho = -0.10)
   * Corrects independent Poisson bias on low-scoring transitions (0-0, 1-0, 0-1, 1-1)
   */
  dixonColesTau(x, y, lambdaH, lambdaA, rho = -0.10) {
    if (x === 0 && y === 0) {
      return Math.max(0.25, 1 - lambdaH * lambdaA * rho);
    }
    if (x === 0 && y === 1) {
      return Math.max(0.25, 1 + lambdaH * rho);
    }
    if (x === 1 && y === 0) {
      return Math.max(0.25, 1 + lambdaA * rho);
    }
    if (x === 1 && y === 1) {
      return Math.max(0.25, 1 - rho);
    }
    return 1.0;
  }

  buildProbabilityMatrix(lambdaH, lambdaA, maxGoals = 7, rho = -0.10) {
    const matrix = [];
    let totalProb = 0;
    for (let x = 0; x <= maxGoals; x++) {
      matrix[x] = [];
      const px = this.poissonPmf(x, lambdaH);
      for (let y = 0; y <= maxGoals; y++) {
        const py = this.poissonPmf(y, lambdaA);
        const tau = this.dixonColesTau(x, y, lambdaH, lambdaA, rho);
        const p = Math.max(0, px * py * tau);
        matrix[x][y] = p;
        totalProb += p;
      }
    }
    if (totalProb > 0) {
      for (let x = 0; x <= maxGoals; x++) {
        for (let y = 0; y <= maxGoals; y++) {
          matrix[x][y] /= totalProb;
        }
      }
    }
    return matrix;
  }

  extractProbsFromMatrix(matrix, gH, gA, lambdaH, lambdaA, activeLine, htActiveLine, htMatrix, isFirstHalfActive) {
    let ms1 = 0, msX = 0, ms2 = 0;
    let bttsYes = 0;
    let overProb = 0;

    const maxG = matrix.length - 1;
    for (let x = 0; x <= maxG; x++) {
      for (let y = 0; y <= maxG; y++) {
        const p = matrix[x][y];
        const fH = gH + x;
        const fA = gA + y;
        if (fH > fA) ms1 += p;
        else if (fH === fA) msX += p;
        else ms2 += p;

        if (fH >= 1 && fA >= 1) bttsYes += p;
        if ((fH + fA) > activeLine) overProb += p;
      }
    }

    const sumL = lambdaH + lambdaA;
    const noMoreGoals = matrix[0]?.[0] ?? Math.exp(-sumL);
    const nextGoalHome = sumL > 0.001 ? (lambdaH / sumL) * (1 - noMoreGoals) : 0.02;
    const nextGoalAway = sumL > 0.001 ? (lambdaA / sumL) * (1 - noMoreGoals) : 0.02;

    let htBttsYes = 0;
    let htOverProb = 0;
    if (isFirstHalfActive && htMatrix) {
      const maxHtG = htMatrix.length - 1;
      for (let x = 0; x <= maxHtG; x++) {
        for (let y = 0; y <= maxHtG; y++) {
          const p = htMatrix[x][y];
          const fH = gH + x;
          const fA = gA + y;
          if (fH >= 1 && fA >= 1) htBttsYes += p;
          if ((fH + fA) > htActiveLine) htOverProb += p;
        }
      }
    }

    return {
      ms1, msX, ms2,
      bttsYes, bttsNo: 1 - bttsYes,
      overProb, underProb: 1 - overProb,
      htBttsYes, htBttsNo: 1 - htBttsYes,
      htOverProb, htUnderProb: 1 - htOverProb,
      nextGoalHome, nextGoalAway, noMoreGoals
    };
  }

  /**
   * Detect Odds Steam / Drop Velocity between opening odds and current odds
   */
  getOddsDropInfo(odds = {}, marketKey, selection, edgeVsPrior = 0) {
    let openOdd = null;
    let currOdd = null;

    if (marketKey === 'MS' || marketKey === 'NEXT_GOAL') {
      if (selection.includes('MS 1') || selection.includes('Ev Sahibi')) {
        openOdd = odds.openMs1;
        currOdd = odds.ms1;
      } else if (selection.includes('MS 2') || selection.includes('Deplasman')) {
        openOdd = odds.openMs2;
        currOdd = odds.ms2;
      } else if (selection.includes('MS X')) {
        openOdd = odds.openMsX;
        currOdd = odds.msX;
      }
    }

    let dropPct = 0;
    if (openOdd && currOdd && openOdd > 1.05 && currOdd > 1.05) {
      dropPct = Number((((openOdd - currOdd) / openOdd) * 100).toFixed(1));
    }

    const steamScore = dropPct > 1.5
      ? this.clamp(55, 98, 55 + dropPct * 3.8)
      : this.clamp(35, 88, 50 + edgeVsPrior * 260);

    return {
      oddsDropPct: dropPct,
      steamScore: Math.round(steamScore)
    };
  }

  /**
   * Classify Conviction Score (0-100) into Tier Badges
   */
  classifySignalTier(convictionScore, edgePct) {
    if (convictionScore >= 82 && edgePct >= 6.5 && edgePct <= 28) {
      return {
        signalTier: 'ELITE_A_PLUS',
        tierBadge: 'ELİT SİNYAL (A+)'
      };
    }
    if (convictionScore >= 76 && edgePct >= 4.5) {
      return {
        signalTier: 'STRONG_A',
        tierBadge: 'GÜÇLÜ SİNYAL (A)'
      };
    }
    return {
      signalTier: 'VALUE_B_PLUS',
      tierBadge: 'DEĞER SİNYALİ (B+)'
    };
  }

  /**
   * Full Audit Gatekeeper:
   * Strictly validates match status, minute cutoffs, settled markets, red cards, and score-state rules.
   */
  isMarketAllowedByScoreAndTime(marketKey, selection, match, lambdas, windows) {
    const status = String(match.status || '').toUpperCase();
    const isHt = status === 'HT';
    const isLive = status === 'LIVE';
    const t = isHt ? 45 : (match.minute || 0);
    const gH = match.home.score || 0;
    const gA = match.away.score || 0;
    const gTot = gH + gA;
    const scoreDiff = gH - gA;
    const absDiff = Math.abs(scoreDiff);
    const hS = match.home.stats || {};
    const aS = match.away.stats || {};
    const hReds = Math.max(match.home.redCards || 0, hS.redCards || 0);
    const aReds = Math.max(match.away.redCards || 0, aS.redCards || 0);

    // 1. Strictly LIVE or HT only. During live, between minute 10' and 74' (Hard global lock at 75'+)
    if (!isLive && !isHt) return false;
    if (isLive && (t < 10 || t >= 75)) return false;

    // 2. Blowout / 3+ goal margin -> No live signals
    if (absDiff >= 3) return false;

    // 3. Red Card Disadvantage Guard: Never back a team with more red cards to win or score next
    if (hReds > aReds && (selection.includes('MS 1') || selection.includes('Ev Sahibi'))) return false;
    if (aReds > hReds && (selection.includes('MS 2') || selection.includes('Deplasman'))) return false;

    // 3b. Fresh-goal / fresh-red-card settling window: stats & odds are stale right after a big event
    if (isLive) {
      const recentBigEvent = (match.incidents || []).some(inc =>
        (inc.eventType === 'GOAL' || inc.eventType === 'RED_CARD' || inc.eventType === 'GOAL_DISALLOWED') &&
        inc.minute != null && t - inc.minute >= 0 && t - inc.minute <= 2
      );
      if (recentBigEvent) return false;
    }

    // 3c. ALTIN KURAL (Senior Quant Desk Trader Golden Rule):
    // Canlı bahiste bir "Üst' (Over) sinyalinin tetiklenmesi için gereken gol sayısı (needed = Math.ceil(lineVal - gTot))
    // KESİNLİKLE 1 OLMALIDIR (needed === 1)! 1-1 giden maça 3.5 Üst (needed = 2) gibi 2 gol gerektiren yüksek varyanslı
    // tuzak bahisler KESİNLİKLE ENGELLENMELİDİR (return false;)!
    // needed <= 0 ise çizgi zaten gelmiştir / kapanmıştır.
    if (selection.includes('Üst') && (marketKey === 'OU' || marketKey === 'HT_OU')) {
      const lineVal = parseFloat((selection.match(/(\d+\.5)/) || [])[1] || '0');
      const needed = Math.ceil(lineVal - gTot);
      // Erken dakikalarda (t <= 25) 0-0 giden yüksek tempolu maçta açılan 1.5 Üst hariç, canlıda daima needed === 1 olmalıdır
      const isEarlyZeroZero = (gTot === 0 && lineVal === 1.5 && t <= 25);
      if (!isEarlyZeroZero && needed >= 2) return false;
      if (needed <= 0) return false;
    }

    // Alt marketi güvenlik kilidi: Halihazırda aşılmış çizgiler (lineVal <= gTot) canlıda derhal reddedilir
    if (selection.includes('Alt') && (marketKey === 'OU' || marketKey === 'HT_OU')) {
      const lineVal = parseFloat((selection.match(/(\d+\.5)/) || [])[1] || '0');
      if (lineVal <= gTot) return false;
    }

    // 4. First-Half Markets: strictly 10' <= t <= 35' while LIVE (never at HT)
    if (marketKey === 'HT_OU' || marketKey === 'HT_BTTS') {
      if (isHt || t < 10 || t > 35) return false;
      if (marketKey === 'HT_BTTS') {
        if (gH >= 1 && gA >= 1) return false; // Already settled
        if (selection.includes('KG Var') && t > 26 && gTot === 0) return false;
      }
      if (marketKey === 'HT_OU') {
        if (gTot >= 2) return false; // Cap 1H Over at 1.5
        if (gTot === 1 && t > 28) return false;
        if (selection.includes('Üst')) {
          if ((lambdas.lambdaHtH + lambdas.lambdaHtA) < 0.56) return false;
          let parsedLine = null;
          const matchLine = selection.match(/(\d+\.?\d*)\s*Üst/i) || selection.match(/(\d+\.?\d*)/);
          if (matchLine) parsedLine = parseFloat(matchLine[1]);
          const lineVal = parsedLine ?? 1.5;
          const neededGoals = (Math.floor(lineVal) + 1) - gTot;
          if (neededGoals >= 2) return false;
        }
      }
      return true;
    }

    // 5. Match Winner (MS 1 / MS X / MS 2): strictly 12' <= t <= 68' (or at HT)
    //    AND NEVER recommend MS 1 / MS 2 for a team that is ALREADY leading!
    if (marketKey === 'MS') {
      if (isLive && (t < 12 || t > 68)) return false;

      if (selection.includes('MS 1')) {
        if (scoreDiff > 0) return false; // Already leading -> STRICTLY FORBIDDEN
        if (scoreDiff === 0) return (lambdas.momentumH >= 1.15 || lambdas.xgDebtH >= 0.70) && lambdas.lambdaRemH >= 0.72;
        if (scoreDiff === -1) return (isHt || t <= 48) && lambdas.priorH >= 1.50 && lambdas.xgDebtH >= 0.85;
        return false;
      }

      if (selection.includes('MS 2')) {
        if (scoreDiff < 0) return false; // Already leading -> STRICTLY FORBIDDEN
        if (scoreDiff === 0) return (lambdas.momentumA >= 1.15 || lambdas.xgDebtA >= 0.70) && lambdas.lambdaRemA >= 0.72;
        if (scoreDiff === 1) return (isHt || t <= 48) && lambdas.priorA >= 1.50 && lambdas.xgDebtA >= 0.85;
        return false;
      }

      if (selection.includes('MS X')) {
        if (absDiff >= 2) return false;
        if (scoreDiff === 0) return t >= 60 && lambdas.momentumH <= 0.90 && lambdas.momentumA <= 0.90;
        return false;
      }
    }

    // 6. Over/Under (Alt/Üst) & Next Goal Rules (12' - 71', or at HT)
    if (marketKey === 'OU' || marketKey === 'NEXT_GOAL') {
      if (isLive && (t < 12 || t > 71)) return false;
      if (gTot >= 5) return false; // Goal saturation cap at 4.5+ Over

      const isOverOrNextGoal = selection.includes('Üst') || selection.includes('Sıradaki Gol');
      if (isOverOrNextGoal) {
        if (selection.includes('Üst')) {
          if ((lambdas.lambdaRemH + lambdas.lambdaRemA) < 0.90) return false;

          // SIGNAL SAFETY GATEKEEPER:
          // Skoru ne olursa olsun (özellikle 1-1 iken), kazanması için 2+ gol gereken bir "Üst' sinyali KESİNLİKLE YASAKTIR!
          // (Örn: skor 1-1 iken 3.5 Üst, skor 2-1 iken 4.5 Üst, skor 0-0 iken 2.5 Üst)
          let parsedLine = null;
          const matchLine = selection.match(/(\d+\.?\d*)\s*Üst/i) || selection.match(/(\d+\.?\d*)/);
          if (matchLine) parsedLine = parseFloat(matchLine[1]);
          const lineVal = parsedLine ?? 2.5;
          const neededGoals = (Math.floor(lineVal) + 1) - gTot;
          if (neededGoals >= 2) return false;

          // 2-0 / 0-2 score: Over signal locked at t >= 52
          if (absDiff === 2 && t >= 52) return false;
        }
        if (selection.includes('Sıradaki Gol') && (lambdas.lambdaRemH + lambdas.lambdaRemA) < 0.88) return false;

        // General 2-goal lead late restriction
        if (absDiff === 2 && isLive) {
          if (t >= 56) return false;
          const dSot10 = (windows?.delta10?.home?.shotsOnTarget || 0) + (windows?.delta10?.away?.shotsOnTarget || 0);
          if (dSot10 < 3) return false;
        }
      }

      if (selection.includes('Alt')) {
        if (t > 65 || gTot >= 3 || absDiff >= 2) return false;
      }

      // "Gol Olmaz' locked when t > 60
      if (selection.includes('Gol Olmaz')) {
        if (t > 60 || gTot >= 3 || absDiff >= 2) return false;
      }
    }

    // 7. BTTS (KG Var / Yok) Rules (12' - 68', or at HT)
    if (marketKey === 'BTTS') {
      if (isLive && (t < 12 || t > 68)) return false;
      if (gH >= 1 && gA >= 1) return false; // Already happened!

      if (selection === 'KG Var') {
        // 0-0 after minute 44 -> Strictly forbid KG Var (require 0.5 Over instead)
        if (gH === 0 && gA === 0 && t >= 44) return false;
        if (absDiff >= 2 && t >= 55) return false;
        if (lambdas.lambdaRemH < 0.42 || lambdas.lambdaRemA < 0.42) return false;

        // If 1-0 (Home leads), Away team momentum must be at least 1.15 and SOT >= 1
        if (gH === 1 && gA === 0) {
          const awaySot = isHt ? (aS.shotsOnTarget || 0) : (windows?.delta10?.away?.shotsOnTarget || 0);
          if (lambdas.momentumA < 1.15 || awaySot < 1) return false;
        }
        // If 0-1 (Away leads), Home team momentum must be at least 1.15 and SOT >= 1
        if (gH === 0 && gA === 1) {
          const homeSot = isHt ? (hS.shotsOnTarget || 0) : (windows?.delta10?.home?.shotsOnTarget || 0);
          if (lambdas.momentumH < 1.15 || homeSot < 1) return false;
        }
        if (gH > 1 && gA === 0) {
          const awaySot = isHt ? (aS.shotsOnTarget || 0) : (windows?.delta10?.away?.shotsOnTarget || 0);
          if (lambdas.momentumA < 1.15 || awaySot < 1) return false;
        }
        if (gH === 0 && gA > 1) {
          const homeSot = isHt ? (hS.shotsOnTarget || 0) : (windows?.delta10?.home?.shotsOnTarget || 0);
          if (lambdas.momentumH < 1.15 || homeSot < 1) return false;
        }
      }

      if (selection === 'KG Yok') {
        if (t > 64 || gTot >= 2) return false;
      }
    }

    return true;
  }

  /**
   * V5 Selective Signal Hunter with 12 Tactical Archetypes + 3 Quant Micro-Archetype Rescues
   */
  huntSelectiveSignals(match, lambdas, flow, marketBoard, windows) {
    const hS = match.home.stats || {};
    const aS = match.away.stats || {};
    const totShots = (hS.totalShots || 0) + (aS.totalShots || 0);
    const totSot = (hS.shotsOnTarget || 0) + (aS.shotsOnTarget || 0);
    const scoreDiff = (match.home.score || 0) - (match.away.score || 0);
    const absDiff = Math.abs(scoreDiff);
    const minute = match.minute || 0;
    let arch = flow?.archetype || 'MONITORING';
    let effectiveArchetypeLabel = flow?.archetypeLabel || 'Gidişat Sinyali';

    // 1. Strict Status & Minute Gatekeepers
    if (match.status === 'SCHEDULED') {
      return {
        signalStatus: 'PRE_MATCH',
        statusBadge: `Başlama: ${match.kickoffTime || match.statusText || 'Yaklaşan'}`,
        reason: `Maç henüz başlamadı. Başlangıç düdüğüyle birlikte canlı sinyal takibi aktifleşecek.`,
        activeSignals: []
      };
    }

    if (match.status === 'FT') {
      return {
        signalStatus: 'NO_SIGNAL',
        statusBadge: 'Maç Sonu',
        reason: 'Karşılaşma sona erdi.',
        activeSignals: []
      };
    }

    if (match.status === 'LIVE' && minute >= 85) {
      return {
        signalStatus: 'NO_SIGNAL',
        statusBadge: minute >= 90 ? 'Uzatma Dakikaları' : 'Son Dakikalar (85+)',
        reason: `Dakika ${minute}' itibarıyla karşılaşmanın son bölümü oynanıyor. Yeni sinyal alımı kilitli.`,
        activeSignals: []
      };
    }

    if (match.status === 'LIVE' && minute >= 75) {
      return {
        signalStatus: 'NO_SIGNAL',
        statusBadge: 'Son Bölüm (75+ Kilitli)',
        reason: `Dakika ${minute}' itibarıyla kalan efektif oyun süresi azaldığı için yeni canlı bahis sinyali ve market önerileri kilitlendi.`,
        activeSignals: []
      };
    }

    if (absDiff >= 3 || arch === 'GAME_MANAGEMENT') {
      return {
        signalStatus: 'NO_SIGNAL',
        statusBadge: 'Rölanti / Skor Koptu',
        reason: flow.narrative || 'Skor farkı ve rölanti temposu nedeniyle bu maçta canlı bahis önerilmez.',
        activeSignals: []
      };
    }

    if (totShots < 3 && ((hS.corners || 0) + (aS.corners || 0)) < 2 && minute < 18) {
      return {
        signalStatus: 'NO_SIGNAL',
        statusBadge: 'Veri Toplanıyor',
        reason: 'Maçta henüz anlamlı bir şut veya baskı istatistiği oluşmadı. Yanıltıcı sinyal üretmemek için izleniyor.',
        activeSignals: []
      };
    }

    // Data-feed gate: many lower leagues publish NO live statistics. Missing data must never be read as "low tempo'.
    const totCorners = (hS.corners || 0) + (aS.corners || 0);
    const totFoulsAll = (hS.fouls || 0) + (aS.fouls || 0);
    const hasStatsFeed = Boolean(match._statsHydrated) && (totShots + totCorners + totFoulsAll) >= 6;
    if (!hasStatsFeed || arch === 'LIMITED_DATA') {
      return {
        signalStatus: 'NO_SIGNAL',
        statusBadge: 'Sınırlı Veri',
        reason: 'Bu maç için canlı istatistik yayınlanmıyor. Yalnızca skor ve olaylar takip ediliyor; veri olmadan sinyal üretilmez.',
        activeSignals: []
      };
    }

    // Minimum evidence gate: never fire a signal on a statistically thin sample (applies at every minute)
    const sampleSize = totShots + 0.5 * totCorners;
    const minSample = Math.max(7, Math.round(minute * 0.14));
    if (sampleSize < minSample) {
      return {
        signalStatus: 'NO_SIGNAL',
        statusBadge: 'Veri Toplanıyor',
        reason: `Yeterli şut verisi yok (${totShots} şut, ${totCorners} korner). Güvenilir sinyal için veri birikmesi bekleniyor.`,
        activeSignals: []
      };
    }

    // 2. V5 QUANT MICRO-ARCHETYPE RESCUE:
    //    If macro flow archetype is MONITORING, check whether a high-conviction Quant Anomaly
    //    (xG Debt Breakout, 5-Minute Blitz, or Bilateral xG Exchange) warrants signal hunting!
    if (arch === 'MONITORING' && minute >= 16 && minute <= 71) {
      if ((lambdas.xgDebtH >= 0.88 && (flow.igpHome >= 50 || lambdas.momentumH >= 1.14)) ||
          (lambdas.xgDebtA >= 0.88 && (flow.igpAway >= 50 || lambdas.momentumA >= 1.14))) {
        const homeDebt = lambdas.xgDebtH >= lambdas.xgDebtA;
        arch = homeDebt ? 'XG_DEBT_BREAKOUT_HOME' : 'XG_DEBT_BREAKOUT_AWAY';
        effectiveArchetypeLabel = `Gole Dönüşmeyen Üstünlük (${homeDebt ? match.home.name : match.away.name})`;
      } else if (lambdas.burst5H >= 1.18 || lambdas.burst5A >= 1.18) {
        const homeBlitz = lambdas.burst5H >= lambdas.burst5A;
        arch = homeBlitz ? 'FIVE_MIN_BLITZ_HOME' : 'FIVE_MIN_BLITZ_AWAY';
        effectiveArchetypeLabel = `Son 5 Dk Şok Baskı (${homeBlitz ? match.home.name : match.away.name})`;
      } else if ((hS.xg >= 0.65 && aS.xg >= 0.65) && totSot >= 4 && absDiff <= 1) {
        arch = 'BILATERAL_XG_EXCHANGE';
        effectiveArchetypeLabel = 'Karşılıklı Gol Düellosu';
      } else if (match.home.score === 1 && match.away.score === 1 && minute >= 50 && minute <= 72) {
        const boxTot = (hS.shotsInsideBox || Math.round(0.62 * (hS.shotsOnTarget || 0))) +
                       (aS.shotsInsideBox || Math.round(0.62 * (aS.shotsOnTarget || 0)));
        const d10TotShots = (windows?.delta10?.home?.totalShots || 0) + (windows?.delta10?.away?.totalShots || 0);
        if (boxTot >= 4 || d10TotShots >= 3 || totSot >= 4 || ((flow?.igpHome || 0) >= 45 || (flow?.igpAway || 0) >= 45)) {
          arch = 'SECOND_HALF_DRAW_BREAKOUT';
          effectiveArchetypeLabel = '1-1 Kilit Kırılması (Tek Gol / 2.5 Üst Hedefi)';
        }
      }
    }

    // 3. Match Flow / Quant Archetype -> Allowed Target Markets & Direction
    let allowedMarketKeys = [];
    let preferredDirection = null;

    if (
      arch === 'SIEGE_HOME' ||
      arch === 'HALFTIME_SIEGE_DOMINANCE_HOME' ||
      arch === 'RED_CARD_POWERPLAY_HOME' ||
      arch === 'SECOND_HALF_AWAKENING_HOME' ||
      arch === 'SECOND_HALF_DRAW_BREAKOUT_HOME' ||
      arch === 'HALFTIME_DRAW_BREAKOUT_HOME' ||
      arch === 'HIGH_XG_UNDERPERFORMANCE_HOME' ||
      arch === 'XG_DEBT_BREAKOUT_HOME' ||
      arch === 'FIVE_MIN_BLITZ_HOME'
    ) {
      allowedMarketKeys = scoreDiff === 0 ? ['NEXT_GOAL', 'MS', 'OU', 'HT_OU'] : ['NEXT_GOAL', 'OU', 'HT_OU'];
      preferredDirection = 'HOME_ATTACK';
    } else if (
      arch === 'SIEGE_AWAY' ||
      arch === 'HALFTIME_SIEGE_DOMINANCE_AWAY' ||
      arch === 'RED_CARD_POWERPLAY_AWAY' ||
      arch === 'SECOND_HALF_AWAKENING_AWAY' ||
      arch === 'SECOND_HALF_DRAW_BREAKOUT_AWAY' ||
      arch === 'HALFTIME_DRAW_BREAKOUT_AWAY' ||
      arch === 'HIGH_XG_UNDERPERFORMANCE_AWAY' ||
      arch === 'XG_DEBT_BREAKOUT_AWAY' ||
      arch === 'FIVE_MIN_BLITZ_AWAY'
    ) {
      allowedMarketKeys = scoreDiff === 0 ? ['NEXT_GOAL', 'MS', 'OU', 'HT_OU'] : ['NEXT_GOAL', 'OU', 'HT_OU'];
      preferredDirection = 'AWAY_ATTACK';
    } else if (arch === 'BOUNCE_BACK_HOME' || arch === 'FAVORITE_TRAILING_SURGE_HOME' || arch === 'HALFTIME_FAVORITE_CHASE_HOME') {
      allowedMarketKeys = ['NEXT_GOAL', 'BTTS', 'OU', 'MS', 'HT_BTTS'];
      preferredDirection = 'HOME_ATTACK_OR_BTTS';
    } else if (arch === 'BOUNCE_BACK_AWAY' || arch === 'FAVORITE_TRAILING_SURGE_AWAY' || arch === 'HALFTIME_FAVORITE_CHASE_AWAY') {
      allowedMarketKeys = ['NEXT_GOAL', 'BTTS', 'OU', 'MS', 'HT_BTTS'];
      preferredDirection = 'AWAY_ATTACK_OR_BTTS';
    } else if (arch === 'LATE_FIRST_HALF_BLITZ') {
      allowedMarketKeys = ['HT_OU', 'NEXT_GOAL', 'HT_BTTS', 'OU'];
      preferredDirection = 'OVER_AND_NEXT_GOAL';
    } else if (arch === 'SECOND_HALF_DRAW_BREAKOUT') {
      allowedMarketKeys = ['OU', 'NEXT_GOAL', 'MS'];
      preferredDirection = 'OVER_AND_NEXT_GOAL';
    } else if (arch === 'END_TO_END_SHOOTOUT' || arch === 'BILATERAL_XG_EXCHANGE' || arch === 'HALFTIME_SHOOTOUT') {
      allowedMarketKeys = ['BTTS', 'OU', 'HT_OU', 'HT_BTTS', 'NEXT_GOAL'];
      preferredDirection = 'BOTH_ATTACK';
    } else if (arch === 'TACTICAL_DEADLOCK' || arch === 'HALFTIME_DEADLOCK' || arch === 'TACTICAL_STALEMATE_DRAW' || arch === 'HALFTIME_DRAW_DEADLOCK') {
      allowedMarketKeys = ['OU', 'HT_OU', 'BTTS', 'MS', 'NEXT_GOAL'];
      preferredDirection = 'UNDER_LOCK';
    } else {
      if (Math.max(flow.igpHome, flow.igpAway) >= 50 || totShots >= 6 || match.status === 'HT') {
        return {
          signalStatus: 'WATCHLIST',
        statusBadge: match.status === 'HT' ? 'Devre Arası Radarı' : 'Radarda (Eşik Bekleniyor)',
          reason: flow.narrative || `${flow.igpHome >= flow.igpAway ? match.home.name : match.away.name} baskıyı artırıyor (${totShots} şut, ${totSot} isabet). Net sinyal için pozisyon kalitesi ve oran onayı bekleniyor.`,
          activeSignals: []
        };
      }
      return {
        signalStatus: 'NO_SIGNAL',
        statusBadge: 'Sinyal Yok (İzleniyor)',
        reason: 'Oyun dengeli ve standart tempoda ilerliyor. Yüksek değerli bir canlı fırsat henüz oluşmadı.',
        activeSignals: []
      };
    }

    // 4. Filter candidate signals that align with Archetype AND pass Score/Time Gatekeepers
    const candidates = [];
    for (const key of allowedMarketKeys) {
      const group = marketBoard[key];
      if (!group || !Array.isArray(group.options)) continue;

      for (const opt of group.options) {
        if (!this.isMarketAllowedByScoreAndTime(key, opt.selection, match, lambdas, windows)) {
          continue;
        }

        const sel = opt.selection;
        let matchesDir = false;

        if (preferredDirection === 'HOME_ATTACK') {
          matchesDir = sel.includes('Ev Sahibi') || sel.includes('MS 1') || sel.includes('Üst');
        } else if (preferredDirection === 'AWAY_ATTACK') {
          matchesDir = sel.includes('Deplasman') || sel.includes('MS 2') || sel.includes('Üst');
        } else if (preferredDirection === 'HOME_ATTACK_OR_BTTS') {
          matchesDir = sel.includes('Ev Sahibi') || sel.includes('MS 1') || sel.includes('KG Var') || sel.includes('Üst');
        } else if (preferredDirection === 'AWAY_ATTACK_OR_BTTS') {
          matchesDir = sel.includes('Deplasman') || sel.includes('MS 2') || sel.includes('KG Var') || sel.includes('Üst');
        } else if (preferredDirection === 'OVER_AND_NEXT_GOAL') {
          matchesDir = sel.includes('Üst') || sel.includes('Sıradaki Gol') || sel.includes('KG Var');
        } else if (preferredDirection === 'BOTH_ATTACK') {
          matchesDir = sel.includes('KG Var') || sel.includes('Üst') || sel.includes('Sıradaki Gol');
        } else if (preferredDirection === 'UNDER_LOCK') {
          matchesDir = sel.includes('Alt') || sel.includes('KG Yok') || sel.includes('Gol Olmaz');
        }

        // Under / defensive picks need POSITIVE evidence of a dead game, not just an absence of data
        const isUnderPick = sel.includes('Alt') || sel.includes('KG Yok') || sel.includes('Gol Olmaz');
        let underEvidenceOk = true;
        if (isUnderPick) {
          const d10 = windows?.delta10 || {};
          const sot10 = (d10.home?.shotsOnTarget || 0) + (d10.away?.shotsOnTarget || 0);
          const sotRate = totSot / Math.max(20, minute);
          const paceCode = flow?.pace?.code;
          underEvidenceOk =
            minute >= 25 &&
            totShots >= Math.round(minute * 0.12) &&              // feed is really reporting shots
            sotRate <= 0.075 &&                                   // < ~7 on-target per 90 combined
            sot10 <= 1 &&
            Math.max(flow.igpHome || 0, flow.igpAway || 0) <= 42 &&
            paceCode !== 'HIGH_FLOW' && paceCode !== 'SET_PIECE_CHAOS' &&
            opt.modelProbPct >= 62 &&
            opt.confidence >= 74 + (this.adaptiveBonus || 0);
        }

        // Alt signals strictly require modelProbPct >= 62 and confidence >= 74
        if (sel.includes('Alt') && (opt.modelProbPct < 62 || opt.confidence < 74)) {
          continue;
        }

        if (
          matchesDir &&
          underEvidenceOk &&
          opt.confidence >= Math.max(74, 74 + (this.adaptiveBonus || 0)) &&
          opt.modelProbPct >= 48 &&
          opt.edgePct >= 4.2 &&
          opt.edgePct <= 28.0 &&
          opt.marketOdds >= 1.35 &&
          opt.marketOdds <= 4.20
        ) {
          candidates.push({
            ...opt,
            archetypeLabel: effectiveArchetypeLabel,
            sniperScore: opt.convictionScore + (opt.edgePct * 1.85)
          });
        }
      }
    }

    candidates.sort((a, b) => b.sniperScore - a.sniperScore);

    if (candidates.length === 0) {
      return {
        signalStatus: match.status === 'HT' ? 'WATCHLIST' : 'WATCHLIST',
        statusBadge: match.status === 'HT' ? 'Devre Arası Radarı' : 'Radarda (Eşik Bekleniyor)',
        reason: match.status === 'HT'
          ? (flow.narrative || 'İlk yarı verileri işlendi. 2. yarı başında oluşacak tempo kırılması bekleniyor.')
          : `Saha içi gidişat (${effectiveArchetypeLabel}) izleniyor ancak dakika/skor filtresi ve 5 sütunlu ikna skoru henüz sinyal eşiğine ulaşmadı.`,
        activeSignals: []
      };
    }

    const selected = [candidates[0]];
    for (let i = 1; i < candidates.length; i++) {
      if (candidates[i].marketKey !== selected[0].marketKey && candidates[i].confidence >= 74) {
        selected.push(candidates[i]);
        break;
      }
    }

    const topTierBadge = selected[0].tierBadge || 'DEĞER SİNYALİ (B+)';
    const htSuffix = match.status === 'HT' ? ' • 2. Yarı Hedefi' : '';

    return {
      signalStatus: 'SIGNAL_TRIGGERED',
      statusBadge: `${topTierBadge} • ${selected.length} Sinyal${htSuffix}`,
      reason: flow.narrative || selected[0].reasoning,
      activeSignals: selected
    };
  }

  analyzeMarkets(match, windows, flow, playerAnalysis) {
    const lambdas = this.calculateLambdas(match, windows, flow, playerAnalysis);
    const gH = match.home.score || 0;
    const gA = match.away.score || 0;
    const gTot = gH + gA;
    const minute = match.minute || 0;
    const isScheduled = match.status === 'SCHEDULED';
    const hStats = match.home?.stats || {};
    const aStats = match.away?.stats || {};

    const odds = match.odds || {};
    // Canlıda her skor için bir sonraki kazanılacak çizgi activeLine = gTot + 0.5 olmalıdır:
    // 0 gol: dakika 50'den sonra 0.5, erken dakikalarda 1.5
    // 1 gol (1-0, 0-1): 1.5 (1 gol lazım)
    // 2 gol (1-1, 2-0, 0-2): KESİNLİKLE 2.5 (1 gol lazım! Asla 3.5 değil!)
    // 3 gol (2-1, 1-2, 3-0): 3.5 (1 gol lazım)
    // 4 gol (2-2, 3-1): 4.5 (1 gol lazım)
    const rawActiveLine = (match.status === 'LIVE' || match.status === 'HT')
      ? (gTot === 0 ? (minute >= 50 ? 0.5 : 1.5) : (gTot + 0.5))
      : 2.5;
    const activeLine = Math.max(0.5, rawActiveLine);
    const htActiveLine = Math.min(1.5, gTot + 0.5);

    // V5 Bivariate Poisson with Dixon-Coles Low-Score Correlation (rho = -0.10)
    const matModel = this.buildProbabilityMatrix(lambdas.lambdaRemH, lambdas.lambdaRemA, 7, -0.10);
    const matPrior = this.buildProbabilityMatrix(lambdas.priorRemH, lambdas.priorRemA, 7, -0.10);
    const matHtModel = (lambdas.isFirstHalfActive || isScheduled)
      ? this.buildProbabilityMatrix(lambdas.lambdaHtH, lambdas.lambdaHtA, 5, -0.08)
      : null;
    const matHtPrior = (lambdas.isFirstHalfActive || isScheduled)
      ? this.buildProbabilityMatrix(lambdas.priorHtH, lambdas.priorHtA, 5, -0.08)
      : null;

    const modelProbs = this.extractProbsFromMatrix(
      matModel, gH, gA, lambdas.lambdaRemH, lambdas.lambdaRemA, activeLine, htActiveLine, matHtModel, lambdas.isFirstHalfActive || isScheduled
    );
    const priorProbs = this.extractProbsFromMatrix(
      matPrior, gH, gA, lambdas.priorRemH, lambdas.priorRemA, activeLine, htActiveLine, matHtPrior, lambdas.isFirstHalfActive || isScheduled
    );

    const canUsePreMatchOdds = isScheduled || (gTot === 0 && minute <= 12);

    const evaluateOption = ({
      marketKey,
      marketTitle,
      selection,
      line = null,
      pModel,
      pPrior,
      marketOdds,
      allMarketOdds,
      relMomentum,
      relIgp,
      relQuality = 1.0,
      relXgDebt = 0,
      reasonBuilder,
      isFirstHalfOnly = false
    }) => {
      const pPri = this.clamp(0.02, 0.98, pPrior);
      // Calibration: live models are calibrated against prior; at HT/live with rich match stats, weight live model 85%
      const liveWeight = (match.status === 'HT' || minute >= 40) ? 0.85 : 0.75;
      const pMod = this.clamp(0.02, 0.98, pPri + (this.clamp(0.02, 0.98, pModel) - pPri) * liveWeight);
      const fairOdds = Number((1 / pMod).toFixed(2));

      let pMarket = pPri;
      let hasRealOdds = false;
      if (canUsePreMatchOdds && marketOdds && marketOdds > 1.01 && Array.isArray(allMarketOdds) && allMarketOdds.every(o => o && o > 1.01)) {
        const overround = allMarketOdds.reduce((acc, o) => acc + (1 / o), 0);
        pMarket = (1 / marketOdds) / overround;
        hasRealOdds = true;
      }

      // Dynamic In-Play Live Market Pricing with Realistic Bookmaker Margin:
      // Heavy favorites have ~2.5% vig; balanced lines have ~5.5% vig; longshots have ~7-10% vig
      let vigFactor = 1.055;
      if (pMod >= 0.75) {
        vigFactor = 1.025 + 0.03 * (1 - pMod);
      } else if (pMod <= 0.08) {
        vigFactor = 1.07 + 0.05 * (0.08 - pMod);
      }

      const calculatedLiveOdds = Number((1 / (vigFactor * pMod)).toFixed(2));

      const displayMarketOdds = hasRealOdds
        ? Number(marketOdds.toFixed(2))
        : Number(this.clamp(1.02, 65.00, calculatedLiveOdds).toFixed(2));

      const edgeVsMarket = pMod - pMarket;
      const edgeVsPrior = pMod - pPri;
      const hybridEdge = hasRealOdds ? (0.65 * edgeVsMarket + 0.35 * edgeVsPrior) : edgeVsPrior;
      const edgePct = Number((hybridEdge * 100).toFixed(1));

      // V5 5-Pillar Conviction Score (0-100):
      // 1. Value Edge & Model Probability Floor (28%)
      const sEdge = this.clamp(0, 100, (Math.max(0, hybridEdge) / 0.105) * 65 + ((pMod - 0.36) / 0.44) * 35);
      // 2. 5m/10m/2H Momentum & Immediate Goal Pressure IGP (22%)
      const sMomentum = this.clamp(0, 100, ((relMomentum - 0.76) / 0.62) * 55 + (relIgp / 82) * 45);
      // 3. Position Quality (Q_pos) & xG Debt Regression (20%)
      const sQualityDebt = this.clamp(0, 100, ((relQuality - 0.78) / 0.45) * 55 + Math.min(45, relXgDebt * 38));
      // 4. Tactical Archetype & Pace Synergy (18%)
      const archActive = flow?.archetype && !['MONITORING', 'PRE_MATCH', 'MATCH_COMPLETED', 'HALFTIME_ANALYSIS', 'LATE_GAME_LOCK', 'GAME_MANAGEMENT'].includes(flow.archetype);
      const sTactical = this.clamp(0, 100, (archActive ? 78 : 52) + (flow?.imminentGoalAlert ? 16 : 0));
      // 5. Odds Steam / Movement (12%)
      const { oddsDropPct, steamScore } = this.getOddsDropInfo(odds, marketKey, selection, edgeVsPrior);

      // 1-1 High Conviction Desk Adjustment:
      // Dakika 55-72 arasında skor 1-1 iken tek gol gerektiren 2.5 Üst ve Sıradaki Gol marketlerinde
      // ceza sahası şutları ve hücum baskısı patlamışsa ikna skoruna ek trader desteği verilir (%75+)
      let deskConvictionBonus = 0;
      if (gH === 1 && gA === 1 && minute >= 55 && minute <= 72 && (marketKey === 'OU' || marketKey === 'NEXT_GOAL')) {
        if (selection.includes('Üst') || selection.includes('Sıradaki Gol')) {
          const boxTot = (hStats.shotsInsideBox || 0) + (aStats.shotsInsideBox || 0);
          const d10Tot = (windows?.delta10?.home?.totalShots || 0) + (windows?.delta10?.away?.totalShots || 0);
          if (boxTot >= 4 || d10Tot >= 3 || (flow?.igpHome || 0) >= 45 || (flow?.igpAway || 0) >= 45 || relQuality >= 1.15) {
            deskConvictionBonus = 6;
          }
        }
      }

      const allowed = this.isMarketAllowedByScoreAndTime(marketKey, selection, match, lambdas, windows);
      const rawConviction = isScheduled
        ? Math.round(pMod * 100)
        : Math.round(
            0.28 * sEdge +
            0.22 * sMomentum +
            0.20 * sQualityDebt +
            0.18 * sTactical +
            0.12 * steamScore +
            deskConvictionBonus
          );

      const convictionScore = allowed ? this.clamp(0, 99, rawConviction) : (isScheduled ? rawConviction : 0);
      const confidence = convictionScore;
      const { signalTier, tierBadge } = this.classifySignalTier(convictionScore, edgePct);

      const urgency = (allowed && convictionScore >= 82 && hybridEdge >= 0.06)
        ? 'CRITICAL'
        : (allowed && convictionScore >= 70 ? 'HIGH' : 'MEDIUM');

      return {
        marketKey,
        marketTitle,
        selection,
        line,
        modelProbPct: Number((pMod * 100).toFixed(1)),
        marketProbPct: Number((pMarket * 100).toFixed(1)),
        edgePct,
        fairOdds,
        marketOdds: displayMarketOdds,
        hasRealOdds,
        oddsDropPct,
        confidence,
        convictionScore,
        signalTier,
        tierBadge,
        allowedByState: allowed,
        urgency,
        isActiveWindow: isFirstHalfOnly ? lambdas.isFirstHalfActive : (match.status === 'LIVE' && minute < 75),
        reasoning: reasonBuilder()
      };
    };

    const isHt = match.status === 'HT';
    let d10H = windows?.delta10?.home || {};
    let d10A = windows?.delta10?.away || {};
    let d5H = windows?.delta5?.home || {};
    let d5A = windows?.delta5?.away || {};

    if (isHt && ((d10H.totalShots || 0) + (d10A.totalShots || 0) + (d10H.corners || 0) + (d10A.corners || 0) === 0)) {
      const scale10 = 10 / 45;
      const scale5 = 5 / 45;
      const scaleStats = (s, f) => ({
        totalShots: Math.round((s?.totalShots || 0) * f),
        shotsOnTarget: Math.round((s?.shotsOnTarget || 0) * f),
        shotsOffTarget: Math.round((s?.shotsOffTarget || 0) * f),
        blockedShots: Math.round((s?.blockedShots || 0) * f),
        shotsInsideBox: Math.round((s?.shotsInsideBox || 0) * f),
        bigChances: Math.round((s?.bigChances || 0) * f),
        woodwork: Math.round((s?.woodwork || 0) * f),
        corners: Math.round((s?.corners || 0) * f),
        saves: Math.round((s?.saves || 0) * f),
        dangerousAttacks: Math.round((s?.dangerousAttacks || 0) * f),
        xg: Number(((s?.xg || 0) * f).toFixed(2))
      });
      d10H = scaleStats(hStats, scale10);
      d10A = scaleStats(aStats, scale10);
      d5H = scaleStats(hStats, scale5);
      d5A = scaleStats(aStats, scale5);
    }

    const totShots = (hStats.totalShots || 0) + (aStats.totalShots || 0);
    const totSot = (hStats.shotsOnTarget || 0) + (aStats.shotsOnTarget || 0);
    const totCorners = (hStats.corners || 0) + (aStats.corners || 0);
    const totFouls = (hStats.fouls || 0) + (aStats.fouls || 0);

    const d10ShotsH = d10H.totalShots || 0;
    const d10SotH = d10H.shotsOnTarget || 0;
    const d10CorH = d10H.corners || 0;
    const d10ShotsA = d10A.totalShots || 0;
    const d10SotA = d10A.shotsOnTarget || 0;
    const d10CorA = d10A.corners || 0;
    const d10ShotsTot = d10ShotsH + d10ShotsA;
    const d10CorTot = d10CorH + d10CorA;

    const boxH = hStats.shotsInsideBox || Math.round(0.62 * (hStats.shotsOnTarget || 0) + 0.35 * (hStats.corners || 0));
    const boxA = aStats.shotsInsideBox || Math.round(0.62 * (aStats.shotsOnTarget || 0) + 0.35 * (aStats.corners || 0));

    const totLambdaRem = lambdas.lambdaRemH + lambdas.lambdaRemA;
    const maxXgDebt = Math.max(lambdas.xgDebtH, lambdas.xgDebtA);
    const maxQPos = Math.max(lambdas.qPosH, lambdas.qPosA);

    const msOptions = [
      evaluateOption({
        marketKey: 'MS', marketTitle: 'MS (Maç Sonucu)', selection: 'MS 1 (Ev Sahibi)',
        pModel: modelProbs.ms1, pPrior: priorProbs.ms1,
        marketOdds: odds.ms1, allMarketOdds: [odds.ms1, odds.msX, odds.ms2],
        relMomentum: lambdas.momentumH * lambdas.burst5H, relIgp: flow.igpHome,
        relQuality: lambdas.qPosH, relXgDebt: lambdas.xgDebtH,
        reasonBuilder: () => {
          const isHt = match.status === 'HT';
          const pfx = isHt ? 'İlk yarıda ceza sahası içinden' : 'Son 10 dakikada';
          const shotInfo = isHt ? `${boxH} şut bularak ${(hStats.xg || 0).toFixed(2)} xG üretti (${hStats.shotsOnTarget || 0} isabet)` : `${d10ShotsH} şut ve ${d10CorH} korner üretti (Ceza sahası: ${boxH})`;
          return `Ceza Sahası Kuşatması: ${match.home.name} ${pfx} ${shotInfo}. Deplasman savunması geriye yaslandı; galibiyet üstünlüğü kaçınılmaz (Hedef: MS 1 / %${Math.round(modelProbs.ms1 * 100)} Güven).`;
        }
      }),
      evaluateOption({
        marketKey: 'MS', marketTitle: 'MS (Maç Sonucu)', selection: 'MS X (Beraberlik)',
        pModel: modelProbs.msX, pPrior: priorProbs.msX,
        marketOdds: odds.msX, allMarketOdds: [odds.ms1, odds.msX, odds.ms2],
        relMomentum: 1.05 - Math.abs(lambdas.momentumH - lambdas.momentumA), relIgp: 100 - Math.abs(flow.igpHome - flow.igpAway),
        relQuality: 1.0, relXgDebt: 0.2,
        reasonBuilder: () => `Taktiksel Kilit & Beraberlik: Takımların oyun üretimi dengede seyrediyor (Ev ${hStats.totalShots || 0} şut - Dep ${aStats.totalShots || 0} şut); beraberlik olasılığı %${Math.round(modelProbs.msX * 100)} seviyesinde.`
      }),
      evaluateOption({
        marketKey: 'MS', marketTitle: 'MS (Maç Sonucu)', selection: 'MS 2 (Deplasman)',
        pModel: modelProbs.ms2, pPrior: priorProbs.ms2,
        marketOdds: odds.ms2, allMarketOdds: [odds.ms1, odds.msX, odds.ms2],
        relMomentum: lambdas.momentumA * lambdas.burst5A, relIgp: flow.igpAway,
        relQuality: lambdas.qPosA, relXgDebt: lambdas.xgDebtA,
        reasonBuilder: () => {
          const isHt = match.status === 'HT';
          const pfx = isHt ? 'İlk yarıda ceza sahası içinden' : 'Son 10 dakikada';
          const shotInfo = isHt ? `${boxA} şut bularak ${(aStats.xg || 0).toFixed(2)} xG üretti (${aStats.shotsOnTarget || 0} isabet)` : `${d10ShotsA} şut ve ${d10CorA} korner üretti (Ceza sahası: ${boxA})`;
          return `Deplasman Kuşatması: ${match.away.name} ${pfx} ${shotInfo}; deplasman galibiyet olasılığı %${Math.round(modelProbs.ms2 * 100)}.`;
        }
      })
    ];

    const bttsOptions = [
      evaluateOption({
        marketKey: 'BTTS', marketTitle: 'KG Var / Yok', selection: 'KG Var',
        pModel: modelProbs.bttsYes, pPrior: priorProbs.bttsYes,
        marketOdds: odds.bttsYes, allMarketOdds: [odds.bttsYes, odds.bttsNo],
        relMomentum: ((lambdas.momentumH + lambdas.momentumA) / 2) * Math.max(lambdas.burst5H, lambdas.burst5A),
        relIgp: Math.max(flow.igpHome, flow.igpAway),
        relQuality: (lambdas.qPosH + lambdas.qPosA) / 2, relXgDebt: (lambdas.xgDebtH + lambdas.xgDebtA) / 1.5,
        reasonBuilder: () => `Karşılıklı Hücum Tehdidi: İki takım da ceza sahasında pozisyon üretiyor (Ev ${boxH} şut/${hStats.shotsOnTarget || 0} isabet, Dep ${boxA} şut/${aStats.shotsOnTarget || 0} isabet); KG Var ihtimali %${Math.round(modelProbs.bttsYes * 100)}.`
      }),
      evaluateOption({
        marketKey: 'BTTS', marketTitle: 'KG Var / Yok', selection: 'KG Yok',
        pModel: modelProbs.bttsNo, pPrior: priorProbs.bttsNo,
        marketOdds: odds.bttsNo, allMarketOdds: [odds.bttsYes, odds.bttsNo],
        relMomentum: 2.0 - Math.min(lambdas.momentumH, lambdas.momentumA), relIgp: 100 - Math.min(flow.igpHome, flow.igpAway),
        relQuality: 1.05, relXgDebt: 0.1,
        reasonBuilder: () => `Tek Taraflı Savunma Kilidi: Hücumdaki ceza sahası uzaklığı nedeniyle takımların karşılıklı gol bulması zor görünüyor (%${Math.round(modelProbs.bttsNo * 100)} Model Olasılığı).`
      })
    ];

    const ftLineOdds = odds.ouLines?.[String(activeLine)] || {};
    const ouOptions = [
      evaluateOption({
        marketKey: 'OU', marketTitle: `Alt / Üst (${activeLine})`, selection: `${activeLine} Üst`, line: activeLine,
        pModel: modelProbs.overProb, pPrior: priorProbs.overProb,
        marketOdds: ftLineOdds.over, allMarketOdds: [ftLineOdds.over, ftLineOdds.under],
        relMomentum: Math.max(lambdas.momentumH * lambdas.burst5H, lambdas.momentumA * lambdas.burst5A),
        relIgp: Math.max(flow.igpHome, flow.igpAway),
        relQuality: maxQPos, relXgDebt: maxXgDebt,
        reasonBuilder: () => {
          const isHt = match.status === 'HT';
          const timeCtx = isHt ? 'İlk yarıda' : 'Karşılaşmada';
          const totXgVal = ((hStats.xg || 0) + (aStats.xg || 0)).toFixed(2);
          if (gH === 1 && gA === 1 && minute >= 50) {
            return `1-1 Kilit Kırılması & Tek Gol Hedefi: Dakika ${minute}' itibarıyla iki takım da ceza sahasına yükleniyor (${boxH + boxA} ceza sahası şutu, ${totCorners} korner, ${totXgVal} xG). Kazanması için sadece TEK BİR GOL gereken ${activeLine} Üst canlıda en yüksek beklenen değerli (EV) fırsattır (Hedef: ${activeLine} Üst / %${Math.round(modelProbs.overProb * 100)} Model Olasılığı).`;
          }
          return `Gol Doygunluğu & Hücum Kuşatması: ${timeCtx} toplam ${totShots} şut (${totSot} isabet, ${boxH + boxA} ceza sahası içi) ve ${totCorners} korner ile ${totXgVal} xG birikti. Savunma dirençleri kırılma noktasında; ${activeLine} Üst beklentisi kaçınılmaz (Hedef: ${activeLine} Üst / %${Math.round(modelProbs.overProb * 100)} Güven).`;
        }
      }),
      evaluateOption({
        marketKey: 'OU', marketTitle: `Alt / Üst (${activeLine})`, selection: `${activeLine} Alt`, line: activeLine,
        pModel: modelProbs.underProb, pPrior: priorProbs.underProb,
        marketOdds: ftLineOdds.under, allMarketOdds: [ftLineOdds.over, ftLineOdds.under],
        relMomentum: 2.0 - ((lambdas.momentumH + lambdas.momentumA) / 2), relIgp: 100 - Math.max(flow.igpHome, flow.igpAway),
        relQuality: 1.05, relXgDebt: 0.1,
        reasonBuilder: () => `Savunma Kilidi: Düşük ceza sahası şut üretimi ve ${totFouls} faul ile oyun temposu kilitlendi; ${activeLine} Alt gidişatı kuvvetli (%${Math.round(modelProbs.underProb * 100)} Model Olasılığı).`
      })
    ];

    const htBttsOptions = [
      evaluateOption({
        marketKey: 'HT_BTTS', marketTitle: 'İY KG Var / Yok', selection: 'İY KG Var',
        pModel: modelProbs.htBttsYes, pPrior: priorProbs.htBttsYes,
        marketOdds: odds.htBttsYes, allMarketOdds: [odds.htBttsYes, odds.htBttsNo],
        relMomentum: (lambdas.momentumH + lambdas.momentumA) / 2, relIgp: Math.max(flow.igpHome, flow.igpAway),
        relQuality: maxQPos, relXgDebt: maxXgDebt, isFirstHalfOnly: true,
        reasonBuilder: () => `İlk Yarı Açık Oyun: Devre bitmeden iki ekibin de ceza sahası içi üretimi yüksek; karşılıklı gol beklentisi öne çıkıyor.`
      }),
      evaluateOption({
        marketKey: 'HT_BTTS', marketTitle: 'İY KG Var / Yok', selection: 'İY KG Yok',
        pModel: modelProbs.htBttsNo, pPrior: priorProbs.htBttsNo,
        marketOdds: odds.htBttsNo, allMarketOdds: [odds.htBttsYes, odds.htBttsNo],
        relMomentum: 2.0 - Math.min(lambdas.momentumH, lambdas.momentumA), relIgp: 100 - Math.min(flow.igpHome, flow.igpAway),
        relQuality: 1.0, relXgDebt: 0, isFirstHalfOnly: true,
        reasonBuilder: () => `İlk Yarı Savunma Disiplini: İlk yarıda savunmalar hata yapmıyor; devre sonuna kadar karşılıklı gol çıkmama ihtimali yüksek.`
      })
    ];

    const htLineOdds = odds.htOuLines?.[String(htActiveLine)] || {};
    const totHtLambda = lambdas.lambdaHtH + lambdas.lambdaHtA;
    const htOuOptions = [
      evaluateOption({
        marketKey: 'HT_OU', marketTitle: `İY Alt / Üst (${htActiveLine})`, selection: `İY ${htActiveLine} Üst`, line: htActiveLine,
        pModel: modelProbs.htOverProb, pPrior: priorProbs.htOverProb,
        marketOdds: htLineOdds.over, allMarketOdds: [htLineOdds.over, htLineOdds.under],
        relMomentum: Math.max(lambdas.momentumH * lambdas.burst5H, lambdas.momentumA * lambdas.burst5A),
        relIgp: Math.max(flow.igpHome, flow.igpAway),
        relQuality: maxQPos, relXgDebt: maxXgDebt, isFirstHalfOnly: true,
        reasonBuilder: () => `İlk Yarı Sonu Baskısı: Devre öncesi son bölümde ${d10ShotsTot} şut ve ${d10CorTot} korner üretildi; devre bitmeden İY ${htActiveLine} Üst golü bekleniyor.`
      }),
      evaluateOption({
        marketKey: 'HT_OU', marketTitle: `İY Alt / Üst (${htActiveLine})`, selection: `İY ${htActiveLine} Alt`, line: htActiveLine,
        pModel: modelProbs.htUnderProb, pPrior: priorProbs.htUnderProb,
        marketOdds: htLineOdds.under, allMarketOdds: [htLineOdds.over, htLineOdds.under],
        relMomentum: 2.0 - ((lambdas.momentumH + lambdas.momentumA) / 2), relIgp: 100 - Math.max(flow.igpHome, flow.igpAway),
        relQuality: 1.0, relXgDebt: 0, isFirstHalfOnly: true,
        reasonBuilder: () => `İlk Yarı Savunma Kilidi: İlk yarıda savunmalar risk almıyor; devre sonuna kadar düşük skorlu gidişat teyitli.`
      })
    ];

    const nextGoalNum = gTot + 1;
    const ngOptions = [
      evaluateOption({
        marketKey: 'NEXT_GOAL', marketTitle: `Sıradaki Gol (${nextGoalNum}. Gol)`, selection: 'Sıradaki Gol: Ev Sahibi',
        pModel: modelProbs.nextGoalHome, pPrior: priorProbs.nextGoalHome,
        marketOdds: odds.nextGoalHome, allMarketOdds: [odds.nextGoalHome, odds.nextGoalNo, odds.nextGoalAway],
        relMomentum: lambdas.momentumH * lambdas.burst5H, relIgp: flow.igpHome,
        relQuality: lambdas.qPosH, relXgDebt: lambdas.xgDebtH,
        reasonBuilder: () => {
          const isHt = match.status === 'HT';
          const timeCtx = isHt ? 'ilk yarıda ceza sahası içinden' : 'son 10 dakikada';
          const xgVal = (hStats.xg || 0).toFixed(2);
          const shotCtx = isHt ? `${boxH} şut bularak ${xgVal} xG üretti (${hStats.shotsOnTarget || 0} isabet)` : `${d10ShotsH} şut ve ${d10CorH} kornerle rakip kaleyi ablukaya aldı`;
          return `Ceza Sahası Kuşatması: ${match.home.name} ${timeCtx} ${shotCtx}. Deplasman savunması geriye yaslandı; 2. yarıda ${nextGoalNum}. gol baskısı kaçınılmaz (Hedef: Sıradaki Gol Ev @${(1 / (1.03 * (modelProbs.nextGoalHome || 0.6))).toFixed(2)} / %${Math.round(modelProbs.nextGoalHome * 100)} Güven).`;
        }
      }),
      evaluateOption({
        marketKey: 'NEXT_GOAL', marketTitle: `Sıradaki Gol (${nextGoalNum}. Gol)`, selection: 'Sıradaki Gol: Deplasman',
        pModel: modelProbs.nextGoalAway, pPrior: priorProbs.nextGoalAway,
        marketOdds: odds.nextGoalAway, allMarketOdds: [odds.nextGoalHome, odds.nextGoalNo, odds.nextGoalAway],
        relMomentum: lambdas.momentumA * lambdas.burst5A, relIgp: flow.igpAway,
        relQuality: lambdas.qPosA, relXgDebt: lambdas.xgDebtA,
        reasonBuilder: () => {
          const isHt = match.status === 'HT';
          const timeCtx = isHt ? 'ilk yarıda ceza sahası içinden' : 'son 10 dakikada';
          const xgVal = (aStats.xg || 0).toFixed(2);
          const shotCtx = isHt ? `${boxA} şut bularak ${xgVal} xG üretti (${aStats.shotsOnTarget || 0} isabet)` : `${d10ShotsA} şut ve ${d10CorA} kornerle rakip kaleyi ablukaya aldı`;
          return `Deplasman Kuşatması: ${match.away.name} ${timeCtx} ${shotCtx}; ${nextGoalNum}. gol deplasmanda bekleniyor (Model: %${Math.round(modelProbs.nextGoalAway * 100)}).`;
        }
      }),
      evaluateOption({
        marketKey: 'NEXT_GOAL', marketTitle: `Sıradaki Gol (${nextGoalNum}. Gol)`, selection: `Gol Olmaz (${gH}-${gA})`,
        pModel: modelProbs.noMoreGoals, pPrior: priorProbs.noMoreGoals,
        marketOdds: odds.nextGoalNo, allMarketOdds: [odds.nextGoalHome, odds.nextGoalNo, odds.nextGoalAway],
        relMomentum: 2.0 - Math.max(lambdas.momentumH, lambdas.momentumA), relIgp: 100 - Math.max(flow.igpHome, flow.igpAway),
        relQuality: 1.0, relXgDebt: 0,
        reasonBuilder: () => `Rölanti / Savunma Kilidi: Düşük tempo ve kilitli savunmalar nedeniyle maçın başka gol olmadan ${gH}-${gA} tamamlanma ihtimali %${(modelProbs.noMoreGoals * 100).toFixed(1)}.`
      })
    ];

    const pickBest = (options) => {
      if (isScheduled) {
        return [...options].sort((a, b) => b.modelProbPct - a.modelProbPct)[0];
      }
      const valid = options.filter(o =>
        o.allowedByState &&
        o.confidence >= 74 &&
        o.edgePct >= 4.2 &&
        o.marketOdds >= 1.35 &&
        o.marketOdds <= 4.20
      );
      if (valid.length === 0) return null;
      return [...valid].sort((a, b) => (b.convictionScore + b.edgePct * 1.6) - (a.convictionScore + a.edgePct * 1.6))[0];
    };

    const marketBoard = {
      MS: { best: pickBest(msOptions), options: msOptions },
      BTTS: { best: pickBest(bttsOptions), options: bttsOptions },
      OU: { best: pickBest(ouOptions), options: ouOptions },
      HT_BTTS: { best: pickBest(htBttsOptions), options: htBttsOptions },
      HT_OU: { best: pickBest(htOuOptions), options: htOuOptions },
      NEXT_GOAL: { best: pickBest(ngOptions), options: ngOptions }
    };

    const hunter = this.huntSelectiveSignals(match, lambdas, flow, marketBoard, windows);

    const formatMarketForUi = (key, group, isHtOnly = false) => {
      const best = group.best;
      const bothScored = gH >= 1 && gA >= 1;
      const bttsSettled = (key === 'BTTS' || key === 'HT_BTTS') && bothScored;
      const htOuSettled = key === 'HT_OU' && gTot >= 2;
      const ftGoalSaturated = (key === 'OU' || key === 'NEXT_GOAL') && gTot >= 5;

      if (isScheduled) {
        return {
          marketTitle: group.options?.[0]?.marketTitle || key,
          selection: best ? `${best.selection} (Maç Önü)` : 'Maç Önü',
          confidence: best?.confidence || 0,
          closed: false,
          marketStatus: 'PRE_MATCH',
          statusLabel: 'Maç Önü',
          allOptions: (group.options || []).map(o => ({
            selection: o.selection,
            prob: (o.modelProbPct || 0) / 100,
            odds: o.marketOdds,
            fairOdds: o.fairOdds
          }))
        };
      }

      let isClosed = false;
      let statusLabel = null;
      let marketStatus = 'ACTIVE';

      if (bttsSettled) {
        isClosed = true;
        marketStatus = 'SETTLED_WON';
        statusLabel = 'KG Gerçekleşti (Kapandı)';
      } else if (htOuSettled) {
        isClosed = true;
        marketStatus = 'SETTLED_WON';
        statusLabel = 'İY 1.5 Üst Gerçekleşti';
      } else if (ftGoalSaturated) {
        isClosed = true;
        marketStatus = 'SETTLED_WON';
        statusLabel = '5+ Gol Doygunluğu';
      } else if (isHtOnly && (match.status === 'HT' || minute > 38 || !lambdas.isFirstHalfActive)) {
        isClosed = true;
        marketStatus = 'LOCKED_HT';
        statusLabel = 'İlk Yarı Kapandı';
      } else if (minute >= 88 || match.status === 'FT') {
        isClosed = true;
        marketStatus = 'LOCKED_TIME';
        statusLabel = 'Maç Sonu (Kapandı)';
      } else if (match.status === 'HT') {
        isClosed = false;
        marketStatus = 'ACTIVE_HT';
        statusLabel = 'Devre Arası';
      } else if (minute >= 75) {
        isClosed = false;
        marketStatus = 'LATE_IN_PLAY';
        statusLabel = 'Son Bölüm';
      }

      // Best selection or dominant model option
      const sortedByProb = [...(group.options || [])].sort((a, b) => b.modelProbPct - a.modelProbPct);
      const topOption = sortedByProb[0];
      const displaySelection = best
        ? best.selection
        : (isClosed ? statusLabel : (topOption ? `${topOption.selection}` : 'Canlı Model'));
      const displayConfidence = best ? best.confidence : (topOption ? Math.round(topOption.modelProbPct) : 0);

      return {
        marketTitle: group.options?.[0]?.marketTitle || key,
        selection: displaySelection,
        confidence: isClosed && !bttsSettled && !htOuSettled ? 0 : displayConfidence,
        tierBadge: best?.tierBadge || null,
        closed: isClosed,
        marketStatus,
        statusLabel,
        allOptions: (group.options || []).map(o => ({
          selection: o.selection,
          prob: (o.modelProbPct || 0) / 100,
          odds: o.marketOdds,
          fairOdds: o.fairOdds,
          allowed: Boolean(o.allowedByState) && !isClosed
        }))
      };
    };

    const markets = {
      MS: formatMarketForUi('MS', marketBoard.MS),
      BTTS: formatMarketForUi('BTTS', marketBoard.BTTS),
      OU: formatMarketForUi('OU', marketBoard.OU),
      HT_BTTS: formatMarketForUi('HT_BTTS', marketBoard.HT_BTTS, true),
      HT_OU: formatMarketForUi('HT_OU', marketBoard.HT_OU, true),
      NEXT_GOAL: formatMarketForUi('NEXT_GOAL', marketBoard.NEXT_GOAL)
    };

    return {
      lambdas,
      lambdaHome: lambdas.lambdaRemH,
      lambdaAway: lambdas.lambdaRemA,
      marketBoard,
      markets,
      signalStatus: hunter.signalStatus,     // 'SIGNAL_TRIGGERED' | 'WATCHLIST' | 'NO_SIGNAL' | 'PRE_MATCH'
      statusBadge: hunter.statusBadge,
      hunterReason: hunter.reason,
      signalStatusReason: hunter.reason,
      activeSignals: hunter.activeSignals,
      topSignal: hunter.activeSignals[0] || null,
      primarySignal: hunter.activeSignals[0] || (hunter.signalStatus === 'WATCHLIST' ? marketBoard.NEXT_GOAL?.best : null),
      complementarySignal: hunter.activeSignals[1] || null
    };
  }
}

module.exports = QuantSignalEngine;
