import { useCallback, useEffect, useMemo, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { PublicKey, Transaction } from '@solana/web3.js'
import { fetchActivity, type ActivityEvent } from './activity'
import { BRAND, Logo, TAGLINE } from './brand'
import { FunnelSections, ProtectionMeter } from './funnel'
import { OfferView, type Send } from './OfferView'
import { WalletView } from './WalletView'
import {
  createOfferIx,
  explorerTx,
  fetchCreatedAt,
  fetchOffer,
  fetchPurchase,
  fetchPurchases,
  fetchSellerOffers,
  fmtZl,
  offerPda,
  PROGRAM_ID,
  purchasePda,
  toLamports,
  type Offer,
  type Purchase,
} from './program'

type Toast = { id: number; label: string; sig: string }

// Nazwy ofert nie są on-chain: zapamiętujemy je lokalnie u sprzedawcy.
const NAMES_KEY = 'zwrotka:names'
function loadNames(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NAMES_KEY) ?? '{}')
  } catch {
    return {}
  }
}
function saveName(addr: string, name: string) {
  try {
    localStorage.setItem(NAMES_KEY, JSON.stringify({ ...loadNames(), [addr]: name }))
  } catch {
    /* brak dostępu do localStorage: nazwa zostaje tylko w linku */
  }
}

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

export default function App() {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const params = new URLSearchParams(window.location.search)
  const offerParam = params.get('offer')
  const offerAddr = useMemo(() => {
    try {
      return offerParam ? new PublicKey(offerParam) : null
    } catch {
      return null
    }
  }, [offerParam])
  const name = params.get('name') ?? (offerParam && loadNames()[offerParam]) ?? 'Kurs: Solana i Anchor od podstaw'
  const walletParam = params.get('wallet')
  const walletAddr = useMemo(() => {
    try {
      return walletParam ? new PublicKey(walletParam) : null
    } catch {
      return null
    }
  }, [walletParam])

  const [offer, setOffer] = useState<Offer | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [mine, setMine] = useState<Purchase | null>(null)
  const [events, setEvents] = useState<ActivityEvent[] | null>(null)
  const [createdAt, setCreatedAt] = useState<number | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const now = useNow()

  const refresh = useCallback(async () => {
    if (publicKey) setBalance((await connection.getBalance(publicKey)) / 1e9)
    else setBalance(null)
    if (!offerAddr) return
    const o = await fetchOffer(connection, offerAddr)
    setOffer(o)
    setLoaded(true)
    if (!o) return
    setPurchases(await fetchPurchases(connection, offerAddr))
    setMine(publicKey ? await fetchPurchase(connection, purchasePda(offerAddr, publicKey)) : null)
  }, [connection, offerAddr, publicKey])

  const refreshActivity = useCallback(async () => {
    if (offerAddr) setEvents(await fetchActivity(connection, offerAddr))
  }, [connection, offerAddr])

  useEffect(() => {
    // Błędy odświeżania w tle (np. 429 z publicznego RPC) są przejściowe: nie pokazujemy ich.
    refresh().catch((e) => console.warn('refresh', e))
    const t = setInterval(() => refresh().catch(() => {}), 8000)
    return () => clearInterval(t)
  }, [refresh])

  useEffect(() => {
    refreshActivity().catch(() => {})
    const t = setInterval(() => refreshActivity().catch(() => {}), 30000)
    return () => clearInterval(t)
  }, [refreshActivity])

  useEffect(() => {
    if (offerAddr) fetchCreatedAt(connection, offerAddr).then(setCreatedAt).catch(() => {})
  }, [connection, offerAddr])

  const send: Send = async (label, ix) => {
    if (!publicKey) {
      setError('Połącz portfel')
      return undefined
    }
    setBusy(true)
    setError(null)
    try {
      const tx = new Transaction().add(...(Array.isArray(ix) ? ix : [ix]))
      const sig = await sendTransaction(tx, connection)
      const bh = await connection.getLatestBlockhash()
      await connection.confirmTransaction({ signature: sig, ...bh }, 'confirmed')
      const id = Date.now()
      setToasts((t) => [{ id, label, sig }, ...t].slice(0, 3))
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 12000)
      await refresh()
      refreshActivity().catch(() => {})
      return sig
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return undefined
    } finally {
      setBusy(false)
    }
  }

  const isSeller = !!(publicKey && offer && offer.seller.equals(publicKey))

  return (
    <>
      <header className="topbar">
        <a className="brand" href="/">
          <Logo />
          <span>{BRAND}</span>
          <span className="net">devnet</span>
        </a>
        <div className="wallet">
          {publicKey && (
            <a className="btn secondary small-btn" href={`?wallet=${publicKey.toBase58()}`}>Moje konto</a>
          )}
          {publicKey && isSeller && <span className="role seller-role">Sprzedawca</span>}
          {publicKey && offer && !isSeller && <span className="role">Kupujący</span>}
          {balance !== null && <span className="muted small">{balance.toFixed(3)} SOL</span>}
          <WalletMultiButton />
        </div>
      </header>

      <main className="page">
        {error && (
          <div className="error" role="alert">
            <span>{error}</span>
            <button className="link" onClick={() => setError(null)}>zamknij</button>
          </div>
        )}

        {walletParam && !walletAddr && <div className="card">Nieprawidłowy adres portfela.</div>}
        {walletAddr && <WalletView wallet={walletAddr} names={loadNames()} now={now} busy={busy} send={send} />}
        {!offerParam && !walletParam && <Landing busy={busy} send={send} />}
        {offerParam && !offerAddr && <div className="card">Nieprawidłowy adres oferty.</div>}
        {offerAddr && !loaded && <div className="card muted">Ładowanie oferty…</div>}
        {offerAddr && loaded && !offer && <div className="card">Ta oferta nie istnieje na devnecie.</div>}

        {offer && (
          <OfferView
            offer={offer}
            name={name}
            purchases={purchases}
            mine={mine}
            events={events}
            createdAt={createdAt}
            now={now}
            busy={busy}
            send={send}
            isSeller={isSeller}
          />
        )}
      </main>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <span>✓ {t.label}</span>
            <a href={explorerTx(t.sig)} target="_blank" rel="noreferrer">Explorer ↗</a>
          </div>
        ))}
      </div>

      <footer className="footer muted small">
        {BRAND} · zespół SOOS · HackYeah 2026 · Superteam Poland: Finance Without Intermediaries ·{' '}
        <a href="https://github.com/bohdan5202/soos-zwrotka" target="_blank" rel="noreferrer">kod</a> ·{' '}
        <a href="https://explorer.solana.com/address/44sG9n516FQKsDNC2uwyKPUKSksyDLH4ypzsVHgJGGB7?cluster=devnet" target="_blank" rel="noreferrer">program</a>
      </footer>
    </>
  )
}

