// Cogniterra embed loader — launcher + panel + robust config handoff
(function () {
  const current = document.currentScript;
  const CFG = current.getAttribute('data-config');
  const WIDGET = current.getAttribute('data-widget');
  const STYLES = current.getAttribute('data-styles');

  if (!CFG || !WIDGET) {
    console.error('[Cogniterra] Embed: missing data-config or data-widget.');
    return;
  }

  // Expose to widget as fallback
  window.CGTR = { configUrl: CFG, widgetUrl: WIDGET, containerId: 'chatbot-container' };

  // Base styles
  const css = `.cg-launcher{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:999px;
    background:linear-gradient(135deg,#6E7BFF,#9B6BFF);box-shadow:0 10px 30px rgba(0,0,0,.35);
    border:1px solid rgba(255,255,255,.15);color:#EAF2FF;display:flex;align-items:center;justify-content:center;
    cursor:pointer;z-index:2147483000;font:600 14px/1 Inter,system-ui}
  .cg-panel{position:fixed;right:20px;bottom:90px;width:420px;height:650px;z-index:2147483001;border-radius:18px;
    overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.08);background:transparent;display:none}
  .cg-close{position:absolute;right:8px;top:8px;z-index:2;background:rgba(0,0,0,.35);color:#EAF2FF;border:1px solid rgba(255,255,255,.12);
    border-radius:10px;padding:4px 8px;cursor:pointer;font:500 12px Inter,system-ui}`;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  if (STYLES) { const link = document.createElement('link'); link.rel='stylesheet'; link.href=STYLES; document.head.appendChild(link); }

  // Launcher + panel
  const btn = document.createElement('div'); btn.className='cg-launcher'; btn.title='Otevřít chat'; btn.textContent='💬'; document.body.appendChild(btn);
  const panel = document.createElement('div'); panel.className='cg-panel';
  const closeBtn = document.createElement('button'); closeBtn.className='cg-close'; closeBtn.textContent='Zavřít'; panel.appendChild(closeBtn);

  const container = document.createElement('div');
  container.id = window.CGTR.containerId;
  container.style.width='100%'; container.style.height='100%';
  panel.appendChild(container); document.body.appendChild(panel);

  // Load widget script into main document
  const sc = document.createElement('script');
  sc.src = WIDGET + '?v=' + Date.now();
  sc.setAttribute('data-config', CFG);
  document.body.appendChild(sc);

  // Toggle
  let open=false; const show=()=>{panel.style.display='block';open=true}; const hide=()=>{panel.style.display='none';open=false};
  btn.addEventListener('click', ()=> open?hide():show()); closeBtn.addEventListener('click', hide);
})();