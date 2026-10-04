import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { Transaction, type TransactionInstruction } from '@solana/web3.js'
import { BRAND, Logo } from './brand'
import { explorerTx, PROGRAM_ID, explorerAddr } from './program'

export type Send = (label: string, ix: TransactionInstruction | TransactionInstruction[]) => Promise<string | undefined>

type Tx = {
  send: Send
  busy: boolean
  now: number
  /** Rejestruje odświeżenie danych po każdej udanej transakcji. */
  onTx: (cb: () => void) => () => void
}

const TxContext = createContext<Tx | null>(null)

export function useTx() {
  const v = useContext(TxContext)
  if (!v) throw new Error('useTx poza <Shell>')
  return v
}

/** Odświeża dane strony po transakcji wysłanej z dowolnego miejsca aplikacji. */
export function useRefreshOnTx(cb: () => void) {
  const { onTx } = useTx()
  const ref = useRef(cb)
  ref.current = cb
  useEffect(() => onTx(() => ref.current()), [onTx])
}

type Toast = { id: number; label: string; sig: string }

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

function TxProvider({ children, onError }: { children: ReactNode; onError: (e: string | null) => void }) {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const [busy, setBusy] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const listeners = useRef(new Set<() => void>())
  const now = useNow()

  const onTx = useCallback((cb: () => void) => {
    listeners.current.add(cb)
    return () => {
      listeners.current.delete(cb)
    }
  }, [])

  const send: Send = async (label, ix) => {
    if (!publicKey) {
      onError('Połącz portfel')
      return undefined
    }
    setBusy(true)
    onError(null)
    try {
      // Blockhash przed wysłaniem: ten sam trafia do transakcji i do potwierdzenia.
      const bh = await connection.getLatestBlockhash()
      const tx = new Transaction({ feePayer: publicKey, ...bh }).add(...(Array.isArray(ix) ? ix : [ix]))
      const sig = await sendTransaction(tx, connection)
      const res = await connection.confirmTransaction({ signature: sig, ...bh }, 'confirmed')
      // confirmTransaction nie rzuca, gdy transakcja przepadła w programie: błąd jest w value.err.
      if (res.value.err) throw new Error(`Transakcja odrzucona: ${JSON.stringify(res.value.err)}`)
      const id = Date.now()
      setToasts((t) => [{ id, label, sig }, ...t].slice(0, 3))
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 12000)
      listeners.current.forEach((cb) => cb())
      return sig
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
      return undefined
    } finally {
      setBusy(false)
    }
  }

  return (
    <TxContext.Provider value={{ send, busy, now, onTx }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <span>✓ {t.label}</span>
            <a href={explorerTx(t.sig)} target="_blank" rel="noreferrer">Explorer ↗</a>
          </div>
        ))}
      </div>
    </TxContext.Provider>
  )
}

function Balance() {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const [sol, setSol] = useState<number | null>(null)
  const load = useCallback(() => {
    if (publicKey) connection.getBalance(publicKey).then((b) => setSol(b / 1e9)).catch(() => {})
    else setSol(null)
  }, [connection, publicKey])
  useEffect(() => {
    load()
    const t = setInterval(load, 20000)
    return () => clearInterval(t)
  }, [load])
  useRefreshOnTx(load)
  return sol === null ? null : <span className="muted small balance">{sol.toFixed(3)} SOL</span>
}

type Theme = 'light' | 'dark'
const THEME_KEY = 'zwrotka:theme'
const systemTheme = (): Theme => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

/** Jasny / ciemny. Bez wyboru użytkownika strona idzie za ustawieniem systemu. */
function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme | undefined) ?? systemTheme())
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const follow = () => {
      if (!document.documentElement.dataset.theme) setTheme(systemTheme())
    }
    mq.addEventListener('change', follow)
    return () => mq.removeEventListener('change', follow)
  }, [])
  const choose = (t: Theme) => {
    document.documentElement.dataset.theme = t
    try {
      localStorage.setItem(THEME_KEY, t)
    } catch {
      /* bez localStorage wybór działa do odświeżenia strony */
    }
    setTheme(t)
  }
  return (
    <div className="seg-switch" role="group" aria-label="Motyw">
      <button aria-pressed={theme === 'light'} onClick={() => choose('light')}>jasny</button>
      <button aria-pressed={theme === 'dark'} onClick={() => choose('dark')}>ciemny</button>
    </div>
  )
}

