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

[Overview](#-overview--the-edge) •
[Core Modules](#-core-functional-modules) •
[Mathematical Engine](#-mathematical-formulation) •
[Trading Workflow](#-real-world-trading-workflow) •
[Terminal Layout](#-terminal-interface) •
[Quick Start](#-quick-start) •
[Roadmap & Contributing](#-roadmap--community)

</div>

---

## ⚡ Overview & The Edge

Retail sports betting interfaces are structurally engineered to favor bookmakers through delayed visual tickers, artificially lagging match clocks, and heavy margin spreads (vig). At the same time, institutional data providers (such as Opta or Sportradar) demand thousands of dollars per month in enterprise licensing fees, creating a steep information asymmetry for independent quantitative traders, data scientists, and sports analysts.

**PulseBet Studio solves this asymmetry.**

Operating as a high-density, local-first analytics workstation—comparable to a Bloomberg or Refinitiv terminal specialized for in-play football—PulseBet Studio ingests, sanitizes, and cross-reconciles high-frequency live match telemetry from Flashscore, 365Scores, and ESPN in real-time. It requires:
- **Zero third-party commercial API keys**
- **Zero recurring subscription fees**
- **Zero cloud tracking or remote data logging**

By synthesizing rolling high-frequency pressure telemetry with a dynamically calibrated **Dixon-Coles bivariate Poisson model**, the terminal continuously calculates fair probabilities, identifies statistical momentum divergences, and flags positive Expected Value (+EV) trading opportunities in real-time before market prices adjust.

---

## 🧩 Core Functional Modules

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                                INCOMING TELEMETRY STREAMS                                 │
│      Flashscore (Rapid Clock & Events) │ 365Scores (Timelines & Attacks) │ ESPN (Box Scores)     │
└─────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                              │
                                              ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                               MULTI-SOURCE ORCHESTRATOR                                   │
│            • Fuzzy Entity Matcher       • State Deduplication      • Incident Bus         │
└─────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                              │
                                              ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                              ANALYTICS & MOMENTUM PIPELINE                                │
│   ┌──────────────────────────┐  ┌───────────────────────────┐  ┌───────────────────────┐  │
│   │     MatchStateStore      │  │      StateDiffEngine      │  │  MatchMomentumEngine  │  │
│   │ (In-Memory Canonical Rep)│  │ (Incident Bus & Millisec) │  │ (IGP Rolling Pressure)│  │
│   └──────────────────────────┘  └───────────────────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                              │
                                              ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                                QUANT SIGNAL & VALUATION CORE                              │
│   ┌──────────────────────────┐  ┌───────────────────────────┐  ┌───────────────────────┐  │
│   │    QuantSignalEngine     │  │  SignalSettlementEngine   │  │  PlayerImpactEngine   │  │
│   │(Dixon-Coles + 5 Pillars) │  │ (Real-Time PnL & VAR Undo)│  │ (Key Out & Threat Idx)│  │
│   └──────────────────────────┘  └───────────────────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                              │
                                              ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                           HIGH-SPEED LOCAL BROADCAST SERVER                               │
│                         (127.0.0.1:3850 Loopback Isolation)                               │
└─────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                              │
                                              ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CLIENT TRADING TERMINAL                                   │
│    • Vanilla ES6 (Zero Bundler)           • Sub-250ms Push Updates via Native WebSockets   │
│    • Bilingual i18n Engine (EN / TR)      • Procedural Web Audio API Acoustic Chimes      │
│    • High-Density Responsive Bento Grid   • Hardened Content Security Policy (CSP)        │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1. Decentralized Multi-Source Telemetry Fusion
- **Three-Pronged Ingestion:** Fuses Flashscore (fastest global clock and goal events), 365Scores (granular incident timelines, dangerous attacks, ball possession), and ESPN (box score statistics, cards, and shot maps).
- **Fuzzy Entity Reconciliation (`TeamNameMatcher`):** Normalizes disparate club naming conventions (e.g., *"Man Utd"*, *"Manchester United"*, *"MUN"*) across multiple providers with zero manual mapping.
- **Fail-Safe Self-Healing:** If an upstream data feed experiences network latency or momentary drops, the remaining feeds seamlessly maintain state continuity without dropping in-play tracking.

### 2. In-Game Pressure (IGP) & Dynamic Momentum Radar™
- **Rolling Time Windows:** Evaluates cumulative match intensity over rolling 5-minute and 10-minute intervals:
  - Dangerous attack velocity ($\Delta DA / \Delta t$)
  - Penalty-box touches and final-third territory dominance
  - Shot count and shots-on-target conversion ratios
- **Momentum Divergence:** Identifies matches where one side demonstrates extreme offensive pressure ($IGP \ge 72$) while the score remains deadlocked or trailing, projecting imminent goal opportunities.
- **xG Debt Mean-Reversion Model:** Tracks cumulative Expected Goals ($xG \ge 0.88$) generated without conversion, signaling a statistically probable reversion to the mean.

### 3. Quantitative Valuation & 5-Pillar Conviction Engine
- **Vig-Free Fair Price Modeling:** Strips bookmaker overround to evaluate true fair odds across Match Winner (1X2), Both Teams To Score (BTTS), Over/Under goal lines (1H & FT), and Next Goal markets.
- **Conviction Tier Classification:**
  - **Tier A+ (Elite Signal):** Conviction $\ge 82$, Calculated Mathematical Edge $+6.5\%$ to $+28.0\%$.
  - **Tier A (Strong Signal):** Conviction $\ge 76$, Calculated Mathematical Edge $\ge +4.5\%$.
  - **Tier B+ (Market Value):** Conviction $\ge 74$, Calculated Mathematical Edge $\ge +4.2\%$.
- **Discipline & Variance Dampers:**
  - **1-1 Draw Guard:** Eliminates high-variance over-optimistic projections (e.g., Over 3.5 is strictly suppressed on 1-1 ties; only realistic single-step Over 2.5 selections are eligible).
  - **Blowout Cruise-Control Filter:** Suppresses goal alerts when a team establishes an insurmountable lead ($\Delta \ge 3$ or late 2-goal leads) where game pace naturally decelerates.
  - **Red Card Adjustment:** Re-calibrates Poisson goal expectancy parameters ($\rho = 0.55$ penalty on the short-handed side, $+32\%$ offensive boost to the opponent).

### 4. Mid-Game Settlement & Autonomous VAR Rollback
- **Instant Strike Settlement:** Active selections evaluate immediately upon pitch occurrences (e.g., target goal scored resolves to **WON**; time expiration or adverse goal resolves to **LOST**).
- **Self-Healing VAR Reversal:** When a video assistant referee (VAR) overturns a goal, the internal state machine detects the score decrement and automatically rolls the settled signal back to **IN-PLAY**.
- **Real-Time Performance Ledger:** Tracks live hit rate percentages, win/loss tallies, active open bets, and historical selection logs.

---

## 📐 Mathematical Formulation

### 1. Dixon-Coles Bivariate Poisson In-Play Model
Independent Poisson distributions systematically underestimate low-score draws ($0-0, 1-1$) in professional football. PulseBet Studio implements the **Dixon-Coles adjustment parameter** ($\tau_{DC}$):

$$P(X = x, Y = y) = \tau_{\lambda, \mu}(x, y) \cdot \frac{\lambda^x e^{-\lambda}}{x!} \cdot \frac{\mu^y e^{-\mu}}{y!}$$

Where the adjustment factor $\tau$ modifies baseline joint probabilities:

$$\tau_{\lambda, \mu}(x, y) = \begin{cases} 
1 - \lambda \mu \rho & x = 0, y = 0 \\
1 + \lambda \rho & x = 0, y = 1 \\
1 + \mu \rho & x = 1, y = 0 \\
1 - \rho & x = 1, y = 1 \\
1 & \text{otherwise}
\end{cases}$$

*(Live correlation coefficient calibrated at $\rho = -0.10$)*

### 2. In-Game Pressure (IGP) Index
Continuously computed for Home and Away sides on a rolling $[0, 100]$ scale:

$$IGP_{team} = w_{poss} \cdot \Phi_{poss} + w_{sot} \cdot SOT_{10m} + w_{box} \cdot S_{box, 10m} + w_{crn} \cdot Corners_{10m} + w_{da} \cdot DA_{10m}$$

### 3. Game-State Exponential Decay
When a team achieves a commanding lead ($\Delta_{score} \ge 2$ at $t \ge 58'$ or $\Delta_{score} \ge 3$), residual offensive rates undergo exponential decay:

$$\gamma_{state} = 0.35 \cdot \exp\left(-0.038 \cdot \max(0, t - 55)\right)$$

This accurately mirrors empirical football tactical realities where leading teams switch to low-tempo possession control and trailing teams experience tactical disorganization.

### 4. 5-Pillar Conviction Index
Every prospective trading selection is rated against five distinct pillars:

$$C_{score} = 0.28 \cdot \text{Edge}_{hybrid} + 0.22 \cdot \text{Momentum}_{rel} + 0.20 \cdot Q_{chance} + 0.18 \cdot S_{tactical} + 0.12 \cdot \Delta_{steam}$$

---

## 🔄 Real-World Trading Workflow

A typical analytical session in PulseBet Studio follows a structured four-phase lifecycle:

```
[ Phase 1: Ingestion ] ➔ [ Phase 2: Pressure Scan ] ➔ [ Phase 3: Signal Trigger ] ➔ [ Phase 4: Settlement ]
   Multi-feed scrape         Rolling 10m telemetry       Dixon-Coles fair odds        Mid-match strike / loss
   State reconciliation      Momentum Radar (IGP)        Conviction filter (A+/A)     VAR rollback protection
```

1. **Pre-Match & Early Phase (00' - 15'):** Feeds connect, team entities reconcile, and pre-match market baselines are established.
2. **Dynamic Live Tracking (15' - 75'):** Rolling pressure windows activate. The engine continuously detects shot surges, corner sequences, and sustained box penetration.
3. **Signal Issuance:** When momentum divergence, positive expected value (+EV), and conviction metrics align ($C_{score} \ge 74$), a visual card and a distinct acoustic chime fire through the terminal.
4. **Mid-Game Resolution:** If the selected line hits, the signal immediately transitions to **WON** in the live ledger. If VAR cancels the goal, the ledger rolls back instantly to **IN-PLAY**.

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

The user interface is designed as an institutional **3-Column Bento Grid**:
- **Column 1 — Live Match Matrix:** Overview of all concurrent matches with real-time scorelines, match minutes, and momentum badges. Includes dynamic text search, favorite pinning, and quick-filter toggles.
- **Column 2 — Tactical Telemetry Inspector:** Deep analytical breakdown of the selected match. Displays the Momentum Radar™ bar, rolling 10-minute shot metrics, box touches, and fair outcome probabilities derived from the Dixon-Coles model.
- **Column 3 — Quantitative Value Signals:** Live real-time stream of algorithmic betting signals graded by conviction tier ([A+], [A], [B+]), paired with entry odds, true fair price, mathematical edge %, and mid-game settlement ledger.

---

## ⚡ Performance Benchmarks

PulseBet Studio is built from the ground up for lightweight, high-performance operation:

| Metric | Measured Value | Architecture Note |
|:---|:---|:---|
| **Memory Footprint** | `< 45 MB RAM` | Single Node.js runtime process; zero heavy frameworks |
| **Startup Time** | `< 450 ms` | Fast startup via `start.bat` or `npm start` |
| **Telemetry Event Latency** | `< 250 ms` | Sub-second native bi-directional WebSocket push |
| **Client Bundle Size** | `0 KB (Zero Bundler)` | Vanilla ES6 and native CSS3; zero npm build step required |
| **Acoustic Alert Engine** | `< 1 ms latency` | Web Audio API procedural synthesis; zero audio files |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js:** v18.0.0 or higher ([Download Node.js](https://nodejs.org/))
- **Operating System:** Windows, macOS, or Linux

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/menostayit-ui/pulsebet-studio.git
cd pulsebet-studio

# 2. Install dependencies (single native WebSocket package)
npm install

# 3. Start the application
# Windows (Double-click or run):
start.bat

# Linux / macOS / Manual:
npm start
```

### Accessing the Terminal
Open your web browser and navigate to:
```
http://127.0.0.1:3850
```

### Stopping the Terminal
- **Windows:** Double-click `stop.bat`
- **Linux / macOS:** Press `Ctrl + C` in the running terminal

---

## 🌐 Internationalization (i18n)

PulseBet Studio provides complete native bilingual support:

| Language | Terminology Scope | Target User Base |
|:---|:---|:---|
| **English (`EN`)** | Professional quantitative betting, market terms, and probability metrics | International sports quants, algorithmic traders, sharp bettors |
| **Turkish (`TR`)** | Authentic Turkish football nomenclature and in-play market terminology | Turkish sports betting community, local match analysts |

Language preferences can be toggled instantaneously with zero page reloads via the topbar `TR / EN` pill or inside the Preferences popover. Settings persist automatically across browser sessions in `localStorage`.

---

## 🔒 Security & Localhost Isolation

PulseBet Studio is engineered with a strict local-first philosophy:

- **Loopback-Only Interface:** The server binds strictly to `127.0.0.1:3850`. It does not broadcast on local networks (LAN / Wi-Fi) or open any external ports.
- **Zero Cloud Logging:** User interactions, bets, notes, and preferences remain 100% on your local machine.
- **Hardened Content Security Policy (CSP):** Disallows third-party scripts, external trackers, inline evaluations, and frame embedding (`frame-ancestors: 'none'`).

---

## 🗺️ Roadmap & Community

PulseBet Studio is an actively maintained open-source project. We welcome developers, sports analysts, and quantitative modelers to participate in our ongoing technical roadmap:

- [x] Multi-source live telemetry fusion (Flashscore + 365Scores + ESPN)
- [x] Rolling In-Game Pressure (IGP) Momentum Radar™
- [x] Dixon-Coles Poisson in-play probability engine
- [x] Mid-game instant settlement with self-healing VAR rollback
- [x] 2026 Neo-Minimalist Bento Grid UI with Web Audio chimes
- [x] Native bilingual (EN / TR) internationalization
- [ ] In-play corner lines and Asian handicap Poisson extensions
- [ ] Telegram Bot webhook integration for headless alert dispatching
- [ ] Historical match replay harness for quantitative backtesting
- [ ] Multi-match audio queuing with priority-weighted sound alerts

### Contributing
Contributions, issue reports, and model improvements are warmly welcomed!

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/QuantImprovement`)
3. **Commit** your changes (`git commit -m 'feat: Add Poisson corner variance model'`)
4. **Push** to the branch (`git push origin feature/QuantImprovement`)
5. **Open** a Pull Request

---

## ⭐ Support the Project

If PulseBet Studio provides value to your sports analytics, quantitative research, or in-play trading workflows, **please consider starring the repository ⭐ on GitHub**.

Your star helps increase project visibility within the open-source sports analytics community and supports continued maintenance, regular bug fixes, and algorithmic enhancements.

---

## ⚖️ Educational & Research Disclaimer

> **Notice:** PulseBet Studio is developed strictly for **educational, non-commercial, and data science research purposes**.
> 
> This software is not affiliated with, maintained by, authorized, or endorsed by Flashscore, 365Scores, ESPN, or any of their affiliates or subsidiaries. All product and company names are trademarks™ or registered® trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them.
> 
> Sports betting involves substantial financial risk. The probabilistic models, signals, and statistics provided by PulseBet Studio are for analytical exploration only and do not constitute financial or gambling advice. Users are solely responsible for their decisions and compliance with their local laws.

---

## 📜 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for complete terms.
