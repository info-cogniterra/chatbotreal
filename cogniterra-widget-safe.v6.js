// cogniterra-widget-safe.v6.js — CLEANED & FIXED
// Build v6.2.clean — Desktop positioning fix + code cleanup

(function () {
  "use strict";
  console.log("[Cogniterra] Widget v6.2.clean initialization");

  // ==== Single-instance guard ====
  if (window.__CG_WIDGET_INIT__) {
    console.log("[Cogniterra] Widget already initialized, cleaning up");
    try {
      const existingHost = document.querySelector("[data-cogniterra-widget]");
      if (existingHost?.shadowRoot) {
        while (existingHost.shadowRoot.firstChild) {
          existingHost.shadowRoot.removeChild(existingHost.shadowRoot.firstChild);
        }
      }
    } catch (e) {
      console.error("[Cogniterra] Cleanup error:", e);
    }
  }
  window.__CG_WIDGET_INIT__ = true;
  
  // ==== Widget reset function ====
  window.__CG_WIDGET_RESET_FN__ = function() {
    console.log("[Cogniterra] Resetting widget");
    try {
      const host = document.querySelector("[data-cogniterra-widget]");
      if (host?.shadowRoot) {
        while (host.shadowRoot.firstChild) {
          host.shadowRoot.removeChild(host.shadowRoot.firstChild);
        }
        window.__CG_WIDGET_INIT__ = true;
        setTimeout(() => {
          try {
            cgSafeStart();
          } catch(e) {
            console.error("[Cogniterra] Restart error:", e);
          }
        }, 50);
      }
    } catch(e) {
      console.error("[Cogniterra] Reset error:", e);
    }
  };

  // ==== Check host exists ====
  const host = document.querySelector("[data-cogniterra-widget]");
  if (!host) {
    console.warn("[Cogniterra] Host element not found");
    return;
  }

  // ==== State & Config ====
  const S = {
    session: Math.random().toString(36).slice(2),
    flow: null,
    cfg: null,
    data: {},
    tempPricing: null,
    pendingLocationQuery: null,
    lastMatchedLocation: null,
    chat: {messages: []},
    intent: {}
  };

  // ==== Utilities ====
  const U = {
    el(tag, props, kids) {
      const n = document.createElement(tag);
      if (props) {
        for (const k in props) {
          if (k === "class") n.className = props[k];
          else if (k === "style") Object.assign(n.style, props[k]);
          else if (k.startsWith("on")) n[k] = props[k];
          else n.setAttribute(k, props[k]);
        }
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
    
    emailOk(v) { 
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || ""); 
    },
    
    phoneOk(v) { 
      return /^\+?[0-9\s\-()]{7,}$/.test(v || ""); 
    },
    
    norm(v) { 
      return (v || "").normalize("NFKD").toLowerCase(); 
    },
    
    fetchJson(url) { 
      return fetch(url, { credentials: "omit" }).then(r => r.json()); 
    },
    
    normalizeLocation(location) {
      if (!location) return "";
      let normalized = location.normalize("NFKD").toLowerCase().trim();
      const endings = ['ích', 'ich', 'ách', 'ach', 'ům', 'um', 'ím', 'im', 'ě', 'e'];
      for (const end of endings) {
        if (normalized.endsWith(end) && normalized.length > end.length + 3) {
          normalized = normalized.slice(0, -end.length);
          break;
        }
      }
      return normalized;
    },
    
    similarity(a, b) {
      const longer = a.length > b.length ? a : b;
      const shorter = a.length > b.length ? b : a;
      if (longer.length === 0) return 1.0;
      let matches = 0;
      for (let i = 0; i < shorter.length; i++) {
        if (shorter[i] === longer[i]) matches++;
      }
      return matches / longer.length;
    },
    
    containsLandPlanQuestion(text) {
      return /(pozemek|pozemky|parcela|parcely|územní plán|uzemni plan|regulace výstavby|regulace zástavby)/i.test(text);
    },
    
    containsLandPlanLinkRequest(text) {
      return /(poslat|ukázat|zobrazit|zaslat|najít)\s+(odkaz|link|stránk|url).*\s+(územní|uzemni)\s+(plán|plan)/i.test(text);
    },
    
    isAffirmativeResponse(text) {
      return /^(ano|jo|jistě|určitě|jasně|ano chci|dobře|samozřejmě|můžete|ok|okay|jj|přesně tak|prosím|pošli)(\s|$|\.)/i.test(text.trim());
    }
  };

  // ==== Setup Shadow DOM ====
  while (host.firstChild) {
    host.removeChild(host.firstChild);
  }
  
  const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });

  // ==== Shadow DOM Styles (FIXED) ====
  const style = document.createElement("style");
  style.textContent = `
  /* Základní reset */
  :host {
    display: block !important;
    position: relative !important;
    width: 100% !important;
    height: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    box-sizing: border-box !important;
  }
  
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  
  /* OPRAVA: Chat kontejner s position relative */
  .chat-container {
    font: 15px/1.5 'Source Sans Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    color: #2d3748;
    background: #fff;
    border-radius: 12px;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative !important;
    visibility: visible;
    opacity: 1;
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
    flex-shrink: 0;
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
    padding: 4px;
  }
  
  .chat-close-btn:hover {
    opacity: 1;
  }
  
  /* Messages area */
  .chat-messages {
    flex: 1;
    padding: 16px;
    overflow-y: auto;
    background: #f8fafc;
    display: flex;
    flex-direction: column;
  }
  
  /* Message bubbles */
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

  .chat-msg.ai a {
    color: #2c5282;
    text-decoration: underline;
    font-weight: 500;
  }

  .chat-msg.ai a:hover {
    color: #1a365d;
  }
  
  /* Panel pro karty/formuláře */
  .chat-panel {
    background: transparent;
    padding: 0;
    margin: 12px 0;
    width: 100%;
  }
  
  /* Input area */
  .chat-input-area {
    display: flex;
    gap: 10px;
    padding: 14px 16px;
    background: #fff;
    border-top: 1px solid #e2e8f0;
    flex-shrink: 0;
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
  
  /* Start screen cards */
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
  
  /* Forms */
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
  
  @media (max-width: 480px) {
    .chat-container {
      border-radius: 0;
    }
    .chat-input-area textarea {
      font-size: 16px;
    }
  }
  `;
  shadow.appendChild(style);

  // ==== UI Structure ====
  const chatContainer = U.el("div", { class: "chat-container" });
  const chatHeader = U.el("div", { class: "chat-header" });
  const chatTitle = U.el("div", { class: "chat-header-title" }, ["Asistent Cogniterra"]);
  
  function closeChat() {
    if (window.CGTR?.hideChat) {
      window.CGTR.hideChat();
    } else if (window.parent) {
      try {
        window.parent.document.querySelector('.cg-close')?.click();
      } catch(e) {
        console.error("[Cogniterra] Close error:", e);
      }
    }
  }
  
  const chatCloseBtn = U.el("button", { 
    class: "chat-close-btn",
    type: "button",
    onclick: closeChat
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
  chatInputArea.appendChild(chatTextarea);
  chatInputArea.appendChild(chatSendBtn);
  chatContainer.appendChild(chatInputArea);
  
  shadow.appendChild(chatContainer);

  // ==== Message Helpers ====
  function addAI(text, extra) {
    const bubble = U.el("div", { class: "chat-msg ai" });
    bubble.innerHTML = text;
    if (extra) bubble.appendChild(extra);
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    S.chat.messages.push({ role: "assistant", content: String(text) });
    
    // Detect contact form offer
    const tt = String(text).toLowerCase();
    if (/(mohu|můžu|rád|ráda)\s+(vám\s+)?(ote[vw]ř[ií]t|zobrazit|spustit)\s+(kontaktn[íi]\s+formul[aá][řr])/i.test(tt) ||
        /chcete\s+(ote[vw]ř[ií]t|zobrazit|spustit)\s+(formul[aá][řr])/i.test(tt)) {
      S.intent.contactOffer = true;
    }
    
    // Detect land plan offer
    if (/(poslat|ukázat|zaslat|odkázat|přiložit)\s+(vám\s+)?(odkaz|link|stránku|url)\s+na\s+(územní|uzemni)\s+(plán|plan)/i.test(tt) && S.lastMatchedLocation) {
      S.intent.upOffer = true;
    }
  }

  function addME(text) {
    S.chat.messages.push({ role: "user", content: String(text) });
    const bubble = U.el("div", { class: "chat-msg me" }, [text]);
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  function addPanel(el) {
    const wrapper = U.el("div", { class: "chat-panel" }, []);
    wrapper.appendChild(el);
    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // ==== Mapy.cz Suggest ====
  let MAPY_PROMISE = null;
  function loadMapy(apiKey) {
    if (MAPY_PROMISE) return MAPY_PROMISE;
    MAPY_PROMISE = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://api.mapy.cz/loader.js";
      script.onload = () => {
        if (window.Loader) {
          window.Loader.async = true;
          window.Loader.load(null, {
            api: "suggest",
            key: apiKey,
            onload: () => resolve(true)
          });
        } else resolve(false);
      };
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
    return MAPY_PROMISE;
  }
  
  function attachSuggest(inputEl) {
    if (!inputEl) return;
    const key = S.cfg?.mapy_key || "EreCyrH41se5wkNErc5JEWX2eMLqnpja5BUVxsvpqzM";
    loadMapy(key).then((ok) => {
      if (!ok) {
        inputEl.placeholder += " (našeptávač nedostupný)";
        return;
      }
      try { 
        if (window.SMap?.Suggest) new SMap.Suggest(inputEl); 
      } catch (e) {
        console.error("[Cogniterra] Suggest error:", e);
      }
    });
  }

  // ==== Location Extraction ====
  function extractLocations(userQuery) {
    const locations = [];
    
    // Předložky
    const matches = userQuery.match(/\b(v|ve|na|pro|o|k|u|kolem|poblíž|nedaleko|město|obec|města|obce|lokalita|lokalitě)\s+([A-Za-zÀ-ž]+(?:\s+[A-Za-zÀ-ž]+){0,2})/gi);
    if (matches) {
      matches.forEach(match => {
        const loc = match.replace(/\b(v|ve|na|pro|o|k|u|kolem|poblíž|nedaleko|město|obec|města|obce|lokalita|lokalitě)\s+/i, '').trim();
        if (loc.length >= 2) locations.push(loc);
      });
    }
    
    // Velká písmena
    const words = userQuery.split(/\s+/);
    words.forEach(word => {
      const trimmed = word.replace(/[,.;:?!]/g, '').trim();
      if (trimmed.length >= 2 && /^[A-ZČŠŽŇÁÉÍÓÚŮÝŘŤĎĚ]/.test(trimmed)) {
        locations.push(trimmed);
      }
    });
    
    return [...new Set(locations)];
  }

  // ==== Find Land Plan ====
  function findUzemniPlan(location) {
    if (!S.data?.up?.map) return null;
    
    const normalized = U.normalizeLocation(location);
    
    // Exact match
    let match = S.data.up.map.find(e => 
      U.normalizeLocation(e.obec) === normalized || 
      U.normalizeLocation(e.ku) === normalized
    );
    if (match) return match;
    
    // Partial match
    match = S.data.up.map.find(e => 
      U.normalizeLocation(e.obec).includes(normalized) || 
      U.normalizeLocation(e.ku).includes(normalized) ||
      normalized.includes(U.normalizeLocation(e.obec))
    );
    if (match) return match;
    
    // Fuzzy match
    let best = null;
    let bestScore = 0;
    S.data.up.map.forEach(e => {
      const score = Math.max(
        U.similarity(U.normalizeLocation(e.obec), normalized),
        U.similarity(U.normalizeLocation(e.ku), normalized)
      );
      if (score > 0.7 && score > bestScore) {
        bestScore = score;
        best = e;
      }
    });
    
    return best;
  }

  // ==== Process Response (add land plan links) ====
  function processResponse(userQuery, aiResponse) {
    let response = aiResponse;
    
    if (U.containsLandPlanQuestion(userQuery) || U.containsLandPlanLinkRequest(userQuery)) {
      const locations = extractLocations(userQuery);
      
      if (locations.length > 0) {
        S.pendingLocationQuery = locations[0];
        
        for (const location of locations) {
          const plan = findUzemniPlan(location);
          if (plan?.url) {
            S.lastMatchedLocation = plan;
            response += `\n\nPro lokalitu ${plan.obec}${plan.ku !== plan.obec ? ` (${plan.ku})` : ''} najdete územní plán zde: <a href="${plan.url}" target="_blank">${plan.url}</a>`;
            break;
          }
        }
      }
    }
    
    return response;
  }

  function addLandPlanLink(location) {
    if (!location) return false;
    const plan = findUzemniPlan(location);
    if (!plan?.url) return false;
    addAI(`Pro lokalitu ${plan.obec}${plan.ku !== plan.obec ? ` (${plan.ku})` : ''} najdete územní plán zde: <a href="${plan.url}" target="_blank">${plan.url}</a>`);
    return true;
  }

  // ==== Start Screen ====
  function renderStart() {
    addAI("Dobrý den, rád vám pomohu s vaší nemovitostí. Vyberte, co potřebujete.");
    
    const cards = U.el("div", { class: "cg-start" }, [
      U.el("div", { class: "cg-cards" }, [
        U.el("button", { class: "cg-card", type: "button", onclick: startPricing }, [
          U.el("h3", {}, ["Nacenit nemovitost"]),
          U.el("p", {}, ["Rychlý odhad a krátký dotazník (1–2 min)."])
        ]),
        U.el("button", { class: "cg-card", type: "button", onclick: startHelp }, [
          U.el("h3", {}, ["Potřebuji pomoct"]),
          U.el("p", {}, ["Zeptejte se na postup, dokumenty nebo pravidla."])
        ])
      ])
    ]);
    
    addPanel(cards);
  }

  function startHelp() {
    chatInputArea.style.display = 'flex';
    chatTextarea.focus();
    addAI("Rozumím. Ptejte se na cokoliv k nemovitostem, ISNS, územnímu plánu apod.");
  }

  function startPricing() {
    S.flow = "pricing";
    stepChooseType();
  }

  // ==== Pricing Flow ====
  function stepChooseType() {
    const box = U.el("div", { class: "cg-step" }, [
      U.el("label", {}, ["Vyberte typ nemovitosti"]),
      U.el("div", { class: "cg-cta" }, [
        U.el("button", { class: "cg-btn", type: "button", onclick: () => stepLocation("Byt") }, ["Byt"]),
        U.el("button", { class: "cg-btn", type: "button", onclick: () => stepLocation("Dům") }, ["Dům"]),
        U.el("button", { class: "cg-btn", type: "button", onclick: () => stepLocation("Pozemek") }, ["Pozemek"])
      ])
    ]);
    addAI("Nacenění – krok 1/3", box);
  }

  function stepLocation(typ) {
    const street = (typ === "Pozemek") ? null : U.input("ulice", "Ulice (volitelné)");
    const town = U.input("obec", "Obec");
    const hint = U.el("div", { class: "hint" }, ["Začněte psát – nabídneme shody (Mapy.cz)."]);
    
    const next = U.el("button", { class: "cg-btn", type: "button", onclick: () => {
      const obec = town.value?.trim();
      if (!obec) {
        addAI("Zadejte prosím obec.");
        town.focus();
        return;
      }
      if (typ === "Byt") stepParamsByt(obec);
      else if (typ === "Dům") stepParamsDum(obec);
      else stepParamsPozemek(obec);
    }}, ["Pokračovat"]);
    
    const inner = [U.el("label", {}, [`Lokalita – ${typ}`])];
    if (street) inner.push(street);
    inner.push(town, hint, U.el("div", { class: "cg-cta" }, [next]));
    
    const box = U.el("div", { class: "cg-step" }, inner);
    addAI("Nacenění – krok 2/3", box);
    
    if (street) attachSuggest(street);
    attachSuggest(town);
  }

  function stepParamsByt(obec) {
    const disp = U.input("dispozice", "Dispozice (např. 2+kk)");
    const stav = U.select("stav", ["Novostavba","Po rekonstrukci","Dobrý","Špatný"]);
    const vlast = U.select("vlastnictvi", ["Osobní","Družstevní"]);
    const area = U.input("vymera", "Výměra (m²)", "number");

    const go = U.el("button", { class: "cg-btn", type: "button", onclick: () => {
      renderLeadBoxPricing({
        typ: "Byt",
        obec,
        dispozice: disp.value,
        stav: stav.value,
        vlastnictvi: vlast.value,
        vymera: parseFloat(area.value || 0)
      });
    }}, ["Pokračovat k odhadu"]);

    const box = U.el("div", { class: "cg-step" }, [
      U.el("label", {}, ["Parametry bytu – ", obec]),
      disp, stav, vlast, area,
      U.el("div", { class: "cg-cta" }, [go])
    ]);
    addAI("Nacenění – krok 3/3", box);
  }

  function stepParamsDum(obec) {
    const typS = U.input("typ_stavby", "Typ stavby");
    const stav = U.select("stav", ["Novostavba","Po rekonstrukci","Dobrý","Špatný"]);
    const area = U.input("vymera", "Výměra (m²)", "number");

    const go = U.el("button", { class: "cg-btn", type: "button", onclick: () => {
      renderLeadBoxPricing({
        typ: "Dům",
        obec,
        typ_stavby: typS.value,
        stav: stav.value,
        vymera: parseFloat(area.value || 0)
      });
    }}, ["Pokračovat k odhadu"]);

    const box = U.el("div", { class: "cg-step" }, [
      U.el("label", {}, ["Parametry domu – ", obec]),
      typS, stav, area,
      U.el("div", { class: "cg-cta" }, [go])
    ]);
    addAI("Nacenění – krok 3/3", box);
  }

  function stepParamsPozemek(obec) {
    const kat = U.input("kategorie", "Kategorie pozemku");
    const area = U.input("vymera", "Výměra (m²)", "number");

    const go = U.el("button", { class: "cg-btn", type: "button", onclick: () => {
      renderLeadBoxPricing({
        typ: "Pozemek",
        obec,
        kategorie: kat.value,
        vymera: parseFloat(area.value || 0)
      });
    }}, ["Pokračovat k odhadu"]);

    const box = U.el("div", { class: "cg-step" }, [
      U.el("label", {}, ["Parametry pozemku – ", obec]),
      kat, area,
      U.el("div", { class: "cg-cta" }, [go])
    ]);
    addAI("Nacenění – krok 3/3", box);
  }

  // ==== Lead Forms ====
  function renderLeadBoxPricing(params) {
    S.tempPricing = params;
    const consentId = "cgConsent_" + Math.random().toString(36).slice(2);

    const box = U.el("div", { class: "leadbox" }, [
      U.el("div", {}, ["Pro ověření, že nejste robot, zadejte prosím kontakty."]),
      U.el("input", { id: "lead_name", placeholder: "Jméno" }),
      U.el("input", { id: "lead_email", type: "email", placeholder: "E-mail" }),
      U.el("input", { id: "lead_phone", placeholder: "Telefon (+420…)" }),
      U.el("label", {}, [
        U.el("input", { id: consentId, type: "checkbox" }),
        " Souhlasím se zpracováním osobních údajů."
      ]),
      U.el("div", { class: "cg-cta" }, [
        U.el("button", { class: "cg-btn", onclick: () => saveLeadPricing(consentId) }, ["Odeslat a zobrazit odhad"])
      ])
    ]);
    addAI("Kontaktní ověření", box);
  }

  async function saveLeadPricing(consentId) {
    const btn = shadow.querySelector(".leadbox .cg-btn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Odesílám…";
    }

    const name = shadow.querySelector("#lead_name")?.value?.trim();
    const email = shadow.querySelector("#lead_email")?.value?.trim();
    const phone = shadow.querySelector("#lead_phone")?.value?.trim();
    const consent = shadow.querySelector("#" + consentId)?.checked;

    if (!name || !U.emailOk(email) || !U.phoneOk(phone) || !consent) {
      addAI("Zkontrolujte prosím kontaktní údaje a potvrďte souhlas.");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Odeslat a zobrazit odhad";
      }
      return;
    }

    const payload = {
      secret: S.cfg?.secret || "",
      branch: "chat",
      session_id: S.session,
      jmeno: name,
      email: email,
      telefon: phone,
      message: "Žádost o odhad z chatbota",
      source: "chat_widget_pricing",
      timestamp: new Date().toISOString(),
      path: "/lead",
      pricing_params: JSON.stringify(S.tempPricing || {})
    };

    // Send lead
    try {
      if (S.cfg?.lead_url) {
        const body = new URLSearchParams(payload);
        await fetch(S.cfg.lead_url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body
        }).catch(() => {
          // Fire-and-forget fallback
          fetch(S.cfg.lead_url, { 
            method: "POST", 
            mode: "no-cors", 
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body 
          });
        });
      }
    } catch (e) {
      console.error("[Cogniterra] Lead save error:", e);
      addAI("Nepodařilo se uložit kontakt. Zkuste to prosím znovu.");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Odeslat a zobrazit odhad";
      }
      return;
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = "Odesláno";
    }

    // Calculate estimate using global CG_Estimator
    const P = S.tempPricing || {};
    let result = null;
    
    if (window.CG_Estimator) {
      if (P.typ === "Byt") {
        result = window.CG_Estimator.estimateByt(window.PRICES?.byty, P);
      } else if (P.typ === "Dům") {
        result = window.CG_Estimator.estimateDum(window.PRICES?.domy, P);
      } else {
        result = window.CG_Estimator.estimatePozemek(window.PRICES?.pozemky, P);
      }
    }

    renderEstimate(result || {low: 0, high: 0, m2: 0, note: "Odhad není dostupný"}, P.typ || "Nemovitost");
  }

  function renderEstimate(res, typ) {
    const box = U.el("div", { class: "cg-step" }, [
      U.el("label", {}, [`${typ}: předběžný odhad`]),
      U.el("div", {}, [`Rozpětí: ${res.low?.toLocaleString?.("cs-CZ") || res.low || "-"} – ${res.high?.toLocaleString?.("cs-CZ") || res.high || "-"} Kč`]),
      U.el("div", {}, [`Orientační cena za m²: ${res.m2 || res.per_m2 || "-"} Kč/m²`]),
      U.el("div", { class: "hint" }, [res.note || "Odhad je orientační."]),
      U.el("div", { class: "cg-cta" }, [
        U.el("button", { class: "cg-btn", onclick: () => addAI("Děkujeme, kolegové se vám ozvou s přesným odhadem.") }, ["Přesný odhad zdarma"])
      ])
    ]);
    addAI("Výsledek odhadu", box);
  }

  // ==== Contact Form ====
  function stepContactVerify() {
    const consentId = "cgConsent_" + Math.random().toString(36).slice(2);
    
    const box = U.el("div", { class: "leadbox" }, [
      U.el("div", {}, ["Zanechte na sebe kontakt."]),
      U.el("input", { id: "c_name", placeholder: "Jméno" }),
      U.el("input", { id: "c_email", type: "email", placeholder: "E-mail" }),
      U.el("input", { id: "c_phone", placeholder: "Telefon (+420…)" }),
      U.el("label", {}, [
        U.el("input", { id: consentId, type: "checkbox" }),
        " Souhlasím se zpracováním osobních údajů."
      ]),
      U.el("div", { class: "cg-cta" }, [
        U.el("button", { class: "cg-btn", onclick: () => saveLeadContact(consentId) }, ["Odeslat"])
      ])
    ]);
    addAI("Kontaktní formulář", box);
  }

  async function saveLeadContact(consentId) {
    const btn = shadow.querySelector(".leadbox .cg-btn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Odesílám…";
    }

    const name = shadow.querySelector("#c_name")?.value?.trim();
    const email = shadow.querySelector("#c_email")?.value?.trim();
    const phone = shadow.querySelector("#c_phone")?.value?.trim();
    const consent = shadow.querySelector("#" + consentId)?.checked;

    if (!name || !U.emailOk(email) || !U.phoneOk(phone) || !consent) {
      addAI("Zkontrolujte prosím kontaktní údaje a potvrďte souhlas.");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Odeslat";
      }
      return;
    }

    const payload = {
      secret: S.cfg?.secret || "",
      branch: "chat",
      session_id: S.session,
      jmeno: name,
      email: email,
      telefon: phone,
      message: "Žádost o kontakt z chatbota",
      source: "chat_widget_contact",
      timestamp: new Date().toISOString(),
      path: "/lead",
      transcript: JSON.stringify(S.chat.messages.slice(-12))
    };

    try {
      if (S.cfg?.lead_url) {
        const body = new URLSearchParams(payload);
        await fetch(S.cfg.lead_url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body
        }).catch(() => {
          fetch(S.cfg.lead_url, { 
            method: "POST", 
            mode: "no-cors", 
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body 
          });
        });
      }
      addAI("Děkuji, ozveme se vám co nejdříve.");
    } catch (e) {
      console.error("[Cogniterra] Contact save error:", e);
      addAI("Nepodařilo se uložit kontakt. Zkuste to prosím znovu.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Odeslat";
      }
    }
  }

  // ==== Chat Logic ====
  function needPricing(q) {
    return /(nacenit|naceněn|ocenit|odhad(\s*ceny)?|cena\s+nemovitosti|spočítat\s*cenu|kolik\s+to\s*stojí)/i.test(U.norm(q));
  }
  
  function ask(q) {
    if (!q) return;
    
    // Check for contact form confirmation
    if (S.intent.contactOffer) {
      const yesRe = /^(ano|jo|ok|okej|jasn[eě]|pros[íi]m|dob[rř]e|spus[tť]it|ote[vw][řr][ií]t|zobraz(it)?|m[oů]žete|ur[cč]it[ěe])(\b|!|\.)/i;
      if (yesRe.test(q.trim())) {
        addME(q);
        stepContactVerify();
        S.intent.contactOffer = false;
        return;
      }
      S.intent.contactOffer = false;
    }
    
    // Check for land plan link confirmation
    if (S.intent.upOffer && S.lastMatchedLocation && U.isAffirmativeResponse(q)) {
      addME(q);
      addLandPlanLink(S.lastMatchedLocation.obec);
      S.intent.upOffer = false;
      return;
    }
    
    // Direct land plan link request
    if (S.pendingLocationQuery && U.containsLandPlanLinkRequest(q)) {
      addME(q);
      const success = addLandPlanLink(S.pendingLocationQuery);
      if (!success) {
        addAI("Omlouvám se, ale nemohu poskytnout přímé odkazy. Navštivte prosím oficiální web města " + S.pendingLocationQuery + ".");
      }
      return;
    }
    
    addME(q);
    
    // Pricing intent
    if (needPricing(q)) {
      startPricing();
      return;
    }
    
    // Contact intent
    if (/(^|\b)(chci ?být ?kontaktov[aá]n|kontaktuj(te)? m[ěe]|zavolejte|napi[sš]te|nechte kontakt|ozv[eu] se|m[ůu]žete m[ěě] kontaktovat)/i.test(q)) {
      stepContactVerify();
      return;
    }
    
    const url = S.cfg?.proxy_url || S.cfg?.chat_url;
    if (!url) {
      addAI("Rozumím. Ptejte se na cokoliv k nemovitostem, ISNS, územnímu plánu apod.");
      return;
    }
    
    // AI chat request
    (async () => {
      try {
        const typing = U.el("div", { class: "chat-msg ai" }, ["· · ·"]);
        chatMessages.appendChild(typing);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        const form = new URLSearchParams();
        if (S.cfg?.secret) form.set("secret", S.cfg.secret);
        form.set("messages", JSON.stringify(S.chat.messages.slice(-12)));
        
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form
        });
        
        typing.remove();
        
        if (!resp.ok) {
          addAI("Omlouvám se, teď se mi nedaří získat odpověď. Zkuste to prosím za chvíli.");
          return;
        }
        
        const ct = resp.headers.get("content-type") || "";
        let text = "";
        
        if (ct.includes("application/json")) {
          const json = await resp.json();
          text = json.message || json.reply || json.text || json.answer || JSON.stringify(json);
        } else {
          text = await resp.text();
        }
        
        text = text.trim() || "Rozumím. Ptejte se na cokoliv k nemovitostem, ISNS, územnímu plánu apod.";
        
        const enhanced = processResponse(q, text);
        addAI(enhanced);
      } catch (e) {
        console.error("[Cogniterra] AI error:", e);
        addAI("Omlouvám se, došlo k chybě. Zkuste to prosím znovu.");
      }
    })();
  }

  // ==== Config & Data Loading ====
  (async () => {
    try {
      const scriptEl = document.currentScript || document.querySelector('script[data-config]');
      const CFG_URL = scriptEl?.getAttribute("data-config");
      
      if (CFG_URL) {
        S.cfg = await U.fetchJson(CFG_URL);
        console.log("[Cogniterra] Config loaded");
      }

      // Load data files
      if (S.cfg?.data_urls) {
        // Land plans
        if (S.cfg.data_urls.up) {
          try {
            S.data.up = await U.fetchJson(S.cfg.data_urls.up);
            console.log(`[Cogniterra] Loaded ${S.data.up.map?.length || 0} land plans`);
          } catch(e) {
            console.error("[Cogniterra] UP data error:", e);
          }
        }

        // Price data for estimator
        const prices = {};
        for (const type of ["byty", "domy", "pozemky"]) {
          if (S.cfg.data_urls[type]) {
            try {
              prices[type] = await U.fetchJson(S.cfg.data_urls[type]);
            } catch(e) {
              console.error(`[Cogniterra] ${type} data error:`, e);
            }
          }
        }
        
        if (Object.keys(prices).length > 0) {
          window.PRICES = prices;
          console.log("[Cogniterra] Price data loaded");
        }
      }
    } catch (e) {
      console.error("[Cogniterra] Init error:", e);
    }

    // Event handlers
    chatTextarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const q = chatTextarea.value.trim();
        if (q) {
          chatTextarea.value = "";
          ask(q);
        }
      }
    });

    chatSendBtn.addEventListener("click", () => {
      const q = chatTextarea.value.trim();
      if (q) {
        chatTextarea.value = "";
        ask(q);
      }
    });

    // Start with input hidden
    chatInputArea.style.display = 'none';
    
    // Render start screen
    renderStart();

    console.log("[Cogniterra] Widget ready");
    window.__CG_WIDGET_LOADED__ = true;
  })();

  // Safe start function
  function cgSafeStart() {
    try {
      if (chatMessages) {
        renderStart();
      } else {
        setTimeout(cgSafeStart, 40);
      }
    } catch (e) {
      console.error("[Cogniterra] Safe start error:", e);
      setTimeout(cgSafeStart, 40);
    }
  }
})();
