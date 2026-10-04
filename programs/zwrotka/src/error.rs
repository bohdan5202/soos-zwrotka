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
    #[msg("Refund cannot be lower than what the buyer is already owed")]
    RefundBelowDue,
    #[msg("Refund cannot exceed what the buyer paid minus what was already returned")]
    RefundAbovePaid,
    #[msg("Reason is too long")]
    ReasonTooLong,
}
