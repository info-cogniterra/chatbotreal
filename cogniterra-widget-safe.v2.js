/* Cogniterra Chatbot Widget v2 – opravená verze */

(function(){
  const THIS_SCRIPT=document.currentScript;
  const CFG_URL=THIS_SCRIPT&&THIS_SCRIPT.getAttribute("data-config");
  if(!CFG_URL){console.error("[Cogniterra] Missing data-config attribute");return;}

  const u={
    el:(t,a={},c=[])=>{
      const e=document.createElement(t);
      for(const k in a){
        if(k==="style"&&typeof a[k]==="object")Object.assign(e.style,a[k]);
        else if(k.startsWith("on")&&typeof a[k]==="function")e.addEventListener(k.slice(2),a[k]);
        else if(k==="class")e.className=a[k];
        else e.setAttribute(k,a[k]);
      }
      for(const x of[].concat(c))e.append(x?.nodeType?x:document.createTextNode(x));
      return e;
    },
    fetchJson:async(url)=>{const r=await fetch(url,{cache:"force-cache"});if(!r.ok)throw new Error("HTTP "+r.status+" on "+url);return r.json();},
    norm:s=>(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim(),
    money:x=>(x||0).toLocaleString("cs-CZ")+" Kč"
  };

  const baseCSS=`:host,*{box-sizing:border-box}:host{--bg:#0B0F14;--text:#EAF2FF;--sub:#91A0B4;--accent1:#6E7BFF;--accent2:#9B6BFF}
  .wrap{background:rgba(15,21,32,.85);color:var(--text);font:14px Inter,system-ui;display:flex;flex-direction:column;width:100%;height:100%;border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(14px)}
  header{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.08)}
  header .brand{font-weight:700}header .cta{font-size:12px;color:var(--sub)}
  main{flex:1;overflow:auto;padding:12px}
  h2{margin:6px 0 12px;font-size:16px}
  .btn{border:0;border-radius:14px;padding:10px 14px;cursor:pointer;background:rgba(255,255,255,.06);color:var(--text)}
  .btn.primary{background:linear-gradient(135deg,var(--accent1),var(--accent2))}
  .pill{display:inline-block;padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.06);margin-right:8px;cursor:pointer}
  .pill.active{background:linear-gradient(135deg,var(--accent1),var(--accent2))}
  input,select,textarea{width:100%;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:var(--text)}
  .preview{border:1px dashed rgba(255,255,255,.15);border-radius:14px;padding:12px;margin-top:6px}
  .price{font-size:18px;font-weight:700}
  .bubble{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);padding:10px 12px;border-radius:14px;margin:6px 0}
  .ai{background:rgba(255,255,255,.06)}
  .dots::after{content:"•••";animation:blink 1s infinite}@keyframes blink{0%,100%{opacity:.2}50%{opacity:1}}`;

  const mount=document.getElementById("chatbot-container")||(()=>{const d=u.el("div",{id:"chatbot-container",style:{width:"420px",height:"650px",margin:"20px auto"}});document.body.appendChild(d);return d;})();
  const shadow=mount.attachShadow({mode:"open"});
  const style=u.el("style");style.textContent=baseCSS;shadow.append(style);
  const wrap=u.el("div",{class:"wrap"});shadow.append(wrap);
  const hdr=u.el("header",{},[u.el("div",{class:"brand"},["Cogniterra"]),u.el("div",{class:"cta"},["Odhad ceny zdarma"])]);
  const main=u.el("main");wrap.append(hdr,main);

  (async()=>{
    try{
      const cfg=await u.fetchJson(CFG_URL);
      const data=await Promise.all(Object.values(cfg.data_urls).map(u.fetchJson));
      renderHome(cfg,data);
    }catch(e){
      main.textContent="Chyba načítání konfigurace: "+e;
    }
  })();

  function renderHome(cfg,data){
    main.innerHTML="";
    const step=u.el("div",{},[
      u.el("h2",{},["Co potřebuješ?"]),
      u.el("span",{class:"pill",onclick:()=>alert("Zatím demo: nacenění")},["Chci odhad"]),
      u.el("span",{class:"pill",onclick:()=>alert("Zatím demo: ÚP")},["Řeším problém"])
    ]);
    main.append(step);
  }

  // jednoduchý toast
  function toast(msg){
    const t=u.el("div",{class:"bubble ai"},[msg]);
    main.prepend(t);
    setTimeout(()=>t.remove(),2500);
  }
})();
