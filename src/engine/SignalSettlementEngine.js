/**
 * PulseBet Studio — Real-Time Live Signal Settlement & Hit-Rate Engine (V4)
 * Tracks every triggered live betting signal and evaluates in real time whether it:
 *  - TUTTU (WON) — Immediately mid-game (e.g. Over hit, BTTS hit, Next Goal hit) or at HT/FT
 *  - TUTMADI (LOST) — Immediately mid-game (e.g. Under broken, wrong team scored Next Goal) or at HT/FT
 *  - AKTİF (PENDING) — Still in play with live score & requirement status badge
 */

class SignalSettlementEngine {
  constructor() {
    this.maxLedgerSize = 120;
  }

  /**
   * Parse numeric Over/Under line from signal selection if not explicitly set
   */
  extractLine(selection) {
    if (!selection) return 2.5;
    const m = String(selection).match(/(\d+\.5)/);
    return m ? parseFloat(m[1]) : 2.5;
  }

  /**
   * Create a canonical tracked signal record when a new live signal is triggered
   */
  createTrackedSignal(signalNotification, match) {
    const sig = signalNotification.signal || {};
    const gH = match?.home?.score ?? signalNotification.homeScore ?? 0;
    const gA = match?.away?.score ?? signalNotification.awayScore ?? 0;
    const min = match?.minute ?? signalNotification.minute ?? 1;
    const line = sig.line !== undefined ? sig.line : this.extractLine(sig.selection);

    const record = {
      id: signalNotification.id,
      timestamp: signalNotification.timestamp || Date.now(),
      matchId: signalNotification.matchId,
      leagueName: signalNotification.leagueName || match?.league?.name || 'Lig',
      homeName: signalNotification.homeName || match?.home?.name || 'Ev Sahibi',
      awayName: signalNotification.awayName || match?.away?.name || 'Deplasman',
      homeLogo: signalNotification.homeLogo || match?.home?.logo || null,
      awayLogo: signalNotification.awayLogo || match?.away?.logo || null,
      homeBackupLogo: signalNotification.homeBackupLogo || match?.home?.backupLogo || null,
      awayBackupLogo: signalNotification.awayBackupLogo || match?.away?.backupLogo || null,
      marketKey: sig.marketKey || 'OU',
      marketTitle: sig.marketTitle || 'Canlı Sinyal',
      selection: sig.selection || signalNotification.title || '',
      line,
      odds: sig.marketOdds || sig.fairOdds || 1.75,
      confidence: sig.confidence || 72,
      convictionScore: sig.convictionScore || sig.confidence || 72,
      signalTier: signalNotification.signalTier || sig.signalTier || 'VALUE_B_PLUS',
      tierBadge: signalNotification.tierBadge || sig.tierBadge || 'DEĞER SİNYALİ (B+)',
      edgePct: sig.edgePct || 5.0,
      archetypeLabel: signalNotification.archetypeLabel || sig.archetypeLabel || 'Canlı Baskı Sinyali',
      narrative: signalNotification.narrative || sig.reasoning || '',
      evidenceFactors: signalNotification.evidenceFactors || [],
      triggerMinute: min,
      triggerMinuteLabel: `${min}'`,
      triggerScoreHome: gH,
      triggerScoreAway: gA,
      triggerTotalGoals: gH + gA,
      currentScoreHome: gH,
      currentScoreAway: gA,
      htScoreHome: match?.home?.htScore ?? (min <= 45 ? gH : null),
      htScoreAway: match?.away?.htScore ?? (min <= 45 ? gA : null),
      currentMinute: min,
      matchStatus: match?.status || 'LIVE',
      settlementStatus: 'PENDING', // 'PENDING' | 'WON' | 'LOST' | 'VOID'
      settlementBadge: `AKTİF (${gH}-${gA})`,
      settlementDetail: 'Maç devam ediyor',
      settledAt: null,
      settledMinute: null
    };

    this.evaluateSignal(record, match);
    return record;
  }

