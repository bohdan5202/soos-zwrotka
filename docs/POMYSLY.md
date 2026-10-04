# Superteam / Solana — pomysły

Zasada wyboru: warunek musi być sprawdzalny w całości on-chain (**termin minął / wpłata jest / cena z Pyth przekroczyła próg / strona X podpisała**). Każda zewnętrzna wyrocznia (np. „paczka doszła”) = nowy pośrednik, o którego jury zapyta.

Research istniejących rozwiązań: 2026-10-03.

## Runda 2 — pomysły innowacyjne (nie znaleziono gotowców na Solanie)

### A. Zbiórka, w której porażka się opłaca (dominant assurance contract) ⭐⭐ REKOMENDACJA
- Mechanizm Tabarroka (1998): autor zbiórki z góry wpłaca **premię**. Cel osiągnięty → autor dostaje środki, premia wraca do niego. Cel nieosiągnięty → wpłacający dostają zwrot **+ premię**. Wpłata przestaje być ryzykiem.
- Dlaczego blockchain: w realu nikt nie ufa obietnicy premii, więc potrzebny jest pośrednik, który ją trzyma. Tu premia leży w PDA od pierwszej sekundy, widoczna dla wszystkich. Mechanizm był niemożliwy bez zaufanej strony.
- Warunki: suma wpłat ≥ cel przed terminem / termin minął.
- Demo: dwie kampanie — sukces (autor wypłaca) i porażka (wpłacający odbiera więcej, niż wpłacił). Explorer.
- Grupa: twórcy, lokalne inicjatywy, dobra wspólne (open source, zbiórki osiedlowe). Zastępowany pośrednik: platforma zbiórkowa.
- Status: brak implementacji na Solanie. Program ~5 instrukcji.

### B. Pożyczka, która sama się spłaca z utargu (revenue-based financing) ⭐
- „Stripe Capital bez Stripe”. Inwestor pożycza sklepowi 1000 USDC (oddać 1100). Sklep przyjmuje płatności przez QR Solana Pay wskazujący **adres programu**. Każda płatność dzielona: np. 20% → inwestor, 80% → sklep, aż do spłaty; potem 100% → sklep.
- Warunek: suma przekazana inwestorowi ≥ kwota do spłaty (liczone on-chain).
- Demo: 3 portfele (inwestor, sklep, klient); płatność za kawę dzieli się na dwie strony w Explorerze; pasek spłaty rośnie.
- Status: Huma Finance robi PayFi na Solanie, ale dla licencjonowanych instytucji płatniczych (inny model). Auto-podziału dla małych sklepów nie znaleziono.
- ⚠ Sklep może podmienić QR na prywatny portfel — trzeba to nazwać i zaproponować mitigację (zastaw, reputacja on-chain).

### C. „Rozwód wspólników” bez prawników (shotgun clause)
- A podaje cenę za udział, B musi albo sprzedać po tej cenie, albo odkupić udział A po tej samej cenie. Program trzyma wspólny skarbiec/tokeny udziałów; brak reakcji B w N dni → automatycznie wariant sprzedaży.
- Status: jeden projekt hackathonowy na Ethereum (Pacta, ETHGlobal); na Solanie nic.
- ⚠ Działa tylko dla aktywów już on-chain → wąska grupa (DAO, zespoły krypto).

### D. Zakupy grupowe — im nas więcej, tym taniej
- Sprzedawca ustala progi (10 osób = 100 zł, 50 osób = 80 zł). Kupujący wpłacają najwyższą cenę; po terminie program liczy cenę końcową i **automatycznie zwraca różnicę**; poniżej minimum zwraca wszystko. Zastępuje organizatora „zbiorówek” z Facebooka.
- Status: nic nie znaleziono.
- ⚠ Program nie gwarantuje dostawy towaru (off-chain). Częściowo: collateral sprzedawcy.

| | Związek z wyzwaniem (30) | Wykonalność (25) | Idea (20) | Wdrażalność (15) | Oryginalność (10) |
|---|---|---|---|---|---|
| A. Zbiórka z premią | ★★★ | ★★★ | ★★★ | ★★ | ★★★ |
| B. Pożyczka z utargu | ★★★ | ★★ | ★★★ | ★★★ | ★★★ |
| C. Shotgun clause | ★★★ | ★★ | ★★ | ★ | ★★★ |
| D. Zakupy grupowe | ★★ | ★★★ | ★★ | ★★ | ★★ |

## Runda 1 — pomysły „proste warunki” (wszystkie już istnieją)

