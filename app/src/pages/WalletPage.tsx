import { useMemo } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { PublicKey } from '@solana/web3.js'
import { loadNames } from '../names'
import { useTx } from '../shell'
import { WALLET_TAB_SLUGS, WalletView, type WalletTab } from '../WalletView'

export function WalletPage() {
  const { address = '', tab: slug = '' } = useParams()
  const navigate = useNavigate()
  const { send, busy, now } = useTx()
  const wallet = useMemo(() => {
    try {
      return new PublicKey(address)
    } catch {
      return null
    }
  }, [address])

  const tab = (Object.keys(WALLET_TAB_SLUGS) as WalletTab[]).find((t) => WALLET_TAB_SLUGS[t] === slug)
  if (!wallet) return <div className="card">Nieprawidłowy adres portfela.</div>
  if (!tab) return <Navigate to={`/portfel/${address}`} replace />

  return (
    <WalletView
      key={address}
      wallet={wallet}
      names={loadNames()}
      now={now}
      busy={busy}
      send={send}
      tab={tab}
      onTab={(t) => navigate(`/portfel/${address}${WALLET_TAB_SLUGS[t] ? `/${WALLET_TAB_SLUGS[t]}` : ''}`)}
    />
  )
}
