// Cogniterra embed loader (v6) - PLNĚ OPRAVENÁ VERZE S MOBILNÍ PODPOROU
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
    cursor:pointer;z-index:2147483000;font:600 14px/1 Inter,system-ui;-webkit-tap-highlight-color:transparent;
    user-select:none;-webkit-user-select:none;touch-action:manipulation;}
  .cg-panel{position:fixed;right:20px;bottom:90px;width:420px;height:650px;z-index:2147483001;border-radius:18px;
    overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.35);border:none;background:transparent;display:none;padding:0;}
  .cg-close{position:absolute;right:8px;top:8px;z-index:2147483002;background:rgba(0,0,0,.5);color:#EAF2FF;
    border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:8px 12px;cursor:pointer;
    font:500 14px Inter,system-ui;-webkit-tap-highlight-color:transparent;user-select:none;
    -webkit-user-select:none;touch-action:manipulation;min-height:44px;min-width:44px;
    display:flex;align-items:center;justify-content:center;pointer-events:auto;}
  @media (max-width: 767.98px) {
    .cg-launcher{right:16px;bottom:16px;width:60px;height:60px;font-size:24px;}
    .cg-close{right:12px;top:12px;padding:10px 16px;font-size:15px;min-height:48px;min-width:80px;
      z-index:999999;background:rgba(0,0,0,.7);}
  }`;
  
  const style=document.createElement('style'); 
  style.innerHTML = css; 
  document.head.appendChild(style);
  
  if(STYLES){ 
    const link=document.createElement('link'); 
    link.rel='stylesheet'; 
    link.href=STYLES; 
    document.head.appendChild(link); 
  }

  const btn=document.createElement('div'); 
  btn.className='cg-launcher'; 
  btn.title='Otevřít chat'; 
  btn.innerHTML = '💬';
  btn.setAttribute('role', 'button');
  btn.setAttribute('aria-label', 'Otevřít chat');
  btn.setAttribute('tabindex', '0');
  document.body.appendChild(btn);
  
  const panel=document.createElement('div'); 
  panel.className='cg-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Chatbot');
  
  const close=document.createElement('button'); 
  close.className='cg-close'; 
  close.innerHTML = 'Zavřít';
  close.setAttribute('type', 'button');
  close.setAttribute('aria-label', 'Zavřít chat');
  close.setAttribute('tabindex', '0');
  panel.appendChild(close);
  
  const cont=document.createElement('div'); 
  cont.id='chatbot-container'; 
  cont.style.cssText = 'width:100%;height:100%;position:absolute;inset:0;';
  panel.appendChild(cont);
  document.body.appendChild(panel);
  
  // Ensure widget host exists for bubble-only build
  const host=document.createElement('div'); 
  host.setAttribute('data-cogniterra-widget',''); 
  host.style.cssText = 'width:100%;height:100%;position:absolute;inset:0;';
  cont.appendChild(host);

  const sc=document.createElement('script'); 
  sc.src=WIDGET+'?v='+Date.now(); 
  sc.setAttribute('data-config',CFG); 
  document.body.appendChild(sc);

  let open = false; 
  let transitioning = false;
  
  const show = () => {
    if (transitioning || open) return;
    transitioning = true;
    console.log('[CGTR] Opening chat...');
    panel.style.display = 'block';
    // Force reflow
    void panel.offsetHeight;
    requestAnimationFrame(() => {
      open = true;
      transitioning = false;
      console.log('[CGTR] Chat opened');
    });
  }; 
  
  const hide = () => {
    if (transitioning || !open) return;
    transitioning = true;
    console.log('[CGTR] Closing chat...');
    requestAnimationFrame(() => {
      panel.style.display = 'none';
      open = false;
      transitioning = false;
      console.log('[CGTR] Chat closed');
    });
  };
  
  // Mobilní a desktop podpora
  const handleToggle = (e) => {
    console.log('[CGTR] Toggle triggered, open:', open, 'transitioning:', transitioning);
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (transitioning) {
      console.log('[CGTR] Blocked: transitioning');
      return false;
    }
    if(open) {
      hide();
    } else {
      show();
    }
    return false;
  };

  const handleClose = (e) => {
    console.log('[CGTR] Close triggered');
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (transitioning) {
      console.log('[CGTR] Blocked: transitioning');
      return false;
    }
    hide();
    return false;
  };
  
  // Přidáme oba eventy pro mobilní podporu
  btn.addEventListener('click', handleToggle, { passive: false, capture: false }); 
  btn.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleToggle(e);
  }, { passive: false, capture: false });
  
  close.addEventListener('click', handleClose, { passive: false, capture: true }); 
  close.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleClose(e);
  }, { passive: false, capture: true });

  // Keyboard support
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle(e);
    }
  });
  
  close.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
      e.preventDefault();
      handleClose(e);
    }
  });

  // Expose show/hide globally for widget
  window.CGTR.show = show;
  window.CGTR.hide = hide;
  window.CGTR.toggle = () => {
    console.log('[CGTR] Manual toggle called');
    if (open) hide(); else show();
  };
  window.CGTR.isOpen = () => open;
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
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', set, { passive: true });
    }
  } catch(e){ console.warn('[CGTR] VH setup failed:', e); }
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
  transition: transform 0.1s ease;
}
.cg-launcher:active {
  transform: scale(0.95);
}
@media (min-width: 768px) {
  .cg-panel {
    width: clamp(360px, 34vw, 420px) !important;
    height: clamp(520px, 72vh, 650px) !important;
    right: 20px !important;
    bottom: 90px !important;
    left: auto !important;
    top: auto !important;
    border-radius: 18px !important;
    max-height: 92vh !important;
    overflow: hidden !important;
  }
  html.cg-open, body.cg-open {
    position: relative !important;
    width: auto !important;
    height: auto !important;
  }
}
@media (max-width: 767.98px) {
  .cg-panel {
    position: fixed !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    top: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    height: 100dvh !important;
    max-height: 100vh !important;
    max-height: 100dvh !important;
    border-radius: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
    transform: none !important;
    transition: none !important;
  }
  
  html.cg-open, body.cg-open {
    position: fixed !important;
    width: 100% !important;
    height: 100% !important;
    overflow: hidden !important;
  }
  
  .cg-close {
    pointer-events: auto !important;
    z-index: 999999 !important;
    touch-action: manipulation !important;
  }
  
  .cg-launcher.cg-hidden {
    opacity: 0 !important;
    pointer-events: none !important;
    transform: scale(0.8) !important;
  }
}
`;
    document.head.appendChild(style);
  } catch(e) { console.warn('[CGTR] Style inject failed:', e); }
})();


