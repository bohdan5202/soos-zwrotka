// Klient programu zwrotka bez SDK Anchora: instrukcje i konta
// kodujemy ręcznie według target/idl/zwrotka.json.
import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { Buffer } from "buffer";

export const PROGRAM_ID = new PublicKey(
  "44sG9n516FQKsDNC2uwyKPUKSksyDLH4ypzsVHgJGGB7",
);

// Demo: 1 zł = 0,0001 SOL, żeby faucet wystarczył.
export const LAMPORTS_PER_ZL = 100_000n;
export const toLamports = (zl: number) =>
  BigInt(Math.round(zl * 100)) * (LAMPORTS_PER_ZL / 100n);
export const toZl = (lamports: bigint) =>
  Number(lamports) / Number(LAMPORTS_PER_ZL);
export const fmtZl = (lamports: bigint) =>
  `${toZl(lamports).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} zł`;

const DISC = {
  createOffer: [237, 233, 192, 168, 248, 7, 249, 241],
  buy: [102, 6, 61, 18, 1, 218, 235, 234],
  setPrice: [16, 19, 182, 8, 149, 83, 72, 181],
  claimDifference: [166, 248, 204, 254, 109, 173, 25, 72],
  release: [253, 249, 15, 206, 28, 127, 193, 241],
  offer: [215, 88, 60, 71, 170, 162, 73, 229],
  purchase: [33, 203, 1, 252, 231, 228, 8, 67],
};

const enc = new TextEncoder();

function u64(n: bigint) {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, true);
  return b;
}
function i64(n: bigint) {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigInt64(0, n, true);
  return b;
}
function concat(...parts: (number[] | Uint8Array)[]) {
  return Buffer.concat(parts.map((p) => Buffer.from(Uint8Array.from(p))));
}

export function offerPda(seller: PublicKey, offerId: bigint) {
  return PublicKey.findProgramAddressSync(
    [enc.encode("offer"), seller.toBytes(), u64(offerId)],
    PROGRAM_ID,
  )[0];
}

export function purchasePda(offer: PublicKey, buyer: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [enc.encode("purchase"), offer.toBytes(), buyer.toBytes()],
    PROGRAM_ID,
  )[0];
}

// ---------- Konta ----------

export type PricePoint = { ts: bigint; price: bigint };

export type Offer = {
  address: PublicKey;
  seller: PublicKey;
  offerId: bigint;
  price: bigint;
  floor: bigint;
  windowSecs: bigint;
  eventStart: bigint;
  history: PricePoint[];
};

export type Purchase = {
  address: PublicKey;
  offer: PublicKey;
  buyer: PublicKey;
  paid: bigint;
  reserve: bigint;
  claimed: bigint;
  boughtAt: bigint;
  windowEnd: bigint;
  firstChange: number;
};

class Reader {
  private o = 8; // pomijamy dyskryminator
  private d: Uint8Array;
  private v: DataView;
  constructor(d: Uint8Array) {
    this.d = d;
    this.v = new DataView(d.buffer, d.byteOffset, d.byteLength);
  }
  pubkey() {
    const k = new PublicKey(this.d.slice(this.o, this.o + 32));
    this.o += 32;
    return k;
  }
  u64() {
    const n = this.v.getBigUint64(this.o, true);
    this.o += 8;
    return n;
  }
  i64() {
    const n = this.v.getBigInt64(this.o, true);
    this.o += 8;
    return n;
  }
  u32() {
    const n = this.v.getUint32(this.o, true);
    this.o += 4;
    return n;
  }
}

function hasDisc(data: Uint8Array, disc: number[]) {
  return disc.every((b, i) => data[i] === b);
}

