import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { DEFAULT_NAME, loadNames, saveName } from '../names'
import { createOfferIx, fetchSellerOffers, fmtZl, offerPda, toLamports, type Offer } from '../program'
import { useRefreshOnTx, useTx } from '../shell'

export function Seller() {
  return (
    <>
      <section className="hero">
        <div className="eyebrow">Dla sprzedawców</div>
        <h1>Sprzedawaj wcześniej. Koszt gwarancji znasz z góry.</h1>
        <p className="lead">
          Klienci odkładają zakup, bo boją się promocji. Daj im gwarancję ceny, której nie musisz „obiecywać”: rezerwa
          blokuje się w programie, a Ty od razu dostajesz większość pieniędzy.
        </p>
      </section>
      <div className="cards3">
        <div className="pain"><span className="pain-icon">💰</span><b>Pieniądze od razu</b><span>Floor (np. 80–90% ceny) trafia do Ciebie w chwili sprzedaży.</span></div>
        <div className="pain"><span className="pain-icon">📊</span><b>Maksymalny koszt = rezerwa</b><span>Nigdy nie oddasz więcej niż cena − floor. Symulator pokaże koszt każdej obniżki.</span></div>
        <div className="pain"><span className="pain-icon">🚀</span><b>Klienci nie czekają</b><span>„Kup teraz, nie stracisz na promocji” zamienia odkładanie zakupu w sprzedaż dziś.</span></div>
      </div>
      <div className="section" />
      <MyOffers />
      <CreateOffer />
    </>
  )
}

function MyOffers() {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const [offers, setOffers] = useState<Offer[] | null>(null)
  const load = () => {
    if (publicKey) fetchSellerOffers(connection, publicKey).then(setOffers).catch(() => setOffers([]))
  }
  useEffect(() => {
    setOffers(null)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, publicKey])
  useRefreshOnTx(load)
  if (!publicKey || !offers || offers.length === 0) return null
  const names = loadNames()
  const sorted = [...offers].sort((a, b) => Number(b.offerId - a.offerId))
  return (
    <section className="card">
      <div className="spread">
        <h2>Twoje oferty ({offers.length})</h2>
        <Link className="link" to={`/portfel/${publicKey.toBase58()}/sprzedawca`}>wszystkie statystyki →</Link>
      </div>
      <ul className="offer-list">
        {sorted.map((o) => {
          const addr = o.address.toBase58()
          return (
            <li key={addr}>
              <Link to={`/oferta/${addr}`}>
                <span className="offer-name">{names[addr] ?? `Oferta #${o.offerId}`}</span>
                <span className="muted small">
                  utworzona {new Date(Number(o.offerId)).toLocaleString('pl-PL')} · zmian ceny: {o.history.length}
                </span>
              </Link>
              <b>{fmtZl(o.price)}</b>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function CreateOffer() {
  const { publicKey } = useWallet()
  const { send, busy } = useTx()
  const navigate = useNavigate()
  const [title, setTitle] = useState(DEFAULT_NAME)
  const [price, setPrice] = useState(1000)
  const [floor, setFloor] = useState(800)
  const [windowLen, setWindowLen] = useState(5)
  const [unit, setUnit] = useState<'min' | 'd'>('min')
  const [eventAt, setEventAt] = useState('')

  const create = async () => {
    if (!publicKey) return
    const offerId = BigInt(Date.now())
    const windowSecs = BigInt(windowLen * (unit === 'min' ? 60 : 86400))
    const eventStart = eventAt ? BigInt(Math.floor(new Date(eventAt).getTime() / 1000)) : 0n
    const sig = await send(
      'Utworzenie oferty',
      createOfferIx(publicKey, offerId, toLamports(price), toLamports(floor), windowSecs, eventStart),
    )
    if (sig) {
      const addr = offerPda(publicKey, offerId).toBase58()
      saveName(addr, title)
      navigate(`/oferta/${addr}?name=${encodeURIComponent(title)}`)
    }
  }

  const pct = price > 0 ? Math.round(((price - floor) / price) * 100) : 0

  return (
    <section className="card create">
      <h2>Wystaw ofertę z gwarancją ceny</h2>
      <label>
        Nazwa (kurs, bilet, przedsprzedaż)
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div className="row">
        <label>
          Cena
          <span className="suffix"><input type="number" value={price} onChange={(e) => setPrice(+e.target.value)} />zł</span>
        </label>
        <label>
          Floor: dostajesz od razu
          <span className="suffix"><input type="number" value={floor} onChange={(e) => setFloor(+e.target.value)} />zł</span>
        </label>
      </div>
      <div className="callout">
        🛡️ Gwarancja ceny <b>do {pct}%</b>. Z każdej sprzedaży {fmtZl(toLamports(floor))} trafia od razu do Ciebie,{' '}
        {fmtZl(toLamports(Math.max(price - floor, 0)))} czeka w rezerwie. To Twój maksymalny koszt na kupującego.
        Rozsądnie: 10–20%.
      </div>
      <div className="row">
        <label>
          Okno gwarancji od zakupu
          <span className="inline">
            <input type="number" value={windowLen} onChange={(e) => setWindowLen(+e.target.value)} className="num" />
            <select value={unit} onChange={(e) => setUnit(e.target.value as 'min' | 'd')}>
              <option value="min">minut (demo)</option>
              <option value="d">dni</option>
            </select>
          </span>
        </label>
        <label>
          Start wydarzenia (opcjonalnie)
          <input type="datetime-local" value={eventAt} onChange={(e) => setEventAt(e.target.value)} />
        </label>
      </div>
      {publicKey ? (
        <button className="big" disabled={busy || floor > price || price <= 0} onClick={create}>
          Wystaw ofertę
        </button>
      ) : (
        <WalletMultiButton />
      )}
    </section>
  )
}
