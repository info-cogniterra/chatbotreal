// Cogniterra embed loader (v8.1) - Brand Colors
(function(){
  // === VIEWPORT META TAG FIX ===
  (function ensureViewportMeta(){
  try{
    if (window.innerWidth > 768) { return; }

    try {
      let viewport = document.querySelector('meta[name="viewport"]');
      
      if (!viewport) {
        console.log('[CGTR] Creating viewport meta tag');
        viewport = document.createElement('meta');
        viewport.name = 'viewport';
        viewport.content = 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover';
        document.head.appendChild(viewport);
      } else {
        const currentContent = viewport.getAttribute('content') || '';
        let newContent = currentContent;
        
        if (!currentContent.includes('viewport-fit')) {
          newContent += ', viewport-fit=cover';
        }
        
        if (!currentContent.includes('maximum-scale')) {
          newContent += ', maximum-scale=1';
        }
        
        if (newContent !== currentContent) {
          console.log('[CGTR] Updating viewport meta tag');
          viewport.setAttribute('content', newContent.replace(/^,\s*/, '').trim());
        }
      }
    } catch(e) {
      console.warn('[CGTR] Viewport meta setup failed:', e);
    }
  
  }catch(e){ console.warn('[CGTR] Viewport meta setup failed:', e); }
})();
// === END VIEWPORT FIX ===

  const tag = document.currentScript;
  const CFG = tag.getAttribute('data-config');
  const WIDGET = tag.getAttribute('data-widget');
  const STYLES = tag.getAttribute('data-styles');

  if(!CFG || !WIDGET){ console.error('[Cogniterra] Missing data-config or data-widget'); return; }

  window.CGTR = { configUrl: CFG, widgetUrl: WIDGET, containerId: 'chatbot-container' };

  const FOX_AVATAR = '/chatbot/assets/images/fox-avatar.png';

  const css = `
  /* === Brand Colors - Green & Gold Launcher === */
  .cg-launcher {
    position: fixed;
    right: 20px;
    bottom: 0px;
    width: 70px;
    height: 70px;
    border-radius: 0;
    background: transparent !important;
    box-shadow: none;
    border: none;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 2147483000;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    overflow: visible;
  }
  
  .cg-launcher:hover {
    transform: scale(1.1);
    box-shadow: transparent !important;
  }
  
  .cg-launcher:active {
    transform: scale(0.98);
    background: transparent !important;
  }
  
  .cg-launcher-avatar {
  width: 100%;
  height: 100%;
  object-fit: contain;  /* Změněno z cover */
  border-radius: 0;  /* Odstraněno zaoblení */
  background: transparent;  /* Průhledné pozadí */
  }
  
  /* Speech bubble */
  .cg-launcher-bubble {
    position: absolute;
    right: 85px;
    bottom: 50%;
    transform: translateY(50%);
    background: #fff;
    color: #0f0f0f;
    padding: 12px 18px;
    border-radius: 18px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    font: 600 14px/1.4 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    white-space: nowrap;
    opacity: 1;
    pointer-events: none;
    transition: opacity 0.3s ease, transform 0.3s ease, background 0.3s ease, color 0.3s ease;
  }
  
  /* Dark mode for speech bubble */
  .cg-launcher-bubble.dark-mode {
    background: #1a1a1a;
    color: #f0f0f0;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
  }
  
  /* Hide bubble when panel is open */
  .cg-launcher-bubble.cg-hidden {
    opacity: 0;
    transform: translateY(50%) scale(0.8);
  }
  
  .cg-launcher-bubble::after {
    content: '';
    position: absolute;
    right: -8px;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-left: 8px solid #fff;
    border-top: 8px solid transparent;
    border-bottom: 8px solid transparent;
    transition: border-color 0.3s ease;
  }
  
  .cg-launcher-bubble.dark-mode::after {
    border-left-color: #1a1a1a;
  }
  
  /* Panel - Brand Colors */
  .cg-panel {
    position: fixed;
    right: 20px;
    bottom: 100px;
    width: 420px;
    height: 650px;
    z-index: 2147483001;
    border-radius: 24px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    border: none;
    background: #fff;
    display: none;
    padding: 0;
  }
  
  @media (max-width: 480px) {
  .cg-launcher {
    right: 16px;
    bottom: 16px;
    width: 64px;
    height: 64px;
  }
  
  .cg-launcher-bubble {
    display: block !important;
    right: 75px;  /* 64px launcher + 11px mezera */
    bottom: 50%;
    transform: translateY(50%);
    font-size: 12px;
    padding: 8px 12px;
    max-width: calc(66vw - 90px);  /* 2/3 šířky obrazovky mínus launcher a mezery */
    width: calc(66vw - 90px);  /* Fixní šířka na 2/3 */
    white-space: normal;
    line-height: 1.4;
    box-sizing: border-box;
  }
  
  .cg-launcher-bubble::after {
    right: -7px;
    border-left-width: 7px;
    border-top-width: 7px;
    border-bottom-width: 7px;
  }
    
    .cg-panel {
      position: fixed !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      top: 0 !important;
      width: 100dvw !important;
      height: 100vh !important;
      height: 100dvhh !important;
      border-radius: 0 !important;
    }
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
  btn.setAttribute('role', 'button');
  btn.setAttribute('aria-label', 'Otevřít chat s asistentem');
  btn.setAttribute('tabindex', '0');
  
  const avatarImg = document.createElement('img');
  avatarImg.className = 'cg-launcher-avatar';
  avatarImg.src = FOX_AVATAR;
  avatarImg.alt = 'Cogniterra asistent';
  avatarImg.onerror = function() {
    btn.innerHTML = '🦊';
    btn.style.fontSize = '36px';
  };
  btn.appendChild(avatarImg);
  
  const bubble = document.createElement('div');
  bubble.className = 'cg-launcher-bubble';
  bubble.textContent = 'Nacením Vaší nemovitost a zodpovím Vaše dotazy.';
  btn.appendChild(bubble);
  
  // Update bubble theme based on page theme
  // Update bubble theme based on page theme - FIXED: explicit class overrides system
function updateBubbleTheme() {
  const htmlEl = document.documentElement;
  const bodyEl = document.body;
  
  // Priority: explicit class/attribute > system preference
  const hasExplicitLight = htmlEl.classList.contains('light') || 
                           bodyEl?.classList.contains('light') ||
                           htmlEl.getAttribute('data-theme') === 'light' ||
                           bodyEl?.getAttribute('data-theme') === 'light';
  
  const hasExplicitDark = htmlEl.classList.contains('dark') || 
                          bodyEl?.classList.contains('dark') ||
                          htmlEl.getAttribute('data-theme') === 'dark' ||
                          bodyEl?.getAttribute('data-theme') === 'dark';
  
  const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Logic: explicit overrides system
  const isDark = hasExplicitLight ? false : (hasExplicitDark ? true : systemDark);
  
  if (isDark) {
    bubble.classList.add('dark-mode');
  } else {
    bubble.classList.remove('dark-mode');
  }
  
  console.log('[CGTR] Bubble theme updated:', isDark ? 'dark' : 'light', {
    reason: hasExplicitLight ? 'explicit light' : 
            (hasExplicitDark ? 'explicit dark' : 'system preference')
  });
}
  
  
  // Initial theme check
  updateBubbleTheme();
  
  // Listen for theme changes from widget
  window.addEventListener('cgtr-theme-change', updateBubbleTheme);
  
  // Watch for system preference changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateBubbleTheme);
  }
  
  // Watch for class and data-theme changes on html element
const themeObserver = new MutationObserver(updateBubbleTheme);
themeObserver.observe(document.documentElement, { 
  attributes: true, 
  attributeFilter: ['class', 'data-theme'] 
});

// Also watch body element
if (document.body) {
  themeObserver.observe(document.body, { 
    attributes: true, 
    attributeFilter: ['class', 'data-theme'] 
  });
} else {
  // Body not ready yet
  
// === CGTR: DESKTOP SCROLLBAR-GUTTER FIX ===
(function applyScrollbarGutterFix(){
  try{
    if (window.innerWidth > 768) {
      var s = document.getElementById('cgtr-scrollbar-gutter-fix');
      if(!s){
        s = document.createElement('style');
        s.id = 'cgtr-scrollbar-gutter-fix';
        s.textContent = 'html{scrollbar-gutter:stable both-edges;}';
        document.head.appendChild(s);
      }
    }
  }catch(e){ console.warn('[CGTR] scrollbar gutter fix failed', e); }
})();
// === END CGTR FIX ===
document.addEventListener('DOMContentLoaded', () => {
    if (document.body) {
      themeObserver.observe(document.body, { 
        attributes: true, 
        attributeFilter: ['class', 'data-theme'] 
      });
      updateBubbleTheme();
    }
  });
}

// Mobile polling for first 3 seconds
if (window.innerWidth <= 768) {
  let checks = 0;
  const interval = setInterval(() => {
    updateBubbleTheme();
    checks++;
    if (checks >= 30) clearInterval(interval);
  }, 100);
}
  
  document.body.appendChild(btn);
  
  const panel=document.createElement('div'); 
  panel.className='cg-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Chatbot');
  
  const cont=document.createElement('div'); 
  cont.id='chatbot-container'; 
  cont.style.cssText = 'width:100%;height:100%;position:absolute;inset:0;';
  panel.appendChild(cont);
  document.body.appendChild(panel);
  
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
  
  const handleToggle = (e) => {
    console.log('[CGTR] Toggle triggered');
    e.preventDefault();
    e.stopPropagation();
    if (transitioning) return false;
    if(open) hide(); else show();
    return false;
  };
  
  btn.addEventListener('click', handleToggle, { passive: false }); 
  btn.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleToggle(e);
  }, { passive: false });

  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle(e);
    }
  });

  window.CGTR.show = show;
  window.CGTR.hide = hide;
  window.CGTR.toggle = () => { if (open) hide(); else show(); };
  window.CGTR.isOpen = () => open;
})();

// Mobile viewport helper
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

// Responsive overrides & body lock
(function() {
  try {
    var style = document.createElement('style');
    style.id = 'cg-responsive-override';
    style.textContent = `
/* Desktop - NO body lock, fixed chatbot size */
@media (min-width: 481px) {
  html.cg-open, body.cg-open {
    overflow: visible !important;
    overflow-x: visible !important;
    overflow-y: auto !important;
  }
  
  .cg-panel {
    width: 400px !important;
    max-width: 400px !important;
    height: 600px !important;
    max-height: 600px !important;
    right: 20px !important;
    bottom: 20px !important;
    left: auto !important;
    top: auto !important;
  }
}

/* Mobile - full screen with body lock */
@media (max-width: 480px) {
  @media (max-width: 480px) {
html.cg-open, body.cg-open {
    overflow: hidden !important;
    touch-action: none !important;
    overscroll-behavior: contain !important;
  }
}
  
  .cg-launcher.cg-hidden {
    opacity: 0 !important;
    pointer-events: none !important;
    transform: scale(0.8) !important;
  }
  
  .cg-panel {
    width: 100dvw !important;
    height: 100dvh !important; /* <-- Opravený středník */
    max-width: 100% !important; /* <-- Přidáno pro jistotu */
    max-height: 100dvh !important; /* <-- Opraveno */
    right: 0 !important;
    bottom: 0 !important; /* <-- OPRAVENO: z 20px na 0 */
    left: 0 !important;
    top: 0 !important;
    border-radius: 0 !important; /* <-- Přidáno z původních stylů */
  }
}
`;
    document.head.appendChild(style);
  } catch(e) { console.warn('[CGTR] Style inject failed:', e); }
})();

// Panel visibility observer
(function(){
  try {
    var checkPanel = function() {
      var panel = document.querySelector('.cg-panel');
      var launcher = document.querySelector('.cg-launcher');
      var bubble = document.querySelector('.cg-launcher-bubble');
      if (!panel) {
        setTimeout(checkPanel, 50);
        return;
      }
      
      var on = function(){ 
        console.log('[CGTR] Locking scroll...');
        document.documentElement.classList.add('cg-open'); 
        document.body.classList.add('cg-open');
        if (launcher && window.innerWidth < 768) {
          launcher.classList.add('cg-hidden');
        }
        // Hide the speech bubble when panel is open
        if (bubble) {
          bubble.classList.add('cg-hidden');
        }
      };
      
      var off = function(){ 
        console.log('[CGTR] Unlocking scroll...');
        document.documentElement.classList.remove('cg-open'); 
        document.body.classList.remove('cg-open');
        if (launcher) {
          launcher.classList.remove('cg-hidden');
        }
        // Show the speech bubble when panel is closed
        if (bubble) {
          bubble.classList.remove('cg-hidden');
        }
      };
      
      var lastDisplay = getComputedStyle(panel).display;
      var obs = new MutationObserver(function(){
        var d = getComputedStyle(panel).display;
        if (d !== lastDisplay) {
          lastDisplay = d;
          if (d !== 'none') on(); else off();
        }
      });
      obs.observe(panel, { attributes: true, attributeFilter: ['style', 'class'] });
      
      if (getComputedStyle(panel).display !== 'none') on(); else off();
    };
    checkPanel();
  } catch(e){ console.warn('[CGTR] Observer failed:', e); }
})();
