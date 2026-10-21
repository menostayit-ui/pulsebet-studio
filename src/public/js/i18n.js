/**
 * PulseBet Studio — Bilingual Internationalization Engine (TR / EN)
 * Native sports analytics and quantitative trading terminology.
 */

(function (window) {
  'use strict';

  const translations = {
    tr: {
      // Topbar & Navigation
      app_title: 'PulseBet Studio',
      app_tagline: 'Kantitatif Canlı Futbol Terminali',
      nav_all_matches: 'Canlı Maçlar',
      nav_favorites: 'Favorilerim',
      nav_radar: 'Sinyal Radarı',
      search_placeholder: 'Takım, lig veya maç ara...',
      preferences: 'Tercihler',
      force_refresh: 'Verileri Zorla Yenile',

      // Quick Preferences Popover
      quick_settings_title: 'Hızlı Tercihler & Görünüm',
      sec_appearance_sound: 'Görsel & Ses',
      theme_light: 'Açık Tema',
      theme_dark: 'Koyu Tema',
      sound_notifications: 'Sesli Bildirimler',
      language_label: 'Dil / Language',
      sec_notif_filter: 'Bildirim Filtresi',
      starred_only: 'Yalnızca Favori Bildirimleri',
      sec_layout: 'Panel Görünümleri',
      layout_left: 'Sol Maç Listesi',
      layout_right: 'Sağ Bildirim Paneli',

      // Left Column: Match Lounge
      filter_all: 'Tümü',
      filter_live: 'Canlı',
      filter_scheduled: 'Yaklaşan',
      filter_signals: 'Sinyaller',
      btn_matches: 'Maçlar',
      btn_notifications: 'Bildirimler',
      collapse_left: 'Sol Paneli Daralt',
      collapse_right: 'Sağ Paneli Daralt',
      empty_match_list: 'Arama veya filtre kriterine uygun maç bulunamadı.',
      loading_matches: 'Canlı ve Yaklaşan Maçlar Yükleniyor',
      loading_matches_sub: 'Flashscore, 365Scores ve ESPN canlı veri hatları taranıyor...',
      league_all: 'Tüm Ligler',
      search_league_placeholder: 'Lig veya ülke filtrele...',

      // Studio Arena: Center Scoreboard & Tabs
      official_match: 'RESMİ MAÇ',
      league_not_selected: 'LİG SEÇİLMEDİ',
      tracking_flow: 'Gidişat İzleniyor',
      tempo_balanced: 'Dengeli Tempo',
      tempo_high: 'Yüksek Tempo',
      tempo_low: 'Düşük Tempo',
      tempo_frenzy: 'Yoğun Kuşatma Temposu',
      tempo_stalemate: 'Taktiksel Kilit',
      minute_live: 'CANLI',
      minute_ht: 'DEVRE ARASI',
      minute_ft: 'MAÇ SONU',
      action_star_add: '☆ Favoriye Ekle',
      action_star_remove: '★ Favoride',
      add_to_fav: 'Favoriye Ekle',
      in_fav: 'Favoride',
      team_home: 'Ev Sahibi',
      team_away: 'Deplasman',
      side_home: 'EV SAHİBİ',
      side_away: 'DEPLASMAN',
      red_cards_tag: 'Kırmızı',

      // Center Tabs
      tab_overview: 'Genel Bakış',
      tab_stats: 'İstatistikler',
      tab_signals: 'Sinyaller & Taktik',
      tab_markets: 'Marketler',
      tab_timeline: 'Akış & Kadro',

      // Momentum Radar
      radar_title: 'Canlı Saha Baskısı ve Momentum Radarı',
      home_pressure: 'Ev Baskı',
      away_pressure: 'Dep Baskı',
      radar_default_narrative: 'Sol listeden bir maç seçtiğinizde taktiksel gidişat, şut kalitesi ve dakika/skor psikolojisi burada özetlenir.',

      // Overview Bento
      overview_critical_metrics: 'Kritik Maç Metrikleri',
      overview_critical_metrics_sub: 'En belirleyici 4 canlı saha verisi',
      view_all_stats: 'Tüm 10 İstatistiği Aç →',
      featured_markets: 'Öne Çıkan Marketler',
      featured_markets_sub: 'MS, 2.5/3.5 Alt/Üst ve Sıradaki Gol canlı oranları',
      view_all_markets: 'Tüm 6 Marketi Aç →',

      // Evidence Matrix
      evidence_title: 'Taktiksel Gidişat Kanıt Matrisi',
      evidence_subtitle: 'Kantitatif sinyal modelini tetikleyen 4 boyutlu saha faktörleri',
      pos_quality: 'Pozisyon Kalitesi',
      match_tempo: 'Maç Temposu',
      def_resistance: 'Savunma Durumu',
      goal_expectation: 'Gol Beklentisi',
      badge_high: 'Yüksek',
      badge_medium: 'Orta',
      badge_low: 'Düşük',
      badge_balanced: 'Dengeli',
      badge_under_pressure: 'Baskı Altında',
      badge_struggling: 'Zorlanıyor',

      // Key Metrics & Official Stats Matrix
      stats_matrix_title: 'RESMİ İSTATİSTİK MATRİSİ',
      stats_matrix_subtitle: 'Canlı performans verileri ve iki yönlü saha etkinliği',
      metric_xg: 'Beklenen Gol (xG)',
      metric_possession: 'Topla Oynama',
      metric_total_shots: 'Toplam Şut',
      metric_shots_on_target: 'İsabetli Şut',
      metric_shots_off_target: 'İsabetsiz Şut',
      metric_shots_inside_box: 'Ceza Sahası İçi Şut',
      metric_corners: 'Korner',
      metric_fouls: 'Faul',
      metric_big_chances: 'Net Gol Pozisyonu',
      metric_goalkeeper_saves: 'Kaleci Kurtarışı',
      metric_yellow_cards: 'Sarı Kart',
      metric_red_cards: 'Kırmızı Kart',

      // 6 Core Markets
      markets_title: 'Market Beklentileri & Değerli Oran Fırsatları',
      markets_subtitle: 'Poisson & Dixon-Coles olasılıkları, değer oranları ve kilitlenen market durumları',
      market_ms: 'MS (Maç Sonucu)',
      market_btts: 'KG Var / Yok',
      market_ou: 'Alt / Üst',
      market_ht_btts: 'İY KG Var / Yok',
      market_ht_ou: 'İY Alt / Üst',
      market_next_goal: 'Sıradaki Gol',
      confidence: 'Güven',
      value_edge: 'Değer',
      odds: 'Oran',
      probability: 'Olasılık',
      settled_label: 'Gerçekleşti',
      locked_label: 'Kilitli',

      // Incidents & Lineups
      incidents_title: 'Maç Olay Akışı',
      incidents_subtitle: 'Gol, asist, kart ve VAR kararları',
      players_title: 'Öne Çıkan Oyuncular',
      players_subtitle: 'Hücum, oyun kurulumu ve savunma etkinliği',
      role_threat_leader: 'Hücum Lideri',
      role_playmaker: 'Oyun Kurucu & Asist',
      role_defensive_balance: 'Savunma Dengesi',
      empty_incidents: 'Bu maçta henüz gol, kart veya VAR olayı kaydedilmedi.',
      empty_incidents_scheduled: 'Maç henüz başlamadı.',
      no_incidents_recorded: 'Henüz kayıtlı maç olayı yok.',
      analyzing_players: 'Oyuncu verileri analiz ediliyor...',

      // Right Column: Notifications & Signals
      tab_signals_header: 'Sinyaller',
      tab_events_header: 'Maç Olayları',
      tab_both_header: 'İkili',
      signal_tracker_title: 'Sinyal Takibi',
      signal_tracker_subtitle: 'Tuttu / Tutmadı canlı takip',
      match_events_title: 'Maç Olayları',
      match_events_subtitle: 'Gol, kart ve şut akışı',
      btn_active: 'Aktif',
      btn_clear: 'Temizle',
      score_all: 'Tümü',
      score_won: 'Tuttu',
      score_lost: 'Tutmadı',
      score_in_play: 'Aktif',
      score_hit_rate: 'BAŞARI ORANI',
      empty_signals_heading: 'Canlı Sinyal Radarı Dinleniyor',
      empty_signals_text: 'Tetiklenen sinyaller TUTTU, TUTMADI ve AKTİF durumlarıyla burada anlık olarak takip edilir.',
      empty_events_heading: 'Canlı Maç Olayları Bekleniyor',
      empty_events_text: 'Canlı maçlarda gerçekleşen gol, iptal gol, asist, şut, faul ve kartlar anında burada listelenir.',
      pill_goal: 'Gol',
      pill_disallowed: 'İptal Gol',
      pill_assist: 'Asist',
      pill_shot: 'Şut',
      pill_foul: 'Faul',
      pill_card: 'Kart',

      // Signal Spotlight Cards
      spotlight_won_badge: 'HEDEF TUTTU',
      spotlight_active_badge: 'SİNYAL AKTİF',
      spotlight_radar_badge: 'RADAR AKTİF',
      spotlight_radar_title: 'Gidişat İzleniyor',
      spotlight_radar_title_prematch: 'Yaklaşan Karşılaşma Analizi',
      spotlight_radar_data: 'Canlı Veri Radarı',
      spotlight_model_prematch: 'Maç Önü',
      spotlight_model_scanning: 'Tarama Sürüyor',
      spotlight_scanning_sub: 'Canlı saha metrikleri ve değer eşikleri dinleniyor',
      spotlight_scanning_sub_prematch: 'Karşılaşma başlama saati bekleniyor',
      spotlight_default_reason: 'Kantitatif analiz motoru saha baskısını, şut kalitesini ve Poisson beklentilerini anlık ölçümlüyor. Değer eşiği aşıldığında sinyal tetiklenecektir.',
      spotlight_prematch_reason: 'Karşılaşma henüz başlamadı. Başlama düdüğüyle birlikte canlı saha metrikleri, baskı ve oran kırılımları gerçek zamanlı hesaplanacak.',
      trigger_minute_label: 'Tetikleme: Dk',
      current_score_label: 'Skor:',
      signal_active_tag: 'SİNYAL AKTİF',
      flow_signal_tag: 'GİDİŞAT SİNYALİ',
      valuable_selection: 'Değerli Seçim',
      elite_signal: 'ELİT SİNYAL',
      strong_signal: 'GÜÇLÜ SİNYAL',
      value_signal: 'DEĞER SİNYALİ',

      // Dedicated Views: Favorites & Radar
      fav_eyebrow: 'KİŞİSEL İZLEME LİSTENİZ',
      fav_title: 'Favori Maçlarım',
      fav_desc: 'Yıldızlanan maçların anlık skorları, şut istatistikleri ve sinyal durumları.',
      fav_empty_title: 'Henüz Favori Maç Eklenmedi',
      fav_empty_desc: 'Sol maç listesindeki veya maç detayındaki yıldız ikonuna tıklayarak maçları buraya sabitleyebilirsiniz.',
      radar_view_eyebrow: 'CANLI SİNYALLER',
      radar_view_title: 'Canlı Sinyal Radarı',
      radar_view_desc: 'Canlı sinyal sonuç karnesi ve hareketlenen karşılaşmalar.',
      radar_section_ledger: 'Canlı Sinyal Sonuç Karnesi (Tuttu / Tutmadı)',
      radar_section_live: 'Şu An Hareketlenen Canlı Maçlar',
      ledger_filter_all: 'Tümü',
      ledger_filter_pending: 'Aktif',
      ledger_filter_won: 'Tutanlar',
      ledger_filter_lost: 'Tutmayanlar',
      rkpi_total: 'TOPLAM SİNYAL',
      rkpi_won: 'TUTAN SİNYALLER',
      rkpi_lost: 'TUTMAYAN SİNYALLER',
      rkpi_pending: 'AKTİF BEKLEYEN',
      rkpi_rate: 'BAŞARI ORANI',

      // Additional UI & Metric Keys
      source_live_sync: 'Canlı Veri Senkronizasyonu',
      theme_toggle_title: 'Açık / Koyu Tema Değiştir',
      sound_toggle_title: 'Sesli uyarıları aç/kapat',
      lang_toggle_title: 'Dil Değiştir / Switch Language',
      starred_only_title: 'Bildirimleri sadece favori maçlar için filtrele',
      toggle_left_sidebar_title: 'Sol Maç Listesini Gizle/Aç (Kısayol: [ )',
      toggle_right_sidebar_title: 'Sağ Bildirimleri Gizle/Aç (Kısayol: ] )',
      prematch_expectation: 'Maç Önü Beklentisi',
      prematch_analysis: 'Yaklaşan Maç Önü Analizi',
      minute_extra: 'UZATMA',
      late_minutes: "Son Dakikalar (85'+)",
      extra_time: 'Uzatma Dakikaları',
      today: 'Bugün',
      metric_dangerous_attacks: 'Tehlikeli Atak',
      def_balanced: 'İki takım savunması dengeli',
      def_under_pressure: 'savunması baskı altında',
      risk_high: 'Yüksek Risk',
      risk_medium: 'Orta Risk',
      total_label: 'Toplam',
      sot_short: 'İsb',
      soff_short: 'İsz',
      current_label: 'Güncel',
      empty_radar_heading: 'Canlı Radar Taraması Devam Ediyor',
      empty_radar_text: 'Yüksek güvenli bir değer kırılması tespit edildiğinde maçlar burada canlı olarak listelenir.',
      sig_paused: 'Canlı sinyal bildirimleri kullanıcı tarafından duraklatıldı.',
      dismiss_signal: 'Sinyali Gizle',
      dismiss_event: 'Bildirimi Kapat',
      league_other: 'Diğer Ligler',
      count_matches: 'Maç',
      sec_live_matches: 'Canlı Karşılaşmalar',
      sec_upcoming_matches: 'Bugünün Yaklaşan Karşılaşmaları',
      no_matches_found: 'Eşleşen Karşılaşma Bulunamadı',
      no_matches_found_sub: 'Farklı bir lig veya filtre seçimi yapabilirsiniz.',
      fav_count_suffix: 'Favori Maç',
      sig_count_suffix: 'Aktif Sinyal',
      status_active: 'Aktif',
      status_off: 'Kapalı'
    },

    en: {
      // Topbar & Navigation
      app_title: 'PulseBet Studio',
      app_tagline: 'Quantitative Live Football Terminal',
      nav_all_matches: 'Live Matches',
      nav_favorites: 'My Favorites',
      nav_radar: 'Signal Radar',
      search_placeholder: 'Search team, league, or match...',
      preferences: 'Preferences',
      force_refresh: 'Force Refresh Data',

      // Quick Preferences Popover
      quick_settings_title: 'Preferences & Display',
      sec_appearance_sound: 'Display & Audio',
      theme_light: 'Light Theme',
      theme_dark: 'Dark Theme',
      sound_notifications: 'Audio Alerts',
      language_label: 'Language / Dil',
      sec_notif_filter: 'Alert Filters',
      starred_only: 'Favorites Only Alerts',
      sec_layout: 'Workspace Layout',
      layout_left: 'Left Match List',
      layout_right: 'Right Alerts Panel',

      // Left Column: Match Lounge
      filter_all: 'All',
      filter_live: 'Live',
      filter_scheduled: 'Upcoming',
      filter_signals: 'Signals',
      btn_matches: 'Matches',
      btn_notifications: 'Alerts',
      collapse_left: 'Collapse Left Sidebar',
      collapse_right: 'Collapse Right Sidebar',
      empty_match_list: 'No matches found matching your search or filter criteria.',
      loading_matches: 'Loading Live & Upcoming Fixtures',
      loading_matches_sub: 'Streaming telemetry from Flashscore, 365Scores, and ESPN...',
      league_all: 'All Leagues',
      search_league_placeholder: 'Filter league or country...',

      // Studio Arena: Center Scoreboard & Tabs
      official_match: 'OFFICIAL MATCH',
      league_not_selected: 'NO LEAGUE SELECTED',
      tracking_flow: 'Tracking Flow',
      tempo_balanced: 'Balanced Tempo',
      tempo_high: 'High Tempo',
      tempo_low: 'Low Tempo',
      tempo_frenzy: 'Intense Siege Pace',
      tempo_stalemate: 'Tactical Stalemate',
      minute_live: 'LIVE',
      minute_ht: 'HALF TIME',
      minute_ft: 'FULL TIME',
      action_star_add: '☆ Add to Favorites',
      action_star_remove: '★ In Favorites',
      add_to_fav: 'Add to Favorites',
      in_fav: 'In Favorites',
      team_home: 'Home',
      team_away: 'Away',
      side_home: 'HOME',
      side_away: 'AWAY',
      red_cards_tag: 'Red',

      // Center Tabs
      tab_overview: 'Overview',
      tab_stats: 'Stats & Matrix',
      tab_signals: 'Signals & Tactics',
      tab_markets: 'Markets & Odds',
      tab_timeline: 'Incidents & Lineup',

      // Momentum Radar
      radar_title: 'Pitch Momentum & Pressure Radar',
      home_pressure: 'Home Pressure',
      away_pressure: 'Away Pressure',
      radar_default_narrative: 'Select a match from the left list to review tactical momentum, shot quality, and in-game game state psychology.',

      // Overview Bento
      overview_critical_metrics: 'Key Match Metrics',
      overview_critical_metrics_sub: 'Top 4 decisive live pitch metrics',
      view_all_stats: 'Open All 10 Stats →',
      featured_markets: 'Featured Core Markets',
      featured_markets_sub: '1X2, 2.5/3.5 O/U and Next Goal live odds',
      view_all_markets: 'Open All 6 Markets →',

      // Evidence Matrix
      evidence_title: 'Tactical Evidence Matrix',
      evidence_subtitle: '4-dimensional pitch factors driving the quantitative signal model',
      pos_quality: 'Chance Quality',
      match_tempo: 'Match Tempo',
      def_resistance: 'Defensive State',
      goal_expectation: 'Goal Expectancy',
      badge_high: 'High',
      badge_medium: 'Medium',
      badge_low: 'Low',
      badge_balanced: 'Balanced',
      badge_under_pressure: 'Under Pressure',
      badge_struggling: 'Compromised',

      // Key Metrics & Official Stats Matrix
      stats_matrix_title: 'OFFICIAL STATS MATRIX',
      stats_matrix_subtitle: 'Live performance telemetry & dual-box efficiency',
      metric_xg: 'Expected Goals (xG)',
      metric_possession: 'Possession',
      metric_total_shots: 'Total Shots',
      metric_shots_on_target: 'Shots on Target',
      metric_shots_off_target: 'Shots off Target',
      metric_shots_inside_box: 'Box Shots',
      metric_corners: 'Corners',
      metric_fouls: 'Fouls',
      metric_big_chances: 'Big Chances',
      metric_goalkeeper_saves: 'Goalkeeper Saves',
      metric_yellow_cards: 'Yellow Cards',
      metric_red_cards: 'Red Cards',

      // 6 Core Markets
      markets_title: 'Market Expectations & Value Odds Opportunities',
      markets_subtitle: 'Poisson & Dixon-Coles probabilities, value edges, and locked market states',
      market_ms: 'Full Time Result (1X2)',
      market_btts: 'Both Teams to Score (BTTS)',
      market_ou: 'Over / Under',
      market_ht_btts: 'HT Both Teams to Score',
      market_ht_ou: 'HT Over / Under',
      market_next_goal: 'Next Goal',
      confidence: 'Confidence',
      value_edge: 'Edge',
      odds: 'Odds',
      probability: 'Probability',
      settled_label: 'Settled',
      locked_label: 'Locked',

      // Incidents & Lineups
      incidents_title: 'Match Incident Stream',
      incidents_subtitle: 'Goals, assists, cards, and VAR reviews',
      players_title: 'Key Players & Impact',
      players_subtitle: 'Attacking threat, playmaking, and defensive balance',
      role_threat_leader: 'Attacking Threat Leader',
      role_playmaker: 'Key Playmaker & Creator',
      role_defensive_balance: 'Defensive Equilibrium',
      empty_incidents: 'No goals, cards, or VAR incidents recorded for this match yet.',
      empty_incidents_scheduled: 'Match has not started yet.',
      no_incidents_recorded: 'No recorded match incidents yet.',
      analyzing_players: 'Analyzing player impact metrics...',

      // Right Column: Notifications & Signals
      tab_signals_header: 'Signals',
      tab_events_header: 'Incidents',
      tab_both_header: 'Split View',
      signal_tracker_title: 'Signal Tracker',
      signal_tracker_subtitle: 'In-play & settled hit-rate tracking',
      match_events_title: 'Match Incidents',
      match_events_subtitle: 'Real-time goals, cards & shot telemetry',
      btn_active: 'Active',
      btn_clear: 'Clear',
      score_all: 'All',
      score_won: 'Won',
      score_lost: 'Lost',
      score_in_play: 'In-Play',
      score_hit_rate: 'HIT RATE',
      empty_signals_heading: 'Awaiting Live Value Signals',
      empty_signals_text: 'Triggered signals are tracked live with WON, LOST, and IN-PLAY settlement states.',
      empty_events_heading: 'Awaiting Live Match Incidents',
      empty_events_text: 'Live goals, VAR decisions, assists, key attempts, fouls, and cards stream here in real time.',
      pill_goal: 'Goal',
      pill_disallowed: 'Disallowed',
      pill_assist: 'Assist',
      pill_shot: 'Shot',
      pill_foul: 'Foul',
      pill_card: 'Card',

      // Signal Spotlight Cards
      spotlight_won_badge: 'TARGET WON',
      spotlight_active_badge: 'SIGNAL ACTIVE',
      spotlight_radar_badge: 'RADAR ACTIVE',
      spotlight_radar_title: 'Tracking In-Play Flow',
      spotlight_radar_title_prematch: 'Upcoming Fixture Analysis',
      spotlight_radar_data: 'Live Data Radar',
      spotlight_model_prematch: 'Pre-Match Model',
      spotlight_model_scanning: 'Scanning In-Play',
      spotlight_scanning_sub: 'Listening to live pitch telemetry and conviction thresholds',
      spotlight_scanning_sub_prematch: 'Awaiting kickoff whistle',
      spotlight_default_reason: 'Quantitative model is evaluating pitch pressure, chance quality, and Poisson distributions. Signals trigger when edge thresholds are exceeded.',
      spotlight_prematch_reason: 'Match has not started yet. Real-time telemetry, pressure momentum, and line movements will activate upon kickoff.',
      trigger_minute_label: 'Trigger: Min',
      current_score_label: 'Score:',
      signal_active_tag: 'SIGNAL ACTIVE',
      flow_signal_tag: 'MOMENTUM SIGNAL',
      valuable_selection: 'Value Selection',
      elite_signal: 'ELITE SIGNAL',
      strong_signal: 'STRONG SIGNAL',
      value_signal: 'VALUE SIGNAL',

      // Dedicated Views: Favorites & Radar
      fav_eyebrow: 'YOUR PERSONAL WATCHLIST',
      fav_title: 'My Favorite Matches',
      fav_desc: 'Real-time scores, shot breakdowns, and signal status for your pinned fixtures.',
      fav_empty_title: 'No Favorite Matches Added',
      fav_empty_desc: 'Click the star icon on any match card or detail view to pin it to your personal watchlist.',
      radar_view_eyebrow: 'LIVE VALUE SIGNALS',
      radar_view_title: 'Live Signal Radar',
      radar_view_desc: 'Tracked signal scorecard and fixtures gaining tactical momentum.',
      radar_section_ledger: 'Signal Settlement Scorecard (Won / Lost / In-Play)',
      radar_section_live: 'Live Fixtures with Momentum Breakouts',
      ledger_filter_all: 'All',
      ledger_filter_pending: 'In-Play',
      ledger_filter_won: 'Won',
      ledger_filter_lost: 'Lost',
      rkpi_total: 'TOTAL SIGNALS',
      rkpi_won: 'WON SIGNALS',
      rkpi_lost: 'LOST SIGNALS',
      rkpi_pending: 'ACTIVE PENDING',
      rkpi_rate: 'HIT RATE',

      // Additional UI & Metric Keys
      source_live_sync: 'Live Data Synchronization',
      theme_toggle_title: 'Toggle Light / Dark Theme',
      sound_toggle_title: 'Toggle Audio Notifications',
      lang_toggle_title: 'Switch Language / Dil Değiştir',
      starred_only_title: 'Filter alerts for favorite matches only',
      toggle_left_sidebar_title: 'Toggle Left Match List (Shortcut: [ )',
      toggle_right_sidebar_title: 'Toggle Right Alerts Panel (Shortcut: ] )',
      prematch_expectation: 'Pre-Match Expectation',
      prematch_analysis: 'Upcoming Pre-Match Analysis',
      minute_extra: 'EXTRA TIME',
      late_minutes: "Late Game (85'+)",
      extra_time: 'Stoppage Time',
      today: 'Today',
      metric_dangerous_attacks: 'Dangerous Attacks',
      def_balanced: 'Both defenses well balanced',
      def_under_pressure: 'defense under pressure',
      risk_high: 'High Risk',
      risk_medium: 'Moderate Risk',
      total_label: 'Total',
      sot_short: 'On',
      soff_short: 'Off',
      current_label: 'Current',
      empty_radar_heading: 'Live Radar Scan Active',
      empty_radar_text: 'Fixtures will appear here live once a high-conviction value breakout occurs.',
      sig_paused: 'Live value signal alerts paused by user.',
      dismiss_signal: 'Dismiss Signal',
      dismiss_event: 'Dismiss Alert',
      league_other: 'Other Leagues',
      count_matches: 'Matches',
      sec_live_matches: 'Live Matches',
      sec_upcoming_matches: "Today's Upcoming Fixtures",
      no_matches_found: 'No Matching Fixtures Found',
      no_matches_found_sub: 'Try selecting another league or adjusting your filter.',
      fav_count_suffix: 'Favorite Matches',
      sig_count_suffix: 'Active Signals',
      status_active: 'Active',
      status_off: 'Off'
    }
  };

  class I18nManager {
    constructor() {
      let saved = null;
      try {
        saved = localStorage.getItem('pulsebet_lang');
      } catch (_) {}
      this.currentLang = saved === 'en' || saved === 'tr' ? saved : 'tr';
      this.listeners = [];
      this.initEventsBound = false;

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.initDom());
      } else {
        this.initDom();
      }
    }

    initDom() {
      this.applyTranslations();
      this.bindButtons();
    }

    bindButtons() {
      if (this.initEventsBound) return;
      const btnLang = document.getElementById('btnLangToggle');
      if (btnLang && !btnLang.dataset.i18nBound) {
        btnLang.dataset.i18nBound = 'true';
        btnLang.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggle();
        });
      }
      const btnPopover = document.getElementById('btnPopoverLangToggle');
      if (btnPopover && !btnPopover.dataset.i18nBound) {
        btnPopover.dataset.i18nBound = 'true';
        btnPopover.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggle();
        });
      }
      this.initEventsBound = true;
    }

    get lang() {
      return this.currentLang;
    }

    setLang(newLang) {
      if (newLang !== 'tr' && newLang !== 'en') return;
      this.currentLang = newLang;
      try {
        localStorage.setItem('pulsebet_lang', newLang);
      } catch (_) {}
      this.applyTranslations();
      this.notifyListeners();
    }

    toggle() {
      this.setLang(this.currentLang === 'tr' ? 'en' : 'tr');
    }

    t(key, fallback = '') {
      const dict = translations[this.currentLang] || translations.tr;
      if (dict && dict[key] !== undefined) {
        return dict[key];
      }
      const fallbackDict = translations.tr;
      if (fallbackDict && fallbackDict[key] !== undefined) {
        return fallbackDict[key];
      }
      return fallback || key;
    }

    translateMarketTitle(title) {
      if (!title) return '';
      if (this.currentLang === 'tr') return title;
      const lower = title.toLowerCase();
      if (lower.includes('maç sonucu') || lower.includes('ms')) return 'Full Time Result (1X2)';
      if (lower.includes('karşılıklı gol') || lower.includes('kg') || lower.includes('btts')) return 'Both Teams to Score';
      if (lower.includes('alt/üst') || lower.includes('over/under') || lower.includes('gol alt')) return 'Over / Under Goals';
      if (lower.includes('sıradaki gol') || lower.includes('next goal')) return 'Next Goal';
      if (lower.includes('ilk yarı sonucu') || lower.includes('iy')) return 'Half Time Result';
      if (lower.includes('ilk yarı')) return 'Half Time Market';
      return title;
    }

    translateSelection(sel) {
      if (!sel) return '';
      if (this.currentLang === 'tr') return sel;
      let s = String(sel);
      s = s.replace(/Ev Sahibi/gi, 'Home');
      s = s.replace(/\bEv\b/gi, 'Home');
      s = s.replace(/Deplasman/gi, 'Away');
      s = s.replace(/\bDep\b/gi, 'Away');
      s = s.replace(/Beraberlik/gi, 'Draw');
      s = s.replace(/\bVar\b/gi, 'Yes');
      s = s.replace(/\bYok\b/gi, 'No');
      s = s.replace(/\bÜst\b/gi, 'Over');
      s = s.replace(/\bAlt\b/gi, 'Under');
      s = s.replace(/Gol Olmaz/gi, 'No Goal');
      return s;
    }

    translateArchetype(archKey, defaultLabel) {
      if (this.currentLang === 'tr') return defaultLabel || 'Gidişat İzleniyor';
      const keyMap = {
        'HOME_SIEGE': 'Home Siege & Relentless Pressure',
        'AWAY_SIEGE': 'Away Siege & Heavy Pressure',
        'HIGH_TEMPO_BOX_TO_BOX': 'High Tempo Box-to-Box',
        'AWAY_COUNTER_PUNCH': 'Away Lethal Counter-Attack',
        'HOME_COUNTER_PUNCH': 'Home Lethal Counter-Attack',
        'LATE_GAME_VOLATILITY': 'Late Game Volatility & Desperation Push',
        'RED_CARD_POWERPLAY_HOME': 'Home Red Card Advantage & Siege',
        'RED_CARD_POWERPLAY_AWAY': 'Away Red Card Advantage & Siege',
        'STALEMATE_DEFENSIVE': 'Midfield Tactical Stalemate',
        'LOW_TEMPO_CONTROL': 'Controlled Low-Tempo Possession',
        'OPEN_CHANCE_EXCHANGE': 'Open End-to-End Chance Exchange',
        'CORNER_PRESSURE_CLUSTER': 'Corner Cluster & Set-Piece Assault',
        'PRE_MATCH': 'Pre-Match Tactical Setup'
      };
      return keyMap[archKey] || defaultLabel || 'Tracking Match Flow';
    }

    translateNarrative(archKey, trNarrative) {
      if (this.currentLang === 'tr') return trNarrative;
      const narrativeMap = {
        'HOME_SIEGE': 'Home side is pinning the opponent deep in their final third, generating sustained box entries and high shot frequency.',
        'AWAY_SIEGE': 'Away team is dominating pitch tilt and creating sustained offensive pressure inside the opposition penalty area.',
        'HIGH_TEMPO_BOX_TO_BOX': 'Rapid transition game with both sides bypassing central midfield and trading direct attacking waves.',
        'AWAY_COUNTER_PUNCH': 'Away side is conceding possession while launching lethal high-speed counter transitions against an over-extended home defense.',
        'HOME_COUNTER_PUNCH': 'Home side is absorbing away pressure and exploiting wide defensive gaps with surgical counter transitions.',
        'LATE_GAME_VOLATILITY': 'Match clock entering decisive late phase with both sides committing forward; goal volatility is elevated.',
        'RED_CARD_POWERPLAY_HOME': 'Home team holding numerical superiority and establishing a full-pitch encirclement around the defense.',
        'RED_CARD_POWERPLAY_AWAY': 'Away team utilizing numerical superiority to stretch the home block and create wide overloads.',
        'STALEMATE_DEFENSIVE': 'Both teams are defensively disciplined with high tactical containment and minimal clear-cut opportunities.',
        'LOW_TEMPO_CONTROL': 'Patient possession sequences with low tactical risk and limited transitional transitions.',
        'OPEN_CHANCE_EXCHANGE': 'Both teams trading high-danger opportunities; defensive transitions are dislocated.',
        'CORNER_PRESSURE_CLUSTER': 'Heavy set-piece clustering and repeated box deliveries creating immediate breakthrough threat.',
        'PRE_MATCH': 'Pre-match quantitative baseline based on historical distribution, field tilt models, and opening price action.'
      };
      return narrativeMap[archKey] || trNarrative;
    }

    subscribe(fn) {
      if (typeof fn === 'function') {
        this.listeners.push(fn);
      }
    }

    notifyListeners() {
      for (const fn of this.listeners) {
        try {
          fn(this.currentLang);
        } catch (_) {}
      }
    }

    applyTranslations() {
      document.documentElement.setAttribute('lang', this.currentLang);

      // Elements with data-i18n
      const elements = document.querySelectorAll('[data-i18n]');
      elements.forEach((el) => {
        const key = el.getAttribute('data-i18n');
        if (key) {
          const translation = this.t(key);
          if (translation) {
            if (el.children.length === 0) {
              el.textContent = translation;
            } else {
              let replaced = false;
              for (const node of el.childNodes) {
                if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length > 0) {
                  node.nodeValue = translation + ' ';
                  replaced = true;
                  break;
                }
              }
              if (!replaced) {
                el.textContent = translation;
              }
            }
          }
        }
      });

      // Placeholders
      const placeholders = document.querySelectorAll('[data-i18n-placeholder]');
      placeholders.forEach((el) => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) {
          const translation = this.t(key);
          if (translation) {
            el.setAttribute('placeholder', translation);
          }
        }
      });

      // Titles & Tooltips
      const titles = document.querySelectorAll('[data-i18n-title]');
      titles.forEach((el) => {
        const key = el.getAttribute('data-i18n-title');
        if (key) {
          const translation = this.t(key);
          if (translation) {
            el.setAttribute('title', translation);
          }
        }
      });

      // Update lang switch buttons
      const langPill = document.getElementById('btnLangToggle');
      if (langPill) {
        langPill.setAttribute('data-current-lang', this.currentLang);
        const textSpan = langPill.querySelector('.lang-label');
        if (textSpan) textSpan.textContent = this.currentLang.toUpperCase();
        langPill.title = this.currentLang === 'tr' ? 'Switch to English' : 'Türkçe Dilini Seç';
      }

      const popoverLangLabel = document.getElementById('langPopoverLabel');
      if (popoverLangLabel) {
        popoverLangLabel.textContent = this.currentLang === 'tr' ? 'English (İngilizce)' : 'Türkçe (Turkish)';
      }
    }
  }

  window.pulseI18n = new I18nManager();
})(window);
