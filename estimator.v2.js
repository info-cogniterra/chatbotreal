// estimator.v3.js - Complete rewrite with obec→okres→kraj→ČR fallback
// Supports Excel data format with obec-okres-kraj structure
// v3.0 - Full geographic fallback for all property types
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
      return 'Praha';
    }
    
    // Odstranit části města (formát "Město - Část")
    if (s.includes(' - ')) {
      const mainPart = s.split(' - ')[0].trim();
      if (mainPart) {
        console.log('[Estimator] Extracted main municipality:', s, '→', mainPart);
        return mainPart;
      }
    }
    
    // Odstranit části v závorce
    const withoutParens = s.replace(/\s*\([^)]+\)/g, '').trim();
    if (withoutParens !== s) {
      console.log('[Estimator] Removed parentheses:', s, '→', withoutParens);
      s = withoutParens;
    }
    
    // Odstranit označení částí typu "Brno-střed"
    if (s.includes('-')) {
      const parts = s.split('-');
      if (parts[0].trim().length > 2) {
        const mainPart = parts[0].trim();
        console.log('[Estimator] Extracted from hyphen:', s, '→', mainPart);
        return mainPart;
      }
    }
    
    return s;
  };
  
  const eqObec = (a, b) => {
    const normA = (extractMainMunicipality(normalizePraha(a)) || '').toLowerCase();
    const normB = (extractMainMunicipality(normalizePraha(b)) || '').toLowerCase();
    
    // Exact match
    if (normA === normB) return true;
    
    // Praha district matching
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
    const normA = extractMainMunicipality(normalizePraha(a)).toLowerCase();
    const normB = extractMainMunicipality(normalizePraha(b)).toLowerCase();
    return normA === normB;
  };
  
  const eqKraj = (a, b) => {
    if (!a || !b) return false;
    return a.toLowerCase().trim() === b.toLowerCase().trim();
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
    // Najít první záznam pro danou obec a získat okres/kraj
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
    
    // Získat kontext (okres, kraj) z první shody v datech
    const geo = findGeoContext(rows, targetObec);
    
    const d = (dispozice || '').toLowerCase().trim();
    const rooms = dispoRooms(dispozice);
    
    const cascades = [
      // Level 1: Obec + dispozice (nejpřesnější)
      { label: `obec "${targetObec}" + dispozice "${dispozice}"`, 
        filter: r => eqObec(r.obec, targetObec) && (r.dispozice || '').toLowerCase() === d },
      
      // Level 2: Obec + počet místností
      { label: `obec "${targetObec}" + ${rooms} pokoje`, 
        filter: r => eqObec(r.obec, targetObec) && dispoRooms(r.dispozice) === rooms },
      
      // Level 3: Okres + dispozice
      { label: `okres "${geo.okres}" + dispozice "${dispozice}"`,
        filter: r => geo.okres && eqOkres(r.okres, geo.okres) && (r.dispozice || '').toLowerCase() === d },
      
      // Level 4: Okres + počet místností
      { label: `okres "${geo.okres}" + ${rooms} pokoje`,
        filter: r => geo.okres && eqOkres(r.okres, geo.okres) && dispoRooms(r.dispozice) === rooms },
      
      // Level 5: Kraj + dispozice
      { label: `kraj "${geo.kraj}" + dispozice "${dispozice}"`,
        filter: r => geo.kraj && eqKraj(r.kraj, geo.kraj) && (r.dispozice || '').toLowerCase() === d },
      
      // Level 6: Kraj + počet místností
      { label: `kraj "${geo.kraj}" + ${rooms} pokoje`,
        filter: r => geo.kraj && eqKraj(r.kraj, geo.kraj) && dispoRooms(r.dispozice) === rooms },
      
      // Level 7: ČR + dispozice
      { label: `ČR + dispozice "${dispozice}"`, 
        filter: r => (r.dispozice || '').toLowerCase() === d },
      
      // Level 8: ČR + počet místností
      { label: `ČR + ${rooms} pokoje`, 
        filter: r => dispoRooms(r.dispozice) === rooms },
      
      // Level 9: ČR - všechny byty (poslední záchrana)
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
    
    const loc = parseLocation(adresa);
    const targetObec = loc.obec;
    
    if (!targetObec) {
      return { ok: false, reason: "Nepodařilo se rozpoznat obec z adresy." };
    }
    
    console.log('[Estimator] Dům - hledám obec:', targetObec, 'typ:', typ_stavby);
    
    const geo = findGeoContext(rows, targetObec);
    const typNorm = (typ_stavby || '').toLowerCase();
    
    const cascades = [
      // Level 1: Obec + typ stavby (nejpřesnější, nepoužívat koeficient)
      { label: `obec "${targetObec}" + typ "${typ_stavby}"`,
        filter: r => eqObec(r.obec, targetObec) && 
                     (r.typ_stavby || '').toLowerCase() === typNorm,
        useTypCoef: false },
      
      // Level 2: Okres + typ stavby (dobrý, nepoužívat koeficient)
      { label: `okres "${geo.okres}" + typ "${typ_stavby}"`,
        filter: r => geo.okres && eqOkres(r.okres, geo.okres) &&
                     (r.typ_stavby || '').toLowerCase() === typNorm,
        useTypCoef: false },
      
      // Level 3: Kraj + typ stavby (dobrý, nepoužívat koeficient)
      { label: `kraj "${geo.kraj}" + typ "${typ_stavby}"`,
        filter: r => geo.kraj && eqKraj(r.kraj, geo.kraj) &&
                     (r.typ_stavby || '').toLowerCase() === typNorm,
        useTypCoef: false },
      
      // Level 4: ČR + typ stavby (dobrý, nepoužívat koeficient)
      { label: `ČR + typ "${typ_stavby}"`,
        filter: r => (r.typ_stavby || '').toLowerCase() === typNorm,
        useTypCoef: false },
      
      // Level 5: Obec (jakýkoliv typ) - musíme odhadnout typ koeficientem
      { label: `obec "${targetObec}" (mix typů)`,
        filter: r => eqObec(r.obec, targetObec),
        useTypCoef: true },
      
      // Level 6: Okres (jakýkoliv typ)
      { label: `okres "${geo.okres}" (mix typů)`,
        filter: r => geo.okres && eqOkres(r.okres, geo.okres),
        useTypCoef: true },
      
      // Level 7: Kraj (jakýkoliv typ)
      { label: `kraj "${geo.kraj}" (mix typů)`,
        filter: r => geo.kraj && eqKraj(r.kraj, geo.kraj),
        useTypCoef: true },
      
      // Level 8: ČR – všechny domy (poslední záchrana)
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
    
    // Type coefficient (použít POUZE pokud nemáme přesná data)
    let kK = 1.0;
    if (useTypCoef) {
      if (typNorm.includes('dřev')) kK = 0.90;
      else if (typNorm.includes('smíšen')) kK = 0.95;
      else if (typNorm && !typNorm.includes('cihl')) kK = 0.85;
      console.log('[Estimator] ⚠️ Aplikuji koeficient typu stavby:', kK, '(nemáme přesná data pro typ)');
    } else {
      console.log('[Estimator] ✅ Máme přesná data pro typ stavby, koeficient typu nepoužit');
    }
    
    // State coefficient (zatepleni + nova_okna) - VŽDY aplikovat
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
      note: `Vzorek: ${usedLevel} (n=${count}). Koef: ${useTypCoef ? `typ=${kK}, ` : ''}stav=${kS}`
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
      // Level 1: Obec + kategorie (nejpřesnější)
      { label: `obec "${targetObec}" + kategorie "${kategorie}"`,
        filter: r => eqObec(r.obec, targetObec) && (r[field] || '').toLowerCase() === k },
      
      // Level 2: Okres + kategorie
      { label: `okres "${geo.okres}" + kategorie "${kategorie}"`,
        filter: r => geo.okres && eqOkres(r.okres, geo.okres) && 
                     (r[field] || '').toLowerCase() === k },
      
      // Level 3: Kraj + kategorie
      { label: `kraj "${geo.kraj}" + kategorie "${kategorie}"`,
        filter: r => geo.kraj && eqKraj(r.kraj, geo.kraj) && 
                     (r[field] || '').toLowerCase() === k },
      
      // Level 4: ČR + kategorie
      { label: `ČR + kategorie "${kategorie}"`,
        filter: r => (r[field] || '').toLowerCase() === k },
      
      // Level 5: Obec (jakákoliv kategorie)
      { label: `obec "${targetObec}" (mix kategorií)`,
        filter: r => eqObec(r.obec, targetObec) },
      
      // Level 6: Okres (jakákoliv kategorie)
      { label: `okres "${geo.okres}" (mix kategorií)`,
        filter: r => geo.okres && eqOkres(r.okres, geo.okres) },
      
      // Level 7: Kraj (jakákoliv kategorie)
      { label: `kraj "${geo.kraj}" (mix kategorií)`,
        filter: r => geo.kraj && eqKraj(r.kraj, geo.kraj) },
      
      // Level 8: ČR – všechny pozemky (poslední záchrana)
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
