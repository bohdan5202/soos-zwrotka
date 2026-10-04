import { useEffect, useMemo, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import type { PublicKey, TransactionInstruction } from '@solana/web3.js'
import { totals, type ActivityEvent } from './activity'
import { LineChart, MoneySplit, UnlockSchedule, fmtIn } from './charts'
import { PriceChart } from './PriceChart'
import { ProtectionMeter, Stepper, type StepState } from './funnel'
import {
  buyIx,
  claimIx,
  due,
  explorerAddr,
  explorerTx,
  fmtZl,
  releaseIx,
  sellerStats,
  setPriceIx,
  simulatePriceCost,
  toLamports,
  toZl,
  type Offer,
  type Purchase,
} from './program'

export type Send = (label: string, ix: TransactionInstruction) => Promise<string | undefined>

type Props = {
  offer: Offer
  name: string
  purchases: Purchase[]
  mine: Purchase | null
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

const SELLER_TABS = ['Przegląd', 'Analityka', 'Symulator ceny', 'Kupujący', 'Historia'] as const
const BUYER_TABS = ['Oferta', 'Przejrzystość', 'Historia'] as const

function useTab(tabs: readonly string[]) {
  const slug = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ /g, '-')
  const fromHash = () => tabs.find((t) => `#${slug(t)}` === location.hash) ?? tabs[0]
  const [tab, setTab] = useState(fromHash)
  useEffect(() => {
    const on = () => setTab(fromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  })
  useEffect(() => {
    if (!tabs.includes(tab)) setTab(tabs[0])
  }, [tabs, tab])
  return [tab, (t: string) => { history.replaceState(null, '', `#${slug(t)}`); setTab(t) }] as const
}

export function OfferView(p: Props) {
  const tabs = p.isSeller ? SELLER_TABS : BUYER_TABS
  const [tab, setTab] = useTab(tabs)
  const owedNow = p.purchases.reduce((s, x) => s + due(x, p.offer), 0n)

  return (
    <>
      <ProductCard offer={p.offer} name={p.name} isSeller={p.isSeller} />
      <nav className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
            {t === 'Kupujący' && <span className="count">{p.purchases.length}</span>}
            {t === 'Oferta' && p.mine && due(p.mine, p.offer) > 0n && <span className="dot-badge" />}
            {t === 'Przegląd' && owedNow > 0n && <span className="dot-badge" />}
          </button>
        ))}
      </nav>
      {tab === 'Przegląd' && <SellerOverview {...p} goTo={setTab} />}
      {tab === 'Analityka' && <Analytics {...p} />}
      {tab === 'Symulator ceny' && <Simulator {...p} />}
      {tab === 'Kupujący' && <PurchaseList {...p} />}
      {tab === 'Oferta' && <BuyerPanel {...p} />}
      {tab === 'Przejrzystość' && <Analytics {...p} />}
      {tab === 'Historia' && <ActivityFeed events={p.events} offer={p.offer} />}
    </>
  )
}

// ---------- Karta produktu ----------

