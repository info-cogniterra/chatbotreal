// Cogniterra embed loader (opravená verze v8 - DESKTOP FIX)
(function(){
  console.log("[Cogniterra] Initializing embed loader v8");
  const tag = document.currentScript;
  const CFG = tag.getAttribute('data-config') || './data/v1/widget_config.json';
  const WIDGET = tag.getAttribute('data-widget') || './cogniterra-widget-safe.v6.js';
  const STYLES = tag.getAttribute('data-styles');

  // Vyčistit všechny existující instance
  try {
    document.querySelectorAll('.cg-launcher, .cg-panel, .chat-bubble, [data-chatbot="bubble"]').forEach(el => {
      if(el && el.parentNode) el.parentNode.removeChild(el);
    });
    
    // Reset globálních příznaků
    window.__CG_WIDGET_INIT__ = false;
    window.__CG_WIDGET_LOADED__ = false;
  } catch(e) {
    console.error("[Cogniterra] Error cleaning up previous instances:", e);
  }

  // Vytvořit tlačítko chatbota s INLINE styly jako pojistka
  const btn = document.createElement('div');
  btn.className = 'cg-launcher';
  btn.id = 'cg-launcher-btn';
  btn.title = 'Otevřít chat';
  btn.innerHTML = '💬';
  btn.style.cssText = `
    position: fixed !important;
    right: 20px !important;
    bottom: 20px !important;
    width: 56px !important;
    height: 56px !important;
    border-radius: 50% !important;
    background: linear-gradient(135deg, #6E7BFF, #9B6BFF) !important;
    color: #fff !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    cursor: pointer !important;
    z-index: 2147483647 !important;
    font-size: 24px !important;
    box-shadow: 0 4px 12px rgba(0,0,0,.25) !important;
  `;
  document.body.appendChild(btn);
  
  // Vytvořit panel s INLINE styly jako pojistka
  const panel = document.createElement('div');
  panel.className = 'cg-panel';
  panel.id = 'cg-panel';
  panel.style.cssText = `
    position: fixed !important;
    right: 20px !important;
    bottom: 90px !important;
    width: 420px !important;
    height: 650px !important;
    max-height: 80vh !important;
    z-index: 2147483646 !important;
    border-radius: 18px !important;
    overflow: hidden !important;
    background: white !important;
    box-shadow: 0 12px 40px rgba(0,0,0,.35) !important;
    display: none !important;
  `;
  
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
  container.style.position = 'absolute';
  container.style.inset = '0';
  container.style.zIndex = '2147483040';
  container.style.visibility = 'visible';
  container.style.opacity = '1';
  panel.appendChild(container);
  
  // Přidat panel do dokumentu
  document.body.appendChild(panel);
  
  // KRITICKÉ: Vytvořit host element pro chatbot
  const host = document.createElement('div');
  host.setAttribute('data-cogniterra-widget', '');
  host.style.width = '100%';
  host.style.height = '100%';
  host.style.background = '#ffffff';
  host.style.position = 'absolute';
  host.style.inset = '0';
  host.style.zIndex = '2147483050';
  host.style.visibility = 'visible';
  host.style.opacity = '1';
  container.appendChild(host);
  
  // Stav
  let isOpen = false;
  let scriptLoaded = false;
  
  function toggleChat() {
    if (isOpen) {
      hideChat();
    } else {
      showChat();
    }
  }
  
  function showChat() {
    console.log("[Cogniterra] Showing chat");
    panel.style.display = 'block';
    panel.classList.add('cg-visible');
    document.documentElement.classList.add('cg-open');
    document.body.classList.add('cg-open');
    isOpen = true;
    
    if (!scriptLoaded) {
      loadScript();
    } else if (typeof window.__CG_WIDGET_RESET_FN__ === 'function') {
      try {
        window.__CG_WIDGET_RESET_FN__();
      } catch(e) {
        console.error("[Cogniterra] Error resetting widget:", e);
        scriptLoaded = false;
        loadScript();
      }
    }
  }
  
  function hideChat() {
    console.log("[Cogniterra] Hiding chat");
    panel.style.display = 'none';
    panel.classList.remove('cg-visible');
    document.documentElement.classList.remove('cg-open');
    document.body.classList.remove('cg-open');
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
      
      // Vynutit viditelnost po načtení
      setTimeout(function() {
        try {
          const chatContainer = document.querySelector('[data-cogniterra-widget] .chat-container');
          if (chatContainer) {
            chatContainer.style.visibility = 'visible';
            chatContainer.style.opacity = '1';
            chatContainer.style.display = 'flex';
          }
        } catch(e) {
          console.error("[Cogniterra] Error enforcing visibility:", e);
        }
      }, 200);
    };
    document.body.appendChild(script);
  }
  
  // Event listeners
  btn.addEventListener('click', toggleChat);
  closeBtn.addEventListener('click', hideChat);
  
  // Globální funkce
  window.CGTR = {
    showChat: showChat,
    hideChat: hideChat,
    resetChat: function() {
      if (typeof window.__CG_WIDGET_RESET_FN__ === 'function') {
        window.__CG_WIDGET_RESET_FN__();
      }
    }
  };
  
  // Přidat základní styly DO HLAVIČKY (jako backup)
  const style = document.createElement('style');
  style.textContent = `
  .cg-launcher {
    position: fixed !important;
    right: 20px !important;
    bottom: 20px !important;
    width: 56px !important;
    height: 56px !important;
    border-radius: 50% !important;
    background: linear-gradient(135deg, #6E7BFF, #9B6BFF) !important;
    box-shadow: 0 10px 30px rgba(0,0,0,.35) !important;
    border: 1px solid rgba(255,255,255,.15) !important;
    color: #EAF2FF !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    cursor: pointer !important;
    z-index: 2147483647 !important;
    font: 600 24px/1 system-ui !important;
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
    z-index: 2147483646 !important;
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
    z-index: 2147483100 !important;
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
  
  [data-cogniterra-widget] {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    background: white !important;
    visibility: visible !important;
    opacity: 1 !important;
    display: block !important;
    z-index: 2147483010 !important;
  }
  
  .chat-container {
    display: flex !important;
    flex-direction: column !important;
    height: 100% !important;
    width: 100% !important;
    background: #fff !important;
    visibility: visible !important;
    opacity: 1 !important;
  }
  
  .chat-header {
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 10 !important;
  }
  
  .chat-messages {
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 5 !important;
    flex: 1 !important;
  }
  
  .chat-input-area {
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 10 !important;
  }
  
  .chat-msg.ai a {
    color: #2c5282 !important;
    text-decoration: underline !important;
    font-weight: 500 !important;
  }`;
  
  document.head.appendChild(style);
  
  // Přidat externí styly, pokud jsou určeny
  if(STYLES) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = STYLES;
    document.head.appendChild(link);
  }
  
  // Mobile viewport helper
  function updateVH() {
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--vh', vh + 'px');
  }
  updateVH();
  window.addEventListener('resize', updateVH, {passive:true});
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateVH, {passive:true});
  }
  
  console.log("[Cogniterra] Embed loader initialized successfully");
})();
