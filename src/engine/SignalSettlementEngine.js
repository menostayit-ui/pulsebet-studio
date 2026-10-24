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
      settlementStatus: 'PENDING', // 'PENDING' | 'WON' | 'LOST' | 'VOID' | 'UNDER_REVIEW' | 'INVALIDATED'
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
    if (record.settlementStatus === 'INVALIDATED') return record;

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

        if (sel.includes('Gol Olmaz')) {
          newStatus = 'LOST';
          badge = `TUTMADI (Gol Oldu • ${gH}-${gA})`;
          detail = `Sinyal sonrası gol çıktı (${gH}-${gA}).`;
        } else if (bothScoredSince) {
          // Multi-event arbitration using official match incidents timeline
          const incidents = Array.isArray(match.incidents) ? match.incidents : [];

          const isGoalIncident = (inc) => {
            if (!inc) return false;
            const evt = String(inc.eventType || inc.type || '').toUpperCase();
            if (evt.includes('DISALLOWED') || evt.includes('CANCEL')) return false;
            return evt === 'GOAL' || evt.includes('GOAL') || evt.includes('GOL');
          };

          const parseMinute = (inc) => {
            if (typeof inc.minute === 'number') return inc.minute;
            if (typeof inc.minute === 'string') {
              const parts = inc.minute.split('+');
              return parseInt(parts[0], 10) || 0;
            }
            if (typeof inc.time === 'number') return inc.time;
            return 0;
          };

          const parseAddedTime = (inc) => {
            if (typeof inc.addedTime === 'number') return inc.addedTime;
            if (typeof inc.minute === 'string' && inc.minute.includes('+')) {
              const parts = inc.minute.split('+');
              return parseInt(parts[1], 10) || 0;
            }
            return 0;
          };

          const getTeam = (inc) => {
            if (!inc) return null;
            const t = String(inc.team || inc.side || '').toUpperCase();
            if (t === 'HOME' || t === '1') return 'HOME';
            if (t === 'AWAY' || t === '2') return 'AWAY';
            if (match.home?.id !== undefined && String(inc.teamId || inc.competitorId) === String(match.home.id)) return 'HOME';
            if (match.away?.id !== undefined && String(inc.teamId || inc.competitorId) === String(match.away.id)) return 'AWAY';
            if (match.home?.name && inc.teamName && String(inc.teamName).toLowerCase() === String(match.home.name).toLowerCase()) return 'HOME';
            if (match.away?.name && inc.teamName && String(inc.teamName).toLowerCase() === String(match.away.name).toLowerCase()) return 'AWAY';
            return null;
          };

          const trigMin = Number(record.triggerMinute || 0);
          const trigTs = Number(record.timestamp || 0);

          const matchingGoals = [];
          for (let idx = 0; idx < incidents.length; idx++) {
            const inc = incidents[idx];
            if (!isGoalIncident(inc)) continue;

            const team = getTeam(inc);
            if (!team) continue;

            const incMin = parseMinute(inc);
            const incAdded = parseAddedTime(inc);
            const incTs = inc.timestamp ? (inc.timestamp > 1e11 ? inc.timestamp : inc.timestamp * 1000) : 0;

            const incHomeScore = typeof inc.homeScore === 'number' ? inc.homeScore : null;
            const incAwayScore = typeof inc.awayScore === 'number' ? inc.awayScore : null;
            const incScoreTotal = (incHomeScore !== null && incAwayScore !== null)
              ? (incHomeScore + incAwayScore)
              : null;

            // If incident has score information, goals that occurred before or at trigger must be excluded
            if (incScoreTotal !== null && incScoreTotal <= trigTot) {
              continue;
            }

            // Check if goal occurred at or after triggerMinute / timestamp
            if (incTs > 0 && trigTs > 0) {
              if (incTs < (trigTs - 30000) && incMin < trigMin) {
                continue;
              }
            } else if (incMin < trigMin) {
              continue;
            }

            matchingGoals.push({
              incident: inc,
              team,
              minute: incMin,
              addedTime: incAdded,
              scoreTotal: incScoreTotal,
              timestamp: incTs,
              index: idx
            });
          }

          // Sort matching goal incidents chronologically by minute and index
          matchingGoals.sort((a, b) => {
            if (a.minute !== b.minute) return a.minute - b.minute;
            if (a.addedTime !== b.addedTime) return a.addedTime - b.addedTime;
            if (a.scoreTotal !== null && b.scoreTotal !== null && a.scoreTotal !== b.scoreTotal) {
              return a.scoreTotal - b.scoreTotal;
            }
            if (a.timestamp > 0 && b.timestamp > 0 && a.timestamp !== b.timestamp) {
              return a.timestamp - b.timestamp;
            }
            return a.index - b.index;
          });

          let earliestTeam = null;
          if (matchingGoals.length > 0) {
            const isAmbiguous = matchingGoals.length >= 2 &&
              matchingGoals[0].team !== matchingGoals[1].team &&
              matchingGoals[0].minute === matchingGoals[1].minute &&
              matchingGoals[0].addedTime === matchingGoals[1].addedTime &&
              matchingGoals[0].scoreTotal === null &&
              matchingGoals[0].timestamp === 0;

            if (!isAmbiguous) {
              earliestTeam = matchingGoals[0].team;
            }
          }

          if (earliestTeam === 'HOME') {
            if (sel.includes('Ev Sahibi')) {
              newStatus = 'WON';
              badge = `TUTTU (Ev Attı • ${gH}-${gA})`;
              detail = `${record.homeName} sıradaki golü attı (${trigH}-${trigA} → ${gH}-${gA})!`;
            } else if (sel.includes('Deplasman')) {
              newStatus = 'LOST';
              badge = `TUTMADI (Ev Attı • ${gH}-${gA})`;
              detail = `Sıradaki golü ev sahibi kaydetti (${gH}-${gA}).`;
            }
          } else if (earliestTeam === 'AWAY') {
            if (sel.includes('Deplasman')) {
              newStatus = 'WON';
              badge = `TUTTU (Dep Attı • ${gH}-${gA})`;
              detail = `${record.awayName} sıradaki golü attı (${trigH}-${trigA} → ${gH}-${gA})!`;
            } else if (sel.includes('Ev Sahibi')) {
              newStatus = 'LOST';
              badge = `TUTMADI (Dep Attı • ${gH}-${gA})`;
              detail = `Sıradaki golü deplasman ekibi kaydetti (${gH}-${gA}).`;
            }
          } else {
            // match.incidents does not contain individual goals or cannot reliably determine the order
            if (record.settlementStatus === 'WON') {
              newStatus = 'WON';
              badge = record.settlementBadge;
              detail = record.settlementDetail;
            } else if (record.settlementStatus === 'LOST') {
              newStatus = 'LOST';
              badge = record.settlementBadge;
              detail = record.settlementDetail;
            } else {
              newStatus = 'UNDER_REVIEW';
              badge = 'İNCELEMEDE (Sıra Bekleniyor)';
              detail = 'İki gol arası sıralama resmi maç akışından doğrulanıyor';
            }
          }
        } else if (homeScored) {
          if (sel.includes('Ev Sahibi')) {
            newStatus = 'WON';
            badge = `TUTTU (Ev Attı • ${gH}-${gA})`;
            detail = `${record.homeName} sıradaki golü attı (${trigH}-${trigA} → ${gH}-${gA})!`;
          } else if (sel.includes('Deplasman')) {
            newStatus = 'LOST';
            badge = `TUTMADI (Ev Attı • ${gH}-${gA})`;
            detail = `Sıradaki golü ev sahibi kaydetti (${gH}-${gA}).`;
          }
        } else if (awayScored) {
          if (sel.includes('Deplasman')) {
            newStatus = 'WON';
            badge = `TUTTU (Dep Attı • ${gH}-${gA})`;
            detail = `${record.awayName} sıradaki golü attı (${trigH}-${trigA} → ${gH}-${gA})!`;
          } else if (sel.includes('Ev Sahibi')) {
            newStatus = 'LOST';
            badge = `TUTMADI (Dep Attı • ${gH}-${gA})`;
            detail = `Sıradaki golü deplasman ekibi kaydetti (${gH}-${gA}).`;
          }
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

    const isSettledStatus = (s) => s === 'WON' || s === 'LOST' || s === 'VOID' || s === 'INVALIDATED';

    if (isSettledStatus(newStatus) && (record.settlementStatus === 'PENDING' || record.settlementStatus === 'UNDER_REVIEW')) {
      record.settledAt = Date.now();
      record.settledMinute = min;
    } else if (newStatus === 'PENDING' || newStatus === 'UNDER_REVIEW') {
      // Self-healing if VAR rolls back a goal or while awaiting incident confirmation
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
    let underReview = 0;
    let invalidated = 0;
    let wonReturns = 0;
    let brierSum = 0;
    let brierCount = 0;

    for (const item of list) {
      const st = item.settlementStatus;
      if (st === 'WON') {
        won++;
        const odds = typeof item.odds === 'number' && !isNaN(item.odds) && item.odds > 0
          ? item.odds
          : (parseFloat(item.odds) || 1.75);
        wonReturns += odds;
      } else if (st === 'LOST') {
        lost++;
      } else if (st === 'PENDING') {
        pending++;
      } else if (st === 'UNDER_REVIEW') {
        underReview++;
      } else if (st === 'INVALIDATED') {
        invalidated++;
      }

      if (st === 'WON' || st === 'LOST') {
        let p = null;
        if (typeof item.modelProbability === 'number' && !isNaN(item.modelProbability)) {
          p = item.modelProbability > 1 ? item.modelProbability / 100 : item.modelProbability;
        } else if (typeof item.confidence === 'number' && !isNaN(item.confidence)) {
          p = item.confidence > 1 ? item.confidence / 100 : item.confidence;
        } else if (typeof item.convictionScore === 'number' && !isNaN(item.convictionScore)) {
          p = item.convictionScore > 1 ? item.convictionScore / 100 : item.convictionScore;
        }

        if (p !== null && !isNaN(p) && p >= 0 && p <= 1) {
          const outcome = st === 'WON' ? 1 : 0;
          const diff = outcome - p;
          brierSum += diff * diff;
          brierCount++;
        }
      }
    }

    const settledCount = won + lost;
    const hitRatePct = settledCount > 0 ? Math.round((won / settledCount) * 100) : 0;
    const roiYieldPct = settledCount > 0
      ? Number((((wonReturns - settledCount) / settledCount) * 100).toFixed(1))
      : 0.0;
    const brierScore = brierCount > 0
      ? Number((brierSum / brierCount).toFixed(4))
      : 0.0;

    return {
      total: list.length,
      won,
      lost,
      pending,
      underReview,
      invalidated,
      settledCount,
      hitRatePct,
      roiYieldPct,
      brierScore
    };
  }
}

module.exports = SignalSettlementEngine;
