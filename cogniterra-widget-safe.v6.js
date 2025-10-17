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
  if (window.__CG_WIDGET_INIT__) return;
  window.__CG_WIDGET_INIT__ = true;

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
  };

  // ==== shadow root & UI skeleton ====
  const shadow = host.attachShadow({ mode: "open" });

  // === Inject completely new styling for both desktop and mobile ===
  const style = document.createElement("style");
  style.textContent = `
  /* Reset everything */
  :host { all: initial; }
  *, *::before, *::after { 
    box-sizing: border-box; 
    margin: 0;
    padding: 0;
  }
  
  /* Base styles */
  .wrap {
    font-family: 'Source Sans Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 15px;
    line-height: 1.5;
    color: #2d3748;
    -webkit-font-smoothing: antialiased;
  }
  
  /* Chat container */
  .chat {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(50, 50, 93, 0.1), 0 5px 15px rgba(0, 0, 0, 0.07);
    width: 360px;
    max-width: 100vw;
    height: 560px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  /* Header */
  .header {
    background: #2c5282;
    color: #fff;
    padding: 16px;
    font-weight: 600;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  .header .title {
    flex: 1;
  }
  .header .close {
    background: transparent;
    border: none;
    color: #fff;
    cursor: pointer;
    font-size: 16px;
    opacity: 0.8;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .header .close:hover {
    opacity: 1;
  }
  
  /* Messages area */
  .messages {
    flex: 1;
    padding: 16px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    background-color: #f8fafc;
    display: flex;
    flex-direction: column;
  }
  
  /* Message bubbles */
  .msg {
    max-width: 86%;
    margin: 10px 0;
    display: block;
    word-wrap: break-word;
    overflow-wrap: break-word;
    white-space: pre-wrap;
  }
  .msg.ai {
    background: #fff;
    border-left: 4px solid #2c5282;
    border-radius: 0 8px 8px 0;
    padding: 14px 16px;
    align-self: flex-start;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  }
  .msg.me {
    background: #2c5282;
    color: #fff;
    border-radius: 8px 0 0 8px;
    border-right: 4px solid #1a365d;
    padding: 14px 16px;
    align-self: flex-end;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  }
  
  /* Panels (for cards, forms) */
  .panel {
    width: 100%;
    margin: 10px 0;
    background: transparent;
  }
  
  /* Input area */
  .input {
    display: flex;
    gap: 10px;
    padding: 14px 16px;
    background: #fff;
    border-top: 1px solid #e2e8f0;
    position: relative;
  }
  .input textarea {
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
  .input textarea:focus {
    outline: none;
    border-color: #2c5282;
    box-shadow: 0 0 0 2px rgba(44, 82, 130, 0.2);
  }
  .input button {
    background: #2c5282;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 0 18px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  .input button:hover {
    background: #1a365d;
  }
  
  /* Start screen elements */
  .cg-start {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 16px;
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
    transition: all 0.2s ease;
    font-family: inherit;
  }
  .cg-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    border-left-color: #1a365d;
  }
  .cg-card h3 {
    margin: 0 0 6px;
    font-weight: 600;
    font-size: 16px;
    color: #2d3748;
  }
  .cg-card p {
    margin: 0;
    font-size: 14px;
    color: #4a5568;
  }
  
  /* Form elements */
  .cg-step {
    background: #fff;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
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
    box-shadow: 0 0 0 2px rgba(44, 82, 130, 0.2);
  }
  .cg-cta {
    margin-top: 16px;
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .cg-btn {
    background: #2c5282;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 12px 18px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  .cg-btn:hover {
    background: #1a365d;
  }
  
  /* Lead form box */
  .leadbox {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
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
    box-shadow: 0 0 0 2px rgba(44, 82, 130, 0.2);
  }
  .leadbox input[type="checkbox"] {
    width: auto;
    margin-right: 8px;
  }
  .leadbox label {
    display: flex;
    align-items: center;
    font-size: 14px;
  }
  
  /* Hint text */
  .hint {
    color: #718096;
    font-size: 13px;
    margin-top: 6px;
    opacity: 0.8;
  }
  
  /* Mobile-specific styles */
  @media (max-width: 480px) {
    .wrap, .chat {
      width: 100%;
      height: 100%;
      max-width: 100%;
      border-radius: 0;
      box-shadow: none;
    }
    
    .input textarea {
      font-size: 16px; /* Prevent iOS zoom */
    }
  }
  `;
  shadow.appendChild(style);

  const wrap = U.el("div", { class: "wrap" }, []);
  const chat = U.el("div", { class: "chat" }, []);
  const header = U.el("div", { class: "header" }, []);
  const headerTitle = U.el("div", { class: "title" }, ["Asistent Cogniterra"]);
  const closeBtn = U.el("button", { class: "close", onclick: () => { if(window.parent && window.parent.document.querySelector('.cg-close')) window.parent.document.querySelector('.cg-close').click(); }}, ["✕"]);
  header.appendChild(headerTitle);
  header.appendChild(closeBtn);
  
  const messages = U.el("div", { class: "messages" }, []);
  const input = U.el("div", { class: "input" }, []);
  const ta = document.createElement("textarea");
  const send = document.createElement("button"); send.className="send";
  send.textContent = "Odeslat";
  input.appendChild(ta); input.appendChild(send);
  chat.appendChild(header); chat.appendChild(messages); chat.appendChild(input);
  input.style.display = "flex"; ta.placeholder="Napište zprávu…";
  S.chat = S.chat || {messages:[]}; S.intent = S.intent || {}; S.intent = S.intent || {};
  wrap.appendChild(chat); shadow.appendChild(wrap);

  // ==== message helpers ====
  function addAI(t, extra) {
  // render assistant bubble
  const b = U.el("div", { class: "msg ai" }, [t]);
  if (extra) b.appendChild(extra);
  messages.appendChild(b);
  messages.scrollTop = messages.scrollHeight;

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
}
function addME(t) {
    try { S.chat = S.chat || {messages:[]}; S.intent = S.intent || {}; S.intent = S.intent || {}; S.chat.messages.push({ role:"user", content: String(t) }); } catch(_){}
const b = U.el("div", { class: "msg me" }, [t]);
    messages.appendChild(b);
    messages.scrollTop = messages.scrollHeight;
  }
  function addPanel(el) {
    const w = U.el("div", { class: "panel" }, []);
    w.appendChild(el);
    messages.appendChild(w);
    messages.scrollTop = messages.scrollHeight;
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

  // ==== START SCREEN ====
  function renderStart() { try{ta.focus();}catch(e){}
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

  function startHelp() { input.style.display='flex'; try{ta.focus();}catch(e){}
    input.style.display = "flex";
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
      const typing = U.el("div", { class: "msg ai" }, ["· · ·"]);
      messages.appendChild(typing); messages.scrollTop = messages.scrollHeight;
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
        try { const u = new URL(url); if (S.cfg && S.cfg.secret) u.searchParams.set("secret", S.cfg.secret); try { const msgs=(S.chat&&S.chat.messages)?S.chat.messages.slice(-12):[{role:"user",content:q}]; u.searchParams.set("messages", JSON.stringify(msgs)); } catch { u.searchParams.set("messages", JSON.stringify([{role:"user", content:q}])); } try { resp = await fetch(u.toString(), { method: "GET" }); } catch { resp = null; } } catch { resp = null; }
        if (!resp.ok) { addAI("Omlouvám se, teď se mi nedaří získat odpověď od AI. Zkuste to prosím za chvíli."); return; }
      }
      const ct = (resp.headers.get("content-type")||"").toLowerCase();
      let txt = ""; if (ct.includes("application/json")) { try { const j = await resp.json(); txt = j.message || j.reply || j.text || j.answer || JSON.stringify(j); } catch { txt = await resp.text(); } } else { txt = await resp.text(); }
      txt = (txt && String(txt).trim()) || "Rozumím. Ptejte se na cokoliv k nemovitostem, ISNS, územnímu plánu apod.";
      addAI(txt);
    } catch (e) { addAI("Omlouvám se, došlo k chybě při komunikaci s AI. Zkuste to prosím znovu."); console.error("AI chat error:", e); }
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
        const [byty, domy, pozemky] = await Promise.all([
          d.byty ? U.fetchJson(d.byty) : null,
          d.domy ? U.fetchJson(d.domy) : null,
          d.pozemky ? U.fetchJson(d.pozemky) : null
        ]);
        window.PRICES = { byty, domy, pozemky };
      }
    } catch (e) {
      addAI("Chyba načítání konfigurace/dat: " + String(e));
    }
  })();

  // ==== Init (only when host exists) ====
  function cgSafeStart() {
    try {
      if (!messages) return setTimeout(cgSafeStart, 40);
      renderStart();
    } catch (e) {
      setTimeout(cgSafeStart, 40);
    }
  }

  // kick it
  cgSafeStart();

  // input handlers
  send.addEventListener("click", () => { const q = ta.value.trim(); ta.value = ""; ask(q); });
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send.click(); } });

})();
