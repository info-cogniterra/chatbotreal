
// Cogniterra estimator (v1 MVP)
(function(global){
  const cfg = {
    koefStav: {
      "Novostavba": 1.30,
      "Po rekonstrukci": 1.15,
      "Dobrý": 1.00,
      "Špatný": 0.85
    },
    koefVlastnictvi: {
      "osobní": 1.00,
      "družstevní": 0.85
    }
  };

  function confidence(n, fallbackSteps){
    if(n >= 20 && fallbackSteps === 0) return "vysoká";
    if(n >= 5 && fallbackSteps <= 1) return "střední";
    return "nízká";
  }

  function pick(obj, keys){
    let ref = obj, used=0;
    for(const k of keys){
      if(ref && ref[k] != null){ ref = ref[k]; }
      else return {value:null, steps:used+1};
      used++;
    }
    return {value:ref, steps:0};
  }

  function fallbackByt(map, obec, dispozice, stav, vlast){
    let steps=0, node = map[obec];
    if(!node){ return {median:null, n:0, steps:3}; }
    // exact
    let v = (((node||{})[dispozice]||{}))[stav];
    v = (v||{})[vlast];
    if(v && v.median) return {median:v.median, n:v.n||0, steps};
    // ignore vlastnictví
    v = (((node||{})[dispozice]||{}))[stav];
    if(v){
      const any = Object.values(v)[0];
      if(any && any.median){ return {median:any.median, n:any.n||0, steps:++steps}; }
    }
    // ignore stav
    v = ((node||{})[dispozice]);
    if(v){
      // choose first available leaf
      for(const st of Object.values(v)){
        for(const own of Object.values(st)){
          if(own && own.median){ return {median:own.median, n:own.n||0, steps:steps+1}; }
        }
      }
    }
    // fallback: any in obec
    for(const disp of Object.values(node)){
      for(const st of Object.values(disp)){
        for(const own of Object.values(st)){
          if(own && own.median){ return {median:own.median, n:own.n||0, steps:steps+2}; }
        }
      }
    }
    return {median:null, n:0, steps:3};
  }

  function estimateByt(map, params){
    const { obec, dispozice, stav, vlastnictvi, vymera } = params;
    const res = fallbackByt(map, obec, dispozice, stav, vlastnictvi);
    if(!res.median){ return { ok:false, reason:"Pro tuto lokalitu nemáme dost dat." }; }
    const kStav = cfg.koefStav[stav] || 1.0;
    const kVlast = cfg.koefVlastnictvi[(vlastnictvi||'').toLowerCase()] || 1.0;
    const mid_m2 = res.median * kStav * kVlast;
    const mid = mid_m2 * vymera;
    const spread = 0.12; // ±12 %
    return {
      ok:true,
      mid: Math.round(mid),
      low: Math.round(mid*(1-spread)),
      high: Math.round(mid*(1+spread)),
      m2: Math.round(mid_m2),
      n: res.n||0,
      confidence: confidence(res.n||0, res.steps||0),
      notes: res.steps>0 ? "Použit částečný odhad (fallback)." : "Přímá shoda v datech."
    };
  }

  function fallbackDum(map, obec, typ){
    const node = map[obec]; if(!node) return {median:null,n:0,steps:2};
    let v = (node[typ]||{})['nan'] || Object.values(node[typ]||{})[0];
    if(v && v.median) return {median:v.median,n:v.n||0,steps:0};
    // any in obec
    for(const item of Object.values(node)){
      const leaf = Object.values(item||{})[0];
      if(leaf && leaf.median) return {median:leaf.median,n:leaf.n||0,steps:1};
    }
    return {median:null,n:0,steps:2};
  }

  function estimateDum(map, params){
    const { obec, typ_stavby, stav, vymera } = params;
    const res = fallbackDum(map, obec, typ_stavby);
    if(!res.median){ return {ok:false, reason:"Pro tuto lokalitu nemáme dost dat."}; }
    const kStav = cfg.koefStav[stav] || 1.0;
    const mid_m2 = res.median * kStav;
    const mid = mid_m2 * vymera;
    const spread = 0.12;
    return { ok:true, mid:Math.round(mid), low:Math.round(mid*(1-spread)), high:Math.round(mid*(1+spread)),
      m2:Math.round(mid_m2), n:res.n||0, confidence:confidence(res.n||0,res.steps||0), notes: res.steps? "Použit částečný odhad.":"Přímá shoda." };
  }

  function fallbackPoz(map, obec, kategorie){
    const node = map[obec]; if(!node) return {median:null,n:0,steps:1};
    let v = node[kategorie];
    if(v && v.median) return {median:v.median, n:v.n||0, steps:0};
    // any in obec
    v = Object.values(node||{})[0];
    if(v && v.median) return {median:v.median, n:v.n||0, steps:1};
    return {median:null,n:0,steps:2};
  }

  function estimatePozemek(map, params){
    const { obec, kategorie, vymera } = params;
    const res = fallbackPoz(map, obec, kategorie);
    if(!res.median){ return {ok:false, reason:"Pro tuto lokalitu nemáme dost dat."}; }
    const mid_m2 = res.median;
    const mid = mid_m2 * vymera;
    const spread = 0.12;
    return { ok:true, mid:Math.round(mid), low:Math.round(mid*(1-spread)), high:Math.round(mid*(1+spread)),
      m2:Math.round(mid_m2), n:res.n||0, confidence:confidence(res.n||0,res.steps||0),
      notes: res.steps? "Použit částečný odhad.":"Přímá shoda."};
  }

  global.CG_Estimator = { cfg, estimateByt, estimateDum, estimatePozemek };
})(window);
