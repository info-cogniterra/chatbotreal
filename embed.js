// Cogniterra embed loader (v6 - simplified)
(function(){
  console.log("[Cogniterra] Initializing embed loader");
  const tag = document.currentScript;
  const CFG = tag.getAttribute('data-config');
  const WIDGET = tag.getAttribute('data-widget');
  const STYLES = tag.getAttribute('data-styles');

  if(!CFG || !WIDGET){ console.error('[Cogniterra] Missing data-config or data-widget'); return; }

  // Clear any existing instances first
  try {
    // Remove any existing instances
    const oldLauncher = document.querySelector('.cg-launcher');
    if (oldLauncher) oldLauncher.remove();
    
    const oldPanel = document.querySelector('.cg-panel');
    if (oldPanel) oldPanel.remove();
    
    // Reset global flags
    window.__CG_WIDGET_INIT__ = false;
    window.__CG_WIDGET_LOADED__ = false;
  } catch(e) {
    console.error("[Cogniterra] Error cleaning up previous instances:", e);
  }

  // Create base styles with high specificity to prevent conflicts
  const css = `
  .cg-launcher {
    position: fixed !important;
    right: 20px !important;
    bottom: 20px !important;
    width: 56px !important;
    height: 56px !important;
    border-radius: 999px !important;
    background: linear-gradient(135deg, #6E7BFF, #9B6BFF) !important;
    box-shadow: 0 10px 30px rgba(0,0,0,.35) !important;
    border: 1px solid rgba(255,255,255,.15) !important;
    color: #EAF2FF !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    cursor: pointer !important;
    z-index: 2147483000 !important;
    font: 600 14px/1 system-ui !important;
    visibility: visible !important;
    opacity: 1 !important;
  }
  
  .cg-panel {
    position: fixed !important;
    right: 20px !important;
    bottom: 90px !important;
    width: 420px !important;
    height: 650px !important;
    max-height: 80vh !important;
    z-index: 2147483001 !important;
    border-radius: 18px !important;
    overflow: hidden !important;
    box-shadow: 0 12px 40px rgba(0,0,0,.35) !important;
    border: none !important;
    background: white !important;
    display: none !important;
    padding: 0 !important;
  }
  
  .cg-panel.cg-visible {
    display: block !important;
  }
  
  .cg-close {
    position: absolute !important;
    right: 8px !important;
    top: 8px !important;
    z-index: 2 !important;
    background: rgba(0,0,0,.35) !important;
    color: #EAF2FF !important;
    border: 1px solid rgba(255,255,255,.12) !important;
    border-radius: 10px !important;
    padding: 4px 8px !important;
    cursor: pointer !important;
    font: 500 12px system-ui !important;
  }
  
  @media (max-width: 480px) {
    .cg-panel {
      width: 100% !important;
      height: 100% !important;
      right: 0 !important;
      left: 0 !important;
      bottom: 0 !important;
      top: 0 !important;
      border-radius: 0 !important;
      max-height: none !important;
    }
  }
  
  #chatbot-container {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    background: white !important;
    visibility: visible !important;
    opacity: 1 !important;
  }`;
  
  // Vytvoření a vložení stylu
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  
  // Přidání externích stylů, pokud jsou specifikovány
  if(STYLES) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = STYLES;
    document.head.appendChild(link);
  }
  
  // Vytvoření základních prvků UI
  const btn = document.createElement('div');
  btn.className = 'cg-launcher';
  btn.title = 'Otevřít chat';
  btn.innerHTML = '💬';
  btn.id = 'cg-launcher-btn';
  document.body.appendChild(btn);
  
  const panel = document.createElement('div');
  panel.className = 'cg-panel';
  panel.id = 'cg-panel';
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'cg-close';
  closeBtn.innerHTML = 'Zavřít';
  closeBtn.id = 'cg-close-btn';
  panel.appendChild(closeBtn);
  
  const container = document.createElement('div');
  container.id = 'chatbot-container';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.background = '#ffffff';
  panel.appendChild(container);
  
  // Přidání panelu do dokumentu
  document.body.appendChild(panel);
  
  // Vytvoření host elementu pro chatbota
  const host = document.createElement('div');
  host.setAttribute('data-cogniterra-widget', '');
  host.style.width = '100%';
  host.style.height = '100%';
  host.style.background = '#ffffff';
  host.style.position = 'absolute';
  host.style.inset = '0';
  container.appendChild(host);
  
  // Globální stav
  let isOpen = false;
  let scriptLoaded = false;
  
  // Funkce pro zobrazení/skrytí chatbota
  function toggleChat() {
    console.log("[Cogniterra] Toggle chat, current state:", isOpen);
    if (isOpen) {
      hideChat();
    } else {
      showChat();
    }
  }
  
  function showChat() {
    console.log("[Cogniterra] Showing chat");
    panel.classList.add('cg-visible');
    isOpen = true;
    
    if (!scriptLoaded) {
      loadScript();
    } else {
      resetWidget();
    }
  }
  
  function hideChat() {
    console.log("[Cogniterra] Hiding chat");
    panel.classList.remove('cg-visible');
    isOpen = false;
  }
  
  function loadScript() {
    console.log("[Cogniterra] Loading widget script");
    const script = document.createElement('script');
    script.src = WIDGET + '?v=' + Date.now();
    script.setAttribute('data-config', CFG);
    script.onload = function() {
      scriptLoaded = true;
      console.log("[Cogniterra] Widget script loaded successfully");
    };
    script.onerror = function(error) {
      console.error("[Cogniterra] Failed to load widget script:", error);
    };
    document.body.appendChild(script);
  }
  
  function resetWidget() {
    console.log("[Cogniterra] Resetting widget");
    // Restart widget if reset function exists
    if (typeof window.__CG_WIDGET_RESET_FN__ === 'function') {
      try {
        window.__CG_WIDGET_RESET_FN__();
      } catch(e) {
        console.error("[Cogniterra] Error resetting widget:", e);
        // If reset fails, reload the script
        scriptLoaded = false;
        loadScript();
      }
    }
  }
  
  // Event listeners
  btn.addEventListener('click', toggleChat);
  closeBtn.addEventListener('click', hideChat);
  
  // Expose functions globally
  window.CGTR = {
    showChat: showChat,
    hideChat: hideChat,
    resetChat: resetWidget
  };
  
  // DŮLEŽITÉ: Načíst widget skript automaticky při inicializaci
  loadScript();
  
  console.log("[Cogniterra] Embed loader initialized");
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
