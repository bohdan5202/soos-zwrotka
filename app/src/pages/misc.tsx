import { Link, Navigate, useLocation } from 'react-router'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

/** /konto → strona portfela połączonego konta. */
export function Account() {
  const { publicKey, connecting } = useWallet()
  if (publicKey) return <Navigate to={`/portfel/${publicKey.toBase58()}`} replace />
  return (
    <section className="card center narrow">
      <h1>Twoje konto</h1>
      <p className="muted">
        {connecting ? 'Łączenie z portfelem…' : 'Połącz portfel, żeby zobaczyć swoje zakupy z ochroną i oferty.'}
      </p>
      <WalletMultiButton />
    </section>
  )
}

/** Stare linki ?offer=… / ?wallet=… z pierwszej wersji aplikacji. */
export function LegacyRedirect() {
  const { search } = useLocation()
  const q = new URLSearchParams(search)
  const offer = q.get('offer')
  const wallet = q.get('wallet')
  const name = q.get('name')
  if (offer) return <Navigate to={`/oferta/${offer}${name ? `?name=${encodeURIComponent(name)}` : ''}`} replace />
  if (wallet) return <Navigate to={`/portfel/${wallet}`} replace />
  return null
}

export function NotFound() {
  return (
    <section className="card center narrow">
      <h1>Nie ma takiej strony</h1>
      <p className="muted">Link mógł się zmienić.</p>
      <Link className="btn" to="/">Strona główna</Link>
    </section>
  )
}
