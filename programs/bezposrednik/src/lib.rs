pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("44sG9n516FQKsDNC2uwyKPUKSksyDLH4ypzsVHgJGGB7");

#[program]
pub mod bezposrednik {
    use super::*;

    pub fn create_offer(
        ctx: Context<CreateOffer>,
        offer_id: u64,
        price: u64,
        floor: u64,
        window_secs: i64,
        event_start: i64,
    ) -> Result<()> {
        crate::instructions::create_offer::handle_create_offer(
            ctx,
            offer_id,
            price,
            floor,
            window_secs,
            event_start,
        )
    }

    pub fn buy(ctx: Context<Buy>) -> Result<()> {
        crate::instructions::buy::handle_buy(ctx)
    }

    pub fn set_price(ctx: Context<SetPrice>, new_price: u64) -> Result<()> {
        crate::instructions::set_price::handle_set_price(ctx, new_price)
    }

    pub fn claim_difference(ctx: Context<ClaimDifference>) -> Result<()> {
        crate::instructions::claim_difference::handle_claim_difference(ctx)
    }

    pub fn release(ctx: Context<Release>) -> Result<()> {
        crate::instructions::release::handle_release(ctx)
    }
}
