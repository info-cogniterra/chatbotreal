README — LIVE CHAT ("Potřebuji pomoc") — 2025-10-14T16:57:05.918570Z

• Tlačítko „Potřebuji pomoc“ spouští živý chat. První zpráva bota: „S čím vám mohu pomoci?“
• AI zná Cogniterru (KB), umí dohledat odkaz na ÚP (pokud je v up.v1.json) a vybírá jen vaše/poskytnuté odkazy.
• Kontakt je nepovinný – chatbot ho nabídne jen při zájmu uživatele.

Nasazení
1) Nahrajte obsah ZIPu do GitHub repozitáře a publikujte přes GitHub Pages.
2) Otevřete stránku a dejte tvrdý refresh (Ctrl/Cmd+F5).
3) Ptejte se v chatu – odpovědi přijdou přes Apps Script /chat.

Konfigurace
• data/v1/widget_config.json obsahuje vaše lead_url, chat_url, secret a odkazy na data (včetně kb).

Rozšíření znalostí
• Přidejte/změňte položky v data/v1/kb.v1.json – okamžitě se projeví.
• Pokud chcete přesnější ÚP odkazy, rozšiřte data/v1/up.v1.json.
