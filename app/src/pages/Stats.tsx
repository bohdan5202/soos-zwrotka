import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useConnection } from '@solana/wallet-adapter-react'
import { loadNames } from '../names'
import {
  due,
  explorerAddr,
  fetchAllOffers,
  fetchAllPurchasesByOffer,
  fmtZl,
  PROGRAM_ID,
  readTitles,
  type Offer,
  type Purchase,
} from '../program'
import { useTx } from '../shell'

/** Publiczne statystyki protokołu: stan wszystkich kont programu, bez backendu. */
export function Stats() {
  const { connection } = useConnection()
  const { now } = useTx()
  const [offers, setOffers] = useState<Offer[] | null>(null)
  const [byOffer, setByOffer] = useState<Map<string, Purchase[]>>(new Map())

  const load = useCallback(async () => {
    const [o, p] = await Promise.all([fetchAllOffers(connection), fetchAllPurchasesByOffer(connection)])
    setOffers(o)
    setByOffer(p)
  }, [connection])

  useEffect(() => {
    load().catch((e) => console.warn('stats', e))
    const t = setInterval(() => load().catch(() => {}), 20000)
    return () => clearInterval(t)
  }, [load])

  const s = useMemo(() => {
    if (!offers) return null
    const purchases = [...byOffer.values()].flat()
    const offerMap = new Map(offers.map((o) => [o.address.toBase58(), o]))
    let locked = 0n
    let owed = 0n
    let paid = 0n
    for (const p of purchases) {
      locked += p.reserve - p.claimed
      paid += p.paid
      const o = offerMap.get(p.offer.toBase58())
      if (o) owed += due(p, o)
    }
    const top = offers
      .map((o) => {
        const ps = byOffer.get(o.address.toBase58()) ?? []
        return { o, n: ps.length, locked: ps.reduce((a, p) => a + p.reserve - p.claimed, 0n) }
      })
      .filter((x) => x.n > 0)
      .sort((a, b) => Number(b.locked - a.locked))
      .slice(0, 5)
    return {
      offers: offers.length,
      open: offers.filter((o) => !o.closed).length,
      sellers: new Set(offers.map((o) => o.seller.toBase58())).size,
      purchases: purchases.length,
      inWindow: purchases.filter((p) => Number(p.windowEnd) > now).length,
      buyers: new Set(purchases.map((p) => p.buyer.toBase58())).size,
      locked, owed, paid, top,
    }
  }, [offers, byOffer, now])

  const names = { ...readTitles(), ...loadNames() }

  return (
    <>
      <section className="hero compact">
        <div className="eyebrow">Statystyki protokołu</div>
        <h1>Ile pieniędzy chroni teraz Zwrotka</h1>
        <p className="lead">
          Liczone na żywo ze wszystkich kont programu{' '}
          <a href={explorerAddr(PROGRAM_ID)} target="_blank" rel="noreferrer">44sG…GGB7</a> na Solanie. Bez naszego
          serwera i bez możliwości „podkręcenia” liczb.
        </p>
      </section>

      {!s ? (
        <section className="card muted">Liczę…</section>
      ) : (
        <>
          <section className="index-band">
            <div className="index-main">
              <div className="eyebrow">Indeks Zwrotki · zablokowane w rezerwach</div>
              <div className="index-value">{fmtZl(s.locked)}</div>
              <p className="muted small">Gotowe na zwroty, poza zasięgiem sprzedawców. Stan na {new Date(now * 1000).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}.</p>
            </div>
            <dl className="index-side">
              <div><dt>Należne kupującym teraz</dt><dd className={s.owed > 0n ? 'ok-text' : ''}>{fmtZl(s.owed)}<small>po obniżkach cen</small></dd></div>
              <div><dt>Aktywne zakupy</dt><dd>{s.purchases}<small>{s.inWindow} z otwartym oknem · {fmtZl(s.paid)}</small></dd></div>
              <div><dt>Oferty</dt><dd>{s.offers}<small>{s.open} w sprzedaży · {s.sellers} sprzedawców</small></dd></div>
              <div><dt>Kupujący z ochroną</dt><dd>{s.buyers}</dd></div>
            </dl>
          </section>
          <section className="card">
            <h2>Największe rezerwy</h2>
            {s.top.length === 0 ? (
              <p className="muted small">Brak aktywnych zakupów.</p>
            ) : (
              <ul className="offer-list">
                {s.top.map(({ o, n, locked }) => (
                  <li key={o.address.toBase58()}>
                    <Link to={`/oferta/${o.address.toBase58()}/przejrzystosc`}>
                      <span className="offer-name">{names[o.address.toBase58()] ?? `Oferta #${o.offerId}`}</span>
                      <span className="muted small">{n} aktywnych zakupów · cena {fmtZl(o.price)}</span>
                    </Link>
                    <b>{fmtZl(locked)}</b>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className="muted small center">
            Liczby pokazują bieżący stan kont. Zamknięte (rozliczone) zakupy widać w historii każdej oferty.
          </p>
        </>
      )}
    </>
  )
}
