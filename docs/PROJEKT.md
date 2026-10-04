# Co budujemy: gwarancja najniższej ceny on-chain

Wybrany pomysł (decyzja zespołu z 2026-10-03). Research i odrzucone alternatywy: [`POMYSLY.md`](POMYSLY.md), runda 7.

**Hasło:** „Kup bilet teraz, nie stracisz na promocji”. Gwarancja najniższej ceny, której sprzedawca nie może złamać.

## Problem

Kupujący zwlekają z zakupem biletów, kursów i przedsprzedaży, bo boją się, że za tydzień będzie promocja. Sprzedawca przez to później dostaje pieniądze i później wie, ile sprzeda. Duże sieci (Apple, Costco, Best Buy, Amazon w przedsprzedaży) dają gwarancję ceny: jeśli obniżą cenę, oddają różnicę. To jednak obietnica, którą egzekwuje sam sprzedawca. Klient musi się upominać i pokazywać dowody, sprzedawca może odmówić albo wycofać gwarancję, jak zrobiły Alaska Airlines w 2018 i JetBlue w 2017. Mały organizator wydarzeń nie ma jak przekonać klientów, że dotrzyma takiej obietnicy.

## Rozwiązanie

Program na Solanie trzyma pieniądze na ewentualny zwrot różnicy i sam decyduje o zwrocie.

1. Sprzedawca tworzy ofertę: cena, **floor** (ile dostaje od razu) i **okno gwarancji**: N dni od zakupu (kurs) i/lub data startu wydarzenia (bilet). Okno kupującego = `min(zakup + N dni, start wydarzenia)`.
2. Przy zakupie sprzedawca od razu dostaje `floor`, a `cena − floor` trafia do rezerwy w koncie `Purchase` (PDA).
3. Cenę zmienia się wyłącznie instrukcją programu, więc program sam zna historię cen. Nie potrzebuje wyroczni ani backendu.
4. Cena może spaść **także poniżej floor** (last minute jest dozwolone). Kupujący odbiera różnicę, ale najwyżej `cena − floor`, czyli swoją rezerwę. Floor = siła gwarancji („gwarancja ceny do 20%”), a maksymalny koszt sprzedawcy jest znany z góry. Sprzedawca nie musi niczego zatwierdzać.
5. Po końcu okna ktokolwiek wywołuje `release`: **najpierw kupujący dostaje należną różnicę** (nawet jeśli nie kliknął „odbierz”), potem resztę rezerwy dostaje sprzedawca.

MVP rozlicza się w SOL (lamporty). USDC / SPL Token to krok „co dalej”.

**Kogo zastępujemy:** rolę „sędziego” w sprawie zwrotu, którą dziś pełni sam sprzedawca albo bank.
**Dlaczego blockchain:** rezerwa jest zablokowana od chwili zakupu i każdy widzi ją w explorerze. Warunków dla już sprzedanych biletów nie da się zmienić. Maksymalny koszt sprzedawca zna z góry (`cena − floor` na każdy bilet), dlatego zwrot może być automatyczny bez ryzyka, które zabiło gwarancję Alaski.

**Użytkownik docelowy:** organizatorzy wydarzeń i twórcy kursów sprzedający w systemie early bird (jeden kanał sprzedaży, ceny etapowe). W tej branży nie znaleźliśmy gwarancji ceny.

## Program (zaimplementowany w `programs/zwrotka/src/`)

Konta:
- `Offer` PDA `["offer", seller, offer_id]`: `seller`, `offer_id`, `price`, `floor`, `window_secs`, `event_start`, historia zmian ceny `Vec<PricePoint { ts, price }>` (max 32), `bump`.
- `Purchase` PDA `["purchase", offer, buyer]` (jeden zakup na kupującego): `paid`, `reserve`, `claimed`, `bought_at`, `window_end`, `first_change` (indeks pierwszej zmiany ceny po zakupie), `bump`. **Konto jest jednocześnie sejfem rezerwy.**

