use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::{
    constants::*,
    error::ErrorCode,
    instructions::move_lamports,
    state::{Offer, Purchase, RefundRequest},
};

/// Sprzedawca anuluje jeden zakup i oddaje kupującemu `amount` (całość albo część).
/// Najpierw idzie rezerwa zakupu, resztę dopłaca sprzedawca ze swojego portfela.
/// Niewykorzystana rezerwa wraca do sprzedawcy, a zakup się zamyka (rent → kupujący).
/// Nie da się oddać mniej, niż kupującemu już należy się z reguły ceny.
#[derive(Accounts)]
pub struct RefundPurchase<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(has_one = seller)]
    pub offer: Account<'info, Offer>,
    #[account(mut, has_one = offer, has_one = buyer, close = buyer)]
    pub purchase: Account<'info, Purchase>,
    /// CHECK: odbiorca zwrotu, zgodny z `purchase.buyer`.
    #[account(mut)]
    pub buyer: UncheckedAccount<'info>,
    /// Prośba o zwrot, jeśli kupujący ją złożył: zamykana razem z zakupem.
    #[account(
        mut,
        seeds = [REFUND_REQUEST_SEED, purchase.key().as_ref()],
        bump = refund_request.bump,
        close = buyer
    )]
    pub refund_request: Option<Account<'info, RefundRequest>>,
    pub system_program: Program<'info, System>,
}

pub fn handle_refund_purchase(ctx: Context<RefundPurchase>, amount: u64) -> Result<()> {
    let purchase = &ctx.accounts.purchase;
    let due = purchase.due(&ctx.accounts.offer);
    let left = purchase
        .reserve
        .checked_sub(purchase.claimed)
        .ok_or(ErrorCode::Overflow)?;
    let max = purchase
        .paid
        .checked_sub(purchase.claimed)
        .ok_or(ErrorCode::Overflow)?;
    require!(amount >= due, ErrorCode::RefundBelowDue);
    require!(amount <= max, ErrorCode::RefundAbovePaid);

    let from_reserve = amount.min(left);
    let from_seller = amount - from_reserve;
    let back_to_seller = left - from_reserve;

    // Najpierw dopłata sprzedawcy (CPI), potem ręczne przesunięcia z konta programu.
    if from_seller > 0 {
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.seller.to_account_info(),
                    to: ctx.accounts.buyer.to_account_info(),
                },
            ),
            from_seller,
        )?;
    }
    let purchase_info = ctx.accounts.purchase.to_account_info();
    if from_reserve > 0 {
        move_lamports(&purchase_info, &ctx.accounts.buyer.to_account_info(), from_reserve)?;
    }
    if back_to_seller > 0 {
        move_lamports(&purchase_info, &ctx.accounts.seller.to_account_info(), back_to_seller)?;
    }

    msg!(
        "Refund by seller: {} to buyer ({} from reserve, {} from seller), {} back to seller",
        amount,
        from_reserve,
        from_seller,
        back_to_seller
    );
    Ok(())
}
