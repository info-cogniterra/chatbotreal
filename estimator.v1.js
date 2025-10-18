// estimator.v2.js - Complete rewrite based on original widget logic
(function(global){
  
  // Helper functions
  const median = arr => {
    const sorted = arr.filter(n => typeof n === 'number' && isFinite(n)).sort((a,b) => a-b);
    if (!sorted.length) return NaN;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid-1] + sorted[mid]) / 2;
  };
  
  const cleanPraha = s => {
    if (!s) return s;
    s = String(s).trim()
      .replace(/\bobvod\s+/i, '')
      .replace(/praha\s*0+(\d+)/i, 'Praha $1')
      .replace(/\s+/g, ' ')
      .trim();
    return s;
  };
  
  const eqObec = (a, b) => {
    return (cleanPraha(a) || '').toLowerCase() === (cleanPraha(b) || '').toLowerCase();
  };
  
  const dispoRooms = d => {
    const m = /^\s*(\d+)/.exec((d || '').toString());
    return m ? m[1] : '?';
  };
  
  // BYTY estimation
  function estimateByt(rows, params) {
    if (!rows || !rows.length) {
      return { ok: false, reason: "Data nejsou k dispozici." };
    }
    
    const { obec, dispozice, stav_bytu, vlastnictvi, vymera } = params;
    
    // Fallback cascade
    const d = (dispozice || '').toLowerCase().trim();
    const rooms = dispoRooms(dispozice);
    
    const cascades = [
      { label: "obec + dispozice", 
        filter: r => eqObec(r.obec, obec) && (r.dispozice || '').toLowerCase() === d },
      { label: "obec + počet místností", 
        filter: r => eqObec(r.obec, obec) && dispoRooms(r.dispozice) === rooms },
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
    
    const { obec, typ_stavby, zatepleni, nova_okna, vymera } = params;
    
    const cascades = [
      { label: "obec + typ stavby",
        filter: r => eqObec(r.obec, obec) && (r.typ_stavby || '').toLowerCase() === (typ_stavby || '').toLowerCase() },
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
    
    // Determine field name
    const field = rows[0]?.kategorie_final !== undefined ? 'kategorie_final' : 
                  (rows[0]?.kategorie !== undefined ? 'kategorie' : null);
    
    if (!field) {
      return { ok: false, reason: "Data nemají správnou strukturu." };
    }
    
    const k = (kategorie || '').toLowerCase().trim();
    
    const cascades = [
      { label: "obec + kategorie",
        filter: r => eqObec(r.obec, obec) && (r[field] || '').toLowerCase() === k },
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
