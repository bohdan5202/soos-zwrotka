# Zwrotka · zespół SOOS (Specjaliści od Ogarniania Solany)

**Gwarancja najniższej ceny, której sprzedawca nie może złamać.** „Kup teraz, nie stracisz na promocji.”

HackYeah 2026 · wyzwanie **Superteam Poland: Finance Without Intermediaries** · Solana devnet

> **EN TL;DR:** An on-chain price-protection guarantee. When you buy, the seller immediately receives a *floor* amount and the rest is locked in a program-owned account. If the seller lowers the price within your guarantee window, you claim the difference yourself, with no seller signature, no support ticket, no oracle. After the window, anyone can settle: the buyer is paid first, the seller gets the remainder.

**Program ID (devnet):** [`44sG9n516FQKsDNC2uwyKPUKSksyDLH4ypzsVHgJGGB7`](https://explorer.solana.com/address/44sG9n516FQKsDNC2uwyKPUKSksyDLH4ypzsVHgJGGB7?cluster=devnet)

## Uzasadnienie projektowe (design rationale)

**Jaką relację finansową przeprojektowaliśmy.** Gwarancję ceny („jeśli obniżymy cenę, oddamy różnicę”). Dają ją Apple, Costco, Best Buy, Amazon w przedsprzedaży. Kupujący dzięki niej kupuje od razu, zamiast czekać na promocję.

**Kto był pośrednikiem.** Sam sprzedawca, w roli sędziego we własnej sprawie. Klient musi się upominać i pokazywać dowody, a sprzedawca decyduje, czy zwrot się należy. Costco pisze wprost, że „reserves the right to deny”, a Alaska Airlines (2018) i JetBlue (2017) po prostu wycofały swoje gwarancje. Mały sprzedawca (szkoła online, organizator wydarzeń) nie ma jak przekonać klientów, że dotrzyma takiej obietnicy.

**Co się zmienia po jego usunięciu.**
- Pieniądze na zwrot są zablokowane **w chwili zakupu** (`cena − floor` w koncie programu), a nie „obiecane”.
- Program sam zna historię cen, bo cenę zmienia się tylko jego instrukcją. **Nie ma wyroczni ani backendu**, który decydowałby o zwrocie.
- Zwrot wypłaca program **bez podpisu sprzedawcy**. Może go wywołać ktokolwiek, a pieniądze trafiają zawsze do kupującego.
- Sprzedawca zna swój maksymalny koszt z góry (`cena − floor` na zakup), więc może dać gwarancję bez ryzyka, które „zabiło” gwarancję Alaski. Floor to siła gwarancji: 1000 zł z floor 800 zł = „gwarancja ceny do 20%”.

**Użytkownik docelowy.** Mali sprzedawcy jednego kanału z cenami etapowymi i promocjami: szkoły i kursy online (Black Friday), organizatorzy wydarzeń (early bird → last minute). Pierwszy rynek: kursy i wydarzenia dla deweloperów krypto, bo kupujący mają już portfele.

## Gdzie znika pośrednik (w kodzie)

| Plik | Co robi |
|---|---|
| [`instructions/buy.rs`](programs/zwrotka/src/instructions/buy.rs) | `floor` → sprzedawca od razu, `cena − floor` → rezerwa w koncie `Purchase` |
| [`instructions/set_price.rs`](programs/zwrotka/src/instructions/set_price.rs) | jedyny sposób zmiany ceny; każda zmiana trafia do historii w `Offer` |
| [`state.rs` → `Purchase::due`](programs/zwrotka/src/state.rs) | należność = `min(zapłacone − najniższa cena w oknie, rezerwa) − już odebrane` |
| [`instructions/claim_difference.rs`](programs/zwrotka/src/instructions/claim_difference.rs) | **wypłata zwrotu bez podpisu sprzedawcy** |
| [`instructions/release.rs`](programs/zwrotka/src/instructions/release.rs) | po końcu okna: najpierw należność kupującego, potem reszta sprzedawcy |
| [`instructions/refund_purchase.rs`](programs/zwrotka/src/instructions/refund_purchase.rs) | anulowanie zakupu przez sprzedawcę: kupujący dostaje **co najmniej całą rezerwę** (resztę dopłaca sprzedawca), więc anulowaniem nie da się odebrać gwarancji |
| [`instructions/close_sales.rs`](programs/zwrotka/src/instructions/close_sales.rs) | koniec sprzedaży; anulowanie oferty = `close_sales` + `refund_purchase` dla każdego zakupu |
| [`instructions/request_refund.rs`](programs/zwrotka/src/instructions/request_refund.rs) | prośba kupującego o zwrot (konto `RefundRequest`), decyzja należy do sprzedawcy |
| [`instructions/buy.rs`](programs/zwrotka/src/instructions/buy.rs) `max_price` | zakup nie przejdzie, jeśli sprzedawca podniósł cenę ponad tę, którą kupujący zaakceptował |

## Pytania jury

- **Co, jeśli sprzedawca zniknie?** Rezerwa leży w koncie programu, nie u sprzedawcy. Kupujący odbiera różnicę bez niego, a `release` może wywołać każdy.
- **Co, jeśli kupujący zniknie?** Po końcu okna ktokolwiek wywołuje `release`: kupujący i tak dostaje należną różnicę (nawet jeśli nie kliknął „odbierz”), sprzedawca dostaje resztę.
- **Kto ma jakie uprawnienia?**
  - `set_price`, `close_sales`, `refund_purchase`: tylko sprzedawca oferty (`has_one = seller`). `refund_purchase` nie może dać kupującemu mniej niż cała rezerwa.
  - `request_refund`: tylko kupujący danego zakupu.
  - `claim_difference`, `release`: każdy, ale kwoty i odbiorców liczy program.
  - Program nie ma konta admina ani instrukcji „wypłać rezerwę na dowolny adres”.
  - Upgrade authority na czas hackathonu: portfel deployujący [`CGH9s71RJVVBBRGJudA1tLTdpNDBAfWeAwLNmf63dnSw`](https://explorer.solana.com/address/CGH9s71RJVVBBRGJudA1tLTdpNDBAfWeAwLNmf63dnSw?cluster=devnet). Docelowo multisig, a po audycie `none` (program niezmienny).
- **Dlaczego blockchain, a nie baza danych?** W bazie danych sprzedawca może edytować historię cen i trzyma pieniądze. Tu historia cen jest publiczna, a rezerwa zablokowana od chwili zakupu.
- **Ograniczenia (otwarcie):** gwarancja obejmuje tylko cenę w tym programie, nie sprzedaż innymi kanałami ani nową ofertą na to samo wydarzenie. MVP rozlicza się w SOL, więc wartość rezerwy w zł zmienia się z kursem (USDC to następny krok). Spory o jakość usługi nie są rozstrzygane automatycznie: jest tylko anulowanie przez sprzedawcę i prośba o zwrot.
- **Co dalej za tydzień?** USDC/SPL Token zamiast SOL; `close_offer` (zwrot rentu oferty); anulowanie za zgodą obu stron i arbiter wybrany z góry, który może tylko podzielić rezerwę; przycisk „Kup z ochroną” dla sklepów (Solana Blinks); rozmowy z 2–3 szkołami i organizatorami. Pełny projekt: [`docs/UNIWERSALNY.md`](docs/UNIWERSALNY.md).

## Uruchomienie

```bash
make test                      # program + 19 testów LiteSVM
cd app && npm install && npm run dev   # frontend: http://localhost:5173 (Phantom, devnet)
node app/scripts/smoke-devnet.ts       # cały scenariusz demo na devnecie z portfela CLI
node app/scripts/cancel-check.ts       # prośba o zwrot + anulowanie zakupu na devnecie
node app/scripts/catalog-check.ts "Nazwa"   # oferta z nazwą w Memo + odczyt katalogu
```

Frontend: strony `/` (lejek dla kupujących), `/katalog`, `/statystyki`, `/sprzedawca`, `/panel` (panel sprzedawcy), `/oferta/:adres`, `/portfel/:adres`. Szczegóły: [`app/README.md`](app/README.md).

Frontend pokazuje kwoty w zł: 1 zł = 0,0001 SOL (żeby testowy SOL z faucetu wystarczył).

Więcej: [`docs/PROJEKT.md`](docs/PROJEKT.md) (mechanizm, demo), [`docs/PLAN.md`](docs/PLAN.md) (plan pracy), [`docs/POMYSLY.md`](docs/POMYSLY.md) (research i odrzucone pomysły), [`docs/WYZWANIE.md`](docs/WYZWANIE.md) (opis wyzwania), [`docs/UNIWERSALNY.md`](docs/UNIWERSALNY.md) (protokół uniwersalny: warunki, spory, macierz przypadków).

---

## Dla agenta: konfiguracja środowiska u członka zespołu

Ta sekcja jest instrukcją dla agenta AI (Claude Code, Codex itp.), który stawia środowisko na komputerze kolejnej osoby z zespołu.

**Cel:** po zakończeniu w katalogu repo `make check` kończy się kodem 0, a `make test` pokazuje `test result: ok. 19 passed`.

### Zasady

1. **Pytaj przed każdym `sudo`.** Wszystko poza pakietami systemowymi instaluje się w katalogu domowym.
2. **Nie usuwaj ani nie podmieniaj istniejącego Rusta** (pakiet z dystrybucji, istniejący rustup). Patrz krok 2.
3. **Nie nadpisuj istniejącego `~/.config/solana/id.json`**: to może być czyjś portfel. Nie wypisuj go, nie commituj, nie wysyłaj nigdzie.
4. **Nie uruchamiaj `anchor keys sync`.** Program ID jest wspólny dla zespołu (patrz „Program ID” niżej). Zmiana `declare_id!` rozjedzie repo.
5. **Długie komendy uruchamiaj w tle albo z dużym timeoutem.** Kompilacja `avm` trwa ok. 10–15 min, pierwsza kompilacja programu na świeżym klonie 15–35 min.
6. **Zapisuj, co instalujesz i co zmieniasz w plikach powłoki**, i na końcu przekaż to użytkownikowi razem z sekcją „Odinstalowanie”.

### Przypięte wersje

| Składnik | Wersja | Gdzie przypięte / skąd |
|---|---|---|
| Solana CLI (Agave), w tym `cargo-build-sbf`, `solana-test-validator` | **3.1.10** | `Anchor.toml` → `[toolchain] solana_version` |
| Anchor CLI | **1.2.0** | `Anchor.toml` → `[toolchain] anchor_version`, `anchor-lang = "1.2.0"` w `programs/zwrotka/Cargo.toml` |
| avm (menedżer wersji Anchora) | z tagu **v1.2.0** repo `otter-sec/anchor` | Stare adresy `coral-xyz/anchor` i `solana-foundation/anchor` przekierowują na `otter-sec/anchor` |
| Rust (host, do testów i IDL) | **1.89.0** | `rust-toolchain.toml`; rustup dociąga go sam przy pierwszym `cargo` w repo |
| Platform-tools (kompilator SBF) | **v1.57** | domyślne w Anchor 1.2.0, pobierane automatycznie przy pierwszym buildzie (~3 GB) |
| Architektura SBPF | **v0** | `Makefile` (`ARCH ?= v0`). Domyślne v3 z Anchora psuje testy |
| LiteSVM (testy) | 0.10.0 | `programs/zwrotka/Cargo.toml` |
| Node.js | **24.x** | `.nvmrc`; potrzebny dopiero przy frontendzie |

### Krok 0: rozpoznaj system

- **Linux x86_64**: instrukcja poniżej wprost.
- **macOS** (arm64/x86_64): te same kroki; pakiety systemowe przez `xcode-select --install`.
- **Windows**: wszystko robimy **w WSL2 (Ubuntu)**, nie w PowerShellu. Jeśli WSL nie jest zainstalowany, poproś użytkownika o `wsl --install` (wymaga restartu) i kontynuuj w terminalu Ubuntu.

Sprawdź, co już jest: `command -v rustup cargo solana anchor avm node git`.

### Krok 1: pakiety systemowe (pomiń, jeśli są)

| System | Komenda (zapytaj o zgodę na sudo) |
|---|---|
| Debian / Ubuntu / WSL | `sudo apt-get update && sudo apt-get install -y build-essential pkg-config libssl-dev libudev-dev git curl` |
| Arch | `sudo pacman -S --needed base-devel pkgconf openssl git curl` |
| Fedora | `sudo dnf install -y gcc gcc-c++ make pkgconf-pkg-config openssl-devel systemd-devel git curl` |
| macOS | `xcode-select --install` |

### Krok 2: Rust przez rustup

`cargo-build-sbf` **wymaga rustup** (rejestruje przez niego toolchain Solany). Bez niego build kończy się błędem `Failed to execute rustup: No such file or directory`.

- **`rustup` już jest:** nic nie rób.
- **Nie ma żadnego Rusta:**
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  ```
- **Rust z pakietu dystrybucji bez rustup** (np. Arch `rust`, Debian `rustc`): nie usuwaj go. Zainstaluj lokalny rustup z systemowym Rustem jako domyślnym, wtedy `cargo` w terminalu zostaje tą samą wersją:
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path --default-toolchain none
  ~/.cargo/bin/rustup toolchain link system /usr
  ~/.cargo/bin/rustup default system
  ```

### Krok 3: Solana CLI 3.1.10

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/v3.1.10/install)"
```

Instalator dopisuje PATH tylko do `~/.profile` i `~/.bash_profile`. **zsh ich nie czyta**, więc PATH ustaw w kroku 5.

### Krok 4: avm i Anchor 1.2.0

```bash
cargo install --git https://github.com/otter-sec/anchor --tag v1.2.0 avm --locked   # kompilacja ~10–15 min
avm install 1.2.0     # gotowa binarka, kilka sekund
avm use 1.2.0
```

`avm use` sam przełącza Solanę na wersję zgodną z Anchorem i wypisuje `✨ 3.1.10 initialized`. To oczekiwane.

### Krok 5: PATH

Dopisz do pliku startowego powłoki (`~/.zshrc` dla zsh, `~/.bashrc` dla bash) blok ze znacznikami, żeby dało się go potem usunąć jednym `sed`:

```bash
# >>> hackyeah-solana >>> (usun ten blok przy odinstalowaniu)
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$HOME/.avm/bin:$PATH"
# <<< hackyeah-solana <<<
```

W bieżącej sesji agenta wykonaj ten sam `export`, bo nowa konfiguracja nie jest jeszcze wczytana.

### Krok 6: portfel devnet

```bash
[ -f ~/.config/solana/id.json ] || solana-keygen new --no-bip39-passphrase   # NIE nadpisuj istniejącego
solana config set --url devnet
solana address
```

Testowy SOL: `solana airdrop 2` prawie zawsze kończy się błędem limitu (`airdrop request failed... rate limit`). Poproś użytkownika, żeby wszedł na **https://faucet.solana.com**, zalogował się przez GitHub (wyższe limity) i wkleił adres z `solana address`. Potrzeba **2–3 SOL** (deploy programu to ok. 1 SOL rentu). Do demo z frontendem użytkownik instaluje też portfel Phantom w przeglądarce i przełącza go na devnet.

### Krok 7: weryfikacja

```bash
git clone git@github.com:bohdan5202/soos-zwrotka.git && cd soos-zwrotka
make check     # ma się skończyć kodem 0; WARN o saldzie 0 SOL jest dopuszczalny
make test      # pierwszy raz 15–35 min (pobiera platform-tools ~3 GB i kompiluje), potem ~40 s
```

Oczekiwany wynik `make test`: linia `test result: ok. 19 passed; 0 failed`.

Opcjonalnie, sprawdzenie deployu bez SOL: `make localnet` w osobnym terminalu, potem `make deploy-local`.

### Krok 8: raport dla użytkownika

Na koniec przekaż: co zostało zainstalowane (wersje), jakie pliki powłoki zmieniłeś, adres portfela, czy jest SOL, oraz odnośnik do sekcji „Odinstalowanie”.

### Znane problemy

| Objaw | Przyczyna i rozwiązanie |
|---|---|
| `Failed to execute rustup: No such file or directory` | Brak rustup. Krok 2 |
| Test pada z `InvalidAccountData` na `svm.add_program(...)` | Program zbudowany jako SBPF v3 (domyślne w Anchor 1.2.0). Buduj przez `make build` / `make test` (`--arch v0`) |
| `airdrop request failed ... rate limit` | Limit faucetu CLI. Użyj https://faucet.solana.com |
| Po `avm use` zmieniła się wersja `solana` | Oczekiwane: Anchor ustawia zgodną (3.1.10). `make check` to weryfikuje |
| Błąd o niezgodności Program ID (keypair vs `declare_id!`) | Brak wspólnego keypaira w `target/deploy/`. Używaj `make build` (kopiuje go z `keys/`). Nie uruchamiaj `anchor keys sync` |
| Pierwsze `cargo` w repo pobiera Rusta 1.89.0 | Oczekiwane, wynika z `rust-toolchain.toml` |
| Komenda agenta przerwana timeoutem przy kompilacji | Uruchom w tle i poczekaj; `avm` i pierwszy build trwają kilkanaście minut |

---

## Komendy projektu

| Komenda | Co robi |
|---|---|
| `make check` | sprawdza wersje narzędzi, portfel, saldo |
| `make build` | kompiluje program (`anchor build --arch v0`) |
| `make test` | build + testy LiteSVM (bez walidatora) |
| `make localnet` | lokalny walidator w bieżącym terminalu |
| `make deploy-local` | deploy na lokalny walidator |
| `make deploy-devnet` | deploy na devnet (potrzebne ~2 SOL) |

## Program ID

Wspólny Program ID: `44sG9n516FQKsDNC2uwyKPUKSksyDLH4ypzsVHgJGGB7`. Jego keypair jest celowo w repo (`keys/zwrotka-program-keypair.json`), żeby każdy budował z tym samym `declare_id!`. Dotyczy wyłącznie devnetu. Aktualizować wdrożony program może tylko portfel, który zrobił pierwszy deploy (upgrade authority).

## Struktura

```
Anchor.toml               # przypięte wersje Anchora i Solany, Program ID
Makefile                  # komendy (build z --arch v0)
rust-toolchain.toml       # Rust 1.89.0 dla hosta
programs/zwrotka/         # program on-chain (Rust/Anchor) + 19 testów LiteSVM
app/                      # frontend (Vite + React + Router + Wallet Adapter), skrypty devnet w app/scripts
keys/                     # wspólny keypair programu (devnet)
scripts/check-env.sh      # weryfikacja środowiska
docs/                     # PROJEKT.md (co budujemy), UNIWERSALNY.md (wizja), wyzwanie, pomysły
.github/workflows/ci.yml  # CI: build frontendu
```

## Odinstalowanie (po hackathonie)

Usuń tylko to, czego nie było przed instalacją (agent powinien był to zgłosić w raporcie):

```bash
rm -rf ~/.local/share/solana ~/.cache/solana ~/.avm   # Solana CLI, platform-tools (~3 GB), Anchor
rm -rf ~/.config/solana                               # klucz devnetowy; NIE usuwaj, jeśli to Twój prawdziwy portfel sprzed instalacji
rm -f  ~/.cargo/bin/avm ~/.cargo/bin/anchor
rustup toolchain uninstall 1.89.0                      # jeśli rustup był już wcześniej
# rustup self uninstall                                # jeśli rustup był instalowany tylko na hackathon (usuwa ~/.rustup i ~/.cargo)
sed -i '/# >>> hackyeah-solana >>>/,/# <<< hackyeah-solana <<</d' ~/.zshrc ~/.bashrc 2>/dev/null
sed -i '\#/.local/share/solana/install/active_release/bin#d' ~/.profile ~/.bash_profile 2>/dev/null
```

Rozszerzenie Phantom usuń z przeglądarki ręcznie. Katalog projektu (`target/` ma kilka GB) usuń razem z repo.
