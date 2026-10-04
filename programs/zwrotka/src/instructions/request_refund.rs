use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    state::{Purchase, RefundRequest},
};

/// Kupujący prosi o zwrot (np. odwołane zajęcia). To tylko zgłoszenie widoczne dla
/// sprzedawcy: pieniądze ruszają dopiero w `refund_purchase`, które podpisuje sprzedawca.
#[derive(Accounts)]
pub struct RequestRefund<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(has_one = buyer)]
    pub purchase: Account<'info, Purchase>,
    #[account(
        init,
        payer = buyer,
        space = 8 + RefundRequest::INIT_SPACE,
        seeds = [REFUND_REQUEST_SEED, purchase.key().as_ref()],
        bump
    )]
    pub refund_request: Account<'info, RefundRequest>,
    pub system_program: Program<'info, System>,
}

pub fn handle_request_refund(ctx: Context<RequestRefund>, reason: String) -> Result<()> {
    require!(reason.len() <= MAX_REASON_LEN as usize, ErrorCode::ReasonTooLong);
    let req = &mut ctx.accounts.refund_request;
    req.purchase = ctx.accounts.purchase.key();
    req.offer = ctx.accounts.purchase.offer;
    req.buyer = ctx.accounts.buyer.key();
    req.requested_at = Clock::get()?.unix_timestamp;
    req.reason = reason;
    req.bump = ctx.bumps.refund_request;
    msg!("Refund requested");
    Ok(())
}