type Look = 'gazeta' | 'classic'
const LOOK_KEY = 'zwrotka:style'

/** Wygląd: „Gazeta” (domyślny) albo „Klasyczny” (poprzedni styl). Działa z oboma motywami. */
function LookSwitch() {
  const [look, setLook] = useState<Look>(() => (document.documentElement.dataset.style === 'classic' ? 'classic' : 'gazeta'))
  const choose = (l: Look) => {
    if (l === 'classic') document.documentElement.dataset.style = 'classic'
    else delete document.documentElement.dataset.style
    try {
      localStorage.setItem(LOOK_KEY, l)
    } catch {
      /* bez localStorage wybór działa do odświeżenia strony */
    }
    setLook(l)
  }
  return (
    <div className="seg-switch" role="group" aria-label="Wygląd">
      <button aria-pressed={look === 'gazeta'} onClick={() => choose('gazeta')}>gazeta</button>
      <button aria-pressed={look === 'classic'} onClick={() => choose('classic')}>klasyczny</button>
    </div>
  )
}

const today = () =>
  new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export function Shell() {
  const [error, setError] = useState<string | null>(null)
  const { pathname, hash, key } = useLocation()
  const { publicKey } = useWallet()
  // `key` tylko przy kotwicy: drugi klik w ten sam link /#nagranie też ma przewinąć.
  const anchorKey = hash ? key : null

  // Nowa strona: schowaj stary błąd i przewiń na górę albo do kotwicy z adresu (np. /#nagranie).
  useEffect(() => {
    setError(null)
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null
    if (!target) {
      window.scrollTo(0, 0)
      return
    }
    // Po pierwszym renderze układ jeszcze się zmienia (fonty, ramka wideo): przewijamy chwilę później.
    const timer = setTimeout(() => target.scrollIntoView(), 50)
    return () => clearTimeout(timer)
  }, [pathname, hash, anchorKey])

  return (
    <TxProvider onError={setError}>
      <header className="topbar">
        <NavLink className="brand" to="/">
          <Logo />
          <span>{BRAND}</span>
          <span className="net">devnet</span>
        </NavLink>
        <nav className="mainnav">
          <NavLink to="/" end>Jak to działa</NavLink>
          <NavLink to="/katalog">Katalog</NavLink>
          <NavLink to="/statystyki">Statystyki</NavLink>
          <NavLink to="/sprzedawca">Dla sprzedawców</NavLink>
          {publicKey && <NavLink to="/panel">Panel</NavLink>}
          <NavLink to="/konto">{publicKey ? 'Moje konto' : 'Konto'}</NavLink>
        </nav>
        <div className="wallet">
          <Balance />
          <div className="prefs">
            <LookSwitch />
            <ThemeSwitch />
          </div>
          <WalletMultiButton />
        </div>
      </header>
      <div className="edition-wrap">
        <div className="edition">
          <span>Wydanie devnet · gwarancja ceny bez pośrednika</span>
          <span>{today()} · program <a href={explorerAddr(PROGRAM_ID)} target="_blank" rel="noreferrer" className="mono">44sG…GGB7</a></span>
        </div>
      </div>

      <main className="page">
        {error && (
          <div className="error" role="alert">
            <span>{error}</span>
            <button className="link" onClick={() => setError(null)}>zamknij</button>
          </div>
        )}
        <Outlet />
      </main>

      <footer className="footer muted small">
        {BRAND} · zespół SOOS · HackYeah 2026 · Superteam Poland: Finance Without Intermediaries ·{' '}
        <a href="https://github.com/bohdan5202/soos-zwrotka" target="_blank" rel="noreferrer">kod</a> ·{' '}
        <a href={explorerAddr(PROGRAM_ID)} target="_blank" rel="noreferrer">program</a>
      </footer>
    </TxProvider>
  )
}
