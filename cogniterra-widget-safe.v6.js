
/* Cogniterra widget v7: lead-first intents + typing indicator + ISNS & ÚP lookup
   - Keeps original UI and lead flow
   - Adds: intent detection (sell/buy/rent -> lead form), verify -> ISNS + ÚP link (asks for KÚ if missing)
   - Adds: typing indicator with ~700ms delay before rendering AI reply
   - Uses up.v1.json structure: { map: [{ku, obec, url}, ...] }
*/
(function(){
  const THIS=document.currentScript;
  const CFG_URL=(THIS && THIS.getAttribute('data-config')) || (window.CGTR && window.CGTR.configUrl);
  if(!CFG_URL){ console.error('[Cogniterra] Missing data-config'); return; }

  // preload price maps into window for estimator
  fetch(CFG_URL.replace(/widget_config\.json$/, 'prices_byty.v1.json')).then(r=>r.json()).then(j=>{ window.PRICES_BYTY = j.map || j.map || j; });
  fetch(CFG_URL.replace(/widget_config\.json$/, 'prices_domy.v1.json')).then(r=>r.json()).then(j=>{ window.PRICES_DOMY = j.map || j.map || j; });
  fetch(CFG_URL.replace(/widget_config\.json$/, 'prices_pozemky.v1.json')).then(r=>r.json()).then(j=>{ window.PRICES_POZ = j.map || j.map || j; });


  
  // Load estimator module
  (function(){ var sc=document.createElement('script'); sc.src=(window.CGTR && window.CGTR.widgetUrl? window.CGTR.widgetUrl.replace(/[^\/]+$/, 'estimator.v1.js') : 'estimator.v1.js'); document.head.appendChild(sc); })();


  // --- Mapy.cz Suggest (robust async init CLEAN) ---
  var CG_MAPY_PROMISE = null;
  function loadMapy(apiKey){
    if(CG_MAPY_PROMISE) return CG_MAPY_PROMISE;
    CG_MAPY_PROMISE = new Promise(function(resolve){
      var s=document.createElement('script'); s.src='https://api.mapy.cz/loader.js';
      s.onload=function(){
        if(window.Loader){
          window.Loader.async = true;
          window.Loader.load(null, { api:'suggest', key: apiKey, onload: function(){ resolve(true); } });
        } else { resolve(false); }
      };
      document.head.appendChild(s);
    });
    return CG_MAPY_PROMISE;
  }
  function attachSuggest(input){
    if(!input) return;
    loadMapy('EreCyrH41se5wkNErc5JEWX2eMLqnpja5BUVxsvpqzM').then(function(){
      try{ if(window.SMap && SMap.Suggest){ new SMap.Suggest(input); } }catch(_){}
    });
  }


  const U={
    el:(t,a={},c=[])=>{const e=document.createElement(t);
      for(const k in a){ if(k==='style'&&typeof a[k]==='object')Object.assign(e.style,a[k]);
        else if(k.startsWith('on')&&typeof a[k]==='function')e.addEventListener(k.slice(2),a[k]);
        else if(k==='class')e.className=a[k]; else e.setAttribute(k,a[k]);}
      for(const x of[].concat(c)) e.append(x&&x.nodeType?x:document.createTextNode(String(x??''))); return e;},
    fetchJson:async u=>{const r=await fetch(u,{cache:'force-cache'}); if(!r.ok) throw new Error('HTTP '+r.status+' '+u); return r.json();},
    norm:s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(),
    emailOk:s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s||''),
    phoneOk:s=>/^\+?\d[\d\s\-]{7,}$/.test(s||''),
  };

  const css=`:host,*{box-sizing:border-box}
  .wrap{background:rgba(15,21,32,.85);color:#EAF2FF;font:14px/1.5 Inter,system-ui;width:100%;height:100%;
    display:flex;flex-direction:column;border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(14px)}
  header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.08)}
  header .brand{font-weight:700} header .cta{font-size:12px;color:#91A0B4}
  .chat{flex:1;overflow:auto;padding:12px}
  .msg{max-width:85%;margin:8px 0;padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);white-space:pre-wrap}
  .ai{background:rgba(255,255,255,.06)} .me{margin-left:auto;background:rgba(255,255,255,.04)}
  .input{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(255,255,255,.08)}
  .input textarea{flex:1;resize:none;min-height:42px;max-height:140px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:#EAF2FF}
  .btn{border:0;border-radius:12px;padding:10px 14px;cursor:pointer;background:linear-gradient(135deg,#6E7BFF,#9B6BFF);color:#EAF2FF}
  .leadbox{display:flex;flex-direction:column;gap:8px;margin-top:6px}
  .leadbox input{width:100%;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#EAF2FF}
  .typing{display:inline-block;padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.06);margin:8px 0}
  .dots{display:inline-block;min-width:2ch}
  @keyframes blink{0%{opacity:.2}50%{opacity:1}100%{opacity:.2}}
  .dots span{animation:blink 1.4s infinite}
  .dots span:nth-child(2){animation-delay:.2s}
  .dots span:nth-child(3){animation-delay:.4s}`;

  const mount=document.getElementById((window.CGTR&&window.CGTR.containerId)||'chatbot-container')
    ||(()=>{const d=document.createElement('div'); d.id='chatbot-container'; d.style.width='420px'; d.style.height='650px'; d.style.margin='20px auto'; document.body.appendChild(d); return d;})();
  const shadow=mount.attachShadow({mode:'open'}); shadow.append(U.el('style',{},[css]));
  const wrap=U.el('div',{class:'wrap'}); const hdr=U.el('header',{},[U.el('div',{class:'brand'},['Cogniterra']),U.el('div',{class:'cta'},['Férově • Transparentně • Bezpečně'])]);
  const chat=U.el('div',{class:'chat'}); const input=U.el('div',{class:'input'});
  const ta=U.el('textarea',{placeholder:'S čím vám mohu pomoci? (prodej/pronájem, prověření ISNS, ÚP)'});
  const send=U.el('button',{class:'btn'},['Odeslat']); input.append(ta,send); wrap.append(hdr,chat,input); shadow.append(wrap);

  const S={cfg:null,data:{kb:[],up:null},session:Math.random().toString(36).slice(2),history:[],lead_suggested:false};

  (async()=>{
    try{
      S.cfg=await U.fetchJson(CFG_URL);
      const urls=S.cfg.data_urls||{};
      const [kb,up]=await Promise.all([urls.kb?U.fetchJson(urls.kb):[], urls.up?U.fetchJson(urls.up):null]);
      S.data={kb,up};
    }catch(e){ addAI('Chyba načítání konfigurace: '+String(e)); }
  })();

  function addAI(t,extra){
    if(/^Ráda\b/.test(t)) t=t.replace(/^Ráda\b/,'Rád');
    const b=U.el('div',{class:'msg ai'},[t]); if(extra) b.append(extra); chat.append(b); chat.scrollTop=chat.scrollHeight;
  }
  function addME(t){ const b=U.el('div',{class:'msg me'},[t]); chat.append(b); chat.scrollTop=chat.scrollHeight; }

  function addPanel(el){
  const wrap = U.el('div',{class:'panel'},[]);
  wrap.append(el);
  chat.append(wrap);
  chat.scrollTop = chat.scrollHeight;
}

// --- Úvodní rozcestník ---
function renderStart() {
  const cards = U.el('div', { class: 'cg-start' }, [
    U.el('div', { class: 'cg-cards' }, [
      U.el('button', { class: 'cg-card', onclick: () => startPricing(), type: 'button' }, [
        U.el('h3', {}, ['Nacenit nemovitost']),
        U.el('p', {}, ['Rychlý odhad ceny z tržních dat.'])
      ]),
      U.el('button', { class: 'cg-card', onclick: () => startHelp(), type: 'button' }, [
        U.el('h3', {}, ['Potřebuji pomoct']),
        U.el('p', {}, ['Chat s naším asistentem (problém s nemovitostí, Vaše dotazy)'])
      ])
    ])
  ]);
  addPanel(cards);
}, [
    U.el('div', { class: 'cg-cards' }, [
      // Karta 1 – nacenění
      U.el('button', { class: 'cg-card', onclick: () => startPricing(), type: 'button' }, [
        U.el('h3', {}, ['Nacenit nemovitost']),
        U.el('p', {}, ['Rychlý odhad ceny z tržních dat.'])
      ]),
      // Karta 2 – pomoc
      U.el('button', { class: 'cg-card', onclick: () => startHelp(), type: 'button' }, [
        U.el('h3', {}, ['Potřebuji pomoct']),
        U.el('p', {}, ['Chat s naším asistentem (problém s nemovitostí, Vaše dotazy)'])
      ])
    ])
  ]);

  addPanel(cards);
}

