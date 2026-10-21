# PulseBet Studio

> **High-Performance Real-Time Football Telemetry, In-Play Momentum Radar & Quantitative Value Betting Terminal**

[![Node.js](https://img.shields.io/badge/Node.js-18.x%20%7C%2020.x%20%7C%2022.x-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![WebSocket](https://img.shields.io/badge/WebSocket-Native%20Bi--directional-010101?style=flat-square&logo=socketdotio)](https://github.com/websockets/ws)
[![UI Architecture](https://img.shields.io/badge/UI-Vanilla%20ES6%20%2B%20CSS3-F7DF1E?style=flat-square&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Bilingual](https://img.shields.io/badge/i18n-English%20%7C%20T%C3%BCrk%C3%A7e-6366f1?style=flat-square)](#internationalization-i18n)

---

## 1. Overview

**PulseBet Studio** is an ultra-fast, local-first in-play football intelligence terminal engineered for sports bettors, quantitative traders, and tactical match analysts. 

It synthesizes real-time match telemetry across multiple decentralized data feeds (Flashscore, 365Scores, and ESPN) without requiring external commercial API keys. Powered by a calibrated **Dixon-Coles bivariate Poisson model**, an **In-Game Momentum & Pressure Index (IGP)**, and an automated **5-Pillar Conviction Engine**, PulseBet Studio detects statistical anomalies, calculates true fair odds, and triggers high-conviction live value signals while systematically suppressing false-positive traps.

---

## 2. Key Features

- **Multi-Source Telemetry Fusion:** Simultaneous zero-key data ingestion from Flashscore (rapid spine), 365Scores (deep event timelines), and ESPN (box score statistics and shot maps).
- **In-Game Pressure & Momentum Radar:** Evaluates rolling 5-minute and 10-minute shot velocities, final-third entries, box touches, and territory control ($IGP \in [0, 100]$).
- **Calibrated Dixon-Coles Poisson Engine:** Dynamically calculates true in-play probabilities for Match Result (1X2), Both Teams To Score (BTTS), Full-Time Over/Under, First-Half lines, and Next Goal.
- **xG Debt Regression Model:** Identifies teams generating substantial expected goals ($xG \ge 0.88$) without conversion, triggering targeted mean-reversion goal alerts.
- **Quantitative Value Signal Hunter:** Emits strictly filtered value bets graded by Conviction Score:
  - **Tier A+ (Elite Signal):** Conviction $\ge 82$, Value Edge $+6.5\%$ to $+28.0\%$.
  - **Tier A (Strong Signal):** Conviction $\ge 76$, Value Edge $\ge +4.5\%$.
  - **Tier B+ (Value Signal):** Conviction $\ge 74$, Value Edge $\ge +4.2\%$.
- **Discipline & Blowout Filters:**
  - **Blowout Guard:** Automatically halts signal generation when score margin $\ge 3$ or late game cruise control is detected (`Rölanti`).
  - **1-1 Draw Guard:** Strictly prohibits high-variance lines (e.g. Over 3.5 is forbidden when 1-1; only single-goal Over 2.5 is permitted).
  - **Red Card Asymmetry:** Imposes a penalty parameter ($\rho = 0.55$) on the penalized side and provides a $+32\%$ boost to the advantaged team.
- **Automated Settlement & Self-Healing VAR Rollback:** Signals settle immediately mid-game as **WON** (target line exceeded) or **LOST** (time-expired / opposing team scored). If a goal is overturned by VAR, the ledger automatically rolls back the settlement state to **IN-PLAY**.
- **2026 Neo-Minimalist Interface:** Designed with Apple Sports and Linear design aesthetics. Includes Deep Obsidian Velvet dark mode, Scandinavian Porcelain light mode, tabular monospace scoreboards, zero raw OS emojis, and full bilingual support (English & Turkish).

---

## 3. Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │               Multi-Source Orchestrator                │
                    │   (Flashscore Core + 365Scores + ESPN Boxscore Fusion) │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    State & Momentum Core                                      │
├──────────────────────────────┬────────────────────────────────┬───────────────────────────────┤
│       MatchStateStore        │       StateDiffEngine          │      MatchMomentumEngine      │
│  (In-Memory Match State)     │   (Event Diff & Incident Bus)  │ (IGP Pressure & Flow Scanner) │
└──────────────────────────────┴────────────────────────────────┴───────────────────────────────┘
                                                │
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Quantitative Analytics Engine                                 │
├──────────────────────────────┬────────────────────────────────┬───────────────────────────────┤
│      QuantSignalEngine       │     SignalSettlementEngine     │      PlayerImpactEngine       │
│ (Dixon-Coles + 5 Pillars)    │   (Live Ledger & Hit Rate %)   │    (Threat Index & xA/xG)     │
└──────────────────────────────┴────────────────────────────────┴───────────────────────────────┘
                                                │
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                         Local HTTP & WebSocket Broadcast Server                               │
│                         (Bound strictly to 127.0.0.1:3850)                                    │
└───────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                │
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  Client Front-End (Web)                                       │
│   • Vanilla ES6 Architecture                 • Real-Time WebSocket Channel                    │
│   • Bilingual i18n Engine (EN / TR)          • Web Audio API Synthesizer                      │
│   • 3-Column Responsive Bento Grid           • Content Security Policy Hardened               │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Mathematical Methodology

### 4.1. Dixon-Coles Bivariate Poisson In-Play Formulation
Independent Poisson models underestimate the occurrence of low-score draws ($0-0, 1-1$) and low-margin outcomes. PulseBet Studio applies the **Dixon-Coles correlation factor** ($\tau_{DC}$):

$$P(X = x, Y = y) = \tau_{\lambda, \mu}(x, y) \cdot \frac{\lambda^x e^{-\lambda}}{x!} \cdot \frac{\mu^y e^{-\mu}}{y!}$$

Where:
$$\tau_{\lambda, \mu}(x, y) = \begin{cases} 
1 - \lambda \mu \rho & x = 0, y = 0 \\
1 + \lambda \rho & x = 0, y = 1 \\
1 + \mu \rho & x = 1, y = 0 \\
1 - \rho & x = 1, y = 1 \\
1 & \text{otherwise}
\end{cases}$$

*(Empirical live correlation parameter set to $\rho = -0.10$)*.

### 4.2. In-Game Pressure (IGP) Calculation
Momentum is evaluated continuously on a $0 - 100$ scale for each team:

$$IGP_{team} = w_1 \cdot \text{Possession} + w_2 \cdot SOT_{10m} + w_3 \cdot S_{box, 10m} + w_4 \cdot Corners_{10m} + w_5 \cdot \text{DangerAttacks}$$

### 4.3. Game-State Blowout Damping
When a team holds a comfortable lead ($\Delta_{score} \ge 2$ at $t \ge 58'$ or $\Delta_{score} \ge 3$), residual goal expectation undergoes exponential state-decay:

$$\gamma_{state} = 0.35 \cdot \exp\left(-0.038 \cdot \max(0, t - 55)\right)$$

This dampens residual offensive expectations, matching real-world game management behavior where leading teams control tempo and trailing teams suffer organization collapse.

### 4.4. 5-Pillar Conviction Score Formula
Each potential selection is evaluated across 5 weighted dimensions:

$$C_{score} = 0.28 \cdot \text{Edge}_{hybrid} + 0.22 \cdot \text{Momentum}_{rel} + 0.20 \cdot Q_{chance} + 0.18 \cdot S_{tactical} + 0.12 \cdot \Delta_{steam}$$

---

## 5. Directory Structure

```
pulsebet-pro/
├── data/                       # Local session state and server logs
├── src/
│   ├── engine/
│   │   ├── MatchMomentumEngine.js     # Rolling 5m/10m pressure & tactical archetypes
│   │   ├── MatchStateStore.js         # Canonical match state repository & ledger
│   │   ├── PlayerImpactEngine.js      # Lineup analysis, Threat Index & creator stats
│   │   ├── QuantSignalEngine.js       # Dixon-Coles Poisson & 5-pillar conviction
│   │   ├── SignalSettlementEngine.js  # Real-time bet settlement & VAR rollback
│   │   └── StateDiffEngine.js         # Millisecond state difference event detector
│   ├── public/
│   │   ├── css/
│   │   │   └── styles.css             # 2026 neo-minimalist dark & light stylesheets
│   │   ├── js/
│   │   │   ├── app.js                 # Terminal UI controller & WebSocket dispatcher
│   │   │   ├── i18n.js                # Bilingual (EN / TR) translation dictionary
│   │   │   └── soundEngine.js         # Web Audio API procedural sound synthesizer
│   │   └── index.html                 # Main single-page application interface
│   ├── scrapers/
│   │   ├── EspnScraper.js             # ESPN boxscore & shotmap feed parser
│   │   ├── FlashscoreScraper.js       # High-frequency Flashscore telemetry feed
│   │   ├── MultiSourceOrchestrator.js # Master poller, deduplicator & deep enricher
│   │   ├── Scores365Scraper.js        # 365Scores event timeline & incident parser
│   │   └── TeamNameMatcher.js         # Cross-source fuzzy entity reconciliation
│   └── server.js                      # High-speed local HTTP & WebSocket server
├── .gitignore                         # Git exclusion rules
├── LICENSE                            # MIT License
├── package.json                       # Project metadata & ws dependency
├── README.md                          # Technical documentation
├── start.bat                          # One-click Windows launch script
└── stop.bat                           # Clean server shutdown script
```

---

## 6. Getting Started

### Prerequisites
- **Node.js**: Version 18.0.0 or higher ([Download Node.js](https://nodejs.org/))
- **Operating System**: Windows, macOS, or Linux

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/pulsebet-studio.git
   cd pulsebet-studio
   ```

2. **Install dependencies:**
   *(Zero heavy frameworks required; only the ultra-fast native WebSocket engine)*
   ```bash
   npm install
   ```

3. **Start the server:**
   - **On Windows (Double-click or run):**
     ```cmd
     start.bat
     ```
   - **Via Command Line (Any OS):**
     ```bash
     npm start
     ```

4. **Access the Terminal:**
   Open your browser and navigate to:
   ```
   http://127.0.0.1:3850
   ```

5. **Stop the server:**
   - **On Windows:** Double-click `stop.bat`
   - **Via Command Line:** Press `Ctrl + C` in the running terminal

---

## 7. Internationalization (i18n)

PulseBet Studio includes built-in, instantaneous language toggling:
- **English (`EN`):** Native international sports betting and quantitative trading terminology.
- **Turkish (`TR`):** Comprehensive Turkish football terminology.

Language preference is persisted automatically in `localStorage`. Toggle dynamically via the topbar `TR / EN` pill or inside the **Preferences** popover without requiring a page reload.

---

## 8. Security & Localhost Isolation

- **Loopback Enforcement:** By default, the server binds strictly to `127.0.0.1`. It does not broadcast on local area networks (LAN / Wi-Fi) or external IP interfaces.
- **Strict Content Security Policy (CSP):** Blocks unauthorized inline scripts, third-party trackers, and cross-site framing (`frame-ancestors: 'none'`).
- **Path Traversal Protection:** Internal static file resolver validates relative path resolutions within `src/public`.
- **WebSocket Rate-Limiting:** Client messaging is governed by sliding token-bucket rate limiters.

---

## 9. Contributing

Contributions, bug reports, and feature requests are welcome!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 10. License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.
