# Návrh nástroje pro měření pracovního času na macOS

**Pracovní název:** WorkPulse
**Platforma:** macOS 13+ (Ventura a novější)
**Účel:** Automaticky změřit, kolik času zaměstnanec skutečně pracuje na počítači, bez ručního „píchání" příchodu/odchodu. Měření vychází z aktivity na počítači a umí odlišit soukromé činnosti od firemních. Firemní práce probíhá zejména v Gmail účtu a ve firemním ERP.

> **Důležité upozornění hned na začátku:** Sledování zaměstnanců je v ČR/EU právně regulováno (Zákoník práce § 316, GDPR). Nástroj je proto navržen jako **transparentní a minimalizující data** – neměří obsah, jen kategorii a dobu aktivity, zaměstnanec vidí svá data a má tlačítko „soukromí". Bez splnění právních podmínek (viz kap. 8) nesmí být nasazen. Skrytý/utajený monitoring tento návrh vědomě nepodporuje.

---

## 1. Cíl a principy

### Co má nástroj umět
- Zjistit **odpracovaný čas** z reálné aktivity, ne z přihlášení/odhlášení.
- **Odlišit firemní práci od soukromí** – firemní = Gmail (pracovní účet) + firemní ERP, soukromé = vše ostatní.
- Rozpoznat, kdy je uživatel u počítače **aktivní** vs. **nečinný** (idle) nebo pryč.
- Poskytnout **souhrnné reporty** pro firmu a **přehled vlastních dat** pro zaměstnance.

### Návrhové principy
1. **Datová minimalizace** – ukládá se jen *kategorie* (firemní / soukromé / nečinnost) a *doba*. Nikdy ne obsah e-mailů, texty, stisky kláves ani snímky obrazovky.
2. **Transparentnost** – ikona v menu baru je vždy viditelná a ukazuje aktuální stav. Skryté sledování se nekoná.
3. **Kontrola zaměstnance** – jedním klikem „Pauza soukromí" úplně zastaví měření (např. při soukromém vyřizování během přestávky).
4. **Lokální zpracování** – klasifikace probíhá na zařízení; na server jde jen agregát, ne surová data.
5. **Proporcionalita** – měří se jen to, co je nutné k účelu (evidence pracovní doby), nic navíc.

---

## 2. Architektura

```
┌──────────────────────────── macOS zařízení zaměstnance ────────────────────────────┐
│                                                                                     │
│   ┌───────────────┐   události   ┌────────────────┐  kategorie+čas ┌─────────────┐  │
│   │  Activity      │ ───────────▶ │ Klasifikační   │ ─────────────▶ │  Lokální    │  │
│   │  Sensor        │              │  engine        │                │  úložiště   │  │
│   │ (sběr signálů) │              │ (pravidla)     │                │ (SQLite)    │  │
│   └───────────────┘              └────────────────┘                └──────┬──────┘  │
│         ▲                                                                  │         │
│         │ NSWorkspace / AX API / idle timer                    agregace (5–15 min)   │
│         │                                                                  │         │
│   ┌─────┴──────────┐          ┌─────────────────────┐                     ▼         │
│   │ Menu bar UI    │          │  „Pauza soukromí"   │              ┌─────────────┐  │
│   │ (stav, přehled)│◀────────▶│  toggle             │              │  Uploader   │  │
│   └────────────────┘          └─────────────────────┘              │ (HTTPS)     │  │
│                                                                     └──────┬──────┘  │
└────────────────────────────────────────────────────────────────────────── │ ───────┘
                                                                             ▼
                                                        ┌────────────────────────────┐
                                                        │  Backend + Dashboard        │
                                                        │  (reporty pro firmu,        │
                                                        │   self-service pro zaměst.) │
                                                        └────────────────────────────┘
```

### Komponenty
- **Menu bar agent (Swift/SwiftUI)** – běží jako `LaunchAgent` po přihlášení uživatele, žádné okno, jen ikona v liště.
- **Activity Sensor** – odečítá signály z macOS API (viz kap. 4).
- **Klasifikační engine** – přiřadí každému časovému úseku kategorii podle pravidel (kap. 5).
- **Lokální úložiště** – SQLite s agregovanými intervaly; surové signály se drží jen krátce v paměti a nezapisují se.
- **Uploader** – periodicky posílá agregát na backend přes HTTPS (mTLS/OAuth).
- **Backend + Dashboard** – uchovává agregáty, generuje reporty, poskytuje zaměstnanci náhled na jeho data.

---

## 3. Datový model (co se skutečně ukládá)

Základní jednotka je **interval aktivity** – ne jednotlivá událost, ale agregovaný úsek:

```jsonc
{
  "employee_id": "u-4821",          // pseudonymizované ID, ne jméno
  "start": "2026-07-26T09:00:00Z",
  "end":   "2026-07-26T09:15:00Z",
  "category": "work_erp",           // work_gmail | work_erp | private | idle | paused
  "active_seconds": 780,            // reálně aktivní čas v intervalu (bez idle)
  "app_bundle": "com.google.Chrome" // volitelné, jen technická kategorie, ne obsah
}
```

