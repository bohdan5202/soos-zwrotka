use {
    anchor_lang::{
        prelude::{Clock, Pubkey},
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    zwrotka::{
        constants::{OFFER_SEED, PURCHASE_SEED},
        state::{Offer, Purchase},
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const SOL: u64 = 1_000_000_000;
const DAY: i64 = 24 * 60 * 60;

// Scenariusz z demo: kurs 1000, floor 800 (gwarancja do 20%), 30 dni.
const PRICE: u64 = SOL; // "1000 zł"
const FLOOR: u64 = SOL * 8 / 10; // "800 zł"

struct Env {
    svm: LiteSVM,
    seller: Keypair,
    ania: Keypair,
    bartek: Keypair,
    offer: Pubkey,
}

fn offer_pda(seller: &Pubkey, offer_id: u64) -> Pubkey {
    Pubkey::find_program_address(
        &[OFFER_SEED, seller.as_ref(), &offer_id.to_le_bytes()],
        &zwrotka::id(),
    )
    .0
}

fn purchase_pda(offer: &Pubkey, buyer: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[PURCHASE_SEED, offer.as_ref(), buyer.as_ref()],
        &zwrotka::id(),
    )
    .0
}

impl Env {
    /// Oferta z oknem `window_secs` od zakupu i opcjonalną datą wydarzenia.
    fn new(window_secs: i64, event_start: i64) -> Self {
        let mut svm = LiteSVM::new();
        let bytes = include_bytes!(concat!(
            env!("CARGO_TARGET_TMPDIR"),
            "/../deploy/zwrotka.so"
        ));
        svm.add_program(zwrotka::id(), bytes).unwrap();
        let (seller, ania, bartek) = (Keypair::new(), Keypair::new(), Keypair::new());
        for k in [&seller, &ania, &bartek] {
            svm.airdrop(&k.pubkey(), 10 * SOL).unwrap();
        }
        let offer = offer_pda(&seller.pubkey(), 1);
        let mut env = Env {
            svm,
            seller,
            ania,
            bartek,
            offer,
        };
        env.set_time(1_000_000);
        let ix = Instruction::new_with_bytes(
            zwrotka::id(),
            &zwrotka::instruction::CreateOffer {
                offer_id: 1,
                price: PRICE,
                floor: FLOOR,
                window_secs,
                event_start,
            }
            .data(),
            zwrotka::accounts::CreateOffer {
                seller: env.seller.pubkey(),
                offer: env.offer,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        env.send(ix, &env.seller.insecure_clone()).unwrap();
        env
    }

    fn send(&mut self, ix: Instruction, payer: &Keypair) -> Result<(), String> {
        self.svm.expire_blockhash();
        let blockhash = self.svm.latest_blockhash();
        let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &blockhash);
        let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer]).unwrap();
        self.svm
            .send_transaction(tx)
            .map(|_| ())
            .map_err(|e| format!("{:?}", e.meta.logs))
    }

    fn now(&self) -> i64 {
        self.svm.get_sysvar::<Clock>().unix_timestamp
    }

    fn set_time(&mut self, ts: i64) {
        let mut clock = self.svm.get_sysvar::<Clock>();
        clock.unix_timestamp = ts;
        self.svm.set_sysvar(&clock);
    }

    fn advance(&mut self, secs: i64) {
        let ts = self.now() + secs;
        self.set_time(ts);
    }

    fn balance(&self, key: &Pubkey) -> u64 {
        self.svm.get_balance(key).unwrap_or(0)
    }

    fn offer_state(&self) -> Offer {
        let acc = self.svm.get_account(&self.offer).unwrap();
        Offer::try_deserialize(&mut acc.data.as_slice()).unwrap()
    }

    fn purchase_state(&self, buyer: &Pubkey) -> Purchase {
        let acc = self
            .svm
            .get_account(&purchase_pda(&self.offer, buyer))
            .unwrap();
        Purchase::try_deserialize(&mut acc.data.as_slice()).unwrap()
    }

    fn buy(&mut self, buyer: &Keypair) -> Result<(), String> {
        let ix = Instruction::new_with_bytes(
            zwrotka::id(),
            &zwrotka::instruction::Buy {}.data(),
            zwrotka::accounts::Buy {
                buyer: buyer.pubkey(),
                seller: self.seller.pubkey(),
                offer: self.offer,
                purchase: purchase_pda(&self.offer, &buyer.pubkey()),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        self.send(ix, buyer)
    }

    fn set_price(&mut self, signer: &Keypair, new_price: u64) -> Result<(), String> {
        let ix = Instruction::new_with_bytes(
            zwrotka::id(),
            &zwrotka::instruction::SetPrice { new_price }.data(),
            zwrotka::accounts::SetPrice {
                seller: signer.pubkey(),
                offer: self.offer,
            }
            .to_account_metas(None),
        );
        self.send(ix, signer)
    }

    /// `caller` płaci za transakcję; pieniądze zawsze idą do `buyer`.
    fn claim(&mut self, buyer: &Pubkey, caller: &Keypair) -> Result<(), String> {
        let ix = Instruction::new_with_bytes(
            zwrotka::id(),
            &zwrotka::instruction::ClaimDifference {}.data(),
            zwrotka::accounts::ClaimDifference {
                offer: self.offer,
                purchase: purchase_pda(&self.offer, buyer),
                buyer: *buyer,
            }
            .to_account_metas(None),
        );
        self.send(ix, caller)
    }

    fn release(&mut self, buyer: &Pubkey, caller: &Keypair) -> Result<(), String> {
        let ix = Instruction::new_with_bytes(
            zwrotka::id(),
            &zwrotka::instruction::Release {}.data(),
            zwrotka::accounts::Release {
                offer: self.offer,
                purchase: purchase_pda(&self.offer, buyer),
                buyer: *buyer,
                seller: self.seller.pubkey(),
            }
            .to_account_metas(None),
        );
        self.send(ix, caller)
    }
}

#[test]
fn buy_splits_payment_into_floor_and_reserve() {
    let mut env = Env::new(30 * DAY, 0);
    let seller_before = env.balance(&env.seller.pubkey());
    let ania = env.ania.insecure_clone();
    env.buy(&ania).unwrap();

    assert_eq!(env.balance(&env.seller.pubkey()) - seller_before, FLOOR);
    let p = env.purchase_state(&ania.pubkey());
    assert_eq!(p.paid, PRICE);
    assert_eq!(p.reserve, PRICE - FLOOR);
    assert_eq!(p.window_end, env.now() + 30 * DAY);
}

#[test]
fn demo_flow_price_drop_and_claim_without_seller() {
    let mut env = Env::new(30 * DAY, 0);
    let (ania, bartek, seller) = (
        env.ania.insecure_clone(),
        env.bartek.insecure_clone(),
        env.seller.insecure_clone(),
    );
    env.buy(&ania).unwrap();
    env.advance(DAY);
    env.set_price(&seller, SOL * 85 / 100).unwrap(); // Black Friday: 850
    env.buy(&bartek).unwrap();

    // Bartek płaci za transakcję zwrotu Ani: bez podpisu Ani i sprzedawcy.
    let ania_before = env.balance(&ania.pubkey());
    env.claim(&ania.pubkey(), &bartek).unwrap();
    assert_eq!(env.balance(&ania.pubkey()) - ania_before, SOL * 15 / 100);
    assert_eq!(env.purchase_state(&ania.pubkey()).claimed, SOL * 15 / 100);

    // Drugi raz nic się nie należy.
    assert!(env.claim(&ania.pubkey(), &ania).is_err());
}

#[test]
fn price_increase_gives_nothing() {
    let mut env = Env::new(30 * DAY, 0);
    let (ania, seller) = (env.ania.insecure_clone(), env.seller.insecure_clone());
    env.buy(&ania).unwrap();
    env.set_price(&seller, SOL * 12 / 10).unwrap();
    assert!(env.claim(&ania.pubkey(), &ania).is_err());
}

#[test]
fn deep_discount_below_floor_is_capped_at_reserve() {
    let mut env = Env::new(30 * DAY, 0);
    let (ania, seller) = (env.ania.insecure_clone(), env.seller.insecure_clone());
    env.buy(&ania).unwrap();
    env.set_price(&seller, SOL * 6 / 10).unwrap(); // 600, poniżej floor 800

    let before = env.balance(&ania.pubkey());
    env.claim(&ania.pubkey(), &ania).unwrap();
    // Opłata za transakcję (5000 lamportów) płaci Ania.
    assert_eq!(env.balance(&ania.pubkey()) + 5000 - before, PRICE - FLOOR);
}

#[test]
fn two_drops_claim_cumulatively() {
    let mut env = Env::new(30 * DAY, 0);
    let (ania, bartek, seller) = (
        env.ania.insecure_clone(),
        env.bartek.insecure_clone(),
        env.seller.insecure_clone(),
    );
    env.buy(&ania).unwrap();
    env.set_price(&seller, SOL * 9 / 10).unwrap();
    env.claim(&ania.pubkey(), &bartek).unwrap();
    env.set_price(&seller, SOL * 7 / 10).unwrap();
    env.claim(&ania.pubkey(), &bartek).unwrap();
    // 100 + reszta do limitu 200 (nie 300).
    assert_eq!(env.purchase_state(&ania.pubkey()).claimed, PRICE - FLOOR);
}

#[test]
fn only_seller_can_set_price() {
    let mut env = Env::new(30 * DAY, 0);
    let bartek = env.bartek.insecure_clone();
    assert!(env.set_price(&bartek, 1).is_err());
    assert_eq!(env.offer_state().price, PRICE);
}

#[test]
fn drop_after_window_does_not_count() {
    let mut env = Env::new(30 * DAY, 0);
    let (ania, seller) = (env.ania.insecure_clone(), env.seller.insecure_clone());
    env.buy(&ania).unwrap();
    env.advance(31 * DAY);
    env.set_price(&seller, SOL / 2).unwrap();
    assert!(env.claim(&ania.pubkey(), &ania).is_err());
}

#[test]
fn event_start_ends_guarantee_earlier() {
    // Wydarzenie za 5 dni, okno 30 dni: gwarancja kończy się w dniu wydarzenia.
    let event_start = 1_000_000 + 5 * DAY;
    let mut env = Env::new(30 * DAY, event_start);
    let (ania, seller) = (env.ania.insecure_clone(), env.seller.insecure_clone());
    env.buy(&ania).unwrap();
    assert_eq!(env.purchase_state(&ania.pubkey()).window_end, event_start);

    env.advance(6 * DAY);
    env.set_price(&seller, SOL / 2).unwrap();
    assert!(env.claim(&ania.pubkey(), &ania).is_err());
}

#[test]
fn release_pays_unclaimed_refund_to_buyer_then_rest_to_seller() {
    let mut env = Env::new(30 * DAY, 0);
    let (ania, bartek, seller) = (
        env.ania.insecure_clone(),
        env.bartek.insecure_clone(),
        env.seller.insecure_clone(),
    );
    env.buy(&ania).unwrap();
    env.set_price(&seller, SOL * 85 / 100).unwrap();

    // Za wcześnie.
    assert!(env.release(&ania.pubkey(), &bartek).is_err());

    // Ania nie kliknęła „odbierz”. Po końcu okna Bartek wywołuje release.
    env.advance(31 * DAY);
    let ania_before = env.balance(&ania.pubkey());
    let seller_before = env.balance(&seller.pubkey());
    let purchase = purchase_pda(&env.offer, &ania.pubkey());
    let rent = env.balance(&purchase) - (PRICE - FLOOR);
    env.release(&ania.pubkey(), &bartek).unwrap();

    assert_eq!(
        env.balance(&ania.pubkey()) - ania_before,
        SOL * 15 / 100 + rent
    );
    assert_eq!(env.balance(&seller.pubkey()) - seller_before, SOL * 5 / 100);
    assert!(env.svm.get_account(&purchase).map_or(true, |a| a.lamports == 0));
}

#[test]
fn release_with_wrong_seller_fails() {
    let mut env = Env::new(DAY, 0);
    let ania = env.ania.insecure_clone();
    env.buy(&ania).unwrap();
    env.advance(2 * DAY);
    let ix = Instruction::new_with_bytes(
        zwrotka::id(),
        &zwrotka::instruction::Release {}.data(),
        zwrotka::accounts::Release {
            offer: env.offer,
            purchase: purchase_pda(&env.offer, &ania.pubkey()),
            buyer: ania.pubkey(),
            seller: env.bartek.pubkey(),
        }
        .to_account_metas(None),
    );
    assert!(env.send(ix, &ania).is_err());
}
