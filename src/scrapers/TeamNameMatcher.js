/**
 * PulseBet Studio — Entity Deduplication & Canonical Team Matching Engine
 * Accurately reconciles disparate team naming conventions across Flashscore, 365Scores & ESPN:
 *  - Handles acronyms (e.g., PSG -> Paris Saint-Germain, BVB -> Borussia Dortmund, BJK -> Beşiktaş)
 *  - Disambiguates common name collisions (Man City != Man United, Real Madrid != Atletico Madrid)
 *  - Normalizes diacritics, Turkish characters, punctuation, and structural prefixes
 *  - Resolves aliases via comprehensive canonical dictionary
 */

class TeamNameMatcher {
  constructor() {
    this.aliasMap = new Map();
    this.initAliases();
  }

  cleanString(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  stripNoiseWords(cleanStr) {
    if (!cleanStr) return '';
    // Only strip pure structural club affixes, NEVER distinguishing words like city, united, real, atletico, sporting
    return cleanStr
      .replace(/\b(fc|fk|sk|sc|ac|as|cf|cd|afc|ud|bsc|vfb|vfl|tsg|ogc|losc|gnk|rsc|rc|ca|rcd|bk|ff|if|ik|club)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  extractAcronym(name) {
    if (!name) return { initials: '', compound: '' };
    const clean = String(name)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ı/g, 'i')
      .replace(/[^a-zA-Z0-9\s\-_/]/g, ' ')
      .trim();

    const rawWords = clean.split(/[\s\-_/]+/).filter(Boolean);
    const words = rawWords.filter(w => !/^(fc|fk|sk|sc|ac|as|cf|cd|afc|club)$/i.test(w));
    if (words.length === 0) return { initials: '', compound: '' };

    const initials = words.map(w => w[0].toLowerCase()).join('');

    let compound = '';
    for (const w of words) {
      if (w.length <= 3 && /^[a-zA-Z]+$/.test(w) && (w === w.toUpperCase() || w.length <= 2)) {
        compound += w.toLowerCase();
      } else {
        compound += w[0].toLowerCase();
      }
    }

    return { initials, compound };
  }

  registerAlias(canonicalKey, aliases) {
    for (const a of aliases) {
      const c = this.cleanString(a);
      if (c) {
        this.aliasMap.set(c, canonicalKey);
        const stripped = this.stripNoiseWords(c);
        if (stripped && stripped !== c) {
          this.aliasMap.set(stripped, canonicalKey);
        }
      }
    }
  }

  initAliases() {
    const list = [
      // Top French & PSG
      ['paris_saint_germain', ['psg', 'paris sg', 'paris saint germain', 'paris saint-germain', 'paris saintgermain', 'paris st germain', 'paris']],
      ['marseille', ['marseille', 'olympique de marseille', 'om']],
      ['lyon', ['lyon', 'olympique lyonnais', 'ol']],
      ['monaco', ['monaco', 'as monaco']],
      ['lille', ['lille', 'losc lille', 'losc']],
      ['nice', ['nice', 'ogc nice']],
      ['rennes', ['rennes', 'stade rennais']],
      ['lens', ['lens', 'rc lens']],
      ['strasbourg', ['strasbourg', 'rc strasbourg']],
      ['saint_etienne', ['saint etienne', 'saint-etienne', 'as saint-etienne', 'asse']],

      // Top English & Manchester
      ['manchester_city', ['man city', 'manchester city', 'mcfc', 'man. city']],
      ['manchester_united', ['man united', 'manchester united', 'man utd', 'mufc', 'man. united']],
      ['arsenal', ['arsenal', 'arsenal fc']],
      ['chelsea', ['chelsea', 'chelsea fc']],
      ['liverpool', ['liverpool', 'liverpool fc']],
      ['tottenham', ['tottenham', 'tottenham hotspur', 'spurs']],
      ['aston_villa', ['aston villa', 'villa']],
      ['newcastle_united', ['newcastle', 'newcastle united', 'newcastle utd']],
      ['west_ham', ['west ham', 'west ham united', 'west ham utd']],
      ['wolverhampton', ['wolves', 'wolverhampton', 'wolverhampton wanderers']],
      ['brighton', ['brighton', 'brighton and hove albion', 'brighton & hove albion', 'brighton hove albion']],
      ['everton', ['everton', 'everton fc']],
      ['nottingham_forest', ['nottingham forest', 'nottingham', 'forest']],
      ['crystal_palace', ['crystal palace', 'palace']],
      ['fulham', ['fulham', 'fulham fc']],
      ['brentford', ['brentford', 'brentford fc']],
      ['bournemouth', ['bournemouth', 'afc bournemouth']],
      ['leicester_city', ['leicester', 'leicester city']],

      // Top Spanish & Madrid
      ['real_madrid', ['real madrid', 'r madrid', 'r. madrid', 'rm']],
      ['atletico_madrid', ['atletico madrid', 'atl madrid', 'atl. madrid', 'atletico de madrid', 'club atletico de madrid', 'atm', 'atletico']],
      ['barcelona', ['barcelona', 'fc barcelona', 'barca', 'barça']],
      ['athletic_bilbao', ['athletic bilbao', 'athletic club', 'ath bilbao', 'ath. bilbao', 'bilbao']],
      ['real_sociedad', ['real sociedad', 'r sociedad', 'r. sociedad', 'sociedad']],
      ['real_betis', ['real betis', 'betis']],
      ['sevilla', ['sevilla', 'sevilla fc']],
      ['villarreal', ['villarreal', 'villarreal cf']],
      ['girona', ['girona', 'girona fc']],
      ['celta_vigo', ['celta vigo', 'celta de vigo', 'rc celta']],
      ['espanyol', ['espanyol', 'rcd espanyol']],
      ['rayo_vallecano', ['rayo vallecano', 'rayo']],
      ['mallorca', ['mallorca', 'rcd mallorca']],
      ['osasuna', ['osasuna', 'ca osasuna']],
      ['valencia', ['valencia', 'valencia cf']],
      ['getafe', ['getafe', 'getafe cf']],

      // Top German
      ['bayern_munich', ['bayern munich', 'bayern munchen', 'bayern münchen', 'fc bayern', 'fc bayern munchen', 'bayern']],
      ['borussia_dortmund', ['borussia dortmund', 'dortmund', 'bvb', 'bvb 09', 'bvb dortmund']],
      ['borussia_monchengladbach', ['borussia monchengladbach', 'borussia mönchengladbach', 'monchengladbach', 'mönchengladbach', 'mgladbach', "m'gladbach", 'b. monchengladbach']],
      ['bayer_leverkusen', ['bayer leverkusen', 'leverkusen', 'bayer 04 leverkusen', 'bayer 04']],
      ['rb_leipzig', ['rb leipzig', 'leipzig', 'rbl', 'rasenballsport leipzig']],
      ['eintracht_frankfurt', ['eintracht frankfurt', 'frankfurt', 'sge']],
      ['stuttgart', ['vfb stuttgart', 'stuttgart']],
      ['werder_bremen', ['werder bremen', 'bremen']],
      ['wolfsburg', ['vfl wolfsburg', 'wolfsburg']],
      ['hoffenheim', ['tsg hoffenheim', 'hoffenheim']],
      ['freiburg', ['sc freiburg', 'freiburg']],
      ['mainz', ['mainz 05', 'mainz', '1 fsv mainz 05']],
      ['union_berlin', ['union berlin', '1 fc union berlin']],
      ['st_pauli', ['st pauli', 'fc st pauli', 'st. pauli']],

      // Top Italian
      ['inter_milan', ['inter', 'inter milan', 'internazionale', 'fc internazionale milano', 'fc inter']],
      ['ac_milan', ['ac milan', 'milan']],
      ['juventus', ['juventus', 'juve']],
      ['as_roma', ['as roma', 'roma']],
      ['ss_lazio', ['ss lazio', 'lazio']],
      ['ssc_napoli', ['ssc napoli', 'napoli']],
      ['atalanta', ['atalanta', 'atalanta bc']],
      ['fiorentina', ['fiorentina', 'acf fiorentina']],
      ['bologna', ['bologna', 'bologna fc']],
      ['torino', ['torino', 'torino fc']],

      // Top Turkish (Süper Lig)
      ['galatasaray', ['galatasaray', 'gala']],
      ['fenerbahce', ['fenerbahce', 'fenerbahçe', 'fener', 'fb']],
      ['besiktas', ['besiktas', 'beşiktaş', 'bjk']],
      ['trabzonspor', ['trabzonspor', 'trabzon', 'ts']],
      ['basaksehir', ['basaksehir', 'başakşehir', 'istanbul basaksehir', 'istanbul başakşehir']],

      // Other European & International Elite
      ['bodo_glimt', ['bodo glimt', 'bodø glimt', 'bodo/glimt', 'bodø/glimt', 'fk bodo/glimt', 'fk bodø/glimt', 'bodo-glimt', 'bodo']],
      ['sporting_cp', ['sporting cp', 'sporting lisbon', 'sporting lisboa', 'sporting de portugal', 'sporting club de portugal', 'scp', 'sporting']],
      ['benfica', ['benfica', 'sl benfica']],
      ['porto', ['porto', 'fc porto']],
      ['braga', ['braga', 'sc braga']],
      ['vitoria_guimaraes', ['vitoria guimaraes', 'vitória sc', 'guimaraes', 'vitoria sc']],
      ['ajax', ['ajax', 'afc ajax']],
      ['psv', ['psv', 'psv eindhoven']],
      ['feyenoord', ['feyenoord', 'feyenoord rotterdam']],
      ['az_alkmaar', ['az', 'az alkmaar']],
      ['twente', ['twente', 'fc twente']],
      ['celtic', ['celtic', 'celtic fc']],
      ['rangers', ['rangers', 'glasgow rangers']],
      ['club_brugge', ['club brugge', 'brugge', 'club brugge kv']],
      ['anderlecht', ['anderlecht', 'rsc anderlecht']],
      ['union_saint_gilloise', ['union saint-gilloise', 'union saint gilloise', 'royale union sg', 'union sg', 'saint-gilloise', 'rusg', 'union st gilloise']],
      ['salzburg', ['salzburg', 'fc salzburg', 'red bull salzburg', 'rb salzburg']],
      ['sturm_graz', ['sturm graz', 'sk sturm graz']],
      ['young_boys', ['young boys', 'bsc young boys']],
      ['dinamo_zagreb', ['dinamo zagreb', 'gnk dinamo zagreb']],
      ['crvena_zvezda', ['red star belgrade', 'crvena zvezda', 'red star']],
      ['shakhtar_donetsk', ['shakhtar donetsk', 'shakhtar']],
      ['dynamo_kyiv', ['dynamo kyiv', 'dinamo kiev', 'dynamo kiev']],
      ['slavia_prague', ['slavia prague', 'slavia praha']],
      ['sparta_prague', ['sparta prague', 'sparta praha']],
      ['olympiacos', ['olympiacos', 'olympiakos', 'olympiacos piraeus']],
      ['panathinaikos', ['panathinaikos', 'pao']],
      ['paok', ['paok', 'paok thessaloniki']],
      ['al_hilal', ['al-hilal', 'al hilal']],
      ['al_nassr', ['al-nassr', 'al nassr']],
      ['al_ittihad', ['al-ittihad', 'al ittihad']],
      ['inter_miami', ['inter miami', 'inter miami cf']]
    ];

    for (const [key, aliases] of list) {
      this.registerAlias(key, aliases);
    }
  }

  getCanonicalTeamKey(name) {
    if (!name) return null;
    const clean = this.cleanString(name);
    if (!clean) return null;

    if (this.aliasMap.has(clean)) {
      return this.aliasMap.get(clean);
    }

    const stripped = this.stripNoiseWords(clean);
    if (this.aliasMap.has(stripped)) {
      return this.aliasMap.get(stripped);
    }

    const acr = this.extractAcronym(name);
    if (acr.compound && this.aliasMap.has(acr.compound)) {
      return this.aliasMap.get(acr.compound);
    }
    if (acr.initials && this.aliasMap.has(acr.initials)) {
      return this.aliasMap.get(acr.initials);
    }

    return null;
  }

  normalizeTeamName(name) {
    const key = this.getCanonicalTeamKey(name);
    if (key) return key;
    return this.stripNoiseWords(this.cleanString(name)).replace(/\s+/g, '');
  }

  diceSimilarity(s1, s2) {
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1.0;
    if (s1.length < 2 || s2.length < 2) return 0;

    const bigrams1 = new Map();
    for (let i = 0; i < s1.length - 1; i++) {
      const bg = s1.slice(i, i + 2);
      bigrams1.set(bg, (bigrams1.get(bg) || 0) + 1);
    }
    let intersection = 0;
    for (let i = 0; i < s2.length - 1; i++) {
      const bg = s2.slice(i, i + 2);
      const count = bigrams1.get(bg) || 0;
      if (count > 0) {
        bigrams1.set(bg, count - 1);
        intersection++;
      }
    }
    return (2.0 * intersection) / ((s1.length - 1) + (s2.length - 1));
  }

  calculateSimilarity(a, b) {
    if (!a || !b) return 0;
    const cleanA = this.cleanString(a);
    const cleanB = this.cleanString(b);
    if (cleanA === cleanB) return 1.0;

    // 1. Canonical Alias Dictionary Resolution
    const keyA = this.getCanonicalTeamKey(a);
    const keyB = this.getCanonicalTeamKey(b);
    if (keyA && keyB) {
      return keyA === keyB ? 1.0 : 0.0;
    }

    // Disambiguation Guard: Never confuse City vs United, Real vs Atletico, Inter vs Milan
    const wordsA = new Set(cleanA.split(' '));
    const wordsB = new Set(cleanB.split(' '));
    if ((wordsA.has('city') && wordsB.has('united')) || (wordsA.has('united') && wordsB.has('city'))) return 0.0;
    if ((wordsA.has('real') && wordsB.has('atletico')) || (wordsA.has('atletico') && wordsB.has('real'))) return 0.0;
    if ((wordsA.has('inter') && wordsB.has('milan') && !wordsA.has('milan')) || (wordsB.has('inter') && wordsA.has('milan') && !wordsB.has('milan'))) return 0.0;

    // 2. Acronym Matching (PSG <-> Paris Saint-Germain, BVB <-> Borussia Dortmund, etc.)
    const acrA = this.extractAcronym(a);
    const acrB = this.extractAcronym(b);

    if (acrA.compound && acrB.compound) {
      if (acrA.compound.length >= 2 && acrA.compound === acrB.compound) {
        return 1.0;
      }
      if (acrA.compound.length >= 2 && (acrA.compound === cleanB || acrB.compound === cleanA)) {
        return 1.0;
      }
      if (acrA.initials.length >= 2 && (acrA.initials === cleanB || acrB.initials === cleanA)) {
        return 0.95;
      }
    }

    // 3. Noise-Stripped Exact Match
    const strippedA = this.stripNoiseWords(cleanA);
    const strippedB = this.stripNoiseWords(cleanB);
    if (strippedA && strippedA === strippedB) return 1.0;

    // 4. Token Set & Containment Matching
    const tokensA = strippedA.split(' ').filter(t => t.length > 1);
    const tokensB = strippedB.split(' ').filter(t => t.length > 1);

    if (tokensA.length > 0 && tokensB.length > 0) {
      const setA = new Set(tokensA);
      const setB = new Set(tokensB);
      let matchTokens = 0;
      for (const t of setA) {
        if (setB.has(t)) matchTokens++;
      }
      const union = new Set([...setA, ...setB]).size;
      const jaccard = union > 0 ? matchTokens / union : 0;
      if (jaccard >= 0.75) return 0.92;

      // Single word containment for distinct names (e.g., "Galatasaray" inside "Galatasaray A.S.")
      if ((tokensA.length === 1 && tokensB.length >= 1 && tokensB.includes(tokensA[0]) && tokensA[0].length >= 4) ||
          (tokensB.length === 1 && tokensA.length >= 1 && tokensA.includes(tokensB[0]) && tokensB[0].length >= 4)) {
        return 0.90;
      }
    }

    // 5. String Substring Match
    const squashedA = strippedA.replace(/\s+/g, '');
    const squashedB = strippedB.replace(/\s+/g, '');
    if (squashedA.length >= 4 && squashedB.length >= 4) {
      if (squashedA.includes(squashedB) || squashedB.includes(squashedA)) {
        const ratio = Math.min(squashedA.length, squashedB.length) / Math.max(squashedA.length, squashedB.length);
        if (ratio >= 0.55) return 0.88;
      }
    }

    // 6. Dice Bigram Similarity
    return this.diceSimilarity(squashedA, squashedB);
  }
}

module.exports = TeamNameMatcher;