function Landing({ busy, send }: { busy: boolean; send: Send }) {
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
            <a className="btn secondary big" href="#sprzedawca">Jestem sprzedawcą</a>
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

      <section className="section" id="sprzedawca">
        <div className="eyebrow">Dla sprzedawców</div>
        <h2 className="section-title">Sprzedawaj wcześniej. Twój koszt gwarancji znasz z góry.</h2>
        <div className="cards3">
          <div className="pain"><span className="pain-icon">💰</span><b>Pieniądze od razu</b><span>Floor (np. 80–90% ceny) trafia do Ciebie w chwili sprzedaży.</span></div>
          <div className="pain"><span className="pain-icon">📊</span><b>Maksymalny koszt = rezerwa</b><span>Nigdy nie oddasz więcej niż cena − floor. Symulator pokaże koszt każdej obniżki.</span></div>
          <div className="pain"><span className="pain-icon">🚀</span><b>Klienci nie czekają</b><span>„Kup teraz, nie stracisz na promocji” zamienia odkładanie zakupu w sprzedaż dziś.</span></div>
        </div>
      </section>
      <MyOffers />
      <CreateOffer busy={busy} send={send} />
    </>
  )
}

function MyOffers() {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const [offers, setOffers] = useState<Offer[] | null>(null)
  useEffect(() => {
    setOffers(null)
    if (publicKey) fetchSellerOffers(connection, publicKey).then(setOffers).catch(() => setOffers([]))
  }, [connection, publicKey])
  if (!publicKey || !offers || offers.length === 0) return null
  const names = loadNames()
  const sorted = [...offers].sort((a, b) => Number(b.offerId - a.offerId))
  return (
    <section className="card">
      <h2>Twoje oferty ({offers.length})</h2>
      <ul className="offer-list">
        {sorted.map((o) => {
          const addr = o.address.toBase58()
          return (
            <li key={addr}>
              <a href={`?offer=${addr}`}>
                <span className="offer-name">{names[addr] ?? `Oferta #${o.offerId}`}</span>
                <span className="muted small">
                  utworzona {new Date(Number(o.offerId)).toLocaleString('pl-PL')} · zmian ceny: {o.history.length}
                </span>
              </a>
              <b>{fmtZl(o.price)}</b>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function CreateOffer({ busy, send }: { busy: boolean; send: Send }) {
  const { publicKey } = useWallet()
  const [title, setTitle] = useState('Kurs: Solana i Anchor od podstaw')
  const [price, setPrice] = useState(1000)
  const [floor, setFloor] = useState(800)
  const [windowLen, setWindowLen] = useState(5)
  const [unit, setUnit] = useState<'min' | 'd'>('min')
  const [eventAt, setEventAt] = useState('')
  const [existing, setExisting] = useState('')
  const [lookupError, setLookupError] = useState<string | null>(null)
  const { connection } = useConnection()

  // Konto należące do programu = oferta; wszystko inne traktujemy jak portfel.
  const openAddress = async () => {
    setLookupError(null)
    let key: PublicKey
    try {
      key = new PublicKey(existing.trim())
    } catch {
      setLookupError('To nie jest poprawny adres Solany.')
      return
    }
    const acc = await connection.getAccountInfo(key).catch(() => null)
    location.search = acc?.owner.equals(PROGRAM_ID) ? `?offer=${key.toBase58()}` : `?wallet=${key.toBase58()}`
  }

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
      location.search = `?offer=${addr}&name=${encodeURIComponent(title)}`
    }
  }

  const pct = price > 0 ? Math.round(((price - floor) / price) * 100) : 0

  return (
    <div className="grid2">
      <section className="card">
        <h2>Sprzedajesz? Wystaw ofertę z gwarancją</h2>
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
        <button className="big" disabled={!publicKey || busy || floor > price || price <= 0} onClick={create}>
          {publicKey ? 'Wystaw ofertę' : 'Najpierw połącz portfel'}
        </button>
      </section>
      <section className="card">
        <h2>Sprawdź ofertę lub portfel</h2>
        <p className="muted small">
          Wklej adres oferty albo dowolnego portfela. Zobaczysz, czy jest sprzedawcą, kupującym, i co dzieje się z jego
          pieniędzmi w Zwrotce.
        </p>
        <div className="inline">
          <input placeholder="adres" value={existing} onChange={(e) => setExisting(e.target.value)} />
          <button disabled={!existing || busy} onClick={openAddress}>Sprawdź</button>
        </div>
        {lookupError && <p className="small err-text">{lookupError}</p>}
      </section>
    </div>
  )
}
