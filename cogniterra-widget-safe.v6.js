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
// Build v6.bubble.8-fix — Fixed syntax error

(function () {
  "use strict";

  console.log('[Widget] Initialization started...');

  // ==== mount only if host exists ====
  const host = document.querySelector("[data-cogniterra-widget]");
  if (!host) {
    console.warn('[Widget] Host element not found');
    return;
  }

  // ==== Clean and recreate shadow DOM every time ====
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

  // ==== state/config ====
  const S = {
    session: Math.random().toString(36).slice(2),
    flow: null,
    cfg: null,
    data: {},
    tempPricing: null,
    chat: { messages: [] },
    intent: {}
  };

  console.log('[Widget] Session:', S.session);

  // ==== utils ====
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
    
    // ==== Prioritize KU (katastrální území) over obec ====
    searchUP(query, upData) {
      if (!upData || !upData.map) return [];
      const q = U.norm(query);
      
      console.log('[Widget] Searching UP for:', query, '-> normalized:', q);
      
      const kuExact = [];
      const kuPartial = [];
      const obecExact = [];
      const obecPartial = [];
      
      for (const item of upData.map) {
        const kuNorm = U.norm(item.ku || "");
        const obecNorm = U.norm(item.obec || "");
        
        // PRIORITY 1: Exact KU match
        if (kuNorm === q) {
          kuExact.push(item);
        }
        // PRIORITY 2: Partial KU match
        else if (kuNorm.includes(q) || q.includes(kuNorm)) {
          kuPartial.push(item);
        }
        // PRIORITY 3: Exact obec match
        else if (obecNorm === q) {
          obecExact.push(item);
        }
        // PRIORITY 4: Partial obec match
        else if (obecNorm.includes(q) || q.includes(obecNorm)) {
          obecPartial.push(item);
        }
      }
      
      console.log('[Widget] Found - KU exact:', kuExact.length, 'KU partial:', kuPartial.length, 
                  'Obec exact:', obecExact.length, 'Obec partial:', obecPartial.length);
      
      // Return in priority order, KU first!
      if (kuExact.length > 0) return kuExact;
      if (kuPartial.length > 0) return kuPartial.slice(0, 10);
      if (obecExact.length > 0) return obecExact;
      return obecPartial.slice(0, 10);
    },
    
    // ==== Simple location extraction ====
    extractLocation(text) {
      const normalized = U.norm(text);
      
      // Remove obvious non-location words
      const stopWords = ['hledam', 'potrebuji', 'uzemni', 'plan', 'pro', 'v', 've', 'na', 'u', 
                        'chci', 'vedet', 'o', 'pozemku', 'stavbe', 'kde', 'najdu', 'mam', 
                        'ma', 'stavet', 'koupit', 'prodat', 'jaky', 'jake', 'co', 'dela',
                        'jak', 'se', 'mas', 'kdo', 'jsi', 'jsem', 'ano', 'ne', 'jo', 'ok'];
      
      const words = normalized.split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.includes(w));
      
      console.log('[Widget] Extracted location candidates:', words);
      
      return words.length > 0 ? words : [];
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
    }
  };

  // === Kompletně nový styl s důrazem na izolaci ===
  const style = document.createElement("style");
  style.textContent = `
  /* Základní reset a izolace */
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
  
  /* Widget kontejner */
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
  
  /* Header */
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
  
  /* Oblast zpráv */
  .chat-messages {
    flex: 1;
    padding: 16px;
    overflow-y: auto;
    background: #f8fafc;
    display: flex;
    flex-direction: column;
  }
  
  /* Zprávy */
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
  
  /* Panel pro další obsah */
  .chat-panel {
    background: transparent;
    padding: 0;
    margin: 12px 0;
    width: 100%;
  }
  
  /* Oblast vstupu */
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
  
  /* Karty úvodní obrazovky */
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
  
  /* Formulář */
  .cg-step {
    background: #fff;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 2px 5px rgba(0,0,0,.05);
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
  
  /* UP results styling */
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
  
  /* Mobilní styly */
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

  // Vytvořit strukturu widgetu
  const chatContainer = U.el("div", { class: "chat-container" });
  
  // Záhlaví
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
  
  // Oblast zpráv
  const chatMessages = U.el("div", { class: "chat-messages" });
  chatContainer.appendChild(chatMessages);
  
  // Oblast vstupu
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

  // ==== message helpers ====
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
      const offer1 = /(mohu|můžu|rád|ráda)\s+(vám\s+)?(ote[vw]ř[ií]t|zobrazit|spustit)\s+(kontaktn[íi]\s+formul[aá][řr])/i.test(tt);
      const offer2 = /chcete\s+(ote[vw]ř[ií]t|zobrazit|spustit)\s+(formul[aá][řr])/i.test(tt);
      if (offer1 || offer2) { 
        console.log('[Widget] AI offered contact form');
        S.intent.contactOffer = true; 
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

  // ==== Proactive UP offer ====
  function offerUPSearch() {
    const box = U.el("div", { class: "up-offer" }, [
      "💡 Tip: Pokud potřebujete územní plán pro konkrétní lokalitu, stačí mi napsat název obce nebo katastrálního území a já vám najdu odkaz."
    ]);
    addPanel(box);
  }

  // ==== Mapy.cz Suggest ====
  let MAPY_PROMISE = null;
  function loadMapy(apiKey) {
    if (MAPY_PROMISE) return MAPY_PROMISE;
    MAPY_PROMISE = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "https://api.mapy.cz/loader.js";
      s.onload = function () {
        if (window.Loader) {
          window.Loader.async = true;
          window.Loader.load(null, {
            api: "suggest",
            key: apiKey,
            onload: function () { resolve(true); }
          });
        } else resolve(false);
      };
      document.head.appendChild(s);
    });
    return MAPY_PROMISE;
  }
  
  function attachSuggest(inputEl) {
    if (!inputEl) return;
    const key = (S.cfg && S.cfg.mapy_key) || "EreCyrH41se5wkNErc5JEWX2eMLqnpja5BUVxsvpqzM";
    loadMapy(key).then((ok) => {
      if (!ok) {
        inputEl.setAttribute("placeholder", (inputEl.placeholder || "") + " (našeptávač nedostupný)");
        return;
      }
      try { if (window.SMap && SMap.Suggest) new SMap.Suggest(inputEl); } catch (_) {}
    });
  }

  // ==== Estimator stubs ====
  window.CG_Estimator = window.CG_Estimator || {
    estimateByt(m, p)   { return {low: 0, mid: 0, high: 0, per_m2: 0, note:"MVP"}; },
    estimateDum(m, p)   { return {low: 0, mid: 0, high: 0, per_m2: 0, note:"MVP"}; },
    estimatePozemek(m,p){ return {low: 0, mid: 0, high: 0, per_m2: 0, note:"MVP"}; }
  };

  // ==== Better UP vs AI detection with context awareness ====
  function needsUP(q) {
    const s = U.norm(q);
    console.log('[Widget] Checking UP need for:', q, '-> normalized:', s);
    
    // If contact form was just offered, don't treat "ano" as UP query
    if (S.intent.contactOffer) {
      console.log('[Widget] Contact form offered, skipping UP detection');
      return false;
    }
    
    // Don't treat conversational questions as UP queries
    const isConversational = /^(jak|co|kdo|proc|kdy|kde|jaky|jaka|jake)\s+(se|jsi|jste|mas|mate|dela|delate|je|jsou)/i.test(s);
    if (isConversational) {
      console.log('[Widget] Detected conversational question, not UP');
      return false;
    }
    
    // Don't treat common affirmative/negative words as locations
    const isAffirmation = /^(ano|ne|jo|ok|okej|dobre|jasne|souhlasim|nesouhlasim)$/i.test(s);
    if (isAffirmation) {
      console.log('[Widget] Detected affirmation/negation, not UP');
      return false;
    }
    
    // Has explicit UP keywords
    const hasUPKeyword = /(uzemni|plan|katastr|pozemek|stavba|zastavitelnost|regulacni|vyuziti|uzemi|parcela)/i.test(s);
    
    if (hasUPKeyword) {
      console.log('[Widget] Has UP keyword');
      return true;
    }
    
    // Only treat as location if it's very short AND not a question AND not affirmation
    const words = s.split(/\s+/).filter(w => w.length > 2);
    const isSimpleLocation = words.length <= 2 && words.length > 0 && !s.includes('?');
    
    console.log('[Widget] isSimpleLocation:', isSimpleLocation, 'words:', words);
    return isSimpleLocation;
  }
  
  function handleUPQuery(q) {
    console.log('[Widget] Handling UP query:', q);
    
    const locations = U.extractLocation(q);
    
    console.log('[Widget] Extracted locations:', locations);
    
    if (locations.length === 0) {
      addAI("Pro vyhledání územního plánu potřebuji znát obec nebo katastrální území. Můžete mi prosím uvést konkrétní lokalitu?");
      return;
    }
    
    const upData = S.data.up || window.PRICES?.up;
    if (!upData || !upData.map) {
      addAI("Omlouvám se, databáze územních plánů není aktuálně dostupná. Zkuste to prosím později nebo mě kontaktujte pro další pomoc.");
      stepContactVerify();
      return;
    }
    
    // Try all extracted words, prefer longer ones first
    let allResults = [];
    const sortedLocations = locations.sort((a, b) => b.length - a.length);
    
    for (const loc of sortedLocations) {
      const results = U.searchUP(loc, upData);
      if (results.length > 0) {
        allResults = results;
        break;
      }
    }
    
    console.log('[Widget] Search results:', allResults.length);
    
    if (allResults.length === 0) {
      const box = U.el("div", { class: "up-no-result" }, [
        `Pro "${locations[0]}" jsem bohužel nenašel územní plán v databázi. Zkuste prosím upřesnit název obce nebo katastrálního území, případně vás mohu spojit s odborníkem.`
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
          U.el("a", { href: item.url, target: "_blank", rel: "noopener noreferrer" }, [item.url])
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
            U.el("a", { href: item.url, target: "_blank", rel: "noopener noreferrer" }, ["Otevřít územní plán →"])
          ])
        ]);
        addPanel(box);
      });
      
      if (allResults.length > 5) {
        addAI(`... a dalších ${allResults.length - 5} výsledků. Pro přesnější vyhledávání upřesněte prosím katastrální území.`);
      }
    }
    
    // Always offer expert contact
    const ctaBox = U.el("div", { class: "cg-step" }, [
      U.el("p", {}, ["Potřebujete další pomoc s územním plánováním?"]),
      U.el("div", { class: "cg-cta" }, [
        U.el("button", { class: "cg-btn", type: "button", onclick: () => stepContactVerify() }, ["Kontaktovat odborníka"])
      ])
    ]);
    addPanel(ctaBox);
  }

  // ==== START SCREEN ====
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
          U.el("p", {}, ["Zeptejte se na postup, dokumenty, pravidla nebo územní plány."])
        ])
      ])
    ]);

    addPanel(cards);
  }

  function startHelp() { 
    chatInputArea.style.display='flex'; 
    try{chatTextarea.focus();}catch(e){}
    addAI("Rozumím. Ptejte se na cokoliv k nemovitostem, ISNS, územnímu plánu apod.");
    
    setTimeout(() => {
      offerUPSearch();
    }, 800);
  }

  function startPricing() {
    S.flow = "pricing";
    stepChooseType();
  }

  // ==== Pricing flow ====
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
    const street = (typ === "Pozemek") ? null : U.input("ulice", "Ulice (volitelné)");
    const town = U.input("obec", "Obec");
    const hint = U.el("div", { class: "hint" }, ["Začněte psát – nabídneme shody (Mapy.cz Suggest)."]);
    const nxt = U.el("button", { class: "cg-btn", type: "button", onclick: () => {
      const obec = (town.value || "").trim();
      if (!obec) { addAI("Zadejte prosím obec."); town.focus(); return; }
      if (typ === "Byt") return stepParamsByt(obec);
      if (typ === "Dům") return stepParamsDum(obec);
      return stepParamsPozemek(obec);
    }}, ["Pokračovat"]);
    const inner = [U.el("label", {}, [`Lokalita – ${typ}`])];
    if (street) inner.push(street);
    inner.push(town, hint, U.el("div", { class: "cg-cta" }, [nxt]));
    const box = U.el("div", { class: "cg-step" }, inner);

    addAI("Nacenění – krok 2/3", box);
    if (street) attachSuggest(street);
    attachSuggest(town);
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

  // ==== Kontakt → ulož → potom odhad ====
  function renderLeadBoxPricing(params) {
    S.tempPricing = params;
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

  // ==== Contact lead (from chat intent) ====
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

  // ==== Intent routing ====
  function needPricing(q) {
    const s = U.norm(q);
    return /(nacenit|nacenen|ocenit|odhad(\s*ceny)?|cena\s+nemovitosti|spocitat\s*cenu|kolik\s+to\s*stoji)/i.test(s);
  }
  
  function ask(q) {
    // Check contact offer intent FIRST before anything else
    try {
      if (S.intent.contactOffer) {
        console.log('[Widget] Contact offer active, checking response');
        const yesRe = /^(ano|jo|ok|okej|jasne|prosim|dobre|spustit|otevrit|zobraz(it)?|muzete|urcite)(\b|!|\.)/i;
        const noRe  = /^(ne|radeji\s+ne|pozdeji|ted\s+ne|neni)(\b|!|\.)/i;
        if (yesRe.test(q.trim())) {
          addME(q);
          stepContactVerify();
          S.intent.contactOffer = false;
          return;
        } else if (noRe.test(q.trim())) {
          S.intent.contactOffer = false;
          addME(q);
          addAI("Dobře, pokud budete potřebovat později, dejte mi vědět!");
          return;
        }
        // If it's neither yes nor no, clear the flag and continue normally
        S.intent.contactOffer = false;
      }
    } catch(_) {}

    if (!q) return;
    addME(q);
    
    // Check pricing first, then UP, then AI
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
      addAI("Rozumím. Ptejte se na cokoliv k nemovitostem, ISNS, územnímu plánu apod."); 
      return; 
    }

    const wantContact = /(^|\b)(chci ?byt ?kontaktovan|kontaktuj(te)? me|zavolejte|napiste|nechte kontakt|ozve se|muzete me kontaktovat)/i.test(U.norm(q));
    if (wantContact) { stepContactVerify(); return; }
    
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
        
        txt = (txt && String(txt).trim()) || "Rozumím. Ptejte se na cokoliv k nemovitostem, ISNS, územnímu plánu apod.";
        addAI(txt);
        
        // After AI response, check if we should offer UP
        if (U.mentionsProperty(q) && !needsUP(q) && !S.intent.upOffered) {
          setTimeout(() => {
            offerUPSearch();
            S.intent.upOffered = true;
          }, 1200);
        }
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
      renderStart();
    } catch (e) {
      console.error('[Widget] Start error:', e);
      setTimeout(cgSafeStart, 40);
    }
  }

  cgSafeStart();

  // input handlers
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

  console.log('[Widget] Initialization complete');

})();
