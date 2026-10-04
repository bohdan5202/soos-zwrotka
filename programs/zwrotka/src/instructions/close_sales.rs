use anchor_lang::prelude::*;

use crate::state::Offer;

/// Sprzedawca kończy sprzedaż: nowych zakupów nie będzie. Istniejące zakupy i ich
/// rezerwy zostają bez zmian. Anulowanie całej oferty = `close_sales` + `refund_purchase`
/// dla każdego zakupu (frontend składa to w jedną transakcję).
#[derive(Accounts)]
pub struct CloseSales<'info> {
    pub seller: Signer<'info>,
    #[account(mut, has_one = seller)]
    pub offer: Account<'info, Offer>,
}

pub fn handle_close_sales(ctx: Context<CloseSales>) -> Result<()> {
    ctx.accounts.offer.closed = true;
    msg!("Sales closed");
    Ok(())
}
