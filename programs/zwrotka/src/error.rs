use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Price must be greater than zero")]
    ZeroPrice,
    #[msg("Floor cannot be higher than the price")]
    FloorAbovePrice,
    #[msg("Set a guarantee window (days) or an event start date")]
    NoGuaranteeWindow,
    #[msg("Price history is full")]
    HistoryFull,
    #[msg("Nothing to claim")]
    NothingToClaim,
    #[msg("Guarantee window has not ended yet")]
    WindowNotEnded,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Sales for this offer are closed")]
    SalesClosed,
    #[msg("Refund cannot be lower than the buyer's remaining reserve")]
    RefundBelowReserve,
    #[msg("Refund cannot exceed what the buyer paid minus what was already returned")]
    RefundAbovePaid,
    #[msg("Reason is too long")]
    ReasonTooLong,
    #[msg("Price is higher than the buyer agreed to pay")]
    PriceAboveMax,
    #[msg("Event start date is in the past")]
    EventInPast,
    #[msg("Guarantee window would already be over")]
    GuaranteeEnded,
}