// --- Funkce kliků na karty ---
function startHelp(){
  addAI('Jsem připraven. Napište, s čím potřebujete pomoct.');
}

function startPricing(){
  S.flow = 'pricing';
  stepChooseType();
}

// --- Oprava výpočtu – kontakt před cenou ---
function stepParamsByt(obec){
  const disp = U.input('dispozice','Dispozice (např. 2+kk)');
  const stav = U.select('stav',['Novostavba','Po rekonstrukci','Dobrý','Špatný']);
  const vlast = U.select('vlastnictvi',['Osobní','Družstevní']);
  const area = U.input('vymera','Výměra (m²)','number');

  const box = U.el('div',{class:'cg-step'},[
    U.el('label',{},['Parametry bytu – ',obec]),
    disp,stav,vlast,area,
    U.el('div',{class:'cg-cta'},[
      U.el('button',{class:'cg-btn',onclick:()=>{
        const params={typ:'Byt', obec, dispozice:disp.value, stav:stav.value, vlastnictvi:vlast.value, vymera:parseFloat(area.value||0)};
        renderLeadBoxPricing(params);
      }},['Pokračovat k odhadu'])
    ])
  ]);
  addAI('Nacenění – krok 3/3', box);

function renderLeadBoxPricing(params){
    S.tempPricing = params;
    const consentId = 'cgConsent_'+(Math.random().toString(36).slice(2));
    const box=U.el('div',{class:'leadbox'},[
      U.el('div',{},['Pro ověření, že nejste robot, prosíme o zadání vašich kontaktů.']),
      U.el('input',{id:'lead_name',placeholder:'Jméno'}),
      U.el('input',{id:'lead_email',type:'email',placeholder:'E-mail'}),
      U.el('input',{id:'lead_phone',placeholder:'Telefon (+420...)'}),
      U.el('label',{},[ U.el('input',{id:consentId,type:'checkbox'}), ' Odesláním souhlasím se zásadami zpracování osobních údajů.' ]),
      U.el('button',{class:'btn',onclick:()=>saveLeadPricing(consentId)},['Odeslat a zobrazit odhad'])
    ]);
    addAI('Kontakt pro zobrazení odhadu', box);
  }

  async function saveLeadPricing(consentId){
    try{
      const btn=shadow.querySelector('.leadbox .btn'); if(btn){ btn.disabled=true; btn.innerHTML = 'Odesílám…'; }
      const name=(shadow.getElementById('lead_name')||{value:''}).value.trim();
      const email=(shadow.getElementById('lead_email')||{value:''}).value.trim();
      const phone=(shadow.getElementById('lead_phone')||{value:''}).value.trim();
      const consent = (shadow.getElementById(consentId)||{}).checked;
      if(!name || !U.emailOk(email) || !U.phoneOk(phone) || !consent){ addAI('Zkontrolujte prosím kontaktní údaje a potvrďte souhlas.'); if(btn){btn.disabled=false;btn.innerHTML='Odeslat a zobrazit odhad';} return; }

      const payload={secret:S.cfg.secret,branch:'chat',session_id:S.session,jmeno:name,email,telefon:phone,
        message:'Žádost o odhad z chatbota', source:'chat_widget_pricing',timestamp:new Date().toISOString(), path:'/lead',
        pricing_params: JSON.stringify(S.tempPricing||{}) };

      fetch(S.cfg.lead_url,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(Object.entries(payload)).toString()}).catch(()=>{});
      try{
        const r=await fetch(S.cfg.lead_url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(Object.entries(payload)).toString()});
        // ignore response; proceed to compute
      }catch(_){}

      if(btn){ btn.disabled=false; btn.innerHTML = 'Odesláno'; }
      // After lead saved, compute estimate and show
      const P=S.tempPricing||{};
      let res=null, typ=P.typ||'Byt';
      if(typ==='Byt') res = window.CG_Estimator.estimateByt(PRICES.byty, P);
      else if(typ==='Dům') res = window.CG_Estimator.estimateDum(PRICES.domy, P);
      else res = window.CG_Estimator.estimatePozemek(PRICES.pozemky, P);
      renderEstimate(res, typ);
    }catch(e){
      addAI('Něco se pokazilo při odesílání kontaktu. Zkuste to prosím znovu.');
    }
  }

  function renderEstimate(res, typ){
    if(!res.ok){ addAI('Odhad se nepodařilo spočítat: '+(res.reason||'')); return; }
    const box=U.el('div',{class:'cg-result'},[
      U.el('h4',{},[typ+': předběžný odhad']),
      U.el('div',{},['Odhad: ', fmt(res.low),' – ', fmt(res.high),' Kč (střed: ',fmt(res.mid),' Kč)']),
      U.el('div',{},['Orientační cena za m²: ', fmt(res.m2),' Kč/m²']),
      U.el('div',{class:'cg-note'},['Důvěra: ',res.confidence,'; ',res.notes]),
      U.el('div',{class:'cg-cta'},[
        U.el('button',{class:'cg-btn',onclick:()=>renderLeadBox()},['Odhad ceny zdarma']),
        U.el('button',{class:'cg-btn secondary',onclick:()=>renderStart()},['Zpět na úvod'])
      ])
    ]);
    addAI('Výsledek odhadu', box);
  }

  function cgSafeStart(){ try{ if(!shadow || !shadow.querySelector('.chat')){ return setTimeout(cgSafeStart,40); } renderStart(); }catch(e){ setTimeout(cgSafeStart,40); } }
  cgSafeStart();
  send.addEventListener('click',()=>{ const q=ta.value; ta.value=''; ask(q); });
  ta.addEventListener('keydown',(e)=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); const q=ta.value; ta.value=''; ask(q); }});
})();
