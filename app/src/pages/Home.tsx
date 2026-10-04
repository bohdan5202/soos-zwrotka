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
            <Link className="btn big" to="/katalog">Zobacz oferty z ochroną</Link>
            <Link className="btn secondary big" to="/sprzedawca">Jestem sprzedawcą</Link>
            <Link className="watch-link" to={{ hash: '#nagranie' }}>
              <span className="watch-icon" aria-hidden="true" />
              Obejrzyj, jak to działa (3 min)
            </Link>
          </div>
          <ul className="trust">
            <li>Rezerwa w programie, nie u sprzedawcy</li>
            <li>Zwrot bez reklamacji</li>
            <li>Historia cen publiczna</li>
          </ul>
        </div>
        <div className="card hero-card" id="ochrona">
          <ProtectionMeter price={1000} floor={800} editable title="Policz swoją ochronę" />
        </div>
      </section>

      <DemoVideo />

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

const LOOM_ID = '967a8b047d714571859c72c81578a7fb'

/** Nagranie Loom z przejściem przez cały system: zakup, obniżka, odbiór różnicy, panel sprzedawcy. */
function DemoVideo() {
  return (
    <section className="section reportage" id="nagranie" aria-labelledby="nagranie-title">
      <figure className="reportage-video">
        <div className="video-frame">
          <iframe
            src={`https://www.loom.com/embed/${LOOM_ID}?hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true`}
            title="Nagranie: jak działa Zwrotka dla kupującego i sprzedawcy"
            loading="lazy"
            allow="fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
        <figcaption>
          Nagranie z devnetu Solany, 3 min. Ceny w zł, płatność w testowym SOL.{' '}
          <a href={`https://www.loom.com/share/${LOOM_ID}`} target="_blank" rel="noreferrer">Otwórz w Loom</a>
        </figcaption>
      </figure>
      <div className="reportage-side">
        <h2 className="section-title" id="nagranie-title">Jeden kurs, dwie strony, trzy minuty</h2>
        <p className="muted">Kupujemy kurs programowania, sprzedawca obniża cenę, a różnica wraca do kupującego bez zgody sprzedawcy.</p>
        <ol className="reportage-steps">
          <li>Kupujący przegląda oferty i kupuje kurs za 400 zł, podpisując zakup w portfelu.</li>
          <li>Od razu widzi floor, który dostał sprzedawca, i rezerwę czekającą na zwrot.</li>
          <li>Sprzedawca obniża cenę. Kupującemu należy się 135 zł.</li>
          <li>Historia ceny i lista kupujących są publiczne na blockchainie.</li>
          <li>Różnicę odbiera się jednym kliknięciem. Na koniec statystyki platformy i portfela.</li>
        </ol>
      </div>
    </section>
  )
}
