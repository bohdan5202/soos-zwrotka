use anchor_lang::prelude::*;

use crate::{
    error::ErrorCode,
    instructions::move_lamports,
    state::{Offer, Purchase},
};

/// Po końcu gwarancji: najpierw kupujący dostaje to, co mu się należy
/// (nawet jeśli nie kliknął „odbierz”), potem resztę rezerwy dostaje sprzedawca.
/// Rent konta wraca do kupującego, który je opłacił. Może wywołać każdy.
#[derive(Accounts)]
pub struct Release<'info> {
    #[account(has_one = seller)]
    pub offer: Account<'info, Offer>,
    #[account(mut, has_one = offer, has_one = buyer, close = buyer)]
    pub purchase: Account<'info, Purchase>,
    /// CHECK: zgodny z `purchase.buyer`.
    #[account(mut)]
    pub buyer: UncheckedAccount<'info>,
    /// CHECK: zgodny z `offer.seller`.
    #[account(mut)]
    pub seller: UncheckedAccount<'info>,
}

pub fn handle_release(ctx: Context<Release>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let purchase = &ctx.accounts.purchase;
    require!(now > purchase.window_end, ErrorCode::WindowNotEnded);

    let due = purchase.due(&ctx.accounts.offer);
    let to_seller = purchase
        .reserve
        .checked_sub(purchase.claimed)
        .and_then(|left| left.checked_sub(due))
        .ok_or(ErrorCode::Overflow)?;

    let purchase_info = ctx.accounts.purchase.to_account_info();
    if due > 0 {
        move_lamports(&purchase_info, &ctx.accounts.buyer.to_account_info(), due)?;
    }
    if to_seller > 0 {
        move_lamports(&purchase_info, &ctx.accounts.seller.to_account_info(), to_seller)?;
    }

    msg!("Released: {} to buyer, {} to seller", due, to_seller);
    Ok(())
}
