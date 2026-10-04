import { useState } from 'react'

const zl = (v: number) => `${Math.round(v).toLocaleString('pl-PL')} zł`

/**
 * „Co jeśli cena spadnie do X?” — pasek ceny ze strefą chronioną (floor..cena)
 * i suwakiem hipotetycznej nowej ceny. Wszystko w zł.
 */
export function ProtectionMeter({
  price, floor, editable = false, title = 'Co jeśli cena spadnie?',
}: { price: number; floor: number; editable?: boolean; title?: string }) {
  const [p, setP] = useState(price)
  const [f, setF] = useState(floor)
  const P = editable ? p : price
  const F = Math.min(editable ? f : floor, P)
  // Start: obniżka do granicy ochrony (cała różnica wraca), najwyżej −20%.
  const [drop, setDrop] = useState(Math.max(F, Math.round(P * 0.8)))
  const newPrice = Math.min(Math.max(drop, 0), P)
  const refund = Math.min(P - newPrice, P - F)
  const pct = (v: number) => `${(v / (P || 1)) * 100}%`
  const covered = P - newPrice <= P - F

  return (
    <div className="meter">
      <div className="spread">
        <h3 className="meter-title">{title}</h3>
        <span className="pill ok">Ochrona do {Math.round(((P - F) / (P || 1)) * 100)}%</span>
      </div>

      {editable && (
        <div className="row meter-inputs">
          <label>
            Cena zakupu
            <span className="suffix"><input type="number" value={p} onChange={(e) => setP(+e.target.value)} />zł</span>
          </label>
          <label>
            Sprzedawca dostaje od razu (floor)
            <span className="suffix"><input type="number" value={f} onChange={(e) => setF(+e.target.value)} />zł</span>
          </label>
        </div>
      )}

      <div className="meter-bar" aria-hidden="true">
        <div className="zone out" style={{ width: pct(F) }}><span>poza ochroną</span></div>
        <div className="zone in" style={{ width: pct(P - F) }}><span>ochrona</span></div>
        <div className="cursor" style={{ left: pct(newPrice) }}>
          <div className="cursor-label">{zl(newPrice)}</div>
        </div>
      </div>
      <div className="meter-scale">
        <span>0 zł</span>
        <span className="ok-text">chronione: {zl(F)} – {zl(P)}</span>
      </div>

      <label className="meter-slider">
        Nowa cena po promocji
        <input type="range" min={0} max={P} step={Math.max(1, Math.round(P / 100))} value={newPrice} onChange={(e) => setDrop(+e.target.value)} />
      </label>

      <div className={`meter-result ${refund > 0 ? 'yes' : ''}`}>
        {newPrice >= P ? (
          <>Cena nie spadła: płacisz tyle, ile było warto.</>
        ) : (
          <>
            Promocja −{Math.round(((P - newPrice) / P) * 100)}% →{' '}
            <b>odzyskujesz {zl(refund)}</b>
            {covered ? ' — całą różnicę' : ` (limit ochrony; różnica ${zl(P - newPrice)})`}
            . Automatycznie, bez reklamacji.
          </>
        )}
      </div>
    </div>
  )
}

export type StepState = 'done' | 'current' | 'todo'

/** Postęp kupującego: Sprawdź → Kup z ochroną → Ochrona aktywna → Zwrot. */
export function Stepper({ steps }: { steps: { label: string; hint: string; state: StepState }[] }) {
  return (
    <ol className="stepper">
      {steps.map((s, i) => (
        <li key={s.label} className={s.state}>
          <span className="step-dot">{s.state === 'done' ? '✓' : i + 1}</span>
          <div>
            <b>{s.label}</b>
            <span>{s.hint}</span>
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Sekcje strony głównej: problem → jak działa → porównanie. */
export function FunnelSections() {
  return (
    <>
      <section className="section">
        <div className="eyebrow">Problem</div>
        <h2 className="section-title">Kupujesz na szczycie ceny? Każdy się tego boi.</h2>
        <div className="cards3">
          <div className="pain">
            <span className="pain-icon">I.</span>
            <b>Kupujący czekają</b>
            <span>„Kupię po Black Friday.” Kurs, bilet, przedsprzedaż — wszyscy odkładają zakup, bo boją się promocji tydzień później.</span>
          </div>
          <div className="pain">
            <span className="pain-icon">II.</span>
            <b>Sprzedawca traci</b>
            <span>Pieniądze przychodzą później, nie wiadomo ile się sprzeda. Mały organizator nie ma jak przekonać, że nie obniży ceny.</span>
          </div>
          <div className="pain">
            <span className="pain-icon">III.</span>
            <b>Dzisiejsze gwarancje to obietnice</b>
            <span>Sprzedawca sam decyduje o zwrocie. Costco: „reserves the right to deny”. Alaska Airlines i JetBlue po prostu je wycofały.</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="eyebrow">Jak działa Zwrotka</div>
        <h2 className="section-title">Ochrona ceny zabezpieczona pieniędzmi, nie słowem</h2>
        <ol className="timeline">
          <li><span>01</span><div><b>Kupujesz</b><p>Płacisz normalną cenę. Sprzedawca od razu dostaje większość (floor).</p></div></li>
          <li><span>02</span><div><b>Rezerwa się blokuje</b><p>Reszta czeka w programie na Solanie. Sprzedawca nie może jej ruszyć.</p></div></li>
          <li><span>03</span><div><b>Cena spada?</b><p>Program sam zna każdą zmianę ceny. Nie musisz niczego śledzić ani udowadniać.</p></div></li>
          <li><span>04</span><div><b>Różnica wraca do Ciebie</b><p>Jednym kliknięciem albo automatycznie po końcu okna. Bez zgody sprzedawcy.</p></div></li>
        </ol>
      </section>

      <section className="section">
        <div className="eyebrow">Porównanie</div>
        <h2 className="section-title">Zwykła gwarancja ceny vs Zwrotka</h2>
        <div className="table-wrap">
          <table className="compare">
            <thead>
              <tr><th></th><th>Gwarancja sklepu</th><th>Zwrotka</th></tr>
            </thead>
            <tbody>
              <tr><td>Kto decyduje o zwrocie</td><td>sprzedawca</td><td><b>program, reguła znana z góry</b></td></tr>
              <tr><td>Gdzie są pieniądze na zwrot</td><td>u sprzedawcy</td><td><b>zablokowane od chwili zakupu</b></td></tr>
              <tr><td>Co musisz zrobić</td><td>śledzić ceny, reklamacja, dowody</td><td><b>nic albo jedno kliknięcie</b></td></tr>
              <tr><td>Czy można ją wycofać</td><td>tak (Alaska, JetBlue)</td><td><b>nie dla kupionych biletów</b></td></tr>
              <tr><td>Historia cen</td><td>niewidoczna</td><td><b>publiczna na blockchainie</b></td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
