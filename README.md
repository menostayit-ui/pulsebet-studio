<div align="center">

# PulseBet Studio

### Institutional-Grade Live Football Telemetry & Quantitative Value Betting Terminal

[![GitHub stars](https://img.shields.io/github/stars/menostayit-ui/pulsebet-studio?style=for-the-badge&logo=github&color=6366f1)](https://github.com/menostayit-ui/pulsebet-studio/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/Node.js-18.x%20%7C%2020.x%20%7C%2022.x-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![WebSocket](https://img.shields.io/badge/WebSocket-Native%20Bi--directional-010101?style=for-the-badge&logo=socketdotio)](https://github.com/websockets/ws)
[![Architecture](https://img.shields.io/badge/Architecture-Local--First%20%7C%20Zero--Dep-059669?style=for-the-badge)](https://github.com/menostayit-ui/pulsebet-studio)
[![i18n](https://img.shields.io/badge/i18n-English%20%7C%20T%C3%BCrk%C3%A7e-ec4899?style=for-the-badge)](#-internationalization-i18n)

<p align="center">
  <b>Sub-second multi-source scraping</b> • 
  <b>Dixon-Coles Poisson forecasting</b> • 
  <b>Dynamic Momentum Radar™</b> • 
  <b>Real-time EV edge detection</b> • 
  <b>Localhost air-gapped privacy</b>
</p>

[Quick Start](#-quick-start) •
[Core Features](#-key-capabilities) •
[Quant Architecture](#-system-architecture) •
[Mathematical Formulation](#-mathematical-formulation) •
[Terminal Layout](#-terminal-interface) •
[Contributing](#-contributing)

</div>

---

## ⚡ The Edge: Why PulseBet Studio?

Retail sports betting interfaces are engineered with asymmetric advantages for bookmakers—lagging match clocks, inflated odds spreads (vig), and delayed visual trackers. Commercial sports data feeds (Opta, Sportradar) charge thousands of dollars monthly, locking retail traders and quant analysts out of real-time market opportunities.

**PulseBet Studio levels the playing field.** It is a standalone, local-first sports analytics terminal that operates like a Bloomberg or Refinitiv terminal for in-play football. It continuously extracts, harmonizes, and cross-validates decentralized telemetry streams from Flashscore, 365Scores, and ESPN in real-time—**with zero API keys, zero monthly subscriptions, and zero external tracking.**

By combining rolling high-frequency pressure metrics with a time-decay calibrated **Dixon-Coles bivariate Poisson model**, PulseBet Studio detects statistical momentum divergences and identifies high-conviction positive Expected Value (+EV) trading opportunities before bookmaker algorithms adjust their prices.

```
       Raw Match Telemetry (Flashscore + 365Scores + ESPN)
                              │
                              ▼
        [ StateDiffEngine & MatchMomentumEngine ]
            ↳ Rolling 5m/10m Pressure Index (IGP)
            ↳ xG Debt & Mean-Reversion Scanner
                              │
                              ▼
          [ Calibrated Dixon-Coles Poisson Core ]
            ↳ Real-time fair odds calculation
            ↳ Vig stripping & Kelly criterion sizing
                              │
                              ▼
    High-Conviction Trading Signals with Audio Alerts & Ledger
```

---

## 🎯 Key Capabilities

### 1. Multi-Source Telemetry Ingestion (Zero API Keys)
- **Triple-Stream Redundancy:** Integrates Flashscore (rapid live clock & score spine), 365Scores (granular incident timelines and attack phases), and ESPN (box score analytics and shot maps).
- **Sub-Second State Reconciliation:** Proprietary fuzzy entity reconciliation engine (`TeamNameMatcher`) aligns naming discrepancies across feeds seamlessly without dropped packets.
- **Self-Healing Data Recovery:** Automatic failover handling ensures zero interruption if an upstream provider delays an update.

### 2. In-Game Pressure (IGP) & Momentum Radar™
- **Rolling Multi-Window Analysis:** Calculates rolling 5-minute and 10-minute shot velocity, penalty-box penetration, corner generation, and territory dominance ($IGP \in [0, 100]$).
- **Momentum Divergence:** Flags games where one side exerts total territorial dominance yet the scoreline remains tied or trailing—highlighting prime late-game goal candidates.
- **xG Debt Mean-Reversion Engine:** Spots teams with high cumulative expected goals ($xG \ge 0.88$) that have not yet scored, projecting impending statistical mean reversion.

### 3. Quantitative Signal Hunter (+EV Edge Calculation)
- **Calibrated Dixon-Coles Model:** Dynamic time-decay Poisson distributions tailored to live in-play states, factoring in low-score draw correlation corrections ($\tau_{DC}$).
- **Vig-Free Fair Price Estimation:** Computes true mathematical probabilities for:
  - Match Result (1X2)
  - Both Teams To Score (BTTS)
  - First-Half / Full-Time Over & Under Lines
  - Dynamic Next Goal Markets
- **5-Pillar Conviction Scoring ($C_{score} \in [0, 100]$):**
  - **Tier A+ (Elite Execution):** Conviction $\ge 82$, Mathematical Edge $+6.5\%$ to $+28.0\%$.
  - **Tier A (High Conviction):** Conviction $\ge 76$, Mathematical Edge $\ge +4.5\%$.
  - **Tier B+ (Market Value):** Conviction $\ge 74$, Mathematical Edge $\ge +4.2\%$.

### 4. Smart Discipline & Game-State Safeguards
- **1-1 Draw Guard:** Prohibits over-extended high-variance predictions (e.g. strictly suppresses Over 3.5 signals on 1-1 ties; authorizes only single-increment Over 2.5 plays).
- **Blowout Cruise-Control Damping:** Automatically suppresses goal signals when a match reaches blowout margins ($\Delta \ge 3$ or late 2-goal leads) where teams conserve energy and reduce offensive tempo.
- **Red Card Dynamic Shift:** Automatically adjusts Poisson offensive intensity ($\rho = 0.55$ penalty on the penalized squad, $+32\%$ boost to the opposition).

### 5. Automated Settlement & VAR Ledger
- **Mid-Match Instant Settlement:** Live signals automatically resolve to **WON** (target line hit) or **LOST** (time expired / opposing team scored) without waiting for the final whistle.
- **Self-Healing VAR Rollback:** If a goal is overturned by VAR, the internal state machine rolls the settlement status back to **IN-PLAY** automatically.
- **Live Hit-Rate Analytics:** Displays real-time win rate percentages, total signals generated, active in-play selections, and ledger history.

### 6. Institutional Neo-Minimalist Terminal (2026 UX/UI)
- **High-Density Bento Grid:** 3-column layout featuring Live Match Matrix, Deep Tactical Telemetry Inspector, and Live Signal Ledger.
- **Obsidian Velvet Dark / Porcelain Light Modes:** Low-fatigue color palettes engineered for long-session trading and match monitoring.
- **Procedural Audio Synthesizer:** Built on the native Web Audio API—generates distinct multi-frequency acoustic chimes for goals, red cards, high-conviction signals, and settlements without external audio asset downloads.
- **Zero OS Emojis:** Custom SVG iconography crafted for sleek, distraction-free analytical clarity.

---

## 📐 Mathematical Formulation

### 1. Dixon-Coles Bivariate Poisson In-Play Model
Standard independent Poisson models systematically underestimate low-score draws ($0-0, 1-1$). PulseBet Studio corrects for score-dependence using the **Dixon-Coles adjustment parameter** ($\tau_{DC}$):

$$P(X = x, Y = y) = \tau_{\lambda, \mu}(x, y) \cdot \frac{\lambda^x e^{-\lambda}}{x!} \cdot \frac{\mu^y e^{-\mu}}{y!}$$

Where the adjustment factor $\tau$ is defined as:

$$\tau_{\lambda, \mu}(x, y) = \begin{cases} 
1 - \lambda \mu \rho & x = 0, y = 0 \\
1 + \lambda \rho & x = 0, y = 1 \\
1 + \mu \rho & x = 1, y = 0 \\
1 - \rho & x = 1, y = 1 \\
1 & \text{otherwise}
\end{cases}$$

*(Empirically calibrated live correlation coefficient: $\rho = -0.10$)*

### 2. In-Game Pressure (IGP) Metric
Continuously computed for Home and Away sides on a rolling $[0, 100]$ scale:

$$IGP_{team} = w_{poss} \cdot \Phi_{poss} + w_{sot} \cdot SOT_{10m} + w_{box} \cdot S_{box, 10m} + w_{crn} \cdot Corners_{10m} + w_{da} \cdot DA_{10m}$$

### 3. Dynamic Game-State Exponential Damping
When a team establishes a decisive lead ($\Delta_{score} \ge 2$ at $t \ge 58'$ or $\Delta_{score} \ge 3$), residual goal expectancy is damped exponentially to model match tempo deceleration:

$$\gamma_{state} = 0.35 \cdot \exp\left(-0.038 \cdot \max(0, t - 55)\right)$$

### 4. 5-Pillar Conviction Index
Every prospective signal is evaluated against five independent quant parameters:

$$C_{score} = 0.28 \cdot \text{Edge}_{hybrid} + 0.22 \cdot \text{Momentum}_{rel} + 0.20 \cdot Q_{chance} + 0.18 \cdot S_{tactical} + 0.12 \cdot \Delta_{steam}$$

---

## 🏛️ System Architecture

```
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   INCOMING TELEMETRY FEEDS                                    │
│       Flashscore (Clock & Events)  │  365Scores (Timelines & Attacks)  │  ESPN (Box Scores)   │
└───────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                │
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   MULTI-SOURCE ORCHESTRATOR                                   │
│            • Fuzzy Entity Matcher        • Incident Bus        • Deduplication Engine         │
└───────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                │
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   STATE & MOMENTUM PIPELINE                                   │
│  ┌───────────────────────────┐  ┌────────────────────────────┐  ┌──────────────────────────┐  │
│  │      MatchStateStore      │  │      StateDiffEngine       │  │   MatchMomentumEngine    │  │
│  │ (In-Memory Canonical Rep) │  │  (Event Diff Incident Bus) │  │ (IGP Rolling Pressure)   │  │
│  └───────────────────────────┘  └────────────────────────────┘  └──────────────────────────┘  │
└───────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                │
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 QUANTITATIVE ANALYTICS CORE                                   │
│  ┌───────────────────────────┐  ┌────────────────────────────┐  ┌──────────────────────────┐  │
│  │     QuantSignalEngine     │  │   SignalSettlementEngine   │  │    PlayerImpactEngine    │  │
│  │ (Dixon-Coles + 5 Pillars) │  │  (Real-Time PnL & Rollback)│  │ (Threat Index & Key Out) │  │
│  └───────────────────────────┘  └────────────────────────────┘  └──────────────────────────┘  │
└───────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                │
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                           LOCAL HTTP & WEBSOCKET BROADCAST ENGINE                             │
│                     (100% Localhost Loopback Isolation: 127.0.0.1:3850)                       │
└───────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                │
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     CLIENT TERMINAL UI                                        │
│      • Vanilla ES6 (Zero Bundler)           • Sub-250ms WebSocket Dispatcher                  │
│      • Bilingual i18n Core (EN / TR)         • Procedural Web Audio API Chimes                │
│      • High-Density Responsive Bento Grid   • Hardened Content Security Policy (CSP)          │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🖥️ Terminal Interface

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  PULSEBET STUDIO   ● LIVE (38 matches)   [Search League / Team]   [Filter: All / Quant / Fav]   [TR | EN] ⚙ │
├───────────────────────────────┬──────────────────────────────────────────────┬───────────────────────────────┤
│        LIVE MATCH MATRIX      │           MATCH TELEMETRY INSPECTOR          │      QUANT VALUE SIGNALS      │
│                               │                                              │                               │
│  Premier League               │  Arsenal  1 - 0  Chelsea       [64' 2H]      │  ACTIVE SIGNALS (4)           │
│  Arsenal 1 - 0 Chelsea   64'  │  ──────────────────────────────────────────  │  ───────────────────────────  │
│  ● Momentum: Arsenal 78% [A+] │  MOMENTUM RADAR™                             │  [A+] Arsenal Next Goal       │
│                               │  Arsenal ████████████░░░░ 78% (Dominant)     │  Line: Next Goal 2            │
│  La Liga                      │  Chelsea ███░░░░░░░░░░░░░ 22% (Suppressed)   │  Conviction: 86 | Edge: +14%  │
│  Real Madrid 0 - 0 Sevilla 32'│                                              │  Odds: 1.85 | Fair: 1.62      │
│  ● Momentum: Real Madrid 68%  │  ROLLING PRESSURE (LAST 10 MIN)              │                               │
│                               │  Shots: 6 (4 on target) vs 0                 │  [A] Real Madrid Over 0.5 1H  │
│  Serie A                      │  Box Touches: 18 vs 2                        │  Line: 1H Over 0.5            │
│  Inter 2 - 1 Juventus    78'  │  Dangerous Attacks: 14 vs 1                  │  Conviction: 79 | Edge: +8.5% │
│  ● Momentum: Balanced   51%   │                                              │  Odds: 2.10 | Fair: 1.93      │
│                               │  PROBABILISTIC FORECAST (DIXON-COLES)        │  ───────────────────────────  │
│  Bundesliga                   │  Home Win: 81.4%  |  Draw: 12.2%  | Away: 6% │  SETTLED SIGNALS (18 Won/4)   │
│  Dortmund 1 - 1 Leipzig  55'  │  Projected Over 1.5: 89.2% (Fair: 1.12)      │  Hit Rate: 81.8%              │
│  [1-1 Draw Guard: Over 2.5]   │  xG: 2.14 vs 0.42 (xG Debt: +0.86)           │                               │
└───────────────────────────────┴──────────────────────────────────────────────┴───────────────────────────────┘
```

---

## 🚀 Quick Start

### System Requirements
- **Node.js:** v18.0.0 or higher ([Download Node.js](https://nodejs.org/))
- **OS:** Windows, macOS, or Linux
- **RAM:** < 100 MB footprint

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/menostayit-ui/pulsebet-studio.git
cd pulsebet-studio

# 2. Install dependencies (single native WebSocket package, takes 3 seconds)
npm install

# 3. Start the application
# Windows:
start.bat
# Linux / macOS / Manual:
npm start
```

### Access the Terminal
Once launched, navigate your browser to:
```
http://127.0.0.1:3850
```

### Stopping the Server
- **Windows:** Double-click `stop.bat`
- **Linux / macOS:** Press `Ctrl + C` in the terminal

---

## 🌐 Internationalization (i18n)

PulseBet Studio is natively bilingual with zero machine-translated jargon:

| Locale | Terminology Scope | Target Audience |
|:---|:---|:---|
| **English (`EN`)** | Professional quantitative betting & financial market semantics | International sports quants, algorithmic traders, sharp bettors |
| **Turkish (`TR`)** | Authentic Turkish football & live trading terminology | Turkish betting community, local live match traders |

Switch languages instantly with zero page reloads via the header pill (`TR / EN`) or inside the Preferences popover. Settings persist automatically in `localStorage`.

---

## 🔒 Security & Air-Gapped Localhost Privacy

PulseBet Studio is engineered with uncompromising data privacy:

- **Strict Localhost Binding:** The server listens exclusively on loopback interface `127.0.0.1:3850`. No external LAN, Wi-Fi, or public IPs are bound.
- **Zero Cloud Telemetry:** No user tracking, no third-party telemetry, no analytics cookies.
- **Hardened Content Security Policy (CSP):** Completely disallows unsafe inline evaluation, external script injections, and clickjacking (`frame-ancestors: 'none'`).
- **Resource Efficiency:** Idles at < 45 MB of RAM and negligible CPU usage, ensuring high performance even on entry-level hardware.

---

## 🗺️ Roadmap

- [x] Multi-source live telemetry fusion (Flashscore + 365Scores + ESPN)
- [x] In-Game Pressure (IGP) Momentum Radar™
- [x] Calibrated Dixon-Coles Poisson in-play probability engine
- [x] Automated mid-game settlement & VAR rollback ledger
- [x] 2026 Neo-Minimalist Bento Grid UI with Web Audio chimes
- [x] Native English & Turkish i18n support
- [ ] In-play corner lines & handicap Poisson extensions
- [ ] Telegram Bot webhook integration for push notifications
- [ ] Historical backtesting & simulation engine
- [ ] Multi-match audio prioritization (smart audio queues)

---

## 🤝 Contributing

We welcome contributions from quantitative analysts, sports data scientists, and front-end engineers!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/QuantitativeEdge`)
3. Commit your Changes (`git commit -m 'feat: Add QuantitativeEdge model'`)
4. Push to the Branch (`git push origin feature/QuantitativeEdge`)
5. Open a Pull Request

---

## 📜 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for full details.

---

<div align="center">

**PulseBet Studio** • Engineered for quantitative precision.

If this project gives you an analytical edge, **please consider starring ⭐ the repository**!

</div>
