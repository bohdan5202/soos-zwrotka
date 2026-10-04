import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import type { TransactionInstruction } from '@solana/web3.js'
import { fetchActivity, totals, type ActivityEvent } from '../activity'
import { LineChart, UnlockSchedule, fmtIn } from '../charts'
import { loadNames } from '../names'
import {
  claimIx,
  due,
  fetchPurchases,
  fetchRefundRequests,
  fetchSellerOffers,
  fmtZl,
  liveRequests,
  readTitles,
  releaseIx,
  sellerStats,
  toZl,
  type Offer,
  type Purchase,
  type RefundRequest,
} from '../program'
import { useRefreshOnTx, useTx } from '../shell'

type Row = { offer: Offer; purchases: Purchase[]; requests: Map<string, RefundRequest>; events: ActivityEvent[] }

const short = (s: string) => `${s.slice(0, 4)}…${s.slice(-4)}`
const fmtDay = (ts: number) => new Date(ts * 1000).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  )
}

/** Wszystkie oferty sprzedawcy w jednym miejscu: KPI, statusy zakupów, akcje zbiorcze. */
export function Panel() {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const { send, busy, now } = useTx()
  const [rows, setRows] = useState<Row[] | null>(null)

  const load = useCallback(async () => {
    if (!publicKey) return
    const offers = await fetchSellerOffers(connection, publicKey)
    const out: Row[] = []
    for (const o of offers) {
      const [purchases, requests, events] = await Promise.all([
        fetchPurchases(connection, o.address),
        fetchRefundRequests(connection, o.address),
        fetchActivity(connection, o.address).catch(() => [] as ActivityEvent[]),
      ])
      out.push({ offer: o, purchases, requests: liveRequests(requests, purchases), events })
    }
    setRows(out.sort((a, b) => Number(b.offer.offerId - a.offer.offerId)))
  }, [connection, publicKey])

  useEffect(() => {
    setRows(null)
    load().catch((e) => console.warn('panel', e))
    const t = setInterval(() => load().catch(() => {}), 30000)
    return () => clearInterval(t)
  }, [load])
  useRefreshOnTx(() => load().catch(() => {}))

  const names = { ...readTitles(), ...loadNames() }
  const nameOf = (o: Offer) => names[o.address.toBase58()] ?? `Oferta #${o.offerId}`

  const agg = useMemo(() => {
    if (!rows) return null
    const all = rows.flatMap((r) => r.purchases.map((p) => ({ p, o: r.offer })))
    const t = totals(rows.flatMap((r) => r.events))
    const stats = rows.map((r) => sellerStats(r.offer, r.purchases, now))
    const sum = (f: (s: (typeof stats)[number]) => bigint) => stats.reduce((a, s) => a + f(s), 0n)
    const inWindow = all.filter(({ p }) => Number(p.windowEnd) > now)
    const toSettle = all.filter(({ p }) => Number(p.windowEnd) <= now)
    const owed = all.filter(({ p, o }) => due(p, o) > 0n)
    const requests = rows.flatMap((r) => [...r.requests.values()].map((q) => ({ q, o: r.offer })))
    const finished = rows.flatMap((r) => r.events).filter((e) => !e.failed && (e.kind === 'release' || e.kind === 'sellerRefund')).length
    return {
      all, t, inWindow, toSettle, owed, requests, finished,
      locked: sum((s) => s.locked),
      owedNow: sum((s) => s.owedNow),
      maxFurther: sum((s) => s.maxFurtherCost),
    }
  }, [rows, now])

  if (!publicKey) {
    return (
      <section className="card center narrow">
        <h1>Panel sprzedawcy</h1>
        <p className="muted">Połącz portfel, którym wystawiasz oferty.</p>
        <WalletMultiButton />
      </section>
    )
  }
  if (!rows || !agg) return <section className="card muted">Zbieram dane ze wszystkich Twoich ofert…</section>
  if (rows.length === 0) {
    return (
      <section className="card center narrow">
        <h1>Panel sprzedawcy</h1>
        <p className="muted">Nie masz jeszcze ofert.</p>
        <Link className="btn" to="/sprzedawca">Wystaw pierwszą ofertę</Link>
      </section>
    )
  }

  // Akcje zbiorcze: po kilka instrukcji na transakcję (limit rozmiaru).
  const batch = async (label: string, ixs: TransactionInstruction[], size: number) => {
    for (let i = 0; i < ixs.length; i += size) {
      const sig = await send(`${label} (${Math.floor(i / size) + 1}/${Math.ceil(ixs.length / size)})`, ixs.slice(i, i + size))
      if (!sig) return
    }
  }

  // Przychód narastająco ze wszystkich ofert.
  let acc = 0
  const revenue = rows
    .flatMap((r) => r.events)
    .filter((e) => e.kind === 'buy' && !e.failed)
    .sort((a, b) => a.ts - b.ts)
    .map((e) => ({ x: e.ts, y: (acc += toZl(e.amount ?? 0n)) }))
  if (revenue.length) {
    revenue.unshift({ x: revenue[0].x - 60, y: 0 })
    revenue.push({ x: now, y: acc })
  }

  const unlock = agg.all
    .filter(({ p }) => p.reserve - p.claimed > 0n)
    .sort((a, b) => Number(a.p.windowEnd - b.p.windowEnd))
    .slice(0, 8)
    .map(({ p, o }) => ({
      key: p.address.toBase58(),
      label: short(p.buyer.toBase58()),
      amount: p.reserve - p.claimed,
      secsLeft: Number(p.windowEnd) - now,
      owed: due(p, o),
    }))

  return (
    <>
      <section className="hero compact">
        <div className="eyebrow">Panel sprzedawcy</div>
        <h1>Wszystkie Twoje oferty</h1>
      </section>

      <div className="stats kpis">
        <Stat label="Sprzedane" value={`${agg.t.sales} szt.`} hint={`przychód ${fmtZl(agg.t.revenue)}`} />
        <Stat label="Masz na koncie" value={fmtZl(agg.t.floorToSeller + agg.t.releasedToSeller - agg.t.sellerTopUps)} hint="floor + rozliczone − dopłaty" tone="ok" />
        <Stat label="Zablokowane w rezerwach" value={fmtZl(agg.locked)} hint="pilnuje program" />
        <Stat label="Należne kupującym" value={fmtZl(agg.owedNow)} tone={agg.owedNow > 0n ? 'warn' : undefined} hint="po Twoich obniżkach" />
        <Stat label="Maks. dalszy koszt" value={fmtZl(agg.maxFurther)} hint="najgorszy przypadek" />
      </div>

      <section className="card">
        <h2>Status zakupów</h2>
        <div className="pipeline">
          <div className="stage s-active"><b>{agg.inWindow.length}</b><span>🟢 W trakcie</span><small>okno gwarancji otwarte</small></div>
          <div className="stage s-settle"><b>{agg.toSettle.length}</b><span>🟡 Do rozliczenia</span><small>okno minęło, czeka na release</small></div>
          <div className="stage s-request"><b>{agg.requests.length}</b><span>🔴 Prośby o zwrot</span><small>czekają na Twoją decyzję</small></div>
          <div className="stage s-done"><b>{agg.finished}</b><span>✅ Zakończone</span><small>rozliczone albo zwrócone</small></div>
        </div>
        <div className="inline actions-row">
          <button
            disabled={busy || agg.toSettle.length === 0}
            onClick={() => batch('Rozliczenie', agg.toSettle.map(({ p, o }) => releaseIx(o, p)), 5)}
          >
            Rozlicz wszystkie gotowe ({agg.toSettle.length})
          </button>
          <button
            className="secondary"
            disabled={busy || agg.owed.length === 0}
            onClick={() => batch('Wypłata różnic', agg.owed.map(({ p, o }) => claimIx(o.address, p)), 6)}
          >
            Wypłać należne różnice ({agg.owed.length})
          </button>
        </div>
        {agg.requests.length > 0 && (
          <ul className="req-list">
            {agg.requests.map(({ q, o }) => (
              <li key={q.address.toBase58()}>
                📩 <b>{short(q.buyer.toBase58())}</b> w „{nameOf(o)}”: {q.reason || 'bez powodu'}{' '}
                <Link to={`/oferta/${o.address.toBase58()}/kupujacy`}>rozpatrz →</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Oferty</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Oferta</th><th>Status</th><th>Cena</th><th>Sprzedane</th><th>W trakcie</th><th>Rezerwa</th><th>Należne</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map(({ offer: o, purchases, requests, events }) => {
                const t = totals(events)
                const cancelled = o.closed && t.sellerRefunds > 0 && purchases.length === 0
                const status = cancelled ? 'anulowana' : o.closed ? 'zakończona' : 'sprzedaż trwa'
                return (
                  <tr key={o.address.toBase58()}>
                    <td><Link to={`/oferta/${o.address.toBase58()}`}>{nameOf(o)}</Link></td>
                    <td><span className={`pill ${o.closed ? '' : 'ok'}`}>{status}</span>{requests.size > 0 && <span className="req-badge"> 📩 {requests.size}</span>}</td>
                    <td>{fmtZl(o.price)}</td>
                    <td>{t.sales}</td>
                    <td>{purchases.filter((p) => Number(p.windowEnd) > now).length}</td>
                    <td>{fmtZl(purchases.reduce((a, p) => a + p.reserve - p.claimed, 0n))}</td>
                    <td><b>{fmtZl(purchases.reduce((a, p) => a + due(p, o), 0n))}</b></td>
                    <td><Link className="link" to={`/oferta/${o.address.toBase58()}/analityka`}>analityka →</Link></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid2 even">
        <section className="card">
          <h2>Przychód narastająco</h2>
          {revenue.length > 1 ? (
            <LineChart points={revenue} step area width={420} height={220} xFmt={fmtDay} yFmt={(y) => `${Math.round(y).toLocaleString('pl-PL')} zł`} ariaLabel="Przychód narastająco ze wszystkich ofert" />
          ) : (
            <p className="muted small">Brak sprzedaży.</p>
          )}
        </section>
        <section className="card">
          <h2>Najbliższe odblokowania</h2>
          <UnlockSchedule rows={unlock} />
          {agg.inWindow.length > 0 && (
            <p className="muted small">Pierwsze okno kończy się {fmtIn(Math.min(...agg.inWindow.map(({ p }) => Number(p.windowEnd))) - now)}.</p>
          )}
        </section>
      </div>
    </>
  )
}
