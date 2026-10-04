import { Link } from 'react-router'
import { TAGLINE } from '../brand'
import { FunnelSections, ProtectionMeter } from '../funnel'
import { AddressLookup } from './AddressLookup'

export function Home() {
  return (
    <>
      <section className="hero hero-grid">
        <div>
          <div className="eyebrow">Ochrona ceny on-chain</div>
          <h1>{TAGLINE}</h1>
          <p className="lead">
            Kupujesz kurs albo bilet, a tydzień później jest promocja? Ze Zwrotką <b>różnica wraca do Ciebie
            automatycznie</b>. Pieniądze na zwrot są zablokowane od chwili zakupu, a sprzedawca nie może ich ruszyć
            ani odmówić.
          </p>
          <div className="cta-row">
            <a className="btn big" href="#ochrona">Sprawdź, ile odzyskasz</a>
            <Link className="btn secondary big" to="/sprzedawca">Jestem sprzedawcą</Link>
          </div>
          <ul className="trust">
            <li>🔒 Rezerwa w programie, nie u sprzedawcy</li>
            <li>⚡ Zwrot bez reklamacji</li>
            <li>🔎 Historia cen publiczna</li>
          </ul>
        </div>
        <div className="card hero-card" id="ochrona">
          <ProtectionMeter price={1000} floor={800} editable title="Policz swoją ochronę" />
        </div>
      </section>

      <FunnelSections />

      <section className="section cta-band">
        <div>
          <h2 className="section-title">Masz link do oferty albo chcesz sprawdzić portfel?</h2>
          <p className="muted">Wklej adres: rozpoznamy, czy to oferta, czy portfel, i pokażemy, co dzieje się z pieniędzmi.</p>
        </div>
        <AddressLookup />
      </section>

      <section className="section cta-band seller-band">
        <div>
          <h2 className="section-title">Sprzedajesz kursy albo bilety?</h2>
          <p className="muted">Daj klientom gwarancję, której nie mogą Ci nie uwierzyć. Koszt znasz z góry.</p>
        </div>
        <Link className="btn big" to="/sprzedawca">Wystaw ofertę z gwarancją →</Link>
      </section>
    </>
  )
}
