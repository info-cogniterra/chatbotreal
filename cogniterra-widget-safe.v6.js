// === Unified viewport height handler ===
(function setVH(){
  function updateVH(){
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--vh', vh + 'px');
  }
  updateVH();
  window.addEventListener('resize', updateVH, {passive:true});
})();

// cogniterra-widget-safe.v6.js — BUBBLE-ONLY, SINGLE INSTANCE - VERZE S UP DETEKCÍ
// Build v6.21-GEOCODING-FINAL — Working Mapy.cz Geocoding API with fixed click handlers
// Date: 2025-01-18 | Author: info-cogniterra

(function () {
  "use strict";

  console.log('[Widget] Initialization started... (v6.21-GEOCODING-FINAL)');

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
    processing: false
  };

  console.log('[Widget] Session:', S.session);

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
        'pozemek',
        'parcela',
        'stavba',
        'nehnutelnost',
        'reality',
        'katastr',
        'vlastnictvi',
        'koupit',
        'prodat',
        'zastavitelnost'
      ];
      return keywords.some(kw => s.includes(kw));
    },
    
    saveSession() {
      try {
        const sessionData = {
          flow: S.flow,
          tempPricing: S.tempPricing,
          messages: S.chat.messages.slice(-10),
          timestamp: Date.now()
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
            console.log('[Widget] Session restored');
            return true;
          }
        }
      } catch(e) {
        console.warn('[Widget] Could not load session:', e);
      }
      return false;
    },
    
    parseMapyLocation(value, isPozemek) {
      if (!value || !value.trim()) return null;
      
      const parts = value.split(',').map(p => p.trim());
      
      if (isPozemek) {
        return {
          obec: parts[parts.length - 1],
          ulice: null
        };
      } else {
        if (parts.length >= 2) {
          return {
            ulice: parts[0],
            obec: parts[parts.length - 1]
          };
        } else {
          return {
            ulice: null,
            obec: parts[0]
          };
        }
      }
    }
  };

  const style = document.createElement("style");
  style.textContent = `
  :host {
    all: initial;
    display: block;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
  }
  
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  
  .chat-container {
    font: 15px/1.5 'Source Sans Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    color: #2d3748;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 15px 35px rgba(50,50,93,.1), 0 5px 15px rgba(0,0,0,.07);
    width: 100%;
    max-width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: absolute;
    inset: 0;
  }
  
  .chat-header {
    background: #2c5282;
    color: #fff;
    padding: 16px;
    font-weight: 700;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255,255,255,.1);
  }
  
  .chat-header-title {
    flex: 1;
  }
  
  .chat-close-btn {
    background: transparent;
    border: none;
    color: #fff;
    cursor: pointer;
    font-size: 18px;
    opacity: 0.8;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    min-width: 32px;
    min-height: 32px;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  
  .chat-close-btn:hover,
  .chat-close-btn:active {
    opacity: 1;
  }
  
  .chat-messages {
    flex: 1;
    padding: 16px;
    overflow-y: auto;
    background: #f8fafc;
    display: flex;
    flex-direction: column;
  }
  
  .chat-msg {
    max-width: 86%;
    margin: 10px 0;
    word-wrap: break-word;
    overflow-wrap: break-word;
    white-space: pre-wrap;
    box-shadow: 0 2px 5px rgba(0,0,0,.06);
  }
  
  .chat-msg.ai {
    background: #fff;
    border-left: 4px solid #2c5282;
    border-radius: 0 8px 8px 0;
    padding: 14px 16px;
    align-self: flex-start;
    color: #2d3748;
  }
  
  .chat-msg.me {
    background: #2c5282;
    color: #fff;
    border-radius: 8px 0 0 8px;
    border-right: 4px solid #1a365d;
    padding: 14px 16px;
    align-self: flex-end;
  }
  
  .chat-msg.loading {
    background: #e2e8f0;
    color: #4a5568;
    font-style: italic;
    animation: pulse 1.5s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
  
  .chat-panel {
    background: transparent;
    padding: 0;
    margin: 12px 0;
    width: 100%;
  }
  
  .chat-input-area {
    display: flex;
    gap: 10px;
    padding: 14px 16px;
    background: #fff;
    border-top: 1px solid #e2e8f0;
  }
  
  .chat-input-area textarea {
    flex: 1;
    resize: none;
    height: 46px;
    border-radius: 4px;
    border: 1px solid #cbd5e0;
    background: #fff;
    color: #2d3748;
    padding: 12px;
    font-family: inherit;
    font-size: 15px;
  }
  
  .chat-input-area textarea:focus {
    outline: none;
    border-color: #2c5282;
    box-shadow: 0 0 0 2px rgba(44,82,130,.2);
  }
  
  .chat-input-area textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .chat-input-area button {
    border: 0;
    background: #2c5282;
    color: #fff;
    padding: 0 18px;
    border-radius: 4px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    min-height: 46px;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  
  .chat-input-area button:hover,
  .chat-input-area button:active {
    background: #1a365d;
  }
  
  .chat-input-area button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .cg-start {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
  }
  
  .cg-cards {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    width: 100%;
  }
  
  .cg-card {
    width: 100%;
    text-align: left;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-left: 4px solid #2c5282;
    border-radius: 0 8px 8px 0;
    padding: 16px;
    cursor: pointer;
    color: #2d3748;
    font-family: inherit;
    transition: all 0.2s ease;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  
  .cg-card:hover,
  .cg-card:active {
    box-shadow: 0 4px 12px rgba(0,0,0,.08);
    border-left-color: #1a365d;
  }
  
  .cg-card h3 {
    margin: 0 0 6px;
    font-weight: 700;
    font-size: 16px;
    color: #2d3748;
  }
  
  .cg-card p {
    margin: 0;
    font-size: 14px;
    color: #4a5568;
  }
  
  .cg-card.secondary {
    border-left-color: #48bb78;
    background: #f0fff4;
  }
  
  .cg-card.secondary:hover,
  .cg-card.secondary:active {
    background: #e6ffed;
  }
  
  .cg-step {
    background: #fff;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 2px 5px rgba(0,0,0,.05);
    position: relative;
  }
  
  .cg-step label {
    display: block;
    margin: 8px 0 6px;
    color: #4a5568;
    font-weight: 600;
  }
  
  .cg-input, .cg-select {
    width: 100%;
    margin: 6px 0 12px;
    padding: 12px 14px;
    border-radius: 4px;
    border: 1px solid #cbd5e0;
    background: #fff;
    color: #2d3748;
    font-family: inherit;
    font-size: 15px;
  }
  
  .cg-input:focus, .cg-select:focus {
    outline: none;
    border-color: #2c5282;
    box-shadow: 0 0 0 2px rgba(44,82,130,.2);
  }
  
  .cg-cta {
    margin-top: 16px;
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  
  .cg-btn {
    border: 0;
    background: #2c5282;
    color: #fff;
    padding: 12px 18px;
    border-radius: 4px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    min-height: 44px;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  
  .cg-btn:hover,
  .cg-btn:active {
    background: #1a365d;
  }
  
  .cg-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .cg-btn.secondary {
    background: #48bb78;
  }
  
  .cg-btn.secondary:hover,
  .cg-btn.secondary:active {
    background: #38a169;
  }
  
  .leadbox {
    border: 1px solid #e2e8f0;
    padding: 16px;
    border-radius: 8px;
    background: #fff;
  }
  
  .leadbox input {
    width: 100%;
    margin: 6px 0 12px;
    padding: 12px 14px;
    border-radius: 4px;
    border: 1px solid #cbd5e0;
    background: #fff;
    color: #2d3748;
    font-family: inherit;
    font-size: 15px;
  }
  
  .leadbox input:focus {
    outline: none;
    border-color: #2c5282;
    box-shadow: 0 0 0 2px rgba(44,82,130,.2);
  }
  
  .leadbox input[type="checkbox"] {
    width: auto;
    margin-right: 8px;
  }
  
  .hint {
    color: #718096;
    font-size: 13px;
    margin-top: 6px;
  }
  
  .up-result {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-left: 4px solid #2c5282;
    border-radius: 0 8px 8px 0;
    padding: 14px 16px;
    margin: 8px 0;
  }
  
  .up-result h4 {
    margin: 0 0 8px 0;
    font-size: 16px;
    font-weight: 700;
    color: #2d3748;
  }
  
  .up-result p {
    margin: 4px 0;
    font-size: 14px;
    color: #4a5568;
  }
  
  .up-result a {
    color: #2c5282;
    text-decoration: none;
    font-weight: 600;
    word-break: break-all;
  }
  
  .up-result a:hover {
    text-decoration: underline;
  }
  
  .up-no-result {
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-left: 4px solid #ffc107;
    border-radius: 0 8px 8px 0;
    padding: 14px 16px;
    margin: 8px 0;
    color: #856404;
  }
  
  .up-offer {
    background: #e6ffed;
    border: 1px solid #48bb78;
    border-left: 4px solid #48bb78;
    border-radius: 0 8px 8px 0;
    padding: 14px 16px;
    margin: 8px 0;
    color: #22543d;
  }
  
  .mapy-suggest-container {
    position: absolute;
    background: white;
    border: 1px solid #cbd5e0;
    border-top: none;
    border-radius: 0 0 4px 4px;
    box-shadow: 0 4px 6px rgba(0,0,0,.1);
    max-height: 200px;
    overflow-y: auto;
    z-index: 10000;
    display: none;
    font-family: inherit;
    pointer-events: auto;
  }
  
  .mapy-suggest-item {
    padding: 10px 14px;
    cursor: pointer;
    border-bottom: 1px solid #f0f0f0;
    font-size: 14px;
    color: #2d3748;
    background: white;
    transition: background 0.15s ease;
    user-select: none;
    -webkit-user-select: none;
    pointer-events: auto;
  }
  
  .mapy-suggest-item:last-child {
    border-bottom: none;
  }
  
  .mapy-suggest-item:hover {
    background: #f8fafc !important;
  }
  
  .mapy-suggest-item:active {
    background: #e2e8f0 !important;
  }
  
  @media (max-width: 480px) {
    .chat-container {
      width: 100%;
      height: 100%;
      max-width: 100%;
      border-radius: 0;
    }
    
    .chat-input-area textarea,
    .cg-input,
    .cg-select,
    .leadbox input {
      font-size: 16px;
    }
    
    .chat-close-btn {
      width: 44px;
      height: 44px;
      min-width: 44px;
      min-height: 44px;
      font-size: 20px;
    }
  }
  `;
  shadow.appendChild(style);

  const chatContainer = U.el("div", { class: "chat-container" });
  
  const chatHeader = U.el("div", { class: "chat-header" });
  const chatTitle = U.el("div", { class: "chat-header-title" }, ["Asistent Cogniterra"]);
  const chatCloseBtn = U.el("button", { 
    class: "chat-close-btn",
    type: "button",
    "aria-label": "Zavřít chat",
    onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('[Widget] Close button clicked');
      U.saveSession();
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
  
  chatHeader.appendChild(chatTitle);
  chatHeader.appendChild(chatCloseBtn);
  chatContainer.appendChild(chatHeader);
  
  const chatMessages = U.el("div", { class: "chat-messages" });
  chatContainer.appendChild(chatMessages);
  
  const chatInputArea = U.el("div", { class: "chat-input-area" });
  const chatTextarea = document.createElement("textarea");
  chatTextarea.placeholder = "Napište zprávu…";
  
  const chatSendBtn = document.createElement("button");
  chatSendBtn.textContent = "Odeslat";
  chatSendBtn.type = "button";
  
  chatInputArea.appendChild(chatTextarea);
  chatInputArea.appendChild(chatSendBtn);
  chatContainer.appendChild(chatInputArea);
  
  shadow.appendChild(chatContainer);
  
  console.log('[Widget] UI created successfully');

  function addAI(t, extra) {
    const b = U.el("div", { class: "chat-msg ai" }, [t]);
    if (extra) b.appendChild(extra);
    chatMessages.appendChild(b);
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
        console.log('[Widget] AI offered contact form:', tt);
        S.intent.contactOffer = true; 
      }
      if (offerUP) {
        console.log('[Widget] AI offered UP');
        S.intent.upOffer = true;
      }
    } catch (e) {}
  }

  function addME(t) {
    try { 
      S.chat.messages.push({ role:"user", content: String(t) }); 
    } catch(_){}
    const b = U.el("div", { class: "chat-msg me" }, [t]);
    chatMessages.appendChild(b);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  function addPanel(el) {
    const w = U.el("div", { class: "chat-panel" }, []);
    w.appendChild(el);
    chatMessages.appendChild(w);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  function addLoading(text) {
    const b = U.el("div", { class: "chat-msg ai loading" }, [text || "⏳ Zpracovávám..."]);
    chatMessages.appendChild(b);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return b;
  }

 // FIXED: Prevent infinite loop when selecting from autocomplete
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
  let isSelecting = false; // ⬅️ FLAG pro zamezení re-open
  
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
    
    // ⬅️ PŘIDAT: Neotevírej pokud uživatel právě vybírá z listu
    if (isSelecting) {
      console.log('[Widget] Skipping fetch - user is selecting');
      return;
    }
    
    try {
      const type = isPozemek ? 'regional.municipality' : 'regional.address';
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
      if (items.length > 0) {
        console.log('[Widget] First geocoding item:', items[0]);
      }
      
      const results = [];
      
      for (const item of items) {
        const name = String(item.name || '').trim();
        const locationStr = String(item.location || '').trim();
        
        let municipality = '';
        
        if (locationStr) {
          const cleanLocation = locationStr.replace(/,\s*(Česko|Czech Republic)\s*$/i, '').trim();
          
          if (isPozemek) {
            municipality = cleanLocation;
          } else {
            municipality = cleanLocation.split(',')[0].trim();
          }
        }
        
        console.log('[Widget] Processing:', {name, locationStr, municipality});
        
        let displayText = '';
        
        if (isPozemek) {
          displayText = municipality || name;
        } else {
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
      
      console.log('[Widget] Formatted results:', results);
      
      if (results.length > 0) {
        renderSuggestions(results);
      } else {
        console.log('[Widget] No valid results found');
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
      
      div.addEventListener('mouseenter', () => {
        div.style.background = '#f8fafc';
      });
      div.addEventListener('mouseleave', () => {
        div.style.background = 'white';
      });
      
      div.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const selectedValue = div.getAttribute('data-value');
        console.log('[Widget] Mousedown on:', selectedValue);
        
        // ⬅️ KRITICKÉ: Nastavit flag PŘED nastavením hodnoty
        isSelecting = true;
        
        // Set value immediately
        inputEl.value = selectedValue;
        
        // Hide suggestions
        suggestContainer.style.display = 'none';
        
        // Trigger events (ale input handler je ignoruje kvůli isSelecting flag)
        setTimeout(() => {
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          inputEl.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('[Widget] Value set and events triggered:', selectedValue);
          
          // ⬅️ Resetovat flag po chvíli
          setTimeout(() => {
            isSelecting = false;
            console.log('[Widget] Selection completed, autocomplete ready again');
          }, 500);
        }, 10);
        
        // Keep focus on input
        setTimeout(() => {
          inputEl.focus();
        }, 50);
      });
      
      div.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const selectedValue = div.getAttribute('data-value');
        console.log('[Widget] Click fallback on:', selectedValue);
        
        isSelecting = true;
        inputEl.value = selectedValue;
        suggestContainer.style.display = 'none';
        
        setTimeout(() => {
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          inputEl.dispatchEvent(new Event('change', { bubbles: true }));
          inputEl.focus();
          
          setTimeout(() => {
            isSelecting = false;
          }, 500);
        }, 10);
      });
      
      suggestContainer.appendChild(div);
    });
    
    suggestContainer.style.display = 'block';
    console.log('[Widget] Rendered', unique.length, 'geocoding suggestions');
  }
  
  inputEl.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const value = (e.target.value || '').trim();
    
    // ⬅️ KRITICKÉ: Ignorovat input event pokud uživatel vybírá z listu
    if (isSelecting) {
      console.log('[Widget] Input event ignored - user is selecting');
      return;
    }
    
    debounceTimer = setTimeout(() => {
      fetchSuggestions(value);
    }, 400);
  });
  
  inputEl.addEventListener('focus', () => {
    updatePosition();
    const value = (inputEl.value || '').trim();
    
    // ⬅️ PŘIDAT: Neotevírej pokud uživatel právě vybírá
    if (value.length >= 2 && !isSelecting) {
      fetchSuggestions(value);
    }
  });
  
  inputEl.addEventListener('blur', (e) => {
    setTimeout(() => {
      const rect = suggestContainer.getBoundingClientRect();
      const isOverContainer = (
        e.relatedTarget && 
        suggestContainer.contains(e.relatedTarget)
      );
      
      if (!isOverContainer) {
        suggestContainer.style.display = 'none';
        console.log('[Widget] Hiding suggestions on blur');
      }
    }, 350);
  });
  
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      suggestContainer.style.display = 'none';
      inputEl.blur();
      isSelecting = false; // ⬅️ Resetovat flag
    }
  });
  
  window.addEventListener('resize', updatePosition, { passive: true });
  
  console.log('[Widget] ✅ Mapy.cz Geocoding autocomplete ready');
}

  window.CG_Estimator = window.CG_Estimator || {
    estimateByt(m, p)   { return {low: 0, mid: 0, high: 0, per_m2: 0, note:"MVP"}; },
    estimateDum(m, p)   { return {low: 0, mid: 0, high: 0, per_m2: 0, note:"MVP"}; },
    estimatePozemek(m,p){ return {low: 0, mid: 0, high: 0, per_m2: 0, note:"MVP"}; }
  };

  function needsUP(q) {
    const s = U.norm(q);
    console.log('[Widget] Checking UP need for:', q, '-> normalized:', s);
    
    const hasUPKeyword = /\b(uzemni\s*plan|up)\b/i.test(s);
    
    if (!hasUPKeyword) {
      console.log('[Widget] No UP keyword found');
      return false;
    }
    
    const explicitPatterns = [
      /uzemni\s*plan.*(?:pro|v|ve|na)\s+[a-z]/i,
      /(?:pro|v|ve|na)\s+[a-z].*uzemni\s*plan/i,
      /uzemni\s*plan\s+[a-z]/i,
      /(?:chci|potrebuji|poslat|zaslat|najit|hledam|posli|poslete)\s+(?:mi\s+)?(?:uzemni\s*plan|up)/i,
      /(?:mam|mate|muzes|muzete)\s+(?:mi\s+)?(?:poslat|zaslat|najit)\s+(?:uzemni\s*plan|up)/i
    ];
    
    const isExplicit = explicitPatterns.some(pattern => pattern.test(s));
    
    console.log('[Widget] Has UP keyword:', hasUPKeyword, 'Is explicit:', isExplicit);
    return isExplicit;
  }
  
  function handleUPQuery(q) {
    console.log('[Widget] Handling UP query:', q);
    
    const loadingMsg = addLoading("🔍 Vyhledávám územní plán...");
    
    setTimeout(() => {
      const locations = U.extractLocationFromUP(q);
      
      console.log('[Widget] Extracted locations:', locations);
      
      loadingMsg.remove();
      
      if (locations.length === 1 && locations[0] === '__MULTIPLE__') {
        addAI("⚠️ Zadejte prosím pouze jednu lokalitu najednou. Například 'územní plán pro Brno'.");
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
        addAI("Omlouvám se, databáze územních plánů není aktuálně dostupná. Zkuste to prosím později nebo mě kontaktujte pro další pomoc.");
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
      
      console.log('[Widget] Search results:', allResults.length);
      
      if (allResults.length === 0) {
        const box = U.el("div", { class: "up-no-result" }, [
          `Pro lokalitu "${locations[0]}" jsem bohužel nenašel územní plán v databázi. `,
          `Zkuste prosím upřesnit název obce, katastrálního území, nebo mě můžete kontaktovat pro další pomoc.`
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
        
        if (allResults.length > 5) {
          addAI(`... a dalších ${allResults.length - 5} výsledků. Pro přesnější vyhledávání upřesněte prosím katastrální území.`);
        }
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
        U.el("button", { class: "cg-card", type: "button", onclick: () => startPricing(), "aria-label":"Nacenit nemovitost" }, [
          U.el("h3", {}, ["Nacenit nemovitost"]),
          U.el("p", {}, ["Rychlý odhad a krátký dotazník (1–2 min)."])
        ]),
        U.el("button", { class: "cg-card", type: "button", onclick: () => startHelp(), "aria-label":"Potřebuji pomoct" }, [
          U.el("h3", {}, ["Potřebuji pomoct"]),
          U.el("p", {}, ["Zeptejte se na postup, dokumenty nebo pravidla."])
        ])
      ])
    ]);

    addPanel(cards);
  }

  function startHelp() { 
    chatInputArea.style.display='flex'; 
    try{chatTextarea.focus();}catch(e){}
    addAI("Rozumím. Ptejte se na cokoliv k nemovitostem, ISNS apod.");
  }

  function startPricing() {
    S.flow = "pricing";
    U.saveSession();
    stepChooseType();
  }

  function stepChooseType() {
    const byt = U.el("button", { class: "cg-btn", type: "button", onclick: () => stepLocation("Byt") }, ["Byt"]);
    const dum = U.el("button", { class: "cg-btn", type: "button", onclick: () => stepLocation("Dům") }, ["Dům"]);
    const poz = U.el("button", { class: "cg-btn", type: "button", onclick: () => stepLocation("Pozemek") }, ["Pozemek"]);
    const box = U.el("div", { class: "cg-step" }, [
      U.el("label", {}, ["Vyberte typ nemovitosti"]),
      U.el("div", { class: "cg-cta" }, [byt, dum, poz])
    ]);
    addAI("Nacenění – krok 1/3", box);
  }

  function stepLocation(typ) {
    const isPozemek = (typ === "Pozemek");
    
    const locationInput = U.input("lokalita", 
      isPozemek ? "Začněte psát obec..." : "Začněte psát ulici a obec...", 
      "text"
    );
    
    const hint = U.el("div", { class: "hint" }, [
      isPozemek 
        ? "Našeptávač vám nabídne pouze obce (bez ulic)."
        : "Našeptávač vám nabídne ulice ve formátu 'Ulice, Obec'."
    ]);
    
    const nxt = U.el("button", { class: "cg-btn", type: "button", onclick: () => {
      const rawValue = (locationInput.value || "").trim();
      
      if (!rawValue) { 
        addAI("Zadejte prosím lokalitu."); 
        locationInput.focus(); 
        return; 
      }
      
      const parsed = U.parseMapyLocation(rawValue, isPozemek);
      
      if (!parsed || !parsed.obec) {
        addAI("Nepodařilo se rozpoznat obec z vašeho zadání. Zkuste to prosím znovu.");
        locationInput.focus();
        return;
      }
      
      console.log('[Widget] Parsed location:', parsed);
      
      if (typ === "Byt") return stepParamsByt(parsed.obec);
      if (typ === "Dům") return stepParamsDum(parsed.obec);
      return stepParamsPozemek(parsed.obec);
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

  function stepParamsByt(obec) {
    const disp  = U.input("dispozice", "Dispozice (např. 2+kk)");
    const stav  = U.select("stav", ["Novostavba","Po rekonstrukci","Dobrý","Špatný"]);
    const vlast = U.select("vlastnictvi", ["Osobní","Družstevní"]);
    const area  = U.input("vymera", "Výměra (m²)", "number");

    const go = U.el("button", { class: "cg-btn", type: "button", onclick: () => {
      const params = { typ:"Byt", obec, dispozice:disp.value, stav:stav.value, vlastnictvi:vlast.value, vymera:parseFloat(area.value||0) };
      renderLeadBoxPricing(params);
    }}, ["Pokračovat k odhadu"]);

    const box = U.el("div", { class: "cg-step" }, [
      U.el("label", {}, ["Parametry bytu – ", obec]),
      disp, stav, vlast, area,
      U.el("div", { class: "cg-cta" }, [go]),
    ]);
    addAI("Nacenění – krok 3/3", box);
  }

  function stepParamsDum(obec) {
    const typS = U.input("typ_stavby", "Typ stavby");
    const stav = U.select("stav", ["Novostavba","Po rekonstrukci","Dobrý","Špatný"]);
    const area = U.input("vymera", "Výměra (m²)", "number");

    const go = U.el("button", { class: "cg-btn", type: "button", onclick: () => {
      const params = { typ:"Dům", obec, typ_stavby:typS.value, stav:stav.value, vymera:parseFloat(area.value||0) };
      renderLeadBoxPricing(params);
    }}, ["Pokračovat k odhadu"]);

    const box = U.el("div", { class: "cg-step" }, [
      U.el("label", {}, ["Parametry domu – ", obec]),
      typS, stav, area,
      U.el("div", { class: "cg-cta" }, [go]),
    ]);
    addAI("Nacenění – krok 3/3", box);
  }

  function stepParamsPozemek(obec) {
    const kat  = U.input("kategorie", "Kategorie pozemku");
    const area = U.input("vymera", "Výměra (m²)", "number");

    const go = U.el("button", { class: "cg-btn", type: "button", onclick: () => {
      const params = { typ:"Pozemek", obec, kategorie:kat.value, vymera:parseFloat(area.value||0) };
      renderLeadBoxPricing(params);
    }}, ["Pokračovat k odhadu"]);

    const box = U.el("div", { class: "cg-step" }, [
      U.el("label", {}, ["Parametry pozemku – ", obec]),
      kat, area,
      U.el("div", { class: "cg-cta" }, [go]),
    ]);
    addAI("Nacenění – krok 3/3", box);
  }

  function renderLeadBoxPricing(params) {
    S.tempPricing = params;
    U.saveSession();
    const consentId = "cgConsent_" + Math.random().toString(36).slice(2);

    const box = U.el("div", { class: "leadbox" }, [
      U.el("div", {}, ["Pro ověření, že nejste robot, prosíme o zadání vašich kontaktů."]),
      U.el("input", { id: "lead_name",  name:"name",  placeholder:"Jméno" }),
      U.el("input", { id: "lead_email", name:"email", type:"email", placeholder:"E-mail" }),
      U.el("input", { id: "lead_phone", name:"phone", placeholder:"Telefon (+420…)" }),
      U.el("label", {}, [
        U.el("input", { id: consentId, type:"checkbox" }),
        " Odesláním souhlasím se zásadami zpracování osobních údajů."
      ]),
      U.el("div", { class: "cg-cta" }, [
        U.el("button", { class: "cg-btn", type: "button", onclick: () => saveLeadPricing(consentId) }, ["Odeslat a zobrazit odhad"])
      ])
    ]);
    addAI("Kontaktní ověření", box);
  }

  async function saveLeadPricing(consentId) {
    const btn = shadow.querySelector(".leadbox .cg-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Odesílám…"; }

    const nameEl  = shadow.querySelector("#lead_name");
    const emailEl = shadow.querySelector("#lead_email");
    const phoneEl = shadow.querySelector("#lead_phone");
    const name  = (nameEl  && nameEl.value)  ? nameEl.value.trim() : "";
    const email = (emailEl && emailEl.value) ? emailEl.value.trim() : "";
    const phone = (phoneEl && phoneEl.value) ? phoneEl.value.trim() : "";
    const consentEl = shadow.querySelector("#" + consentId);
    const consent = !!(consentEl && consentEl.checked);

    if (!name || !U.emailOk(email) || !U.phoneOk(phone) || !consent) {
      addAI("Zkontrolujte prosím kontaktní údaje a potvrďte souhlas.");
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
    let res = null;
    if (P.typ === "Byt")       res = window.CG_Estimator.estimateByt(window.PRICES ? window.PRICES.byty : null, P);
    else if (P.typ === "Dům")  res = window.CG_Estimator.estimateDum(window.PRICES ? window.PRICES.domy : null, P);
    else                       res = window.CG_Estimator.estimatePozemek(window.PRICES ? window.PRICES.pozemky : null, P);

    renderEstimate(res || {low:"-",high:"-",per_m2:"-",note:""}, P.typ || "Nemovitost");
  }

  function renderEstimate(res, typ) {
    const box = U.el("div", { class: "cg-step" }, [
      U.el("label", {}, [`${typ}: předběžný odhad`]),
      U.el("div", {}, [`Rozpětí: ${res.low?.toLocaleString?.("cs-CZ") || res.low || "-"} – ${res.high?.toLocaleString?.("cs-CZ") || res.high || "-" } Kč`]),
      U.el("div", {}, [`Orientační cena za m²: ${res.per_m2 || "-"} Kč/m²`]),
      U.el("div", { class: "hint" }, [res.note || "Odhad je orientační."]),
      U.el("div", { class: "cg-cta" }, [
        U.el("button", { class: "cg-btn", type: "button", onclick: () => addAI("Děkujeme, kolegové se vám ozvou s přesným odhadem.") }, ["Přesný odhad zdarma"]),
      ]),
    ]);
    addAI("Výsledek odhadu", box);
  }

  function stepContactVerify() {
    const consentId = "cgConsent_" + Math.random().toString(36).slice(2);
    const box = U.el("div", { class: "leadbox" }, [
      U.el("div", {}, ["Zanechte na sebe kontakt, ozvu se vám co nejdříve."]),
      U.el("input", { id: "c_name",  name:"name",  placeholder:"Jméno" }),
      U.el("input", { id: "c_email", name:"email", type:"email", placeholder:"E-mail" }),
      U.el("input", { id: "c_phone", name:"phone", placeholder:"Telefon (+420…)" }),
      U.el("label", {}, [ U.el("input", { id: consentId, type:"checkbox" }), " Souhlasím se zpracováním osobních údajů." ]),
      U.el("div", { class: "cg-cta" }, [ U.el("button", { class:"cg-btn", type:"button", onclick: () => saveLeadContact(consentId) }, ["Odeslat"]) ])
    ]);
    addAI("Kontaktní formulář", box);
  }

  async function saveLeadContact(consentId) {
    const btn = shadow.querySelector(".leadbox .cg-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Odesílám…"; }
    const name  = (shadow.querySelector("#c_name")  || {}).value || "";
    const email = (shadow.querySelector("#c_email") || {}).value || "";
    const phone = (shadow.querySelector("#c_phone") || {}).value || "";
    const consentEl = shadow.querySelector("#" + consentId);
    const consent = !!(consentEl && consentEl.checked);

    if (!name.trim() || !U.emailOk(email) || !U.phoneOk(phone) || !consent) {
      addAI("Zkontrolujte prosím kontaktní údaje a potvrďte souhlas.");
      if (btn) { btn.disabled = false; btn.textContent = "Odeslat"; }
      return;
    }

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
      path: "/lead",
      transcript: JSON.stringify(S.chat.messages.slice(-12))
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
        console.log('[Widget] Contact offer active, checking response');
        const yesRe = /^(ano|jo|ok|okej|jasne|prosim|dobre|spustit|otevrit|zobraz(it)?|muzete|urcite)(\b|!|\.)?$/i;
        const noRe  = /^(ne|radeji\s+ne|pozdeji|ted\s+ne|neni)(\b|!|\.)?$/i;
        
        const trimmed = q.trim();
        console.log('[Widget] Checking answer:', trimmed, 'against yes pattern');
        
        if (yesRe.test(trimmed)) {
          console.log('[Widget] YES detected - opening contact form');
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
    } catch(e) {
      console.error('[Widget] Contact offer check error:', e);
    }

    try {
      if (S.intent.upOffer) {
        console.log('[Widget] UP offer active, checking response');
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
        console.log('[Widget] waitingForLocation active, user input:', q);
        addME(q);
        S.intent.waitingForLocation = false;
        
        if (needsUP(q)) {
          console.log('[Widget] User provided full UP query, using as-is');
          handleUPQuery(q);
        } else {
          console.log('[Widget] User provided location only, prepending "územní plán"');
          handleUPQuery("územní plán " + q);
        }
        return;
      }
    } catch(e) {
      console.error('[Widget] waitingForLocation check error:', e);
    }

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
        const typing = U.el("div", { class: "chat-msg ai" }, ["· · ·"]);
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
            addAI("Omlouvám se, teď se mi nedaří získat odpověď od AI. Zkuste to prosím za chvíli."); 
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
        
        txt = (txt && String(txt).trim()) || "Rozumím. Ptejte se na cokoliv k nemovitostem, ISNS apod.";
        addAI(txt);
      } catch (e) { 
        addAI("Omlouvám se, došlo k chybě při komunikaci s AI. Zkuste to prosím znovu."); 
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
      if (S.cfg && S.cfg.data_urls) {
        const d = S.cfg.data_urls;
        const [byty, domy, pozemky, up] = await Promise.all([
          d.byty ? U.fetchJson(d.byty) : null,
          d.domy ? U.fetchJson(d.domy) : null,
          d.pozemky ? U.fetchJson(d.pozemky) : null,
          d.up ? U.fetchJson(d.up) : null
        ]);
        window.PRICES = { byty, domy, pozemky, up };
        S.data.up = up;
        console.log('[Widget] UP data loaded:', up ? `${up.map?.length || 0} entries` : 'FAILED');
      }
    } catch (e) {
      console.error('[Widget] Config/data loading error:', e);
      addAI("Chyba načítání konfigurace/dat: " + String(e));
    }
  })();

  // ==== Init ====
  function cgSafeStart() {
    try {
      if (!chatMessages) return setTimeout(cgSafeStart, 40);
      console.log('[Widget] Rendering start screen...');
      
      if (U.loadSession() && S.chat.messages.length > 0) {
        console.log('[Widget] Session restored, showing previous messages');
        S.chat.messages.forEach(msg => {
          if (msg.role === 'user') {
            const b = U.el("div", { class: "chat-msg me" }, [msg.content]);
            chatMessages.appendChild(b);
          } else {
            const b = U.el("div", { class: "chat-msg ai" }, [msg.content]);
            chatMessages.appendChild(b);
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

  console.log('[Widget] Initialization complete (v6.21-GEOCODING-FINAL)');

})();
