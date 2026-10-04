# Zwrotka jako uniwersalny protokół: programowalna rezerwa zwrotu

Dokument projektowy (po hackathonie). MVP w `programs/zwrotka` obsługuje jeden warunek: spadek ceny. Tu opisujemy, jak ten sam mechanizm obsłużyć inne przypadki i spory, nie wprowadzając pośrednika tam, gdzie nie jest potrzebny.

## 1. Rdzeń: trzy elementy, które się nie zmieniają

1. **Podział płatności:** część od razu dla sprzedawcy (`floor`), reszta w rezerwie programu (konto PDA).
2. **Reguła wypłaty z rezerwy** zapisana w ofercie przy jej utworzeniu. Nikt jej później nie zmienia.
3. **Rozliczenie bez zgody:** każdy może wywołać wypłatę, a program sam liczy kwoty i odbiorców.

Zmienia się tylko **źródło prawdy**, czyli to, skąd program wie, że należy się zwrot.

## 2. Źródła prawdy i gdzie kończy się „bez pośrednika”

| Poziom | Źródło prawdy | Przykłady | Pośrednik? |
|---|---|---|---|
| A | stan programu | zmiana ceny, liczba sprzedanych sztuk, suma zakupów | **nie** |
| B | czas sieci | termin, okno, abonament | **nie** |
| C | wyrocznia (Pyth, Switchboard) | cena aktywa, kurs | wyrocznia (zdecentralizowana, publiczna) |
| D | zgoda obu stron | anulowanie za porozumieniem | **nie** |
| E | ocena człowieka | jakość usługi, „strona jest zła” | **tak**: arbiter, ale ograniczony (sekcja 5) |

Zasada: najpierw próbujemy A–D. Arbiter (E) jest ostatnim szczeblem, a nie domyślną drogą.

## 3. Typy warunków (moduły reguły wypłaty)

W ofercie pole `condition` (enum). Konta `Offer`/`Purchase`, rezerwa, `claim` i `release` są wspólne. Zmienia się tylko funkcja `entitled()` (ile należy się kupującemu).

| Warunek | Zwrot dla kupującego | Poziom |
|---|---|---|
| `PriceDrop` (MVP) | `min(zapłacone − najniższa cena w oknie, rezerwa)` | A |
| `VolumeTier { progi }` | różnica do ceny progu osiągniętego do terminu (zakupy grupowe) | A + B |
| `ClearingPrice` | wszyscy płacą najniższą cenę z okresu sprzedaży (aukcja holenderska) | A |
| `Deadline { termin }` | cała rezerwa, jeśli sprzedawca nie potwierdził realizacji przed terminem (przedsprzedaż) | B + D |
| `ProRata { start, koniec }` | niewykorzystana część przy rezygnacji (karnet, kurs roczny) | B |
| `OracleThreshold { feed, próg }` | rezerwa, jeśli cena z wyroczni spadnie poniżej progu | C |
| `Milestones { etapy }` | rezerwa dzielona na etapy, każdy zwalniany osobno (freelance) | D + E |

## 4. Cykl życia zakupu (maszyna stanów)

```
          buy
 [ ] ───────────▶ Active ──────────────────────────────┐
                    │  claim (warunek spełniony)        │ release (koniec okna)
                    │  ──▶ Active (claimed += kwota)    ▼
                    │                                Settled (konto zamknięte)
                    │ cancel_mutual (oba podpisy) ─────▶ Refunded
                    │ refund_by_seller (podpis sprzedawcy) ─▶ Refunded
                    │ dispute (kupujący, w oknie) ──▶ Disputed
                    │                                   │ resolve (arbiter: podział rezerwy)
                    │                                   │ albo timeout arbitra → reguła domyślna
                    │                                   ▼
                    └──────────────────────────────▶ Settled
```

## 5. Spory o jakość: drabina rozstrzygania

Każdy szczebel jest tańszy i bardziej „bez zaufania” od następnego. Do arbitra dochodzimy tylko, gdy wszystko inne zawiedzie.