export function decodeOffer(address: PublicKey, data: Uint8Array): Offer {
  if (!hasDisc(data, DISC.offer)) throw new Error("To nie jest konto Offer");
  const r = new Reader(data);
  const seller = r.pubkey();
  const offerId = r.u64();
  const price = r.u64();
  const floor = r.u64();
  const windowSecs = r.i64();
  const eventStart = r.i64();
  const len = r.u32();
  const history: PricePoint[] = [];
  for (let i = 0; i < len; i++) history.push({ ts: r.i64(), price: r.u64() });
  return { address, seller, offerId, price, floor, windowSecs, eventStart, history };
}

export function decodePurchase(address: PublicKey, data: Uint8Array): Purchase {
  const r = new Reader(data);
  return {
    address,
    offer: r.pubkey(),
    buyer: r.pubkey(),
    paid: r.u64(),
    reserve: r.u64(),
    claimed: r.u64(),
    boughtAt: r.i64(),
    windowEnd: r.i64(),
    firstChange: r.u32(),
  };
}

/** Ta sama formuła co `Purchase::due` w programie. */
export function due(p: Purchase, offer: Offer): bigint {
  let lowest = p.paid;
  for (const pt of offer.history.slice(p.firstChange)) {
    if (pt.ts <= p.windowEnd && pt.price < lowest) lowest = pt.price;
  }
  let entitled = p.paid > lowest ? p.paid - lowest : 0n;
  if (entitled > p.reserve) entitled = p.reserve;
  return entitled > p.claimed ? entitled - p.claimed : 0n;
}

/** Ile kupującemu przysługuje łącznie (odebrane + należne), gdyby najniższa cena w oknie była `lowest`. */
function entitlement(p: Purchase, lowest: bigint): bigint {
  const diff = p.paid > lowest ? p.paid - lowest : 0n;
  return diff < p.reserve ? diff : p.reserve;
}

export type SellerStats = {
  count: number;
  revenue: bigint; // suma zapłacona przez aktywnych kupujących
  received: bigint; // floor, który sprzedawca już dostał
  locked: bigint; // rezerwa jeszcze w programie
  refunded: bigint; // już wypłacone zwroty
  owedNow: bigint; // należne kupującym teraz
  backToSeller: bigint; // wróci do sprzedawcy, jeśli cena już nie spadnie
  maxFurtherCost: bigint; // najgorszy przypadek: dalsze obniżki w otwartych oknach
  openWindows: number;
  nextWindowEnd: bigint | null;
};

export function sellerStats(offer: Offer, purchases: Purchase[], now: number): SellerStats {
  const s: SellerStats = {
    count: purchases.length, revenue: 0n, received: 0n, locked: 0n, refunded: 0n,
    owedNow: 0n, backToSeller: 0n, maxFurtherCost: 0n, openWindows: 0, nextWindowEnd: null,
  };
  for (const p of purchases) {
    const d = due(p, offer);
    const left = p.reserve - p.claimed;
    s.revenue += p.paid;
    s.received += p.paid - p.reserve;
    s.locked += left;
    s.refunded += p.claimed;
    s.owedNow += d;
    s.backToSeller += left - d;
    if (Number(p.windowEnd) > now) {
      s.openWindows++;
      s.maxFurtherCost += left - d;
      if (s.nextWindowEnd === null || p.windowEnd < s.nextWindowEnd) s.nextWindowEnd = p.windowEnd;
    }
  }
  return s;
}

/** Koszt obniżki do `newPrice` teraz: dodatkowe zwroty dla kupujących z otwartym oknem. */
export function simulatePriceCost(offer: Offer, purchases: Purchase[], newPrice: bigint, now: number) {
  let cost = 0n;
  let affected = 0;
  for (const p of purchases) {
    if (Number(p.windowEnd) <= now) continue;
    const current = p.claimed + due(p, offer);
    const lowest = offer.history
      .slice(p.firstChange)
      .filter((pt) => pt.ts <= p.windowEnd)
      .reduce((m, pt) => (pt.price < m ? pt.price : m), p.paid);
    const after = entitlement(p, newPrice < lowest ? newPrice : lowest);
    if (after > current) {
      cost += after - current;
      affected++;
    }
  }
  return { cost, affected };
}

