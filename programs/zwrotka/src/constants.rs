use anchor_lang::prelude::*;

#[constant]
pub const OFFER_SEED: &[u8] = b"offer";

#[constant]
pub const PURCHASE_SEED: &[u8] = b"purchase";

#[constant]
pub const REFUND_REQUEST_SEED: &[u8] = b"refund_request";

/// Maksymalna długość powodu prośby o zwrot (bajty UTF-8).
#[constant]
pub const MAX_REASON_LEN: u32 = 80;

/// Maksymalna liczba zmian ceny w jednej ofercie.
#[constant]
pub const MAX_PRICE_CHANGES: u32 = 32;