Co se **NEukládá:** názvy oken (jen se v paměti použijí ke klasifikaci a zahodí), URL cesty, texty e-mailů, obsah ERP záznamů, stisky kláves, snímky obrazovky. Ukládá se pouze **doména/aplikace na úrovni kategorie** a **doba**.

---

## 4. Sběr signálů (Activity Sensor)

Nástroj měří aktivitu z veřejných macOS API, bez keyloggeru a bez čtení obsahu.

| Signál | Zdroj / API | K čemu slouží |
|---|---|---|
| Aktivní aplikace (frontmost) | `NSWorkspace.shared.frontmostApplication`, notifikace `didActivateApplicationNotification` | Zjistit, jaká appka je právě používaná |
| Doména aktivní karty v prohlížeči | Accessibility API (`AXUIElement`) čtoucí pole URL, nebo AppleScript most u Chrome/Safari | Odlišit Gmail/ERP od ostatního webu – **čte se jen doména a účet, ne cesta ani obsah** |
| Nečinnost (idle) | `CGEventSource.secondsSinceLastEventType(.hidSystemState, .anyInputEventType)` | Rozpoznat, že uživatel neťuká/nehýbe myší → nezapočítat |
| Zamčená obrazovka / spánek | `NSWorkspace` notifikace `screensDidSleep`, `sessionDidResignActive` | Ukončit počítání aktivního času |
| Stav „Pauza soukromí" | Vlastní toggle v UI | Úplně pozastavit sběr |

**Idle logika:** aktivní čas se počítá jen když od poslední interakce uplynulo méně než **N sekund** (výchozí 300 s / 5 min, konfigurovatelné). Po překročení se úsek značí `idle` a do odpracovaného času se nezapočítá. Vzorkuje se např. každých 10–15 s.

### Potřebná oprávnění (macOS TCC)
- **Accessibility** – nutné pro čtení URL/domény aktivní karty. Uživatel ho uděluje explicitně v Nastavení → Soukromí a zabezpečení. Bez něj funguje jen klasifikace podle aplikace (hrubší).
- Žádné oprávnění ke **Screen Recording** (nechceme snímky) ani ke **vstupu z klávesnice** (nechceme keylog).

---

## 5. Klasifikace: firemní vs. soukromé

Jádro problému je odlišit firemní práci od soukromí. Firemní práce = **pracovní Gmail účet** + **firemní ERP**.

### 5.1 Pravidlová tabulka (konfiguruje firma)

```jsonc
{
  "work_domains": [
    { "match": "erp.firma.cz",        "category": "work_erp" },
    { "match": "erp-app.firma.cz",    "category": "work_erp" },
    { "match": "mail.google.com",     "category": "work_gmail",
      "account_constraint": "authuser=0" }   // viz 5.2
  ],
  "work_apps": [
    { "bundle": "cz.firma.ERPClient", "category": "work_erp" }  // nativní ERP klient, pokud existuje
  ],
  "default_category": "private"
}
```

Vše, co nespadá do `work_*` pravidel, je **soukromé** a nezapočítává se do odpracovaného času (ale eviduje se jako `private` pro celkový přehled u počítače).

### 5.2 Nejtěžší část – odlišit pracovní Gmail od soukromého Gmailu

Gmail běží na stejné doméně `mail.google.com` pro pracovní i soukromý účet, takže samotná doména nestačí. Tři varianty řešení (od nejrobustnější):

1. **Oddělený prohlížečový profil / doména Workspace (doporučeno).** Pokud firma používá Google Workspace, pracovní pošta má buď vlastní subdoménu (`mail.google.com/a/firma.cz`) nebo se dá vynutit dedikovaný Chrome profil pro práci. Klasifikace pak čte jen *který profil* je aktivní (skrz cestu profilu v okně), ne obsah.

2. **Index účtu v URL (`authuser` / `/u/0/`).** Gmail v multi-účtu adresuje účty jako `/mail/u/0/`, `/mail/u/1/`… Firma nastaví, který index je pracovní. Sensor čte **jen tento index z cesty**, nic víc. Slabina: pořadí účtů se může měnit, proto je varianta 1 spolehlivější.

3. **Ověření přihlášeného účtu přes doménu.** Přes Workspace API / SSO lze potvrdit, že aktivní účet patří do firemní domény. Vyžaduje integraci s Google Workspace a je nejnáročnější na nasazení.

**Doporučení:** nasadit variantu 1 (dedikovaný pracovní profil), s variantou 2 jako fallback. Tím se zároveň elegantně řeší soukromí – soukromý Gmail v jiném profilu je automaticky `private` a vůbec se neanalyzuje jeho obsah.

### 5.3 Stavový automat kategorií

