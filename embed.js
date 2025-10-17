// Cogniterra embed loader (v6) — CLEAN MOBILE FIX
(function(){
  const tag = document.currentScript;
  const CFG = tag.getAttribute('data-config');
  const WIDGET = tag.getAttribute('data-widget');
  const STYLES = tag.getAttribute('data-styles');

  if(!CFG || !WIDGET){ console.error('[Cogniterra] Missing data-config or data-widget'); return; }

  window.CGTR = { configUrl: CFG, widgetUrl: WIDGET, containerId: 'chatbot-container' };

  const css = `
  .cg-launcher{
    position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:999px;
    background:linear-gradient(135deg,#6E7BFF,#9B6BFF);box-shadow:0 10px 30px rgba(0,0,0,.35);
    border:1px solid rgba(255,255,255,.15);color:#EAF2FF;display:flex;align-items:center;justify-content:center;
    cursor:pointer;z-index:2147483000;font:600 14px/1 Inter,system-ui
  }
  .cg-panel{
    position:fixed;right:20px;bottom:90px;width:420px;height:650px;z-index:2147483001;border-radius:18px;
    overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.08);
    background: rgba(17,17,17,.98);display:none
  }
  .cg-close{
    position:absolute;right:8px;top:8px;z-index:2;background:rgba(0,0,0,.35);
    color:#EAF2FF;border:1px solid rgba(255,255,255,.12);
    border-radius:10px;padding:4px 8px;cursor:pointer;font:500 12px Inter,system-ui
  }
  .cg-open{ overflow:hidden; touch-action:none; overscroll-behavior:contain }
  /* Mobile full-screen panel */
  @media (max-width: 480px){
    .cg-panel{
      left:0;right:0;bottom:0;top:auto;width:100%;height:100dvh;max-height:100dvh;border-radius:16px 16px 0 0;
      background: rgba(17,17,17,.98);
    }
    .cg-launcher{ right:16px; bottom:16px; }
  }`;
  const style=document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  if(STYLES){ const link=document.createElement('link'); link.rel='stylesheet'; link.href=STYLES; document.head.appendChild(link); }

  const btn=document.createElement('div'); btn.className='cg-launcher'; btn.setAttribute('aria-label','Otevřít chat'); btn.innerHTML = '💬'; document.body.appendChild(btn);
  const panel=document.createElement('div'); panel.className='cg-panel';
  const close=document.createElement('button'); close.className='cg-close'; close.innerHTML = 'Zavřít'; panel.appendChild(close);
  const cont=document.createElement('div'); cont.id=window.CGTR.containerId; cont.style.width='100%'; cont.style.height='100%';
  panel.appendChild(cont); document.body.appendChild(panel);

  function loadWidget(){
    if(panel.__loaded) return;
    panel.__loaded = true;
    const s=document.createElement('script'); s.src=WIDGET; s.defer=true;
    document.body.appendChild(s);
  }

  function openPanel(){
    loadWidget();
    panel.style.display='block';
    document.body.classList.add('cg-open');
    btn.style.opacity='0'; btn.style.pointerEvents='none';
  }
  function closePanel(){
    panel.style.display='none';
    document.body.classList.remove('cg-open');
    btn.style.opacity=''; btn.style.pointerEvents='';
  }

  btn.addEventListener('click', openPanel);
  close.addEventListener('click', closePanel);
})();