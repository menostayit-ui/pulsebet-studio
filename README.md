<div align="center">

```
 ____        _          ____       _     ____  _             _ _       
|  _ \ _   _| |___  ___| __ )  ___| |_  / ___|| |_ _   _  __| (_) ___  
| |_) | | | | / __|/ _ \  _ \ / _ \ __| \___ \| __| | | |/ _` | |/ _ \ 
|  __/| |_| | \__ \  __/ |_) |  __/ |_   ___) | |_| |_| | (_| | | (_) |
|_|    \__,_|_|___/\___|____/ \___|\__| |____/ \__|\__,_|\__,_|_|\___/ 
```

# PulseBet Studio

### High-Performance Real-Time Football Telemetry, In-Play Momentum Radar & Quantitative Value Betting Terminal

[![GitHub stars](https://img.shields.io/github/stars/menostayit-ui/pulsebet-studio?style=for-the-badge&logo=github&color=ffb703)](https://github.com/menostayit-ui/pulsebet-studio/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/menostayit-ui/pulsebet-studio?style=for-the-badge&logo=github&color=219ebc)](https://github.com/menostayit-ui/pulsebet-studio/network/members)
[![GitHub issues](https://img.shields.io/github/issues/menostayit-ui/pulsebet-studio?style=for-the-badge&logo=github&color=8ecae6)](https://github.com/menostayit-ui/pulsebet-studio/issues)
[![License: MIT](https://img.shields.io/badge/License-MIT-023047?style=for-the-badge&logo=opensourceinitiative)](LICENSE)

[![Node.js](https://img.shields.io/badge/Node.js-18.x%20%7C%2020.x%20%7C%2022.x-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![WebSocket](https://img.shields.io/badge/WebSocket-Native%20Low--Latency-010101?style=flat-square&logo=socketdotio&logoColor=white)](https://github.com/websockets/ws)
[![Zero API Keys](https://img.shields.io/badge/API%20Keys-Zero%20Required%20(100%25%20Free)-success?style=flat-square&logo=checkmarx&logoColor=white)](#multi-source-telemetry-fusion)
[![UI Architecture](https://img.shields.io/badge/UI-Vanilla%20ES6%20%2B%20CSS3-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Bilingual](https://img.shields.io/badge/i18n-English%20%7C%20T%C3%BCrk%C3%A7e-6366f1?style=flat-square&logo=googletranslate&logoColor=white)](#bilingual-experience-en--tr)
[![Local First](https://img.shields.io/badge/Privacy-100%25%20Local%20(127.0.0.1)-orange?style=flat-square&logo=securityscorecard&logoColor=white)](#privacy--local-first-design)

<p align="center">
  <a href="#-key-features">Features</a> •
  <a href="#-quickstart-in-30-seconds">Quickstart</a> •
  <a href="#-why-pulsebet-studio">Why PulseBet?</a> •
  <a href="#-mathematical-methodology">Mathematics</a> •
  <a href="#-system-architecture">Architecture</a> •
  <a href="#-roadmap--star-milestones">Roadmap</a> •
  <a href="#-contributing">Contributing</a>
</p>

**If you find PulseBet Studio useful, please give us a ⭐️ on GitHub! It keeps us motivated to add new quantitative models and scrapers.**

</div>

---

## ⚡ The Challenge vs. The PulseBet Solution

Most live sports betting enthusiasts and quantitative analysts face three critical roadblocks:

| Conventional In-Play Betting & Commercial Software | The PulseBet Studio Quantitative Edge |
| :--- | :--- |
| **Expensive Monthly API Subscriptions:** $50 - $300/mo API fees just to access live football data feeds. | **100% Free & Zero-Key Ingestion:** Autonomous, multi-source telemetry pipeline scraping Flashscore, 365Scores, and ESPN in real time. |
| **Delayed & Stale Match Odds:** Bookmaker odds adjust 15-45 seconds before public live feeds catch up. | **Sub-Second Momentum Radar ($IGP$):** Detects surges in dangerous attacks, box touches, and high-turnover sequences before bookmakers react. |
| **Naive Heuristics & False-Positive Traps:** Generating "Over Goals" bets in 1-1 deadlocks or 4-0 cruise-control blowouts. | **Anti-Trap Guard & Dixon-Coles Poisson:** Strictly blocks high-variance lines at 1-1, applies exponential blowout decay, and calibrates low-score correlations. |
| **Bloated Frameworks & Heavy Memory:** Electron/React memory hogs that slow down live execution. | **Pure Vanilla ES6 & Native WebSockets:** Sub-millisecond render cycles, zero heavy npm bundles, and instant updates. |

---

## 🎯 Key Features

### 📡 Multi-Source Telemetry Fusion
- **Zero API Keys Required:** Native, resilient scraper pipeline combining **Flashscore** (sub-second spine and incidents), **365Scores** (deep event timelines and pitch visualizations), and **ESPN** (box score statistics and shot maps).
- **Fuzzy Entity Reconciliation:** Proprietary fuzzy matching engine that automatically aligns club names across international leagues and languages without collision.

### 🧠 Quantitative Signal Hunter & Dixon-Coles Engine
- **Calibrated Dixon-Coles Bivariate Poisson:** Dynamically models low-scoring draw dependencies ($\tau_{DC}$ correlation matrix) for live Match Result (1X2), Both Teams To Score (BTTS), Over/Under lines, and Next Goal markets.
- **xG Debt Regression Engine:** Identifies dominant teams with high expected goals ($xG \ge 0.88$) that have suffered unlucky finishing, predicting high-probability mean-reversion goals.
- **Strict 5-Pillar Conviction Scoring:** Every signal must clear weighted thresholds across Hybrid Value Edge, Relative Momentum, Chance Quality, Tactical Game State, and Market Steam before triggering an alert.
  - **Tier A+ (Elite Signal):** Conviction $\ge 82$, Value Edge $+6.5\%$ to $+28.0\%$.
  - **Tier A (Strong Signal):** Conviction $\ge 76$, Value Edge $\ge +4.5\%$.
  - **Tier B+ (Value Signal):** Conviction $\ge 74$, Value Edge $\ge +4.2\%$.

### 🛡️ Built-In Tactical Defense & Anti-Trap Filters
- **1-1 Draw Guard:** Strictly prohibits high-variance lines (e.g. Over 3.5 is forbidden when score is 1-1; only single-goal incremental Over 2.5 is permitted).
- **Blowout Cruise-Control Damping:** When a team leads by $\ge 2$ goals at $t \ge 58'$ or by $\ge 3$ goals at any point, residual goal expectation undergoes exponential state decay ($\gamma_{state}$), preventing sucker bets on de-escalated matches.
- **Red Card Asymmetry Model:** Dynamically imposes an immediate offense penalty parameter ($\rho = 0.55$) on the penalized team while boosting the counter-threat index of the advantaged side.
- **Self-Healing Settlement & VAR Rollback:** Settles signals in real-time as **WON** or **LOST**. If a goal is overturned by VAR, the ledger automatically performs a self-healing state rollback back to **IN-PLAY**.

### 🎨 2026 Neo-Minimalist Bento Grid UI
- **Linear & Apple Sports Aesthetics:** Clean, distraction-free interface featuring Deep Obsidian Velvet dark mode and Scandinavian Porcelain light mode.
- **Tabular Monospace Scoreboards:** High-readability typography with millisecond match-clock synchronizer.
- **Synthesized Web Audio Soundscape:** Soft, procedural Web Audio API alerts for goals, momentum surges, and Tier A+ alerts without noisy OS sound files.
- **Bilingual (EN / TR):** Complete native support for both English and Turkish sports trading terminology. Toggle between languages with a single click.

---

## 🚀 Quickstart in 30 Seconds

### Option A: Windows (One-Click Launch)
No terminal configuration required:
1. Clone or download this repository.
2. Double-click **`start.bat`**.
3. PulseBet Studio automatically verifies Node.js, installs dependencies if needed, starts the engine in the background, and opens `http://127.0.0.1:3850` in your default browser.
4. To shut down cleanly at any time, double-click **`stop.bat`**.

---

### Option B: macOS / Linux / Cross-Platform

Ensure you have [Node.js](https://nodejs.org/) (v18.0.0 or higher) installed.

```bash
# 1. Clone the repository
git clone https://github.com/menostayit-ui/pulsebet-studio.git

# 2. Enter the directory
cd pulsebet-studio

# 3. Install the lightweight WebSocket dependency
npm install

# 4. Start the terminal
npm start
```

Now open **`http://127.0.0.1:3850`** in your browser.

---

## 📐 Mathematical Methodology

### 1. Dixon-Coles Bivariate Poisson Formulation
Traditional Poisson models assume independence between home and away goal distributions. In reality, football displays strong dependence in low-scoring scenarios ($0-0, 1-1, 1-0, 0-1$). PulseBet Studio applies the calibrated **Dixon-Coles correlation factor** ($\tau_{DC}$):

$$P(X = x, Y = y) = \tau_{\lambda, \mu}(x, y) \cdot \frac{\lambda^x e^{-\lambda}}{x!} \cdot \frac{\mu^y e^{-\mu}}{y!}$$

Where the adjustment factor $\tau_{\lambda, \mu}(x, y)$ is defined as:

$$\tau_{\lambda, \mu}(x, y) = \begin{cases} 
1 - \lambda \mu \rho & x = 0, y = 0 \\
1 + \lambda \rho & x = 0, y = 1 \\
1 + \mu \rho & x = 1, y = 0 \\
1 - \rho & x = 1, y = 1 \\
1 & \text{otherwise}
\end{cases}$$

*(Live empirical correlation parameter calibrated to $\rho = -0.10$)*.

---

### 2. In-Game Pressure (IGP) Formulation
Momentum is calculated continuously on a dynamic $0 - 100$ scale for each team based on rolling 5-minute and 10-minute micro-telemetry:

$$IGP_{team} = w_{poss} \cdot \text{Possession} + w_{sot} \cdot SOT_{10m} + w_{box} \cdot S_{box, 10m} + w_{crn} \cdot Corners_{10m} + w_{att} \cdot \text{DangerAttacks}$$

When a team's $IGP$ sustains $> 75$ for 6 consecutive minutes while the opponent's defensive clearance index degrades, an **Imminent Pressure Surge** is registered.

---

### 3. Game-State Blowout Exponential Damping
When a team holds a comfortable lead ($\Delta_{score} \ge 2$ at $t \ge 58'$ or $\Delta_{score} \ge 3$ at any time), residual goal expectation undergoes state-decay to account for match control and tempo suppression:

$$\gamma_{state} = 0.35 \cdot \exp\left(-0.038 \cdot \max(0, t - 55)\right)$$

This mathematical damping factor prevents naive algorithms from recommending late-game Over lines on games that have tactically died down.

---

### 4. 5-Pillar Conviction Score Formula
Each prospective in-play signal must pass an integrated 5-pillar conviction evaluation:

$$C_{score} = 0.28 \cdot \text{Edge}_{hybrid} + 0.22 \cdot \text{Momentum}_{rel} + 0.20 \cdot Q_{chance} + 0.18 \cdot S_{tactical} + 0.12 \cdot \Delta_{steam}$$

Only selections reaching $C_{score} \ge 74$ are emitted to the live feed, ensuring unmatched signal purity and hit rates.

---

## 🏗️ System Architecture

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

## 🔒 Privacy & Local-First Design

PulseBet Studio is built from the ground up on the **Local-First Privacy Principle**:
- **Strict Loopback Binding:** The server listens **exclusively on `127.0.0.1:3850`**. It does not expose ports to your local area network (LAN) or the public internet.
- **No Third-Party Tracking:** Zero telemetry tracking, analytics beacons, or remote logging.
- **Your Data Remains Yours:** All match logs, signal histories, and user preferences remain stored locally in your project's `./data/` folder.

---

## 🗺️ Roadmap & Star Milestones

We are committed to building the ultimate open-source quantitative football terminal. Here is our community star roadmap:

- [x] **v1.0.0 — Genesis Release**
  - Multi-source scraper fusion (Flashscore, 365Scores, ESPN)
  - Dixon-Coles bivariate Poisson fair odds engine
  - 5-Pillar Conviction Signal Hunter (Tier A+, Tier A, Tier B+)
  - Blowout Guard & 1-1 Anti-Trap filters
  - 2026 Neo-Minimalist Bento Grid UI with instant EN/TR bilingual support
- [ ] **🌟 100 Stars: Automated Telegram & Discord Webhooks**
  - Instant mobile push alerts for Tier A+ signals via custom bot tokens.
- [ ] **🌟 250 Stars: Historical Backtesting Sandbox**
  - Replay historical matches to backtest custom Poisson parameters and threshold weights.
- [ ] **🌟 500 Stars: In-Play Corner & Booking Poisson Engine**
  - Quantitative models predicting late-game Asian Corner spikes and Card density.
- [ ] **🌟 1,000 Stars: Progressive Web App (PWA) & Mobile Dashboard**
  - Touch-optimized responsive interface with offline caching and background audio chimes.

---

## 📈 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=menostayit-ui/pulsebet-studio&type=Date)](https://star-history.com/#menostayit-ui/pulsebet-studio&Date)

---

## 🤝 Contributing

Contributions make the open-source community an inspiring place to learn, build, and innovate. Any contributions you make are **greatly appreciated**!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feat/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feat/AmazingFeature`)
5. Open a Pull Request

---

## ⚖️ License & Disclaimer

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

> [!CAUTION]
> **Responsible Sports Analytics Disclaimer:**  
> PulseBet Studio is an academic and quantitative analytical research tool intended strictly for match observation, mathematical modeling, and sports statistical analysis. It does not provide financial advice, guaranteed betting outcomes, or wagering services. Always practice responsible judgment and adhere to your local jurisdiction's laws.

<div align="center">
  <sub>Engineered with precision for football enthusiasts and quantitative analysts worldwide.</sub>
</div>