  /**
   * Evaluate a tracked signal against the latest match state (supports instant mid-match settlement + VAR rollback)
   */
  evaluateSignal(record, match) {
    if (!record || !match) return record;

    const status = String(match.status || 'LIVE').toUpperCase();
    const min = match.minute || record.currentMinute || 0;
    const gH = match.home?.score ?? record.currentScoreHome ?? 0;
    const gA = match.away?.score ?? record.currentScoreAway ?? 0;
    const gTot = gH + gA;

    record.currentScoreHome = gH;
    record.currentScoreAway = gA;
    record.currentMinute = min;
    record.matchStatus = status;

    if (status === 'HT' || (status === 'LIVE' && min <= 45)) {
      record.htScoreHome = gH;
      record.htScoreAway = gA;
    } else if (match.home?.htScore !== undefined && match.home?.htScore !== null && (match.home.htScore > 0 || match.away.htScore > 0)) {
      record.htScoreHome = match.home.htScore;
      record.htScoreAway = match.away.htScore;
    }

    const htH = record.htScoreHome ?? gH;
    const htA = record.htScoreAway ?? gA;
    const htTot = htH + htA;

    const isFinished = status === 'FT' || status === 'FINISHED' || status === 'AET' || status === 'PEN';
    const isHalfTimeOrLater = status === 'HT' || isFinished || (status === 'LIVE' && min > 45);
    const isCancelled = status === 'POSTPONED' || status === 'CANCELLED' || status === 'ABANDONED';

    if (isCancelled) {
      record.settlementStatus = 'VOID';
      record.settlementBadge = 'ERTELENDİ / İADE';
      record.settlementDetail = 'Maç ertelendi veya iptal edildi';
      return record;
    }

    const mKey = record.marketKey;
    const sel = String(record.selection || '');
    const line = record.line ?? this.extractLine(sel);
    const trigH = record.triggerScoreHome ?? 0;
    const trigA = record.triggerScoreAway ?? 0;
    const trigTot = record.triggerTotalGoals ?? (trigH + trigA);

    let newStatus = 'PENDING';
    let badge = `AKTİF (${gH}-${gA})`;
    let detail = `Tetikleme: Dk ${record.triggerMinute}' (${trigH}-${trigA}) • Anlık: ${gH}-${gA}`;

    // 1. FULL-TIME OVER / UNDER (OU)
    if (mKey === 'OU') {
      if (sel.includes('Üst')) {
        if (gTot > line) {
          newStatus = 'WON';
          badge = `TUTTU (${gH}-${gA})`;
          detail = `${line} Üst hedefi ${gH}-${gA} skoruyla başarıyla gerçekleşti!`;
        } else if (isFinished) {
          newStatus = 'LOST';
          badge = `TUTMADI (MS ${gH}-${gA})`;
          detail = `Maç ${gH}-${gA} sona erdi (${line} Üst tamamlanamadı).`;
        } else {
          const needed = Math.max(1, Math.ceil(line - gTot));
          badge = `AKTİF (${needed} gol lazım • ${gH}-${gA})`;
        }
      } else if (sel.includes('Alt')) {
        if (gTot > line) {
          newStatus = 'LOST';
          badge = `TUTMADI (${gH}-${gA})`;
          detail = `Skor ${gH}-${gA} oldu (${line} Alt baremi aşıldı).`;
        } else if (isFinished) {
          newStatus = 'WON';
          badge = `TUTTU (MS ${gH}-${gA})`;
          detail = `Maç ${gH}-${gA} sona erdi (${line} Alt korundu).`;
        } else {
          badge = `AKTİF (Anlık: ${gH}-${gA})`;
        }
      }
    }

    // 2. FIRST-HALF OVER / UNDER (HT_OU)
    else if (mKey === 'HT_OU') {
      const checkGoals = (status === 'LIVE' && min <= 45) ? gTot : htTot;
      const dispH = (status === 'LIVE' && min <= 45) ? gH : htH;
      const dispA = (status === 'LIVE' && min <= 45) ? gA : htA;

      if (sel.includes('Üst')) {
        if (checkGoals > line) {
          newStatus = 'WON';
          badge = `TUTTU (İY ${dispH}-${dispA})`;
          detail = `İlk yarı ${line} Üst hedefi (${dispH}-${dispA}) gerçekleşti!`;
        } else if (isHalfTimeOrLater) {
          newStatus = 'LOST';
          badge = `TUTMADI (İY ${dispH}-${dispA})`;
          detail = `İlk yarı ${dispH}-${dispA} tamamlandı.`;
        } else {
          badge = `İY AKTİF (${gH}-${gA})`;
        }
      } else if (sel.includes('Alt')) {
        if (checkGoals > line) {
          newStatus = 'LOST';
          badge = `TUTMADI (İY ${dispH}-${dispA})`;
          detail = `İlk yarıda barem aşıldı (${dispH}-${dispA}).`;
        } else if (isHalfTimeOrLater) {
          newStatus = 'WON';
          badge = `TUTTU (İY ${dispH}-${dispA})`;
          detail = `İlk yarı ${dispH}-${dispA} tamamlandı (${line} Alt korundu).`;
        } else {
          badge = `İY AKTİF (${gH}-${gA})`;
        }
      }
    }

    // 3. FULL-TIME BOTH TEAMS TO SCORE (BTTS)
    else if (mKey === 'BTTS') {
      const bothScored = gH >= 1 && gA >= 1;
      if (sel.includes('KG Var')) {
        if (bothScored) {
          newStatus = 'WON';
          badge = `TUTTU (${gH}-${gA})`;
          detail = `Her iki takım da gol buldu (${gH}-${gA})!`;
        } else if (isFinished) {
          newStatus = 'LOST';
          badge = `TUTMADI (MS ${gH}-${gA})`;
          detail = `Maç ${gH}-${gA} bitti, karşılıklı gol çıkmadı.`;
        } else {
          badge = `AKTİF (${gH}-${gA})`;
        }
      } else if (sel.includes('KG Yok')) {
        if (bothScored) {
          newStatus = 'LOST';
          badge = `TUTMADI (${gH}-${gA})`;
          detail = `Karşılıklı gol oldu (${gH}-${gA}).`;
        } else if (isFinished) {
          newStatus = 'WON';
          badge = `TUTTU (MS ${gH}-${gA})`;
          detail = `Maç ${gH}-${gA} bitti, KG Yok başarıyla tamamlandı!`;
        } else {
          badge = `AKTİF (${gH}-${gA})`;
        }
      }
    }

    // 4. FIRST-HALF BTTS (HT_BTTS)
    else if (mKey === 'HT_BTTS') {
      const dispH = (status === 'LIVE' && min <= 45) ? gH : htH;
      const dispA = (status === 'LIVE' && min <= 45) ? gA : htA;
      const htBothScored = dispH >= 1 && dispA >= 1;

      if (sel.includes('KG Var')) {
        if (htBothScored) {
          newStatus = 'WON';
          badge = `TUTTU (İY ${dispH}-${dispA})`;
          detail = `İlk yarıda iki takım da gol buldu (${dispH}-${dispA})!`;
        } else if (isHalfTimeOrLater) {
          newStatus = 'LOST';
          badge = `TUTMADI (İY ${dispH}-${dispA})`;
          detail = `İlk yarı ${dispH}-${dispA} tamamlandı.`;
        } else {
          badge = `İY AKTİF (${gH}-${gA})`;
        }
      } else {
        if (htBothScored) {
          newStatus = 'LOST';
          badge = `TUTMADI (İY ${dispH}-${dispA})`;
          detail = `İlk yarıda karşılıklı gol oldu (${dispH}-${dispA}).`;
        } else if (isHalfTimeOrLater) {
          newStatus = 'WON';
          badge = `TUTTU (İY ${dispH}-${dispA})`;
          detail = `İlk yarı ${dispH}-${dispA} tamamlandı.`;
        } else {
          badge = `İY AKTİF (${gH}-${gA})`;
        }
      }
    }

    // 5. NEXT GOAL (Sıradaki Gol)
    else if (mKey === 'NEXT_GOAL') {
      if (gTot > trigTot) {
        const homeScored = gH > trigH && gA === trigA;
        const awayScored = gA > trigA && gH === trigH;
        const bothScoredSince = gH > trigH && gA > trigA;

        if (sel.includes('Ev Sahibi')) {
          if (homeScored || (bothScoredSince && record.settlementStatus === 'WON')) {
            newStatus = 'WON';
            badge = `TUTTU (Ev Attı • ${gH}-${gA})`;
            detail = `${record.homeName} sıradaki golü attı (${trigH}-${trigA} → ${gH}-${gA})!`;
          } else if (awayScored) {
            newStatus = 'LOST';
            badge = `TUTMADI (Dep Attı • ${gH}-${gA})`;
            detail = `Sıradaki golü deplasman ekibi kaydetti (${gH}-${gA}).`;
          }
        } else if (sel.includes('Deplasman')) {
          if (awayScored || (bothScoredSince && record.settlementStatus === 'WON')) {
            newStatus = 'WON';
            badge = `TUTTU (Dep Attı • ${gH}-${gA})`;
            detail = `${record.awayName} sıradaki golü attı (${trigH}-${trigA} → ${gH}-${gA})!`;
          } else if (homeScored) {
            newStatus = 'LOST';
            badge = `TUTMADI (Ev Attı • ${gH}-${gA})`;
            detail = `Sıradaki golü ev sahibi kaydetti (${gH}-${gA}).`;
          }
        } else if (sel.includes('Gol Olmaz')) {
          newStatus = 'LOST';
          badge = `TUTMADI (Gol Oldu • ${gH}-${gA})`;
          detail = `Sinyal sonrası gol çıktı (${gH}-${gA}).`;
        }
      } else if (isFinished) {
        if (sel.includes('Gol Olmaz')) {
          newStatus = 'WON';
          badge = `TUTTU (MS ${gH}-${gA})`;
          detail = `Sinyal sonrası başka gol olmadı (${gH}-${gA})!`;
        } else {
          newStatus = 'LOST';
          badge = `TUTMADI (MS ${gH}-${gA})`;
          detail = `Maçta sinyal sonrası başka gol çıkmadı (${gH}-${gA}).`;
        }
      } else {
        badge = `${trigTot + 1}. GOL BEKLENİYOR (${gH}-${gA})`;
      }
    }

    // 6. MATCH WINNER (MS 1 / MS X / MS 2)
    else if (mKey === 'MS') {
      const isMs1 = sel.includes('MS 1');
      const isMsX = sel.includes('MS X');
      const isMs2 = sel.includes('MS 2');
      const currentlyLeading = (isMs1 && gH > gA) || (isMsX && gH === gA) || (isMs2 && gA > gH);

      if (isFinished) {
        if (currentlyLeading) {
          newStatus = 'WON';
          badge = `TUTTU (MS ${gH}-${gA})`;
          detail = `Maç ${gH}-${gA} tamamlandı, ${sel} tahmini tuttu!`;
        } else {
          newStatus = 'LOST';
          badge = `TUTMADI (MS ${gH}-${gA})`;
          detail = `Maç ${gH}-${gA} tamamlandı.`;
        }
      } else {
        badge = currentlyLeading
          ? `AKTİF (Önde ${gH}-${gA})`
          : `AKTİF (${gH}-${gA})`;
      }
    }

    if (newStatus !== 'PENDING' && record.settlementStatus === 'PENDING') {
      record.settledAt = Date.now();
      record.settledMinute = min;
    } else if (newStatus === 'PENDING') {
      // Self-healing if VAR rolls back a goal
      record.settledAt = null;
      record.settledMinute = null;
    }

    record.settlementStatus = newStatus;
    record.settlementBadge = badge;
    record.settlementDetail = detail;
    return record;
  }

  /**
   * Compute aggregate hit-rate statistics for the UI Signal Scoreboard
   */
  computeStats(ledger) {
    const list = Array.isArray(ledger) ? ledger : [];
    let won = 0;
    let lost = 0;
    let pending = 0;

    for (const item of list) {
      if (item.settlementStatus === 'WON') won++;
      else if (item.settlementStatus === 'LOST') lost++;
      else if (item.settlementStatus === 'PENDING') pending++;
    }

    const settledCount = won + lost;
    const hitRatePct = settledCount > 0 ? Math.round((won / settledCount) * 100) : 0;

    return {
      total: won + lost + pending,
      won,
      lost,
      pending,
      settledCount,
      hitRatePct
    };
  }
}

module.exports = SignalSettlementEngine;
