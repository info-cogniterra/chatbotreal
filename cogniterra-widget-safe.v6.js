// cogniterra-widget-safe.v6.js  — FIXED FINAL
// Build: v6.130.3  (intro bubble + 2 cards panel; contact -> price; Mapy.cz Suggest; no stray commas)

// -----------------------------
// Minimal widget bootstrap
// -----------------------------
(function () {
  "use strict";

  // Guard to avoid double-init
  if (window.__CG_WIDGET_INIT__) return;
  window.__CG_WIDGET_INIT__ = true;

  // -----------------------------
  // State + Config
  // -----------------------------
  const S = {
    session: Math.random().toString(36).slice(2),
    flow: null,
    cfg: null,         // will be loaded from data-config (JSON) if present
    data: {},
    tempPricing: null,
  };

  // -----------------------------
  // Utilities
  // -----------------------------
  const U = {
    el(tag, props, children) {
      const n = document.createElement(tag);
      if (props) for (const k in props) {
        if (k === "class") n.className = props[k];
        else if (k === "style") Object.assign(n.style, props[k]);
        else if (k.startsWith("on")) n[k] = props[k];
        else n.setAttribute(k, props[k]);
      }
      (children || []).forEach((c) => {
        if (typeof c === "string") n.appendChild(document.createTextNode(c));
        else if (c) n.appendChild(c);
      });
      return n;
    },
    input(name, placeholder, type = "text") {
      return U.el("input", { name, id: name, placeholder, type, class: "cg-input" });
    },
    select(name, options) {
      const s = U.el("select", { name, id: name, class: "cg-select" });
      options.forEach((o) => s.appendChild(U.el("option", { value: o }, [o])));
      return s;
    },
    emailOk(v) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || "");
    },
    phoneOk(v) {
      return /^\+?\d[\d\s\-]{7,}$/.test(v || "");
    },
    norm(v) {
      return (v || "").normalize("NFKD").toLowerCase();
    },
    fetchJson(url) {
      return fetch(url, { credentials: "omit" }).then((r) => r.json());
    },
  };

  // -----------------------------
  // Shadow DOM + basic layout
  // -----------------------------
  const host = document.querySelector("[data-cogniterra-widget]") || (function () {
    const h = document.createElement("div");
    h.setAttribute("data-cogniterra-widget", "1");
    document.body.appendChild(h);
    return h;
  })();
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
  .wrap{font:14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial; color:#fff}
  .chat{background:#121417;border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.35); width:360px; max-width:100vw; height:560px; display:flex; flex-direction:column; overflow:hidden}
  .header{padding:10px 12px; background:#0b0d10; border-bottom:1px solid rgba(255,255,255,.08); font-weight:700}
  .messages{flex:1; padding:12px; overflow:auto}
  .msg{max-width:100%; margin:8px 0; display:block}
  .msg.ai{background:#1a1f25; border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:10px 12px}
  .msg.me{align-self:flex-end; background:#0a7d5a; border-radius:12px; padding:10px 12px}
  .panel{background:transparent; padding:0; margin:8px 0 4px}
  .input{padding:10px; border-top:1px solid rgba(255,255,255,.08); display:flex; gap:8px}
  .input textarea{flex:1; resize:none; height:40px; border-radius:10px; border:1px solid rgba(255,255,255,.1); background:#12161b; color:#fff; padding:8px}
  .input button{border:0; background:#0a7d5a; color:#fff; padding:0 14px; border-radius:10px; font-weight:700; cursor:pointer}
  .cg-start{display:flex; flex-direction:column; gap:12px}
  .cg-cards{display:grid; grid-template-columns:1fr; gap:12px}
  .cg-card{ text-align:left; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:14px; padding:14px 16px; cursor:pointer; box-shadow:0 6px 18px rgba(0,0,0,.08)}
  .cg-card:hover{ box-shadow:0 12px 28px rgba(0,0,0,.14) }
  .cg-card h3{ margin:0 0 4px; font-weight:700; font-size:16px }
  .cg-card p{ margin:0; font-size:13px; opacity:.9 }
  .cg-step label{display:block; margin:6px 0 8px; opacity:.9}
  .cg-input,.cg-select{width:100%; margin:6px 0 8px; padding:10px 12px; border-radius:10px; border:1px solid rgba(255,255,255,.12); background:#12161b; color:#fff}
  .cg-cta{margin-top:8px}
  .cg-btn{border:0; background:#0a7d5a; color:#fff; padding:10px 14px; border-radius:10px; font-weight:700; cursor:pointer}
  .leadbox input{width:100%; margin:6px 0 8px; padding:10px 12px; border-radius:10px; border:1px solid rgba(255,255,255,.12); background:#12161b; color:#fff}
  .hint{opacity:.7; font-size:12px; margin-top:4px}
  `;
  shadow.appendChild(style);

  const wrap = U.el("div", { class: "wrap" }, []);
  const chat = U.el("div", { class: "chat" }, []);
  const header = U.el("div", { class: "header" }, ["Asistent Cogniterra"]);
  const messages = U.el("div", { class: "messages" }, []);
  const input = U.el("div", { class: "input" }, []);
  const ta = document.createElement("textarea");
  const send = document.createElement("button");
  send.textContent = "Odeslat";
  input.appendChild(ta);
  input.appendChild(send);
  chat.appendChild(header);
  chat.appendChild(messages);
  chat.appendChild(input);
  wrap.appendChild(chat);
  shadow.appendChild(wrap);

  // -----------------------------
  // Messaging helpers
  // -----------------------------
  function addAI(t, extra) {
    const b = U.el("div", { class: "msg ai" }, [t]);
    if (extra) b.appendChild(extra);
    messages.appendChild(b);
    messages.scrollTop = messages.scrollHeight;
  }
  function addME(t) {
    const b = U.el("div", { class: "msg me" }, [t]);
    messages.appendChild(b);
    messages.scrollTop = messages.scrollHeight;
  }
  function addPanel(el) {
    const wrap = U.el("div", { class: "panel" }, []);
    wrap.appendChild(el);
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
  }

  // -----------------------------
  // Mapy.cz Suggest (promise loader)
  // -----------------------------
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
    loadMapy(key).then(() => {
      try { if (window.SMap && SMap.Suggest) new SMap.Suggest(inputEl); } catch (_) {}
    });
  }

  // -----------------------------
  // Estimator (placeholder – výpočty máš zvlášť; zde jen volání)
  // -----------------------------
  window.CG_Estimator = window.CG_Estimator || {
    estimateByt(m, p)   { return {low: 0, mid: 0, high: 0, per_m2: 0, note:"MVP"}; },
    estimateDum(m, p)   { return {low: 0, mid: 0, high: 0, per_m2: 0, note:"MVP"}; },
    estimatePozemek(m,p){ return {low: 0, mid: 0, high: 0, per_m2: 0, note:"MVP"}; }
  };

  // -----------------------------
  // Start screen (YOUR SPEC)
  // -----------------------------
  function renderStart() {
    // 1) Úvodní bublina
    addAI("Dobrý den 👋 Jsem virtuální asistent Cogniterry. Jak mohu pomoci?");

    // 2) Dvě klikací karty (panel mimo bublinu)
    const cards = U.el("div", { class: "cg-start" }, [
      U.el("div", { class: "cg-cards" }, [
        U.el("button", { class: "cg-card", type: "button", onclick: () => startPricing() }, [
          U.el("h3", {}, ["Nacenit nemovitost"]),
          U.el("p", {}, ["Rychlý odhad ceny z tržních dat."])
        ]),
        U.el("button", { class: "cg-card", type: "button", onclick: () => startHelp() }, [
          U.el("h3", {}, ["Potřebuji pomoct"]),
          U.el("p", {}, ["Chat s naším asistentem (problém s nemovitostí, Vaše dotazy)"])
        ])
      ])
    ]);

    addPanel(cards);
  }

  function startHelp() {
    addAI("Jsem připraven. Napište, s čím potřebujete pomoct.");
  }

  function startPricing() {
    S.flow = "pricing";
    stepChooseType();
  }

  // -----------------------------
  // Pricing flow
  // -----------------------------
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
      if (!obec) { addAI("Zadejte prosím obec."); return; }
      if (typ === "Byt") return stepParamsByt(obec);
      if (typ === "Dům") return stepParamsDum(obec);
      return stepParamsPozemek(obec);
    }}, ["Pokračovat"]);
    const inner = [U.el("label", {}, [`Lokalita – ${typ}`])];
    if (street) inner.push(street);
    inner.push(town, hint, U.el("div", { class: "cg-cta" }, [nxt]));
    const box = U.el("div", { class: "cg-step" }, inner);

    addAI("Nacenění – krok 2/3", box);
    // Mapy.cz Suggest hookup
    if (street) attachSuggest(street);
    attachSuggest(town);
  }

  function stepParamsByt(obec) {
    const disp  = U.input("dispozice", "Dispozice (např. 2+kk)");
    const stav  = U.select("stav", ["Novostavba", "Po rekonstrukci", "Dobrý", "Špatný"]);
    const vlast = U.select("vlastnictvi", ["Osobní", "Družstevní"]);
    const area  = U.input("vymera", "Výměra (m²)", "number");

    const go = U.el("button", { class: "cg-btn", type: "button", onclick: () => {
      const params = {
        typ: "Byt",
        obec,
        dispozice: disp.value,
        stav: stav.value,
        vlastnictvi: vlast.value,
        vymera: parseFloat(area.value || 0),
      };
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
    const typS  = U.input("typ_stavby", "Typ stavby");
    const stav  = U.select("stav", ["Novostavba", "Po rekonstrukci", "Dobrý", "Špatný"]);
    const area  = U.input("vymera", "Výměra (m²)", "number");

    const go = U.el("button", { class: "cg-btn", type: "button", onclick: () => {
      const params = {
        typ: "Dům",
        obec,
        typ_stavby: typS.value,
        stav: stav.value,
        vymera: parseFloat(area.value || 0),
      };
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
      const params = {
        typ: "Pozemek",
        obec,
        kategorie: kat.value,
        vymera: parseFloat(area.value || 0),
      };
      renderLeadBoxPricing(params);
    }}, ["Pokračovat k odhadu"]);

    const box = U.el("div", { class: "cg-step" }, [
      U.el("label", {}, ["Parametry pozemku – ", obec]),
      kat, area,
      U.el("div", { class: "cg-cta" }, [go]),
    ]);
    addAI("Nacenění – krok 3/3", box);
  }

  // -----------------------------
  // Lead-first gate -> then compute estimate
  // -----------------------------
  function renderLeadBoxPricing(params) {
    S.tempPricing = params;
    const consentId = "cgConsent_" + Math.random().toString(36).slice(2);

    const box = U.el("div", { class: "leadbox" }, [
      U.el("div", {}, ["Pro ověření, že nejste robot, prosíme o zadání vašich kontaktů."]),
      U.el("input", { id: "lead_name", name: "name", placeholder: "Jméno" }),
      U.el("input", { id: "lead_email", name: "email", type: "email", placeholder: "E-mail" }),
      U.el("input", { id: "lead_phone", name: "phone", placeholder: "Telefon (+420…)" }),
      U.el("label", {}, [
        U.el("input", { id: consentId, type: "checkbox" }),
        " Odesláním souhlasím se zásadami zpracování osobních údajů."
      ]),
      U.el("div", { class: "cg-cta" }, [
        U.el("button", { class: "cg-btn", type: "button", onclick: () => saveLeadPricing(consentId) }, ["Odeslat a zobrazit odhad"]),
      ]),
    ]);
    addAI("Kontaktní ověření", box);
  }

  async function saveLeadPricing(consentId) {
    const btn = shadow.querySelector(".leadbox .cg-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Odesílám…"; }

    const name  = (shadow.getElementById("lead_name")  || { value: "" }).value.trim();
    const email = (shadow.getElementById("lead_email") || { value: "" }).value.trim();
    const phone = (shadow.getElementById("lead_phone") || { value: "" }).value.trim();
    const consent = (shadow.getElementById(consentId) || { checked: false }).checked;

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
      // Send to Apps Script / your endpoint
      if (S.cfg && S.cfg.lead_url) {
        const body = new URLSearchParams(Object.entries(payload)).toString();
        // fire-and-forget
        fetch(S.cfg.lead_url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }).catch(()=>{});
        // attempt proper POST too
        try {
          await fetch(S.cfg.lead_url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
        } catch (_) {}
      }
    } catch (e) {
      addAI("Nepodařilo se uložit kontakt. Zkuste to prosím znovu.");
      if (btn) { btn.disabled = false; btn.textContent = "Odeslat a zobrazit odhad"; }
      return;
    }

    if (btn) { btn.disabled = false; btn.textContent = "Odesláno"; }

    // After lead saved → compute and show estimate
    const P = S.tempPricing || {};
    let res = null;
    if (P.typ === "Byt")       res = window.CG_Estimator.estimateByt(window.PRICES ? window.PRICES.byty : null, P);
    else if (P.typ === "Dům")  res = window.CG_Estimator.estimateDum(window.PRICES ? window.PRICES.domy : null, P);
    else                       res = window.CG_Estimator.estimatePozemek(window.PRICES ? window.PRICES.pozemky : null, P);

    renderEstimate(res, P.typ || "Nemovitost");
  }

  function renderEstimate(res, typ) {
    const box = U.el("div", { class: "cg-step" }, [
      U.el("label", {}, [`${typ}: předběžný odhad`]),
      U.el("div", {}, [`Rozpětí: ${res.low?.toLocaleString?.("cs-CZ") || "-"} – ${res.high?.toLocaleString?.("cs-CZ") || "-" } Kč`]),
      U.el("div", {}, [`Orientační cena za m²: ${res.per_m2 || "-"} Kč/m²`]),
      U.el("div", { class: "hint" }, [res.note || "Odhad je orientační."]),
      U.el("div", { class: "cg-cta" }, [
        U.el("button", { class: "cg-btn", type: "button", onclick: () => addAI("Děkujeme, kolegové se vám ozvou s přesným odhadem.") }, ["Přesný odhad zdarma"]),
      ]),
    ]);
    addAI("Výsledek odhadu", box);
  }

  // -----------------------------
  // Intent routing (text → pricing)
  // -----------------------------
  function needPricing(q) {
    const s = U.norm(q);
    return /(nacenit|naceněn|ocenit|oceněn|odhad(\s*ceny)?|cena\s+nemovitosti|spočítat\s*cenu|kolik\s+to\s*stojí)/i.test(s);
  }

  async function ask(q) {
    if (!q) return;
    addME(q);

    // 0) Pricing intent
    if (needPricing(q)) { startPricing(); return; }

    // fallback – your assistant
    addAI("Rozumím. Ptejte se na cokoliv k nemovitostem, ISNS, územnímu plánu apod.");
  }

  // -----------------------------
  // Data/Config preload (optional)
  // -----------------------------
  (async () => {
    try {
      const scriptEl = document.currentScript || document.querySelector('script[data-config]');
      const CFG_URL = scriptEl ? scriptEl.getAttribute("data-config") : null;
      if (CFG_URL) {
        S.cfg = await U.fetchJson(CFG_URL);
      } else {
        S.cfg = S.cfg || {};
      }
      // Preload prices if URLs exist (optional)
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

  // -----------------------------
  // Init (safe-start + Mapy loader)
  // -----------------------------
  function cgSafeStart() {
    try {
      if (!messages) return setTimeout(cgSafeStart, 40);
      renderStart();
    } catch (e) {
      setTimeout(cgSafeStart, 40);
    }
  }
  // Load Mapy early (does nothing if key missing)
  loadMapy((S.cfg && S.cfg.mapy_key) || "EreCyrH41se5wkNErc5JEWX2eMLqnpja5BUVxsvpqzM");
  cgSafeStart();

  // Input handlers
  send.addEventListener("click", () => {
    const q = ta.value.trim();
    ta.value = "";
    ask(q);
  });
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send.click();
    }
  });
})();
