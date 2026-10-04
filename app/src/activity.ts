// Historia z blockchaina: transakcje + logi programu.
// Widzi też zakupy, które są już rozliczone (ich konta Purchase są zamknięte).
import { Connection, PublicKey, type VersionedTransactionResponse } from "@solana/web3.js";
import { PROGRAM_ID } from "./program";

export type EventKind = "create" | "buy" | "price" | "refund" | "release" | "sellerRefund" | "closeSales";

export type ActivityEvent = {
  sig: string;
  ts: number;
  slot: number;
  kind: EventKind;
  actor: string; // płatnik transakcji
  offer?: string;
  seller?: string;
  buyer?: string;
  amount?: bigint; // cena zakupu / nowa cena / zwrot
  toSeller?: bigint;
  locked?: bigint;
  toBuyer?: bigint;
  fromSeller?: bigint; // dopłata sprzedawcy przy zwrocie zakupu
  until?: number;
  failed?: boolean;
};

export type Totals = {
  sales: number;
  revenue: bigint;
  floorToSeller: bigint;
  refundedToBuyers: bigint; // claim + część release dla kupujących
  releasedToSeller: bigint;
  sellerTopUps: bigint; // ile sprzedawca dopłacił przy zwrotach zakupów
  sellerRefunds: number;
  priceChanges: number;
  buyers: Set<string>;
};

const RE = {
  create: /Offer \d+ created: price (\d+), floor (\d+)/,
  buy: /Bought for (\d+): (\d+) to seller, (\d+) locked until (-?\d+)/,
  price: /Price changed to (\d+)/,
  refund: /Refunded (\d+) to buyer/,
  release: /Released: (\d+) to buyer, (\d+) to seller/,
  // Starsza wersja programu dopisywała ", N back to seller"; obecna już nie (rezerwa idzie w całości do kupującego).
  sellerRefund: /Refund by seller: (\d+) to buyer \((\d+) from reserve, (\d+) from seller\)(?:, (\d+) back to seller)?/,
  closeSales: /Sales closed/,
};

const PROGRAM = PROGRAM_ID.toBase58();

/** Zdarzenia programu z jednej transakcji (pusta lista, jeśli nie dotyczy Zwrotki). */
function parseTx(sig: string, slot: number, tx: VersionedTransactionResponse | null): ActivityEvent[] {
  if (!tx) return [];
  const keys = tx.transaction.message.staticAccountKeys.map((k) => k.toBase58());
  const ix = tx.transaction.message.compiledInstructions.find((i) => keys[i.programIdIndex] === PROGRAM);
  if (!ix) return [];
  // Kolejność kont jak w programie:
  // create [seller, offer], buy [buyer, seller, offer, purchase], set_price [seller, offer],
  // claim [offer, purchase, buyer], release [offer, purchase, buyer, seller],
  // refund_purchase [seller, offer, purchase, buyer, ...], close_sales [seller, offer]
  const a = ix.accountKeyIndexes.map((k) => keys[k]);
  const base = { sig, slot, ts: tx.blockTime ?? 0, actor: keys[0], failed: !!tx.meta?.err };
  const evs: ActivityEvent[] = [];
  for (const l of tx.meta?.logMessages ?? []) {
    let m;
    if ((m = l.match(RE.create)))
      evs.push({ ...base, kind: "create", offer: a[1], seller: a[0], amount: BigInt(m[1]), toSeller: BigInt(m[2]) });
    else if ((m = l.match(RE.buy)))
      evs.push({ ...base, kind: "buy", offer: a[2], seller: a[1], buyer: a[0], amount: BigInt(m[1]), toSeller: BigInt(m[2]), locked: BigInt(m[3]), until: Number(m[4]) });
    else if ((m = l.match(RE.price)))
      evs.push({ ...base, kind: "price", offer: a[1], seller: a[0], amount: BigInt(m[1]) });
    else if ((m = l.match(RE.refund)))
      evs.push({ ...base, kind: "refund", offer: a[0], buyer: a[2], amount: BigInt(m[1]) });
    else if ((m = l.match(RE.release)))
      evs.push({ ...base, kind: "release", offer: a[0], buyer: a[2], seller: a[3], toBuyer: BigInt(m[1]), toSeller: BigInt(m[2]) });
    else if ((m = l.match(RE.sellerRefund)))
      evs.push({ ...base, kind: "sellerRefund", offer: a[1], seller: a[0], buyer: a[3], amount: BigInt(m[1]), fromSeller: BigInt(m[3]), toSeller: BigInt(m[4] ?? "0") });
    else if (RE.closeSales.test(l)) evs.push({ ...base, kind: "closeSales", offer: a[1], seller: a[0] });
  }
  return evs;
}

