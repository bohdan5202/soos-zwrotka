use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, state::Offer};

#[derive(Accounts)]
#[instruction(offer_id: u64)]
pub struct CreateOffer<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(
        init,
        payer = seller,
        space = 8 + Offer::INIT_SPACE,
        seeds = [OFFER_SEED, seller.key().as_ref(), &offer_id.to_le_bytes()],
        bump
    )]
    pub offer: Account<'info, Offer>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_offer(
    ctx: Context<CreateOffer>,
    offer_id: u64,
    price: u64,
    floor: u64,
    window_secs: i64,
    event_start: i64,
) -> Result<()> {
    require!(price > 0, ErrorCode::ZeroPrice);
    require!(floor <= price, ErrorCode::FloorAbovePrice);
    require!(
        window_secs > 0 || event_start > 0,
        ErrorCode::NoGuaranteeWindow
    );

    let offer = &mut ctx.accounts.offer;
    offer.seller = ctx.accounts.seller.key();
    offer.offer_id = offer_id;
    offer.price = price;
    offer.floor = floor;
    offer.window_secs = window_secs.max(0);
    offer.event_start = event_start.max(0);
    offer.history = Vec::new();
    offer.bump = ctx.bumps.offer;
    offer.closed = false;

    msg!("Offer {} created: price {}, floor {}", offer_id, price, floor);
    Ok(())
}
