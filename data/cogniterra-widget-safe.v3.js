/* Cogniterra Chatbot Widget v2 — LIVE CHAT + CORS-safe + Lead capture */
(function(){
  const THIS_SCRIPT=document.currentScript;
  const CFG_URL=(THIS_SCRIPT && THIS_SCRIPT.getAttribute('data-config')) || (window.CGTR && window.CGTR.configUrl);
  if(!CFG_URL){console.error('[Cogniterra] Missing data-config'); return;}

  const u={
    el:(t,a={},c=[])=>{const e=document.createElement(t);
      for(const k in a){ if(k==='style'&&typeof a[k]==='object')Object.assign(e.style,a[k]);
        else if(k.startsWith('on')&&typeof a[k]==='function')e.addEventListener(k.slice(2),a[k]);
        else if(k==='class')e.className=a[k]; else e.setAttribute(k,a[k]);}
      for(const x of[].concat(c))e.append(x&&x.nodeType?x:document.createTextNode(String(x??'')));
      return e;},
    fetchJson:async(url)=>{const r=await fetch(url,{cache:'force-cache'}); if(!r.ok) throw new Error('HTTP '+r.status+' on '+url); return r.json();},
    norm:s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(),
    pickKB:(kb,q)=>{const qq=u.norm(q); if(!qq||!kb)return[]; const ws=qq.split(' ').filter(Boolean);
      return kb.map(it=>{const hay=(it.title+' '+(it.keywords||[]).join(' ')+' '+(it.text||'')).toLowerCase();
        const sc=ws.reduce((a,w)=>a+(hay.includes(w)?1:0),0); return {...it,sc};}).sort((a,b)=>b.sc-a.sc).slice(0,5);},
    scrollBottom:(el)=>{el.scrollTop=el.scrollHeight;},
    emailOk:(s)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s||''),
    phoneOk:(s)=>/^\+?\d[\d\s\-]{7,}$/.test(s||'')
  };

  const css=`:host,*{box-sizing:border-box}
  :host{--bg:#0B0F14;--text:#EAF2FF;--muted:#91A0B4;--a1:#6E7BFF;--a2:#9B6BFF}
  .wrap{background:rgba(15,21,32,.85);color:var(--text);font:14px/1.5 Inter,system-ui;width:100%;height:100%;display:flex;flex-direction:column;border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(14px)}
  header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.08)}
  header .brand{font-weight:700} header .cta{font-size:12px;color:var(--muted)}
  .chat{flex:1;overflow:auto;padding:12px}
  .msg{max-width:85%;margin:8px 0;padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);white-space:pre-wrap}
  .ai{background:rgba(255,255,255,.06)} .me{margin-left:auto;background:rgba(255,255,255,.04)}
  .input{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(255,255,255,.08)}
  .input textarea{flex:1;resize:none;min-height:42px;max-height:140px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:var(--text)}
  .btn{border:0;border-radius:12px;padding:10px 14px;cursor:pointer;background:linear-gradient(135deg,var(--a1),var(--a2));color:var(--text)}
  .typing{opacity:.8}
  .leadbox{display:flex;flex-direction:column;gap:8px;margin-top:6px}
  .leadbox input{width:100%;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:var(--text)}`;

  const mount = document.getElementById((window.CGTR && window.CGTR.containerId) || 'chatbot-container')
      || ((()=>{const d=document.createElement('div'); d.id='chatbot-container'; d.style.width='420px'; d.style.height='650px'; d.style.margin='20px auto'; document.body.appendChild(d); return d;})());
  const shadow=mount.attachShadow({mode:'open'}); const st=document.createElement('style'); st.textContent=css; shadow.append(st);
  const wrap=u.el('div',{class:'wrap'}); shadow.append(wrap);
  const hdr=u.el('header',{},[u.el('div',{class:'brand'},['Cogniterra']),u.el('div',{class:'cta'},['Férově • Transparentně • Bezpečně'])]);
  const chat=u.el('div',{class:'chat'});
  const input=u.el('div',{class:'input'}); const ta=u.el('textarea',{placeholder:'S čím vám mohu pomoci? (realitní dotazy, informace o Cogniterra)'}); const send=u.el('button',{class:'btn'},['Odeslat']);
  wrap.append(hdr,chat,input); input.append(ta,send);

  const S={cfg:null,data:{kb:[],up:null},session:Math.random().toString(36).slice(2),history:[],lead_suggested:false};

  (async()=>{
    try{
      S.cfg = await u.fetchJson(CFG_URL);
      const urls=S.cfg.data_urls||{};
      const [kb,up]=await Promise.all([urls.kb?u.fetchJson(urls.kb):[], urls.up?u.fetchJson(urls.up):null]);
      S.data={kb,up};
      addAI('Dobrý den 👋 Jsem virtuální asistent Cogniterry. S čím vám mohu pomoci?');
    }catch(e){
      addAI('Chyba načítání konfigurace: '+String(e));
    }
  })();

  function addAI(text,extra){ const b=u.el('div',{class:'msg ai'},[text]); if(extra) b.append(extra); chat.append(b); u.scrollBottom(chat); }
  function addME(text){ const b=u.el('div',{class:'msg me'},[text]); chat.append(b); u.scrollBottom(chat); }
  function typing(on){ if(on){ const t=u.el('div',{class:'msg ai typing',id:'typing'},['• • •']); chat.append(t); u.scrollBottom(chat);} else { const t=chat.querySelector('#typing'); if(t) t.remove(); }}

  function makeContext(q){
    const kbPick = u.pickKB(S.data.kb, q);
    let upLink=''; const up=S.data.up; if(up){ const map=up.map||up; const qn=u.norm(q);
      const keys = Array.isArray(map)? map.map(r=>(r.ku||r.katastr||r.obec||r.obec_key||'')) : Object.keys(map);
      for(const raw of keys.slice(0,2000)){ const kn=u.norm(String(raw)); if(kn && qn.includes(kn)){
          const rec = Array.isArray(map)? (map.find(r=>u.norm(r.ku||r.katastr||r.obec||r.obec_key||'')===kn)||{}) : (map[raw]||{});
          upLink = rec.url||rec.odkaz||rec.link||''; if(upLink) break;
      }}
    }
    return {kbPick, upLink};
  }

  async function ask(q){
    if(!q.trim()) return;
    addME(q); typing(true);
    S.history.push({role:'user',content:q}); if(S.history.length>20)S.history=S.history.slice(-20);

    // Offer lead capture when user asks
    if(/kontakt|zavolat|spojit|konzultac|kontaktujte|mohou me kontaktovat|chci kontakt/i.test(q) && !S.lead_suggested){
      S.lead_suggested=true; renderLeadBox(); typing(false); return;
    }

    const ctx=makeContext(q);
    const kbText=(ctx.kbPick||[]).map((it,i)=>`${i+1}) ${it.title}\n${(it.text||'').slice(0,700)}\nURL: ${it.url||''}`).join('\n\n') || '—';
    const messages=[
      {role:'system',content:'Odpovídej česky, přátelsky a věcně. Krátce (2–5 vět nebo odrážek). Preferuj kontext z Cogniterra KB a ÚP odkazy, nevymýšlej URL. Když jde o obecné rady mimo KB, napiš, že jde o obecný postup. Nabídni spojení se specialistou jen pokud o něj uživatel projeví zájem.'}
    ].concat(S.history.slice(-9)).concat([{role:'user',content: q + `

KONTEXT:
ÚP: ${ctx.upLink || 'není k dispozici'}
KB:
${kbText}`}]);
    const payload={secret:S.cfg.secret, model:S.cfg.model||'gpt-4o-mini', temperature:S.cfg.temperature??0.3, messages, metadata:{session_id:S.session, branch:'chat'}};
    try{
      const r=await fetch(S.cfg.chat_url,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload)});
      const j=await r.json(); typing(false);
      const ans=(j&&j.ok&&j.answer)?j.answer:'Omlouvám se, odpověď se nepodařilo získat.';
      addAI(ans + (ctx.upLink? `\n\nOdkaz na ÚP: ${ctx.upLink}` : ''));
      S.history.push({role:'assistant',content:ans}); if(S.history.length>20)S.history=S.history.slice(-20);
    }catch(e){ typing(false); addAI('AI je dočasně nedostupná. Zkuste to prosím později.'); }
  }

  function renderLeadBox(){
    const box=u.el('div',{class:'leadbox'},[
      u.el('input',{id:'lead_name',placeholder:'Jméno'}),
      u.el('input',{id:'lead_email',type:'email',placeholder:'E-mail'}),
      u.el('input',{id:'lead_phone',placeholder:'Telefon (+420...)'}),
      u.el('button',{class:'btn',onclick:saveLead},['Odeslat kontakt'])
    ]);
    addAI('Rád vás propojím se specialistou. Vyplňte prosím kontakt:', box);
  }

  async function saveLead(){
    const name=shadow.getElementById('lead_name').value.trim();
    const email=shadow.getElementById('lead_email').value.trim();
    const phone=shadow.getElementById('lead_phone').value.trim();
    if(!name||!u.emailOk(email)||!u.phoneOk(phone)){ addAI('Zkontrolujte prosím jméno, e-mail a telefon (formát +420…).'); return; }
    const payload={
      secret:S.cfg.secret, branch:'chat', session_id:S.session,
      jmeno:name, email, telefon:phone,
      message:(S.history.find(h=>h.role==='user')||{}).content||'',
      source:'chat_widget', timestamp:new Date().toISOString()
    };
    try{
      const r=await fetch(S.cfg.lead_url,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8','Accept':'application/json'},body:JSON.stringify(payload)});
      let ok=false; if(r.ok){ ok=true; try{ const j=await r.json(); ok = !!(j && (j.ok===true || j.status==='ok')); }catch(e){ /* if not JSON, still ok */ } }
      if(ok){ addAI('Děkujeme, údaje byly předány kolegům. ✅'); }
      else { addAI('Kontakt se nepodařilo odeslat. Zkuste to prosím znovu o chvíli později.'); }
    }catch(e){ addAI('Kontakt se nepodařilo odeslat. Zkuste to prosím znovu.'); }
  }

  // Send handlers
  const sendBtnClick = async()=>{ const q=ta.value; ta.value=''; await ask(q); };
  send.addEventListener('click', sendBtnClick);
  ta.addEventListener('keydown', async(e)=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); await sendBtnClick(); }});
})();