//== CG Inject: observe panel visibility to lock background ==
(function(){
  try {
    // Wait for panel to exist
    var checkPanel = function() {
      var panel = document.querySelector('.cg-panel');
      var launcher = document.querySelector('.cg-launcher');
      if (!panel) {
        setTimeout(checkPanel, 50);
        return;
      }
      
      var on = function(){ 
        console.log('[CGTR] Locking scroll...');
        document.documentElement.classList.add('cg-open'); 
        document.body.classList.add('cg-open');
        // Hide launcher on mobile when open
        if (launcher && window.innerWidth < 768) {
          launcher.classList.add('cg-hidden');
        }
        // Store scroll position on mobile
        if (window.innerWidth < 768) {
          window.__cgScrollY = window.scrollY || window.pageYOffset || 0;
          document.body.style.top = '-' + window.__cgScrollY + 'px';
        }
      };
      
      var off = function(){ 
        console.log('[CGTR] Unlocking scroll...');
        document.documentElement.classList.remove('cg-open'); 
        document.body.classList.remove('cg-open');
        // Show launcher
        if (launcher) {
          launcher.classList.remove('cg-hidden');
        }
        // Restore scroll position on mobile
        if (window.innerWidth < 768 && typeof window.__cgScrollY !== 'undefined') {
          document.body.style.top = '';
          window.scrollTo(0, window.__cgScrollY);
          window.__cgScrollY = undefined;
        }
      };
      
      var lastDisplay = getComputedStyle(panel).display;
      var obs = new MutationObserver(function(){
        var d = getComputedStyle(panel).display;
        if (d !== lastDisplay) {
          lastDisplay = d;
          console.log('[CGTR] Panel display changed to:', d);
          if (d !== 'none') on(); else off();
        }
      });
      obs.observe(panel, { attributes: true, attributeFilter: ['style', 'class'] });
      
      // initialize
      if (getComputedStyle(panel).display !== 'none') on(); else off();
    };
    checkPanel();
  } catch(e){ console.warn('[CGTR] Observer failed:', e); }
})();


//== CG Inject: visualViewport height sync on mobile ==
(function(){
  try {
    var checkPanel = function() {
      var panel = document.querySelector('.cg-panel');
      if (!panel) {
        setTimeout(checkPanel, 50);
        return;
      }
      if (!window.visualViewport) return;
      
      var isMobile = function(){ return window.innerWidth < 768; };
      var apply = function(){
        if (!isMobile()) { 
          panel.style.removeProperty('height'); 
          panel.style.removeProperty('max-height');
          return; 
        }
        var vh = Math.round(window.visualViewport.height);
        if (getComputedStyle(panel).display !== 'none') {
          panel.style.height = vh + 'px';
          panel.style.maxHeight = vh + 'px';
        }
      };
      
      window.visualViewport.addEventListener('resize', apply, { passive: true });
      window.addEventListener('orientationchange', () => {
        setTimeout(apply, 100);
      }, { passive: true });
      apply();
    };
    checkPanel();
  } catch(e){ console.warn('[CGTR] Viewport sync failed:', e); }
})();

// Debug helper
if (window.location.search.includes('cgtr_debug=1')) {
  console.log('[CGTR] Debug mode enabled');
  window.CGTR.debug = true;
}
