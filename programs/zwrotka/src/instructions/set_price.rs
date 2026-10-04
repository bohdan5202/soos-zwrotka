use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    state::{Offer, PricePoint},
};

#[derive(Accounts)]
pub struct SetPrice<'info> {
    pub seller: Signer<'info>,
    #[account(mut, has_one = seller)]
    pub offer: Account<'info, Offer>,
}

/// Cena może spaść także poniżej floor. Zwrot dla kupujących i tak
/// jest ograniczony do ich rezerwy, więc koszt sprzedawcy jest znany z góry.
pub fn handle_set_price(ctx: Context<SetPrice>, new_price: u64) -> Result<()> {
    require!(new_price > 0, ErrorCode::ZeroPrice);
    let offer = &mut ctx.accounts.offer;
    require!(
        offer.history.len() < MAX_PRICE_CHANGES as usize,
        ErrorCode::HistoryFull
    );

    let ts = Clock::get()?.unix_timestamp;
    offer.history.push(PricePoint {
        ts,
        price: new_price,
    });
    offer.price = new_price;

    msg!("Price changed to {}", new_price);
    Ok(())
}