Należność: `due = min(paid − najniższa cena po zakupie do window_end, reserve) − claimed` (`Purchase::due` w `state.rs`).

Instrukcje:
| Instrukcja | Kto | Co robi |
|---|---|---|
| `create_offer(offer_id, price, floor, window_secs, event_start)` | sprzedawca | `floor ≤ price`, okno: dni i/lub data wydarzenia |
| `buy()` | kupujący | `min(price, floor)` → sprzedawca, reszta → rezerwa w `Purchase` |
| `set_price(new_price)` | tylko sprzedawca | dowolna cena > 0 (także poniżej floor), wpis do historii, limit 32 |
| `claim_difference()` | ktokolwiek | wypłaca `due` kupującemu, bez podpisu sprzedawcy |
| `release()` | ktokolwiek, po `window_end` | `due` → kupujący, reszta rezerwy → sprzedawca, zamyka `Purchase` (rent → kupujący) |

Podwyżki ceny nic nie zmieniają dla wcześniejszych kupujących. Testy LiteSVM: `programs/zwrotka/tests/test_price_guarantee.rs`.

## Demo (wymóg wyzwania: na żywo, z transakcją w explorerze)

Scenariusz: kurs online dla programistów Solany od niezależnej (fikcyjnej) szkoły. Kupujący to deweloperzy, więc mają już portfele. Trzy portfele: Szkoła, Ania, Bartek.
1. Szkoła wystawia kurs: 1000 zł, floor 800 zł („gwarancja ceny do 20%”), okno 30 dni (na devnecie kilka minut).
2. Ania kupuje za 1000 zł. W explorerze widać 800 zł u szkoły i 200 zł w rezerwie.
3. Black Friday: szkoła obniża cenę do 850 zł. Bartek kupuje.
4. Ania widzi „150 zł do odebrania”, klika i dostaje 150 zł. Pokazujemy tę transakcję w explorerze: to moment, w którym znika pośrednik.
5. Po końcu okna ktokolwiek wywołuje `release()`: szkoła dostaje pozostałe 50 zł.

Limit `cena − floor` (np. obniżka do 600 zł → Ania dostaje max 200 zł) pokazujemy na slajdzie i w testach, nie na żywo. Wariant „bilet na wydarzenie” to ten sam program z ustawioną datą wydarzenia.

UI w zł (pod spodem USDC), logowanie bez portfela (Privy / Phantom Connect) to opcja, jeśli zostanie czas.

## Odpowiedzi na pytania jury

- **Gdzie w kodzie znika pośrednik?** W `claim_difference`: nie wymaga podpisu sprzedawcy, a kwotę liczy z historii cen zapisanej w programie.
- **Co, jeśli sprzedawca zniknie?** Rezerwa leży w vault. Kupujący odbiera różnicę bez sprzedawcy, a `release()` może wywołać każdy.
- **Czy autor może coś zmienić po deployu?** Po demo ustawiamy upgrade authority na none albo jawnie mówimy, kto ją ma. Program nie ma konta admina.
- **Słabe punkty (mówimy o nich otwarcie):** gwarancja obejmuje tylko cenę w programie, a nie sprzedaż innymi kanałami. Sprzedawca może wycofać gwarancję dla przyszłych sprzedaży, ale nie dla już sprzedanych biletów.
- **Co dalej za tydzień?** Rozmowy z 2–3 organizatorami wydarzeń, integracja ze sprzedażą biletów (np. bilet jako NFT/cNFT), on-ramp w zł.

## Źródła do pitchu

Firmy z gwarancją ceny off-chain (Apple, Best Buy, Costco, Amazon, Southwest, Old Navy, Kohl's, Dometic PL), wycofane gwarancje (Alaska, JetBlue) i precedens on-chain (Art Blocks): tabela z linkami w [`POMYSLY.md`](POMYSLY.md), runda 7.
