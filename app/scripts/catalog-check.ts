// Sprawdza katalog na devnecie: tworzy ofertę z nazwą w Memo (portfel CLI),
// czyta nazwę z łańcucha i liczy oferty/zakupy jak strona /katalog.
// node scripts/catalog-check.ts
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { Connection, Keypair, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  createOfferIx,
  fetchAllOffers,
  fetchAllPurchasesByOffer,
  fetchOfferTitle,
  offerPda,
  titleMemoIx,
  toLamports,
} from "../src/program.ts";

const c = new Connection("https://api.devnet.solana.com", "confirmed");
const seller = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(`${homedir()}/.config/solana/id.json`, "utf8"))),
);

const title = process.argv[2] ?? "Bilet: Solana Meetup Kraków";
const offerId = BigInt(Date.now());
const offer = offerPda(seller.publicKey, offerId);
const sig = await sendAndConfirmTransaction(
  c,
  new Transaction().add(
    createOfferIx(seller.publicKey, offerId, toLamports(200), toLamports(170), BigInt(7 * 86400), 0n),
    titleMemoIx(seller.publicKey, title),
  ),
  [seller],
);
console.log("Oferta:", offer.toBase58());
console.log("Transakcja:", sig);

console.log("Nazwa z łańcucha:", await fetchOfferTitle(c, offer));
const offers = await fetchAllOffers(c);
const purchases = await fetchAllPurchasesByOffer(c);
console.log(`Katalog: ${offers.length} ofert, aktywne zakupy w ${purchases.size} ofertach`);