| # | Pomysł | Opis | Co istnieje | Zajętość |
|---|---|---|---|---|
| 1 | Dziedziczenie (dead man's switch) | Skarbiec + heartbeat „żyję”; brak heartbeatu przez N dni → spadkobiercy odbierają udziały | Heres Protocol (hackathon Chainlink 2026, Solana); Sarcophagus (Ethereum) | 🟢 nisza, brak dużego produktu na Solanie |
| 2 | OTC escrow | Atomowa wymiana token↔token/NFT↔SOL z terminem; zastępuje „escrow admina” z Telegrama | McSwap OTC, OTC Sol, Poseidon OTC, Streamflow | 🔴 mocno zajęte |
| 3 | Pożyczka P2P pod zastaw NFT | Spłata przed terminem → zastaw wraca; brak spłaty → pożyczkodawca bierze zastaw | Sharky (~70–80% rynku), Citrus, FRAKT/Banx | 🔴 bardzo zajęte |
| 4 | Zakład cenowy przez Pyth | 1v1, obie strony wpłacają, po terminie program czyta cenę z Pyth i wypłaca | 4Cast, DeCalls (pule góra/dół), Foxify; 1v1 nie znaleziono | 🟡 średnio, kojarzy się z hazardem |
| 5 | Skarbiec z blokadą czasu/ceny | Odblokowanie po dacie albo po cenie ≥ X | Streamflow (time- i price-based locks), DevFridge, Sablier | 🔴 zajęte w całości |

Pomysły wyróżniające dla #1 (gdyby wrócić): okres karencji na anulowanie, heartbeat z każdej zwykłej transakcji, stopniowe wypłaty dla spadkobierców, wielu spadkobierców + SPL/USDC, UI dla ludzi spoza krypto.

## Odrzucone (już istnieją)
- ROSCA / chit fund / tontine — Dhukuti Protocol (Solana) + wiele projektów hackathonowych.
- Kaucja za obecność na evencie (no-show stake) — Unlock Protocol „I'm Going!”, Kickback.
- Escrow nagród hackathonowych — Solana Hackathons już tak robi; JudgeBuddy, BountyX, Drips.
- Ubezpieczenie parametryczne od depegu stablecoina — istnieje na Solanie (Pyth + Switchboard); Etherisc na EVM.

## Weryfikacja w bazie Colosseum Copilot (2026-10-03)

Wyszukiwanie semantyczne w projektach ze wszystkich hackathonów Colosseum (Renaissance, Radar, Breakout, Cypherpunk, Frontier). Brak wyniku ≠ brak konkurencji, ale to najlepsze dostępne źródło dla Solany.

- **A. Zbiórka z premią**: zwykłych zbiórek all-or-nothing / milestone na Solanie jest **bardzo dużo** (SolFund, Qadam, CollectiveMint, beFUNDR, Veladao, Fundbeep, Better Raise…). **Premii za porażkę (DAC) nie ma w żadnym.** Najbliżej: [PNL.FUN](https://colosseum.com/projects/explore/pnl.fun) (Frontier), czyli koncept launchpadu tokenów z „cashbackiem” i zwrotem przy porażce, bez działającego kodu. Wniosek: mechanizm wolny, ale kategoria zatłoczona, więc pitch musi stać na premii, inaczej wyglądamy jak „kolejny crowdfunding”.
- **B. Pożyczka z utargu**: [RevShare](https://colosseum.com/projects/explore/revshare) (Frontier, wsparcie Superteam KZ) tokenizuje przychody małych firm, ale przychód podaje **backend jako wyrocznia** (symulowany). [SentinelPay AI](https://colosseum.com/projects/explore/sentinelpay-ai) ma „PayFi Splitter” dzielący wpływy sklepu, ale na vaulty z yieldem, nie na spłatę pożyczki. Dużo BNPL / invoice financing. Wniosek: wariant „płatność klienta idzie przez program, który sam spłaca dług, bez wyroczni” nie znaleziony; to jest wyróżnik.
- **C. Shotgun clause**: nic bliskiego (najbliżej Co:ntribute, czyli wspólne inwestowanie, i Fusogen, czyli fuzje DAO). Wolne, ale wąski rynek.
- **D. Zakupy grupowe**: [Groupshop](https://colosseum.com/projects/explore/groupshop) (Frontier) robi już grupowe zakupy z escrow, progiem MOQ i zwrotem przy niepowodzeniu; także Snowball, BlinkBuy. Progów cenowych z automatycznym zwrotem różnicy nie znaleziono, ale to przyrost do Groupshop, więc oryginalność słaba.

## Runda 3 — pomysły dla ludzi spoza krypto (sprawdzone w Colosseum Copilot, 2026-10-03)

| Pomysł | Status w Colosseum |
|---|---|
| **Bon podarunkowy, który nie przepada** (pieniądze w PDA, sklep dostaje je dopiero przy realizacji, niewykorzystana reszta wraca do kupującego po terminie, bezpieczne przy upadłości sklepu) | 🟢 **wolne**. Są bony jako tokeny na okaziciela ([TWT Giftcards](https://colosseum.com/projects/explore/twt-giftcards-live-on-mainnet-and-available-on-seeker)) i karty lojalnościowe z USDC ([Verxio](https://colosseum.com/projects/explore/verxio)), ale nikt nie robi ochrony kupującego (zwrot niewykorzystanej kwoty, płatność dopiero przy realizacji) |
| **Karnet / przedpłata, której firma nie może „przejeść”** (roczny karnet na siłownię/kurs spływa do firmy miesiąc po miesiącu, przy rezygnacji lub upadłości reszta wraca) | 🟡 mechanika jest ([Paystream](https://colosseum.com/projects/explore/paystream): strumień z anulowaniem dla freelancerów; Nakama: subskrypcje), ale ramy „ochrona konsumenta przy przedpłatach” brak |
| **„Zrzutka, na której nie stracisz”** = pomysł A (DAC) w wersji dla zwykłych ludzi, np. zbiórka osiedlowa na plac zabaw | 🟢 premia za porażkę nigdzie nie występuje (patrz wyżej) |
| Kaucja za mieszkanie | 🔴 [SolRent: Deposit Shield for Ireland](https://colosseum.com/projects/explore/solrent-:-deposit-shield-for-ireland), SolNest, TrustRent |
| Escrow dla fachowców / remontów | 🔴 kilkanaście escrow dla freelancerów (SHIELD-PAY, Trustless Work, Nexcrow, Gigentic…) |
| Kaucja za rezerwację (no-show) | 🔴 [BeThere](https://colosseum.com/projects/explore/bethere) (stake + check-in QR) |
| Skarbonka / kieszonkowe dla dziecka | 🔴 Seedling, Bucky-Bank, Toothfairy, jarfi, k3nz, Sona |

Ukrycie krypto (z huba Colosseum): logowanie e-mailem/Google przez Privy albo Phantom Connect (portfel wbudowany), opłaty sieci płacone przez aplikację, kwoty pokazywane w zł (pod spodem USDC), doładowanie przez on-ramp (np. Coinbase Onramp; dostępność BLIK/PL do sprawdzenia). Na devnecie: przycisk „doładuj testowo”.

## Runda 4 — P2P bez sklepów, wiralowe (Colosseum Copilot, 2026-10-03)

- Escrow z podwójną kaucją bez arbitra (OLX/Vinted): 🔴 [Nector](https://colosseum.com/projects/explore/nector) (mutual bonds + timeouty, „no-admin”), SavAct, Vigent, IsabiPay.
- Wyzwanie oszczędzania ze znajomymi (kto nie wpłaci, traci na rzecz reszty): 🔴 SafeNudge, Tontine, Savings Ladder, HabitStake, ROSCA (Vaquita, Roosta).
- **Wniosek:** jedyny wolny i z natury wiralowy pomysł to **A (zbiórka z premią)** w wersji „wydarzenie dojdzie do skutku, jeśli zapisze się min. N osób”: premia od organizatora to jednocześnie zachęta do założenia portfela („nie możesz stracić, możesz zyskać”), a każda zbiórka ściąga N nowych osób.

## Runda 5 — B2B (Colosseum Copilot, 2026-10-03)

- **Kaucja gwarancyjna w budownictwie (retention)**: 🟢 **samej retencji nikt nie robi**. Sąsiedzi: [Construkt](https://colosseum.com/projects/explore/construkt) (escrow etapów budowy z hierarchią akceptacji), [Vault1177](https://colosseum.com/projects/explore/vault1177) (rejestr płatności w budownictwie), WEZA Build. Żaden nie trzyma kaucji gwarancyjnej z automatycznym zwrotem po okresie gwarancji.
- **Rabat posprzedażowy (volume rebate)**: 🟢 nie znaleziono. Najbliżej ogólne escrow B2B (ShipChain, Vigent, Sealed Agent) i Groupshop (MOQ).
- Finansowanie faktur / factoring / dynamic discounting: 🔴 bardzo zatłoczone (InvoFi, flow.money, FactorX, Solana Invoice Finance, Ultraliquidity, Novara).
- Escrow handlowy z wyrocznią dostawy (logistyka): 🔴 ShipChain, CargoEscrow; plus problem wyroczni.

## Runda 6 — poza escrow (Colosseum Copilot, 2026-10-03)

- **Wzajemny fundusz chorobowy dla samozatrudnionych (model holenderskiego broodfonds)**: 🟢 **wolne**. Mała grupa (20–50 osób, które się znają) co miesiąc wpłaca składkę do wspólnej puli. Chory członek dostaje wypłaty z limitem miesięcznym i limitem miesięcy. Zgłoszenie przechodzi automatycznie, jeśli w 72 h nie sprzeciwi się k członków (optymistyczne zatwierdzanie). Bez ubezpieczyciela. W Colosseum: ubezpieczenia parametryczne od katastrof ([MYRMEX](https://colosseum.com/projects/explore/myrmex), [NOVA](https://colosseum.com/projects/explore/nova-decentralized-micro-insurance-protocol): pule społeczne + walidatorzy roszczeń, Insure), DAO-claims (SafeFi), ROSCA i wspólne skarbce, ale **nic dla dochodu w chorobie w małych zaufanych grupach**.
  - Poza Colosseum: [Velora](https://www.karmahq.xyz/project/velora/about) na **Celo**, czyli pula pomocy wzajemnej dla gig workerów (KYC, governance społeczności, GoodDollar), na wczesnym etapie. Offline działa model, który przetestowano latami: broodfonds (NL), [Bread Funds](https://wiki.p2pfoundation.net/Bread_Funds) (UK). W Polsce znaleziono tylko dobrowolne chorobowe ZUS i prywatne polisy od utraty dochodu.
- Skarbnik klasowy / rada rodziców / wspólnota (multisig + limity): 🟡/🔴 Fund Together, Squad Treasury, multisigi.
- Subskrypcja płatna za opublikowany odcinek: 🟡/🔴 CreatorVault (transze po dowodzie dostawy), subskrypcje twórców.
- Wadium przetargowe: 🟡 przetargi z zamkniętymi ofertami już są (Kairen, tendr.bid).

## Runda 7 — gwarancja najniższej ceny (Colosseum Copilot + web, 2026-10-03)

Wcześniejsze rundy zespół odrzucił. Nowy kandydat:

- **„Kup teraz, nie stracisz na promocji”**: on-chain gwarancja ceny (price protection / klauzula najwyższego uprzywilejowania). Sprzedawca (bilety, kursy, przedsprzedaż) sprzedaje przez program. Jeśli w ciągu N dni od zakupu obniży cenę, każdy wcześniejszy kupujący może odebrać różnicę z zablokowanej rezerwy, bez pytania sprzedawcy.
  - Rezerwa: przy sprzedaży sprzedawca od razu dostaje deklarowaną cenę minimalną (floor), a różnica `cena − floor` leży w PDA do końca okna kupującego. Poniżej floor program nie pozwala zejść, dopóki trwa jakiekolwiek okno.
  - Warunek w pełni on-chain: cenę zmienia się tylko instrukcją programu, więc historię cen zna sam program, bez wyroczni.
- Copilot: 🟢 **nikt tego nie robi**. Najbliżej: [SolaBay](https://colosseum.com/projects/explore/solabay) (Breakout), który ma dynamiczne ceny, ale bez zwrotu dla wcześniejszych kupujących. [Jin](https://colosseum.com/projects/explore/jin) (Radar) to ogólna infrastruktura zwrotów. [Proof of consumption](https://colosseum.com/projects/explore/a-new-sales-model-utilizing-blockchain-and-proof-of-consumption) (Radar) dotyczy utraty wartości produktu, a nie ceny.
- Poza Solaną: Art Blocks ma „Dutch Auction with Settlement” (Ethereum, NFT), czyli jednorazową aukcję, po której wszyscy płacą cenę końcową. Jest też ERC721R (okno zwrotu NFT). Nasz wyróżnik: stała gwarancja z oknem czasowym dla zwykłej sprzedaży (bilety, kursy, przedsprzedaż), a nie dla jednego dropu NFT.
- Sprawdzone też i 🔴 zajęte: kompensata wielostronna faktur (Brace, HyperSettle), loteria zapisów z VRF (Raffl.fun, MegaByt, WiniSol), płatne wiadomości ze zwrotem (Pay to Chat, KarmaSol, Icebreak). 🟢 też wolne, ale słabsze: dopłata sponsora 1:1 do zbiórki (matching pledge), kawa zawieszona.

### Runda 7: gdzie gwarancja ceny już działa (off-chain, sprawdzone 2026-10-03)

Każde źródło otworzyłem. Dla Kohl's oficjalna strona się nie otworzyła, więc jest źródło wtórne.

| Firma | Okno | Źródło |
|---|---|---|
| Apple | 14 dni od otrzymania; bez Black Friday i Cyber Monday | [Apple Retail Sales Policy](https://www.apple.com/legal/sales-support/sales-policies/retail/) |
| Best Buy | okres zwrotu, „upon request” | [Price Match Guarantee](https://www.bestbuy.com/site/help-topics/price-match-guarantee/pcmcat290300050002.c?id=pcmcat290300050002) |
| Costco | 30 dni; „reserves the right to deny” | [Costco price match](https://customerservice.costco.com/app/answers/answer_view/a_id/628) |
| Old Navy | 14 dni, jednorazowo | [Old Navy CA](https://oldnavy.gapcanada.ca/customerService/info.do?cid=3317) |
| Kohl's | 14 dni (źródło wtórne, 06.2024) | [rather-be-shopping](https://www.rather-be-shopping.com/blog/price-adjustments/) |
| Amazon | przedsprzedaż do dnia premiery, **automatycznie** | [Pre-order Price Guarantee](https://images-na.ssl-images-amazon.com/images/G/01/vg/varia/tim-preorderpriceguarantee-final3.html) |
| Southwest | różnica jako kredyt (bilety niezwrotne) albo zwrot | [Southwest lower fare](https://support.southwest.com/helpcenter/s/article/lower-fare-refund) |
| Dometic (PL) | 7 dni | [Gwarancja Ceny](https://www.dometic.com/pl-pl/support/price-promise) |
| Alaska Airlines | zakończone 1.09.2018 | [One Mile at a Time](https://onemileatatime.com/alaska-airlines-price-guarantee-ending/) |
| JetBlue | zakończone pod koniec 2017 | jw. |

Brak: bilety na wydarzenia / konferencje (luka). Przestroga: Tarcza Biedronki ([rp.pl](https://www.rp.pl/konsumenci/art36171891-tarcza-antyinflacyjna-biedronki-trafi-pod-lupe-uokik)), czyli uciążliwy zwrot różnicy i postępowanie UOKiK.

## Runda 8: sprzedaż programu Solana bez pośrednika (Colosseum Copilot + web, 2026-10-03)

Poprzednie rundy odpadły. Nowy kandydat:

- **Kupno/sprzedaż wdrożonego programu Solana: atomowa wymiana upgrade authority za USDC, także na raty.** Sprzedający przekazuje upgrade authority do PDA (od tej chwili nie może podmienić kodu). Kupujący płaci, a w tej samej transakcji program przekazuje mu authority. Wariant na raty: authority leży w PDA do ostatniej raty; brak raty po terminie → authority wraca do sprzedającego, wpłacone raty zostają u niego.
  - Warunek w 100% on-chain, **bez wyroczni**: przedmiotem transakcji jest uprawnienie zapisane w sieci.
  - Zastępowany pośrednik: escrow agent (Escrow.com przy sprzedaży stron/SaaS) albo „middleman” z Telegrama przy sprzedaży projektów krypto.
- Copilot: 🟢 **sprzedaży authority za płatność nikt nie robi**. Najbliżej: [Solignition](https://colosseum.com/projects/explore/solignition) (Cypherpunk) pożycza SOL na deploy i trzyma authority jako zastaw (inna relacja: protokół ↔ dev, nie sprzedaż). [SOLX](https://colosseum.com/projects/explore/solx) (Breakout) sprzedaje kod jako pliki z dostępem przez NFT + kaucja + arbitraż (backend, AI-skaner). Poza Colosseum: [pyth-network/program-authority-escrow](https://github.com/pyth-network/program-authority-escrow), czyli bezpieczne przekazanie authority bez ceny; dowodzi, że wzorzec CPI działa.
- ⚠ Do sprawdzenia w dniu 1: dokumentacja Solany wspomina przejście z loader-v3 na loader-v4; sprawdzić, którym loaderem deployuje `anchor deploy` na devnecie (od tego zależy CPI SetAuthority).
- Sprawdzone w tej rundzie i 🔴 zajęte: pożyczki z poręczycielami (uLendMe, Saathi Loan, peer.loans), kasa zapomogowo-pożyczkowa / SACCO (Blockchain SACCO, SOLAS, KrediLoop), split payment VAT (TaxChain), sejf seniora z opóźnieniem i wetem rodziny (SecureVault, SolGuard, SecureYourSOL). 🟡 aukcja świecowa: mechanizm wolny, ale aukcji jest bardzo dużo.
