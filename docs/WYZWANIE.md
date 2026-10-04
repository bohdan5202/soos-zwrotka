# Partner — Superteam Poland / Solana: Finance Without Intermediaries (3 000 USD: 1500/1000/500)

**Cel:** aplikacja na Solanie, która usuwa potrzebę zaufania (do drugiej strony albo do pośrednika) z transakcji finansowej. Warunki są zapisane w programie on-chain i wykonują się automatycznie; nikt nie może ich jednostronnie zmienić.

**Przykłady wzorca:** lending, escrow, rozliczenia freelancer ↔ klient, zbiórki z warunkowym zwrotem, podział przychodów, ubezpieczenia parametryczne (oracle), programy lojalnościowe, rozliczenia B2B, mikropłatności i płatności per sekundę.

**Wymagania twarde:**
- działa na Solanie, devnet wystarczy;
- **logika zastępująca pośrednika musi być w programie on-chain** („jeśli twój backend egzekwuje warunki, to pośrednikiem zostałeś ty");
- co najmniej jeden pełny use case: od wejścia użytkownika do potwierdzonej transakcji; trzeba pokazać moment, w którym pośrednik przestaje być potrzebny;
- **demo na żywo** (połączenie portfela → operacja → tx w Solana Explorer), nagranie tylko jako backup;
- jawnie nazwany użytkownik docelowy, plus krótkie uzasadnienie projektowe (jaką relację przeprojektowano, kto był pośrednikiem, co się zmienia).

**Oddanie:** opis z design rationale, PDF ≤10 slajdów, **wideo ≤3 min (link publiczny)**, **publiczne repo** z czytelnym README.

**Pytania jury:** gdzie dokładnie w kodzie znika pośrednik? Co jeśli jedna strona zniknie w połowie i gdzie są wtedy środki? Kto ma jakie uprawnienia, czy autor może coś zmienić po deployu? **Dlaczego blockchain, a nie baza danych?** Co dalej za tydzień?

**Nie oceniają:** odporności na ataki, audytu, jakości designu ani pokrycia testami. UI może być surowe.

**Stack:** Anchor (najprościej), @solana/kit lub web3.js, Wallet Adapter, SPL Token / Token-2022, Pyth / Switchboard. Gotowy devcontainer: github.com/matzayonc/solana-live-course-2026. Jest też Solana Playground w przeglądarce.

**Kryteria:** Relevance 30 · Kompletność i działanie 25 · Idea i wybór problemu 20 · Potencjał wdrożeniowy 15 · Oryginalność 10.
**Plus:** kod zostaje nasz; ścieżka do grantów Solana i mentorzy przy stoisku przez cały czas.
