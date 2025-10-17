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
    overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.35);border:none;background:transparent;display:none;padding:0;}
  .cg-close{position:absolute;right:8px;top:8px;z-index:2;background:rgba(0,0,0,.35);color:#EAF2FF;border:1px solid rgba(255,255,255,.12);
    border-radius:10px;padding:4px 8px;cursor:pointer;font:500 12px Inter,system-ui}`;
  const style=document.createElement('style'); style.innerHTML = css; document.head.appendChild(style);
  if(STYLES){ const link=document.createElement('link'); link.rel='stylesheet'; link.href=STYLES; document.head.appendChild(link); }

  // Definujeme globální funkce pro otevírání/zavírání chatu
  window.CGTR = window.CGTR || {};
  
  // Vytvoření prvků UI - launcher a panel
  const btn=document.createElement('div'); 
  btn.className='cg-launcher'; 
  btn.title='Otevřít chat'; 
  btn.innerHTML = '💬'; 
  document.body.appendChild(btn);
  
  const panel=document.createElement('div'); 
  panel.className='cg-panel';
  
  const close=document.createElement('button'); 
  close.className='cg-close'; 
  close.innerHTML = 'Zavřít'; 
  panel.appendChild(close);
  
  const cont=document.createElement('div'); 
  cont.id='chatbot-container'; 
  cont.style.width='100%'; 
  cont.style.height='100%';
  cont.style.position='absolute'; 
  cont.style.inset='0';
  panel.appendChild(cont);
  document.body.appendChild(panel);
  
  // Flag pro sledování, zda byl widget již inicializován
  window.__CG_WIDGET_LOADED__ = false;
  
  // Globální stav otevření/zavření
  let open=false; 
  
  // Vylepšené funkce pro otevírání/zavírání, které resetují stav
  const show = () => {
    console.log("[Cogniterra] Opening chat panel");
    
    // Nejprve vyčistíme kontejner a připravíme ho pro novou inicializaci
    const container = document.getElementById('chatbot-container');
    if (container) {
      // Vyčistit obsah kontejneru
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      
      // Znovu vytvořit hostitelský element pro widget
      const host = document.createElement('div'); 
      host.setAttribute('data-cogniterra-widget', ''); 
      host.style.width = '100%'; 
      host.style.height = '100%';
      host.style.position = 'absolute';
      host.style.inset = '0';
      host.style.background = '#fff'; // Zajistíme, že pozadí bude viditelné
      container.appendChild(host);
    }
    
    // Zobrazíme panel
    panel.style.display = 'block';
    open = true;
    
    // Resetujeme inicializační příznak, aby se chat znovu inicializoval
    window.__CG_WIDGET_INIT__ = false;
    
    // Načteme widget, pokud ještě není načtený
    if (!window.__CG_WIDGET_LOADED__) {
      console.log("[Cogniterra] Loading widget script for the first time");
      const sc = document.createElement('script'); 
      sc.src = WIDGET + '?v=' + Date.now(); 
      sc.setAttribute('data-config', CFG); 
      document.body.appendChild(sc);
      window.__CG_WIDGET_LOADED__ = true;
    } else {
      console.log("[Cogniterra] Widget already loaded, reinitializing");
      // Pokud je widget již načten, jenom resetujeme stav pomocí IIFE
      (function reinitWidget() {
        try {
          const host = document.querySelector("[data-cogniterra-widget]");
          if (host) {
            // Vyčistíme shadowRoot
            if (host.shadowRoot) {
              while (host.shadowRoot.firstChild) {
                host.shadowRoot.removeChild(host.shadowRoot.firstChild);
              }
            }
            
            // Znovu spustíme inicializační funkci definovanou v widget.js
            if (typeof window.__CG_WIDGET_RESET_FN__ === 'function') {
              window.__CG_WIDGET_RESET_FN__();
            } else {
              // Pokud reset funkce není dostupná, načteme skript znovu
              console.log("[Cogniterra] Reset function not available, reloading widget");
              const sc = document.createElement('script'); 
              sc.src = WIDGET + '?v=' + Date.now(); 
              sc.setAttribute('data-config', CFG); 
              document.body.appendChild(sc);
            }
          }
        } catch(e) {
          console.error("[Cogniterra] Error during widget reinitialization:", e);
          // Fallback: načteme skript znovu
          const sc = document.createElement('script'); 
          sc.src = WIDGET + '?v=' + Date.now(); 
          sc.setAttribute('data-config', CFG); 
          document.body.appendChild(sc);
        }
      })();
    }
  }; 
  
  const hide = () => {
    console.log("[Cogniterra] Hiding chat panel");
    panel.style.display = 'none';
    open = false;
  };
  
  // Exportujeme funkce pro globální použití
  window.CGTR.showChat = show;
  window.CGTR.hideChat = hide;
  
  // Přidáme event listenery na tlačítka
  btn.addEventListener('click', () => {
    if (open) {
      hide();
    } else {
      show();
    }
  }); 
  close.addEventListener('click', hide);
})();

// === Mobile viewport helper (vh fix) ===
(function cgSetVH() {
  try {
    const set = () => {
      const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.documentElement.style.setProperty('--vh', h + 'px');
    };
    set();
    window.addEventListener('resize', set, { passive: true });
  } catch(e){}
})();

//== CG Inject: responsive overrides & body lock ==
(function() {
  try {
    var style = document.createElement('style');
    style.id = 'cg-responsive-override';
    style.textContent = `
