# Zwrotka: frontend

Vite + React + TypeScript, portfel przez Wallet Adapter (Phantom), Solana devnet.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # produkcyjny build do dist/
node scripts/smoke-devnet.ts   # cały scenariusz demo na devnecie z portfela CLI
```

Własny RPC (publiczny devnet ma niskie limity) w `app/.env` albo `app/.env.local`:

```
RPC_URL=https://devnet.helius-rpc.com/?api-key=...
```

Przeglądarka nie zna tego adresu: łączy się z `/api/rpc`. Lokalnie to proxy Vite (`vite.config.ts`), na Vercel funkcja `api/rpc.ts`, która przepuszcza tylko metody używane przez frontend. Na Vercel ustaw `RPC_URL` w Project → Settings → Environment Variables. Potwierdzenia transakcji idą przez publiczny WebSocket devnetu (`VITE_WS_URL`, bez klucza). Na Netlify (`public/_redirects`) funkcji `/api/rpc` nie ma.

## Adresy (React Router)

| URL | Strona |
|---|---|
| `/` | lejek dla kupujących: kalkulator ochrony, problem, jak działa, porównanie |
| `/katalog` | wszystkie oferty z programu (bez backendu): wyszukiwanie, sortowanie, rezerwa każdej oferty |
| `/statystyki` | publiczny stan protokołu: zablokowane rezerwy, należne, aktywne zakupy, oferty |
| `/sprzedawca` | dla sprzedawców: korzyści, Twoje oferty, wystawienie oferty |
| `/panel` | panel sprzedawcy: wszystkie oferty razem, statusy zakupów, prośby o zwrot, akcje zbiorcze |
| `/oferta/:adres[/:zakładka]` | oferta; sprzedawca: `przeglad`, `analityka`, `symulator`, `kupujacy`, `historia`; kupujący: `oferta`, `przejrzystosc`, `historia` |
| `/portfel/:adres[/kupujacy\|/sprzedawca\|/historia]` | dowolny portfel: rola, zakupy, oferty, historia |
| `/konto` | przekierowanie na portfel połączonego konta |

Nazwa oferty jest on-chain: przy tworzeniu oferty ta sama transakcja zawiera instrukcję SPL Memo `zwrotka:title:<nazwa>`. Katalog i strona oferty czytają ją z najstarszej transakcji konta oferty (`fetchOfferTitle`). Program się nie zmienia. Sprawdzenie na devnecie: `node scripts/catalog-check.ts "Nazwa"`.

Stare linki `/?offer=…` i `/?wallet=…` przekierowują na nowe adresy. Hosting SPA: `vercel.json` (Vercel) i `public/_redirects` (Netlify) kierują każdy adres na `index.html`.

## Pliki

| Plik | Co robi |
|---|---|
| `src/App.tsx` | definicja tras |
| `src/shell.tsx` | nagłówek, nawigacja, stopka, wysyłanie transakcji (`useTx`), powiadomienia |
| `src/pages/` | strony: `Home`, `Catalog`, `Stats`, `Seller`, `Panel`, `OfferPage`, `WalletPage`, `AddressLookup`, `misc` (konto, 404, stare linki) |
| `src/OfferView.tsx` | zawartość strony oferty z zakładkami |
| `src/WalletView.tsx` | zawartość strony portfela |
| `src/funnel.tsx` | miernik ochrony, kroki kupującego, sekcje lejka |
| `src/program.ts` | klient programu: PDA, instrukcje, dekodowanie kont, `due()` jak w programie |
| `src/activity.ts` | historia z transakcji i logów programu (oferta albo portfel) |
| `src/charts.tsx`, `src/PriceChart.tsx` | wykresy |

Kwoty w interfejsie są w zł: 1 zł = 0,0001 SOL (żeby testowy SOL z faucetu wystarczył).
