# Cogniterra Chatbot – fixed v7

Co je opraveno:
- **Host element** pro bubble-only build se nyní vytváří automaticky v `embed.js` (garance, že se widget spustí).
- **widget_config.json** používá lokální datové soubory (`./data/v1/*.json`) a kompletní Apps Script URL (lead/chat).

Jak spustit lokálně:
1. Otevřete `index.html` v prohlížeči nebo spusťte jednoduchý HTTP server (např. `python -m http.server`).
2. Klikněte na tlačítko 💬 vpravo dole. Panel se otevře a načte widget.

Nasazení:
- Vložte obsah složky `chatbotreal-main/` na web. `embed.js` lze vložit přes GTM i přímo – vytváří si UI i host prvek sám.
