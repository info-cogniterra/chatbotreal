// estimator.v2.js - Complete rewrite based on original widget logic
// Supports Excel data format with obec-okres-kraj structure
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
      .replace(/praha\s*[–-]\s*(\d+)/i, 'Praha $1')
      .replace(/praha\s*0+(\d+)/i, 'Praha $1')
      .replace(/\s+/g, ' ')
      .trim();
    return s;
  };
  
  const extractPrahaDistrict = s => {
    if (!s) return null;
    s = normalizePraha(s);
    const match = s.match(/praha\s+(\d+)/i);
    return match ? `Praha ${match[1]}` : null;
  };
  
  const eqObec = (a, b) => {
    const normA = (normalizePraha(a) || '').toLowerCase();
    const normB = (normalizePraha(b) || '').toLowerCase();
    
    // Exact match
    if (normA === normB) return true;
    
    // Praha district matching
    const prahaA = extractPrahaDistrict(normA);
    const prahaB = extractPrahaDistrict(normB);
    
    if (prahaA && prahaB) return prahaA.toLowerCase() === prahaB.toLowerCase();
    if (prahaA || prahaB) return false;
    
    return normA === normB;
  };
  
  const dispoRooms = d => {
    const m = /^\s*(\d+)/.exec((d || '').toString());
    return m ? m[1] : '?';
  };
  
  const parseLocation = locationStr => {
    // Format: "Ulice ČP, Obec" nebo "Obec"
    if (!locationStr) return { ulice: null, obec: null };
    
    const parts = locationStr.split(',').map(p => p.trim());
    
    if (parts.length >= 2) {
      // Has street
      return {
        ulice: parts[0],
        obec: normalizePraha(parts[parts.length - 1])
      };
    } else {
      // Just municipality
      return {
        ulice: null,
        obec: normalizePraha(parts[0])
      };
    }
  };
  
  // BYTY estimation
  function estimateByt(rows, params) {
    if (!rows || !rows.length) {
      return { ok: false, reason: "Data nejsou k dispozici." };
    }
    
    const { adresa, dispozice, stav_bytu, vlastnictvi, vymera } = params;
    
    // Parse location
    const loc = parseLocation(adresa);
    const targetObec = loc.obec;
    
    if (!targetObec) {
      return { ok: false, reason: "Nepodařilo se rozpoznat obec z adresy." };
    }
    
    console.log('[Estimator] Byt - hledám obec:', targetObec);
    
    // Fallback cascade
    const d = (dispozice || '').toLowerCase().trim();
    const rooms = dispoRooms(dispozice);
    
    const cascades = [
      { label: "obec + dispozice", 
        filter: r => eqObec(r.obec, targetObec) && (r.dispozice || '').toLowerCase() === d },
      { label: "obec + počet místností", 
        filter: r => eqObec(r.obec, targetObec) && dispoRooms(r.dispozice) === rooms },
      { label: "okres + dispozice",
        filter: r => r.okres && targetObec && 
                     r.okres.toLowerCase().includes(targetObec.toLowerCase().split(' ')[0]) &&
                     (r.dispozice || '').toLowerCase() === d },
      { label: "kraj + dispozice",
        filter: r => r.kraj && (r.dispozice || '').toLowerCase() === d },
      { label: "ČR + dispozice", 
        filter: r => (r.dispozice || '').toLowerCase() === d },
      { label: "ČR + počet místností", 
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
        console.log(`[Estimator] Použit fallback: ${cascade.label}, n=${count}`);
        break;
      }
    }
    
    if (!medianPrice || !isFinite(medianPrice)) {
      return { ok: false, reason: "Nenašel jsem vhodný vzorek dat." };
    }
    
    // Apply coefficients
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
  
  // DOMY estimation
  function estimateDum(rows, params) {
    if (!rows || !rows.length) {
      return { ok: false, reason: "Data nejsou k dispozici." };
    }
    
    const { adresa, typ_stavby, zatepleni, nova_okna, vymera } = params;
    
    // Parse location
    const loc = parseLocation(adresa);
    const targetObec = loc.obec;
    
    if (!targetObec) {
      return { ok: false, reason: "Nepodařilo se rozpoznat obec z adresy." };
    }
    
    console.log('[Estimator] Dům - hledám obec:', targetObec);
    
    const cascades = [
      { label: "obec + typ stavby",
        filter: r => eqObec(r.obec, targetObec) && 
                     (r.typ_stavby || '').toLowerCase() === (typ_stavby || '').toLowerCase() },
      { label: "obec (jakýkoliv typ)",
        filter: r => eqObec(r.obec, targetObec) },
      { label: "okres + typ stavby",
        filter: r => r.okres && targetObec &&
                     r.okres.toLowerCase().includes(targetObec.toLowerCase().split(' ')[0]) &&
                     (r.typ_stavby || '').toLowerCase() === (typ_stavby || '').toLowerCase() },
      { label: "kraj + typ stavby",
        filter: r => r.kraj && (r.typ_stavby || '').toLowerCase() === (typ_stavby || '').toLowerCase() },
      { label: "ČR + typ stavby",
        filter: r => (r.typ_stavby || '').toLowerCase() === (typ_stavby || '').toLowerCase() },
      { label: "ČR – všechny domy",
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
        console.log(`[Estimator] Použit fallback: ${cascade.label}, n=${count}`);
        break;
      }
    }
    
    if (!medianPrice || !isFinite(medianPrice)) {
      return { ok: false, reason: "Nenašel jsem vhodný vzorek dat." };
    }
    
    // Type coefficient
    let kK = 1.0;
    const typ = (typ_stavby || '').toLowerCase();
    if (typ.includes('dřev')) kK = 0.90;
    else if (typ.includes('smíšen')) kK = 0.95;
    else if (typ && !typ.includes('cihl')) kK = 0.85;
    
    // State coefficient (zatepleni + nova_okna)
    const z = (zatepleni || '').toLowerCase();
    const o = (nova_okna || '').toLowerCase();
    const kS = (z === 'ano' && o === 'ano') ? 1.30 : 
               ((z === 'ano' || o === 'ano') ? 1.15 : 1.00);
    
    const pricePerM2 = medianPrice * kK * kS;
    const totalPrice = pricePerM2 * parseFloat(vymera || 0);
    
    return {
      ok: true,
      mid: Math.round(totalPrice),
      low: Math.round(totalPrice * 0.88),
      high: Math.round(totalPrice * 1.12),
      per_m2: Math.round(pricePerM2),
      n: count,
      confidence: count >= 20 ? "vysoká" : (count >= 5 ? "střední" : "nízká"),
      note: `Vzorek: ${usedLevel} (n=${count}). Koef: typ=${kK}, stav=${kS}`
    };
  }
  
  // POZEMKY estimation
  function estimatePozemek(rows, params) {
    if (!rows || !rows.length) {
      return { ok: false, reason: "Data nejsou k dispozici." };
    }
    
    const { obec, kategorie, vymera, spoluvl, podil } = params;
    
    const targetObec = normalizePraha(obec);
    
    console.log('[Estimator] Pozemek - hledám obec:', targetObec);
    
    // Determine field name
    const field = rows[0]?.kategorie_final !== undefined ? 'kategorie_final' : 
                  (rows[0]?.kategorie !== undefined ? 'kategorie' : null);
    
    if (!field) {
      return { ok: false, reason: "Data nemají správnou strukturu." };
    }
    
    const k = (kategorie || '').toLowerCase().trim();
    
    const cascades = [
      { label: "obec + kategorie",
        filter: r => eqObec(r.obec, targetObec) && (r[field] || '').toLowerCase() === k },
      { label: "obec (jakákoliv kategorie)",
        filter: r => eqObec(r.obec, targetObec) },
      { label: "okres + kategorie",
        filter: r => r.okres && targetObec &&
                     r.okres.toLowerCase().includes(targetObec.toLowerCase().split(' ')[0]) &&
                     (r[field] || '').toLowerCase() === k },
      { label: "kraj + kategorie",
        filter: r => r.kraj && (r[field] || '').toLowerCase() === k },
      { label: "ČR + kategorie",
        filter: r => (r[field] || '').toLowerCase() === k },
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
        console.log(`[Estimator] Použit fallback: ${cascade.label}, n=${count}`);
        break;
      }
    }
    
    if (!medianPrice || !isFinite(medianPrice)) {
      return { ok: false, reason: "Nenašel jsem vhodný vzorek dat." };
    }
    
    // Calculate share
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
