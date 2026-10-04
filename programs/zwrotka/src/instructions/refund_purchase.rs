use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::{
    constants::*,
    error::ErrorCode,
    instructions::{close_refund_request, move_lamports},
    state::{Offer, Purchase},
};

/// Sprzedawca anuluje jeden zakup i oddaje kupującemu `amount` (całość albo część).
/// Cała pozostała rezerwa idzie do kupującego, resztę dopłaca sprzedawca ze swojego portfela.
/// Zakup się zamyka (rent → kupujący). Nie da się oddać mniej niż pozostała rezerwa:
/// inaczej sprzedawca mógłby „anulować” zakup za 0 i zabrać rezerwę przed obniżką ceny.
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
    /// CHECK: adres prośby o zwrot tego zakupu (PDA); jeśli kupujący ją złożył,
    /// zamykana razem z zakupem. Wymagany zawsze, żeby prośba nie została osierocona.
    #[account(mut, seeds = [REFUND_REQUEST_SEED, purchase.key().as_ref()], bump)]
    pub refund_request: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_refund_purchase(ctx: Context<RefundPurchase>, amount: u64) -> Result<()> {
    let purchase = &ctx.accounts.purchase;
    // Pozostała rezerwa zawsze pokrywa należność z reguły ceny (`due <= left`).
    let left = purchase
        .reserve
        .checked_sub(purchase.claimed)
        .ok_or(ErrorCode::Overflow)?;
    let max = purchase
        .paid
        .checked_sub(purchase.claimed)
        .ok_or(ErrorCode::Overflow)?;
    require!(amount >= left, ErrorCode::RefundBelowReserve);
    require!(amount <= max, ErrorCode::RefundAbovePaid);

    let from_seller = amount - left;

    // Najpierw dopłata sprzedawcy (CPI), potem ręczne przesunięcie z konta programu.
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
    if left > 0 {
        move_lamports(
            &ctx.accounts.purchase.to_account_info(),
            &ctx.accounts.buyer.to_account_info(),
            left,
        )?;
    }
    close_refund_request(
        &ctx.accounts.refund_request.to_account_info(),
        &ctx.accounts.buyer.to_account_info(),
    )?;

    msg!(
        "Refund by seller: {} to buyer ({} from reserve, {} from seller)",
        amount,
        left,
        from_seller
    );
    Ok(())
}