export async function fetchOffer(c: Connection, address: PublicKey) {
  const acc = await c.getAccountInfo(address);
  return acc ? decodeOffer(address, acc.data) : null;
}

export async function fetchPurchase(c: Connection, address: PublicKey) {
  const acc = await c.getAccountInfo(address);
  return acc ? decodePurchase(address, acc.data) : null;
}

/** Aktywne zakupy danego kupującego (buyer leży po dyskryminatorze i polu offer: offset 40). */
export async function fetchBuyerPurchases(c: Connection, buyer: PublicKey) {
  const accs = await c.getProgramAccounts(PROGRAM_ID, {
    filters: [
      { memcmp: { offset: 0, bytes: bs58Disc(DISC.purchase) } },
      { memcmp: { offset: 40, bytes: buyer.toBase58() } },
    ],
  });
  return accs.map((a) => decodePurchase(a.pubkey, a.account.data));
}

/** Wszystkie oferty danego sprzedawcy (seller leży zaraz po dyskryminatorze). */
export async function fetchSellerOffers(c: Connection, seller: PublicKey) {
  const accs = await c.getProgramAccounts(PROGRAM_ID, {
    filters: [
      { memcmp: { offset: 0, bytes: bs58Disc(DISC.offer) } },
      { memcmp: { offset: 8, bytes: seller.toBase58() } },
    ],
  });
  return accs.map((a) => decodeOffer(a.pubkey, a.account.data));
}

/** Czas utworzenia oferty (blockTime najstarszej transakcji konta). */
export async function fetchCreatedAt(c: Connection, address: PublicKey) {
  const sigs = await c.getSignaturesForAddress(address, { limit: 1000 });
  const oldest = sigs[sigs.length - 1];
  return oldest?.blockTime ?? null;
}

export async function fetchPurchases(c: Connection, offer: PublicKey) {
  const accs = await c.getProgramAccounts(PROGRAM_ID, {
    filters: [
      { memcmp: { offset: 0, bytes: bs58Disc(DISC.purchase) } },
      { memcmp: { offset: 8, bytes: offer.toBase58() } },
    ],
  });
  return accs.map((a) => decodePurchase(a.pubkey, a.account.data));
}

function bs58Disc(disc: number[]) {
  // memcmp przyjmuje base58; dyskryminator kodujemy przez PublicKey-free helper
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = BigInt("0x" + Buffer.from(disc).toString("hex"));
  let out = "";
  while (n > 0n) {
    out = ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of disc) {
    if (b === 0) out = "1" + out;
    else break;
  }
  return out;
}

// ---------- Instrukcje ----------

export function createOfferIx(
  seller: PublicKey,
  offerId: bigint,
  price: bigint,
  floor: bigint,
  windowSecs: bigint,
  eventStart: bigint,
) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: seller, isSigner: true, isWritable: true },
      { pubkey: offerPda(seller, offerId), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: concat(
      DISC.createOffer,
      u64(offerId),
      u64(price),
      u64(floor),
      i64(windowSecs),
      i64(eventStart),
    ),
  });
}

export function buyIx(buyer: PublicKey, offer: Offer) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: buyer, isSigner: true, isWritable: true },
      { pubkey: offer.seller, isSigner: false, isWritable: true },
      { pubkey: offer.address, isSigner: false, isWritable: false },
      { pubkey: purchasePda(offer.address, buyer), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: concat(DISC.buy),
  });
}

export function setPriceIx(seller: PublicKey, offer: PublicKey, newPrice: bigint) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: seller, isSigner: true, isWritable: false },
      { pubkey: offer, isSigner: false, isWritable: true },
    ],
    data: concat(DISC.setPrice, u64(newPrice)),
  });
}