function ProductCard({ offer, name, isSeller }: { offer: Offer; name: string; isSeller: boolean }) {
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

function SellerOverview({ offer, purchases, events, now, busy, send, goTo }: Props & { goTo: (t: string) => void }) {
  const s = sellerStats(offer, purchases, now)
  const t = events ? totals(events) : null
  return (
    <>
      <section className="card seller">
        <div className="spread">
          <h2>Przegląd</h2>
          <span className="pill">Aktywne gwarancje: {s.openWindows}</span>
        </div>
        <div className="stats">
          <Stat label="Sprzedane (łącznie)" value={t ? String(t.sales) : '…'} hint={t ? `przychód ${fmtZl(t.revenue)}` : 'wczytuję historię'} />
          <Stat label="Masz już na koncie" value={t ? fmtZl(t.floorToSeller + t.releasedToSeller) : '…'} hint="floor + rozliczone rezerwy" tone="ok" />
          <Stat label="Zablokowane w rezerwie" value={fmtZl(s.locked)} hint="pilnuje program, nie Ty" />
          <Stat label="Należne kupującym teraz" value={fmtZl(s.owedNow)} hint="po Twoich obniżkach" tone={s.owedNow > 0n ? 'warn' : undefined} />
          <Stat label="Wróci do Ciebie" value={fmtZl(s.backToSeller)} hint={s.nextWindowEnd ? `pierwsze rozliczenie ${fmtIn(Number(s.nextWindowEnd) - now)}` : 'jeśli cena już nie spadnie'} tone="ok" />
          <Stat label="Maks. dalszy koszt" value={fmtZl(s.maxFurtherCost)} hint="najgorszy przypadek, znany z góry" />
        </div>
      </section>
      <QuickPrice offer={offer} purchases={purchases} now={now} busy={busy} send={send} onMore={() => goTo('Symulator ceny')} />
      <section className="card">
        <div className="spread">
          <h2>Ostatnie zdarzenia</h2>
          <button className="link" onClick={() => goTo('Historia')}>cała historia →</button>
        </div>
        <EventList events={events ? events.slice(-5).reverse() : null} offer={offer} />
      </section>
    </>
  )
}

function QuickPrice({
  offer, purchases, now, busy, send, onMore,
}: { offer: Offer; purchases: Purchase[]; now: number; busy: boolean; send: Send; onMore?: () => void }) {
  const { publicKey } = useWallet()
  const priceZl = toZl(offer.price)
  const [target, setTarget] = useState(Math.round(priceZl * 0.85))
  const sim = simulatePriceCost(offer, purchases, toLamports(target), now)
  const changesLeft = 32 - offer.history.length
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
              { label: 'U sprzedawcy', value: t.floorToSeller + t.releasedToSeller, cls: 's1', hint: 'floor + rozliczone rezerwy' },
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

function BuyerPanel({ offer, mine, now, busy, send }: Props) {
  const { publicKey } = useWallet()
  const priceZl = toZl(offer.price)
  const floorZl = toZl(offer.price < offer.floor ? offer.price : offer.floor)

  if (!mine) {
    const toSeller = offer.price < offer.floor ? offer.price : offer.floor
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
              <li>✓ Ochrona do {fmtZl(offer.price - toSeller)} przez {offer.windowSecs > 0n ? fmtDuration(Number(offer.windowSecs)) : 'okres oferty'}</li>
              <li>✓ Rezerwa zablokowana w programie, nie u sprzedawcy</li>
              <li>✓ Zwrot jednym kliknięciem albo automatycznie</li>
            </ul>
            {publicKey ? (
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

function PurchaseList({ offer, purchases, now, busy, send, isSeller }: Props) {
  if (purchases.length === 0) {
    return <section className="card muted">Brak aktywnych zakupów. Rozliczone zakupy znajdziesz w zakładce Historia.</section>
  }
  return (
    <section className="card">
      <h2>{isSeller ? 'Kupujący z aktywną rezerwą' : 'Zakupy'} ({purchases.length})</h2>
      <p className="muted small">Każdy może wypłacić zwrot kupującemu albo rozliczyć zakup po końcu okna. Kwoty liczy program.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kupujący</th><th>Kupił</th><th>Zapłacił</th><th>Rezerwa</th><th>Odebrał</th><th>Należy się</th><th>Okno</th><th></th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => {
              const d = due(p, offer)
              const left = Number(p.windowEnd) - now
              return (
                <tr key={p.address.toBase58()}>
                  <td><a href={explorerAddr(p.buyer)} target="_blank" rel="noreferrer">{short(p.buyer)}</a></td>
                  <td>{fmtTime(Number(p.boughtAt))}</td>
                  <td>{fmtZl(p.paid)}</td>
                  <td>{fmtZl(p.reserve - p.claimed)}</td>
                  <td>{fmtZl(p.claimed)}</td>
                  <td><b>{fmtZl(d)}</b></td>
                  <td>{fmtLeft(left)}</td>
                  <td className="actions">
                    {d > 0n && (
                      <button className="small-btn" disabled={busy} onClick={() => send(`Zwrot dla ${short(p.buyer)}`, claimIx(offer.address, p))}>Wypłać zwrot</button>
                    )}
                    {left <= 0 && (
                      <button className="small-btn secondary" disabled={busy} onClick={() => send(`Rozliczenie ${short(p.buyer)}`, releaseIx(offer, p))}>Rozlicz</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ---------- Historia ----------

const KIND: Record<ActivityEvent['kind'], { icon: string; cls: string }> = {
  create: { icon: '✨', cls: 'k-create' },
  buy: { icon: '🛒', cls: 'k-buy' },
  price: { icon: '🏷️', cls: 'k-price' },
  refund: { icon: '💸', cls: 'k-refund' },
  release: { icon: '🔓', cls: 'k-release' },
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
