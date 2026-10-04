// Sprawdza anulowanie na devnecie: oferta (portfel CLI), zakup przez nowy portfel,
// prośba o zwrot, pełny zwrot sprzedawcy, zakończenie sprzedaży.
// node scripts/cancel-check.ts
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
  closeSalesIx,
  createOfferIx,
  fetchOffer,
  fetchPurchase,
  fetchRefundRequests,
  fmtZl,
  offerPda,
  purchasePda,
  refundPurchaseIx,
  requestRefundIx,
  titleMemoIx,
  toLamports,
} from "../src/program.ts";

const c = new Connection("https://api.devnet.solana.com", "confirmed");
const seller = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(`${homedir()}/.config/solana/id.json`, "utf8"))),
);
const ania = Keypair.generate();
const send = (ixs: TransactionInstruction[], ...signers: Keypair[]) =>
  sendAndConfirmTransaction(c, new Transaction().add(...ixs), signers);

await send([SystemProgram.transfer({ fromPubkey: seller.publicKey, toPubkey: ania.publicKey, lamports: 20_000_000 })], seller);

const offerId = BigInt(Date.now());
const offer = offerPda(seller.publicKey, offerId);
await send(
  [
    createOfferIx(seller.publicKey, offerId, toLamports(100), toLamports(80), BigInt(86400), 0n),
    titleMemoIx(seller.publicKey, "Warsztaty (test anulowania)"),
  ],
  seller,
);
let o = (await fetchOffer(c, offer))!;
await send([buyIx(ania.publicKey, o)], ania);
const purchase = purchasePda(offer, ania.publicKey);
console.log("Zakup za", fmtZl(o.price));

await send([requestRefundIx(ania.publicKey, purchase, "Zajęcia odwołane")], ania);
const reqs = await fetchRefundRequests(c, offer);
console.log("Prośba o zwrot:", reqs.get(purchase.toBase58())?.reason);

const p = (await fetchPurchase(c, purchase))!;
const before = await c.getBalance(ania.publicKey);
const sig = await send(
  [closeSalesIx(seller.publicKey, offer), refundPurchaseIx(seller.publicKey, offer, p, p.paid, true)],
  seller,
);
console.log("Anulowanie:", sig);
console.log("Ania +", fmtZl(BigInt((await c.getBalance(ania.publicKey)) - before)), "(cena + rent zakupu i prośby)");
console.log("Zakup zamknięty:", (await c.getAccountInfo(purchase)) === null);
o = (await fetchOffer(c, offer))!;
console.log("Sprzedaż zakończona:", o.closed);
console.log("OK");
