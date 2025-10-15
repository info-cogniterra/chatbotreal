
/* Cogniterra widget v6: chat + robust lead submit (dual-send)
 * PATCH2: remove `${i+1}` template literal to avoid "Unexpected token '+'" in some parsers.
 */
(function(){
  const THIS=document.currentScript;
  const CFG_URL=(THIS && THIS.getAttribute('data-config')) || (window.CGTR && window.CGTR.configUrl);
  if(!CFG_URL){ console.error('[Cogniterra] Missing data-config'); return; }

  const U={
    el:(t,a={},c=[])=>{const e=document.createElement(t);
      for(const k in a){ if(k==='style'&&typeof a[k]==='object')Object.assign(e.style,a[k]);
        else if(k.startsWith('on')&&typeof a[k]==='function')e.addEventListener(k.slice(2),a[k]);
        else if(k==='class')e.className=a[k]; else e.setAttribute(k,a[k]);}
      for(const x of[].concat(c)) e.append(x&&x.nodeType?x:document.createTextNode(String(x??''))); return e;},
    fetchJson:async u=>{const r=await fetch(u,{cache:'force-cache'}); if(!r.ok) throw new Error('HTTP '+r.status+' '+u); return r.json();},
    norm:s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(),
    pickKB:(kb,q)=>{const qq=U.norm(q); if(!qq||!kb)return[]; const ws=qq.split(' ').filter(Boolean);
      return kb.map(it=>{const hay=(it.title+' '+(it.keywords||[]).join(' ')+' '+(it.text||'')).toLowerCase();
        const sc=ws.reduce((a,w)=>a+(hay.includes(w)?1:0),0); return {...it,sc};}).sort((a,b)=>b.sc-a.sc).slice(0,5);},
    emailOk:s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s||''),
    phoneOk:s=>/^\+?\d[\d\s\-]{7,}$/.test(s||'')
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
  .leadbox input{width:100%;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#EAF2FF}`;

  const mount=document.getElementById((window.CGTR&&window.CGTR.containerId)||'chatbot-container')
    ||(()=>{const d=document.createElement('div'); d.id='chatbot-container'; d.style.width='420px'; d.style.height='650px'; d.style.margin='20px auto'; document.body.appendChild(d); return d;})();
  const shadow=mount.attachShadow({mode:'open'}); shadow.append(U.el('style',{},[css]));
  const wrap=U.el('div',{class:'wrap'}); const hdr=U.el('header',{},[U.el('div',{class:'brand'},['Cogniterra']),U.el('div',{class:'cta'},['Férově • Transparentně • Bezpečně'])]);
  const chat=U.el('div',{class:'chat'}); const input=U.el('div',{class:'input'});
  const ta=U.el('textarea',{placeholder:'S čím vám mohu pomoci? (realitní dotazy, informace o Cogniterra)'});
  const send=U.el('button',{class:'btn'},['Odeslat']); input.append(ta,send); wrap.append(hdr,chat,input); shadow.append(wrap);

  const S={cfg:null,data:{kb:[],up:null},session:Math.random().toString(36).slice(2),history:[],lead_suggested:false};

  (async()=>{
    try{
      S.cfg=await U.fetchJson(CFG_URL);
      const urls=S.cfg.data_urls||{};
      const [kb,up]=await Promise.all([urls.kb?U.fetchJson(urls.kb):[], urls.up?U.fetchJson(urls.up):null]);
      S.data={kb,up};
      addAI('Dobrý den 👋 Jsem virtuální asistent Cogniterry. S čím vám mohu pomoci?');
    }catch(e){ addAI('Chyba načítání konfigurace: '+String(e)); }
  })();

  function addAI(t,extra){
    if(/^Ráda\b/.test(t)) t=t.replace(/^Ráda\b/,'Rád');
    const b=U.el('div',{class:'msg ai'},[t]); if(extra) b.append(extra); chat.append(b); chat.scrollTop=chat.scrollHeight;
  }
  function addME(t){ const b=U.el('div',{class:'msg me'},[t]); chat.append(b); chat.scrollTop=chat.scrollHeight; }

  function makeContext(q){
    const kbPick=U.pickKB(S.data.kb,q);
    let upLink=''; const up=S.data.up; if(up){ const map=up.map||up; const qn=U.norm(q);
      const keys=Array.isArray(map)? map.map(r=>(r.ku||r.katastr||r.obec||r.obec_key||'')) : Object.keys(map);
      for(const raw of keys.slice(0,2000)){ const kn=U.norm(String(raw)); if(kn && qn.includes(kn)){
        const rec=Array.isArray(map)? (map.find(r=>U.norm(r.ku||r.katastr||r.obec||r.obec_key||'')===kn)||{}) : (map[raw]||{});
        upLink=rec.url||rec.odkaz||rec.link||''; if(upLink) break; } } }
    return {kbPick, upLink};
  }

  async function ask(q){
    if(!q.trim()) return;
    addME(q);
    S.history.push({role:'user',content:q}); if(S.history.length>20) S.history=S.history.slice(-20);

    if(/kontakt|zavolat|spojit|konzultac|kontaktujte|chci kontakt|chci byt kontaktovan/i.test(q) && !S.lead_suggested){
      S.lead_suggested=true; renderLeadBox(); return;
    }

    const ctx=makeContext(q);
    // PATCH2: build kbText without backticks interpolation
    const kbText=(ctx.kbPick||[]).map(function(it,i){
      return (i+1)+') '+it.title+'\n'+String(it.text||'').slice(0,700)+'\nURL: '+(it.url||'');
    }).join('\n\n') || '—';

    const messages=[{role:'system',content:'Odpovídej česky, stručně a věcně. Preferuj znalost Cogniterra a ÚP odkazy. Nenamáhej uživatele zbytečnými detaily.'}]
      .concat(S.history.slice(-9))
      .concat([{role:'user',content:q+'\n\nKONTEXT:\nÚP: '+(ctx.upLink||'není k dispozici')+'\nKB:\n'+kbText}]);

    try{
      const payload = {
        secret: S.cfg.secret,
        model: S.cfg.model,
        temperature: S.cfg.temperature,
        messages: JSON.stringify(messages),
        metadata: JSON.stringify({session_id:S.session,branch:'chat'})
      };
      const resp=await fetch(S.cfg.chat_url,{
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
        body:new URLSearchParams(Object.entries(payload)).toString()
      });
      const j=await resp.json().catch(()=>({}));
      const ans=(j&&j.ok&&j.answer)?j.answer:'Omlouvám se, odpověď se nepodařilo získat.';
      addAI(ans + (ctx.upLink?('\n\nOdkaz na ÚP: '+ctx.upLink):''));
      S.history.push({role:'assistant',content:ans}); if(S.history.length>20) S.history=S.history.slice(-20);
    }catch(e){ addAI('AI je dočasně nedostupná. Zkuste to prosím později.'); }
  }

  function renderLeadBox(){
    const box=U.el('div',{class:'leadbox'},[
      U.el('input',{id:'lead_name',placeholder:'Jméno'}),
      U.el('input',{id:'lead_email',type:'email',placeholder:'E-mail'}),
      U.el('input',{id:'lead_phone',placeholder:'Telefon (+420...)'}),
      U.el('button',{class:'btn',onclick:saveLead},['Odeslat kontakt'])
    ]);
    addAI('Rád vás propojím se specialistou. Vyplňte prosím kontakt:',box);
  }

  async function saveLead(){
    try{
      const btn=shadow.querySelector('.leadbox .btn'); if(btn){ btn.disabled=true; btn.textContent='Odesílám…'; }
      const name=(shadow.getElementById('lead_name')||{value:''}).value.trim();
      const email=(shadow.getElementById('lead_email')||{value:''}).value.trim();
      const phone=(shadow.getElementById('lead_phone')||{value:''}).value.trim();
      if(!name || !U.emailOk(email) || !U.phoneOk(phone)){ addAI('Zkontrolujte prosím jméno, e-mail a telefon (formát +420…).'); if(btn){btn.disabled=false;btn.textContent='Odeslat kontakt';} return; }

      const payload={secret:S.cfg.secret,branch:'chat',session_id:S.session,jmeno:name,email,telefon:phone,
        message:(S.history.find(h=>h.role==='user')||{}).content||'',source:'chat_widget',timestamp:new Date().toISOString(), path:'/lead'};

      fetch(S.cfg.lead_url,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(Object.entries(payload)).toString()}).catch(()=>{});

      let done=false; const ok=()=>{ if(!done){ done=true; addAI('Děkujeme, údaje byly předány kolegům. ✅'); } };
      const timer=setTimeout(ok,3000);

      try{
        const r=await fetch(S.cfg.lead_url,{method:'POST',mode:'cors',redirect:'follow',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:new URLSearchParams(Object.entries(payload)).toString()});
        let success=false, detail='';
        try{ const j=await r.clone().json(); success=!!(j&&(j.ok===true||j.status==='ok'||j.result==='ok')); detail=JSON.stringify(j).slice(0,160); }
        catch(_){ const t=await r.text(); success=/ok|success|ulozeno/i.test(t||''); detail=(t||'').slice(0,160); }
        clearTimeout(timer);
        if(r.ok && success) ok(); else addAI('Kontakt se nepodařilo odeslat. Zkuste to prosím znovu.'+(detail?(' ['+detail+']'):''));
      }catch(err){}

      if(btn){ btn.disabled=false; btn.textContent='Odeslat kontakt'; }
    }catch(e){ addAI('Něco se pokazilo při odesílání kontaktu. Zkuste to prosím znovu.'); }
  }

  send.addEventListener('click',()=>{ const q=ta.value; ta.value=''; ask(q); });
  ta.addEventListener('keydown',(e)=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); const q=ta.value; ta.value=''; ask(q); }});
})();