const cache = new Map<string, ActivityEvent[]>();
const inflight = new Map<string, Promise<ActivityEvent[]>>();

// Osobne połączenie bez wbudowanych ponowień po 429: inaczej web3.js czeka na każde
// odrzucone zapytanie do ~30 s, a my i tak dociągniemy brakujące w kolejnym cyklu.
const fast = new Map<string, Connection>();
function noRetry(c: Connection) {
  let f = fast.get(c.rpcEndpoint);
  if (!f) {
    f = new Connection(c.rpcEndpoint, { commitment: "confirmed", disableRetryOnRateLimit: true });
    fast.set(c.rpcEndpoint, f);
  }
  return f;
}

/** Wszystkie zdarzenia Zwrotki z transakcji danego konta (oferty albo portfela). */
async function load(conn: Connection, address: PublicKey, limit: number): Promise<ActivityEvent[]> {
  const c = noRetry(conn);
  const sigs = await c.getSignaturesForAddress(address, { limit });
  const missing = sigs.filter((s) => !cache.has(s.signature));
  // Po jednej z przerwą: publiczny RPC devnetu ma osobny limit na getTransaction.
  // Błąd (np. 429) pomija tylko tę transakcję; dociągniemy ją w kolejnym cyklu.
  let throttled = 0;
  for (const s of missing) {
    if (throttled >= 3) break; // RPC wyraźnie nas dławi: oddaj to, co już jest
    try {
      const tx = await c.getTransaction(s.signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
      // null = RPC jeszcze nie ma transakcji: nie zapisujemy.
      if (tx) cache.set(s.signature, parseTx(s.signature, s.slot, tx));
      await new Promise((r) => setTimeout(r, 250));
    } catch {
      throttled++;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  // getSignaturesForAddress zwraca od najnowszych; slot porządkuje też zdarzenia z tej samej sekundy.
  return [...sigs].sort((a, b) => a.slot - b.slot).flatMap((s) => cache.get(s.signature) ?? []);
}

/** Jedno pobieranie na konto naraz: kolejne wywołania czekają na trwające. */
function once(c: Connection, address: PublicKey, limit: number) {
  const key = `${address.toBase58()}:${limit}`;
  let p = inflight.get(key);
  if (!p) {
    p = load(c, address, limit).finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

export const fetchActivity = (c: Connection, offer: PublicKey) => once(c, offer, 200);
export const fetchWalletActivity = (c: Connection, wallet: PublicKey, limit = 60) => once(c, wallet, limit);

export type Role = "seller" | "buyer";

/** Rola portfela w zdarzeniu: sprzedawca, kupujący albo obie (np. test na sobie). */
export function rolesIn(e: ActivityEvent, wallet: string): Role[] {
  const r: Role[] = [];
  if (e.seller === wallet) r.push("seller");
  if (e.buyer === wallet) r.push("buyer");
  return r;
}

export function totals(events: ActivityEvent[]): Totals {
  const t: Totals = {
    sales: 0, revenue: 0n, floorToSeller: 0n, refundedToBuyers: 0n, releasedToSeller: 0n,
    sellerTopUps: 0n, sellerRefunds: 0, priceChanges: 0, buyers: new Set(),
  };
  for (const e of events) {
    if (e.failed) continue;
    if (e.kind === "buy") {
      t.sales++;
      t.revenue += e.amount ?? 0n;
      t.floorToSeller += e.toSeller ?? 0n;
      if (e.buyer) t.buyers.add(e.buyer);
    } else if (e.kind === "price") t.priceChanges++;
    else if (e.kind === "refund") t.refundedToBuyers += e.amount ?? 0n;
    else if (e.kind === "release") {
      t.refundedToBuyers += e.toBuyer ?? 0n;
      t.releasedToSeller += e.toSeller ?? 0n;
    } else if (e.kind === "sellerRefund") {
      t.sellerRefunds++;
      t.refundedToBuyers += e.amount ?? 0n;
      t.releasedToSeller += e.toSeller ?? 0n;
      t.sellerTopUps += e.fromSeller ?? 0n;
    }
  }
  return t;
}
