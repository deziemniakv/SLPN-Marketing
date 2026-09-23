# Discord bot o Organizacji Nagrywek i Zarządzanie Marketingiem + Moderacja oraz 4FUN CMD

Bot Discord napisany w [discord.js](https://discord.js.org/) v14 + [Mongoose](https://mongoosejs.com/) (MongoDB), łączący dwa główne systemy:

- 🎬 **System nagrywek** - planowanie, zapisy, automatyczne wykrywanie obecności na kanale głosowym, statystyki i frekwencja.
- 🏢 **System zarządzania działem Marketingu** - role (dział/ranga), miesięczne wypłaty liczone automatycznie z aktywności, raporty analityczne z akceptacją, cele miesięczne, notatki, panel administracyjny z przyciskami.

Poza tym bot ma też podstawowy system ticketów, powitania/pożegnania nowych członków oraz kilka komend moderacyjnych i mini-gier.

---

## Spis treści

- [Wymagania](#wymagania)
- [Instalacja](#instalacja)
- [Konfiguracja](#konfiguracja)
- [Komendy](#komendy)
- [Jak liczone są wypłaty Marketingu](#jak-liczone-są-wypłaty-marketingu)
- [Struktura projektu](#struktura-projektu)
- [Bezpieczeństwo](#bezpieczeństwo)

---

## Wymagania

- **Node.js** 18 lub nowszy
- **MongoDB** (lokalnie albo np. [MongoDB Atlas](https://www.mongodb.com/atlas))
- Aplikacja bota Discord z tokenem (patrz [Discord Developer Portal](https://discord.com/developers/applications)) oraz włączonymi **Privileged Gateway Intents**: `SERVER MEMBERS INTENT` i `MESSAGE CONTENT INTENT` (jeśli używane przez pozostałe funkcje bota) oraz `GUILDS`, `GUILD_VOICE_STATES` (wymagane przez system nagrywek).

## Instalacja

```bash
git clone https://github.com/deziemniakv/SLPN-Marketing.git
cd SLPN-Marketing
npm install
```

Skopiuj szablon zmiennych środowiskowych i uzupełnij go swoimi danymi:

```bash
cp .env.example .env
```

```env
# .env
DISCORD_TOKEN=twój_token_bota
MONGO_URI=twój_connection_string_do_mongodb
```

Uruchomienie:

```bash
npm start        # produkcyjnie
npm run dev       # z automatycznym restartem (nodemon)
```

## Konfiguracja

Reszta ustawień (ID ról, kanałów, itd. - nic wrażliwego) siedzi w `src/config.json`. Ten plik **trzeba** dostosować do własnego serwera przed pierwszym uruchomieniem.

### `nagrywki`
| Klucz | Opis |
|---|---|
| `organizerRole`, `staffRole`, `adminRole` | Role uprawnione do zarządzania nagrywkami |
| `checkIntervalMs` | Jak często bot sprawdza, czy któraś nagrywka powinna wystartować/zakończyć się |
| `autoJoinVoiceChannel` | Czy bot ma sam dołączać na kanał głosowy nagrywki |

### `marketing`
| Klucz | Opis |
|---|---|
| `adminRole` | Rola Dyrektora Marketingu - dostęp do wszystkich komend administracyjnych działu |
| `directorId` | ID użytkownika Discord, na którego DM leci raport wypłat, jeśli `reminderChannelId` jest puste |
| `roles.dzial.*`, `roles.ranga.*` | ID ról Discord nadawanych automatycznie przez `/dzial` i `/ranga` (można zostawić puste, jeśli rola jeszcze nie istnieje) |
| `reportsChannelId` | Kanał, na który trafiają zgłoszenia z `/raport-analizy` (embed + przycisk akceptacji) |
| `reminderChannelId`, `reminderDaysBefore`, `reminderCheckIntervalMs` | Automatyczne przypomnienie o zbliżającym się końcu miesiąca (trzeba wygenerować raport wypłat) |

### `tickets`, `welcome`
Standardowa konfiguracja systemu ticketów (role, kategorie kanałów) oraz wiadomości powitalnych/pożegnalnych (kanał, treść, kolor embeda).

## Komendy

### 🎬 Nagrywki
| Komenda | Opis |
|---|---|
| `/nagrywki` | Tworzy nowe wydarzenie nagrywki z zapisami |
| `/zakoncz` | Kończy trwającą nagrywkę |
| `/statystyki-nagrywki` | Ranking obecności na nagrywkach |

### 🏢 Marketing - dla wszystkich pracowników
| Komenda | Opis |
|---|---|
| `/statystyki [pracownik]` | Własne statystyki (dział, ranga, aktywność, podgląd wypłaty); z podanym `pracownik` - tylko dla Dyrektora |
| `/raport-analizy` | Analityk zgłasza pomysł na materiał (tytuł, opis, muzyka, link inspiracyjny) do akceptacji Dyrektora |

### 🏢 Marketing - tylko dla Dyrektora (`marketing.adminRole`)
| Komenda | Opis |
|---|---|
| `/dzial`, `/ranga` | Przypisuje dział / rangę pracownikowi (synchronizuje też role Discord) |
| `/lista` | Lista pracowników wg działu i/lub rangi |
| `/panel-marketing` | Panel z podsumowaniem działu + przyciski do zarządzania pracownikami, generowania raportu, historii i celów |
| `/frekwencja` | Wyszukiwarka frekwencji pracownika (nagrywki dla Nagrywających/Aktorów, raporty dla Analityków) |
| `/raport-wyplat` | Generuje i wysyła miesięczny raport wypłat na DM |
| `/historia-wyplat` | Historia wcześniej wygenerowanych raportów |
| `/dodaj-wyplate`, `/usun-wyplate` | Ręczna korekta (bonus/potrącenie) wypłaty pracownika |
| `/refresh` | Resetuje dział, rangę i nierozliczone korekty/zgłoszenia pracownika |
| `/notatka` | Wewnętrzne notatki o pracownikach (dodaj / pokaż / usuń) |
| `/cel-miesieczny` | Ustawia i pokazuje cele miesięczne działu |
| `/ogloszenie` | Wysyła ogłoszenie na wybrany kanał |

### 🎫 Tickety, powitania, moderacja, inne
`/createticketpanel`, `/ban`, `/kick`, `/timeout`, `/ping`, `/serverinfo`, `/userinfo`, `/kolko-krzyzyk`, `/rps`, `/wordle` - standardowe funkcje pomocnicze i mini-gry.

## Jak liczone są wypłaty Marketingu

Rozliczenie jest **miesięczne** (kalendarzowo, czas Europe/Warsaw), nie za pojedynczą nagrywkę.

1. **Stawka bazowa** zależy od działu i rangi pracownika (np. Senior Nagrywający = 350 BC/miesiąc bazowo).
2. **Mnożnik aktywności** w danym miesiącu: 1 aktywność = ×1.0, 2 = ×1.1, 3 i więcej = ×1.2.
   - Dla Nagrywających/Aktorów aktywność = liczba nagrywek, na których faktycznie byli obecni (wykrywane automatycznie po wejściu na kanał głosowy).
   - Dla Analityków aktywność = liczba **zaakceptowanych** przez Dyrektora zgłoszeń z `/raport-analizy` - Analitycy nigdy nie są rozliczani z obecności na nagrywkach, nawet jeśli technicznie na taką weszli.
3. Wynik jest ograniczony twardym limitem **350 BC/miesiąc**.
4. Do tak wyliczonej kwoty dolicza się ewentualne ręczne korekty (`/dodaj-wyplate`, `/usun-wyplate`) - te nie są objęte limitem 350 BC, bo to świadoma decyzja Dyrektora.
5. `/raport-wyplat` generuje jeden raport na miesiąc (nie da się wygenerować drugi raz dla tego samego okresu) i wysyła go w formacie `ID DISCORD - NICK DISCORD - ILOŚĆ BC` na DM Dyrektora. Bot **nie wypłaca** nic automatycznie — to tylko gotowa lista do ręcznego przekazania HR/Zarządowi.

## Struktura projektu

```
src/
├── index.js              # punkt wejścia, ładowanie configu i modułów
├── config.json            # konfiguracja (role, kanały) - bez sekretów
├── commands/               # wszystkie slash-komendy
├── buttons/                 # obsługa przycisków (tickety, nagrywki, akceptacja raportów)
├── events/                   # eventy discord.js (ready, interactionCreate, voiceStateUpdate, ...)
├── handlers/                  # ładowanie komend/eventów/przycisków, sprawdzanie uprawnień
├── models/                     # schematy Mongoose (MarketingEmployee, NagrywkiEvent, PayrollReport, ...)
├── modules/                     # główna logika biznesowa (MarketingManager, NagrywkiManager, ...)
└── utils/                        # pomocnicze funkcje (np. liczenie granic miesiąca)
scripts/
└── migrate-pomyslodawca-to-analityk.js   # jednorazowa migracja starych danych
```

## Bezpieczeństwo

- Token bota i connection string do MongoDB żyją **wyłącznie** w `.env`, nigdy w `config.json` ani w kodzie.
- Panel Marketingu i wszystkie przyciski/selecty (`mk_*`) same weryfikują rolę Dyrektora przy każdym kliknięciu - nie tylko przy wywołaniu komendy - bo wiadomości z przyciskami zostają na kanale i mogą być widoczne dla innych.

## Licencja

ISC (patrz `package.json`).
