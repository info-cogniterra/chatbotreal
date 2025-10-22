# Cogniterra Chatbot Widget

[![Deploy to Active24](https://github.com/info-cogniterra/chatbotreal/actions/workflows/deploy-to-active24.yml/badge.svg)](https://github.com/info-cogniterra/chatbotreal/actions/workflows/deploy-to-active24.yml)

Chatbot widget pro realitní služby Cogniterra. Widget poskytuje automatizované ocenění nemovitostí a asistenci zákazníkům.

## 📋 Obsah

- [Struktura projektu](#struktura-projektu)
- [Automatické nasazení](#automatické-nasazení)
- [Nastavení GitHub Secrets](#nastavení-github-secrets)
- [Manuální nasazení](#manuální-nasazení)
- [Vývoj](#vývoj)
- [Odkazy](#odkazy)

## 📁 Struktura projektu

```
chatbotreal/
├── index.html                        # Hlavní HTML stránka
├── embed.js                          # Skript pro vložení widgetu
├── estimator.v2.js                   # Estimační funkce
├── cogniterra-widget-safe.v7.js      # Hlavní widget logika
├── styles.css                        # CSS styly
├── data/                             # Data konfigurace
│   └── v1/
│       ├── widget_config.json        # Konfigurace widgetu
│       ├── byty.v1.json              # Data pro byty
│       ├── domy.v1.json              # Data pro domy
│       ├── pozemky.v1.json           # Data pro pozemky
│       └── up.v1.json                # Data pro úřední postupy
├── assets/                           # Statické assety
│   ├── avatar.png
│   ├── brand-icon.png
│   └── fox-avatar.png
└── .github/
    └── workflows/
        └── deploy-to-active24.yml    # CI/CD workflow
```

## 🚀 Automatické nasazení

Projekt používá GitHub Actions pro automatické nasazení na Active24 hosting.

### Kdy dochází k nasazení

- **Automaticky**: Při každém push do `main` větve
- **Manuálně**: Přes GitHub Actions záložku (workflow_dispatch)

### Proces nasazení

1. ✅ Kontrola všech povinných souborů
2. 🔍 Validace HTML a JavaScript syntaxe
3. 📦 Příprava souborů k nasazení
4. 🚀 Nahrání na Active24 FTP server
5. ✅ Oznámení o úspěchu/selhání

### Co se nasazuje

Workflow automaticky nahraje:
- ✅ `index.html`
- ✅ `embed.js`
- ✅ `estimator.v2.js`
- ✅ `cogniterra-widget-safe.v7.js`
- ✅ `styles.css`
- ✅ `data/` složku s konfigurací
- ✅ `assets/` složku s obrázky

### Co se **NE**nasazuje

Workflow automaticky vyloučí:
- ❌ `.git` a `.github` adresáře
- ❌ `node_modules/`
- ❌ `README.md` a ostatní `.md` soubory
- ❌ `package.json` a `package-lock.json`
- ❌ `.gitignore`

## 🔐 Nastavení GitHub Secrets

Pro fungování automatického nasazení je nutné nastavit následující secrets v GitHub repository.

### Postup nastavení:

1. Přejděte do GitHub repository: `https://github.com/info-cogniterra/chatbotreal`
2. Klikněte na **Settings** → **Secrets and variables** → **Actions**
3. Klikněte na **New repository secret**
4. Přidejte následující secrets:

### Požadované Secrets

| Secret Name | Popis | Příklad |
|------------|-------|---------|
| `ACTIVE24_FTP_HOST` | FTP server Active24 | `ftp.vasedomena.cz` |
| `ACTIVE24_FTP_USERNAME` | FTP uživatelské jméno | `vasejmeno@vasedomena.cz` |
| `ACTIVE24_FTP_PASSWORD` | FTP heslo | `vase_bezpecne_heslo` |

### Získání FTP údajů z Active24

1. Přihlaste se do [Active24 administrace](https://admin.active24.cz/)
2. Přejděte na **Hosting** → **FTP účty**
3. Zkopírujte FTP server, uživatelské jméno a heslo
4. Poznamenejte si cestu k adresáři (standardně `/public_html/chatbot/`)

### Ověření nastavení

Po nastavení secrets můžete workflow spustit manuálně:

1. Přejděte na **Actions** → **Deploy to Active24**
2. Klikněte na **Run workflow**
3. Vyberte větev `main`
4. Klikněte na **Run workflow**

## 🛠️ Manuální nasazení

Pokud potřebujete nasadit manuálně (bez GitHub Actions):

### 1. Pomocí FTP klienta

```bash
# Připojte se k FTP serveru
ftp ftp.vasedomena.cz

# Přihlaste se (username a password)

# Přejděte do správného adresáře
cd /public_html/chatbot/

# Nahrajte soubory
put index.html
put embed.js
put estimator.v2.js
put cogniterra-widget-safe.v7.js
put styles.css

# Nahrajte složky
mput data/*
mput assets/*
```

### 2. Pomocí LFTP (Linux/Mac)

```bash
lftp -u username,password ftp.vasedomena.cz << EOF
mirror -R --exclude .git/ --exclude .github/ --exclude node_modules/ ./ /public_html/chatbot/
bye
EOF
```

### 3. Pomocí FileZilla

1. Stáhněte [FileZilla](https://filezilla-project.org/)
2. Připojte se k FTP serveru
3. Přetáhněte soubory do `/public_html/chatbot/`

## 💻 Vývoj

### Lokální testování

```bash
# Spusťte lokální HTTP server
python3 -m http.server 8000

# Nebo s Node.js
npx http-server -p 8000

# Otevřete v prohlížeči
open http://localhost:8000
```

### Úprava konfigurace

Widget lze konfigurovat v souboru `data/v1/widget_config.json`:

```json
{
  "apiEndpoint": "https://api.cogniterra.cz",
  "brandColors": {
    "primary": "#D4AF37",
    "secondary": "#1F6A3A"
  },
  "features": {
    "estimator": true,
    "chat": true
  }
}
```

### Testování před nasazením

```bash
# Kontrola HTML syntaxe
grep -q "<!DOCTYPE html>" index.html && echo "✅ HTML OK"

# Kontrola JavaScript (vyžaduje Node.js)
node -c embed.js && echo "✅ embed.js OK"
node -c estimator.v2.js && echo "✅ estimator.v2.js OK"
node -c cogniterra-widget-safe.v7.js && echo "✅ widget OK"
```

## 📊 Monitoring nasazení

### GitHub Actions

Stav nasazení můžete sledovat v záložce **Actions**:
- 🟢 Zelená = Úspěšné nasazení
- 🔴 Červená = Neúspěšné nasazení
- 🟡 Žlutá = Probíhající nasazení

### Workflow badge

Status badge v README.md ukazuje aktuální stav posledního nasazení:

[![Deploy to Active24](https://github.com/info-cogniterra/chatbotreal/actions/workflows/deploy-to-active24.yml/badge.svg)](https://github.com/info-cogniterra/chatbotreal/actions/workflows/deploy-to-active24.yml)

## 🐛 Řešení problémů

### Nasazení selhává

**❌ Chyba: "FTP connection failed"**
- Zkontrolujte FTP credentials v GitHub Secrets
- Ověřte, že FTP server je správně nakonfigurován
- Zkuste připojení manuálně pomocí FTP klienta

**❌ Chyba: "Directory not found"**
- Ověřte, že cesta `/public_html/chatbot/` existuje na serveru
- Vytvořte adresář ručně přes FTP klienta

**❌ Chyba: "Missing required files"**
- Ujistěte se, že všechny povinné soubory existují v repository
- Zkontrolujte, že nejsou vyloučeny v `.gitignore`

### Widget se nenačítá

**❌ Widget se nezobrazuje na stránce**
1. Otevřete Developer Console (F12)
2. Zkontrolujte chyby v konzoli
3. Ověřte, že všechny soubory jsou správně nahrané
4. Zkontrolujte cesty k souborům v `index.html`

**❌ Chyba: "Failed to load widget_config.json"**
- Zkontrolujte, že `data/v1/widget_config.json` existuje
- Ověřte JSON syntaxi v konfiguračním souboru

## 🔗 Odkazy

### Dokumentace

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [FTP-Deploy-Action](https://github.com/SamKirkland/FTP-Deploy-Action)
- [Active24 Dokumentace](https://www.active24.cz/dokumentace/)

### Cogniterra

- [Webové stránky](https://cogniterra.cz)
- [Kontakt](https://cogniterra.cz/kontakt/)

### Podpora

Pro technickou podporu kontaktujte:
- 📧 Email: info@cogniterra.cz
- 📞 Telefon: +420 000 000 000

## 📝 Licence

© 2025 Cogniterra Group, s.r.o. Všechna práva vyhrazena.

---

**Poslední aktualizace:** 2025-10-22
