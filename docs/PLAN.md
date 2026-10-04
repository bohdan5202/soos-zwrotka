# Plan pracy: 14 h, 3 osoby

Co budujemy: [`PROJEKT.md`](PROJEKT.md). Ten plik dzieli pracę na zadania.

## Role

| Osoba | Rola | Odpowiada za |
|---|---|---|
| **A** | Program on-chain | Rust/Anchor: konta, instrukcje, testy LiteSVM |
| **B** | Frontend + deploy | Aplikacja web, portfel, skrypty (mint, airdrop), deploy na devnet |
| **C** | Pitch + demo + QA | Specyfikacja, design rationale, slajdy, wideo, README, testowanie flow, przygotowanie portfeli |

**Zasada:** w pierwszej godzinie zamrażamy interfejs programu (sekcja niżej). A od razu commituje program-zaślepkę z IDL, żeby B nie czekał na logikę.

## Kamienie milowe

Start 21:00, koniec 11:00 (14 h). Ok. 60% czasu na produkt, 40% na prezentację, wideo i demo.

| Godzina | Kamień milowy |
|---|---|
| 22:30 | IDL zaślepki w repo, frontend się buduje, `make test` działa u wszystkich |
| 02:30 | Logika programu + testy przechodzą, frontend na mockach |
| 03:30 | Program na devnecie, frontend podłączony |
| **06:00** | **Pełne demo end-to-end działa. Od tej chwili feature freeze: tylko poprawki** |
| 08:30 | Nagrane wideo, README gotowe |
| **10:00** | **Wszystko oddane** (godzina zapasu przed deadline 11:00) |

## Harmonogram

| Godziny | A (program) | B (frontend + deploy) | C (pitch + demo + QA) |
|---|---|---|---|
| 21:00–21:45 | Start: S1–S3 (wszyscy) | Start | Start |
| 21:45–22:30 | A1 zaślepka + IDL | B1 szkielet aplikacji, B2 skrypt mint | C1 design rationale |
| 22:30–01:00 | A2–A4 | B3–B4 ekrany na mockach | C2 slajdy: wersja robocza |
| 01:00–01:45 | A5 claim | B3–B4 | C3 scenariusz demo + odpowiedzi jury |
| 01:45–02:30 | A6 release, A7 testy | B3–B4 | C2 slajdy, diagram floor/rezerwa |
| 02:30–03:30 | A7 testy, A8 IDL | B5 deploy devnet | C4 portfele demo |
| 03:30–06:00 | Poprawki z QA | B6–B7 integracja | C5 QA całego flow |
| **06:00** | **Feature freeze** | | |
| 06:00–06:45 | README (C7 razem z C) | Przygotowanie stanu demo (z C) | Stan demo: portfele, SOL, tokeny, oferta |
| 06:45–07:00 | Przerwa | Przerwa | Przerwa |
| 07:00–08:30 | Pomoc przy wideo, poprawki | Obsługa demo podczas nagrania | C6 wideo |
| 08:30–09:15 | Slajdy: finalna wersja PDF (wszyscy) | | |
| 09:15–10:00 | Próba demo 2–3 razy na głos (wszyscy) | | C8 zgłoszenie |
| 10:00–11:00 | **Zapas** | | |

Posiłek ok. 00:00 i krótkie przerwy co ~3 h. Kto nie ma pilnej pracy (np. A między 03:30 a 06:00, jeśli QA nic nie znajdzie), może zrobić 30–45 min drzemki.

## Prezentacja i wideo

**Czas:** slajdy 2,5 h · scenariusz demo 45 min · wideo 1,5 h · README 30 min · próby 45 min · zgłoszenie 30 min.

**Slajdy (PDF, ≤10):**
1. Tytuł + jedno zdanie: „Kup teraz, nie stracisz na promocji”
2. Problem: kupujący czekają na promocje, sprzedawca nie wie, ile sprzeda
3. Kto dziś jest „sędzią”: Costco („reserves the right to deny”), Alaska i JetBlue wycofały gwarancje
4. Rozwiązanie: floor + rezerwa (diagram)
5. Demo (zrzuty ekranu jako zapas)
6. Gdzie znika pośrednik: `claim_difference` bez podpisu sprzedawcy
7. Dlaczego blockchain, a nie baza danych
8. Użytkownik docelowy i rynek: wydarzenia krypto → kursy → festiwale
9. Ograniczenia (otwarcie)
10. Co dalej + zespół

