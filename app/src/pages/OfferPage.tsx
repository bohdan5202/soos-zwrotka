import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { fetchActivity, type ActivityEvent } from '../activity'
import { DEFAULT_NAME, loadNames } from '../names'
import { BUYER_TABS, OfferView, SELLER_TABS } from '../OfferView'
import { fetchCreatedAt, fetchOffer, fetchPurchase, fetchPurchases, purchasePda, type Offer, type Purchase } from '../program'
import { useRefreshOnTx, useTx } from '../shell'

export function OfferPage() {
  const { address = '', tab } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const { send, busy, now } = useTx()

  const offerAddr = useMemo(() => {
    try {
      return new PublicKey(address)
    } catch {
      return null
    }
  }, [address])
  const name = search.get('name') ?? loadNames()[address] ?? DEFAULT_NAME

  const [offer, setOffer] = useState<Offer | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [mine, setMine] = useState<Purchase | null>(null)
  const [events, setEvents] = useState<ActivityEvent[] | null>(null)
  const [createdAt, setCreatedAt] = useState<number | null>(null)

  const refresh = useCallback(async () => {
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
    setOffer(null)
    setLoaded(false)
    setEvents(null)
    setCreatedAt(null)
  }, [offerAddr])

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

  useRefreshOnTx(() => {
    refresh().catch(() => {})
    refreshActivity().catch(() => {})
  })

  if (!offerAddr) return <div className="card">Nieprawidłowy adres oferty.</div>
  if (!loaded) return <div className="card muted">Ładowanie oferty…</div>
  if (!offer) return <div className="card">Ta oferta nie istnieje na devnecie.</div>

  const isSeller = !!publicKey?.equals(offer.seller)
  const tabs = isSeller ? SELLER_TABS : BUYER_TABS
  const current = tabs.find((t) => t.slug === tab)
  // Nieznana zakładka albo zakładka drugiej roli (np. po przełączeniu portfela) → domyślna.
  if (tab && !current) return <Navigate to={`/oferta/${address}${search.size ? `?${search}` : ''}`} replace />

  const q = search.size ? `?${search}` : ''
  return (
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
      tab={(current ?? tabs[0]).slug}
      onTab={(slug) => navigate(`/oferta/${address}${slug === tabs[0].slug ? '' : `/${slug}`}${q}`)}
    />
  )
}
