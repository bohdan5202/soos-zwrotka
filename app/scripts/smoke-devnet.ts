// Scenariusz demo na devnecie bez przeglądarki: node scripts/smoke-devnet.ts
// Sprzedawca = portfel CLI (~/.config/solana/id.json), kupujący = dwa nowe portfele
// zasilone z portfela CLI.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  buyIx,
  claimIx,
  createOfferIx,
  due,
  fetchOffer,
  fetchPurchase,
  fetchPurchases,
  fmtZl,
  offerPda,
  purchasePda,
  releaseIx,
  setPriceIx,
  toLamports,
} from "../src/program.ts";

const c = new Connection("https://api.devnet.solana.com", "confirmed");
const seller = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(`${homedir()}/.config/solana/id.json`, "utf8"))),
);
const ania = Keypair.generate();
const bartek = Keypair.generate();

const send = (ix: TransactionInstruction, ...signers: Keypair[]) =>
  sendAndConfirmTransaction(c, new Transaction().add(ix), signers);
const bal = async (k: Keypair) => (await c.getBalance(k.publicKey)) / 1e9;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

for (const k of [ania, bartek]) {
  await send(
    SystemProgram.transfer({ fromPubkey: seller.publicKey, toPubkey: k.publicKey, lamports: 150_000_000 }),
    seller,
  );
}
console.log("Kupujący zasileni po 0.15 SOL");

const offerId = BigInt(Date.now());
const offer = offerPda(seller.publicKey, offerId);
let sig = await send(
  createOfferIx(seller.publicKey, offerId, toLamports(1000), toLamports(800), 20n, 0n),
  seller,
);
console.log("create_offer", sig);

let o = (await fetchOffer(c, offer))!;
console.log("Oferta:", fmtZl(o.price), "floor", fmtZl(o.floor));

const sellerBefore = await c.getBalance(seller.publicKey);
sig = await send(buyIx(ania.publicKey, o), ania);
console.log("buy (Ania)", sig);
console.log("Sprzedawca dostał:", fmtZl(BigInt((await c.getBalance(seller.publicKey)) - sellerBefore)));

sig = await send(setPriceIx(seller.publicKey, offer, toLamports(850)), seller);
console.log("set_price 850", sig);
o = (await fetchOffer(c, offer))!;
sig = await send(buyIx(bartek.publicKey, o), bartek);
console.log("buy (Bartek)", sig);

let p = (await fetchPurchase(c, purchasePda(offer, ania.publicKey)))!;
console.log("Ani należy się:", fmtZl(due(p, o)));

const aniaBefore = await bal(ania);
sig = await send(claimIx(offer, p), bartek); // płaci Bartek, bez podpisu Ani i sprzedawcy
console.log("claim_difference (podpis tylko Bartka)", sig);
console.log("Ania +", ((await bal(ania)) - aniaBefore).toFixed(4), "SOL (oczekiwane 0.0150)");

console.log("Zakupy w ofercie:", (await fetchPurchases(c, offer)).length);

console.log("Czekam 25 s na koniec okna…");
await sleep(25_000);
p = (await fetchPurchase(c, purchasePda(offer, ania.publicKey)))!;
sig = await send(releaseIx(o, p), bartek);
console.log("release (Ania)", sig);
console.log("Konto zakupu Ani zamknięte:", (await c.getAccountInfo(p.address)) === null);
console.log("OK");