**Wideo (≤3 min, ~400 słów):** scenariusz 20 min · nagranie 30 min (OBS, 2–3 podejścia) · montaż i napisy 25 min · upload YouTube (niepubliczny) i sprawdzenie linku bez logowania 15 min.

| Czas | Treść |
|---|---|
| 0:00–0:30 | Problem: historia Ani („kupiła bilet, tydzień później było taniej”) |
| 0:30–1:00 | Rozwiązanie + diagram |
| 1:00–2:30 | Demo od początku do końca + transakcja w Explorerze |
| 2:30–3:00 | Dlaczego blockchain + co dalej |

**Demo na scenie:** jedna osoba klika, druga odpowiada na pytania. Przed wejściem: 3 profile przeglądarki z Phantom zalogowane, oferta już utworzona, Explorer otwarty w karcie. Nagranie wideo = backup.

**Trzy zasady:**
1. Po 06:00 tylko poprawki, żadnych nowych funkcji.
2. Wideo nagrywamy dopiero, gdy demo działa stabilnie.
3. Oddajemy do 10:00, nie w ostatnich minutach.

## Interfejs programu (zamrozić do 0:45)

Konta:
- `Offer` PDA `["offer", seller, offer_id]`: `seller`, `mint`, `offer_id: u64`, `price: u64`, `floor: u64` (niezmienny), `window_secs: i64`, `history: Vec<PricePoint>` (max 32), `bump`
- `PricePoint { ts: i64, price: u64 }`
- Vault: token account rezerwy, authority = PDA `Offer`
- `Purchase` PDA `["purchase", offer, buyer, idx]`: `buyer`, `offer`, `paid: u64`, `bought_at: i64`, `claimed: u64`, `bump`

Instrukcje:
| Instrukcja | Podpisuje | Argumenty |
|---|---|---|
| `create_offer` | sprzedawca | `offer_id, price, floor, window_secs` |
| `buy` | kupujący | `idx` |
| `set_price` | sprzedawca | `new_price` |
| `claim_difference` | kupujący (albo każdy, wypłata zawsze do kupującego) | — |
| `release` | każdy, po końcu okna | — |

Reguły (poprawki względem pierwszego szkicu w `PROJEKT.md`):
- `floor` jest niezmienny; `set_price` wymaga `new_price ≥ floor`.
- `set_price` przy pełnej historii (32 wpisy) zwraca błąd `HistoryFull`.
- **`release` najpierw wypłaca kupującemu należną różnicę** (`paid − min_cena_w_oknie − claimed`), dopiero resztę oddaje sprzedawcy. Inaczej sprzedawca mógłby wywołać `release` przed `claim` i zabrać zwrot.
- Należność liczona z historii: min ceny w `[bought_at, bought_at + window_secs]`, uwzględniając cenę obowiązującą w chwili zakupu.

Błędy: `FloorAbovePrice`, `PriceBelowFloor`, `HistoryFull`, `NothingToClaim`, `WindowNotEnded`, `Unauthorized`.

## Zadania

Format: `ID · kto · szacunek · zależy od`. „Gotowe” = kryterium ukończenia.

### Start (0:00–0:45, wszyscy)
- [ ] **S1** · wszyscy · 30 min · — `make check` i `make test` przechodzą u każdego. Gotowe: `1 passed`.
- [ ] **S2** · C · 20 min · — Poprawić `PROJEKT.md` zgodnie z regułami wyżej (release, floor, historia). Gotowe: commit w `main`.
- [ ] **S3** · A + B · 15 min · — Przegląd i akceptacja interfejsu wyżej. Gotowe: nikt go już nie zmienia bez informacji na czacie.

