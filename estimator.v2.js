// estimator.v3.js - FIXED: Roman numerals removal + better normalization
// v3.1 - Removes roman numerals from city names (Pardubice I → Pardubice)
(function(global){
  
  // Helper functions
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
  
  // ✨ NOVÁ FUNKCE: Odstranit diakritiku pro porovnávání
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
    
    // Praha - speciální handling (zachovat čísla)
    if (/praha/i.test(s)) {
      const prahaMatch = s.match(/praha\s*[.-]?\s*(\d+)/i);
      if (prahaMatch) {
        return `Praha ${prahaMatch[1]}`;
      }
      return 'Praha';
    }
    
    // Normalize všechny typy pomlček
    s = s.replace(/\s*[-–—]\s*/g, '-');
    
    // Odstranit části za pomlčkou (Pardubice I-Zelené Předměstí → Pardubice I)
    if (s.includes('-')) {
      const parts = s.split('-');
      // Pokud první část není POUZE římské číslice
      if (!/^[IVX]+$/i.test(parts[0].trim())) {
        s = parts[0].trim();
      }
    }
    
    // Odstranit závorky: Brno (střed) → Brno
    s = s.replace(/\s*\([^)]+\)/g, '').trim();
    
    // ✨ KLÍČOVÁ OPRAVA: Odstranit římské číslice na konci
    // Pardubice I → Pardubice
    // Brno II → Brno
    // ALE: Praha 10 → Praha 10 (zůstane, protože má číslo)
    s = s.replace(/\s+[IVX]+$/i, '').trim();
    
    // Odstranit tečky za římskými číslicemi (kdyby zbyly)
    s = s.replace(/\s+[IVX]+\.\s*$/i, '').trim();
    
    console.log('[Estimator] extractMainMunicipality result:', s);
    return s;
  };
  
  // ✨ VYLEPŠENÉ: Porovnání měst s normalizací diakritiky
  const eqObec = (a, b) => {
    const normA = removeDiacritics(extractMainMunicipality(normalizePraha(a)) || '');
    const normB = removeDiacritics(extractMainMunicipality(normalizePraha(b)) || '');
    
    console.log('[Estimator] Comparing:', {a, b, normA, normB, match: normA === normB});
    
    // Exact match
    if (normA === normB) return true;
    
    // Praha district matching
    if (/praha/i.test(normA) && /praha/i.test(normB)) {
      const numA = (normA.match(/\d+/) || [])[0];
      const numB = (normB.match(/\d+/) || [])[0];
      
      if (numA && numB) return numA === numB;
      return true; // Oba jsou Praha bez čísla
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
      
      console.log('[Estimator] Parsed location with street:', {
        raw: locationStr,
        ulice: parts[0],
        rawObec,
        mainObec
      });
      
      return {
        ulice: parts[0],
        obec: mainObec
      };
    } else {
      const mainObec = extractMainMunicipality(normalizePraha(parts[0]));
      
      console.log('[Estimator] Parsed location (no street):', {
        raw: locationStr,
        mainObec
      });
      
      return {
        ulice: null,
        obec: mainObec
      };
    }
  };
  
  // Helper: Find okres and kraj for target obec
  const findGeoContext = (rows, targetObec) => {
    const record = rows.find(r => eqObec(r.obec, targetObec));
    
    if (record) {
      console.log('[Estimator] Found geo context:', {
        obec: targetObec,
        okres: record.okres || '(missing)',
        kraj: record.kraj || '(missing)'
      });
      
      return {
        okres: record.okres || null,
        kraj: record.kraj || null
      };
    }
    
    console.log('[Estimator] No geo context found for:', targetObec);
    return { okres: null, kraj: null };
  };
  
  // BYTY estimation
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
    
    console.log('[Estimator] Byt - hledám obec:', targetObec);
    
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
        console.log(`[Estimator] ✅ Použit fallback: ${cascade.label}, n=${count}, medián=${Math.round(medianPrice)} Kč/m²`);
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
    
    console.log('[Estimator] Výpočet bytu:', {
      medianPrice: Math.round(medianPrice),
      kStav,
      kV,
      pricePerM2: Math.round(pricePerM2), addPark: Math.round(addPark),
      vymera,
      totalPrice: Math.round(totalPrice)
    });
    
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
  
  // DOMY estimation
  