```
             aktivní vstup (< idle limit)
   ┌──────────────────────────────────────────────┐
   │                                              ▼
[IDLE] ── vstup ──▶ [ACTIVE] ── frontmost app/doména ──▶ klasifikace ──▶ work_gmail
   ▲                   │                                              ├──▶ work_erp
   │  idle > N min      │  zámek/spánek                                └──▶ private
   └───────────────────┴──── [PAUSED] (uživatel zapnul Pauzu soukromí)
```

---

## 6. Uživatelské rozhraní (menu bar)

Ikona v liště je **vždy viditelná** – transparentnost je záměr, ne bug. Kliknutím se rozbalí:

```
● WorkPulse — Práce (ERP)
─────────────────────────────
Dnes odpracováno:   5 h 12 m
   • Gmail (práce):    1 h 40 m
   • ERP:              3 h 32 m
Soukromé/nečinnost:  1 h 05 m
─────────────────────────────
[ ⏸  Pauza soukromí (10 min) ]
[ 📊  Můj přehled…          ]
[ ⚙️  Nastavení a oprávnění ]
[ ℹ️  Co se měří a co ne…   ]
```

- Barva/tvar ikony indikuje stav: práce / soukromé / pauza / nečinnost.
- **„Pauza soukromí"** okamžitě zastaví měření na zvolený čas (nebo dokud se nevypne). Nic se během ní nesbírá.
- **„Můj přehled"** ukazuje zaměstnanci přesně ta data, která jdou zaměstnavateli – žádné skryté kategorie.
- **„Co se měří a co ne"** je otevřený popis rozsahu měření (transparency screen).

---

## 7. Backend a reporty

- **Přenos:** agregované intervaly přes HTTPS s mTLS nebo OAuth2; pseudonymizované `employee_id`, mapování na osobu drží odděleně HR se striktním přístupem.
- **Reporty pro firmu:** denní/týdenní odpracovaný čas, poměr Gmail vs. ERP, aktivní vs. nečinný čas – **agregovaně**, ne minutu po minutě jednotlivce, aby nešlo o mikromanagement obsahu.
- **Self-service pro zaměstnance:** stejná data o sobě, možnost exportu a žádosti o opravu/výmaz (práva subjektu údajů dle GDPR).
- **Retence:** např. 90 dní surových agregátů, pak jen měsíční souhrny; konfigurovatelné dle politiky firmy a zásady minimalizace.

---

## 8. Právní a etický rámec (nutná podmínka nasazení)

Toto **není** volitelný doplněk – bez toho se nástroj nesmí nasadit v ČR/EU:

1. **Zákoník práce § 316** – zaměstnavatel nesmí bez závažného důvodu narušovat soukromí a **musí zaměstnance předem informovat** o rozsahu a způsobu kontroly. Sledování musí být přiměřené.
2. **GDPR** – potřeba právního základu (zpravidla oprávněný zájem s testem proporcionality), **DPIA** (posouzení vlivu na ochranu údajů), transparentní informování, práva subjektů údajů.
3. **Přiměřenost a minimalizace** – proto návrh měří kategorii + čas, ne obsah; proto „Pauza soukromí"; proto lokální zpracování.
4. **Informování a souhlas procesně** – interní směrnice, informace pro zaměstnance, případně projednání s odbory/zástupci zaměstnanců.
5. **Bez skrytého sledování** – viditelná ikona a přehled dat jsou součástí designu; utajený režim by byl protiprávní i eticky nepřijatelný a tento nástroj ho nemá.

---

## 9. Technologie a fáze implementace

**Technologie:** Swift + SwiftUI (menu bar `MenuBarExtra`), `NSWorkspace`, Accessibility API, SQLite (GRDB), distribuce podepsaným `.pkg` přes MDM (Jamf/Kandji), backend libovolný (např. Node/Go + Postgres).

**Fáze:**
1. **PoC** – menu bar agent, detekce frontmost app + idle, klasifikace podle aplikace (bez URL). Lokální přehled.
2. **Rozšíření klasifikace** – čtení domény přes Accessibility API, rozlišení pracovního Gmail profilu a ERP.
3. **Backend + reporty + self-service**, retence, pseudonymizace.
4. **Compliance** – DPIA, směrnice, informování zaměstnanců, nasazení přes MDM.

---

## 10. Shrnutí

WorkPulse měří odpracovaný čas z reálné aktivity (frontmost aplikace, doména aktivní karty, idle detekce) místo ručního přihlašování. Firemní práci (pracovní Gmail účet + firemní ERP) odlišuje od soukromí pravidlovou klasifikací, přičemž klíčový problém „pracovní vs. soukromý Gmail" řeší dedikovaným pracovním profilem prohlížeče (fallback: index účtu v URL). Návrh je od základu postaven na **datové minimalizaci, transparentnosti a kontrole zaměstnance** a jeho nasazení je podmíněno splněním § 316 ZP a GDPR.