### A: program on-chain
- [ ] **A1** · 45 min · S3 — Zaślepka: usunąć licznik z szablonu, dodać `anchor-spl`, konta i wszystkie instrukcje zwracające `Ok(())`. Gotowe: `make build` przechodzi, IDL skopiowany do `app/src/idl/`.
- [ ] **A2** · 45 min · A1 — `create_offer` (walidacja `floor ≤ price`, init Offer + vault, pierwszy wpis historii).
- [ ] **A3** · 60 min · A2 — `buy`: transfer `floor` → sprzedawca, `price − floor` → vault, init `Purchase`.
- [ ] **A4** · 30 min · A2 — `set_price`: tylko sprzedawca, `≥ floor`, dopisuje do historii, limit 32.
- [ ] **A5** · 60 min · A3, A4 — `claim_difference`: liczenie min ceny w oknie, wypłata z vault (podpis PDA), aktualizacja `claimed`.
- [ ] **A6** · 45 min · A5 — `release`: po końcu okna najpierw należność kupującego, potem reszta sprzedawcy, zamknięcie `Purchase`.
- [ ] **A7** · 90 min · równolegle z A3–A6 — Testy LiteSVM: zakup; obniżka i claim; podwyżka nic nie zmienia; claim dwa razy przy dwóch obniżkach; release bez wcześniejszego claim (kupujący i tak dostaje różnicę); `set_price` poniżej floor i przez obcy portfel kończy się błędem. Gotowe: `make test` zielone.
- [ ] **A8** · 30 min · A7 — Przekazać B finalny IDL, opisać zmiany na czacie.

### B: frontend + deploy
- [ ] **B1** · 45 min · — Szkielet aplikacji w `app/` (Next.js / Vite + Wallet Adapter, Phantom, devnet). Gotowe: przycisk „Połącz portfel” działa.
- [ ] **B2** · 45 min · — Skrypt `scripts/setup-demo` : tworzy testowy mint („USDC”), daje tokeny 3 portfelom (organizator, Ania, Bartek). Gotowe: salda widać w Explorerze.
- [ ] **B3** · 2 h · A1 — Ekran organizatora: utworzenie oferty, zmiana ceny, lista sprzedaży. Na początku na mockach.
- [ ] **B4** · 2 h · A1 — Ekran kupującego: kup bilet, „X zł do odebrania”, przycisk „Odbierz różnicę”, link do transakcji w Explorerze.
- [ ] **B5** · 30 min · A6 — **Deploy na devnet** (`make deploy-devnet`). Robi to tylko B: jego portfel zostaje upgrade authority. Nie uruchamiać `anchor keys sync`.
- [ ] **B6** · 60 min · B3, B4, B5 — Podłączenie frontendu do prawdziwego programu, usunięcie mocków.
- [ ] **B7** · 30 min · B6 — Licznik do końca okna i przycisk `release` (na demo okno kilka minut).

### C: pitch + demo + QA
- [ ] **C1** · 45 min · — Design rationale: jaka relacja, kto był pośrednikiem, co się zmienia (wymóg zgłoszenia). Gotowe: sekcja w README.
- [ ] **C2** · 2 h · C1 — Slajdy (≤10, PDF): problem → kto dziś jest „sędzią” (Alaska, JetBlue, Costco) → mechanizm floor/rezerwa → demo → gdzie znika pośrednik → ograniczenia → co dalej.
- [ ] **C3** · 30 min · — Scenariusz demo krok po kroku (z `PROJEKT.md`) i odpowiedzi na 5 pytań jury, ćwiczone na głos.
- [ ] **C4** · 30 min · B5 — Portfele demo: 3 profile przeglądarki z Phantom na devnecie, SOL z faucet.solana.com, tokeny ze skryptu B2.
- [ ] **C5** · ciągle od 6:30 · B6 — QA: przejść pełny flow, zgłaszać błędy A/B.
- [ ] **C6** · 45 min · 9:00 — Nagranie wideo ≤3 min (backup demo + pitch), upload publicznie (YouTube unlisted).
- [ ] **C7** · 30 min · — README: co jest gdzie, jak uruchomić, Program ID, link do wideo i slajdów.
- [ ] **C8** · 30 min · wszystko — Zgłoszenie: tytuł, opis, PDF, wideo, publiczne repo.

## Git

- Gałęzie: `feat/program` (A), `feat/frontend` (B), `docs/pitch` (C). Małe PR do `main` kilka razy dziennie.
- IDL kopiujemy do `app/src/idl/`, bo `target/` jest w `.gitignore`.
- Zmiana interfejsu programu = wiadomość na czacie zespołu.

## Poza zakresem (mówimy o tym w „co dalej”)

Bilet jako NFT/cNFT, logowanie bez portfela (Privy / Phantom Connect), on-ramp w zł, kilka ofert na jedno wydarzenie.
