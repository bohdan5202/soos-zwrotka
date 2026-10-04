use anchor_lang::prelude::*;

#[constant]
pub const OFFER_SEED: &[u8] = b"offer";

#[constant]
pub const PURCHASE_SEED: &[u8] = b"purchase";

/// Maksymalna liczba zmian ceny w jednej ofercie.
#[constant]
pub const MAX_PRICE_CHANGES: u32 = 32;