1. **Reguła automatyczna** (warunki z sekcji 3): bez sporu.
2. **Anulowanie za zgodą obu stron** (`cancel_mutual`): dwa podpisy, zwrot całej rezerwy (i opcjonalnie floor, jeśli sprzedawca dopłaci).
3. **Zwrot dobrowolny przez sprzedawcę** (`refund_by_seller`): np. odwołane wydarzenie. Sprzedawca oddaje floor ze swojego portfela, program oddaje rezerwę.
4. **Akceptacja optymistyczna** (etapy): sprzedawca oznacza „wykonane”, kupujący ma N dni na sprzeciw. Cisza oznacza akceptację i rezerwa trafia do sprzedawcy. Nikt nie może „przetrzymać” pieniędzy w nieskończoność.
5. **Arbiter wybrany z góry** (`dispute` → `resolve`): wskazany w ofercie (portfel albo multisig 2 z 3), znany kupującemu przed zakupem. **Może tylko podzielić rezerwę** między kupującego i sprzedawcę (np. 70/30). Nie może wypłacić pieniędzy sobie ani nikomu trzeciemu. Jego wynagrodzenie jest stałe i zapisane w ofercie.
6. **Timeout arbitra:** jeśli arbiter nie rozstrzygnie w M dni, wykonuje się reguła domyślna zapisana w ofercie (np. 50/50 albo zwrot kupującemu). Arbiter też nie może „zniknąć z pieniędzmi”, bo ich nie ma.

Opcjonalnie: **podwójna kaucja** (obie strony wpłacają kaucję przy sporze; strona, która przegra, traci swoją). To zniechęca do sporów dla zasady.

## 6. Macierz przypadków: co się dzieje, gdy…

| Sytuacja | Co robi program | Kto musi działać |
|---|---|---|
| Sprzedawca obniża cenę | kupujący odbiera różnicę (`claim`) albo dostaje ją przy `release` | nikt, wystarczy dowolne wywołanie |
| Sprzedawca znika | rezerwa jest w programie; `claim` i `release` działają bez niego | nikt |
| Kupujący znika | po końcu okna każdy wywołuje `release`: kupujący i tak dostaje należność, sprzedawca resztę | nikt (np. bot sprzedawcy) |
| Wydarzenie odwołane | `refund_by_seller` (dobrowolnie) albo warunek `Deadline` (wymuszone przez czas) | sprzedawca albo nikt |
| Usługa słabej jakości | `dispute` w oknie → arbiter dzieli rezerwę | kupujący + arbiter |
| Strony się dogadały | `cancel_mutual` | obie strony |
| Arbiter znika | po M dniach reguła domyślna z oferty | nikt |
| Kupujący zgłasza fałszywy spór | arbiter oddaje rezerwę sprzedawcy; przy podwójnej kaucji kupujący traci kaucję | arbiter |
| Sprzedawca sprzedaje taniej poza programem | program tego nie widzi (ograniczenie wszystkich wariantów A/B) | wyrocznia ceny w przyszłości |
| Kurs SOL spada w czasie okna | rezerwa traci wartość w zł → rozliczenia w USDC (SPL Token) | zmiana mintu |
| Autor programu chce coś zmienić | upgrade authority = none po audycie; do tego czasu multisig zespołu i jawna informacja | nikt / multisig |

## 7. Uprawnienia (kto co może)

| Instrukcja | Kto podpisuje | Ograniczenie |
|---|---|---|
| `create_offer` | sprzedawca | warunki, arbiter i reguła domyślna niezmienne po utworzeniu |
| `buy` | kupujący | kupuje na warunkach widocznych w ofercie |
| `set_price` / `confirm_delivery` | sprzedawca | nie wpływa na już zablokowane rezerwy poza regułą |
| `claim`, `release` | każdy | kwoty i odbiorcy liczone przez program |
| `cancel_mutual` | kupujący **i** sprzedawca | tylko zwrot do kupującego |
| `refund_by_seller` | sprzedawca | tylko zwrot do kupującego |
| `dispute` | kupujący | tylko w oknie, opcjonalnie z kaucją |
| `resolve` | arbiter z oferty | tylko podział rezerwy kupujący/sprzedawca |

Nikt, łącznie z autorami, nie ma instrukcji „wypłać rezerwę na dowolny adres”.

## 8. Co robimy na hackathonie, a co później

- **Hackathon (MVP):** `PriceDrop`, `claim`, `release`. Pokazujemy, że rdzeń działa bez pośrednika.
- **Następny krok (dni):** `refund_by_seller`, `cancel_mutual`, USDC, `close_offer`.
- **Potem (tygodnie):** enum `condition` (`VolumeTier`, `Deadline`, `ProRata`), etapy z akceptacją optymistyczną.
- **Na końcu:** arbiter z ograniczonymi uprawnieniami i timeout, wyrocznie (`OracleThreshold`).

Hasło: *„Zwrotka to programowalna rezerwa zwrotu. Dziś warunkiem jest spadek ceny; ten sam mechanizm obsłuży zakupy grupowe, przedsprzedaże, abonamenty i etapy zleceń. Tam, gdzie potrzebny jest człowiek, jest wybrany z góry i może tylko podzielić rezerwę, nigdy jej zabrać.”*
