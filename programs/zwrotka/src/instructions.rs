pub mod buy;
pub mod claim_difference;
pub mod close_sales;
pub mod create_offer;
pub mod refund_purchase;
pub mod release;
pub mod request_refund;
pub mod set_price;

pub use buy::*;
pub use claim_difference::*;
pub use close_sales::*;
pub use create_offer::*;
pub use refund_purchase::*;
pub use release::*;
pub use request_refund::*;
pub use set_price::*;

use anchor_lang::prelude::*;

use crate::error::ErrorCode;

/// Przenosi lamporty z konta należącego do programu (rezerwa w `Purchase`).
pub(crate) fn move_lamports(from: &AccountInfo, to: &AccountInfo, amount: u64) -> Result<()> {
    let mut from_lamports = from.try_borrow_mut_lamports()?;
    let mut to_lamports = to.try_borrow_mut_lamports()?;
    **from_lamports = from_lamports
        .checked_sub(amount)
        .ok_or(ErrorCode::Overflow)?;
    **to_lamports = to_lamports.checked_add(amount).ok_or(ErrorCode::Overflow)?;
    Ok(())
}