// === House model v2 (simplified) ===
const KOEF_TYP_DOMU = {
  "rodinný dům": 1.00,
  "radovy": 0.90, "řadový": 0.90,
  "dvojdum": 0.95, "dvojdům": 0.95,
  "vila": 1.15,
  "chata": 0.80, "chalupa": 0.80, "chata/chalupa": 0.80
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
  if (t.includes("novostav")) return 1.20;
  if (t.includes("rekon")) return 1.12;
  if (t.includes("hor")) return 0.88;
  if (t.includes("dob")) return 1.00;
  return 1.00;
}
// pevná přirážka za parkování dle pásma baseline_m2
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
    
    const { adresa, typ_stavby, zatepleni, nova_okna, vymera } = params;
    
    const loc = parseLocation(adresa);
    const targetObec = loc.obec;
    
    if (!targetObec) {
      return { ok: false, reason: "Nepodařilo se rozpoznat obec z adresy." };
    }
    
    console.log('[Estimator] Dům - hledám obec:', targetObec, 'typ:', typ_stavby);
    
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
        console.log(`[Estimator] ✅ Použit fallback: ${cascade.label}, n=${count}, medián=${Math.round(medianPrice)} Kč/m², useTypCoef=${useTypCoef}`);
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
      console.log('[Estimator] ⚠️ Aplikuji koeficient typu stavby:', kK, '(nemáme přesná data pro typ)');
    } else {
      console.log('[Estimator] ✅ Máme přesná data pro typ stavby, koeficient typu nepoužit');
    }
    
    
    // --- new v2 coefficients ---
    const kTypDomu = coefTypDomu(params.typ_domu);
    const kVel = coefVelikost(vymera);
    const kStav = coefStav(params.stav);
    const pricePerM2 = medianPrice * kK * kTypDomu * kVel * kStav;
    const addPark = parkSurchargeCZK(pricePerM2, params.parkovani);
    const totalPrice = pricePerM2 * parseFloat(vymera || 0) + addPark;
        
    console.log('[Estimator] Výpočet domu:', {
      medianPrice: Math.round(medianPrice),
      kK,
      kStav,
      pricePerM2: Math.round(pricePerM2), addPark: Math.round(addPark),
      vymera,
      totalPrice: Math.round(totalPrice)
    });
    
    return {
      ok: true,
      mid: Math.round(totalPrice),
      low: Math.round(totalPrice * 0.88),
      high: Math.round(totalPrice * 1.12),
      per_m2: Math.round(pricePerM2),
      n: count,
      confidence: count >= 20 ? "vysoká" : (count >= 5 ? "střední" : "nízká"),
      note: `Vzorek: ${usedLevel} (n=${count}). Koef: ${useTypCoef ? `mat=${kK}, ` : ''}typD=${kTypDomu}, vel=${kVel}, stav=${kStav}, park=+${Math.round(addPark)} Kč`
    };
  }
  
  // POZEMKY estimation
  function estimatePozemek(rows, params) {
    if (!rows || !rows.length) {
      return { ok: false, reason: "Data nejsou k dispozici." };
    }
    
    const { obec, kategorie, vymera, spoluvl, podil } = params;
    
    const targetObec = extractMainMunicipality(normalizePraha(obec));
    
    console.log('[Estimator] Pozemek - hledám obec:', targetObec, 'kategorie:', kategorie);
    
    const geo = findGeoContext(rows, targetObec);
    
    const field = rows[0]?.kategorie_final !== undefined ? 'kategorie_final' : 
                  (rows[0]?.kategorie !== undefined ? 'kategorie' : null);
    
    if (!field) {
      return { ok: false, reason: "Data nemají správnou strukturu." };
    }
    
    const k = (kategorie || '').toLowerCase().trim();
    
    const cascades = [
      { label: `obec "${targetObec}" + kategorie "${kategorie}"`,
        filter: r => eqObec(r.obec, targetObec) && (r[field] || '').toLowerCase() === k },
      
      { label: `okres "${geo.okres}" + kategorie "${kategorie}"`,
        filter: r => geo.okres && eqOkres(r.okres, geo.okres) && 
                     (r[field] || '').toLowerCase() === k },
      
      { label: `kraj "${geo.kraj}" + kategorie "${kategorie}"`,
        filter: r => geo.kraj && eqKraj(r.kraj, geo.kraj) && 
                     (r[field] || '').toLowerCase() === k },
      
      { label: `ČR + kategorie "${kategorie}"`,
        filter: r => (r[field] || '').toLowerCase() === k },
      
      { label: `obec "${targetObec}" (mix kategorií)`,
        filter: r => eqObec(r.obec, targetObec) },
      
      { label: `okres "${geo.okres}" (mix kategorií)`,
        filter: r => geo.okres && eqOkres(r.okres, geo.okres) },
      
      { label: `kraj "${geo.kraj}" (mix kategorií)`,
        filter: r => geo.kraj && eqKraj(r.kraj, geo.kraj) },
      
      { label: "ČR – všechny pozemky",
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
        console.log(`[Estimator] ✅ Použit fallback: ${cascade.label}, n=${count}, medián=${Math.round(medianPrice)} Kč/m²`);
        break;
      }
    }
    
    if (!medianPrice || !isFinite(medianPrice)) {
      return { ok: false, reason: "Nenašel jsem vhodný vzorek dat." };
    }
    
    let share = 1.0;
    if ((spoluvl || '').toLowerCase() === 'ano') {
      let p = (podil || '').trim();
      if (/^\s*\d+(\.\d+)?\s*$/.test(p)) {
        share = parseFloat(p);
      } else if (p.includes('/')) {
        const [x, y] = p.split('/').map(s => parseFloat(s.replace(',', '.')));
        if (isFinite(x) && isFinite(y) && y > 0) {
          share = x / y;
        }
      }
      if (!isFinite(share) || share <= 0 || share > 1) share = 1.0;
    }
    
    const totalPrice = medianPrice * parseFloat(vymera || 0) * share;
    
    console.log('[Estimator] Výpočet pozemku:', {
      medianPrice: Math.round(medianPrice),
      vymera,
      share,
      totalPrice: Math.round(totalPrice)
    });
    
    return {
      ok: true,
      mid: Math.round(totalPrice),
      low: Math.round(totalPrice * 0.88),
      high: Math.round(totalPrice * 1.12),
      per_m2: Math.round(medianPrice),
      n: count,
      confidence: count >= 20 ? "vysoká" : (count >= 5 ? "střední" : "nízká"),
      note: `Vzorek: ${usedLevel} (n=${count}). Podíl: ${share}`
    };
  }
  
  global.CG_Estimator = { estimateByt, estimateDum, estimatePozemek };
  
})(window);
