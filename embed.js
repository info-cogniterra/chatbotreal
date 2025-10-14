
(function(){
  if(window.__cgtrEmbedLoaded) return; window.__cgtrEmbedLoaded = true;
  var cfgUrl = document.currentScript && document.currentScript.getAttribute('data-config');
  var widgetSrc = document.currentScript && document.currentScript.getAttribute('data-widget');
  if(!cfgUrl){ console.error('[Cogniterra] Missing data-config on embed script'); return; }
  if(!widgetSrc){ widgetSrc = 'https://info-cogniterra.github.io/chatbotreal/cogniterra-widget-safe.js'; }
  // Create launcher button
  var style = document.createElement('link'); style.rel='stylesheet'; style.href=(document.currentScript.getAttribute('data-styles')||'https://info-cogniterra.github.io/chatbotreal/styles.css');
  document.head.appendChild(style);
  var launcher = document.createElement('div'); launcher.id='cgtr-launcher'; launcher.title='Odhad ceny zdarma';
  launcher.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3C7 3 3 6.6 3 11c0 1.9.8 3.7 2.2 5.1L4 21l5.1-1.2c1.4.8 3 .2 2.9.2 5 0 9-3.6 9-8.1S17 3 12 3Z" stroke="white" stroke-width="1.5"/></svg>';
  document.body.appendChild(launcher);
  var panel = document.createElement('div'); panel.id='cgtr-panel';
  panel.innerHTML = '<div id="cgtr-shell-header"><div><span class="brand">Cogniterra</span> <span class="cta">Odhad ceny zdarma</span></div><div id="cgtr-close">✕</div></div><iframe id="cgtr-ifr" title="Cogniterra Chatbot"></iframe>';
  document.body.appendChild(panel);
  var open = false;
  function toggle(){ open=!open; panel.classList.toggle('open', open); }
  launcher.addEventListener('click', toggle);
  panel.querySelector('#cgtr-close').addEventListener('click', toggle);
  // Iframe loads minimal host that injects the actual widget script with config
  var blobHtml = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:transparent}</style></head>
  <body><div id="chatbot-container" style="height:100%"></div>
  <script src="${widgetSrc}" data-config="${cfgUrl}"></script></body></html>`;
  var blob = new Blob([blobHtml], {type:'text/html'});
  var url = URL.createObjectURL(blob);
  panel.querySelector('#cgtr-ifr').src = url;
})();