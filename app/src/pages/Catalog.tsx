import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { loadNames } from '../names'
import {
  due,
  fetchAllOffers,
  fetchAllPurchasesByOffer,
  fetchOfferTitle,
  fmtZl,
  readTitles,
  type Offer,
  type Purchase,
} from '../program'
import { useRefreshOnTx, useTx } from '../shell'

type Item = { offer: Offer; purchases: Purchase[] }
type Sort = 'nowe' | 'tanie' | 'ochrona' | 'popularne'

function fmtDuration(secs: number) {
  if (secs % 86400 === 0) return `${secs / 86400} dni`
  if (secs % 3600 === 0) return `${secs / 3600} h`
  if (secs % 60 === 0) return `${secs / 60} min`
  return `${secs} s`
}

/** Katalog wszystkich ofert z programu: jedno zapytanie o oferty, jedno o zakupy. Bez backendu. */
export function Catalog() {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const { now } = useTx()
  const [items, setItems] = useState<Item[] | null>(null)
  const [titles, setTitles] = useState<Record<string, string | null>>(() => ({ ...readTitles() }))
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('nowe')
  const [onlyMine, setOnlyMine] = useState(false)

  const load = useCallback(async () => {
    const [offers, byOffer] = await Promise.all([fetchAllOffers(connection), fetchAllPurchasesByOffer(connection)])
    setItems(offers.map((o) => ({ offer: o, purchases: byOffer.get(o.address.toBase58()) ?? [] })))
  }, [connection])

  useEffect(() => {
    load().catch((e) => console.warn('catalog', e))
    const t = setInterval(() => load().catch(() => {}), 20000)
    return () => clearInterval(t)
  }, [load])
  useRefreshOnTx(() => load().catch(() => {}))

  // Nazwy z Memo dociągamy po kolei (limit publicznego RPC) i tylko te, których nie ma w cache.
  useEffect(() => {
    if (!items) return
    let stop = false
    ;(async () => {
      for (const { offer } of items) {
        const k = offer.address.toBase58()
        if (stop || k in readTitles()) continue
        const t = await fetchOfferTitle(connection, offer.address).catch(() => undefined)
        if (t !== undefined) setTitles((s) => ({ ...s, [k]: t }))
        await new Promise((r) => setTimeout(r, 300))
      }
    })()
    return () => {
      stop = true
    }
  }, [items, connection])

  const local = loadNames()
  const nameOf = (o: Offer) => titles[o.address.toBase58()] ?? local[o.address.toBase58()] ?? `Oferta #${o.offerId}`

  const shown = useMemo(() => {
    if (!items) return []
    const q = query.trim().toLowerCase()
    const pct = (o: Offer) => (o.price > o.floor ? Number(((o.price - o.floor) * 1000n) / o.price) : 0)
    return items
      .filter((i) => !onlyMine || (publicKey && i.offer.seller.equals(publicKey)))
      .filter((i) => !q || nameOf(i.offer).toLowerCase().includes(q))
      .sort((a, b) =>
        sort === 'tanie' ? Number(a.offer.price - b.offer.price)
        : sort === 'ochrona' ? pct(b.offer) - pct(a.offer)
        : sort === 'popularne' ? b.purchases.length - a.purchases.length
        : Number(b.offer.offerId - a.offer.offerId),
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query, sort, onlyMine, publicKey, titles])

  return (
    <>
      <section className="hero">
        <div className="eyebrow">Katalog</div>
        <h1>Wszystko, co możesz kupić z ochroną ceny</h1>
        <p className="lead">
          Lista pochodzi prosto z programu na Solanie, bez naszego serwera. Każda oferta ma rezerwę na zwroty, którą
          widać poniżej.
        </p>
      </section>

      <div className="toolbar">
        <input placeholder="Szukaj po nazwie…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="nowe">Najnowsze</option>
          <option value="tanie">Najtańsze</option>
          <option value="ochrona">Największa ochrona</option>
          <option value="popularne">Najwięcej aktywnych zakupów</option>
        </select>
        {publicKey && (
          <label className="check">
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> tylko moje
          </label>
        )}
        <span className="muted small">{items ? `${shown.length} z ${items.length} ofert` : 'Wczytuję…'}</span>
      </div>

      {items && shown.length === 0 && <section className="card center muted">Brak ofert dla tych filtrów.</section>}

      <div className="catalog">
        {shown.map(({ offer: o, purchases }) => {
          const addr = o.address.toBase58()
          const maxRefund = o.price > o.floor ? o.price - o.floor : 0n
          const pct = Math.round((Number(maxRefund) * 100) / Number(o.price || 1n))
          const locked = purchases.reduce((s, p) => s + p.reserve - p.claimed, 0n)
          const owed = purchases.reduce((s, p) => s + due(p, o), 0n)
          const active = purchases.filter((p) => Number(p.windowEnd) > now).length
          const dropped = o.history.length > 0
          const mine = publicKey?.equals(o.seller)
          return (
            <Link key={addr} to={`/oferta/${addr}`} className="product-card">
              <div className="pc-top">
                {pct > 0 ? <span className="pill ok">🛡️ ochrona do {pct}%</span> : <span className="pill">bez ochrony</span>}
                {o.closed && <span className="pill">sprzedaż zakończona</span>}
                {mine && <span className="role seller-role mini">Twoja</span>}
              </div>
              <h3>{nameOf(o)}</h3>
              <div className="pc-price">{fmtZl(o.price)}</div>
              {dropped && <div className="muted small">zmian ceny: {o.history.length}</div>}
              <ul className="pc-facts">
                <li>Okno: {o.windowSecs > 0n ? fmtDuration(Number(o.windowSecs)) : '—'}{o.eventStart > 0n && ' / do wydarzenia'}</li>
                <li>Aktywne zakupy: <b>{purchases.length}</b>{active < purchases.length && ` (${active} w oknie)`}</li>
                <li>W rezerwie: <b>{fmtZl(locked)}</b></li>
                {owed > 0n && <li className="ok-text">Do wypłaty kupującym: {fmtZl(owed)}</li>}
              </ul>
              <span className="pc-cta">Zobacz ofertę →</span>
            </Link>
          )
        })}
      </div>
    </>
  )
}
