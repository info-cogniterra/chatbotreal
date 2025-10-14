README_FINAL — 2025-10-14T19:12:43.985532Z

Co je hotovo
- Live chat (AI) + detekce zájmu o kontakt → 3 políčka (jméno, e-mail, telefon).
- Odeslání na /lead jako text/plain (CORS-safe), payload obsahuje branch:'chat' → na backendu může jít do listu "Chatbot leads".
- Konfigurace v data/v1/widget_config.json (ponechal jsem vaše URLs a secret).

Nasazení
1) Nahrajte obsah ZIPu do GitHub repozitáře (Upload files → drag&drop).
2) Otevřete GitHub Pages URL a dejte tvrdý refresh (Ctrl/Cmd+F5).
3) Klikněte na 💬 → napište dotaz → AI odpoví. Napište 'kontaktujte mě' → zobrazí se formulář, odešlete → záznam v listu "Chatbot leads".

Poznámka
- Pokud Apps Script ještě nesměruje na list "Chatbot leads", v doPost(e) zvolte podle body.branch.
