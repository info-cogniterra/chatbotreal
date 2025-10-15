
/*! cogniterra-widget-safe.v6.js (conversation memory build) */
(function () {
  // Config must be provided by the page:
  // window.COGNITERRA_WIDGET_CONFIG = { chat_url, secret, model?, temperature? }
  var CFG = (typeof window !== 'undefined' && window.COGNITERRA_WIDGET_CONFIG) ? window.COGNITERRA_WIDGET_CONFIG : null;
  if (!CFG || !CFG.chat_url || !CFG.secret) {
    console.error('[Cogniterra] Missing COGNITERRA_WIDGET_CONFIG.chat_url or secret');
  }

  // Full conversation history. We do not persist over reloads by design.
  var HISTORY = [];

  // Internal: POST form-urlencoded without triggering preflight
  function postForm(url, data) {
    var body = new URLSearchParams();
    Object.keys(data).forEach(function (k) {
      var v = data[k];
      if (v === undefined || v === null) return;
      body.append(k, (typeof v === 'object') ? JSON.stringify(v) : String(v));
    });
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return fetch(url + sep + 'path=chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    }).then(function (r) { return r.json(); });
  }

  // Public: send one user message; we keep full history and send it every time.
  async function sendChatMessage(message) {
    try {
      var msg = (message || '').trim();
      if (!msg) {
        return { ok: false, error: 'Empty message' };
      }

      // Push user message into history
      HISTORY.push({ role: 'user', content: msg });

      // Build payload
      var payload = {
        secret: CFG && CFG.secret,
        model: (CFG && CFG.model) ? CFG.model : 'gpt-4o-mini',
        temperature: (CFG && typeof CFG.temperature === 'number') ? CFG.temperature : 0.3,
        max_tokens: (CFG && typeof CFG.max_tokens === 'number') ? CFG.max_tokens : undefined,
        messages: HISTORY
      };

      var res = await postForm(CFG.chat_url, payload);

      if (!res || !res.ok || !res.answer) {
        var errText = (res && res.error) ? String(res.error) : 'Unknown error';
        // Keep assistant noop so the next turn still contains previous context
        return { ok: false, error: errText };
      }

      // Append assistant message to history so next turn has full context
      HISTORY.push({ role: 'assistant', content: res.answer });

      return { ok: true, answer: res.answer, usage: res.usage || null };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  }

  // Optional: allow clearing the memory (in case UI wants to start fresh)
  function resetConversation() {
    HISTORY.length = 0;
  }

  // Expose public API (non-breaking)
  if (!window.COGNITERRA_WIDGET_API) window.COGNITERRA_WIDGET_API = {};
  window.COGNITERRA_WIDGET_API.sendChatMessage = sendChatMessage;
  window.COGNITERRA_WIDGET_API.resetConversation = resetConversation;

  // Backward-compat global (if UI calls sendChatMessage(...) directly)
  window.sendChatMessage = sendChatMessage;
  window.resetCogniterraChat = resetConversation;

  // Debug helper
  // console.debug('[Cogniterra] widget loaded with memory. History turns:', HISTORY.length);
})();
