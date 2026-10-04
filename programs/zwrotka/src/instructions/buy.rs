use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::{
    constants::*,
    error::ErrorCode,
    state::{Offer, Purchase},
};

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    /// CHECK: odbiorca płatności, zgodny z `offer.seller`.
    #[account(mut, address = offer.seller)]
    pub seller: UncheckedAccount<'info>,
    pub offer: Account<'info, Offer>,
    #[account(
        init,
        payer = buyer,
        space = 8 + Purchase::INIT_SPACE,
        seeds = [PURCHASE_SEED, offer.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub purchase: Account<'info, Purchase>,
    pub system_program: Program<'info, System>,
}

/// `max_price`: cena, którą kupujący widział i zaakceptował. Sprzedawca nie podniesie jej
/// tuż przed wykonaniem zakupu.
pub fn handle_buy(ctx: Context<Buy>, max_price: u64) -> Result<()> {
    let offer = &ctx.accounts.offer;
    require!(!offer.closed, ErrorCode::SalesClosed);
    require!(offer.price <= max_price, ErrorCode::PriceAboveMax);
    let now = Clock::get()?.unix_timestamp;

    // Sprzedawca od razu dostaje floor (albo całą cenę, jeśli spadła poniżej floor).
    let paid = offer.price;
    let to_seller = paid.min(offer.floor);
    let reserve = paid - to_seller;

    let window_end = match (offer.window_secs > 0, offer.event_start > 0) {
        (true, true) => now
            .checked_add(offer.window_secs)
            .ok_or(ErrorCode::Overflow)?
            .min(offer.event_start),
        (true, false) => now
            .checked_add(offer.window_secs)
            .ok_or(ErrorCode::Overflow)?,
        _ => offer.event_start,
    };
    // Po starcie wydarzenia zakup nie miałby żadnej gwarancji.
    require!(window_end > now, ErrorCode::GuaranteeEnded);

    let system_program = ctx.accounts.system_program.key();
    transfer(
        CpiContext::new(
            system_program,
            Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.seller.to_account_info(),
            },
        ),
        to_seller,
    )?;
    if reserve > 0 {
        transfer(
            CpiContext::new(
                system_program,
                Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.purchase.to_account_info(),
                },
            ),
            reserve,
        )?;
    }

    let purchase = &mut ctx.accounts.purchase;
    purchase.offer = offer.key();
    purchase.buyer = ctx.accounts.buyer.key();
    purchase.paid = paid;
    purchase.reserve = reserve;
    purchase.claimed = 0;
    purchase.bought_at = now;
    purchase.window_end = window_end;
    purchase.first_change = offer.history.len() as u32;
    purchase.bump = ctx.bumps.purchase;

    msg!(
        "Bought for {}: {} to seller, {} locked until {}",
        paid,
        to_seller,
        reserve,
        window_end
    );
    Ok(())
}