/* === CG: Lock background scroll when chat open === */
html.cg-open, body.cg-open {
  overflow: hidden !important;
  touch-action: none !important;
  overscroll-behavior: contain !important;
}
\n
/* === CG: Responsive overrides for launcher & panel === */
.cg-launcher {
  -webkit-tap-highlight-color: transparent;
}
@media (min-width: 768px) {
  .cg-panel {
    width: clamp(360px, 34vw, 420px) !important;
    height: clamp(520px, 72vh, 650px) !important;
    right: 20px !important;
    bottom: 90px !important;
    left: auto !important;
    border-radius: 18px !important;
    max-height: 92vh !important;
    overflow: hidden !important;
  }
}
@media (max-width: 767.98px) {
  .cg-panel {
    position: fixed !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    top: auto !important;
    width: 100vw !important;
    height: 100dvh !important;
    max-height: 100dvh !important;
    border-radius: 16px 16px 0 0 !important;
    padding-bottom: env(safe-area-inset-bottom) !important;
    padding-top: env(safe-area-inset-top) !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
    transform: translateY(0);
    transition: transform 0.2s ease-out;
  }
}

/* Zajišťuje, že obsah widgetu bude viditelný */
[data-cogniterra-widget] {
  background: #fff !important;
  visibility: visible !important;
  opacity: 1 !important;
}

.chat-container {
  background: #fff !important;
  visibility: visible !important;
  opacity: 1 !important;
}
`;
    document.head.appendChild(style);
  } catch(e) { console.warn('CG: style inject failed', e); }
})();


//== CG Inject: observe panel visibility to lock background ==
(function(){
  try {
    var panel = document.querySelector('.cg-panel');
    if (!panel) return;
    var on = function(){ document.documentElement.classList.add('cg-open'); document.body.classList.add('cg-open'); };
    var off = function(){ document.documentElement.classList.remove('cg-open'); document.body.classList.remove('cg-open'); };
    var lastDisplay = getComputedStyle(panel).display;
    var obs = new MutationObserver(function(){
      var d = getComputedStyle(panel).display;
      if (d !== lastDisplay) {
        lastDisplay = d;
        if (d !== 'none') on(); else off();
      }
    });
    obs.observe(panel, { attributes: true, attributeFilter: ['style', 'class'] });
    // initialize
    if (getComputedStyle(panel).display !== 'none') on(); else off();
  } catch(e){ console.warn('CG: observer failed', e); }
})();


//== CG Inject: visualViewport height sync on mobile ==
(function(){
  try {
    var panel = document.querySelector('.cg-panel');
    if (!panel || !window.visualViewport) return;
    var isMobile = function(){ return Math.max(window.innerWidth, window.innerHeight) < 768; };
    var apply = function(){
      if (!isMobile()) { panel.style.removeProperty('height'); return; }
      var vh = Math.round(window.visualViewport.height);
      if (getComputedStyle(panel).display !== 'none') {
        panel.style.height = vh + 'px';
      }
    };
    window.visualViewport.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    apply();
  } catch(e){ console.warn('CG: viewport sync failed', e); }
})();
