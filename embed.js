// Cogniterra embed loader (v6)
(function(){
  const tag = document.currentScript;
  const CFG = tag.getAttribute('data-config');
  const WIDGET = tag.getAttribute('data-widget');
  const STYLES = tag.getAttribute('data-styles');

  if(!CFG || !WIDGET){ console.error('[Cogniterra] Missing data-config or data-widget'); return; }

  window.CGTR = { configUrl: CFG, widgetUrl: WIDGET, containerId: 'chatbot-container' };

  const css = `.cg-launcher{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:999px;
    background:linear-gradient(135deg,#6E7BFF,#9B6BFF);box-shadow:0 10px 30px rgba(0,0,0,.35);
    border:1px solid rgba(255,255,255,.15);color:#EAF2FF;display:flex;align-items:center;justify-content:center;
    cursor:pointer;z-index:2147483000;font:600 14px/1 Inter,system-ui}
  .cg-panel{position:fixed;right:20px;bottom:90px;width:420px;height:650px;z-index:2147483001;border-radius:18px;
    overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.08);background:transparent;display:none}
  .cg-close{position:absolute;right:8px;top:8px;z-index:2;background:rgba(0,0,0,.35);color:#EAF2FF;border:1px solid rgba(255,255,255,.12);
    border-radius:10px;padding:4px 8px;cursor:pointer;font:500 12px Inter,system-ui}`;
  const style=document.createElement('style'); style.innerHTML = css; document.head.appendChild(style);
  if(STYLES){ const link=document.createElement('link'); link.rel='stylesheet'; link.href=STYLES; document.head.appendChild(link); }

  const btn=document.createElement('div'); btn.className='cg-launcher'; btn.title='Otevřít chat'; btn.innerHTML = '💬'; document.body.appendChild(btn);
  const panel=document.createElement('div'); panel.className='cg-panel';
  const close=document.createElement('button'); close.className='cg-close'; close.innerHTML = 'Zavřít'; panel.appendChild(close);
  const cont=document.createElement('div'); cont.id='chatbot-container'; cont.style.width='100%'; cont.style.height='100%'; panel.appendChild(cont);
  document.body.appendChild(panel);
  // Ensure widget host exists for bubble-only build
  const host=document.createElement('div'); host.setAttribute('data-cogniterra-widget',''); host.style.width='100%'; host.style.height='100%'; cont.appendChild(host);

  const sc=document.createElement('script'); sc.src=WIDGET+'?v='+Date.now(); sc.setAttribute('data-config',CFG); document.body.appendChild(sc);

  let open=false; const show=()=>{panel.style.display='block';open=true}; const hide=()=>{panel.style.display='none';open=false};
  btn.addEventListener('click',()=> open?hide():show()); close.addEventListener('click',hide);
})();