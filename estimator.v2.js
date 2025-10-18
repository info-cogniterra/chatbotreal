// estimator.v2.js - Complete rewrite based on original widget logic
// Supports Excel data format with obec-okres-kraj structure
// v2.1 - Fixed municipality parsing (removes city parts like "Teplice - Nová Ves" → "Teplice")
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
  
  const extractMainMunicipality = s => {
    if (!s) return null;
    
    s = String(s).trim();
    
    // Praha - speciální handling
    if (/praha/i.test(s)) {
      const prahaMatch = s.match(/praha\s*(\d+)/i);
      if (prahaMatch) {
        return `Praha ${prahaMatch[1]}`;
      }
      // Pokud obsahuje "Praha" ale bez čísla, vrátit jen "Praha"
      return 'Praha';
    }
    
    // Odstranit části města (formát "Město - Část")
    // Např: "Teplice - Nová Ves" → "Teplice"
    if (s.includes(' - ')) {
      const mainPart = s.split(' - ')[0].trim();
      if (mainPart) {
        console.log('[Estimator] Extracted main municipality:', s, '→', mainPart);
        return mainPart;
      }
    }
    
    // Odstranit části v závorce
    // Např: "Brno (Řečkovice)" → "Brno"
    const withoutParens = s.replace(/\s*\([^)]+\)/g, '').trim();
    if (withoutParens !== s) {
      console.log('[Estimator] Removed parentheses:', s, '→', withoutParens);
      s = withoutParens;
    }
    
    // Odstranit označení částí typu "Brno-střed"
    if (s.includes('-')) {
      const parts = s.split('-');
      // Pokud je první část město, vrátit ji
      if (parts[0].trim().length > 2) {
        const mainPart = parts[0].trim();
        console.log('[Estimator] Extracted from hyphen:', s, '→', mainPart);
        return mainPart;
      }
    }
    
    return s;
  };
  
  const extractPrahaDistrict = s => {
    if (!s) return null;
    s = normalizePraha(s);
    const match = s.match(/praha\s+(\d+)/i);
    return match ? `Praha ${match[1]}` : null;
  };
  
  const eqObec = (a, b) => {
    const normA = (extractMainMunicipality(normalizePraha(a)) || '').toLowerCase();
    const normB = (extractMainMunicipality(normalizePraha(b)) || '').toLowerCase();
    
    console.log('[Estimator] Comparing municipalities:', {
      a, 
      b, 
      normA, 
      normB,
      match: normA === normB
    });
    
    // Exact match
    if (normA === normB) return true;
    
    // Praha district matching
    if (/praha/i.test(normA) && /praha/i.test(normB)) {
      // Extrahovat čísla
      const numA = (normA.match(/\d+/) || [])[0];
      const numB = (normB.match(/\d+/) || [])[0];
      
      // Pokud obě mají čísla, porovnat je
      if (numA && numB) {
        console.log('[Estimator] Praha district match:', numA, '===', numB);
        return numA === numB;
      }
      
      // Pokud jedna nemá číslo, považovat za match (Praha obecně)
      console.log('[Estimator] Praha generic match');
      return true;
    }
    
    return false;
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
      // Just municipality
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
    
    // Fallback cascade (SIMPLIFIED - no okres/kraj)
    const d = (dispozice || '').toLowerCase().trim();
    const rooms = dispoRooms(dispozice);
    
    const cascades = [
      { label: "obec + dispozice", 
        filter: r => eqObec(r.obec, targetObec) && (r.dispozice || '').toLowerCase() === d },
      { label: "obec + počet místností", 
        filter: r => eqObec(r.obec, targetObec) && dispoRooms(r.dispozice) === rooms },
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
        console.log(`[Estimator] ✅ Použit fallback: ${cascade.label}, n=${count}, medián=${Math.round(medianPrice)} Kč/m²`);
        break;
      } else {
        console.log(`[Estimator] ❌ Fallback "${cascade.label}" nenašel žádná data`);
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
    
    console.log('[Estimator] Výpočet bytu:', {
      medianPrice: Math.round(medianPrice),
      kS,
      kV,
      pricePerM2: Math.round(pricePerM2),
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
    
    // Fallback cascade (SIMPLIFIED - no okres/kraj)
    const cascades = [
      { label: "obec + typ stavby",
        filter: r => eqObec(r.obec, targetObec) && 
                     (r.typ_stavby || '').toLowerCase() === (typ_stavby || '').toLowerCase() },
      { label: "obec (jakýkoliv typ)",
        filter: r => eqObec(r.obec, targetObec) },
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
        console.log(`[Estimator] ✅ Použit fallback: ${cascade.label}, n=${count}, medián=${Math.round(medianPrice)} Kč/m²`);
        break;
      } else {
        console.log(`[Estimator] ❌ Fallback "${cascade.label}" nenašel žádná data`);
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
    
    console.log('[Estimator] Výpočet domu:', {
      medianPrice: Math.round(medianPrice),
      kK,
      kS,
      pricePerM2: Math.round(pricePerM2),
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
      note: `Vzorek: ${usedLevel} (n=${count}). Koef: typ=${kK}, stav=${kS}`
    };
  }
  
  // POZEMKY estimation
  function estimatePozemek(rows, params) {
    if (!rows || !rows.length) {
      return { ok: false, reason: "Data nejsou k dispozici." };
    }
    
    const { obec, kategorie, vymera, spoluvl, podil } = params;
    
    const targetObec = extractMainMunicipality(normalizePraha(obec));
    
    console.log('[Estimator] Pozemek - hledám obec:', targetObec);
    
    // Determine field name
    const field = rows[0]?.kategorie_final !== undefined ? 'kategorie_final' : 
                  (rows[0]?.kategorie !== undefined ? 'kategorie' : null);
    
    if (!field) {
      return { ok: false, reason: "Data nemají správnou strukturu." };
    }
    
    const k = (kategorie || '').toLowerCase().trim();
    
    // Fallback cascade (SIMPLIFIED - no okres/kraj)
    const cascades = [
      { label: "obec + kategorie",
        filter: r => eqObec(r.obec, targetObec) && (r[field] || '').toLowerCase() === k },
      { label: "obec (jakákoliv kategorie)",
        filter: r => eqObec(r.obec, targetObec) },
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
        console.log(`[Estimator] ✅ Použit fallback: ${cascade.label}, n=${count}, medián=${Math.round(medianPrice)} Kč/m²`);
        break;
      } else {
        console.log(`[Estimator] ❌ Fallback "${cascade.label}" nenašel žádná data`);
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
