use anchor_lang::prelude::*;

use crate::{
    error::ErrorCode,
    instructions::move_lamports,
    state::{Offer, Purchase},
};

/// Tu znika pośrednik: wypłata nie wymaga podpisu sprzedawcy.
/// Może ją wywołać ktokolwiek, ale pieniądze zawsze trafiają do kupującego.
#[derive(Accounts)]
pub struct ClaimDifference<'info> {
    pub offer: Account<'info, Offer>,
    #[account(mut, has_one = offer, has_one = buyer)]
    pub purchase: Account<'info, Purchase>,
    /// CHECK: odbiorca zwrotu, zgodny z `purchase.buyer`.
    #[account(mut)]
    pub buyer: UncheckedAccount<'info>,
}

pub fn handle_claim_difference(ctx: Context<ClaimDifference>) -> Result<()> {
    let due = ctx.accounts.purchase.due(&ctx.accounts.offer);
    require!(due > 0, ErrorCode::NothingToClaim);

    move_lamports(
        &ctx.accounts.purchase.to_account_info(),
        &ctx.accounts.buyer.to_account_info(),
        due,
    )?;
    let purchase = &mut ctx.accounts.purchase;
    purchase.claimed = purchase.claimed.checked_add(due).ok_or(ErrorCode::Overflow)?;

    msg!("Refunded {} to buyer", due);
    Ok(())
}
