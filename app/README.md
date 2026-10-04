# Zwrotka: frontend

Vite + React + TypeScript, portfel przez Wallet Adapter (Phantom), Solana devnet.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # produkcyjny build do dist/
node scripts/smoke-devnet.ts   # cały scenariusz demo na devnecie z portfela CLI
```

Opcjonalnie własny RPC (publiczny devnet ma niskie limity), w `app/.env.local`:

```
VITE_RPC_URL=https://devnet.helius-rpc.com/?api-key=...
```

## Adresy (React Router)

| URL | Strona |
|---|---|
| `/` | lejek dla kupujących: kalkulator ochrony, problem, jak działa, porównanie |
| `/sprzedawca` | dla sprzedawców: korzyści, Twoje oferty, wystawienie oferty |
| `/oferta/:adres[/:zakładka]` | oferta; sprzedawca: `przeglad`, `analityka`, `symulator`, `kupujacy`, `historia`; kupujący: `oferta`, `przejrzystosc`, `historia` |
| `/portfel/:adres[/kupujacy\|/sprzedawca\|/historia]` | dowolny portfel: rola, zakupy, oferty, historia |
| `/konto` | przekierowanie na portfel połączonego konta |

Stare linki `/?offer=…` i `/?wallet=…` przekierowują na nowe adresy. Hosting SPA: `vercel.json` (Vercel) i `public/_redirects` (Netlify) kierują każdy adres na `index.html`.

## Pliki

| Plik | Co robi |
|---|---|
| `src/App.tsx` | definicja tras |
| `src/shell.tsx` | nagłówek, nawigacja, stopka, wysyłanie transakcji (`useTx`), powiadomienia |
| `src/pages/` | strony: `Home`, `Seller`, `OfferPage`, `WalletPage`, `AddressLookup`, `misc` (konto, 404, stare linki) |
| `src/OfferView.tsx` | zawartość strony oferty z zakładkami |
| `src/WalletView.tsx` | zawartość strony portfela |
| `src/funnel.tsx` | miernik ochrony, kroki kupującego, sekcje lejka |
| `src/program.ts` | klient programu: PDA, instrukcje, dekodowanie kont, `due()` jak w programie |
| `src/activity.ts` | historia z transakcji i logów programu (oferta albo portfel) |
| `src/charts.tsx`, `src/PriceChart.tsx` | wykresy |

Kwoty w interfejsie są w zł: 1 zł = 0,0001 SOL (żeby testowy SOL z faucetu wystarczył).
