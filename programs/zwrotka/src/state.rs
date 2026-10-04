use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
pub struct PricePoint {
    pub ts: i64,
    pub price: u64,
}

/// Oferta sprzedawcy. Cenę zmienia się tylko instrukcją `set_price`,
/// więc program sam zna całą historię cen.
#[account]
#[derive(InitSpace)]
pub struct Offer {
    pub seller: Pubkey,
    pub offer_id: u64,
    /// Aktualna cena (lamporty).
    pub price: u64,
    /// Część ceny, którą sprzedawca dostaje od razu. Reszta to rezerwa na zwroty.
    pub floor: u64,
    /// Gwarancja trwa tyle sekund od zakupu (0 = bez limitu dni).
    pub window_secs: i64,
    /// Gwarancja kończy się najpóźniej w chwili startu wydarzenia (0 = brak daty).
    pub event_start: i64,
    /// Zmiany ceny po utworzeniu oferty.
    #[max_len(32)]
    pub history: Vec<PricePoint>,
    pub bump: u8,
    /// Sprzedaż zakończona (`close_sales`): nowych zakupów nie ma.
    /// Pole na końcu: starsze konta mają tu zero z niewykorzystanego miejsca historii, czyli `false`.
    pub closed: bool,
}

impl Offer {
    /// Ile zmian ceny zmieści konto o długości `data_len`. Starsze konta (sprzed pola
    /// `closed`) są o 1 bajt krótsze, więc mieszczą 31 zmian, nie 32: przy pełnej
    /// historii zapis by się nie udał.
    pub fn history_capacity(data_len: usize) -> usize {
        let max = crate::constants::MAX_PRICE_CHANGES as usize;
        let fixed = 8 + Offer::INIT_SPACE - max * PricePoint::INIT_SPACE;
        (data_len.saturating_sub(fixed) / PricePoint::INIT_SPACE).min(max)
    }
}

/// Prośba kupującego o zwrot (np. odwołane zajęcia). Osobne konto, żeby nie zmieniać
/// układu `Purchase`. Decyzję podejmuje sprzedawca przez `refund_purchase`.
#[account]
#[derive(InitSpace)]
pub struct RefundRequest {
    pub purchase: Pubkey,
    pub offer: Pubkey,
    pub buyer: Pubkey,
    pub requested_at: i64,
    #[max_len(80)]
    pub reason: String,
    pub bump: u8,
}

/// Zakup jednego kupującego. Konto jest jednocześnie sejfem rezerwy:
/// trzyma `reserve` lamportów ponad rent.
#[account]
#[derive(InitSpace)]
pub struct Purchase {
    pub offer: Pubkey,
    pub buyer: Pubkey,
    pub paid: u64,
    /// Zablokowana rezerwa = paid − floor. To także maksymalny zwrot.
    pub reserve: u64,
    /// Już wypłacone kupującemu.
    pub claimed: u64,
    pub bought_at: i64,
    /// Koniec gwarancji tego zakupu.
    pub window_end: i64,
    /// Indeks pierwszej zmiany ceny w `Offer.history` po tym zakupie.
    pub first_change: u32,
    pub bump: u8,
}

impl Purchase {
    /// Ile kupującemu należy się teraz: min(paid − najniższa cena w oknie, reserve) − claimed.
    pub fn due(&self, offer: &Offer) -> u64 {
        let lowest = offer
            .history
            .iter()
            .skip(self.first_change as usize)
            .filter(|p| p.ts <= self.window_end)
            .map(|p| p.price)
            .min()
            .unwrap_or(self.paid);
        let entitled = self.paid.saturating_sub(lowest).min(self.reserve);
        entitled.saturating_sub(self.claimed)
    }
}
