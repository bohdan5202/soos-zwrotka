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
}
