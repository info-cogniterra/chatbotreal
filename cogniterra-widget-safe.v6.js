// === Unified viewport height handler ===
(function setVH(){
  function updateVH(){
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--vh', vh + 'px');
  }
  updateVH();
  window.addEventListener('resize', updateVH, {passive:true});
})();

// cogniterra-widget-safe.v6.js — BUBBLE-ONLY, SINGLE INSTANCE
// Build v6.bubble.1  — intro + 2 cards; pricing via contact; Mapy.cz suggest; no auto-create

(function () {
  "use strict";

  // ==== single-instance guard ====
  if (window.__CG_WIDGET_INIT__) {
    // Pokud již existuje, vyčistíme starou instanci
    try {
      const existingHost = document.querySelector("[data-cogniterra-widget]");
      if (existingHost && existingHost.shadowRoot) {
        while (existingHost.shadowRoot.firstChild) {
          existingHost.shadowRoot.removeChild(existingHost.shadowRoot.firstChild);
        }
      }
    } catch (e) {
      console.error("Chyba při čištění staré instance widgetu:", e);
    }
  }
  window.__CG_WIDGET_INIT__ = true;
  
  // Definujeme funkci pro reset widgetu
  window.__CG_WIDGET_RESET_FN__ = function() {
    try {
      // Resetujeme stav widgetu
      const existingHost = document.querySelector("[data-cogniterra-widget]");
      if (existingHost) {
        // Znovu inicializujeme chat
        if (existingHost.shadowRoot) {
          while (existingHost.shadowRoot.firstChild) {
            existingHost.shadowRoot.removeChild(existingHost.shadowRoot.firstChild);
          }
        }
        // Znovu vykreslíme úvodní obrazovku
        setTimeout(() => {
          try {
            cgSafeStart();
          } catch(e) {
            console.error("Chyba při resetu widgetu:", e);
          }
        }, 50);
      }
    } catch(e) {
      console.error("Chyba při resetu chatbota:", e);
    }
  };

  // ==== mount only if host exists (bubble creates it); do NOTHING otherwise ====
  const host = document.querySelector("[data-cogniterra-widget]");
  if (!host) return; // bubble not opened yet / or embed missing

  // ==== state/config ====
  const S = {
    session: Math.random().toString(36).slice(2),
    flow: null,
    cfg: null,
    data: {},
    tempPricing: null,
    pendingLocationQuery: null, // Pro uchování informace o poslední lokalitě v dotazu
    lastMatchedLocation: null, // Pro uchování informace o poslední nalezené lokalitě
  };

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
    norm(v) { return (v || "").normalize("NFKD").toLowerCase(); },
    fetchJson(url) { return fetch(url, { credentials: "omit" }).then(r => r.json()); },
    // Vylepšená normalizace pro české lokality včetně pádových tvarů
    normalizeLocation(location) {
      if (!location) return "";
      
      // Základní normalizace
      let normalized = location
        .normalize("NFKD")
        .toLowerCase()
        .trim();
      
      // Oříznutí českých pádových koncovek
      const padoveConcovky = ['ích', 'ich', 'ách', 'ach', 'ům', 'um', 'ím', 'im', 'ě', 'e'];
      for (const koncovka of padoveConcovky) {
        if (normalized.endsWith(koncovka) && normalized.length > koncovka.length + 3) {
          normalized = normalized.slice(0, -koncovka.length);
          break;
        }
      }
      
      return normalized;
    },
    // Jednoduchá podobnost dvou řetězců (procento shodných znaků)
    similarity(a, b) {
      const longer = a.length > b.length ? a : b;
      const shorter = a.length > b.length ? b : a;
      if (longer.length === 0) return 1.0;
      
      // Počet znaků, které jsou stejné a ve stejné pozici
      let matches = 0;
      for (let i = 0; i < shorter.length; i++) {
        if (shorter[i] === longer[i]) matches++;
      }
      
      return matches / longer.length;
    },
    // Test zda text obsahuje otázku na územní plán
    containsLandPlanQuestion(text) {
      return /(pozemek|pozemky|parcela|parcely|územní plán|uzemni plan|regulace výstavby|regulace zástavby)/i.test(text);
    },
    // Test zda text obsahuje žádost o zaslání odkazu na územní plán
    containsLandPlanLinkRequest(text) {
      return /(poslat|ukázat|zobrazit|zaslat|najít)\s+(odkaz|link|stránk|url).*\s+(územní|uzemni)\s+(plán|plan)/i.test(text);
    },
    // Test zda text obsahuje potvrzení na předchozí otázku
    isAffirmativeResponse(text) {
      return /^(ano|jo|jistě|určitě|jasně|ano chci|dobře|samozřejmě|můžete|ok|okay|jj|přesně tak|prosím|pošli)(\s|$|\.)/i.test(text.trim());
    }
  };

  // Odstraníme všechny existující elementy s třídou .cg-close v document
  try {
    const oldCloseButtons = document.querySelectorAll('.cg-close');
    oldCloseButtons.forEach(btn => btn.remove());
  } catch(e) {}

  // ==== shadow root & UI skeleton ====
  // Odstraníme všechny potomky z host elementu
  while (host.firstChild) {
    host.removeChild(host.firstChild);
  }
  
  // Odstraníme jakýkoliv existující shadowRoot
  if (host.shadowRoot) {
    try {
      // Pokusíme se odstranit shadowRoot
      host.attachShadow({ mode: "open" });
    } catch(e) {
      // Pokud nelze přímo odstranit, alespoň vyčistíme obsah
      while (host.shadowRoot.firstChild) {
        host.shadowRoot.removeChild(host.shadowRoot.firstChild);
      }
    }
  }

  // Vytvoříme nový shadowRoot
  const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });

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
  
  /* Widget kontejner - bez černého pozadí */
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
    font-size: 16px;
    opacity: 0.8;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
  }
  
  .chat-close-btn:hover {
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

  /* Odkazy v AI zprávách */
  .chat-msg.ai a {
    color: #2c5282;
    text-decoration: underline;
    font-weight: 500;
  }

  .chat-msg.ai a:hover {
    color: #1a365d;
    text-decoration: underline;
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
  }
  
  .chat-input-area button:hover {
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
  }
  
  .cg-card:hover {
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
  }
  
  .cg-btn:hover {
    background: #1a365d;
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
  
  /* Mobilní styly */
  @media (max-width: 480px) {
    .chat-container {
      width: 100%;
      height: 100%;
      max-width: 100%;
      border-radius: 0;
    }
    
    .chat-input-area textarea {
      font-size: 16px;
    }
  }
  `;
  shadow.appendChild(style);

  // Vytvořit zcela novou strukturu widgetu s novými názvy tříd
  const chatContainer = U.el("div", { class: "chat-container" });
  
  // Záhlaví
  const chatHeader = U.el("div", { class: "chat-header" });
  const chatTitle = U.el("div", { class: "chat-header-title" }, ["Asistent Cogniterra"]);
  
  // Upravená funkce pro zavírání chatu
  function closeChat() {
    if (window.CGTR && typeof window.CGTR.hideChat === 'function') {
      window.CGTR.hideChat();
    } else {
      if (window.parent) {
        try {
          // Najít nadřazené tlačítko zavřít, ale v rodičovském okně
          const parentClose = window.parent.document.querySelector('.cg-close');
          if (parentClose) {
            parentClose.click();
          } else {
            // Pokud nenajdeme rodičovské tlačítko, alespoň skryjeme tento element
            host.style.display = 'none';
          }
        } catch(e) {
          // Fallback pro případ, kdy nemáme přístup k rodičovskému oknu
          host.style.display = 'none';
        }
      } else {
        // Pokud není v iframe, alespoň skryjeme tento element
        host.style.display = 'none';
      }
    }
  }
  
  const chatCloseBtn = U.el("button", { 
    class: "chat-close-btn",
    type: "button",
    "aria-label": "Zavřít chat",
    onclick: closeChat
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
  
  chatInputArea.appendChild(chatTextarea);
  chatInputArea.appendChild(chatSendBtn);
  chatContainer.appendChild(chatInputArea);
  
  // Přidáme celou strukturu do shadow DOM
  shadow.appendChild(chatContainer);
  
  // Inicializace stavu
  S.chat = S.chat || {messages:[]};
  S.intent = S.intent || {};

  // ==== message helpers ====
  function addAI(t, extra) {
    // render assistant bubble
    const b = U.el("div", { class: "chat-msg ai" });
    b.innerHTML = t; // Použijeme innerHTML místo textContent, aby se vyrenderovaly odkazy
    if (extra) b.appendChild(extra);
    chatMessages.appendChild(b);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // record to conversation
    try { 
      S.chat = S.chat || { messages: [] }; 
      S.intent = S.intent || {}; 
      S.chat.messages.push({ role: "assistant", content: String(t) }); 
    } catch (e) {}

    // detect assistant's offer to open the contact form (arms a one-turn confirmation)
    try {
      const tt = String(t).toLowerCase();
      const offer1 = /(mohu|můžu|rád|ráda)\s+(vám\s+)?(ote[vw]ř[ií]t|zobrazit|spustit)\s+(kontaktn[íi]\s+formul[aá][řr])/i.test(tt);
      const offer2 = /chcete\s+(ote[vw]ř[ií]t|zobrazit|spustit)\s+(formul[aá][řr])/i.test(tt);
      if (offer1 || offer2) { S.intent = S.intent || {}; S.intent.contactOffer = true; }
    } catch (e) {}

    // Detekce nabídky zaslání odkazu na územní plán
    try {
      const tt = String(t).toLowerCase();
      const offerUP = /(poslat|ukázat|zaslat|odkázat|přiložit)\s+(vám\s+)?(odkaz|link|stránku|url)\s+na\s+(územní|uzemni)\s+(plán|plan)/i.test(tt);
      if (offerUP && S.lastMatchedLocation) { 
        S.intent = S.intent || {}; 
        S.intent.upOffer = true;
      }
    } catch (e) {}
  }

  function addME(t) {
    try { 
      S.chat = S.chat || {messages:[]}; 
      S.intent = S.intent || {}; 
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

  // ==== Estimator stubs (nahraď svými výpočty) ====
  window.CG_Estimator = window.CG_Estimator || {
    estimateByt(m, p)   { return {low: 0, mid: 0, high: 0, per_m2: 0, note:"MVP"}; },
    estimateDum(m, p)   { return {low: 0, mid: 0, high: 0, per_m2: 0, note:"MVP"}; },
    estimatePozemek(m,p){ return {low: 0, mid: 0, high: 0, per_m2: 0, note:"MVP"}; }
  };

  // ==== Funkce pro extrakci lokalit z textu ====
  function extractLocations(userQuery) {
    const locations = [];
    
    // Heuristika 1: Extrakce po předložkách (rozšířený seznam)
    const locationMatches = userQuery.match(/\b(v|ve|na|pro|o|k|u|kolem|poblíž|nedaleko|město|obec|města|obce|lokalita|lokalitě)\s+([A-Za-zÀ-ž]+(?:\s+[A-Za-zÀ-ž]+){0,2})/gi);
    if (locationMatches) {
      for (const match of locationMatches) {
        const location = match.replace(/\b(v|ve|na|pro|o|k|u|kolem|poblíž|nedaleko|město|obec|města|obce|lokalita|lokalitě)\s+/i, '').trim();
        if (location.length >= 2) {
          locations.push(location);
        }
      }
    }
    
    // Heuristika 2: Všechna slova s velkým písmenem
    const words = userQuery.split(/\s+/);
    for (const word of words) {
      const trimmed = word.replace(/[,.;:?!]/g, '').trim();
      if (trimmed.length >= 2 && /^[A-ZČŠŽŇÁÉÍÓÚŮÝŘŤĎĚ]/.test(trimmed)) {
        locations.push(trimmed);
      }
    }

    // Heuristika 3: Extrakce specifických vzorů
    const cityPattern = userQuery.match(/\b(lokalita|lokalitě|město|obec|město|obce)\s+([A-Za-zÀ-ž]+(?:\s+[A-Za-zÀ-ž]+){0,2})/i);
    if (cityPattern && cityPattern[2]) {
      locations.push(cityPattern[2].trim());
    }
    
    // Heuristika 4: Jednoduchý název lokality na konci
    const endingLocation = userQuery.match(/\s+([A-ZČŠŽŇÁÉÍÓÚŮÝŘŤĎĚ][A-Za-zÀ-ž]+)$/);
    if (endingLocation && endingLocation[1]) {
      locations.push(endingLocation[1]);
    }
    
    // Heuristika 5: Jednoslovný dotaz s velkým počátečním písmenem
    if (words.length === 1 && /^[A-ZČŠŽŇÁÉÍÓÚŮÝŘŤĎĚ]/.test(words[0])) {
      locations.push(words[0].replace(/[,.;:?!]/g, '').trim());
    }
    
    // Odstranění duplicit a prioritizace
    return [...new Set(locations)];
  }

  // ==== Funkce pro nalezení územního plánu podle lokality ====
  function findUzemniPlan(location) {
    // Kontrola, že máme data
    if (!S.data || !S.data.up || !S.data.up.map) {
      console.log("Chybí data územních plánů:", S.data);
      return null;
    }
    
    const normalizedLocation = U.normalizeLocation(location);
    console.log("Hledám lokalitu:", normalizedLocation, "z původní:", location);
    
    // Přesná shoda (obec nebo katastrální území)
    const exactMatch = S.data.up.map.find(entry => 
      U.normalizeLocation(entry.obec) === normalizedLocation || 
      U.normalizeLocation(entry.ku) === normalizedLocation
    );
    
    if (exactMatch) {
      console.log("Nalezena přesná shoda:", exactMatch);
      return exactMatch;
    }
    
    // Částečná shoda - obsahuje jako podřetězec
    const partialMatch = S.data.up.map.find(entry => 
      U.normalizeLocation(entry.obec).includes(normalizedLocation) || 
      U.normalizeLocation(entry.ku).includes(normalizedLocation) ||
      normalizedLocation.includes(U.normalizeLocation(entry.obec))
    );
    
    if (partialMatch) {
      console.log("Nalezena částečná shoda:", partialMatch);
      return partialMatch;
    }
    
    // Fuzzy matching - implementace podobnosti řetězců
    const fuzzyThreshold = 0.7; // 70% podobnost
    let bestMatch = null;
    let bestScore = 0;
    
    for (const entry of S.data.up.map) {
      const normObec = U.normalizeLocation(entry.obec);
      const normKu = U.normalizeLocation(entry.ku);
      
      const scoreObec = U.similarity(normObec, normalizedLocation);
      const scoreKu = U.similarity(normKu, normalizedLocation);
      const score = Math.max(scoreObec, scoreKu);
      
      if (score > fuzzyThreshold && score > bestScore) {
        bestScore = score;
        bestMatch = entry;
      }
    }
    
    if (bestMatch) {
      console.log(`Nalezena fuzzy shoda (skóre ${bestScore.toFixed(2)}):`, bestMatch);
      return bestMatch;
    }
    
    console.log("Žádná shoda nenalezena pro:", normalizedLocation);
    return null;
  }

  // ==== Zpracování odpovědi s přidáním odkazu na územní plán ====
  function processResponse(userQuery, aiResponse) {
    let processedResponse = aiResponse;
    
    // Detekce dotazu o pozemcích nebo územním plánu
    const isLandQuery = U.containsLandPlanQuestion(userQuery);
    
    // Uložení informace, zda v poslední odpovědi máme dotaz na územní plán
    S.intent.lastLandQuery = isLandQuery;
    
    if (isLandQuery || U.containsLandPlanLinkRequest(userQuery)) {
      console.log("Detekován dotaz o územním plánu nebo žádost o odkaz:", userQuery);
      
      // Extrakce potenciálních lokalit z dotazu
      const locations = extractLocations(userQuery);
      console.log("Nalezené potenciální lokality:", locations);
      
      if (locations.length > 0) {
        S.pendingLocationQuery = locations[0];
        
        for (const location of locations) {
          // Hledáme územní plán pro tuto lokalitu
          const planInfo = findUzemniPlan(location);
          
          if (planInfo && planInfo.url) {
            // Uložíme informaci o nalezené lokalitě pro pozdější použití
            S.lastMatchedLocation = planInfo;
            
            // Přidání odkazu na územní plán do odpovědi
            const appendText = `\n\nPro lokalitu ${planInfo.obec}${planInfo.ku !== planInfo.obec ? ` (${planInfo.ku})` : ''} můžete najít územní plán zde: <a href="${planInfo.url}" target="_blank">Územní plán ${planInfo.obec}</a>`;
            processedResponse += appendText;
            console.log("Přidán odkaz na územní plán:", planInfo);
            break; // Stačí jeden odkaz
          }
        }
      }
    }
    
    return processedResponse;
  }

  // ==== START SCREEN ====
  function renderStart() { try{chatTextarea.focus();}catch(e){}
    addAI("Dobrý den, rád vám pomohu s vaší nemovitostí. Vyberte, co potřebujete.");

    const cards = U.el("div", { class: "cg-start" }, [
      U.el("div", { class: "cg-cards" }, [
        U.el("button", { class: "cg-card", type: "button", onclick: () => startPricing(), "aria-label":"Nacenit nemovitost" }, [
          U.el("h3", {}, ["Nacenit nemovitost"]),
          U.el("p", {}, ["Rychlý odhad a krátký dotazník (1–2 min)."])
        ]),
        U.el("button", { class: "cg-card", type: "button", onclick: () => startHelp(), "aria-label":"Potřebuji pomoct" }, [
          U.el("h3", {}, ["Potřebuji pomoct"]),
          U.el("p", {}, ["Zeptejte se na postup, dokumenty nebo pravidla. Odpovím hned."])
        ])
      ])
    ]);

    addPanel(cards);
  }

  function startHelp() { chatInputArea.style.display='flex'; try{chatTextarea.focus();}catch(e){}
    chatInputArea.style.display = "flex";
    addAI("Rozumím. Ptejte se na cokoliv k nemovitostem, ISNS, územnímu plánu apod.");
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

  // ==== Funkce pro přidání odkazu na územní plán ====
  function addLandPlanLink(location) {
    if (!location) return false;
    
    const planInfo = findUzemniPlan(location);
    if (!planInfo || !planInfo.url) return false;
    
    const linkText = `Pro lokalitu ${planInfo.obec}${planInfo.ku !== planInfo.obec ? ` (${planInfo.ku})` : ''} můžete najít územní plán zde: <a href="${planInfo.url}" target="_blank">Územní plán ${planInfo.obec}</a>`;
    addAI(linkText);
    
    return true;
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

    // send
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
          // fallback fire-and-forget
          fetch(S.cfg.lead_url, { method:"POST", mode:"no-cors", headers:{ "Content-Type":"application/x-www-form-urlencoded"}, body }).catch(()=>{});
        }
      }
    } catch (e) {
      addAI("Nepodařilo se uložit kontakt. Zkuste to prosím znovu.");
      if (btn) { btn.disabled = false; btn.textContent = "Odeslat a zobrazit odhad"; }
      return;
    }

    if (btn) { btn.disabled = false; btn.textContent = "Odesláno"; }

    // compute after lead saved
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
      transcript: JSON.stringify((S.chat && S.chat.messages) ? S.chat.messages.slice(-12) : [])
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
    return /(nacenit|naceněn|ocenit|odhad(\s*ceny)?|cena\s+nemovitosti|spočítat\s*cenu|kolik\s+to\s*stojí)/i.test(s);
  }
  
  function ask(q) {
    // Intercept confirmation if assistant just offered to open contact form
    try {
      if (S.intent && S.intent.contactOffer) {
        const yesRe = /^(ano|jo|ok|okej|jasn[eě]|pros[íi]m|dob[rř]e|spus[tť]it|ote[vw][řr][ií]t|zobraz(it)?|m[oů]žete|ur[cč]it[ěe])(\b|!|\.)/i;
        const noRe  = /^(ne|rad[ěe]ji\s+ne|pozd[eě]ji|te[dď]\s+ne|nen[ií])(\b|!|\.)/i;
        if (yesRe.test(q.trim())) {
          // consume message locally, open contact form, clear flag
          addME(q);
          stepContactVerify();
          S.intent.contactOffer = false;
          return;
        } else if (noRe.test(q.trim())) {
          // user declined; clear flag and continue to backend
          S.intent.contactOffer = false;
        }
      }
    } catch(_) {}
    
    // Zachytit odpověď, pokud asistent nabízel zaslání odkazu na územní plán
    try {
      if (S.intent && S.intent.upOffer && S.lastMatchedLocation) {
        if (U.isAffirmativeResponse(q)) {
          // Uživatel potvrdil, že chce poslat odkaz na územní plán
          addME(q);
          addLandPlanLink(S.lastMatchedLocation.obec);
          // Resetujeme příznak
          S.intent.upOffer = false;
          return;
        } else {
          // Uživatel odmítl odkaz, pokračujeme normálně
          S.intent.upOffer = false;
        }
      }
    } catch(_) {}
    
    // Zachytit přímou žádost o zaslání odkazu na územní plán
    try {
      if (S.pendingLocationQuery && U.containsLandPlanLinkRequest(q)) {
        addME(q);
        const success = addLandPlanLink(S.pendingLocationQuery);
        if (!success) {
          addAI("Omlouvám se, ale nemohu poskytnout přímé odkazy. Doporučuji navštívit oficiální webové stránky města " + S.pendingLocationQuery + ", kde byste měli najít sekci věnovanou územnímu plánování. Tam by měly být k dispozici aktuální dokumenty a informace o územním plánu.");
        }
        return;
      }
    } catch(_) {}

    if (!q) return;
    addME(q);
    if (needPricing(q)) { startPricing(); return; }
    S.chat = S.chat || { messages: [] };
    const url = (S && S.cfg && (S.cfg.proxy_url || S.cfg.chat_url)) || null;
    if (!url) { addAI("Rozumím. Ptejte se na cokoliv k nemovitostem, ISNS, územnímu plánu apod."); return; }

    // Contact intent (CZ variants) -> open lead form immediately
    const wantContact = /(^|\b)(chci ?být ?kontaktov[aá]n|kontaktuj(te)? m[ěe]|zavolejte|napi[sš]te|nechte kontakt|ozv[eu] se|m[ůu]žete m[ěě] kontaktovat)/i.test(q);
    if (wantContact) { stepContactVerify(); return; }
    
    (async () => {
      try {
        const typing = U.el("div", { class: "chat-msg ai" }, ["· · ·"]);
        chatMessages.appendChild(typing); 
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        const form = new URLSearchParams();
        if (S.cfg && S.cfg.secret) form.set("secret", S.cfg.secret);
        
        try {
          const msgs = (S.chat && S.chat.messages) ? S.chat.messages.slice(-12) : [{role:"user", content:q}];
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
              const msgs=(S.chat&&S.chat.messages)?S.chat.messages.slice(-12):[{role:"user",content:q}]; 
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
        
        // Zpracování odpovědi a přidání odkazů na územní plán
        const enhancedResponse = processResponse(q, txt);
        
        addAI(enhancedResponse);
      } catch (e) { 
        addAI("Omlouvám se, došlo k chybě při komunikaci s AI. Zkuste to prosím znovu."); 
        console.error("AI chat error:", e); 
      }
    })();
  }

  // ==== Config / data preload (optional) ====
  (async () => {
    try {
      const scriptEl = document.currentScript || document.querySelector('script[data-config]');
      const CFG_URL = scriptEl ? scriptEl.getAttribute("data-config") : null;
      if (CFG_URL) {
        S.cfg = await U.fetchJson(CFG_URL);
      } else {
        S.cfg = S.cfg || {};
      }
      if (S.cfg && S.cfg.data_urls) {
        const d = S.cfg.data_urls;
        const [byty, domy, pozemky, up] = await Promise.all([
          d.byty ? U.fetchJson(d.byty) : null,
          d.domy ? U.fetchJson(d.domy) : null,
          d.pozemky ? U.fetchJson(d.pozemky) : null,
          d.up ? U.fetchJson(d.up) : null
        ]);
        window.PRICES = { byty, domy, pozemky };
        S.data.up = up; // Uložíme data územních plánů
        console.log("Data územních plánů načtena:", S.data.up ? S.data.up.map.length : 0, "záznamů");
      }
    } catch (e) {
      console.error("Chyba načítání konfigurace/dat:", e);
      addAI("Chyba načítání konfigurace/dat: " + String(e));
    }
  })();

  // ==== Init (only when host exists) ====
  function cgSafeStart() {
    try {
      if (!chatMessages) return setTimeout(cgSafeStart, 40);
      renderStart();
    } catch (e) {
      setTimeout(cgSafeStart, 40);
    }
  }

  // kick it
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

})();
