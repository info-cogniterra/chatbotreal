// Cogniterra embed loader (fixed version)
(function(){
  console.log("[Cogniterra] Initializing embed loader");
  const tag = document.currentScript;
  const CFG = tag.getAttribute('data-config') || './data/v1/widget_config.json';
  const WIDGET = tag.getAttribute('data-widget') || './cogniterra-widget-safe.v6.js';
  const STYLES = tag.getAttribute('data-styles');

  // Clear any existing instances first
  try {
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

  // Create launcher button
  const btn = document.createElement('div');
  btn.className = 'cg-launcher';
  btn.title = 'Otevřít chat';
  btn.innerHTML = '💬';
  btn.id = 'cg-launcher-btn';
  document.body.appendChild(btn);
  
  // Create panel container
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
  container.setAttribute('style', 'width:100%;height:100%;background:#fff;z-index:2147483040;position:absolute;inset:0;');
  panel.appendChild(container);
  
  // Add panel to document
  document.body.appendChild(panel);
  
  // Create host element for chatbot
  const host = document.createElement('div');
  host.setAttribute('data-cogniterra-widget', '');
  host.setAttribute('style', 'width:100%;height:100%;background:#fff;position:absolute;inset:0;z-index:2147483050;');
  container.appendChild(host);
  
  // Global state
  let isOpen = false;
  let scriptLoaded = false;
  
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
      
      // Force visibility after loading
      setTimeout(function() {
        const chatContainer = document.querySelector('[data-cogniterra-widget] .chat-container');
        if (chatContainer) {
          chatContainer.style.visibility = 'visible';
          chatContainer.style.opacity = '1';
          chatContainer.style.display = 'flex';
        }
      }, 500);
    };
    script.onerror = function(error) {
      console.error("[Cogniterra] Failed to load widget script:", error);
    };
    document.body.appendChild(script);
  }
  
  // Event listeners
  btn.addEventListener('click', toggleChat);
  closeBtn.addEventListener('click', hideChat);
  
  // Expose functions globally
  window.CGTR = {
    showChat: showChat,
    hideChat: hideChat,
    resetChat: function() {
      if (typeof window.__CG_WIDGET_RESET_FN__ === 'function') {
        window.__CG_WIDGET_RESET_FN__();
      }
    }
  };
  
  // Add base styles
  const style = document.createElement('style');
  style.textContent = `
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
  }`;
  document.head.appendChild(style);
  
  // Add external styles if specified
  if(STYLES) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = STYLES;
    document.head.appendChild(link);
  }
  
  console.log("[Cogniterra] Embed loader initialized");
})();

// Mobile viewport helper
(function() {
  function updateVH() {
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--vh', vh + 'px');
  }
  updateVH();
  window.addEventListener('resize', updateVH, {passive:true});
})();
