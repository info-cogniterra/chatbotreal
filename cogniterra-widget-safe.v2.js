/*
  Cogniterra Chatbot Widget — v2 (standalone, no deps)
  ----------------------------------------------------
  • Premium glass UI, CZ locale, dark by default
  • Loads config from the <script data-config> attribute
  • Reads data maps (byty/domy/pozemky, up) from CDN (GitHub Pages)
  • Multi-step flow: Rozcestník → Typ/Lokalita → Parametry → Náhled odhadu → Gate → Odeslání
  • Price lookup per OBEC (Praha X supported). Pozemky: input KÚ → lookup to obec via up.json
  • Posts leads to Google Apps Script /lead, optional /chat to OpenAI via Apps Script proxy
  • Renders into #chatbot-container (if present); otherwise creates a full-page panel
*/

(function(){
  const THIS_SCRIPT = document.currentScript;
  const CFG_URL = THIS_SCRIPT && THIS_SCRIPT.getAttribute('data-config');
  if(!CFG_URL){ console.error('[Cogniterra] Missing data-config attribute'); return; }

  // Minimal utility set ------------------------------------------------------
  const u = {
    el:(tag, attrs={}, children=[])=>{
      const e=document.createElement(tag);
      for(const k in attrs){
        if(k==='style' && typeof attrs[k]==='object') Object.assign(e.style, attrs[k]);
        else if(k.startsWith('on') && typeof attrs[k]==='function') e.addEventListener(k.slice(2), attrs[k]);
        else if(k==='class') e.className = attrs[k];
        else e.setAttribute(k, attrs[k]);
      }
      for(const c of [].concat(children)) e.append(c.nodeType?c:document.createTextNode(c));
      return e;
    },
    sleep:ms=>new Promise(r=>setTimeout(r,ms)),
    norm:s=> (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(),
    money:x=> (x||0).toLocaleString('cs-CZ') + ' Kč',
    num:x=> Number(x)||0,
    take:(obj,pathArr)=>{ try{ return pathArr.reduce((o,k)=> (o&&k in o)?o[k]:undefined, obj);}catch(_){return undefined;} },
    fetchJson: async(url)=>{ const r=await fetch(url,{cache:'force-cache'}); if(!r.ok) throw new Error('HTTP '+r.status+' on '+url); return r.json(); },
  };

  // Styles (glass) injected in shadow to avoid bleed ------------------------
  const baseCSS = `:host, *{box-sizing:border-box} :host{--bg:#0B0F14;--surface-rgba:rgba(15,21,32,.85);--text:#EAF2FF;--sub:#91A0B4;--accent1:#6E7BFF;--accent2:#9B6BFF}
  .wrap{background:var(--surface-rgba); color:var(--text); font:14px/1.5 Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial; width:100%; height:100%; display:flex; flex-direction:column; border-radius:18px; box-shadow:0 12px 40px rgba(0,0,0,.35); border:1px solid rgba(255,255,255,.08); backdrop-filter: blur(14px);}
  header{display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid rgba(255,255,255,.08)}
  header .brand{font-weight:700; letter-spacing:.2px}
  header .cta{font-size:12px; color:var(--sub)}
  main{flex:1; overflow:auto; padding:12px}
  .step{max-width:640px; margin:0 auto}
  h2{margin:6px 0 12px; font-size:16px}
  .row{display:flex; gap:10px; margin-bottom:10px}
  .col{flex:1}
  label{display:block; font-size:12px; color:var(--sub); margin:4px 0}
  input, select, textarea{width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.04); color:var(--text)}
  textarea{min-height:92px}
  .btns{display:flex; gap:8px; justify-content:flex-end; margin-top:12px}
  .btn{border:0; border-radius:14px; padding:10px 14px; cursor:pointer; background:rgba(255,255,255,.06); color:var(--text)}
  .btn.primary{background: linear-gradient(135deg, var(--accent1), var(--accent2))}
  .pill{display:inline-block; padding:8px 12px; border-radius:999px; background:rgba(255,255,255,.06); margin-right:8px; cursor:pointer}
  .pill.active{background: linear-gradient(135deg, var(--accent1), var(--accent2))}
  .hint{color:var(--sub); font-size:12px}
  .error{color:#ff9aa3; font-size:12px; margin-top:-4px; margin-bottom:8px}
  .preview{border:1px dashed rgba(255,255,255,.15); border-radius:14px; padding:12px; margin-top:6px}
  .price{font-size:18px; font-weight:700}
  .bubble{background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); padding:10px 12px; border-radius:14px; margin:6px 0}
  .ai{background:rgba(255,255,255,.06)}
  .dots{display:inline-block; width:24px; text-align:center}
  .dots::after{content:'•••'; animation:blink 1s infinite}
  @keyframes blink{0%,100%{opacity:.2}50%{opacity:1}}
  footer{padding:8px 12px; border-top:1px solid rgba(255,255,255,.08); display:flex; gap:8px}
  `;

  // Render container (shadow root)
  const host = (function ensureHost(){
    let mount = document.getElementById('chatbot-container');
    if(!mount){ mount = u.el('div',{id:'chatbot-container', style:{width:'420px', height:'650px', margin:'20px auto'}}); document.body.appendChild(mount); }
    const shadow = mount.attachShadow({mode:'open'});
    const style = u.el('style'); style.textContent = baseCSS; shadow.append(style);
    const wrap = u.el('div',{class:'wrap'});
    shadow.append(wrap);
    return {shadow, wrap};
  })();

  // State -------------------------------------------------------------------
  const S = {
    cfg:null, data:{byty:null, domy:null, pozemky:null, up:null},
    flow:{ branch:null, typ:null },
    form:{ adresa:'', obec:'', prahaCast:'', ku:'', vymera:'', dispozice:'', stav:'', vlastnictvi:'', kategorie:'', zasitovani:'', popis:'' },
    price:{ median:0, min:0, max:0, source:'' },
    session: Math.random().toString(36).slice(2),
    chat:{history:[]}
  };

  // Boot: load config + data ------------------------------------------------
  (async function boot(){
    const hdr = u.el('header',{},[u.el('div',{class:'brand'},['Cogniterra']), u.el('div',{class:'cta'},['Odhad ceny zdarma'])]);
    const main = u.el('main');
    host.wrap.append(hdr, main);
    main.append(u.el('div',{class:'step'},[u.el('h2',{},['Načítám konfiguraci…']), u.el('div',{class:'hint'},[CFG_URL])]))

    try{
      S.cfg = await u.fetchJson(CFG_URL);
      const urls = S.cfg.data_urls||{};
      const [byty, domy, pozemky, up] = await Promise.all([
        urls.byty?u.fetchJson(urls.byty):Promise.resolve(null),
        urls.domy?u.fetchJson(urls.domy):Promise.resolve(null),
        urls.pozemky?u.fetchJson(urls.pozemky):Promise.resolve(null),
        urls.up?u.fetchJson(urls.up):Promise.resolve(null)
      ]);
      S.data = {byty, domy, pozemky, up};
      renderHome();
    }catch(err){
      main.innerHTML='';
      main.append(u.el('div',{class:'step'},[
        u.el('h2',{},['Chyba načítání dat']),
        u.el('div',{class:'error'},[String(err)]),
        u.el('div',{class:'hint'},['Zkontroluj URL v widget_config.json a CORS (GitHub Pages).'])
      ]));
    }
  })();

  // Views -------------------------------------------------------------------
  function renderHome(){
    const main = host.wrap.querySelector('main');
    main.innerHTML='';
    const step = u.el('div',{class:'step'});
    step.append(
      u.el('h2',{},['Co potřebuješ?']),
      u.el('div',{},[
        btnPill('Chci odhad',()=>{ S.flow.branch='A'; renderTyp(); }),
        btnPill('Řeším problém',()=>{ S.flow.branch='B'; renderProblem(); })
      ])
    );
    main.append(step);
  }

  function btnPill(label, on){ const b=u.el('span',{class:'pill'},[label]); b.addEventListener('click',on); return b; }

  function renderTyp(){
    const main = host.wrap.querySelector('main');
    main.innerHTML='';
    const step = u.el('div',{class:'step'});
    step.append(u.el('h2',{},['Co budeme naceňovat?']));
    const row = u.el('div',{class:'row'});
    ['Byt','Dům','Pozemek'].forEach(t=>{
      const b=btnPill(t,()=>{ S.flow.typ=t.toLowerCase(); renderLokalita(); });
      row.append(b);
    });
    step.append(row, u.el('div',{class:'btns'},[
      u.el('button',{class:'btn', onclick:()=>renderHome()},['Zpět'])
    ]));
    main.append(step);
  }

  function renderLokalita(){
    const main = host.wrap.querySelector('main');
    main.innerHTML='';
    const step = u.el('div',{class:'step'});
    step.append(u.el('h2',{},[ S.flow.typ==='pozemek'?'Lokalita pozemku (KÚ)':'Adresa / obec' ]));

    if(S.flow.typ==='pozemek'){
      const iKU = u.el('input',{placeholder:'Katastrální území (KÚ) – např. Hostavice', value:S.form.ku, oninput:e=>S.form.ku=e.target.value});
      step.append(labelWrap('KÚ', iKU), u.el('div',{class:'hint'},['Zadej KÚ, obec zjistíme z registru.']));
    } else {
      const iAdr = u.el('input',{placeholder:'Ulice a obec / Praha X (např. Vinohrady, Praha 2)', value:S.form.adresa, oninput:e=>S.form.adresa=e.target.value});
      step.append(labelWrap('Ulice + obec / Praha X', iAdr), u.el('div',{class:'hint'},['Pro výpočet používáme klíč obce (Praha 1–22 se bere samostatně).']));
    }

    step.append(u.el('div',{class:'btns'},[
      u.el('button',{class:'btn', onclick:()=>renderTyp()},['Zpět']),
      u.el('button',{class:'btn primary', onclick:onLokalitaNext},['Pokračovat'])
    ]));
    main.append(step);
  }

  function labelWrap(text, input){
    return u.el('div',{class:'col'},[u.el('label',{},[text]), input]);
  }

  function onLokalitaNext(){
    if(S.flow.typ==='pozemek'){
      const ku = S.form.ku.trim();
      if(!ku){ return toast('Vyplň prosím KÚ.'); }
      const ob = kuToObec(ku);
      if(!ob){ return toast('K tomuto KÚ jsme nenašli obec v registru ÚP.'); }
      S.form.obec = ob;
    } else {
      const adr = S.form.adresa.trim();
      if(!adr){ return toast('Vyplň prosím adresu / obec.'); }
      S.form.obec = deriveObecFromAddress(adr); // simple heuristic, user’s data model očekává "Praha X" / obec
    }
    renderParametry();
  }

  function kuToObec(ku){
    const up = S.data.up; if(!up) return '';
    const key = u.norm(ku);
    // up.v1.json expected structure: { map: { "hostavice": { obec:"Praha 14", ... } } } or array
    const byMap = up.map||up;
    if(Array.isArray(byMap)){
      const hit = byMap.find(r=> u.norm(r.katastr||r.ku)===key || (r.alias_katastr && u.norm(r.alias_katastr)===key));
      return hit? (hit.obec || hit.obec_key || '') : '';
    } else if(byMap && typeof byMap==='object'){
      const rec = byMap[key];
      return rec? (rec.obec || rec.obec_key || '') : '';
    }
    return '';
  }

  function deriveObecFromAddress(a){
    // Minimal heuristic: take last comma-separated token as municipality, support "Praha X"
    const t = a.split(',').map(s=>s.trim());
    let last = t[t.length-1]||a; // e.g., "Praha 2" or "Brno"
    // normalize Praha parts like "Praha 02" -> "Praha 2"
    const m = /praha\s*0*(\d{1,2})/i.exec(last);
    if(m){ return `Praha ${Number(m[1])}`; }
    return last;
  }

  function renderParametry(){
    const main = host.wrap.querySelector('main');
    main.innerHTML='';
    const s = u.el('div',{class:'step'});
    s.append(u.el('h2',{},['Parametry']));

    if(S.flow.typ==='byt'){
      s.append(
        labelWrap('Obec / Praha X', u.el('input',{value:S.form.obec, oninput:e=>S.form.obec=e.target.value})),
        labelWrap('Dispozice', select(['1kk','2kk','3kk','4kk+'], v=>S.form.dispozice=v, S.form.dispozice)),
        labelWrap('Stav bytu', select(['novy','rekonstrukce','puvodni'], v=>S.form.stav=v, S.form.stav)),
        labelWrap('Výměra (m²)', u.el('input',{type:'number', min:'1', value:S.form.vymera, oninput:e=>S.form.vymera=e.target.value})),
        labelWrap('Vlastnictví', select(['osobni','druzstevni'], v=>S.form.vlastnictvi=v, S.form.vlastnictvi)),
        labelWrap('Doplňující info (volit.)', u.el('textarea',{oninput:e=>S.form.popis=e.target.value}))
      );
    } else if(S.flow.typ==='dum'){
      s.append(
        labelWrap('Obec / Praha X', u.el('input',{value:S.form.obec, oninput:e=>S.form.obec=e.target.value})),
        labelWrap('Stav domu', select(['novy','rekonstrukce','puvodni'], v=>S.form.stav=v, S.form.stav)),
        labelWrap('Výměra (m²)', u.el('input',{type:'number', min:'1', value:S.form.vymera, oninput:e=>S.form.vymera=e.target.value})),
        labelWrap('Doplňující info (volit.)', u.el('textarea',{oninput:e=>S.form.popis=e.target.value}))
      );
    } else { // pozemek
      s.append(
        labelWrap('Obec (z KÚ)', u.el('input',{value:S.form.obec, oninput:e=>S.form.obec=e.target.value})),
        labelWrap('Kategorie pozemku', select(['bydleni','ostatni'], v=>S.form.kategorie=v, S.form.kategorie)),
        labelWrap('Zasíťování', select(['zasitovany','nezasitovany'], v=>S.form.zasitovani=v, S.form.zasitovani)),
        labelWrap('Výměra (m²)', u.el('input',{type:'number', min:'1', value:S.form.vymera, oninput:e=>S.form.vymera=e.target.value})),
        labelWrap('Doplňující info (volit.)', u.el('textarea',{oninput:e=>S.form.popis=e.target.value}))
      );
    }

    s.append(u.el('div',{class:'btns'},[
      u.el('button',{class:'btn', onclick:()=>renderLokalita()},['Zpět']),
      u.el('button',{class:'btn primary', onclick:onParametryNext},['Spočítat odhad'])
    ]));
    main.append(s);
  }

  function select(options, onChange, selected){
    const sel = u.el('select',{onchange:e=>onChange(e.target.value)});
    sel.append(u.el('option',{value:''},['— vyber —']));
    options.forEach(v=> sel.append(u.el('option',{value:v, selected:String(v)===String(selected)},[v])) );
    return sel;
  }

  function onParametryNext(){
    const f=S.form; const type=S.flow.typ;
    if(!f.obec) return toast('Doplň prosím obec.');
    if(!f.vymera || Number(f.vymera)<=0) return toast('Zadej platnou výměru.');

    // Lookup median Kč/m2
    const {median, source, n} = lookupMedian(type, f);
    if(!median){ return toast('Pro zadanou kombinaci se nepodařilo najít referenční cenu. Zkus jinou obec / parametry.'); }

    const vymera = Number(f.vymera);
    const mid = median * vymera;
    const min = mid * 0.9; // viz zadání: jednoduché ±10 %
    const max = mid * 1.1;
    S.price = { median:mid, min, max, source:(source||'obec') + (n?` (n=${n})`:'') };
    renderPreview();
  }

  function lookupMedian(type, f){
    const metaOrder = ['obec','okres','kraj','cr'];
    const keyObec = u.norm(f.obec).replace(/\s?\b(mesto|obec)\b/g,'');
    const maps = S.data;
    let pack=null;
    if(type==='byt') pack=maps.byty; else if(type==='dum') pack=maps.domy; else pack=maps.pozemky;
    if(!pack) return {median:0};
    const map = pack.map || pack; // tolerate either {map:{...}} or {...}

    function readOb(obj){
      const node = obj[keyObec] || obj[f.obec] || obj[keyObec?.replace(/  +/g,' ')];
      return node;
    }

    function takeMedian(node){
      if(!node) return 0;
      if(typeof node==='number') return node;
      if(node.median) return node.median;
      // nested selectors by known dims
      const path = [];
      if(type==='byt'){
        if(f.dispozice && node[f.dispozice]) path.push(f.dispozice);
        if(path.length && f.stav && node[path[0]] && node[path[0]][f.stav]) path.push(f.stav);
        let leaf = path.length? u.take(node,path): node;
        if(leaf && leaf.median) return leaf.median;
      } else if(type==='dum'){
        if(f.stav && node[f.stav]) { const leaf=node[f.stav]; if(leaf.median) return leaf.median; }
      } else { // pozemek
        const keyCat = f.kategorie && node[f.kategorie] ? f.kategorie : null;
        const keyZ = f.zasitovani && (node[f.zasitovani] || (keyCat && node[keyCat] && node[keyCat][f.zasitovani])) ? f.zasitovani : null;
        let leaf = node;
        if(keyCat) leaf = leaf[keyCat];
        if(keyZ && leaf && leaf[keyZ]) leaf = leaf[keyZ];
        if(leaf && leaf.median) return leaf.median;
      }
      return 0;
    }

    // Try obec-level
    let node = (typeof map==='object')? readOb(map) : null;
    let med = takeMedian(node);
    let source='obec'; let n=(node&&node.n)||undefined;

    if(!med){ // fallbacks if provided in meta
      const meta = pack.meta||{};
      const fb = Array.isArray(meta.fallback)?meta.fallback:metaOrder;
      for(const level of fb){
        if(level==='obec') continue;
        const lvlNode = map[level];
        if(!lvlNode) continue;
        const anyKey = Object.keys(lvlNode)[0];
        const candidate = lvlNode[keyObec] || lvlNode[f.okres] || lvlNode[f.kraj] || (anyKey? lvlNode[anyKey]: null);
        med = takeMedian(candidate);
        if(med){ source=level; n=(candidate&&candidate.n)||undefined; break; }
      }
    }

    return { median: med, source, n };
  }

  function renderPreview(){
    const main = host.wrap.querySelector('main');
    main.innerHTML='';
    const s = u.el('div',{class:'step'});
    const f=S.form, p=S.price;
    s.append(
      u.el('h2',{},['Náhled odhadu']),
      u.el('div',{class:'preview'},[
        u.el('div',{},['Lokalita: ', u.el('strong',{},[f.obec||'-'])]),
        (S.flow.typ==='pozemek' ? u.el('div',{},['KÚ: ', u.el('strong',{},[f.ku||'-'])]) : null),
        u.el('div',{},['Výměra: ', u.el('strong',{},[f.vymera+' m²']),
        u.el('div',{},['Výsledek: ', u.el('span',{class:'price'},[u.money(Math.round(p.median))]), ' (', u.money(Math.round(p.min)), ' – ', u.money(Math.round(p.max)), ') ']),
        u.el('div',{class:'hint'},['Zdroj: ', p.source])
      ])
    );

    // AI explanation (optional)
    const aiBox = u.el('div',{class:'bubble ai'});
    aiBox.append(u.el('div',{},['Vysvětlení (AI)']));
    const dots = u.el('span',{class:'dots'});
    aiBox.append(dots);
    s.append(aiBox);

    s.append(u.el('div',{class:'btns'},[
      u.el('button',{class:'btn', onclick:()=>renderParametry()},['Zpět']),
      u.el('button',{class:'btn primary', onclick:()=>renderGate(aiBox)},['Pokračovat'])
    ]));

    host.wrap.querySelector('main').append(s);

    // Fire chat (non-blocking)
    if(S.cfg.chat_url){ runChat(aiBox).catch(()=>{ aiBox.innerHTML='<div class="hint">AI komentář je dočasně nedostupný.</div>'; }); }
    else { aiBox.innerHTML='<div class="hint">AI není zapnutá (chat_url nenasazen).</div>'; }
  }

  async function runChat(container){
    const sys = 'Jednej stručně a věcně. Vysvětli 2–3 faktory, které zvyšují/snižují cenu. Nepřidávej nové číselné odhady.';
    const user = `Typ: ${S.flow.typ}. Obec: ${S.form.obec}. Výměra: ${S.form.vymera} m². Kategorie/parametry: dispo=${S.form.dispozice}, stav=${S.form.stav}, vlastnictvi=${S.form.vlastnictvi}, zasitovani=${S.form.zasitovani}. Výsledek: min=${Math.round(S.price.min)}, median=${Math.round(S.price.median)}, max=${Math.round(S.price.max)} Kč.`;
    const payload = {
      secret: S.cfg.secret,
      model: S.cfg.model||'gpt-4o-mini',
      temperature: S.cfg.temperature||0.3,
      messages: [ {role:'system', content: sys}, {role:'user', content: user} ],
      metadata: { session_id:S.session, type:S.flow.typ, obec:S.form.obec, katastr:S.form.ku||'', params:S.form }
    };
    const r = await fetch(S.cfg.chat_url,{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
    const j = await r.json();
    container.innerHTML = '';
    if(j && j.ok && j.answer){ container.append(u.el('div',{},[j.answer])); }
    else container.append(u.el('div',{class:'hint'},['AI odpověď není dostupná.']));
  }

  function renderGate(aiBox){
    const main = host.wrap.querySelector('main');
    main.innerHTML='';
    const s = u.el('div',{class:'step'});
    s.append(u.el('h2',{},['Ještě ověření a pošleme výsledek']))
    const inJ = u.el('input',{placeholder:'Jméno', value:S.form.jmeno||'', oninput:e=>S.form.jmeno=e.target.value});
    const inE = u.el('input',{placeholder:'E‑mail', value:S.form.email||'', oninput:e=>S.form.email=e.target.value});
    const inT = u.el('input',{placeholder:'Telefon (+420…)', value:S.form.telefon||'', oninput:e=>S.form.telefon=e.target.value});
    const honeypot = u.el('input',{type:'text', style:{position:'absolute', left:'-9999px'}, tabindex:'-1', autocomplete:'off'});
    s.append(labelWrap('Jméno', inJ), labelWrap('E‑mail', inE), labelWrap('Telefon', inT), honeypot);

    s.append(u.el('div',{class:'btns'},[
      u.el('button',{class:'btn', onclick:()=>renderPreview()},['Zpět']),
      u.el('button',{class:'btn primary', onclick:()=>submitLead(honeypot.value)},['Odeslat'])
    ]));
    main.append(s);
  }

  async function submitLead(honeypotVal){
    if(honeypotVal){ return toast('Odeslání zablokováno.'); }
    const f=S.form, p=S.price;
    if(!(f.jmeno||'').trim()) return toast('Vyplň prosím jméno.');
    if(!/.+@.+\..+/.test(f.email||'')) return toast('E‑mail nevypadá správně.');
    if(!/^\+?\d{9,15}$/.test((f.telefon||'').replace(/\s+/g,''))) return toast('Telefon nevypadá správně.');
    if(!S.cfg.lead_url || !S.cfg.secret) return toast('Chybí konfigurace lead_url/secret.');

    const payload = {
      secret: S.cfg.secret,
      jmeno: f.jmeno, email: f.email, telefon: f.telefon,
      typ: S.flow.typ, obec: f.obec, katastr: f.ku||'',
      params: {
        vymera: f.vymera, dispozice: f.dispozice||'', stav: f.stav||'', vlastnictvi: f.vlastnictvi||'',
        zasitovani: f.zasitovani||'', kategorie: f.kategorie||'', popis: f.popis||''
      },
      odhad_min: Math.round(p.min), odhad_median: Math.round(p.median), odhad_max: Math.round(p.max),
      url_uzemni_plan: '', // můžeš doplnit z UP JSON pokud chceš ukládat odkaz
      session_id: S.session
    };

    try{
      const r = await fetch(S.cfg.lead_url,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const j = await r.json().catch(()=>({}));
      if(j && j.ok){ renderDone(); }
      else throw new Error(j && j.error ? j.error : 'Neznámá chyba při odesílání.');
    }catch(err){ toast('Nepodařilo se odeslat. Zkus to prosím znovu.'); console.error(err); }
  }

  function renderDone(){
    const main = host.wrap.querySelector('main');
    main.innerHTML='';
    const s = u.el('div',{class:'step'});
    s.append(
      u.el('h2',{},['Děkujeme!']),
      u.el('div',{class:'bubble'},['Odhad jsme uložili a ozveme se s dalším postupem.']),
      u.el('div',{class:'btns'},[
        u.el('button',{class:'btn primary', onclick:()=>{ renderHome(); }},['Nový odhad'])
      ])
    );
    main.append(s);
  }

  // Toast helper -------------------------------------------------------------
  function toast(msg){
    const main = host.wrap.querySelector('main');
    const t = u.el('div',{class:'bubble ai'},[msg]);
    main.prepend(t); setTimeout(()=> t.remove(), 2500);
  }

})();
