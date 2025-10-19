// estimator.v3.js - Smart Fallback System with Quality Gating
// v3.2 - Intelligent cascade with minimum sample requirements
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
    
    // Exact match
    if (normA === normB) return true;
    
    // Praha district matching - STRICT
    if (/praha/i.test(normA) && /praha/i.test(normB)) {
      const numA = (normA.match(/\d+/) || [])[0];
      const numB = (normB.match(/\d+/) || [])[0];
      
      // Pokud jen jeden má číslo → FALSE (Praha ≠ Praha 10)
      if ((numA && !numB) || (!numA && numB)) return false;
      
      // Oba mají číslo → musí být stejné
      if (numA && numB) return numA === numB;
      
      // Oba jsou jen "Praha" → TRUE
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
      
      return {
        ulice: parts[0],
        obec: mainObec
      };
    } else {
      const mainObec = extractMainMunicipality(normalizePraha(parts[0]));
      
      return {
        ulice: null,
        obec: mainObec
      };
    }
  };
  
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
  
  // ✨ NOVÁ FUNKCE: Disposition coefficient pro mix dat
  const getDispoCoef = (rooms) => {
    const coefs = {
      '1': 0.75,  // 1+kk/1+1
      '2': 0.90,  // 2+kk/2+1
      '3': 1.00,  // 3+kk/3+1 (baseline)
      '4': 1.10,  // 4+kk/4+1
      '5': 1.20,  // 5+kk/5+1
      '6': 1.25   // 6+kk/6+1
    };
    return coefs[rooms] || 1.0;
  };
  
  // ✨ NOVÁ FUNKCE: Confidence scoring
  const getConfidence = (level, n) => {
    if (level <= 2 && n >= 10) return { label: 'velmi vysoká', stars: '⭐⭐⭐⭐⭐', score: 5 };
    if (level <= 3 && n >= 20) return { label: 'vysoká', stars: '⭐⭐⭐⭐', score: 4 };
    if (level <= 6 && n >= 30) return { label: 'střední', stars: '⭐⭐⭐', score: 3 };
    if (level <= 8 && n >= 50) return { label: 'nízká', stars: '⭐⭐', score: 2 };
    return { label: 'velmi nízká', stars: '⭐', score: 1 };
  };
  
  // BYTY estimation with SMART FALLBACK
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
    
    console.log('[Estimator] 🏢 Byt - hledám obec:', targetObec, 'dispozice:', dispozice);
    
    const geo = findGeoContext(rows, targetObec);
    
    const d = (dispozice || '').toLowerCase().trim();
    const rooms = dispoRooms(dispozice);
    
    // ✨ SMART FALLBACK CASCADE
    const cascades = [
      // === TIER 1: HYPERLOCAL ===
      { 
        level: 1,
        label: `obec "${targetObec}" + dispozice "${dispozice}"`,
        filter: r => eqObec(r.obec, targetObec) && (r.dispozice || '').toLowerCase() === d,
        minSamples: 3,
        adjustForDispo: false
      },
      
      { 
        level: 2,
        label: `obec "${targetObec}" + ${rooms} pokoje`,
        filter: r => eqObec(r.obec, targetObec) && dispoRooms(r.dispozice) === rooms,
        minSamples: 5,
        adjustForDispo: false
      },
      
      // === TIER 2: LOCAL (wider) ===
      { 
        level: 3,
        label: `obec "${targetObec}" + všechny byty`,
        filter: r => eqObec(r.obec, targetObec),
        minSamples: 10,
        adjustForDispo: true  // ✅ Aplikovat korekci
      },
      
      // === TIER 3: REGIONAL (okres) ===
      { 
        level: 4,
        label: `okres "${geo.okres}" + dispozice "${dispozice}"`,
        filter: r => geo.okres && eqOkres(r.okres, geo.okres) && 
                     (r.dispozice || '').toLowerCase() === d,
        minSamples: 10,
        adjustForDispo: false
      },
      
      { 
        level: 5,
        label: `okres "${geo.okres}" + ${rooms} pokoje`,
        filter: r => geo.okres && eqOkres(r.okres, geo.okres) && 
                     dispoRooms(r.dispozice) === rooms,
        minSamples: 20,
        adjustForDispo: false
      },
      
      { 
        level: 6,
        label: `okres "${geo.okres}" + všechny byty`,
        filter: r => geo.okres && eqOkres(r.okres, geo.okres),
        minSamples: 30,
        adjustForDispo: true
      },
      
      // === TIER 4: MACRO (kraj) ===
      { 
        level: 7,
        label: `kraj "${geo.kraj}" + dispozice "${dispozice}"`,
        filter: r => geo.kraj && eqKraj(r.kraj, geo.kraj) && 
                     (r.dispozice || '').toLowerCase() === d,
        minSamples: 30,
        adjustForDispo: false
      },
      
      { 
        level: 8,
        label: `kraj "${geo.kraj}" + ${rooms} pokoje`,
        filter: r => geo.kraj && eqKraj(r.kraj, geo.kraj) && 
                     dispoRooms(r.dispozice) === rooms,
        minSamples: 50,
        adjustForDispo: false
      },
      
      // === TIER 5: NATIONAL ===
      { 
        level: 9,
        label: `ČR + dispozice "${dispozice}"`,
        filter: r => (r.dispozice || '').toLowerCase() === d,
        minSamples: 100,
        adjustForDispo: false
      },
      
      { 
        level: 10,
        label: `ČR + ${rooms} pokoje`,
        filter: r => dispoRooms(r.dispozice) === rooms,
        minSamples: 200,
        adjustForDispo: false
      },
      
      // === EMERGENCY ===
      { 
        level: 11,
        label: `ČR - všechny byty (emergency)`,
        filter: r => true,
        minSamples: 1,
        adjustForDispo: true
      }
    ];
    
    let medianPrice = null;
    let usedLevel = null;
    let count = 0;
    let skipped = [];
    
    // ✨ SMART SELECTION with quality gating
    for (const cascade of cascades) {
      const filtered = rows.filter(cascade.filter);
      const prices = filtered.map(r => Number(r.cena_m2)).filter(p => isFinite(p));
      
      if (prices.length < cascade.minSamples) {
        skipped.push({ level: cascade.level, label: cascade.label, n: prices.length, required: cascade.minSamples });
        console.log(`[Estimator] ⏭️  Skip level ${cascade.level}: ${cascade.label} - nedostatek vzorků (${prices.length} < ${cascade.minSamples})`);
        continue;
      }
      
      medianPrice = median(prices);
      count = prices.length;
      
      // ✨ Apply disposition adjustment if needed
      if (cascade.adjustForDispo) {
        const kD = getDispoCoef(rooms);
        console.log(`[Estimator] 🔧 Korekce dispozice: ${rooms} pokoje → koef ${kD}`);
        medianPrice = medianPrice * kD;
      }
      
      usedLevel = { ...cascade, n: count };
      
      const conf = getConfidence(cascade.level, count);
      console.log(`[Estimator] ✅ Použit level ${cascade.level}: ${cascade.label}`);
      console.log(`[Estimator] 📊 Vzorek: n=${count}, medián=${Math.round(medianPrice)} Kč/m²`);
      console.log(`[Estimator] ${conf.stars} Spolehlivost: ${conf.label} (${count} vzorků)`);
      
      if (skipped.length > 0) {
        console.log(`[Estimator] ℹ️  Přeskočeno ${skipped.length} úrovní:`, skipped);
      }
      
      break;
    }
    
    if (!medianPrice || !isFinite(medianPrice)) {
      return { ok: false, reason: "Nenašel jsem vhodný vzorek dat." };
    }
    
    // Apply state/ownership coefficients
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
    
    const conf = getConfidence(usedLevel.level, count);
    
    console.log('[Estimator] 💰 Finální výpočet:', {
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
      confidence: conf.label,
      confidenceScore: conf.score,
      note: `${conf.stars} ${usedLevel.label} (n=${count})${usedLevel.adjustForDispo ? ' + korekce dispozice' : ''}`
    };
  }
  
  // DOMY estimation (zkrácená verze - stejný princip)
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
    
    console.log('[Estimator] 🏠 Dům - hledám obec:', targetObec, 'typ:', typ_stavby);
    
    const geo = findGeoContext(rows, targetObec);
    const typNorm = (typ_stavby || '').toLowerCase();
    
    const cascades = [
      { label: `obec "${targetObec}" + typ "${typ_stavby}"`,
        filter: r => eqObec(r.obec, targetObec) && 
                     (r.typ_stavby || '').toLowerCase() === typNorm,
        minSamples: 3 },
      
      { label: `okres "${geo.okres}" + typ "${typ_stavby}"`,
        filter: r => geo.okres && eqOkres(r.okres, geo.okres) &&
                     (r.typ_stavby || '').toLowerCase() === typNorm,
        minSamples: 10 },
      
      { label: `kraj "${geo.kraj}" + typ "${typ_stavby}"`,
        filter: r => geo.kraj && eqKraj(r.kraj, geo.kraj) &&
                     (r.typ_stavby || '').toLowerCase() === typNorm,
        minSamples: 20 },
      
      { label: `ČR + typ "${typ_stavby}"`,
        filter: r => (r.typ_stavby || '').toLowerCase() === typNorm,
        minSamples: 50 },
      
      { label: `obec "${targetObec}" (všechny typy)`,
        filter: r => eqObec(r.obec, targetObec),
        minSamples: 10 },
      
      { label: `okres "${geo.okres}" (všechny typy)`,
        filter: r => geo.okres && eqOkres(r.okres, geo.okres),
        minSamples: 30 },
      
      { label: `kraj "${geo.kraj}" (všechny typy)`,
        filter: r => geo.kraj && eqKraj(r.kraj, geo.kraj),
        minSamples: 50 },
      
      { label: "ČR – všechny domy",
        filter: r => true,
        minSamples: 1 }
    ];
    
    let medianPrice = null;
    let usedLevel = null;
    let count = 0;
    
    for (const cascade of cascades) {
      const filtered = rows.filter(cascade.filter);
      const prices = filtered.map(r => Number(r.cena_m2)).filter(p => isFinite(p));
      
      if (prices.length < cascade.minSamples) {
        console.log(`[Estimator] ⏭️  Skip: ${cascade.label} (${prices.length} < ${cascade.minSamples})`);
        continue;
      }
      
      medianPrice = median(prices);
      usedLevel = cascade.label;
      count = prices.length;
      console.log(`[Estimator] ✅ Použit: ${cascade.label}, n=${count}, medián=${Math.round(medianPrice)} Kč/m²`);
      break;
    }
    
    if (!medianPrice || !isFinite(medianPrice)) {
      return { ok: false, reason: "Nenašel jsem vhodný vzorek dat." };
    }
    
    const z = (zatepleni || '').toLowerCase();
    const o = (nova_okna || '').toLowerCase();
    const kS = (z === 'ano' && o === 'ano') ? 1.30 : 
               ((z === 'ano' || o === 'ano') ? 1.15 : 1.00);
    
    const pricePerM2 = medianPrice * kS;
    const totalPrice = pricePerM2 * parseFloat(vymera || 0);
    
    return {
      ok: true,
      mid: Math.round(totalPrice),
      low: Math.round(totalPrice * 0.88),
      high: Math.round(totalPrice * 1.12),
      per_m2: Math.round(pricePerM2),
      n: count,
      confidence: count >= 30 ? "vysoká" : (count >= 10 ? "střední" : "nízká"),
      note: `Vzorek: ${usedLevel} (n=${count}). Stav: ${kS}`
    };
  }
  
  // POZEMKY estimation (zkrácená)
  function estimatePozemek(rows, params) {
    if (!rows || !rows.length) {
      return { ok: false, reason: "Data nejsou k dispozici." };
    }
    
    const { obec, kategorie, vymera, spoluvl, podil } = params;
    
    const targetObec = extractMainMunicipality(normalizePraha(obec));
    
    console.log('[Estimator] 🌳 Pozemek - hledám obec:', targetObec, 'kategorie:', kateg