/** Nie wymaga podpisu sprzedawcy ani kupującego: płaci ten, kto wysyła. */
export function claimIx(offer: PublicKey, purchase: Purchase) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: offer, isSigner: false, isWritable: false },
      { pubkey: purchase.address, isSigner: false, isWritable: true },
      { pubkey: purchase.buyer, isSigner: false, isWritable: true },
    ],
    data: concat(DISC.claimDifference),
  });
}

export function releaseIx(offer: Offer, purchase: Purchase) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: offer.address, isSigner: false, isWritable: false },
      { pubkey: purchase.address, isSigner: false, isWritable: true },
      { pubkey: purchase.buyer, isSigner: false, isWritable: true },
      { pubkey: offer.seller, isSigner: false, isWritable: true },
    ],
    data: concat(DISC.release),
  });
}

// ---------- Nazwa oferty on-chain (SPL Memo w transakcji utworzenia) ----------

export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const TITLE_PREFIX = "zwrotka:title:";

/** Instrukcja Memo z nazwą oferty; dodawana do tej samej transakcji co create_offer. */
export function titleMemoIx(signer: PublicKey, title: string) {
  return new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    data: Buffer.from(TITLE_PREFIX + title.slice(0, 120), "utf8"),
  });
}

/** Wszystkie oferty w programie (katalog). */
export async function fetchAllOffers(c: Connection) {
  const accs = await c.getProgramAccounts(PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: bs58Disc(DISC.offer) } }],
  });
  return accs.map((a) => decodeOffer(a.pubkey, a.account.data));
}

/** Wszystkie aktywne zakupy w programie, pogrupowane po ofercie. */
export async function fetchAllPurchasesByOffer(c: Connection) {
  const accs = await c.getProgramAccounts(PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: bs58Disc(DISC.purchase) } }],
  });
  const by = new Map<string, Purchase[]>();
  for (const a of accs) {
    const p = decodePurchase(a.pubkey, a.account.data);
    const k = p.offer.toBase58();
    by.set(k, [...(by.get(k) ?? []), p]);
  }
  return by;
}

// Nazwa w transakcji utworzenia się nie zmienia, więc trzymamy ją w localStorage na stałe.
const TITLE_CACHE = "zwrotka:titles";
export function readTitles(): Record<string, string | null> {
  try {
    return JSON.parse(localStorage.getItem(TITLE_CACHE) ?? "{}");
  } catch {
    return {};
  }
}

/** Nazwa oferty z Memo w najstarszej transakcji konta; null, jeśli oferta jej nie ma. */
export async function fetchOfferTitle(c: Connection, offer: PublicKey): Promise<string | null> {
  const key = offer.toBase58();
  const cached = readTitles();
  if (key in cached) return cached[key];
  const sigs = await c.getSignaturesForAddress(offer, { limit: 1000 });
  const oldest = sigs[sigs.length - 1];
  if (!oldest) return null;
  const tx = await c.getTransaction(oldest.signature, { maxSupportedTransactionVersion: 0 });
  if (!tx) return null; // nie zapisujemy: spróbujemy później
  const keys = tx.transaction.message.staticAccountKeys;
  let title: string | null = null;
  for (const ix of tx.transaction.message.compiledInstructions) {
    if (!keys[ix.programIdIndex].equals(MEMO_PROGRAM_ID)) continue;
    const text = new TextDecoder().decode(ix.data);
    if (text.startsWith(TITLE_PREFIX)) title = text.slice(TITLE_PREFIX.length);
  }
  try {
    localStorage.setItem(TITLE_CACHE, JSON.stringify({ ...readTitles(), [key]: title }));
  } catch {
    /* bez cache: pobierzemy ponownie następnym razem */
  }
  return title;
}

export const explorerTx = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
export const explorerAddr = (a: PublicKey) =>
  `https://explorer.solana.com/address/${a.toBase58()}?cluster=devnet`;
