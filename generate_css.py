import re

css_content = """
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

:root, [data-theme="dark"] {
  --bg-base: #000000;
  --bg-surface: #0a0a0a;
  --bg-card: #111111;
  --bg-card-hover: #171717;
  --bg-elevated: #1a1a1a;
  --bg-elevated-hover: #222222;
  --bg-glass: rgba(0, 0, 0, 0.7);

  --border-subtle: #222222;
  --border-light: #333333;
  --border-strong: #444444;
  --border-focus: #ffffff;

  --brand: #ffffff;
  --brand-bright: #ffffff;
  --brand-soft: #222222;

  --emerald: #ffffff;
  --emerald-bright: #ffffff;
  --emerald-soft: #222222;

  --cyan: #ffffff;
  --cyan-bright: #ffffff;

  --rose: #ffffff;
  --rose-bright: #ffffff;
  --rose-soft: #222222;

  --amber: #ffffff;
  --amber-bright: #ffffff;
  --amber-soft: #222222;

  --blue: #ffffff;
  --blue-soft: #222222;

  --text-primary: #ffffff;
  --text-secondary: #a0a0a0;
  --text-muted: #666666;
  --text-inverse: #000000;

  --shadow-xs: none;
  --shadow-sm: none;
  --shadow-md: none;
  --shadow-luxury: none;
}

[data-theme="light"] {
  --bg-base: #f7f7f7;
  --bg-surface: #ffffff;
  --bg-card: #ffffff;
  --bg-card-hover: #f0f0f0;
  --bg-elevated: #f4f4f4;
  --bg-elevated-hover: #e5e5e5;
  --bg-glass: rgba(255, 255, 255, 0.8);

  --border-subtle: #eaeaea;
  --border-light: #dddddd;
  --border-strong: #cccccc;
  --border-focus: #000000;

  --brand: #000000;
  --brand-bright: #000000;
  --brand-soft: #e5e5e5;

  --emerald: #000000;
  --emerald-bright: #000000;
  --emerald-soft: #e5e5e5;

  --cyan: #000000;
  --cyan-bright: #000000;

  --rose: #000000;
  --rose-bright: #000000;
  --rose-soft: #e5e5e5;

  --amber: #000000;
  --amber-bright: #000000;
  --amber-soft: #e5e5e5;

  --blue: #000000;
  --blue-soft: #e5e5e5;

  --text-primary: #000000;
  --text-secondary: #666666;
  --text-muted: #999999;
  --text-inverse: #ffffff;

  --shadow-xs: none;
  --shadow-sm: none;
  --shadow-md: none;
  --shadow-luxury: none;
}

:root {
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-xl: 32px;
  --radius-pill: 9999px;
  --transition-fast: 0.2s ease;
  --transition-smooth: 0.3s ease;
  --transition-spring: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.15);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 14px; height: 100%; -webkit-font-smoothing: antialiased; }
body {
  background-color: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-sans);
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-weight: 400;
}
.hidden { display: none !important; }

/* Scrollbars */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border-light); border-radius: var(--radius-pill); }

/* TOPBAR */
.topbar {
  height: 70px;
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  z-index: 50;
  border-bottom: 1px solid var(--border-subtle);
}
.brand { display: flex; align-items: center; gap: 12px; cursor: pointer; }
.brand-logo {
  width: 32px; height: 32px; border-radius: 50%; background: var(--text-primary);
  color: var(--bg-base); display: flex; align-items: center; justify-content: center; position: relative;
}
.brand-pulse {
  position: absolute; top: 0; right: 0; width: 8px; height: 8px; border-radius: 50%;
  background: var(--bg-base); border: 2px solid var(--text-primary);
}
.brand-titles h1 { font-size: 16px; font-weight: 600; letter-spacing: -0.02em; }
.brand-titles span { font-weight: 400; color: var(--text-secondary); }
.brand-titles p { display: none; }

.main-view-switcher {
  display: flex; gap: 8px; background: var(--bg-card); padding: 6px; border-radius: var(--radius-pill);
}
.view-tab {
  background: transparent; border: none; color: var(--text-secondary); font-size: 13px; font-weight: 500;
  padding: 8px 16px; border-radius: var(--radius-pill); cursor: pointer; display: flex; align-items: center; gap: 8px;
  transition: var(--transition-fast);
}
.view-tab:hover { color: var(--text-primary); }
.view-tab.active { background: var(--text-primary); color: var(--bg-base); }
.vt-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: var(--radius-pill); background: var(--bg-elevated); color: var(--text-primary); }
.view-tab.active .vt-badge { background: var(--bg-base); color: var(--text-primary); }

.topbar-actions { display: flex; align-items: center; gap: 12px; }
.source-pill {
  display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: var(--radius-pill);
  background: var(--bg-card); font-size: 12px; color: var(--text-secondary);
}
.source-pill .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); }
.source-pill.online .dot { background: var(--text-primary); }

.action-chip {
  background: var(--bg-card); border: none; color: var(--text-primary); padding: 8px 16px;
  border-radius: var(--radius-pill); font-size: 13px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 8px;
}
.action-chip:hover { background: var(--bg-elevated); }
.action-chip.icon-only { padding: 8px; border-radius: 50%; }

/* POP-OVERS */
.quick-settings-popover {
  position: absolute; top: calc(100% + 12px); right: 0; width: 280px; background: var(--bg-surface);
  border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 16px; z-index: 100;
  box-shadow: 0 20px 40px rgba(0,0,0,0.1);
}
.qsp-header { font-size: 11px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 12px; font-weight: 600; letter-spacing: 0.05em; }
.qsp-section { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.qsp-section:last-child { margin-bottom: 0; }
.qsp-section-title { font-size: 11px; color: var(--text-muted); margin-bottom: 4px; }
.qsp-item-btn {
  width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--bg-card);
  border: none; border-radius: var(--radius-sm); color: var(--text-secondary); font-size: 13px; cursor: pointer; text-align: left;
}
.qsp-item-btn:hover { background: var(--bg-elevated); color: var(--text-primary); }
.qsp-item-btn.active { background: var(--text-primary); color: var(--bg-base); }

/* WORKSPACE LAYOUT */
.workspace {
  display: grid; grid-template-columns: 320px 1fr 380px; height: calc(100vh - 70px);
  transition: grid-template-columns var(--transition-smooth);
}
.workspace.left-collapsed { grid-template-columns: 0px 1fr 380px; }
.workspace.right-collapsed { grid-template-columns: 320px 1fr 0px; }
.workspace.left-collapsed.right-collapsed { grid-template-columns: 0px 1fr 0px; }

/* SIDEBAR MATCHES */
.sidebar-matches {
  background: var(--bg-base); border-right: 1px solid var(--border-subtle); display: flex; flex-direction: column; overflow: hidden;
}
.sidebar-header { padding: 24px; border-bottom: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 16px; }
.filter-tabs { display: flex; gap: 8px; }
.filter-tab {
  flex: 1; background: var(--bg-card); border: none; padding: 8px; border-radius: var(--radius-sm); color: var(--text-secondary);
  font-size: 12px; cursor: pointer; text-align: center;
}
.filter-tab.active { background: var(--text-primary); color: var(--bg-base); }
.sidebar-search-box {
  display: flex; align-items: center; gap: 12px; background: var(--bg-card); padding: 12px 16px; border-radius: var(--radius-sm);
}
.sidebar-search-box input { background: transparent; border: none; outline: none; color: var(--text-primary); width: 100%; font-size: 14px; }
.league-picker-trigger {
  width: 100%; background: var(--bg-card); border: none; padding: 12px 16px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: space-between; cursor: pointer; color: var(--text-primary);
}

.match-list { flex: 1; overflow-y: auto; padding: 16px 24px; display: flex; flex-direction: column; gap: 12px; }
.match-item {
  background: var(--bg-surface); padding: 16px; border-radius: var(--radius-md); cursor: pointer; border: 1px solid transparent;
}
.match-item:hover { background: var(--bg-card-hover); }
.match-item.selected { border-color: var(--text-primary); }
.mi-top { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
.mi-teams { display: flex; flex-direction: column; gap: 8px; }
.mi-team-row { display: flex; align-items: center; justify-content: space-between; font-size: 14px; font-weight: 500; }
.team-logo-xs { width: 24px; height: 24px; border-radius: 50%; background: var(--bg-elevated); margin-right: 12px; }
.mi-score { font-family: var(--font-mono); font-weight: 600; }
.mi-footer { margin-top: 12px; font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between; }

/* MATCH STUDIO */
.match-studio { padding: 40px; display: flex; flex-direction: column; gap: 32px; overflow-y: auto; }
.hero-card {
  background: var(--bg-surface); padding: 40px; border-radius: var(--radius-lg); display: flex; flex-direction: column; gap: 24px;
}
.hero-top { display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 500; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
.hero-scoreboard { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 40px; }
.hero-team { display: flex; align-items: center; gap: 24px; }
.hero-team.away { flex-direction: row-reverse; text-align: right; }
.team-crest-lg { width: 80px; height: 80px; border-radius: 50%; background: var(--bg-card); display: flex; align-items: center; justify-content: center; overflow: hidden; }
.team-crest-lg img { width: 60%; height: 60%; object-fit: contain; }
.team-info h2 { font-size: 24px; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 8px; }
.xg-badge { font-size: 12px; color: var(--text-muted); }

.hero-center-score { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.score-display { font-size: 64px; font-weight: 300; font-family: var(--font-mono); letter-spacing: -0.05em; display: flex; align-items: center; gap: 16px; }
.minute-badge { font-size: 13px; font-weight: 500; padding: 6px 16px; border-radius: var(--radius-pill); background: var(--bg-card); color: var(--text-primary); }

.studio-nav-bar {
  display: flex; justify-content: center; gap: 12px; background: transparent;
}
.snav-tab {
  background: transparent; border: none; font-size: 14px; font-weight: 500; color: var(--text-secondary); padding: 12px 24px; cursor: pointer; border-radius: var(--radius-pill);
}
.snav-tab.active { background: var(--text-primary); color: var(--bg-base); }

/* BENTO OVERVIEW */
.studio-tab-pane { display: flex; flex-direction: column; gap: 24px; }
.overview-bento-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.section-block { background: var(--bg-surface); padding: 32px; border-radius: var(--radius-lg); display: flex; flex-direction: column; gap: 20px; }
.section-head h3 { font-size: 16px; font-weight: 600; }
.section-head p { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

/* NOTIFICATIONS COLUMN */
.notifications-column { background: var(--bg-base); border-left: 1px solid var(--border-subtle); display: flex; flex-direction: column; overflow: hidden; }
.notif-segmented-header { padding: 24px; border-bottom: 1px solid var(--border-subtle); }
.notif-segment-tabs { display: flex; gap: 8px; background: var(--bg-card); padding: 6px; border-radius: var(--radius-pill); }
.nseg-tab { flex: 1; background: transparent; border: none; padding: 8px; font-size: 12px; color: var(--text-secondary); border-radius: var(--radius-pill); cursor: pointer; }
.nseg-tab.active { background: var(--text-primary); color: var(--bg-base); }

.notif-panel { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.notif-panel-header { padding: 24px; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; }
.notif-stream { padding: 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }

.notif-card { background: var(--bg-surface); padding: 20px; border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 12px; cursor: pointer; }
.notif-card:hover { background: var(--bg-card-hover); }
.nc-top { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted); }
.nc-teams { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.nc-signal-box { background: var(--bg-card); padding: 12px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; }

/* OTHER UTILS */
.flow-reader-bar { background: var(--bg-surface); padding: 32px; border-radius: var(--radius-lg); display: flex; flex-direction: column; gap: 16px; }
.pressure-meter { height: 4px; background: var(--bg-card); border-radius: var(--radius-pill); display: flex; }
.pm-fill-home, .pm-fill-away { height: 100%; }
.pm-fill-home { background: var(--text-primary); }
.pm-fill-away { background: var(--text-secondary); }

.markets-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.market-card { background: var(--bg-surface); padding: 24px; border-radius: var(--radius-lg); }
.mc-bento-opt { display: flex; justify-content: space-between; padding: 12px 16px; background: var(--bg-card); border-radius: var(--radius-sm); margin-top: 8px; font-size: 13px; cursor: pointer; }
.mc-bento-opt:hover { background: var(--bg-elevated); }

.stat-matrix-row { display: grid; grid-template-columns: 40px 1fr 120px 1fr 40px; align-items: center; gap: 16px; font-size: 13px; margin-bottom: 12px; }
.smr-val { font-family: var(--font-mono); text-align: center; }
.smr-bar-track { height: 4px; background: var(--bg-card); border-radius: var(--radius-pill); display: flex; }
.smr-bar { height: 100%; background: var(--text-primary); }
.smr-bar-track.home { justify-content: flex-end; }
.smr-bar-track.away { justify-content: flex-start; }
.smr-metric-name { text-align: center; font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

.floating-edge-trigger { display: none; }

.bento-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 24px; }
.bento-match-card { background: var(--bg-surface); padding: 24px; border-radius: var(--radius-lg); }

.toast-stack { position: fixed; bottom: 32px; right: 32px; display: flex; flex-direction: column; gap: 16px; z-index: 1000; }
.toast-item { background: var(--text-primary); color: var(--bg-base); padding: 16px 24px; border-radius: var(--radius-pill); font-size: 14px; font-weight: 500; }

.empty-state-card { text-align: center; padding: 64px 32px; color: var(--text-muted); }
.empty-state-card h4 { font-size: 18px; color: var(--text-primary); margin-bottom: 8px; font-weight: 500; }

"""

with open("src/public/css/styles.css", "w") as f:
    f.write(css_content)
