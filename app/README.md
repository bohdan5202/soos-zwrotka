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

| Plik | Co robi |
|---|---|
| `src/program.ts` | klient programu: PDA, instrukcje, dekodowanie kont, `due()` jak w programie |
| `src/activity.ts` | historia oferty z transakcji i logów programu |
| `src/OfferView.tsx` | strona oferty z zakładkami (sprzedawca / kupujący) |
| `src/charts.tsx`, `src/PriceChart.tsx` | wykresy |
| `src/App.tsx` | nagłówek, strona główna, tworzenie oferty |

Kwoty w interfejsie są w zł: 1 zł = 0,0001 SOL (żeby testowy SOL z faucetu wystarczył).
