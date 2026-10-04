import { Fragment, useMemo, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import type { PublicKey } from '@solana/web3.js'
import { totals, type ActivityEvent } from './activity'
import type { Send } from './shell'
import { LineChart, MoneySplit, UnlockSchedule, fmtIn } from './charts'
import { PriceChart } from './PriceChart'
import { ProtectionMeter, Stepper, type StepState } from './funnel'
import {
  buyIx,
  claimIx,
  closeSalesIx,
  due,
  explorerAddr,
  explorerTx,
  fetchPurchases,
  fmtZl,
  minRefund,
  refundPurchaseIx,
  releaseIx,
  requestRefundIx,
  sellerStats,
  sellerTopUp,
  setPriceIx,
  simulatePriceCost,
  toLamports,
  toZl,
  type Offer,
  type Purchase,
  type RefundRequest,
  windowEndIfBoughtAt,
} from './program'

type Props = {
  offer: Offer
  name: string
  /** Nazwa tylko z parametru ?name= (bez potwierdzenia on-chain). */
  nameUnverified?: boolean
  purchases: Purchase[]
  mine: Purchase | null
  /** Prośby o zwrot, klucz = adres zakupu. */
  requests: Map<string, RefundRequest>
  events: ActivityEvent[] | null
  createdAt: number | null
  now: number
  busy: boolean
  send: Send
  isSeller: boolean
}

const short = (k: PublicKey | string) => {
  const s = typeof k === 'string' ? k : k.toBase58()
  return `${s.slice(0, 4)}…${s.slice(-4)}`
}
const fmtDate = (ts: number | bigint) => new Date(Number(ts) * 1000).toLocaleString('pl-PL')
const fmtTime = (ts: number) =>
  new Date(ts * 1000).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function fmtDuration(secs: number) {
  if (secs % 86400 === 0) return `${secs / 86400} dni`
  if (secs % 3600 === 0) return `${secs / 3600} h`
  if (secs % 60 === 0) return `${secs / 60} min`
  return `${secs} s`
}

function fmtLeft(secs: number) {
  if (secs <= 0) return 'zakończona'
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${m} min` : `${m} min ${s} s`
}

// Zakładki = osobne adresy: /oferta/:adres[/:slug]. Pierwsza zakładka nie ma sluga w URL.
export const SELLER_TABS = [
  { slug: 'przeglad', label: 'Przegląd' },
  { slug: 'analityka', label: 'Analityka' },
  { slug: 'symulator', label: 'Symulator ceny' },
  { slug: 'kupujacy', label: 'Kupujący' },
  { slug: 'historia', label: 'Historia' },
] as const
export const BUYER_TABS = [
  { slug: 'oferta', label: 'Oferta' },
  { slug: 'przejrzystosc', label: 'Przejrzystość' },
  { slug: 'historia', label: 'Historia' },
] as const

export function OfferView(p: Props & { tab: string; onTab: (slug: string) => void }) {
  const tabs = p.isSeller ? SELLER_TABS : BUYER_TABS
  const { tab, onTab } = p
  const owedNow = p.purchases.reduce((s, x) => s + due(x, p.offer), 0n)

  return (
    <>
      <ProductCard offer={p.offer} name={p.name} nameUnverified={!!p.nameUnverified} isSeller={p.isSeller} />
      {p.offer.closed && (
        <div className="notice">⛔ Sprzedaż zakończona: nowych zakupów nie ma. Istniejące zakupy i ich rezerwy działają dalej.</div>
      )}
      <nav className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.slug} role="tab" aria-selected={tab === t.slug} className={tab === t.slug ? 'active' : ''} onClick={() => onTab(t.slug)}>
            {t.label}
            {t.slug === 'kupujacy' && <span className="count">{p.purchases.length}</span>}
            {t.slug === 'kupujacy' && p.requests.size > 0 && <span className="dot-badge" title="prośby o zwrot" />}
            {t.slug === 'oferta' && p.mine && due(p.mine, p.offer) > 0n && <span className="dot-badge" />}
            {t.slug === 'przeglad' && owedNow > 0n && <span className="dot-badge" />}
          </button>
        ))}
      </nav>
      {tab === 'przeglad' && <SellerOverview {...p} goTo={onTab} />}
      {tab === 'analityka' && <Analytics {...p} />}
      {tab === 'symulator' && <Simulator {...p} />}
      {tab === 'kupujacy' && <PurchaseList {...p} />}
      {tab === 'oferta' && <BuyerPanel {...p} />}
      {tab === 'przejrzystosc' && <Analytics {...p} />}
      {tab === 'historia' && <ActivityFeed events={p.events} offer={p.offer} />}
    </>
  )
}

// ---------- Karta produktu ----------

function ProductCard({ offer, name, nameUnverified, isSeller }: { offer: Offer; name: string; nameUnverified: boolean; isSeller: boolean }) {
  const maxRefund = offer.price > offer.floor ? offer.price - offer.floor : 0n
  const pct = Math.round((Number(maxRefund) * 100) / Number(offer.price || 1n))
  const [copied, setCopied] = useState(false)
  const last = offer.history[offer.history.length - 1]
  return (
    <section className="card product">
      <div className="product-head">
        <div>
          <div className="eyebrow">{isSeller ? 'Twoja oferta' : 'Oferta'}</div>
          <h1>{name}</h1>
          {nameUnverified && (
            <div className="muted small">⚠️ Nazwa pochodzi z linku, nie z blockchaina: sprzedawca jej nie potwierdził.</div>
          )}
        </div>
        <div className="price-box">
          <div className="price">{fmtZl(offer.price)}</div>
          {last && <div className="muted small">ostatnia zmiana: {fmtDate(last.ts)}</div>}
        </div>
      </div>
      <div className="badge">
        <span>🛡️</span>
        <div>
          <b>Gwarancja ceny{pct > 0 && <> do {pct}%</>}</b>
          <div className="small">
            Jeśli cena spadnie w ciągu {offer.windowSecs > 0n ? fmtDuration(Number(offer.windowSecs)) : '—'} od zakupu
            {offer.eventStart > 0n && <> (najpóźniej do startu wydarzenia: {fmtDate(offer.eventStart)})</>}, różnica
            wraca automatycznie. Maksymalnie {fmtZl(maxRefund)}. Pieniądze na zwrot są zablokowane w programie od chwili
            zakupu.
          </div>
        </div>
      </div>
      <p className="muted small meta">
        Sprzedawca <a href={explorerAddr(offer.seller)} target="_blank" rel="noreferrer">{short(offer.seller)}</a> · oferta{' '}
        <a href={explorerAddr(offer.address)} target="_blank" rel="noreferrer">{short(offer.address)}</a> ·{' '}
        <button
          className="link"
          onClick={() => {
            navigator.clipboard.writeText(location.href.split('#')[0])
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? 'skopiowano ✓' : 'kopiuj link dla kupujących'}
        </button>
      </p>
    </section>
  )
}

// ---------- Sprzedawca: przegląd ----------

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  )
}

function SellerOverview({ offer, purchases, requests, events, now, busy, send, goTo }: Props & { goTo: (t: string) => void }) {
  const s = sellerStats(offer, purchases, now)
  const t = events ? totals(events) : null
  return (
    <>
      {requests.size > 0 && (
        <div className="notice warn-notice">
          📩 Prośby o zwrot: <b>{requests.size}</b>.{' '}
          <button className="link" onClick={() => goTo('kupujacy')}>Zobacz kupujących →</button>
        </div>
      )}
      <section className="card seller">
        <div className="spread">
          <h2>Przegląd</h2>
          <span className="pill">Aktywne gwarancje: {s.openWindows}</span>
        </div>
        <div className="stats">
          <Stat label="Sprzedane (łącznie)" value={t ? String(t.sales) : '…'} hint={t ? `przychód ${fmtZl(t.revenue)}${t.sellerRefunds ? ` · anulowane: ${t.sellerRefunds}` : ''}` : 'wczytuję historię'} />
          <Stat label="Masz już na koncie" value={t ? fmtZl(t.floorToSeller + t.releasedToSeller - t.sellerTopUps) : '…'} hint="floor + rozliczone rezerwy − dopłaty" tone="ok" />
          <Stat label="Zablokowane w rezerwie" value={fmtZl(s.locked)} hint="pilnuje program, nie Ty" />
          <Stat label="Należne kupującym teraz" value={fmtZl(s.owedNow)} hint="po Twoich obniżkach" tone={s.owedNow > 0n ? 'warn' : undefined} />
          <Stat label="Wróci do Ciebie" value={fmtZl(s.backToSeller)} hint={s.nextWindowEnd ? `pierwsze rozliczenie ${fmtIn(Number(s.nextWindowEnd) - now)}` : 'jeśli cena już nie spadnie'} tone="ok" />
          <Stat label="Maks. dalszy koszt" value={fmtZl(s.maxFurtherCost)} hint="najgorszy przypadek, znany z góry" />
        </div>
      </section>
      <QuickPrice offer={offer} purchases={purchases} now={now} busy={busy} send={send} onMore={() => goTo('symulator')} />
      <section className="card">
        <div className="spread">
          <h2>Ostatnie zdarzenia</h2>
          <button className="link" onClick={() => goTo('historia')}>cała historia →</button>
        </div>
        <EventList events={events ? events.slice(-5).reverse() : null} offer={offer} />
      </section>
      <CancelOfferCard offer={offer} purchases={purchases} busy={busy} send={send} />
    </>
  )
}

/**
 * Zakończenie sprzedaży albo anulowanie całej oferty. Anulowanie = close_sales +
 * refund_purchase (pełny zwrot) dla każdego zakupu, po kilka w jednej transakcji.
 */
function CancelOfferCard({
  offer, purchases, busy, send,
}: { offer: Offer; purchases: Purchase[]; busy: boolean; send: Send }) {
  const { publicKey } = useWallet()
  const { connection } = useConnection()
  const [confirm, setConfirm] = useState(false)
  const total = purchases.reduce((s, p) => s + p.paid - p.claimed, 0n)
  const topUp = purchases.reduce((s, p) => s + sellerTopUp(p, p.paid - p.claimed), 0n)

  const cancelAll = async () => {
    if (!publicKey) return
    // Najpierw zamykamy sprzedaż: od tej chwili lista zakupów już się nie wydłuży.
    if (!offer.closed && !(await send('Zakończenie sprzedaży', closeSalesIx(publicKey, offer.address)))) return
    // Zakupy i kwoty bierzemy ze świeżego stanu przed każdą paczką (do 5 na transakcję):
    // claim_difference może wywołać każdy, a zwrot ponad paid − claimed program odrzuca.
    const done = new Set<string>()
    for (let n = 1; n <= 100; n++) {
      const left = (await fetchPurchases(connection, offer.address)).filter((p) => !done.has(p.address.toBase58()))
      if (left.length === 0) break
      const batch = left.slice(0, 5)
      const sig = await send(
        `Anulowanie oferty: zwroty (${n})`,
        batch.map((p) => refundPurchaseIx(publicKey, offer.address, p, p.paid - p.claimed)),
      )
      if (!sig) return
      batch.forEach((p) => done.add(p.address.toBase58()))
    }
    setConfirm(false)
  }

  return (
    <section className="card danger-zone">
      <h2>Zakończenie i anulowanie</h2>
      <div className="danger-row">
        <div>
          <b>Zakończ sprzedaż</b>
          <p className="muted small">Nowych zakupów nie będzie. Istniejące gwarancje działają dalej.</p>
        </div>
        <button className="secondary" disabled={busy || offer.closed || !publicKey} onClick={() => publicKey && send('Zakończenie sprzedaży', closeSalesIx(publicKey, offer.address))}>
          {offer.closed ? 'Sprzedaż zakończona' : 'Zakończ sprzedaż'}
        </button>
      </div>
      <div className="danger-row">
        <div>
          <b>Anuluj ofertę: zwrot 100% dla {purchases.length} kupujących</b>
          <p className="muted small">
            Np. wydarzenie odwołane. Kupujący dostaną łącznie {fmtZl(total)}: z rezerw i z Twojej dopłaty{' '}
            <b>{fmtZl(topUp)}</b> (floor, który już masz).
          </p>
        </div>
        {!confirm ? (
          <button className="warn-btn" disabled={busy || !publicKey || (purchases.length === 0 && offer.closed)} onClick={() => setConfirm(true)}>
            Anuluj ofertę
          </button>
        ) : (
          <div className="inline">
            <button className="warn-btn" disabled={busy} onClick={cancelAll}>Tak, zwróć {fmtZl(total)}</button>
            <button className="link" onClick={() => setConfirm(false)}>nie</button>
          </div>
        )}
      </div>
    </section>
  )
}

function QuickPrice({
  offer, purchases, now, busy, send, onMore,
}: { offer: Offer; purchases: Purchase[]; now: number; busy: boolean; send: Send; onMore?: () => void }) {
  const { publicKey } = useWallet()
  const priceZl = toZl(offer.price)
  const [target, setTarget] = useState(Math.round(priceZl * 0.85))
  const sim = simulatePriceCost(offer, purchases, toLamports(target), now)
  const changesLeft = offer.maxChanges - offer.history.length
  return (
    <section className="card">
      <div className="spread">
        <h2>Zmień cenę</h2>
        {onMore && <button className="link" onClick={onMore}>symulator →</button>}
      </div>
      <div className="sim">
        <div className="inline">
          <input type="range" min={0} max={Math.max(priceZl * 1.5, 1)} step={10} value={target} onChange={(e) => setTarget(+e.target.value)} />
          <input type="number" value={target} onChange={(e) => setTarget(+e.target.value)} className="num" />
          <span>zł</span>
        </div>
        <p className="sim-result">
          {target >= priceZl ? (
            <>Podwyżka lub ta sama cena: <b>nic Cię nie kosztuje</b> wobec wcześniejszych kupujących.</>
          ) : sim.affected === 0 ? (
            <>Obniżka do {target} zł: <b>0 zł zwrotów</b> (nikt nie ma otwartego okna albo rezerwy są wyczerpane).</>
          ) : (
            <>Obniżka do {target} zł: zwroty dla <b>{sim.affected}</b> kupujących, łącznie <b>{fmtZl(sim.cost)}</b>.</>
          )}
        </p>
        <button
          disabled={busy || !publicKey || target <= 0 || changesLeft <= 0}
          onClick={() => publicKey && send(`Zmiana ceny na ${target} zł`, setPriceIx(publicKey, offer.address, toLamports(target)))}
        >
          Ustaw cenę {target} zł
        </button>
        <span className="muted small"> · pozostało zmian ceny: {changesLeft}</span>
      </div>
    </section>
  )
}

// ---------- Analityka (sprzedawca) / Przejrzystość (kupujący) ----------

function Analytics({ offer, purchases, events, createdAt, now, isSeller }: Props) {
  const s = sellerStats(offer, purchases, now)
  const t = events ? totals(events) : null

  const cumulative = useMemo(() => {
    if (!events) return []
    let sum = 0
    const pts = [{ x: createdAt ?? events[0]?.ts ?? now, y: 0 }]
    for (const e of events) {
      if (e.kind !== 'buy' || e.failed) continue
      sum += toZl(e.amount ?? 0n)
      pts.push({ x: e.ts, y: sum })
    }
    pts.push({ x: now, y: sum })
    return pts
  }, [events, createdAt, now])

  const unlockRows = purchases
    .filter((p) => p.reserve - p.claimed > 0n)
    .sort((a, b) => Number(a.windowEnd - b.windowEnd))
    .map((p) => ({
      key: p.address.toBase58(),
      label: short(p.buyer),
      amount: p.reserve - p.claimed,
      secsLeft: Number(p.windowEnd) - now,
      owed: due(p, offer),
    }))

  return (
    <>
      {!isSeller && (
        <section className="card">
          <h2>Dlaczego możesz zaufać tej gwarancji</h2>
          <p className="muted">
            Wszystko poniżej pochodzi prosto z blockchaina. Sprzedawca nie może tego edytować ani wypłacić rezerwy przed
            końcem okien gwarancji.
          </p>
          <div className="stats">
            <Stat label="Zablokowane na zwroty" value={fmtZl(s.locked)} hint="w programie, nie u sprzedawcy" tone="ok" />
            <Stat label="Wypłacone zwroty" value={t ? fmtZl(t.refundedToBuyers) : '…'} hint="kupującym, bez reklamacji" />
            <Stat label="Zmiany ceny" value={String(offer.history.length)} hint="każda zapisana on-chain" />
          </div>
        </section>
      )}
      <section className="card">
        <h2>Gdzie są pieniądze</h2>
        <p className="muted small">Cały przychód tej oferty, rozbity na to, kto go teraz ma.</p>
        {t ? (
          <MoneySplit
            segments={[
              { label: 'U sprzedawcy', value: t.floorToSeller + t.releasedToSeller - t.sellerTopUps, cls: 's1', hint: 'floor + rozliczone rezerwy − dopłaty do zwrotów' },
              { label: 'W rezerwie programu', value: s.locked, cls: 's2', hint: 'czeka na koniec okien' },
              { label: 'Zwrócone kupującym', value: t.refundedToBuyers, cls: 's3', hint: 'różnice po obniżkach' },
            ]}
          />
        ) : (
          <p className="muted small">Wczytuję historię z blockchaina…</p>
        )}
      </section>
      <section className="card">
        <h2>Cena i sprzedaż w czasie</h2>
        <PriceChart
          offer={offer}
          purchases={purchases}
          createdAt={createdAt}
          now={now}
          initialPrice={events?.find((e) => e.kind === 'create')?.amount ?? null}
        />
      </section>
      <div className="grid2 even">
        <section className="card">
          <h2>Przychód narastająco</h2>
          {events ? (
            <LineChart
              points={cumulative}
              step
              area
              xFmt={(x) => fmtTime(x)}
              yFmt={(y) => `${Math.round(y).toLocaleString('pl-PL')} zł`}
              ariaLabel="Przychód narastająco"
              width={420}
              height={220}
            />
          ) : (
            <p className="muted small">Wczytuję…</p>
          )}
        </section>
        <section className="card">
          <h2>Harmonogram odblokowania rezerwy</h2>
          <UnlockSchedule rows={unlockRows} />
        </section>
      </div>
    </>
  )
}

// ---------- Symulator ----------

function Simulator({ offer, purchases, now, busy, send }: Props) {
  const priceZl = toZl(offer.price)
  const curve = useMemo(() => {
    const pts = []
    const top = Math.max(priceZl, 1)
    for (let i = 0; i <= 40; i++) {
      const x = (top * i) / 40
      pts.push({ x, y: toZl(simulatePriceCost(offer, purchases, toLamports(x), now).cost) })
    }
    return pts
  }, [offer, purchases, now, priceZl])
  const open = purchases.filter((p) => Number(p.windowEnd) > now).length
  return (
    <>
      <section className="card seller">
        <h2>Ile kosztuje obniżka?</h2>
        <p className="muted small">
          Koszt zwrotów dla kupujących z otwartym oknem gwarancji ({open}), zależnie od nowej ceny. Poniżej floor koszt
          przestaje rosnąć: zwrot każdego kupującego jest ograniczony do jego rezerwy. To Twój maksymalny koszt, znany z góry.
        </p>
        <LineChart
          points={curve}
          area
          xFmt={(x) => `${Math.round(x)} zł`}
          yFmt={(y) => `${Math.round(y).toLocaleString('pl-PL')} zł`}
          markers={[{ x: toZl(offer.floor), label: `floor ${toZl(offer.floor)} zł` }]}
          ariaLabel="Koszt zwrotów zależnie od nowej ceny"
        />
      </section>
      <QuickPrice offer={offer} purchases={purchases} now={now} busy={busy} send={send} />
    </>
  )
}

// ---------- Kupujący ----------

function BuyerSteps({ connected, bought, active, refunded }: { connected: boolean; bought: boolean; active: boolean; refunded: boolean }) {
  const st = (done: boolean, current: boolean): StepState => (done ? 'done' : current ? 'current' : 'todo')
  return (
    <Stepper
      steps={[
        { label: 'Sprawdź ochronę', hint: 'ile odzyskasz przy promocji', state: st(bought || connected, !connected) },
        { label: 'Kup z ochroną', hint: 'rezerwa blokuje się w programie', state: st(bought, connected && !bought) },
        { label: 'Ochrona aktywna', hint: 'program pilnuje ceny za Ciebie', state: st(bought && !active, bought && active && !refunded) },
        { label: 'Zwrot różnicy', hint: 'bez reklamacji i zgody sprzedawcy', state: st(refunded, bought && !active && !refunded) },
      ]}
    />
  )
}

/** Kupujący prosi o anulowanie zakupu (np. odwołane zajęcia). Decyzję podejmuje sprzedawca. */
function RequestRefundCard({
  purchase, request, busy, send,
}: { purchase: Purchase; request?: RefundRequest; busy: boolean; send: Send }) {
  const { publicKey } = useWallet()
  const [reason, setReason] = useState('')
  const [open, setOpen] = useState(false)
  if (request) {
    return (
      <section className="card notice-card">
        <b>📩 Prośba o zwrot wysłana</b>
        <p className="muted small">
          „{request.reason || 'bez powodu'}” · {fmtDate(request.requestedAt)}. Sprzedawca widzi ją w swoim panelu. Jeśli się
          zgodzi, pieniądze wrócą automatycznie z rezerwy i jego dopłaty.
        </p>
      </section>
    )
  }
  if (!open) {
    return (
      <p className="muted small center">
        Zajęcia odwołane albo coś poszło nie tak?{' '}
        <button className="link" onClick={() => setOpen(true)}>Poproś sprzedawcę o zwrot</button>
      </p>
    )
  }
  return (
    <section className="card">
      <h3 className="meter-title">Poproś o zwrot</h3>
      <p className="muted small">
        To zgłoszenie dla sprzedawcy. Różnicę ceny dostajesz i tak, bez pytania. Pełny zwrot wymaga zgody sprzedawcy,
        bo część pieniędzy (floor) już do niego trafiła.
      </p>
      <div className="inline">
        <input
          maxLength={80}
          placeholder="Powód, np. zajęcia odwołane"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <button
          disabled={busy || !publicKey}
          onClick={() => publicKey && send('Prośba o zwrot', requestRefundIx(publicKey, purchase.address, reason.trim()))}
        >
          Wyślij prośbę
        </button>
      </div>
    </section>
  )
}

function BuyerPanel({ offer, mine, requests, now, busy, send }: Props) {
  const { publicKey } = useWallet()
  const priceZl = toZl(offer.price)
  const floorZl = toZl(offer.price < offer.floor ? offer.price : offer.floor)

  if (!mine) {
    const toSeller = offer.price < offer.floor ? offer.price : offer.floor
    // Po starcie wydarzenia zakup nie miałby gwarancji: program go odrzuca.
    const eventStarted = offer.eventStart > 0n && Number(offer.eventStart) <= now
    // Faktyczne okno przy zakupie teraz: program skraca je do startu wydarzenia.
    const guaranteeSecs = windowEndIfBoughtAt(offer, now) - now
    const cappedByEvent = offer.eventStart > 0n && (offer.windowSecs === 0n || now + Number(offer.windowSecs) > Number(offer.eventStart))
    return (
      <>
        <BuyerSteps connected={!!publicKey} bought={false} active={false} refunded={false} />
        <div className="grid2 buy-grid">
          <section className="card">
            <ProtectionMeter key={priceZl} price={priceZl} floor={floorZl} title="Co jeśli cena spadnie po Twoim zakupie?" />
          </section>
          <section className="card buyer buy-box">
            <div className="muted small">Cena dziś</div>
            <div className="price">{fmtZl(offer.price)}</div>
            <ul className="checks">
              <li>✓ Ochrona do {fmtZl(offer.price - toSeller)} przez {cappedByEvent ? `${fmtLeft(guaranteeSecs)} (do startu wydarzenia)` : fmtDuration(Number(offer.windowSecs))}</li>
              <li>✓ Rezerwa zablokowana w programie, nie u sprzedawcy</li>
              <li>✓ Zwrot jednym kliknięciem albo automatycznie</li>
            </ul>
            {offer.closed ? (
              <button className="big wide" disabled>Sprzedaż zakończona</button>
            ) : eventStarted ? (
              <button className="big wide" disabled>Wydarzenie już się zaczęło</button>
            ) : publicKey ? (
              <button className="big wide" disabled={busy} onClick={() => send(`Zakup za ${fmtZl(offer.price)}`, buyIx(publicKey, offer))}>
                Kup z ochroną ceny
              </button>
            ) : (
              <div className="center"><WalletMultiButton /></div>
            )}
            <p className="muted small center">
              {fmtZl(toSeller)} trafi do sprzedawcy od razu, {fmtZl(offer.price - toSeller)} czeka w rezerwie.
            </p>
          </section>
        </div>
      </>
    )
  }
  const d = due(mine, offer)
  const left = Number(mine.windowEnd) - now
  const total = Number(mine.windowEnd - mine.boughtAt) || 1
  const progress = Math.min(100, Math.max(0, ((total - left) / total) * 100))
  return (
    <>
    <BuyerSteps connected bought active={left > 0} refunded={mine.claimed > 0n && d === 0n && left <= 0} />
    <section className="card buyer">
      <div className="spread">
        <h2>Twój zakup</h2>
        <span className={`pill ${left > 0 ? 'ok' : ''}`}>{left > 0 ? `Gwarancja aktywna: ${fmtLeft(left)}` : 'Gwarancja zakończona'}</span>
      </div>
      <div className="progress" aria-hidden="true"><div style={{ width: `${progress}%` }} /></div>
      <div className="stats three">
        <Stat label="Zapłacono" value={fmtZl(mine.paid)} />
        <Stat label="W rezerwie dla Ciebie" value={fmtZl(mine.reserve - mine.claimed)} />
        <Stat label="Już odebrano" value={fmtZl(mine.claimed)} />
      </div>
      <div className={`due ${d > 0n ? 'yes' : ''}`}>
        {d > 0n ? <>💸 {fmtZl(d)} do odebrania</> : 'Cena nie spadła: nic do odebrania'}
      </div>
      <div className="inline">
        <button className="big" disabled={busy || d === 0n} onClick={() => send(`Zwrot różnicy ${fmtZl(d)}`, claimIx(offer.address, mine))}>
          Odbierz różnicę
        </button>
        {left <= 0 && (
          <button className="secondary" disabled={busy} onClick={() => send('Rozliczenie zakupu', releaseIx(offer, mine))}>
            Rozlicz zakup
          </button>
        )}
      </div>
      <p className="muted small">Zwrot wysyła program. Sprzedawca nie musi go zatwierdzać i nie może go zablokować.</p>
    </section>
    <RequestRefundCard purchase={mine} request={requests.get(mine.address.toBase58())} busy={busy} send={send} />
    {left > 0 && (
      <section className="card">
        <ProtectionMeter
          key={String(mine.paid)}
          price={toZl(mine.paid)}
          floor={toZl(mine.paid - mine.reserve)}
          title="Twoja ochrona: co jeśli cena spadnie dalej?"
        />
      </section>
    )}
    </>
  )
}

function PurchaseList({ offer, purchases, requests, now, busy, send, isSeller }: Props) {
  const [refunding, setRefunding] = useState<string | null>(null)
  if (purchases.length === 0) {
    return <section className="card muted">Brak aktywnych zakupów. Rozliczone zakupy znajdziesz w zakładce Historia.</section>
  }
  // Najpierw zakupy z prośbą o zwrot.
  const sorted = [...purchases].sort(
    (a, b) => Number(requests.has(b.address.toBase58())) - Number(requests.has(a.address.toBase58())),
  )
  return (
    <section className="card">
      <h2>{isSeller ? 'Kupujący z aktywną rezerwą' : 'Zakupy'} ({purchases.length})</h2>
      <p className="muted small">
        Każdy może wypłacić zwrot różnicy albo rozliczyć zakup po końcu okna. Kwoty liczy program.
        {isSeller && ' Ty możesz też anulować zakup: zwrot idzie najpierw z rezerwy, resztę dopłacasz.'}
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kupujący</th><th>Kupił</th><th>Zapłacił</th><th>Rezerwa</th><th>Odebrał</th><th>Należy się</th><th>Okno</th><th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const key = p.address.toBase58()
              const d = due(p, offer)
              const left = Number(p.windowEnd) - now
              const req = requests.get(key)
              return (
                <Fragment key={key}>
                  <tr className={req ? 'has-request' : ''}>
                    <td>
                      <a href={explorerAddr(p.buyer)} target="_blank" rel="noreferrer">{short(p.buyer)}</a>
                      {req && <div className="req-badge" title={req.reason}>📩 prosi o zwrot{req.reason ? `: „${req.reason}”` : ''}</div>}
                    </td>
                    <td>{fmtTime(Number(p.boughtAt))}</td>
                    <td>{fmtZl(p.paid)}</td>
                    <td>{fmtZl(p.reserve - p.claimed)}</td>
                    <td>{fmtZl(p.claimed)}</td>
                    <td><b>{fmtZl(d)}</b></td>
                    <td>{fmtLeft(left)}</td>
                    <td className="actions">
                      {d > 0n && (
                        <button className="small-btn" disabled={busy} onClick={() => send(`Zwrot dla ${short(p.buyer)}`, claimIx(offer.address, p))}>Wypłać różnicę</button>
                      )}
                      {left <= 0 && (
                        <button className="small-btn secondary" disabled={busy} onClick={() => send(`Rozliczenie ${short(p.buyer)}`, releaseIx(offer, p))}>Rozlicz</button>
                      )}
                      {isSeller && (
                        <button className="small-btn warn-btn" disabled={busy} onClick={() => setRefunding(refunding === key ? null : key)}>
                          {refunding === key ? 'Zamknij' : 'Anuluj zakup'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {isSeller && refunding === key && (
                    <tr className="refund-row">
                      <td colSpan={8}>
                        <RefundForm offer={offer} purchase={p} busy={busy} send={send} onDone={() => setRefunding(null)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** Formularz anulowania jednego zakupu: pełny albo częściowy zwrot. */
function RefundForm({
  offer, purchase: p, busy, send, onDone,
}: { offer: Offer; purchase: Purchase; busy: boolean; send: Send; onDone: () => void }) {
  const { publicKey } = useWallet()
  const max = p.paid - p.claimed
  const min = minRefund(p)
  const [amountZl, setAmountZl] = useState(toZl(max))
  const amount = toLamports(amountZl)
  const valid = amount >= min && amount <= max
  const topUp = sellerTopUp(p, amount)
  const fromReserve = amount - topUp
  return (
    <div className="refund-form">
      <div className="inline">
        <span>Zwróć kupującemu</span>
        <input type="number" className="num" value={amountZl} onChange={(e) => setAmountZl(+e.target.value)} />
        <span>zł</span>
        <button className="link" onClick={() => setAmountZl(toZl(max))}>całość ({fmtZl(max)})</button>
        {min > 0n && <button className="link" onClick={() => setAmountZl(toZl(min))}>minimum: cała rezerwa ({fmtZl(min)})</button>}
      </div>
      <p className="small">
        {valid ? (
          <>
            Z rezerwy: <b>{fmtZl(fromReserve)}</b> · Twoja dopłata: <b>{fmtZl(topUp)}</b>. Zakup zostanie zamknięty.
          </>
        ) : (
          <span className="err-text">
            Kwota musi być między {fmtZl(min)} (cała rezerwa: przy anulowaniu trafia do kupującego) a {fmtZl(max)}.
          </span>
        )}
      </p>
      <button
        className="warn-btn"
        disabled={busy || !valid || !publicKey}
        onClick={async () => {
          if (!publicKey) return
          const sig = await send(`Anulowanie zakupu ${short(p.buyer)}: zwrot ${fmtZl(amount)}`, refundPurchaseIx(publicKey, offer.address, p, amount))
          if (sig) onDone()
        }}
      >
        Anuluj zakup i zwróć {fmtZl(valid ? amount : 0n)}
      </button>
    </div>
  )
}

// ---------- Historia ----------

const KIND: Record<ActivityEvent['kind'], { icon: string; cls: string }> = {
  create: { icon: '✨', cls: 'k-create' },
  buy: { icon: '🛒', cls: 'k-buy' },
  price: { icon: '🏷️', cls: 'k-price' },
  refund: { icon: '💸', cls: 'k-refund' },
  release: { icon: '🔓', cls: 'k-release' },
  sellerRefund: { icon: '↩️', cls: 'k-refund' },
  closeSales: { icon: '⛔', cls: 'k-price' },
}

function describe(e: ActivityEvent, offer: Offer) {
  const isSellerActor = e.actor === offer.seller.toBase58()
  switch (e.kind) {
    case 'create':
      return <>Utworzono ofertę: cena {fmtZl(e.amount ?? 0n)}, floor {fmtZl(e.toSeller ?? 0n)}</>
    case 'buy':
      return <>Zakup za {fmtZl(e.amount ?? 0n)} przez {short(e.buyer ?? e.actor)}: {fmtZl(e.toSeller ?? 0n)} do sprzedawcy, {fmtZl(e.locked ?? 0n)} do rezerwy</>
    case 'price':
      return <>Nowa cena: {fmtZl(e.amount ?? 0n)}</>
    case 'refund':
      return (
        <>
          Zwrot {fmtZl(e.amount ?? 0n)} dla {short(e.buyer ?? '?')}{' '}
          <span className="muted">· wywołał {isSellerActor ? 'sprzedawca' : e.actor === e.buyer ? 'kupujący' : short(e.actor)}, bez podpisu sprzedawcy</span>
        </>
      )
    case 'release':
      return <>Rozliczenie zakupu {short(e.buyer ?? '?')}: {fmtZl(e.toBuyer ?? 0n)} kupującemu, {fmtZl(e.toSeller ?? 0n)} sprzedawcy</>
    case 'sellerRefund':
      return (
        <>
          Anulowanie zakupu {short(e.buyer ?? '?')}: zwrot {fmtZl(e.amount ?? 0n)}
          <span className="muted"> · sprzedawca dopłacił {fmtZl(e.fromSeller ?? 0n)}, wróciło do niego {fmtZl(e.toSeller ?? 0n)} rezerwy</span>
        </>
      )
    case 'closeSales':
      return <>Sprzedaż zakończona przez sprzedawcę</>
  }
}

function EventList({ events, offer }: { events: ActivityEvent[] | null; offer?: Offer }) {
  if (!events) return <p className="muted small">Wczytuję historię z blockchaina…</p>
  if (events.length === 0) return <p className="muted small">Brak zdarzeń.</p>
  return (
    <ul className="events">
      {events.map((e, i) => (
        <li key={`${e.sig}${i}`} className={`${KIND[e.kind].cls} ${e.failed ? 'failed' : ''}`}>
          <span className="ev-icon">{KIND[e.kind].icon}</span>
          <div className="ev-body">
            <div>{offer ? describe(e, offer) : e.kind}</div>
            <div className="muted small">
              {fmtDate(e.ts)} · <a href={explorerTx(e.sig)} target="_blank" rel="noreferrer">transakcja ↗</a>
              {e.failed && ' · nieudana'}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

function ActivityFeed({ events, offer }: { events: ActivityEvent[] | null; offer: Offer }) {
  return (
    <section className="card">
      <h2>Historia on-chain</h2>
      <p className="muted small">Każde zdarzenie to transakcja w Solana Explorer. Tej historii nikt nie może edytować.</p>
      <EventList events={events ? [...events].reverse() : null} offer={offer} />
    </section>
  )
}
