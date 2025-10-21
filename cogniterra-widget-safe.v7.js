// === Unified viewport height handler ===
(function setVH(){
  function updateVH(){
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--vh', vh + 'px');
  }
  updateVH();
  window.addEventListener('resize', updateVH, {passive:true});
})();

// cogniterra-widget-safe.v8.js — NEW DESIGN with updated brand colors
// Build v8.2 — Opravy: avatar lišky, quick actions, autocomplete dark mode
// Date: 2025-01-21 | Author: info-cogniterra

(function () {
  "use strict";

  console.log('[Widget] Initialization started... (v8.2 - Fixes)');

  const host = document.querySelector("[data-cogniterra-widget]");
  if (!host) {
    console.warn('[Widget] Host element not found');
    return;
  }

  let shadow;
  try {
    if (host.shadowRoot) {
      console.log('[Widget] Cleaning existing shadow root...');
      while (host.shadowRoot.firstChild) {
        host.shadowRoot.removeChild(host.shadowRoot.firstChild);
      }
      shadow = host.shadowRoot;
    } else {
      console.log('[Widget] Creating new shadow root...');
      shadow = host.attachShadow({ mode: "open" });
    }
  } catch (e) {
    console.error('[Widget] Shadow DOM error:', e);
    return;
  }

  const S = {
    session: Math.random().toString(36).slice(2),
    flow: null,
    cfg: null,
    data: {},
    tempPricing: null,
    chat: { messages: [] },
    intent: {},
    processing: false,
    quickActionsUsed: { pricing: false, help: false }, // FIX 2: Prevence opakovaného spouštění
    typeSelected: false  // ← PŘIDAT
 };

  console.log('[Widget] Session:', S.session);

  // Dark mode detection
  let isDarkMode = false;
  function updateDarkMode() {
    const htmlEl = document.documentElement;
    // Check for dark mode: class, data-theme attribute, or system preference
    isDarkMode = htmlEl.classList.contains('dark') || 
                 htmlEl.getAttribute('data-theme') === 'dark' ||
                 (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    console.log('[Widget] Dark mode:', isDarkMode);
    
    // Update shadow root if needed
    if (shadow && shadow.host) {
      shadow.host.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    }
    
    // Dispatch custom event for other components (like embed.js speech bubble)
    try {
      window.dispatchEvent(new CustomEvent('cgtr-theme-change', { 
        detail: { theme: isDarkMode ? 'dark' : 'light' }
      }));
    } catch(e) {
      console.warn('[Widget] Could not dispatch theme event:', e);
    }
  }
  
  // Initial dark mode check
  updateDarkMode();
  
  // Watch for dark mode changes from system preference
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateDarkMode);
  }
  
  // Watch for class and data-theme attribute changes on html element
  const observer = new MutationObserver(updateDarkMode);
  observer.observe(document.documentElement, { 
    attributes: true, 
    attributeFilter: ['class', 'data-theme'] 
  });

  // Fox avatar URL
  const FOX_AVATAR = 'https://raw.githubusercontent.com/info-cogniterra/chatbotreal/main/assets/avatar.png';
  const LOGO_URL = 'https://raw.githubusercontent.com/info-cogniterra/chatbotreal/main/assets/brand-icon.png';
  
  // === Global data cache for lazy loading ===
  const DATA_CACHE = { byt:null, dum:null, pozemek:null, up:null, _loading:{} };
  async function loadData(kind){
    const key = (kind||'').toLowerCase();
    if (!['byt','dům','dum','pozemek','up'].includes(key)) return null;
    const norm = key.replace('dům','dum');
    if (DATA_CACHE[norm]) return DATA_CACHE[norm];
    if (DATA_CACHE._loading[norm]) return DATA_CACHE._loading[norm];
    let url = null;
    try { if (S && S.cfg && S.cfg.data_urls && S.cfg.data_urls[norm]) url = S.cfg.data_urls[norm]; } catch(e){}
    if (!url) {
      const DU = {
        byt: (window.CGTR_DATA_BYT_URL || null),
        dum: (window.CGTR_DATA_DUM_URL || null),
        pozemek: (window.CGTR_DATA_POZEMEK_URL || null),
        up: (window.CGTR_DATA_UP_URL || null)
      };
      url = DU[norm] || null;
    }
    if (!url) {
      if (window.PRICES && window.PRICES[norm]) {
        DATA_CACHE[norm] = window.PRICES[norm]; 
        try { if (norm === 'up') { S.data = S.data || {}; S.data.up = DATA_CACHE[norm]; } } catch(e){}
        return DATA_CACHE[norm];
      }
      return null;
    }
    const p = fetch(url, {credentials:'omit'}).then(r => r.json()).then(j => (window.PRICES[norm] = DATA_CACHE[norm] = j));
    DATA_CACHE._loading[norm] = p;
    try { const res = await p; delete DATA_CACHE._loading[norm]; return res; }
    catch(e){ delete DATA_CACHE._loading[norm]; console.warn('[Widget] Lazy load failed for', norm, e); return null; }
  }

  window.PRICES = window.PRICES || {};
  
  const U = {
    el(tag, props, kids) {
      const n = document.createElement(tag);
      if (props) for (const k in props) {
        if (k === "class") n.className = props[k];
        else if (k === "style") Object.assign(n.style, props[k]);
        else if (k.startsWith("on")) n[k] = props[k];
        else n.setAttribute(k, props[k]);
      }
      (kids || []).forEach((c) => {
        if (typeof c === "string") n.appendChild(document.createTextNode(c));
        else if (c) n.appendChild(c);
      });
      return n;
    },
    input(name, placeholder, type = "text") {
      return U.el("input", { id: name, name, placeholder, type, class: "cg-input" });
    },
    select(name, options) {
      const s = U.el("select", { id: name, name, class: "cg-select" });
      options.forEach((o) => s.appendChild(U.el("option", { value: o }, [o])));
      return s;
    },
    emailOk(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || ""); },
    phoneOk(v) { return /^\+?[0-9\s\-()]{7,}$/.test(v || ""); },
    norm(v) { 
      return (v || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    },
    fetchJson(url) { return fetch(url, { credentials: "omit" }).then(r => r.json()); },
    
    clearIntents() {
      console.log('[Widget] Clearing all intent flags');
      S.intent.contactOffer = false;
      S.intent.upOffer = false;
      S.intent.waitingForLocation = false;
    },
    
    searchUP(query, upData) {
      if (!upData || !upData.map || !Array.isArray(upData.map)) {
        console.error('[Widget] Invalid UP data structure');
        return [];
      }
      
      const q = U.norm(query);
      console.log('[Widget] Searching UP for:', query, '-> normalized:', q);
      
      const kuExact = [];
      const kuPartial = [];
      const obecExact = [];
      const obecPartial = [];
      
      for (const item of upData.map) {
        if (!item || !item.ku || !item.obec) continue;
        
        const kuNorm = U.norm(item.ku);
        const obecNorm = U.norm(item.obec);
        
        if (kuNorm === q) {
          kuExact.push(item);
        }
        else if (kuNorm.includes(q) || q.includes(kuNorm)) {
          kuPartial.push(item);
        }
        else if (obecNorm === q) {
          obecExact.push(item);
        }
        else if (obecNorm.includes(q) || q.includes(obecNorm)) {
          obecPartial.push(item);
        }
      }
      
      console.log('[Widget] Found - KU exact:', kuExact.length, 'KU partial:', kuPartial.length, 
                  'Obec exact:', obecExact.length, 'Obec partial:', obecPartial.length);
      
      if (kuExact.length > 0) return kuExact;
      if (kuPartial.length > 0) return kuPartial.slice(0, 10);
      if (obecExact.length > 0) return obecExact;
      return obecPartial.slice(0, 10);
    },
    
    extractLocationFromUP(text) {
      console.log('[Widget] extractLocationFromUP INPUT:', text);
      
      const normalized = U.norm(text);
      console.log('[Widget] extractLocationFromUP NORMALIZED:', normalized);
      
      const multipleLocations = /\b(a|nebo|či)\b/.test(normalized);
      if (multipleLocations) {
        console.log('[Widget] ⚠️ Multiple locations detected');
        return ['__MULTIPLE__'];
      }
      
      const patterns = [
        /(?:uzemni\s+plan|up)\s+(?:pro|v|ve|na)\s+([^\s]+)/i,
        /(?:uzemni\s+plan|up)\s+([^\s]+)/i,
        /(?:pro|v|ve|na)\s+([^\s]+)\s+(?:uzemni\s+plan|up)/i
      ];
      
      for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        const match = normalized.match(pattern);
        console.log(`[Widget] Pattern ${i} test:`, pattern.toString(), '→ match:', match);
        
        if (match && match[1]) {
          const location = match[1].trim();
          console.log('[Widget] ✅ Extracted location:', location);
          return [location];
        }
      }
      
      console.log('[Widget] ❌ No location extracted');
      return [];
    },
    
    mentionsProperty(text) {
      const s = U.norm(text);
      const keywords = [
        'pozemek', 'parcela', 'stavba', 'nehnutelnost', 'reality',
        'katastr', 'vlastnictvi', 'koupit', 'prodat', 'zastavitelnost'
      ];
      return keywords.some(kw => s.includes(kw));
    },
    
    saveSession() {
      try {
        const sessionData = {
          flow: S.flow,
          tempPricing: S.tempPricing,
          messages: S.chat.messages.slice(-10),
          timestamp: Date.now(),
          quickActionsUsed: S.quickActionsUsed
        };
        localStorage.setItem('cgtr_session_' + S.session, JSON.stringify(sessionData));
        console.log('[Widget] Session saved');
      } catch(e) {
        console.warn('[Widget] Could not save session:', e);
      }
    },
    
    loadSession() {
      try {
        const saved = localStorage.getItem('cgtr_session_' + S.session);
        if (saved) {
          const data = JSON.parse(saved);
          if (Date.now() - data.timestamp < 1800000) {
            S.flow = data.flow;
            S.tempPricing = data.tempPricing;
            S.chat.messages = data.messages || [];
            S.quickActionsUsed = data.quickActionsUsed || { pricing: false, help: false };
            console.log('[Widget] Session restored');
            return true;
          }
        }
      } catch(e) {
        console.warn('[Widget] Could not load session:', e);
      }
      return false;
    }
  };

  // === NEW BRAND DESIGN STYLES WITH DARK MODE ===
  const style = document.createElement("style");
  style.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  
  :host {
    all: initial;
    display: block;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    
    /* Brand colors - Cogniterra palette */
    --gold: #D4AF37;
    --green: #295f2d;
    --green-light: #3b7a3f;
    --green-soft: #76C68E;
    
    /* Button gradient */
    --btn-gradient: linear-gradient(90deg, #295f2d 0%, #3b7a3f 100%);
    
    /* Light mode (default) */
    --surface: #ffffff;
    --text: #0f0f0f;
    --muted: #5f6368;
    --gray-50: #fafafa;
    --gray-100: #f5f5f5;
    --gray-200: #e5e5e5;
    --gray-600: #4b5563;
    --gray-900: #111827;
    --border-color: rgba(0, 0, 0, 0.06);
    --header-bg: linear-gradient(90deg, #244e28 0%, #31662f 100%);
    --header-text: #fff;
    
    /* Radius */
    --radius-sm: 12px;
    --radius-md: 16px;
    --radius-lg: 24px;
    
    /* Shadows */
    --shadow-card: 0 8px 24px rgba(0, 0, 0, 0.04);
    --shadow-btn: 0 10px 26px rgba(41, 95, 45, 0.22);
    
    /* Typography */
    --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    --font-weight-normal: 400;
    --font-weight-semibold: 600;
    --font-weight-bold: 800;
    --font-weight-black: 900;
  }
  
  /* Dark mode overrides */
  :host([data-theme="dark"]) {
    --surface: #0d0d0d;
    --text: #f0f0f0;
    --muted: #9aa4b2;
    --gray-50: #111111;
    --gray-100: #1a1a1a;
    --gray-200: #293042;
    --gray-600: #9ca3af;
    --gray-900: #f1f5f9;
    --border-color: rgba(255, 255, 255, 0.08);
    --header-bg: linear-gradient(90deg, #1f4422 0%, #295f2d 100%);
    --header-text: #f0f0f0;
    --shadow-card: 0 14px 36px rgba(0, 0, 0, 0.55);
    --shadow-btn: 0 12px 32px rgba(41, 95, 45, 0.35);
  }
  
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  
  /* === Chat Container === */
  .chat-container {
    font: 15px/1.6 var(--font-sans);
    color: var(--text);
    background: var(--surface);
    border-radius: var(--radius-lg);
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    width: 100%;
    max-width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: absolute;
    inset: 0;
  }
  
  /* === Header with Logo === */
 /* === Header with brand gradient === */
.chat-header {
  background: var(--header-bg);
  color: var(--header-text);
  padding: 12px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  min-height: 60px;
}

.chat-header-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.chat-header-logo {
  height: 40px;
  width: auto;
  object-fit: contain;
}

.chat-header-title {
  font-weight: 700;
  font-size: 17px;
  letter-spacing: -0.3px;
  background: linear-gradient(135deg, var(--gold), rgba(255, 255, 255, 0.95));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 1px 1px rgba(0,0,0,0.15));
  text-shadow: none;
}

.chat-close-btn {
  background: rgba(255, 255, 255, 0.25);
  border: none;
  color: var(--header-text);
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  transition: background 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.chat-close-btn:hover {
  background: rgba(255, 255, 255, 0.35);
}

.chat-close-btn:active {
  background: rgba(255, 255, 255, 0.45);
}
  
  /* === Messages Area === */
  .chat-messages {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
    background: 
      radial-gradient(900px 300px at 10% -5%, color-mix(in oklab, var(--green) 6%, transparent) 0%, transparent 60%),
      radial-gradient(800px 280px at 95% 105%, color-mix(in oklab, var(--gold) 8%, transparent) 0%, transparent 65%),
      var(--gray-50);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .chat-messages::-webkit-scrollbar {
    width: 8px;
  }
  
  .chat-messages::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .chat-messages::-webkit-scrollbar-thumb {
    background: #CBD5E0;
    border-radius: 4px;
  }
  
  .chat-messages::-webkit-scrollbar-thumb:hover {
    background: #A0AEC0;
  }
  
  /* === Message Bubbles with Avatars === */
  .chat-msg {
    display: flex;
    gap: 10px;
    margin: 8px 0;
    align-items: flex-end; /* FIX 1: Změna z flex-start na flex-end pro umístění avatara dolů */
    animation: slideIn 0.3s ease;
  }
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .chat-msg.ai {
    flex-direction: row;
  }
  
  .chat-msg.me {
    flex-direction: row-reverse;
  }
  
  .msg-avatar {
    width: 40px;
    height: 40px;
    border-radius: 0;
    flex-shrink: 0;
    object-fit: contain;
    border: none;
    box-shadow: none;
    background: transparent;
    align-self: flex-end; /* FIX 1: Zajišťuje, že avatar bude vždy dole */
  }
  
  .msg-content {
    padding: 14px 18px;
    border-radius: 18px;
    max-width: 75%;
    word-wrap: break-word;
    overflow-wrap: break-word;
    white-space: pre-wrap;
    box-shadow: var(--shadow-card);
    line-height: 1.5;
  }
  
  .chat-msg.ai .msg-content {
    background: var(--surface);
    border-bottom-left-radius: 6px;
    color: var(--text);
    border: 1px solid var(--border-color);
  }
  
  .chat-msg.me .msg-content {
    background: var(--green);
    color: #fff;
    border-bottom-right-radius: 6px;
  }
  
  .chat-msg.loading .msg-content {
    background: #E2E8F0;
    color: var(--gray-600);
    font-style: italic;
    animation: pulse 1.5s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
  
  /* === Panel Blocks === */
  .chat-panel {
    background: transparent;
    padding: 0;
    margin: 12px 0;
    width: 100%;
  }
  
  /* === Input Area === */
  .chat-input-area {
    display: flex;
    gap: 12px;
    padding: 16px 20px;
    background: var(--surface);
    border-top: 1px solid var(--gray-50);
  }
  
  .chat-input-area textarea {
    flex: 1;
    resize: none;
    min-height: 48px;
    max-height: 120px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--gray-50);
    background: var(--gray-50);
    color: var(--text);
    padding: 14px 16px;
    font-family: var(--font-sans);
    font-size: 15px;
    line-height: 1.4;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  
  :host([data-theme="dark"]) .chat-input-area textarea {
    background: #1a1a1a;
    color: #f0f0f0;
    border-color: #355e39;
  }
  
  .chat-input-area textarea:focus {
    outline: none;
    border-color: #355e39;
    box-shadow: 0 0 0 3px rgba(53, 94, 57, 0.1);
    background: var(--surface);
  }
  
  .chat-input-area textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .chat-input-area button {
    border: 0;
    background: var(--btn-gradient);
    color: #fff;
    padding: 0 24px;
    border-radius: var(--radius-sm);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
    min-height: 48px;
    box-shadow: var(--shadow-btn);
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  
  .chat-input-area button:hover {
    transform: translateY(-1px);
    box-shadow: 0 12px 32px rgba(41, 95, 45, 0.3);
    filter: brightness(1.1);
  }
  
  .chat-input-area button:active {
    transform: translateY(0);
  }
  
  .chat-input-area button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  
  /* === Start Screen Cards === */
  .cg-start {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
  }
  
  .cg-cards {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    width: 100%;
  }
  
  .cg-card {
    width: 100%;
    text-align: left;
    background: var(--surface);
    border: none;
    border-radius: var(--radius-md);
    padding: 18px;
    cursor: pointer;
    color: var(--text);
    font-family: inherit;
    transition: all 0.2s ease;
    box-shadow: var(--shadow-card);
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  
  .cg-card:hover {
    box-shadow: 0 12px 32px rgba(0,0,0,0.08);
    transform: translateY(-2px);
  }
  
  .cg-card:active {
    transform: translateY(0);
  }
  
  .cg-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
  
  .cg-card h3 {
    margin: 0 0 8px;
    font-weight: var(--font-weight-bold);
    font-size: 17px;
    background: linear-gradient(135deg, var(--gold), var(--green));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    filter: drop-shadow(0 1px 0 rgba(0,0,0,0.06));
  }
  
  .cg-card p {
    margin: 0;
    font-size: 14px;
    color: var(--muted);
    line-height: 1.5;
  }
  
  .cg-card.secondary {
    background: #F0FFF4;
    border: 1px solid var(--green-soft);
  }
  
  /* === Form Steps === */
  .cg-step {
    background: var(--surface);
    border-radius: var(--radius-md);
    padding: 18px;
    box-shadow: var(--shadow-card);
    position: relative;
  }
  
  .cg-step label {
    display: block;
    margin: 10px 0 8px;
    color: var(--text);
    font-weight: var(--font-weight-semibold);
    font-size: 14px;
  }
  
  .cg-input, .cg-select {
    width: 100%;
    margin: 6px 0 12px;
    padding: 12px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--gray-50);
    background: var(--gray-50);
    color: var(--text);
    font-family: inherit;
    font-size: 15px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  
  :host([data-theme="dark"]) .cg-input, 
  :host([data-theme="dark"]) .cg-select {
    background: #1a1a1a;
    color: #f0f0f0;
    border-color: #355e39;
  }
  
  .cg-input:focus, .cg-select:focus {
    outline: none;
    border-color: #355e39;
    box-shadow: 0 0 0 3px rgba(53, 94, 57, 0.1);
    background: var(--surface);
  }
  
  .cg-cta {
    margin-top: 16px;
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  
  .cg-btn {
    border: 0;
    background: var(--btn-gradient);
    color: #fff;
    padding: 12px 20px;
    border-radius: var(--radius-sm);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    transition: all 0.2s ease, filter 0.2s ease;
    min-height: 48px;
    box-shadow: var(--shadow-btn);
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  
  .cg-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 12px 32px rgba(41, 95, 45, 0.3);
    filter: brightness(1.1);
  }
  
  .cg-btn:active {
    transform: translateY(0);
  }
  
  .cg-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  
  .cg-btn.secondary {
    background: var(--gray-50);
    color: var(--text);
    box-shadow: var(--shadow-card);
  }
  
  .cg-btn.secondary:hover {
    background: #E8EAED;
  }
  
  .cg-btn-disp {
    border: 2px solid var(--gray-50);
    background: var(--surface);
    color: var(--text);
    padding: 12px;
    border-radius: var(--radius-sm);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    transition: all 0.2s;
    min-height: 48px;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    font-size: 15px;
    font-family: inherit;
  }
  
  .cg-btn-disp:hover {
    border-color: var(--green);
    background: rgba(31, 106, 58, 0.05);
  }
  
  .cg-btn-disp:active,
  .cg-btn-disp.selected {
    background: var(--btn-gradient) !important;
    border-color: var(--green) !important;
    color: #fff !important;
  }
  
  /* === Lead Box === */
  .leadbox {
    border: 1px solid var(--gray-50);
    padding: 18px;
    border-radius: var(--radius-md);
    background: var(--surface);
  }
  
  .leadbox input {
    width: 100%;
    margin: 6px 0 12px;
    padding: 12px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--gray-50);
    background: var(--gray-50);
    color: var(--text);
    font-family: inherit;
    font-size: 15px;
  }
  
  .leadbox input:focus {
    outline: none;
    border-color: var(--green);
    box-shadow: 0 0 0 3px rgba(31, 106, 58, 0.1);
    background: var(--surface);
  }
  
  .leadbox input[type="checkbox"] {
    width: auto;
    margin-right: 8px;
  }
  
  .hint {
    color: var(--muted);
    font-size: 13px;
    margin-top: 8px;
  }
  
  /* === UP Results === */
  .up-result {
    background: var(--surface);
    border: 1px solid var(--gray-50);
    border-left: 4px solid var(--green);
    border-radius: var(--radius-sm);
    padding: 16px;
    margin: 10px 0;
  }
  
  .up-result h4 {
    margin: 0 0 10px 0;
    font-size: 16px;
    font-weight: var(--font-weight-bold);
    color: var(--text);
  }
  
  .up-result p {
    margin: 6px 0;
    font-size: 14px;
    color: var(--muted);
  }
  
  .up-result a {
    color: var(--green);
    text-decoration: none;
    font-weight: var(--font-weight-semibold);
    word-break: break-all;
  }
  
  .up-result a:hover {
    text-decoration: underline;
  }
  
  .up-no-result {
    background: #FFF3CD;
    border: 1px solid var(--gold);
    border-left: 4px solid var(--gold);
    border-radius: var(--radius-sm);
    padding: 16px;
    margin: 10px 0;
    color: #856404;
  }
  
  .up-offer {
    background: #E6FFED;
    border: 1px solid var(--green-soft);
    border-left: 4px solid var(--green);
    border-radius: var(--radius-sm);
    padding: 16px;
    margin: 10px 0;
    color: #22543D;
  }
  
  /* === Mapy.cz Autocomplete === */
  /* FIX 3: Přidán dark mode support pro autocomplete */
  .mapy-suggest-container {
    position: absolute;
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-top: none;
    border-radius: 0 0 var(--radius-sm) var(--radius-sm);
    box-shadow: var(--shadow-card);
    max-height: 240px;
    overflow-y: auto;
    z-index: 10000;
    display: none;
    font-family: inherit;
    pointer-events: auto;
  }
  
  :host([data-theme="dark"]) .mapy-suggest-container {
    background: #1a1a1a;
    border-color: #355e39;
    box-shadow: 0 8px 24px rgba(0,0,0,0.6);
  }
  
  .mapy-suggest-item {
    padding: 12px 16px;
    cursor: pointer;
    border-bottom: 1px solid var(--border-color);
    font-size: 14px;
    color: var(--text);
    background: var(--surface);
    transition: background 0.15s ease;
    user-select: none;
    -webkit-user-select: none;
    pointer-events: auto;
  }
  
  :host([data-theme="dark"]) .mapy-suggest-item {
    background: #1a1a1a;
    color: #f0f0f0;
    border-bottom-color: #355e39;
  }
  
  .mapy-suggest-item:last-child {
    border-bottom: none;
  }
  
  .mapy-suggest-item:hover {
    background: var(--gray-50) !important;
  }
  
  :host([data-theme="dark"]) .mapy-suggest-item:hover {
    background: #2a2a2a !important;
  }
  
  .mapy-suggest-item:active {
    background: #E2E8F0 !important;
  }
  
  :host([data-theme="dark"]) .mapy-suggest-item:active {
    background: #355e39 !important;
  }
  
  /* === Mobile Responsive === */
  @media (max-width: 480px) {
    .chat-container {
      width: 100%;
      height: 100%;
      max-width: 100%;
      border-radius: 0;
    }
    
    .chat-header {
      padding: 16px;
      padding-top: calc(16px + env(safe-area-inset-top));
    }
    
    .chat-input-area {
      padding: 14px 16px;
      padding-bottom: calc(14px + env(safe-area-inset-bottom));
    }
    
    .chat-input-area textarea,
    .cg-input,
    .cg-select,
    .leadbox input {
      font-size: 16px;
    }
    
    .msg-content {
      max-width: 82%;
    }
    
    .chat-close-btn {
      width: 40px;
      height: 40px;
      font-size: 22px;
    }
  }
  `;
  shadow.appendChild(style);

  // === BUILD UI ===
  const chatContainer = U.el("div", { class: "chat-container" });
  
  // Header with logo
  const chatHeader = U.el("div", { class: "chat-header" });
  const chatHeaderContent = U.el("div", { class: "chat-header-content" });
  
  const logo = U.el("img", { 
    class: "chat-header-logo",
    src: LOGO_URL,
    alt: "Cogniterra",
    onerror: function() {
      this.style.display = 'none';
    }
  });
  
  const chatTitle = U.el("div", { class: "chat-header-title" }, ["Asistent"]);
  
  chatHeaderContent.appendChild(logo);
  chatHeaderContent.appendChild(chatTitle);
  
  const chatCloseBtn = U.el("button", { 
    class: "chat-close-btn",
    type: "button",
    "aria-label": "Zavřít chat",
    onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('[Widget] Close button clicked');
      U.saveSession(); 
      S.formOpen=false;
      if (window.CGTR && typeof window.CGTR.hide === 'function') {
        window.CGTR.hide();
      } else {
        try {
          const closeBtn = document.querySelector('.cg-close');
          if (closeBtn) closeBtn.click();
        } catch(e) {
          console.warn('[Widget] Cannot close chat', e);
        }
      }
    }
  }, ["✕"]);
  
  chatHeader.appendChild(chatHeaderContent);
  chatHeader.appendChild(chatCloseBtn);
  chatContainer.appendChild(chatHeader);
  
  const chatMessages = U.el("div", { class: "chat-messages" });
  chatContainer.appendChild(chatMessages);
  
  const chatInputArea = U.el("div", { class: "chat-input-area" });
  const chatTextarea = document.createElement("textarea");
  chatTextarea.placeholder = "Napište zprávu…";
  chatTextarea.rows = 1;
  
  const chatSendBtn = document.createElement("button");
  chatSendBtn.textContent = "Odeslat";
  chatSendBtn.type = "button";
  
  chatInputArea.appendChild(chatTextarea);
  chatInputArea.appendChild(chatSendBtn);
  chatContainer.appendChild(chatInputArea);
  
  shadow.appendChild(chatContainer);
  
  console.log('[Widget] UI created successfully');

  // === MESSAGE FUNCTIONS ===
  function addAI(t, extra) {
    const msgWrapper = U.el("div", { class: "chat-msg ai" });
    
    const avatar = U.el("img", { 
      class: "msg-avatar",
      src: FOX_AVATAR,
      alt: "AI asistent",
      onerror: function() {
        this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%231F6A3A"/></svg>';
      }
    });
    
    const content = U.el("div", { class: "msg-content" }, [t]);
    if (extra) content.appendChild(extra);
    
    msgWrapper.appendChild(avatar);
    msgWrapper.appendChild(content);
    chatMessages.appendChild(msgWrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    try { 
      S.chat.messages.push({ role: "assistant", content: String(t) }); 
    } catch (e) {}
    
    try {
      const tt = String(t).toLowerCase();
      const offerContact = /(mohu|můžu|mám|rád|ráda)\s+(také\s+)?(vám\s+)?(ote[vw]ř[ií]t|zobrazit|spustit|poslat|zaslat)\s+(kontaktn[íi]\s+formul[aá][řr]|formul[aá][řr])/i.test(tt) ||
                           /chcete\s+(ote[vw]ř[ií]t|zobrazit|spustit)\s+(kontaktn[íi]\s+)?formul[aá][řr]/i.test(tt) ||
                           /zadat\s+sv[eé]\s+(jm[eé]no|kontakt|[uú]daje)/i.test(tt) ||
                           /(?:abyste|aby|abych)\s+(?:mohl[ai]?)?\s*zadat\s+sv[eé]/i.test(tt);
      
      const offerUP = /(chcete|potrebujete|mam\s+poslat|poslat\s+vam|najit\s+vam).*?(uzemni\s*plan|up)/i.test(tt);
      
      if (offerContact) { 
        console.log('[Widget] AI offered contact form');
        S.intent.contactOffer = true; 
      }
      if (offerUP) {
        console.log('[Widget] AI offered UP');
        S.intent.upOffer = true;
      }
    } catch (e) {}
  }

  // FIX 1: Odstranění fialového avatara - uživatelské zprávy bez avatara
  function addME(t) {
    try { 
      S.chat.messages.push({ role:"user", content: String(t) }); 
    } catch(_){}
    
    const msgWrapper = U.el("div", { class: "chat-msg me" });
    const content = U.el("div", { class: "msg-content" }, [t]);
    
    msgWrapper.appendChild(content);
    // FIX 1: Žádný avatar pro uživatelské zprávy
    chatMessages.appendChild(msgWrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  function addPanel(el) {
    const w = U.el("div", { class: "chat-panel" }, []);
    w.appendChild(el);
    chatMessages.appendChild(w);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  function addLoading(text) {
    const msgWrapper = U.el("div", { class: "chat-msg ai loading" });
    
    const avatar = U.el("img", { 
      class: "msg-avatar",
      src: FOX_AVATAR,
      alt: "AI asistent"
    });
    
    const content = U.el("div", { class: "msg-content" }, [text || "⏳ Zpracovávám..."]);
    
    msgWrapper.appendChild(avatar);
    msgWrapper.appendChild(content);
    chatMessages.appendChild(msgWrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return msgWrapper;
  }

  // Mapy.cz Geocoding API autocomplete
  // FIX 3: Opraveno pro pozemky - správné použití type parametru
  function attachSuggest(inputEl, isPozemek) {
    if (!inputEl) {
      console.warn('[Widget] attachSuggest: no input element');
      return;
    }
    
    const key = (S.cfg && S.cfg.mapy_key) || "EreCyrH41se5wkNErc5JEWX2eMLqnpja5BUVxsvpqzM";
    
    console.log('[Widget] Setting up Mapy.cz Geocoding autocomplete, isPozemek:', isPozemek);
    
    const suggestContainer = document.createElement('div');
    suggestContainer.className = 'mapy-suggest-container';
    
    let parentStep = inputEl.parentElement;
    while (parentStep && !parentStep.classList.contains('cg-step')) {
      parentStep = parentStep.parentElement;
    }
    
    if (parentStep) {
      parentStep.style.position = 'relative';
      parentStep.appendChild(suggestContainer);
    }
    
    let debounceTimer = null;
    let isSelecting = false;
    
    function updatePosition() {
      const inputRect = inputEl.getBoundingClientRect();
      const parentRect = parentStep.getBoundingClientRect();
      
      Object.assign(suggestContainer.style, {
        width: inputRect.width + 'px',
        left: (inputRect.left - parentRect.left) + 'px',
        top: (inputRect.bottom - parentRect.top) + 'px',
        marginTop: '-1px'
      });
    }
    
    async function fetchSuggestions(query) {
      if (!query || query.length < 2) {
        suggestContainer.style.display = 'none';
        return;
      }
      
      if (isSelecting) {
        console.log('[Widget] Skipping fetch - user is selecting');
        return;
      }
      
      try {
        // FIX 3: Pro pozemky používáme regional.municipality (obce), pro ostatní regional.address (adresy)
        const type = 'regional.address';  // PRO VŠECHNY
        const url = `https://api.mapy.cz/v1/geocode?lang=cs&limit=10&type=${type}&query=${encodeURIComponent(query)}&apikey=${key}`;
        
        console.log('[Widget] Fetching geocoding for:', query, 'type:', type);
        
        const response = await fetch(url);
        if (!response.ok) {
          console.error('[Widget] Geocoding API error:', response.status);
          return;
        }
        
        const data = await response.json();
        const items = data.items || [];
        
        console.log('[Widget] Geocoding returned', items.length, 'results');
        
        const results = [];
        
        for (const item of items) {
          const locLower = String(item.location || '').toLowerCase();
          const ctry = String(item.country || (item.address && item.address.country) || '').toLowerCase();
          const countryOk = /,\s*(česko|czech republic)\s*$/.test(locLower) || ['cz','czechia','česko','czech republic'].includes(ctry);
          if (!countryOk) continue;

          const name = String(item.name || '').trim();
          let displayText = '';
          
          if (isPozemek) {
  const locationStr = String(item.location || '').trim();
  if (locationStr) {
    const parts = locationStr.replace(/,\s*(Česko|Czech Republic)\s*$/i, '').trim().split(',');
    const obec = parts[parts.length - 1].trim();
    displayText = obec || name;
  } else {
    displayText = name;
  }
} else {
  // ← PŘIDAT TUTO CELOU ELSE VĚTEV
  const locationStr = String(item.location || '').trim();
  let municipality = '';
  
  if (locationStr) {
    const cleanLocation = locationStr.replace(/,\s*(Česko|Czech Republic)\s*$/i, '').trim();
    municipality = cleanLocation.split(',')[0].trim();
  }
  
  if (name && municipality) {
    displayText = `${name}, ${municipality}`;
  } else if (name) {
    displayText = name;
  } else if (municipality) {
    displayText = municipality;
  }
}
          
          if (displayText && displayText.length > 2) {
            results.push(displayText);
          }
          
          if (results.length >= 10) break;
        }
        
        if (results.length > 0) {
          renderSuggestions(results);
        } else {
          suggestContainer.style.display = 'none';
        }
        
      } catch (e) {
        console.error('[Widget] Geocoding fetch error:', e);
        suggestContainer.style.display = 'none';
      }
    }
    
    function renderSuggestions(items) {
      suggestContainer.innerHTML = '';
      updatePosition();
      
      const unique = [];
      const seen = new Set();
      
      for (const item of items) {
        const text = String(item).trim();
        const key = text.toLowerCase();
        if (text && !seen.has(key)) {
          seen.add(key);
          unique.push(text);
        }
      }
      
      unique.forEach((text) => {
        const div = document.createElement('div');
        div.className = 'mapy-suggest-item';
        div.textContent = text;
        div.setAttribute('data-value', text);
        
        div.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const selectedValue = div.getAttribute('data-value');
          console.log('[Widget] Selected:', selectedValue);
          
          isSelecting = true;
          inputEl.value = selectedValue;
          suggestContainer.style.display = 'none';
          
          setTimeout(() => {
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            
            setTimeout(() => {
              isSelecting = false;
            }, 500);
          }, 10);
          
          setTimeout(() => {
            inputEl.focus();
          }, 50);
        });
        
        suggestContainer.appendChild(div);
      });
      
      suggestContainer.style.display = 'block';
      console.log('[Widget] Rendered', unique.length, 'suggestions');
    }
    
    inputEl.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const value = (e.target.value || '').trim();
      
      if (isSelecting) return;
      
      debounceTimer = setTimeout(() => {
        fetchSuggestions(value);
      }, 400);
    });
    
    inputEl.addEventListener('focus', () => {
      updatePosition();
      const value = (inputEl.value || '').trim();
      
      if (value.length >= 2 && !isSelecting) {
        fetchSuggestions(value);
      }
    });
    
    inputEl.addEventListener('blur', () => {
      setTimeout(() => {
        suggestContainer.style.display = 'none';
      }, 350);
    });
    
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        suggestContainer.style.display = 'none';
        inputEl.blur();
        isSelecting = false;
      }
    });
    
    window.addEventListener('resize', updatePosition, { passive: true });
  }

  window.CG_Estimator = window.CG_Estimator || {
    estimateByt(m, p)   { return {low: 0, mid: 0, high: 0, per_m2: 0, note:"MVP"}; },
    estimateDum(m, p)   { return {low: 0, mid: 0, high: 0, per_m2: 0, note:"MVP"}; },
    estimatePozemek(m,p){ return {low: 0, mid: 0, high: 0, per_m2: 0, note:"MVP"}; }
  };

  function needsUP(q) {
    const s = U.norm(q);
    console.log('[Widget] Checking UP need for:', q);
    
    const hasUPKeyword = /\b(uzemni\s*plan|up)\b/i.test(s);
    
    if (!hasUPKeyword) return false;
    
    const explicitPatterns = [
      /uzemni\s*plan.*(?:pro|v|ve|na)\s+[a-z]/i,
      /(?:pro|v|ve|na)\s+[a-z].*uzemni\s*plan/i,
      /uzemni\s*plan\s+[a-z]/i,
      /(?:chci|potrebuji|poslat|zaslat|najit|hledam|posli|poslete)\s+(?:mi\s+)?(?:uzemni\s*plan|up)/i,
      /(?:mam|mate|muzes|muzete)\s+(?:mi\s+)?(?:poslat|zaslat|najit)\s+(?:uzemni\s*plan|up)/i
    ];
    
    const isExplicit = explicitPatterns.some(pattern => pattern.test(s));
    return isExplicit;
  }
  
  async function handleUPQuery(q) {
    console.log('[Widget] Handling UP query:', q);
    
    const loadingMsg = addLoading("🔍 Vyhledávám územní plán...");
    
    setTimeout(async () => {
      const locations = U.extractLocationFromUP(q);
      
      loadingMsg.remove();
      
      if (locations.length === 1 && locations[0] === '__MULTIPLE__') {
        addAI("⚠️ Zadejte prosím pouze jednu lokalitu najednou.");
        S.intent.waitingForLocation = true;
        return;
      }
      
      if (locations.length === 0) {
        addAI("Pro vyhledání územního plánu potřebuji znát obec nebo katastrální území. Můžete mi prosím uvést konkrétní lokalitu?");
        S.intent.waitingForLocation = true;
        return;
      }
      
      const upData = S.data.up || window.PRICES?.up;
      if (!upData || !upData.map) {
        addAI("Omlouvám se, databáze územních plánů není aktuálně dostupná.");
        stepContactVerify();
        return;
      }
      
      let allResults = [];
      for (const loc of locations) {
        const results = U.searchUP(loc, upData);
        if (results.length > 0) {
          allResults = results;
          break;
        }
      }
      
      if (allResults.length === 0) {
        const box = U.el("div", { class: "up-no-result" }, [
          `Pro lokalitu "${locations[0]}" jsem bohužel nenašel územní plán v databázi.`
        ]);
        addPanel(box);
        
        const ctaBox = U.el("div", { class: "cg-step" }, [
          U.el("div", { class: "cg-cta" }, [
            U.el("button", { class: "cg-btn", type: "button", onclick: () => stepContactVerify() }, ["Kontaktovat odborníka"])
          ])
        ]);
        addPanel(ctaBox);
        return;
      }
      
      if (allResults.length === 1) {
        const item = allResults[0];
        const box = U.el("div", { class: "up-result" }, [
          U.el("h4", {}, [`Územní plán: ${item.obec}`]),
          U.el("p", {}, [`Katastrální území: ${item.ku}`]),
          U.el("p", {}, [
            "Odkaz: ",
            U.el("a", { 
              href: item.url || "#",
              target: item.url ? "_blank" : "_self", 
              rel: "noopener noreferrer" 
            }, [item.url || "(odkaz nedostupný)"])
          ])
        ]);
        addAI("Našel jsem územní plán pro vaši lokalitu:", box);
        
      } else {
        addAI(`Našel jsem ${allResults.length} výsledků:`);
        
        allResults.slice(0, 5).forEach(item => {
          const box = U.el("div", { class: "up-result" }, [
            U.el("h4", {}, [`${item.obec}`]),
            U.el("p", {}, [`KÚ: ${item.ku}`]),
            U.el("p", {}, [
              U.el("a", { 
                href: item.url || "#", 
                target: item.url ? "_blank" : "_self",
                rel: "noopener noreferrer" 
              }, [item.url ? "Otevřít územní plán →" : "(odkaz nedostupný)"])
            ])
          ]);
          addPanel(box);
        });
      }
      
      const ctaBox = U.el("div", { class: "cg-step" }, [
        U.el("p", {}, ["Potřebujete další pomoc s územním plánováním?"]),
        U.el("div", { class: "cg-cta" }, [
          U.el("button", { class: "cg-btn", type: "button", onclick: () => stepContactVerify() }, ["Kontaktovat odborníka"])
        ])
      ]);
      addPanel(ctaBox);
    }, 300);
  }

  function renderStart() { 
    try{chatTextarea.focus();}catch(e){}
    addAI("Dobrý den, rád vám pomohu s vaší nemovitostí. Vyberte, co potřebujete.");

    const cards = U.el("div", { class: "cg-start" }, [
      U.el("div", { class: "cg-cards" }, [
        U.el("button", { 
          class: "cg-card", 
          type: "button", 
          onclick: () => startPricing(),
        }, [
          U.el("h3", {}, ["Nacenit nemovitost"]),
          U.el("p", {}, ["Rychlý odhad a krátký dotazník (1–2 min)."])
        ]),
        U.el("button", { 
          class: "cg-card", 
          type: "button", 
          onclick: () => startHelp(),
        }, [
          U.el("h3", {}, ["Potřebuji pomoct"]),
          U.el("p", {}, ["Zeptejte se na postup, dokumenty nebo pravidla."])
        ])
      ])
    ]);

    addPanel(cards);
  }

  // FIX 2: Funkce startHelp s prevencí opakovaného spuštění
  function startHelp() { 
    if (S.quickActionsUsed.help) {
      addAI("Chat je již otevřený. Ptejte se na cokoliv.");
      return;
    }
    S.quickActionsUsed.help = true;
    U.saveSession();
    chatInputArea.style.display='flex'; 
    try{chatTextarea.focus();}catch(e){}
    addAI("Rozumím. Ptejte se na cokoliv k nemovitostem, ISNS apod.");
  }

  // FIX 2: Funkce startPricing s prevencí opakovaného spuštění
  function startPricing() {
    if (S.formOpen || S.quickActionsUsed.pricing) { 
      addAI("Dotazník už je otevřený."); 
      return; 
    }
    S.quickActionsUsed.pricing = true;
    S.formOpen = true;
    S.flow = "pricing";
    U.saveSession();
    stepChooseType();
  }

  function stepChooseType() {
  if (S.typeSelected) {
    addAI("Typ nemovitosti již byl vybrán.");
    return;
  }
  
  // Uchovej reference na tlačítka pro možnost jejich deaktivace
  let allButtons = [];
  
  const byt = U.el("button", { class: "cg-btn", type: "button", onclick: () => {
    if (S.typeSelected) return; // Dvojitá ochrana
    S.typeSelected = true;
    U.saveSession(); // Ulož stav okamžitě
    
    // Deaktivuj všechna tlačítka
    allButtons.forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
    });
    
    stepLocation("Byt");
  }}, ["Byt"]);
  
  const dum = U.el("button", { class: "cg-btn", type: "button", onclick: () => {
    if (S.typeSelected) return; // Dvojitá ochrana
    S.typeSelected = true;
    U.saveSession(); // Ulož stav okamžitě
    
    // Deaktivuj všechna tlačítka
    allButtons.forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
    });
    
    stepLocation("Dům");
  }}, ["Dům"]);
  
  const poz = U.el("button", { class: "cg-btn", type: "button", onclick: () => {
    if (S.typeSelected) return; // Dvojitá ochrana
    S.typeSelected = true;
    U.saveSession(); // Ulож stav okamžitě
    
    // Deaktivuj všechna tlačítka
    allButtons.forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
    });
    
    stepLocation("Pozemek");
  }}, ["Pozemek"]);
  
  // Ulož reference pro pozdější deaktivaci
  allButtons = [byt, dum, poz];
  
  const box = U.el("div", { class: "cg-step" }, [
    U.el("label", {}, ["Vyberte typ nemovitosti"]),
    U.el("div", { class: "cg-cta" }, [byt, dum, poz])
  ]);
  addAI("Nacenění – krok 1/3", box);
}

  function stepLocation(typ) {
    const isPozemek = (typ === "Pozemek");
    try {
      if (isPozemek) { loadData('pozemek'); }
      else if (typ === "Byt") { loadData('byt'); }
      else if (typ === "Dům") { loadData('dum'); }
    } catch(e) {}

    const locationInput = U.input("lokalita", 
      isPozemek ? "Začněte psát obec..." : "Začněte psát ulici a obec...", 
      "text"
    );
    
    const hint = U.el("div", { class: "hint" }, [
      isPozemek 
        ? "Našeptávač vám nabídne pouze obce."
        : "Našeptávač vám nabídne ulice ve formátu 'Ulice, Obec'."
    ]);
    
    const nxt = U.el("button", { class: "cg-btn", type: "button", onclick: () => {
      const rawValue = (locationInput.value || "").trim();
      
      if (!rawValue) { 
        addAI("Zadejte prosím lokalitu."); 
        locationInput.focus(); 
        return; 
      }
      
      if (isPozemek) {
        return stepParamsPozemek(rawValue);
      } else {
        if (typ === "Byt") return stepParamsByt(rawValue);
        if (typ === "Dům") return stepParamsDum(rawValue);
      }
    }}, ["Pokračovat"]);
    
    const box = U.el("div", { class: "cg-step" }, [
      U.el("label", {}, [`Lokalita – ${typ}`]),
      locationInput,
      hint,
      U.el("div", { class: "cg-cta" }, [nxt])
    ]);

    addAI("Nacenění – krok 2/3", box);
    
    setTimeout(() => {
      attachSuggest(locationInput, isPozemek);
    }, 100);
  }

  function stepParamsByt(adresa) {
    const dispositions = [
      "1+kk", "1+1", "2+kk", "2+1", "3+kk", "3+1",
      "4+kk", "4+1", "5+kk", "5+1", "6+kk", "6+1"
    ];
    
    let selectedDisposition = null;
    let selectedStav = "Dobrý";
    let selectedVlast = "osobní";
    
    const dispGrid = U.el("div", { 
      style: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginBottom: "16px" } 
    });
    
    const dispButtons = [];
    
    dispositions.forEach((disp) => {
      const btn = U.el("button", { 
        class: "cg-btn-disp", 
        type: "button",
        onclick: (e) => {
          e.preventDefault();
          dispButtons.forEach(b => {
            b.style.background = "var(--surface)";
            b.style.borderColor = "var(--gray-50)";
            b.style.color = "var(--text)";
          });
          btn.style.background = "var(--btn-gradient)";
          btn.style.borderColor = "var(--green)";
          btn.style.color = "#fff";
          selectedDisposition = disp;
        }
      }, [disp]);
      
      dispButtons.push(btn);
      dispGrid.appendChild(btn);
    });
    
    const stavLabel = U.el("label", {}, ["Stav bytu"]);
    const stavButtons = [];
    const stavOptions = ["Novostavba", "Po rekonstrukci", "Dobrý", "Špatný"];
    
    const stavGrid = U.el("div", {
      style: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginBottom: "16px" }
    });
    
    stavOptions.forEach((stav) => {
      const btn = U.el("button", {
        class: "cg-btn-disp",
        type: "button",
        onclick: (e) => {
          e.preventDefault();
          stavButtons.forEach(b => {
            b.style.background = "var(--surface)";
            b.style.borderColor = "var(--gray-50)";
            b.style.color = "var(--text)";
          });
          btn.style.background = "var(--btn-gradient)";
          btn.style.borderColor = "var(--green)";
          btn.style.color = "#fff";
          selectedStav = stav;
        }
      }, [stav]);
      
      if (stav === "Dobrý") {
        btn.style.background = "var(--btn-gradient)";
        btn.style.borderColor = "var(--green)";
        btn.style.color = "#fff";
        }      
      stavButtons.push(btn);
      stavGrid.appendChild(btn);
    });
    
    const vlastLabel = U.el("label", {}, ["Vlastnictví"]);
    const vlastButtons = [];
    const vlastOptions = ["osobní", "družstevní"];
    
    const vlastGrid = U.el("div", {
      style: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginBottom: "16px" }
    });
    
    vlastOptions.forEach((vlast) => {
      const btn = U.el("button", {
        class: "cg-btn-disp",
        type: "button",
        style: { textTransform: "capitalize" },
        onclick: (e) => {
          e.preventDefault();
          vlastButtons.forEach(b => {
            b.style.background = "var(--surface)";
            b.style.borderColor = "var(--gray-50)";
            b.style.color = "var(--text)";
          });
          btn.style.background = "var(--btn-gradient)";
          btn.style.borderColor = "var(--green)";
          btn.style.color = "#fff";
          selectedVlast = vlast;
        }
      }, [vlast.charAt(0).toUpperCase() + vlast.slice(1)]);
      
      if (vlast === "osobní") {
        btn.style.background = "var(--btn-gradient)";
        btn.style.borderColor = "var(--green)";
        btn.style.color = "#fff";
      }
      
      vlastButtons.push(btn);
      vlastGrid.appendChild(btn);
    });
    
    const areaLabel = U.el("label", {}, ["Výměra (m²)"]);
    const area = U.input("vymera", "Výměra (m²)", "number");
    
    const go = U.el("button", { 
      class: "cg-btn", 
      type: "button", 
      onclick: () => {
        if (!selectedDisposition) {
          addAI("⚠️ Prosím vyberte dispozici bytu.");
          return;
        }
        
        const vymera = parseFloat(area.value || 0);
        if (!vymera || vymera <= 0) {
          addAI("⚠️ Prosím zadejte platnou výměru v m².");
          area.focus();
          return;
        }
        
        const params = { 
          typ: "Byt", 
          adresa: adresa,
          dispozice: selectedDisposition, 
          stav_bytu: selectedStav, 
          vlastnictvi: selectedVlast, 
          vymera: vymera 
        };
        
        renderLeadBoxPricing(params);
      }
    }, ["Pokračovat k odhadu"]);
    
    const box = U.el("div", { class: "cg-step" }, [
      U.el("label", {}, ["Parametry bytu"]),
      U.el("div", { class: "hint" }, ["Adresa: " + adresa]),
      U.el("label", { style: { marginTop: "12px" } }, ["Dispozice"]),
      dispGrid,
      stavLabel,
      stavGrid,
      vlastLabel,
      vlastGrid,
      areaLabel,
      area,
      U.el("div", { class: "cg-cta" }, [go])
    ]);
    
    addAI("Nacenění – krok 3/3", box);
     // FIX: Scroll na začátek nového formuláře
  setTimeout(() => {
    const panels = chatMessages.querySelectorAll('.chat-panel');
    const lastPanel = panels[panels.length - 1];
    if (lastPanel) {
      lastPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 50);
  }

  function stepParamsDum(adresa) {
    let selectedTypDomu = "Rodinný dům";
    let selectedTyp = "Cihlová";
    let selectedStav = "Dobrý";
    let selectedZatepleni = "NE";
    let selectedOkna = "NE";
    let selectedParkovani = "Žádné";

    const typDomuLabel = U.el("label", {}, ["Typ domu"]);
    const typDomuOptions = ["Rodinný dům", "Řadový", "Dvojdům", "Vila", "Chata/Chalupa"];
    const typDomuButtons = [];
    const typDomuGrid = U.el("div", { style: { display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"8px", marginBottom:"16px" } });
    
    typDomuOptions.forEach((opt) => {
      const btn = U.el("button", { 
        class:"cg-btn-disp", 
        type:"button", 
        onclick:(e)=>{ 
          e.preventDefault(); 
          typDomuButtons.forEach(b=>{
            b.style.background="var(--surface)"; 
            b.style.borderColor="var(--gray-50)"; 
            b.style.color="var(--text)";
          }); 
          btn.style.background="var(--btn-gradient)"; 
          btn.style.borderColor="var(--green)";
          btn.style.color="#fff"; 
          selectedTypDomu=opt;
        }
      }, [opt]);
      
      if (opt === "Rodinný dům") {
        btn.style.background = "var(--btn-gradient)";
        btn.style.borderColor = "var(--green)";
        btn.style.color = "#fff";
      }
      
      typDomuButtons.push(btn); 
      typDomuGrid.appendChild(btn);
    });

    const typLabel = U.el("label", {}, ["Typ stavby"]);
    const typOptions = ["Cihlová", "Dřevostavba", "Smíšená", "Nevím"];
    const typButtons = [];
    const typGrid = U.el("div", {
      style: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginBottom: "16px" }
    });
    
    typOptions.forEach((typ) => {
      const btn = U.el("button", {
        class: "cg-btn-disp",
        type: "button",
        onclick: (e) => {
          e.preventDefault();
          typButtons.forEach(b => {
            b.style.background = "var(--surface)";
            b.style.borderColor = "var(--gray-50)";
            b.style.color = "var(--text)";
          });
          btn.style.background = "var(--btn-gradient)";
          btn.style.borderColor = "var(--green)";
          btn.style.color = "#fff";
          selectedTyp = typ;
        }
      }, [typ]);
      
      if (typ === "Cihlová") {
        btn.style.background = "var(--btn-gradient)";
        btn.style.borderColor = "var(--green)";
        btn.style.color = "#fff";
      }
      
      typButtons.push(btn);
      typGrid.appendChild(btn);
    });

    const stavLabel = U.el("label", {}, ["Stav domu"]);
    const stavOptions = ["Novostavba", "Po rekonstrukci", "Dobrý", "Horší"];
    const stavButtons = [];
    const stavGrid = U.el("div", { style: { display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"8px", marginBottom:"16px" } });
    
    stavOptions.forEach((opt) => {
      const btn = U.el("button", { 
        class:"cg-btn-disp", 
        type:"button", 
        onclick:(e)=>{ 
          e.preventDefault(); 
          stavButtons.forEach(b=>{
            b.style.background="var(--surface)"; 
            b.style.borderColor="var(--gray-50)"; 
            b.style.color="var(--text)";
          }); 
          btn.style.background="var(--btn-gradient)"; 
          btn.style.borderColor="var(--green)";
          btn.style.color="#fff"; 
          selectedStav=opt;
        }
      }, [opt]);
      
      if (opt === "Dobrý") {
        btn.style.background = "var(--btn-gradient)";
        btn.style.borderColor = "var(--green)";
        btn.style.color = "#fff";
      }
      
      stavButtons.push(btn); 
      stavGrid.appendChild(btn);
    });

    const zatepleniLabel = U.el("label", {}, ["Zateplený?"]);
    const zatepleniOptions = ["ANO", "NE"];
    const zatepleniButtons = [];
    const zatepleniGrid = U.el("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginBottom: "16px" } });
    
    zatepleniOptions.forEach((opt) => {
      const btn = U.el("button", {
        class: "cg-btn-disp",
        type: "button",
        onclick: (e) => {
          e.preventDefault();
          zatepleniButtons.forEach(b => {
            b.style.background = "var(--surface)";
            b.style.borderColor = "var(--gray-50)";
            b.style.color = "var(--text)";
          });
          btn.style.background = "var(--btn-gradient)";
          btn.style.borderColor = "var(--green)";
          btn.style.color = "#fff";
          selectedZatepleni = opt;
        }
      }, [opt]);
      
      if (opt === "NE") {
        btn.style.background = "var(--btn-gradient)";
        btn.style.borderColor = "var(--green)";
        btn.style.color = "#fff";
      }
      
      zatepleniButtons.push(btn);
      zatepleniGrid.appendChild(btn);
    });

    const oknaLabel = U.el("label", {}, ["Nová okna?"]);
    const oknaOptions = ["ANO", "NE"];
    const oknaButtons = [];
    const oknaGrid = U.el("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginBottom: "16px" } });
    
    oknaOptions.forEach((opt) => {
      const btn = U.el("button", {
        class: "cg-btn-disp",
        type: "button",
        onclick: (e) => {
          e.preventDefault();
          oknaButtons.forEach(b => {
            b.style.background = "var(--surface)";
            b.style.borderColor = "var(--gray-50)";
            b.style.color = "var(--text)";
          });
          btn.style.background = "var(--btn-gradient)";
          btn.style.borderColor = "var(--green)";
          btn.style.color = "#fff";
          selectedOkna = opt;
        }
      }, [opt]);
      
      if (opt === "NE") {
        btn.style.background = "var(--btn-gradient)";
        btn.style.borderColor = "var(--green)";
        btn.style.color = "#fff";
      }
      
      oknaButtons.push(btn);
      oknaGrid.appendChild(btn);
    });

    const parkLabel = U.el("label", {}, ["Parkování"]);
    const parkOptions = ["Žádné", "Venkovní stání", "Garáž 1×", "Garáž 2×"];
    const parkButtons = [];
    const parkGrid = U.el("div", { style: { display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"8px", marginBottom:"16px" } });
    
    parkOptions.forEach((opt) => {
      const btn = U.el("button", { 
        class:"cg-btn-disp", 
        type:"button", 
        onclick:(e)=>{ 
          e.preventDefault(); 
          parkButtons.forEach(b=>{
            b.style.background="var(--surface)"; 
            b.style.borderColor="var(--gray-50)"; 
            b.style.color="var(--text)";
          }); 
          btn.style.background="var(--btn-gradient)"; 
          btn.style.borderColor="var(--green)";
          btn.style.color="#fff"; 
          selectedParkovani=opt;
        }
      }, [opt]);
      
      if (opt === "Žádné") {
        btn.style.background = "var(--btn-gradient)";
        btn.style.borderColor = "var(--green)";
        btn.style.color = "#fff";
      }
      
      parkButtons.push(btn); 
      parkGrid.appendChild(btn);
    });

    const areaLabel = U.el("label", {}, ["Výměra domu (m²)"]);
    const area = U.input("vymera", "Výměra (m²)", "number");

    const go = U.el("button", { 
      class: "cg-btn", 
      type: "button", 
      onclick: () => {
        const vymera = parseFloat(area.value || 0);
        if (!vymera || vymera <= 0) {
          addAI("⚠️ Prosím zadejte platnou výměru v m².");
          area.focus();
          return;
        }
        
        const params = { 
          typ: "Dům", 
          adresa: adresa,
          typ_domu: selectedTypDomu,
          typ_stavby: selectedTyp,
          stav: selectedStav,
          zatepleni: selectedZatepleni,
          okna: selectedOkna,
          parkovani: selectedParkovani,
          vymera: vymera 
        };
        
        renderLeadBoxPricing(params);
      }
    }, ["Pokračovat k odhadu"]);

    const box = U.el("div", { class: "cg-step" }, [
      U.el("label", {}, ["Parametry domu"]),
      U.el("div", { class: "hint" }, ["Adresa: " + adresa]),
      typDomuLabel, typDomuGrid,
      typLabel, typGrid,
      stavLabel, stavGrid,
      zatepleniLabel, zatepleniGrid,
      oknaLabel, oknaGrid,
      parkLabel, parkGrid,
      areaLabel, area,
      U.el("div", { class: "cg-cta" }, [go]),
    ]);

    addAI("Nacenění – krok 3/3", box);
    // FIX: Scroll na začátek nového formuláře
  setTimeout(() => {
    const panels = chatMessages.querySelectorAll('.chat-panel');
    const lastPanel = panels[panels.length - 1];
    if (lastPanel) {
      lastPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 50);
  }

  function stepParamsPozemek(obec) {
    let selectedKategorie = "Bydlení";
    let selectedSpoluvl = "NE";

    const katLabel = U.el("label", {}, ["Kategorie pozemku"]);
    const katButtons = [];
    const katOptions = [
      "Bydlení", "Komerční", "Lesy", "Louky", 
      "Pole", "Sady/vinice", "Zahrady"
    ];

    const katGrid = U.el("div", {
      style: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginBottom: "16px" }
    });

    katOptions.forEach((kat) => {
      const btn = U.el("button", {
        class: "cg-btn-disp",
        type: "button",
        onclick: (e) => {
          e.preventDefault();
          katButtons.forEach(b => {
            b.style.background = "var(--surface)";
            b.style.borderColor = "var(--gray-50)";
            b.style.color = "var(--text)";
          });
          btn.style.background = "var(--btn-gradient)";
          btn.style.borderColor = "var(--green)";
          btn.style.color = "#fff";
          selectedKategorie = kat;
        }
      }, [kat]);
      
      if (kat === "Bydlení") {
        btn.style.background = "var(--btn-gradient)";
        btn.style.borderColor = "var(--green)";
        btn.style.color = "#fff";
      }
      
      katButtons.push(btn);
      katGrid.appendChild(btn);
    });

    const areaLabel = U.el("label", {}, ["Výměra pozemku (m²)"]);
    const area = U.input("vymera", "Výměra (m²)", "number");

    const spoluvlLabel = U.el("label", {}, ["Spoluvlastnictví?"]);
    const spoluvlButtons = [];
    const spoluvlOptions = ["ANO", "NE"];

    const spoluvlGrid = U.el("div", {
      style: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginBottom: "16px" }
    });

    spoluvlOptions.forEach((opt) => {
      const btn = U.el("button", {
        class: "cg-btn-disp",
        type: "button",
        onclick: (e) => {
          e.preventDefault();
          spoluvlButtons.forEach(b => {
            b.style.background = "var(--surface)";
            b.style.borderColor = "var(--gray-50)";
            b.style.color = "var(--text)";
          });
          btn.style.background = "var(--btn-gradient)";
          btn.style.borderColor = "var(--green)";
          btn.style.color = "#fff";
          selectedSpoluvl = opt;
          if (opt === "ANO") {
            podilContainer.style.display = "block";
          } else {
            podilContainer.style.display = "none";
            podil.value = "1";
          }
        }
      }, [opt]);
      
      if (opt === "NE") {
        btn.style.background = "var(--btn-gradient)";
        btn.style.borderColor = "var(--green)";
        btn.style.color = "#fff";
      }
      
      spoluvlButtons.push(btn);
      spoluvlGrid.appendChild(btn);
    });

    const podilLabel = U.el("label", {}, ["Podíl (např. 1/2 nebo 0.5)"]);
    const podil = U.input("podil", "Např. 1/2 nebo 0.5", "text");
    podil.value = "1";

    const podilContainer = U.el("div", {
      style: { display: "none" }
    }, [podilLabel, podil]);

    const go = U.el("button", {
      class: "cg-btn",
      type: "button",
      onclick: () => {
        const vymera = parseFloat(area.value || 0);
        if (!vymera || vymera <= 0) {
          addAI("⚠️ Prosím zadejte platnou výměru v m².");
          area.focus();
          return;
        }
        const params = {
          typ: "Pozemek",
          obec: obec,
          kategorie: selectedKategorie,
          vymera: vymera,
          spoluvl: selectedSpoluvl,
          podil: podil.value || "1"
        };
        renderLeadBoxPricing(params);
      }
    }, ["Pokračovat k odhadu"]);

    const box = U.el("div", { class: "cg-step" }, [
      U.el("label", {}, ["Parametry pozemku"]),
      U.el("div", { class: "hint" }, ["Obec: " + obec]),
      katLabel,
      katGrid,
      areaLabel,
      area,
      spoluvlLabel,
      spoluvlGrid,
      podilContainer,
      U.el("div", { class: "cg-cta" }, [go]),
    ]);
    addAI("Nacenění – krok 3/3", box);
     // FIX: Scroll na začátek nového formuláře
  setTimeout(() => {
    const panels = chatMessages.querySelectorAll('.chat-panel');
    const lastPanel = panels[panels.length - 1];
    if (lastPanel) {
      lastPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 50);
  }

  function renderLeadBoxPricing(params) {
    S.tempPricing = params;
    U.saveSession();

    const box = U.el("div", { class: "leadbox" }, [
      U.el("div", {}, ["Pro ověření, že nejste robot, prosíme o zadání vašich kontaktů."]),
      U.el("input", { id: "lead_name",  name:"name",  placeholder:"Jméno" }),
      U.el("input", { id: "lead_email", name:"email", type:"email", placeholder:"E-mail" }),
      U.el("input", { id: "lead_phone", name:"phone", placeholder:"Telefon (+420…)" }),
      U.el("div", {}, ["Odesláním souhlasíte se zpracováním osobních údajů."]),
      U.el("div", { class: "cg-cta" }, [
        U.el("button", { class: "cg-btn", type: "button", onclick: () => saveLeadPricing() }, ["Odeslat a zobrazit odhad"])
      ])
    ]);
    addAI("Kontaktní ověření", box);
  }

  async function saveLeadPricing() {
    const btn = shadow.querySelector(".leadbox .cg-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Odesílám…"; }

    const nameEl  = shadow.querySelector("#lead_name");
    const emailEl = shadow.querySelector("#lead_email");
    const phoneEl = shadow.querySelector("#lead_phone");
    const name  = (nameEl  && nameEl.value)  ? nameEl.value.trim() : "";
    const email = (emailEl && emailEl.value) ? emailEl.value.trim() : "";
    const phone = (phoneEl && phoneEl.value) ? phoneEl.value.trim() : "";
    
    if (!name || !U.emailOk(email) || !U.phoneOk(phone)) {
      addAI("Zkontrolujte prosím kontaktní údaje.");
      if (btn) { btn.disabled = false; btn.textContent = "Odeslat a zobrazit odhad"; }
      return;
    }

    const payload = {
      secret: (S.cfg && S.cfg.secret) || "",
      branch: "chat",
      session_id: S.session,
      jmeno: name,
      email: email,
      telefon: phone,
      message: "Žádost o odhad z chatbota",
      source: "chat_widget_pricing",
      timestamp: new Date().toISOString(),
      path: "/lead",
      pricing_params: JSON.stringify(S.tempPricing || {}),
    };

    try {
      if (S.cfg && S.cfg.lead_url) {
        const body = new URLSearchParams(Object.entries(payload)).toString();
        let ok = false;
        try {
          const resp = await fetch(S.cfg.lead_url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body
          });
          ok = !!resp.ok;
        } catch (_) { ok = false; }
        if (!ok) {
          fetch(S.cfg.lead_url, { method:"POST", mode:"no-cors", headers:{ "Content-Type":"application/x-www-form-urlencoded"}, body }).catch(()=>{});
        }
      }
    } catch (e) {
      addAI("Nepodařilo se uložit kontakt. Zkuste to prosím znovu.");
      if (btn) { btn.disabled = false; btn.textContent = "Odeslat a zobrazit odhad"; }
      return;
    }

    if (btn) { btn.disabled = false; btn.textContent = "Odesláno"; }

    const P = S.tempPricing || {};
    try {
      const kind = (P.typ === "Byt") ? "byt" : (P.typ === "Dům") ? "dum" : "pozemek";
      if (!window.PRICES || !window.PRICES[kind]) {
        addLoading("⏳ Načítám data pro odhad…");
        await Promise.resolve(loadData(kind));
      }
    } catch(e) {}
    
    let res = null;
    
    if (P.typ === "Byt") {
      res = window.CG_Estimator.estimateByt(
        window.PRICES ? window.PRICES.byt : null, 
        P
      );
    } else if (P.typ === "Dům") {
      res = window.CG_Estimator.estimateDum(
        window.PRICES ? window.PRICES.dum : null, 
        P
      );
    } else {
      res = window.CG_Estimator.estimatePozemek(
        window.PRICES ? window.PRICES.pozemek : null, 
        P
      );
    }

    renderEstimate(res || {ok:false, reason:"Chyba výpočtu"}, P);
  }

  function renderEstimate(res, params) {
    if (!res.ok) {
      const box = U.el("div", { class: "cg-step" }, [
        U.el("label", {}, ["⚠️ Nelze spočítat odhad"]),
        U.el("div", {}, [res.reason || "Chyba při výpočtu."]),
        U.el("div", { class: "cg-cta" }, [
          U.el("button", { class: "cg-btn", type: "button", onclick: () => stepContactVerify() }, 
            ["Kontaktovat odborníka"])
        ])
      ]);
      addAI("", box);
      return;
    }
    
    const box = U.el("div", { class: "cg-step" }, [
      U.el("label", {}, ["Odhad ceny"]),
      U.el("div", { style: { fontSize: "22px", fontWeight: "var(--font-weight-black)", margin: "12px 0", color: "var(--green)" } },
        [`${(res.low?.toLocaleString?.("cs-CZ") || res.low || "-")} Kč - ${(res.mid?.toLocaleString?.("cs-CZ") || res.mid || "-")} Kč`]
      ),
      U.el("div", { style: { fontSize: "14px", margin: "8px 0", opacity: "0.9" } },
        ["Pro bližší informace Vás můžeme spojit s naším specialistou."]
      ),
      U.el("div", { class: "cg-cta", style: { marginTop: "10px" } }, [
        U.el("button", { class: "cg-btn", type: "button", onclick: () => { addAI("Děkujeme, budeme Vás kontaktovat."); } },
          ["Spojit se specialistou"]
        )
      ])
    ]);
    
    addAI("Výsledek odhadu", box);
  }

  function stepContactVerify() {
    const box = U.el("div", { class: "leadbox" }, [
      U.el("div", {}, ["Zanechte na sebe kontakt, ozvu se vám co nejdříve."]),
      U.el("input", { id: "c_name",  name:"name",  placeholder:"Jméno" }),
      U.el("input", { id: "c_email", name:"email", type:"email", placeholder:"E-mail" }),
      U.el("input", { id: "c_phone", name:"phone", placeholder:"Telefon (+420…)" }),
      U.el("div", {}, ["Odesláním souhlasíte se zpracováním osobních údajů."]),
      U.el("div", { class: "cg-cta" }, [ U.el("button", { class:"cg-btn", type:"button", onclick: () => saveLeadContact() }, ["Odeslat"]) ])
    ]);
    addAI("Kontaktní formulář", box);
  }

  async function saveLeadContact() {
    const btn = shadow.querySelector(".leadbox .cg-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Odesílám…"; }
    const name  = (shadow.querySelector("#c_name")  || {}).value || "";
    const email = (shadow.querySelector("#c_email") || {}).value || "";
    const phone = (shadow.querySelector("#c_phone") || {}).value || "";
    
    if (!name.trim() || !U.emailOk(email) || !U.phoneOk(phone)) {
      addAI("Zkontrolujte prosím kontaktní údaje.");
      if (btn) { btn.disabled = false; btn.textContent = "Odeslat"; }
      return;
    }

    const last3 = S.chat.messages.slice(-3);

    const payload = {
      secret: (S.cfg && S.cfg.secret) || "",
      branch: "chat",
      session_id: S.session,
      jmeno: name.trim(),
      email: email.trim(),
      telefon: phone.trim(),
      message: "Žádost o kontakt z chatbota",
      source: "chat_widget_contact",
      timestamp: new Date().toISOString(),
      path: "/chatbot-lead",
      last_messages: JSON.stringify(last3)
    };

    try {
      if (S.cfg && S.cfg.lead_url) {
        const body = new URLSearchParams(Object.entries(payload)).toString();
        let ok = false;
        try {
          const resp = await fetch(S.cfg.lead_url, { method: "POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body });
          ok = !!resp.ok;
        } catch (_) { ok = false; }
        if (!ok) {
          fetch(S.cfg.lead_url, { method:"POST", mode:"no-cors", headers:{ "Content-Type":"application/x-www-form-urlencoded"}, body }).catch(()=>{});
        }
      }
      addAI("Děkuji, mám vše zapsané. Ozveme se vám co nejdříve.");
    } catch (e) {
      addAI("Nepodařilo se uložit kontakt. Zkuste to prosím znovu.");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Odeslat"; }
    }
  }

  function needPricing(q) {
    const s = U.norm(q);
    return /(nacenit|nacenen|ocenit|odhad(\s*ceny)?|cena\s+nemovitosti|spocitat\s*cenu|kolik\s+to\s*stoji)/i.test(s);
  }
  
  function ask(q) {
    if (S.processing) {
      console.log('[Widget] Already processing, ignoring duplicate request');
      return;
    }
    
    try {
      if (S.intent.contactOffer) {
        const yesRe = /^(ano|jo|ok|okej|jasne|prosim|dobre|spustit|otevrit|zobraz(it)?|muzete|urcite)(\b|!|\.)?$/i;
        const noRe  = /^(ne|radeji\s+ne|pozdeji|ted\s+ne|neni)(\b|!|\.)?$/i;
        
        const trimmed = q.trim();
        
        if (yesRe.test(trimmed)) {
          addME(q);
          U.clearIntents();
          stepContactVerify();
          return;
        } else if (noRe.test(trimmed)) {
          U.clearIntents();
          addME(q);
          addAI("Dobře, pokud budete potřebovat později, dejte mi vědět!");
          return;
        }
        S.intent.contactOffer = false;
      }
    } catch(e) {}

    try {
      if (S.intent.upOffer) {
        const yesRe = /^(ano|jo|ok|okej|jasne|prosim|dobre|poslat|zaslat)(\b|!|\.)?$/i;
        const noRe  = /^(ne|radeji\s+ne|pozdeji|ted\s+ne|neni)(\b|!|\.)?$/i;
        if (yesRe.test(q.trim())) {
          addME(q);
          addAI("Pro jakou lokalitu (obec nebo katastrální území) potřebujete územní plán?");
          S.intent.upOffer = false;
          S.intent.waitingForLocation = true;
          return;
        } else if (noRe.test(q.trim())) {
          U.clearIntents();
          addME(q);
          addAI("Dobře, pokud budete potřebovat později, dejte mi vědět!");
          return;
        }
        S.intent.upOffer = false;
      }
    } catch(_) {}

    try {
      if (S.intent.waitingForLocation) {
        addME(q);
        S.intent.waitingForLocation = false;
        
        if (needsUP(q)) {
          handleUPQuery(q);
        } else {
          handleUPQuery("územní plán " + q);
        }
        return;
      }
    } catch(e) {}

    if (!q) return;
    
    S.processing = true;
    chatTextarea.disabled = true;
    chatSendBtn.disabled = true;
    
    addME(q);
    
    setTimeout(() => {
      S.processing = false;
      chatTextarea.disabled = false;
      chatSendBtn.disabled = false;
      try { chatTextarea.focus(); } catch(e) {}
    }, 500);
    
    if (needPricing(q)) { 
      startPricing(); 
      return; 
    }
    
    if (needsUP(q)) {
      try { if (!S.data.up && !(window.PRICES && window.PRICES.up)) { loadData('up'); } } catch(e){} 
      handleUPQuery(q);
      return;
    }
    
    const url = (S.cfg && (S.cfg.proxy_url || S.cfg.chat_url)) || null;
    if (!url) { 
      addAI("Rozumím. Ptejte se na cokoliv k nemovitostem, ISNS apod."); 
      return; 
    }

    const wantContact = /(^|\b)(chci ?byt ?kontaktovan|kontaktuj(te)? me|zavolejte|napiste|nechte kontakt|ozve se|muzete me kontaktovat)/i.test(U.norm(q));
    if (wantContact) { 
      U.clearIntents();
      stepContactVerify(); 
      return; 
    }
    
    (async () => {
      try {
        const typing = U.el("div", { class: "chat-msg ai" });
        const avatar = U.el("img", { class: "msg-avatar", src: FOX_AVATAR, alt: "AI" });
        const content = U.el("div", { class: "msg-content" }, ["· · ·"]);
        typing.appendChild(avatar);
        typing.appendChild(content);
        chatMessages.appendChild(typing); 
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        const form = new URLSearchParams();
        if (S.cfg && S.cfg.secret) form.set("secret", S.cfg.secret);
        
        try {
          const msgs = S.chat.messages.slice(-12);
          form.set("messages", JSON.stringify(msgs));
        } catch(_) {
          form.set("messages", JSON.stringify([{role:"user", content:q}]));
        }
        
        let resp = null;
        try { resp = await fetch(url, { method: "POST", body: form }); } catch(_) { resp = null; }
        
        typing.remove();
        
        if (!resp || !resp.ok) {
          try { 
            const u = new URL(url); 
            if (S.cfg && S.cfg.secret) u.searchParams.set("secret", S.cfg.secret); 
            try { 
              const msgs = S.chat.messages.slice(-12);
              u.searchParams.set("messages", JSON.stringify(msgs)); 
            } catch { 
              u.searchParams.set("messages", JSON.stringify([{role:"user", content:q}])); 
            } 
            try { 
              resp = await fetch(u.toString(), { method: "GET" }); 
            } catch { 
              resp = null; 
            } 
          } catch { 
            resp = null; 
          }
          
          if (!resp || !resp.ok) { 
            addAI("Omlouvám se, teď se mi nedaří získat odpověď od AI."); 
            return; 
          }
        }
        
        const ct = (resp.headers.get("content-type")||"").toLowerCase();
        let txt = ""; 
        if (ct.includes("application/json")) { 
          try { 
            const j = await resp.json(); 
            txt = j.message || j.reply || j.text || j.answer || JSON.stringify(j); 
          } catch { 
            txt = await resp.text(); 
          } 
        } else { 
          txt = await resp.text(); 
        }
        
        txt = (txt && String(txt).trim()) || "Rozumím. Ptejte se na cokoliv k nemovitostem.";
        addAI(txt);
      } catch (e) { 
        addAI("Omlouvám se, došlo k chybě při komunikaci s AI."); 
        console.error("[Widget] AI chat error:", e); 
      }
    })();
  }

  // ==== Config / data preload ====
  (async () => {
    try {
      const scriptEl = document.currentScript || document.querySelector('script[data-config]');
      const CFG_URL = scriptEl ? scriptEl.getAttribute("data-config") : null;
      if (CFG_URL) {
        S.cfg = await U.fetchJson(CFG_URL);
        console.log('[Widget] Config loaded:', S.cfg);
      }
    } catch (e) {
      console.error('[Widget] Config loading error:', e);
    }
  })();

  // ==== Init ====
  function cgSafeStart() {
    try {
      if (!chatMessages) return setTimeout(cgSafeStart, 40);
      console.log('[Widget] Rendering start screen...');
      
      if (U.loadSession() && S.chat.messages.length > 0) {
        console.log('[Widget] Session restored');
        S.chat.messages.forEach(msg => {
          if (msg.role === 'user') {
            addME(msg.content);
          } else {
            const msgWrapper = U.el("div", { class: "chat-msg ai" });
            const avatar = U.el("img", { class: "msg-avatar", src: FOX_AVATAR, alt: "AI" });
            const content = U.el("div", { class: "msg-content" }, [msg.content]);
            msgWrapper.appendChild(avatar);
            msgWrapper.appendChild(content);
            chatMessages.appendChild(msgWrapper);
          }
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
        chatInputArea.style.display = 'flex';
      } else {
        renderStart();
      }
    } catch (e) {
      console.error('[Widget] Start error:', e);
      setTimeout(cgSafeStart, 40);
    }
  }

  cgSafeStart();

  // ==== Input handlers ====
  chatSendBtn.addEventListener("click", () => { 
    const q = chatTextarea.value.trim(); 
    chatTextarea.value = ""; 
    ask(q); 
  });
  
  chatTextarea.addEventListener("keydown", (e) => { 
    if (e.key === "Enter" && !e.shiftKey) { 
      e.preventDefault(); 
      chatSendBtn.click(); 
    } 
  });

  console.log('[Widget] Initialization complete (v8.2 - Fixes Applied)');

})();
