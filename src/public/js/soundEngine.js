/**
 * PulseBet Pro — Zero-Latency Web Audio API Sound Synthesizer
 * Generates distinct, crisp acoustic alerts for each match event type:
 *   - goal: Ascending stadium fanfare chord
 *   - disallowed_goal: Dual-tone VAR alert siren
 *   - assist: Warm harmonic chime
 *   - shot: High-precision sonar ping
 *   - foul: Referee whistle pulse
 *   - card: Sharp disciplinary double-beep
 *   - signal: Quant terminal alpha chime
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.45;
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  playTone(freq, startTime, duration, type = 'sine', peakGain = 0.3) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    const g = peakGain * this.volume;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, g), startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  play(category) {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      switch (category) {
        case 'goal':
          // Celebratory C5 - E5 - G5 - C6 ascending triad
          this.playTone(523.25, now, 0.14, 'triangle', 0.55);
          this.playTone(659.25, now + 0.11, 0.14, 'triangle', 0.55);
          this.playTone(783.99, now + 0.22, 0.16, 'triangle', 0.60);
          this.playTone(1046.50, now + 0.34, 0.42, 'sine', 0.70);
          break;

        case 'disallowed_goal':
          // VAR Disallowed Goal descending warning (A4 -> Eb4)
          this.playTone(440.0, now, 0.18, 'sawtooth', 0.45);
          this.playTone(311.13, now + 0.19, 0.32, 'sawtooth', 0.50);
          break;

        case 'assist':
          // Crisp harmonic fifth (D5 -> A5)
          this.playTone(587.33, now, 0.12, 'sine', 0.40);
          this.playTone(880.0, now + 0.10, 0.22, 'sine', 0.45);
          break;

        case 'shot':
          // Fast tactical sonar ping (987.77 Hz B5)
          this.playTone(987.77, now, 0.11, 'sine', 0.35);
          break;

        case 'foul':
          // Short referee pulse
          this.playTone(1760.0, now, 0.08, 'triangle', 0.28);
          this.playTone(1680.0, now + 0.05, 0.08, 'triangle', 0.25);
          break;

        case 'card':
          // Disciplinary double alert (F5 -> F5)
          this.playTone(698.46, now, 0.11, 'square', 0.32);
          this.playTone(698.46, now + 0.14, 0.16, 'square', 0.36);
          break;

        case 'signal':
          // Quant terminal chime (E5 -> B5 -> E6)
          this.playTone(659.25, now, 0.10, 'sine', 0.38);
          this.playTone(987.77, now + 0.09, 0.12, 'sine', 0.42);
          this.playTone(1318.51, now + 0.19, 0.25, 'sine', 0.45);
          break;

        default:
          this.playTone(740.0, now, 0.10, 'sine', 0.30);
      }
    } catch (_) {}
  }
}

window.soundEngine = new SoundEngine();
