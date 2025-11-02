// estimator.v2.js - ONLY allowed categories, improved share input and penalty
(function(global){

  // Povolené kategorie (včetně diakritiky, přesné názvy)
  const ALLOWED_CATEGORIES = [
    "Bydlení",
    "Komerční",
    "Lesy",
    "Louky",
    "Pole",
    "Sady/vinice",
    "Zahrady"
  ];

  const median = arr => {
    const sorted = arr.filter(n => typeof n === 'number' && isFinite(n)).sort((a,b) => a-b);
    if (!sorted.length) return NaN;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid-1] + sorted[mid]) / 2;
  };

  const normalizePraha = s => {
    if (!s) return s;
    s = String(s).trim()
      .replace(/\bobvod\s+/i, '')
      .replace(/praha\s*[-–—]\s*(\d+)/i, 'Praha $1')
      .replace(/praha\s*0+(\d+)/i, 'Praha $1')
      .replace(/\s+/g, ' ')
      .trim();
    return s;
  };

  const removeDiacritics = s => {
    if (!s) return s;
    return String(s)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  };

  const extractMainMunicipality = s => {
    if (!s) return null;
    s = String(s).trim();

    if (/praha/i.test(s)) {
      const prahaMatch = s.match(/praha\s*[.-]?\s*(\d+)/i);
      if (prahaMatch) {
        return `Praha ${prahaMatch[1]}`;
      }
      return 'Praha';
    }
    s = s.replace(/\s*[-–—]\s*/g, '-');
    if (s.includes('-')) {
      const parts = s.split('-');
      if (!/^[IVX]+$/i.test(parts[0].trim())) {
        s = parts[0].trim();
      }
    }
    s = s.replace(/\s*\([^)]+\)/g, '').trim();
    s = s.replace(/\s+[IVX]+$/i, '').trim();
    s = s.replace(/\s+[IVX]+\.\s*$/i, '').trim();
    return s;
  };

  const eqObec = (a, b) => {
    const normA = removeDiacritics(extractMainMunicipality(normalizePraha(a)) || '');
    const normB = removeDiacritics(extractMainMunicipality(normalizePraha(b)) || '');
    if (normA === normB) return true;
    if (/praha/i.test(normA) && /praha/i.test(normB)) {
      const numA = (normA.match(/\d+/) || [])[0];
      const numB = (normB.match(/\d+/) || [])[0];
      if (numA && numB) return numA === numB;
      return true;
    }
    return false;
  };

  const eqOkres = (a, b) => {
    if (!a || !b) return false;
    const normA = removeDiacritics(extractMainMunicipality(normalizePraha(a)));
    const normB = removeDiacritics(extractMainMunicipality(normalizePraha(b)));
    return normA === normB;
  };

  const eqKraj = (a, b) => {
    if (!a || !b) return false;
    return removeDiacritics(a.trim()) === removeDiacritics(b.trim());
  };

  const dispoRooms = d => {
    const m = /^\s*(\d+)/.exec((d || '').toString());
    return m ? m[1] : '?';
  };

  const parseLocation = locationStr => {
    if (!locationStr) return { ulice: null, obec: null };
    const parts = locationStr.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      const rawObec = parts[parts.length - 1];
      const mainObec = extractMainMunicipality(normalizePraha(rawObec));
      return { ulice: parts[0], obec: mainObec };
    } else {
      const mainObec = extractMainMunicipality(normalizePraha(parts[0]));
      return { ulice: null, obec: mainObec };
    }
  };

  const findGeoContext = (rows, targetObec) => {
    const record = rows.find(r => eqObec(r.obec, targetObec));
    if (record) {
      return { okres: record.okres || null, kraj: record.kraj || null };
    }
    return { okres: null, kraj: null };
  };

  // === BYTY ===
  function estimateByt(rows, params) {
    if (!rows || !rows.length) {
      return { ok: false, reason: "Data nejsou k dispozici." };
    }
    const { adresa, dispozice, stav_bytu, vlastnictvi, vymera } = params;
    const loc = parseLocation(adresa);
    const targetObec = loc.obec;
    if (!targetObec) {
      return { ok: false, reason: "Nepodařilo se rozpoznat obec z adresy." };
    }
    const geo = findGeoContext(rows, targetObec);
    const d = (dispozice || '').toLowerCase().trim();
    const rooms = dispoRooms(dispozice);
    const cascades = [
      { label: `obec "${targetObec}" + dispozice "${dispozice}"`, 
        filter: r => eqObec(r.obec, targetObec) && (r.dispozice || '').toLowerCase() === d },
      { label: `obec "${targetObec}" + ${rooms} pokoje`, 
        filter: r => eqObec(r.obec, targetObec) && dispoRooms(r.dispozice) === rooms },
      { label: `okres "${geo.okres}" + dispozice "${dispozice}"`,
        filter: r => geo.okres && eqOkres(r.okres, geo.okres) && (r.dispozice || '').toLowerCase() === d },
      { label: `okres "${geo.okres}" + ${rooms} pokoje`,
        filter: r => geo.okres && eqOkres(r.okres, geo.okres) && dispoRooms(r.dispozice) === rooms },
      { label: `kraj "${geo.kraj}" + dispozice "${dispozice}"`,
        filter: r => geo.kraj && eqKraj(r.kraj, geo.kraj) && (r.dispozice || '').toLowerCase() === d },
      { label: `kraj "${geo.kraj}" + ${rooms} pokoje`,
        filter: r => geo.kraj && eqKraj(r.kraj, geo.kraj) && dispoRooms(r.dispozice) === rooms },
      { label: `ČR + dispozice "${dispozice}"`, 
        filter: r => (r.dispozice || '').toLowerCase() === d },
      { label: `ČR + ${rooms} pokoje`, 
        filter: r => dispoRooms(r.dispozice) === rooms },
      { label: "ČR – všechny byty", 
        filter: r => true }
    ];
    let medianPrice = null;
    let usedLevel = null;
    let count = 0;
    for (const cascade of cascades) {
      const filtered = rows.filter(cascade.filter);
      const prices = filtered.map(r => Number(r.cena_m2)).filter(p => isFinite(p));
      if (prices.length > 0) {
        medianPrice = median(prices);
        usedLevel = cascade.label;
        count = prices.length;
        break;
      }
    }
    if (!medianPrice || !isFinite(medianPrice)) {
      return { ok: false, reason: "Nenašel jsem vhodný vzorek dat." };
    }
    const koefStav = {
      "Novostavba": 1.30,
      "Po rekonstrukci": 1.15,
      "Dobrý": 1.00,
      "Špatný": 0.85
    };
    const koefVlast = {
      "osobní": 1.00,
      "družstevní": 0.85
    };
    const kS = koefStav[stav_bytu] || 1.00;
    const kV = koefVlast[(vlastnictvi || '').toLowerCase()] || 1.00;
    const pricePerM2 = medianPrice * kS * kV;
    const totalPrice = pricePerM2 * parseFloat(vymera || 0);
    return {
      ok: true,
      mid: Math.round(totalPrice),
      low: Math.round(totalPrice * 0.88),
      high: Math.round(totalPrice * 1.12),
      per_m2: Math.round(pricePerM2),
      n: count,
      confidence: count >= 20 ? "vysoká" : (count >= 5 ? "střední" : "nízká"),
      note: `Vzorek: ${usedLevel} (n=${count})`
    };
  }

  // === DOMY ===
  const KOEF_TYP_DOMU = {
    "rodinný dům": 1.00,
    "radovy": 0.92, "řadový": 0.92,
    "dvojdum": 0.96, "dvojdům": 0.96,
    "vila": 1.15,
    "chata": 0.70, "chalupa": 0.70, "chata/chalupa": 0.70
  };
  function coefTypDomu(s) {
    if (!s) return 1.00;
    const k = s.toLowerCase().trim();
    return KOEF_TYP_DOMU[k] != null ? KOEF_TYP_DOMU[k] : 1.00;
  }
  function coefVelikost(pp) {
    const x = Number(pp)||0;
    if (x < 80) return 1.10;
    if (x < 120) return 1.05;
    if (x < 160) return 1.00;
    if (x < 220) return 0.90;
    return 0.80;
  }
  function coefStav(s) {
    const t = (s||"").toLowerCase();
    if (t.includes("novostav")) return 1.40;
    if (t.includes("rekon")) return 1.20;
    if (t.includes("hor")) return 0.80;
    if (t.includes("dob")) return 1.00;
    return 1.00;
  }
  function coefZatepleni(z) {
    const t = (z || "").toUpperCase();
    if (t === "ANO") return 1.10;  // +10%
    if (t === "NE") return 0.93;   // -7%
    return 1.00;
  }
  function coefOkna(o) {
    const t = (o || "").toUpperCase();
    if (t === "ANO") return 1.06;  // +6%
    if (t === "NE") return 0.96;   // -4%
    return 1.00;
  }
  function parkSurchargeCZK(baselineM2, parkovani) {
    const b = Number(baselineM2)||0;
    let band = "mid";
    if (b < 35000) band = "low";
    else if (b > 70000) band = "high";
    const P = {
      "žádné":   {low:0, mid:0, high:0},
      "zadne":   {low:0, mid:0, high:0},
      "stání":   {low:60000, mid:100000, high:160000},
      "stani":   {low:60000, mid:100000, high:160000},
      "garáž 1×":{low:180000, mid:300000, high:480000},
      "garaz 1": {low:180000, mid:300000, high:480000},
      "garáž 2×":{low:300000, mid:500000, high:800000},
      "garaz 2": {low:300000, mid:500000, high:800000}
    };
    const key = (parkovani||"").toLowerCase().trim();
    const row = P[key];
    if (!row) return 0;
    return row[band];
  }
  function estimateDum(rows, params) {
    if (!rows || !rows.length) {
      return { ok: false, reason: "Data nejsou k dispozici." };
    }
    const { adresa, typ_stavby, zatepleni, okna, vymera, stav, typ_domu, parkovani } = params;
    const loc = parseLocation(adresa);
    const targetObec = loc.obec;
    if (!targetObec) {
      return { ok: false, reason: "Nepodařilo se rozpoznat obec z adresy." };
    }
    const geo = findGeoContext(rows, targetObec);
    const typNorm = (typ_stavby || '').toLowerCase();
    const cascades = [
      { label: `obec "${targetObec}" + typ "${typ_stavby}"`,
        filter: r => eqObec(r.obec, targetObec) && 
          (r.typ_stavby || '').toLowerCase() === typNorm,
        useTypCoef: false },
      { label: `okres "${geo.okres}" + typ "${typ_stavby}"`,
        filter: r => geo.okres && eqOkres(r.okres, geo.okres) &&
          (r.typ_stavby || '').toLowerCase() === typNorm,
        useTypCoef: false },
      { label: `kraj "${geo.kraj}" + typ "${typ_stavby}"`,
        filter: r => geo.kraj && eqKraj(r.kraj, geo.kraj) &&
          (r.typ_stavby || '').toLowerCase() === typNorm,
        useTypCoef: false },
      { label: `ČR + typ "${typ_stavby}"`,
        filter: r => (r.typ_stavby || '').toLowerCase() === typNorm,
        useTypCoef: false },
      { label: `obec "${targetObec}" (mix typů)`,
        filter: r => eqObec(r.obec, targetObec),
        useTypCoef: true },
      { label: `okres "${geo.okres}" (mix typů)`,
        filter: r => geo.okres && eqOkres(r.okres, geo.okres),
        useTypCoef: true },
      { label: `kraj "${geo.kraj}" (mix typů)`,
        filter: r => geo.kraj && eqKraj(r.kraj, geo.kraj),
        useTypCoef: true },
      { label: "ČR – všechny domy",
        filter: r => true,
        useTypCoef: true }
    ];
    let medianPrice = null;
    let usedLevel = null;
    let count = 0;
    let useTypCoef = false;
    for (const cascade of cascades) {
      const filtered = rows.filter(cascade.filter);
      const prices = filtered.map(r => Number(r.cena_m2)).filter(p => isFinite(p));
      if (prices.length > 0) {
        medianPrice = median(prices);
        usedLevel = cascade.label;
        count = prices.length;
        useTypCoef = cascade.useTypCoef;
        break;
      }
    }
    if (!medianPrice || !isFinite(medianPrice)) {
      return { ok: false, reason: "Nenašel jsem vhodný vzorek dat." };
    }
    let kK = 1.0;
    if (useTypCoef) {
      if (typNorm.includes('dřev')) kK = 0.90;
      else if (typNorm.includes('smíšen')) kK = 0.95;
      else if (typNorm && !typNorm.includes('cihl')) kK = 0.85;
    }
    const kTypDomu = coefTypDomu(typ_domu);
    const kVel = coefVelikost(vymera);
    const kStav = coefStav(stav);

    // NOVÁ LOGIKA: Zateplení a okna se počítají JEN pro staré domy
    let kZatepleni = 1.0;
    let kOkna = 1.0;

    const stavNorm = (stav || "").toLowerCase();
    if (!stavNorm.includes("novostav")) {
      // Jen pro staré domy má smysl rozlišovat zateplení a okna
      kZatepleni = coefZatepleni(zatepleni);
      kOkna = coefOkna(okna);
    }

    const pricePerM2 = medianPrice * kK * kTypDomu * kVel * kStav * kZatepleni * kOkna;
    const addPark = parkSurchargeCZK(pricePerM2, parkovani);
    const totalPrice = pricePerM2 * parseFloat(vymera || 0) + addPark;

    return {
      ok: true,
      mid: Math.round(totalPrice),
      low: Math.round(totalPrice * 0.88),
      high: Math.round(totalPrice * 1.12),
      per_m2: Math.round(pricePerM2),
      n: count,
      confidence: count >= 20 ? "vysoká" : (count >= 5 ? "střední" : "nízká"),
      note: `Vzorek: ${usedLevel} (n=${count}). Koef: ${useTypCoef ? `mat=${kK}, ` : ''}typD=${kTypDomu}, vel=${kVel}, stav=${kStav}${!stavNorm.includes("novostav") ? `, zatep=${kZatepleni}, okna=${kOkna}` : ''}, park=+${Math.round(addPark)} Kč`
    };
  }

  // --- NOVÁ funkce: přesné porovnání kategorie ---
  function eqKategorie(a, b) {
    // Porovná přesně, bez úprav, s diakritikou
    return String(a).trim() === String(b).trim();
  }

  // --- Opravené estimatePozemek ---
  function estimatePozemek(rows, params) {
    if (!rows || !rows.length) {
      return { ok: false, reason: "Data nejsou k dispozici." };
    }
    const { obec, kategorie, vymera, spoluvl, podil } = params;
    const targetObec = extractMainMunicipality(normalizePraha(obec));
    const geo = findGeoContext(rows, targetObec);

    // Vždy určuj sloupec podle dat
    const field = rows[0]?.kategorie_final !== undefined ? 'kategorie_final' : 
                  (rows[0]?.kategorie !== undefined ? 'kategorie' : null);

    if (!field) {
      return { ok: false, reason: "Data nemají správnou strukturu." };
    }

    // Kategorie musí být přesně jedna z povolených
    const k = String(kategorie || '').trim();
    if (!ALLOWED_CATEGORIES.includes(k)) {
      return { ok: false, reason: `Zvolená kategorie "${k}" není povolená. Povolené: ${ALLOWED_CATEGORIES.join(', ')}` };
    }

    const cascades = [
      { label: `obec "${targetObec}" + kategorie "${k}"`,
        filter: r => eqObec(r.obec, targetObec) && eqKategorie(r[field], k) },
      { label: `okres "${geo.okres}" + kategorie "${k}"`,
        filter: r => geo.okres && eqOkres(r.okres, geo.okres) && eqKategorie(r[field], k) },
      { label: `kraj "${geo.kraj}" + kategorie "${k}"`,
        filter: r => geo.kraj && eqKraj(r.kraj, geo.kraj) && eqKategorie(r[field], k) },
      { label: `ČR + kategorie "${k}"`,
        filter: r => eqKategorie(r[field], k) },
      { label: `obec "${targetObec}" (mix kategorií)`,
        filter: r => eqObec(r.obec, targetObec) && ALLOWED_CATEGORIES.includes(r[field]) },
      { label: `okres "${geo.okres}" (mix kategorií)`,
        filter: r => geo.okres && eqOkres(r.okres, geo.okres) && ALLOWED_CATEGORIES.includes(r[field]) },
      { label: `kraj "${geo.kraj}" (mix kategorií)`,
        filter: r => geo.kraj && eqKraj(r.kraj, geo.kraj) && ALLOWED_CATEGORIES.includes(r[field]) },
      { label: "ČR – všechny pozemky",
        filter: r => ALLOWED_CATEGORIES.includes(r[field]) }
    ];

    let medianPrice = null;
    let usedLevel = null;
    let count = 0;
    for (const cascade of cascades) {
      const filtered = rows.filter(cascade.filter);
      const prices = filtered.map(r => Number(r.cena_m2)).filter(p => isFinite(p));
      if (prices.length > 0) {
        medianPrice = median(prices);
        usedLevel = cascade.label;
        count = prices.length;
        break;
      }
    }

    if (!medianPrice || !isFinite(medianPrice)) {
      return { ok: false, reason: "Nenašel jsem vhodný vzorek dat." };
    }

    const share = parseShare(spoluvl, podil);
    const penalty = sharePenaltyCoef(share);
    const totalPrice = medianPrice * parseFloat(vymera || 0) * share * penalty;

    return {
      ok: true,
      mid: Math.round(totalPrice),
      low: Math.round(totalPrice * 0.88),
      high: Math.round(totalPrice * 1.12),
      per_m2: Math.round(medianPrice),
      n: count,
      confidence: count >= 20 ? "vysoká" : (count >= 5 ? "střední" : "nízká"),
      note: `Vzorek: ${usedLevel} (n=${count}). Podíl: ${share} (penalizace ${penalty})`
    };
  }

  // --- stejná funkce pro podíl ---
  function parseShare(spoluvl, podil) {
    if ((spoluvl || '').toLowerCase() !== 'ano') return 1.0;
    let p = (podil || '').trim();
    if (!p) return 1.0;
    let percentMatch = p.match(/^(\d+(?:[.,]\d+)?)\s*%$/);
    if (percentMatch) {
      let val = parseFloat(percentMatch[1].replace(',', '.'));
      if (isFinite(val) && val > 0 && val <= 100) return val / 100;
    }
    let decMatch = p.match(/^(\d+(?:[.,]\d+)?)$/);
    if (decMatch) {
      let val = parseFloat(decMatch[1].replace(',', '.'));
      if (isFinite(val) && val > 0 && val <= 1) return val;
    }
    if (p.includes('/')) {
      const [x, y] = p.split('/').map(s => parseFloat(s.replace(',', '.')));
      if (isFinite(x) && isFinite(y) && y > 0) {
        let val = x / y;
        if (val > 0 && val <= 1) return val;
      }
    }
    return 1.0;
  }

  function sharePenaltyCoef(share) {
    if (share <= 0.2) return 0.6;
    if (share <= 0.5) return 0.7;
    if (share < 1.0)  return 0.85;
    return 1.0;
  }

  global.CG_Estimator = { estimateByt, estimateDum, estimatePozemek };

})(window);
