# Contributing to PulseBet Studio

Thank you for your interest in contributing to **PulseBet Studio**! We welcome quantitative researchers, sports data analysts, mathematical modelers, and JavaScript developers.

---

## Code of Conduct

By participating in this project, you agree to maintain a respectful, welcoming, and harassment-free community environment.

---

## Development Setup

1. Fork the repository on GitHub.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/pulsebet-studio.git
   cd pulsebet-studio
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Verify syntax integrity:
   ```bash
   node --check src/server.js
   ```
5. Launch the development server:
   ```bash
   npm start
   ```

---

## Architectural Principles

1. **Zero External Frontend Dependencies:**
   - Keep the frontend in Vanilla ES6 and modern CSS3.
   - Do not introduce bulky UI frameworks (React, Vue, Angular) or client bundlers unless strictly agreed upon through an RFC issue.
2. **Local-First & Privacy First:**
   - The terminal must always bind to `127.0.0.1` by default.
   - No external user telemetry or cloud tracking.
3. **Mathematical Rigor:**
   - Any new predictive or momentum algorithms should be grounded in empirical probability (e.g. Poisson, Dixon-Coles, xG metrics, Kelly criterion).
   - Document any statistical variables and expected value calculations in code docstrings.

---

## Submitting Pull Requests

1. Create a descriptive feature branch:
   ```bash
   git checkout -b feat/corner-poisson-model
   ```
2. Write clean, readable code with descriptive comments.
3. Ensure no personal credentials or API secrets are committed.
4. Push your branch and open a Pull Request with a clear summary of your changes and test findings.

Thank you for helping push sports analytics forward!
