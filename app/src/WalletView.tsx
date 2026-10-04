import { useCallback, useEffect, useMemo, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { fetchActivity, fetchWalletActivity, rolesIn, type ActivityEvent } from './activity'
import { fmtIn } from './charts'
import type { Send } from './shell'
import { Link } from 'react-router'
import {
  claimIx,
  due,
  explorerAddr,
  explorerTx,
  fetchBuyerPurchases,
  fetchOffer,
  fetchPurchases,
  fetchSellerOffers,
  fmtZl,
  releaseIx,
  type Offer,
  type Purchase,
} from './program'

const short = (s: string) => `${s.slice(0, 4)}…${s.slice(-4)}`
const fmtDate = (ts: number) => new Date(ts * 1000).toLocaleString('pl-PL')

type SellerOffer = { offer: Offer; purchases: Purchase[] }
type BuyerItem = { purchase: Purchase; offer: Offer | null }

const TABS = ['Podsumowanie', 'Jako kupujący', 'Jako sprzedawca', 'Historia'] as const
export type WalletTab = (typeof TABS)[number]
// Adresy zakładek: /portfel/:adres[/kupujacy|/sprzedawca|/historia]
export const WALLET_TAB_SLUGS: Record<WalletTab, string> = {
  Podsumowanie: '',
  'Jako kupujący': 'kupujacy',
  'Jako sprzedawca': 'sprzedawca',
  Historia: 'historia',
}

export function WalletView({
  wallet, names, now, busy, send, tab, onTab,
}: {
  wallet: PublicKey
  names: Record<string, string>
  now: number
  busy: boolean
  send: Send
  tab: WalletTab
  onTab: (t: WalletTab) => void
}) {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const addr = wallet.toBase58()
  const isMe = !!publicKey?.equals(wallet)

  const [selling, setSelling] = useState<SellerOffer[] | null>(null)
  const [buying, setBuying] = useState<BuyerItem[] | null>(null)
  const [events, setEvents] = useState<ActivityEvent[] | null>(null)

  const load = useCallback(async () => {
    // Stan bieżący: oferty sprzedawcy i aktywne zakupy kupującego.
    const offers = await fetchSellerOffers(connection, wallet)
    const sell: SellerOffer[] = []
    for (const o of offers) sell.push({ offer: o, purchases: await fetchPurchases(connection, o.address) })
    setSelling(sell)

    const purchases = await fetchBuyerPurchases(connection, wallet)
    const offerCache = new Map<string, Offer | null>()
    const buy: BuyerItem[] = []
    for (const p of purchases) {
      const k = p.offer.toBase58()
      if (!offerCache.has(k)) offerCache.set(k, await fetchOffer(connection, p.offer))
      buy.push({ purchase: p, offer: offerCache.get(k) ?? null })
    }
    setBuying(buy)
    return [...offers.map((o) => o.address), ...[...offerCache.keys()].map((k) => new PublicKey(k))]
  }, [connection, wallet])

  // Historia: ostatnie transakcje portfela + pełna historia znanych ofert (szybsze i obejmuje
  // stare zakupy). Duplikaty usuwamy po podpisie i rodzaju zdarzenia.
  const loadHistory = useCallback(
    async (offers: PublicKey[]) => {
      const lists = [await fetchWalletActivity(connection, wallet, 25)]
      for (const o of offers) lists.push(await fetchActivity(connection, o))
      const seen = new Set<string>()
      const merged = lists.flat().filter((e) => {
        const k = `${e.sig}:${e.kind}:${e.buyer ?? ''}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      setEvents(merged.sort((a, b) => a.slot - b.slot))
    },
    [connection, wallet],
  )

  useEffect(() => {
    setSelling(null)
    setBuying(null)
    setEvents(null)
    // Historia jest droższa (jedno zapytanie na transakcję), więc rzadziej. Po błędzie (np. 429)
    // zostaje „wczytuję” i ponawiamy przy następnym cyklu; pobrane transakcje są w cache.
    let offers: PublicKey[] = []
    const history = () => loadHistory(offers).catch((e) => console.warn('history', e))
    load()
      .then((o) => {
        offers = o
        return history()
      })
      .catch((e) => console.warn('wallet', e))
    const t = setInterval(() => load().then((o) => (offers = o)).catch(() => {}), 15000)
    const h = setInterval(history, 30000)
    return () => {
      clearInterval(t)
      clearInterval(h)
    }
  }, [connection, wallet, load, loadHistory])

  const myEvents = useMemo(() => (events ?? []).filter((e) => rolesIn(e, addr).length > 0 || e.actor === addr), [events, addr])
  const histSeller = myEvents.filter((e) => rolesIn(e, addr).includes('seller'))
  const histBuyer = myEvents.filter((e) => rolesIn(e, addr).includes('buyer'))

  // Kupujący
  const buyerDue = (buying ?? []).reduce((s, b) => s + (b.offer ? due(b.purchase, b.offer) : 0n), 0n)
  const buyerProtected = (buying ?? []).reduce((s, b) => s + b.purchase.reserve - b.purchase.claimed, 0n)
  const buyerRefunded =
    histBuyer.reduce((s, e) => s + (e.failed ? 0n : e.kind === 'refund' || e.kind === 'sellerRefund' ? e.amount ?? 0n : e.kind === 'release' ? e.toBuyer ?? 0n : 0n), 0n)
  const buyerSpent = histBuyer.reduce((s, e) => s + (!e.failed && e.kind === 'buy' ? e.amount ?? 0n : 0n), 0n)
  const claimable = (buying ?? []).filter((b) => b.offer && due(b.purchase, b.offer) > 0n)

  // Sprzedawca
  const sellerLocked = (selling ?? []).reduce((s, x) => s + x.purchases.reduce((a, p) => a + p.reserve - p.claimed, 0n), 0n)
  const sellerOwed = (selling ?? []).reduce((s, x) => s + x.purchases.reduce((a, p) => a + due(p, x.offer), 0n), 0n)
  const sellerRevenue = histSeller.reduce((s, e) => s + (!e.failed && e.kind === 'buy' ? e.amount ?? 0n : 0n), 0n)
  const sellerReceived = histSeller.reduce(
    (s, e) => s + (e.failed ? 0n : e.kind === 'buy' ? e.toSeller ?? 0n : e.kind === 'release' ? e.toSeller ?? 0n : 0n), 0n)

  const isSeller = (selling?.length ?? 0) > 0 || histSeller.length > 0
  const isBuyer = (buying?.length ?? 0) > 0 || histBuyer.length > 0
  const loading = selling === null || buying === null
  const tabs = TABS.filter((t) => (t === 'Jako sprzedawca' ? isSeller : t === 'Jako kupujący' ? isBuyer : true))

  const nameOf = (offer: string) => names[offer] ?? `Oferta ${short(offer)}`

  return (
    <>
      <section className="card product">
        <div className="product-head">
          <div>
            <div className="eyebrow">{isMe ? 'Twoje konto' : 'Portfel'}</div>
            <h1 className="mono">{short(addr)}</h1>
            <a className="small" href={explorerAddr(wallet)} target="_blank" rel="noreferrer">{addr} ↗</a>
          </div>
          <div className="roles">
            {loading && <span className="pill">Analizuję…</span>}
            {isSeller && <span className="role seller-role">🏷️ Sprzedawca · {selling?.length ?? 0} ofert</span>}
            {isBuyer && <span className="role">🛒 Kupujący · {buying?.length ?? 0} aktywnych zakupów</span>}
            {!loading && !isSeller && !isBuyer && events !== null && <span className="pill">Ten portfel nie korzystał jeszcze ze Zwrotki</span>}
          </div>
        </div>
      </section>

      <nav className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => onTab(t)}>
            {t}
            {t === 'Jako kupujący' && buyerDue > 0n && <span className="dot-badge" />}
          </button>
        ))}
      </nav>

      {tab === 'Podsumowanie' && (
        <>
          {buyerDue > 0n && (
            <section className="card buyer claim-all">
              <div>
                <div className="due yes">💸 {fmtZl(buyerDue)} do odebrania</div>
                <p className="muted small">z {claimable.length} zakupów, w których cena spadła</p>
              </div>
              <button
                className="big"
                disabled={busy || !publicKey}
                onClick={() => send(`Zwrot z ${claimable.length} zakupów`, claimable.map((b) => claimIx(b.offer!.address, b.purchase)))}
              >
                {isMe ? 'Odbierz wszystko' : 'Wypłać zwroty temu kupującemu'}
              </button>
            </section>
          )}
          {isBuyer && (
            <section className="card">
              <h2>🛒 Jako kupujący</h2>
              <div className="stats">
                <Stat label="Wydane przez Zwrotkę" value={events ? fmtZl(buyerSpent) : '…'} hint="ostatnie transakcje" />
                <Stat label="Chronione teraz" value={fmtZl(buyerProtected)} hint="rezerwa czeka na Ciebie" tone="ok" />
                <Stat label="Odzyskane" value={events ? fmtZl(buyerRefunded) : '…'} hint="zwroty po obniżkach" tone="ok" />
                <Stat label="Do odebrania" value={fmtZl(buyerDue)} tone={buyerDue > 0n ? 'warn' : undefined} />
              </div>
            </section>
          )}
          {isSeller && (
            <section className="card seller">
              <h2>🏷️ Jako sprzedawca</h2>
              <div className="stats">
                <Stat label="Przychód" value={events ? fmtZl(sellerRevenue) : '…'} hint="ostatnie transakcje" />
                <Stat label="Otrzymane" value={events ? fmtZl(sellerReceived) : '…'} hint="floor + rozliczone rezerwy" tone="ok" />
                <Stat label="Zablokowane w rezerwach" value={fmtZl(sellerLocked)} hint="we wszystkich ofertach" />
                <Stat label="Należne kupującym" value={fmtZl(sellerOwed)} tone={sellerOwed > 0n ? 'warn' : undefined} />
              </div>
            </section>
          )}
          {!loading && !isSeller && !isBuyer && events !== null && (
            <section className="card center muted">Brak zakupów i ofert Zwrotki dla tego portfela.</section>
          )}
        </>
      )}

      {tab === 'Jako kupujący' && (
        <section className="card">
          <h2>Aktywne zakupy z ochroną</h2>
          {buying === null ? <p className="muted small">Wczytuję…</p> : buying.length === 0 ? (
            <p className="muted small">Brak aktywnych zakupów. Rozliczone znajdziesz w Historii.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Oferta</th><th>Zapłacono</th><th>Ochrona</th><th>Do odebrania</th><th>Okno</th><th></th></tr></thead>
                <tbody>
                  {buying.map(({ purchase: p, offer: o }) => {
                    const d = o ? due(p, o) : 0n
                    const left = Number(p.windowEnd) - now
                    return (
                      <tr key={p.address.toBase58()}>
                        <td><Link to={`/oferta/${p.offer.toBase58()}`}>{nameOf(p.offer.toBase58())}</Link></td>
                        <td>{fmtZl(p.paid)}</td>
                        <td>{fmtZl(p.reserve - p.claimed)}</td>
                        <td><b>{fmtZl(d)}</b></td>
                        <td>{left > 0 ? fmtIn(left) : 'zakończone'}</td>
                        <td className="actions">
                          {o && d > 0n && <button className="small-btn" disabled={busy || !publicKey} onClick={() => send('Zwrot różnicy', claimIx(o.address, p))}>Odbierz</button>}
                          {o && left <= 0 && <button className="small-btn secondary" disabled={busy || !publicKey} onClick={() => send('Rozliczenie zakupu', releaseIx(o, p))}>Rozlicz</button>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'Jako sprzedawca' && (
        <section className="card">
          <h2>Oferty</h2>
          {selling === null ? <p className="muted small">Wczytuję…</p> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Oferta</th><th>Cena</th><th>Floor</th><th>Aktywne zakupy</th><th>W rezerwie</th><th>Należne</th></tr></thead>
                <tbody>
                  {[...selling].sort((a, b) => Number(b.offer.offerId - a.offer.offerId)).map(({ offer: o, purchases }) => (
                    <tr key={o.address.toBase58()}>
                      <td><Link to={`/oferta/${o.address.toBase58()}`}>{nameOf(o.address.toBase58())}</Link></td>
                      <td>{fmtZl(o.price)}</td>
                      <td>{fmtZl(o.floor)}</td>
                      <td>{purchases.length}</td>
                      <td>{fmtZl(purchases.reduce((a, p) => a + p.reserve - p.claimed, 0n))}</td>
                      <td><b>{fmtZl(purchases.reduce((a, p) => a + due(p, o), 0n))}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'Historia' && (
        <section className="card">
          <h2>Historia w Zwrotce</h2>
          <p className="muted small">Ostatnie transakcje portfela, które dotyczą programu Zwrotki, z rozpoznaną rolą.</p>
          {events === null ? <p className="muted small">Analizuję transakcje portfela…</p> : myEvents.length === 0 ? (
            <p className="muted small">Brak transakcji Zwrotki wśród ostatnich transakcji portfela.</p>
          ) : (
            <ul className="events">
              {[...myEvents].reverse().map((e, i) => {
                const roles = rolesIn(e, addr)
                return (
                  <li key={`${e.sig}${i}`} className={e.failed ? 'failed' : ''}>
                    <span className="ev-icon">{ICON[e.kind]}</span>
                    <div className="ev-body">
                      <div>
                        {roles.map((r) => (
                          <span key={r} className={`role mini ${r === 'seller' ? 'seller-role' : ''}`}>{r === 'seller' ? 'sprzedawca' : 'kupujący'}</span>
                        ))}{' '}
                        {describe(e)}
                        {e.offer && <> · <Link to={`/oferta/${e.offer}`}>{nameOf(e.offer)}</Link></>}
                      </div>
                      <div className="muted small">
                        {fmtDate(e.ts)} · <a href={explorerTx(e.sig)} target="_blank" rel="noreferrer">transakcja ↗</a>
                        {roles.length === 0 && ' · wywołane przez ten portfel w cudzej sprawie'}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </>
  )
}

const ICON: Record<ActivityEvent['kind'], string> = {
  create: '✨', buy: '🛒', price: '🏷️', refund: '💸', release: '🔓', sellerRefund: '↩️', closeSales: '⛔',
}

function describe(e: ActivityEvent) {
  switch (e.kind) {
    case 'create': return <>Utworzenie oferty: {fmtZl(e.amount ?? 0n)}, floor {fmtZl(e.toSeller ?? 0n)}</>
    case 'buy': return <>Zakup za {fmtZl(e.amount ?? 0n)} ({fmtZl(e.locked ?? 0n)} do rezerwy)</>
    case 'price': return <>Zmiana ceny na {fmtZl(e.amount ?? 0n)}</>
    case 'refund': return <>Zwrot {fmtZl(e.amount ?? 0n)} dla {short(e.buyer ?? '?')}</>
    case 'release': return <>Rozliczenie: {fmtZl(e.toBuyer ?? 0n)} kupującemu, {fmtZl(e.toSeller ?? 0n)} sprzedawcy</>
    case 'sellerRefund': return <>Anulowanie zakupu: zwrot {fmtZl(e.amount ?? 0n)} (dopłata sprzedawcy {fmtZl(e.fromSeller ?? 0n)})</>
    case 'closeSales': return <>Zakończenie sprzedaży</>
  }
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  )
}
