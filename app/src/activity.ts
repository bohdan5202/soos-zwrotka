// Pełna historia oferty z blockchaina: transakcje konta oferty + logi programu.
// Widzi też zakupy, które są już rozliczone (ich konta Purchase są zamknięte).
import { Connection, PublicKey } from "@solana/web3.js";

export type EventKind = "create" | "buy" | "price" | "refund" | "release";

export type ActivityEvent = {
  sig: string;
  ts: number;
  kind: EventKind;
  actor: string; // płatnik transakcji
  buyer?: string;
  amount?: bigint; // cena zakupu / nowa cena / zwrot
  toSeller?: bigint;
  locked?: bigint;
  toBuyer?: bigint;
  until?: number;
  failed?: boolean;
};

export type Totals = {
  sales: number;
  revenue: bigint;
  floorToSeller: bigint;
  refundedToBuyers: bigint; // claim + część release dla kupujących
  releasedToSeller: bigint;
  priceChanges: number;
  buyers: Set<string>;
};

const RE = {
  create: /Offer \d+ created: price (\d+), floor (\d+)/,
  buy: /Bought for (\d+): (\d+) to seller, (\d+) locked until (-?\d+)/,
  price: /Price changed to (\d+)/,
  refund: /Refunded (\d+) to buyer/,
  release: /Released: (\d+) to buyer, (\d+) to seller/,
};

const cache = new Map<string, ActivityEvent[]>();

let inflight: Promise<ActivityEvent[]> | null = null;

/** Jedno pobieranie naraz: kolejne wywołania czekają na trwające. */
export function fetchActivity(c: Connection, offer: PublicKey): Promise<ActivityEvent[]> {
  if (!inflight) inflight = load(c, offer).finally(() => (inflight = null));
  return inflight;
}

async function load(c: Connection, offer: PublicKey): Promise<ActivityEvent[]> {
  const sigs = await c.getSignaturesForAddress(offer, { limit: 200 });
  const missing = sigs.filter((s) => !cache.has(s.signature));
  // Po dwie naraz z przerwą, żeby nie trafić w limit (429) publicznego RPC devnetu.
  for (let i = 0; i < missing.length; i += 2) {
    const batch = missing.slice(i, i + 2);
    if (i > 0) await new Promise((r) => setTimeout(r, 400));
    const txs = await Promise.all(
      batch.map((s) =>
        c.getTransaction(s.signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" }),
      ),
    );
    txs.forEach((tx, j) => {
      const sig = batch[j].signature;
      if (!tx) return;
      const keys = tx.transaction.message.staticAccountKeys.map((k) => k.toBase58());
      const actor = keys[0];
      const ts = tx.blockTime ?? 0;
      const failed = !!tx.meta?.err;
      const logs = tx.meta?.logMessages ?? [];
      // konto kupującego z instrukcji (claim/release: 3. konto; buy: 1. konto)
      const ixAccounts = tx.transaction.message.compiledInstructions.map((ix) =>
        ix.accountKeyIndexes.map((k) => keys[k]),
      );
      const progIx = tx.transaction.message.compiledInstructions.findIndex(
        (ix) => keys[ix.programIdIndex] === "44sG9n516FQKsDNC2uwyKPUKSksyDLH4ypzsVHgJGGB7",
      );
      const accs = progIx >= 0 ? ixAccounts[progIx] : [];
      const evs: ActivityEvent[] = [];
      for (const l of logs) {
        let m;
        if ((m = l.match(RE.create))) evs.push({ sig, ts, actor, failed, kind: "create", amount: BigInt(m[1]), toSeller: BigInt(m[2]) });
        else if ((m = l.match(RE.buy)))
          evs.push({ sig, ts, actor, failed, kind: "buy", buyer: accs[0], amount: BigInt(m[1]), toSeller: BigInt(m[2]), locked: BigInt(m[3]), until: Number(m[4]) });
        else if ((m = l.match(RE.price))) evs.push({ sig, ts, actor, failed, kind: "price", amount: BigInt(m[1]) });
        else if ((m = l.match(RE.refund))) evs.push({ sig, ts, actor, failed, kind: "refund", buyer: accs[2], amount: BigInt(m[1]) });
        else if ((m = l.match(RE.release)))
          evs.push({ sig, ts, actor, failed, kind: "release", buyer: accs[2], toBuyer: BigInt(m[1]), toSeller: BigInt(m[2]) });
      }
      cache.set(sig, evs);
    });
  }
  // getSignaturesForAddress zwraca od najnowszych; slot porządkuje też zdarzenia z tej samej sekundy.
  return [...sigs]
    .sort((a, b) => a.slot - b.slot)
    .flatMap((s) => cache.get(s.signature) ?? []);
}

export function totals(events: ActivityEvent[]): Totals {
  const t: Totals = {
    sales: 0, revenue: 0n, floorToSeller: 0n, refundedToBuyers: 0n, releasedToSeller: 0n, priceChanges: 0, buyers: new Set(),
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
    }
  }
  return t;
}
