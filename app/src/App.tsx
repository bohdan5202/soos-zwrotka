import { Route, Routes, useLocation } from 'react-router'
import { Shell } from './shell'
import { Home } from './pages/Home'
import { Seller } from './pages/Seller'
import { Catalog } from './pages/Catalog'
import { Panel } from './pages/Panel'
import { Stats } from './pages/Stats'
import { OfferPage } from './pages/OfferPage'
import { WalletPage } from './pages/WalletPage'
import { Account, LegacyRedirect, NotFound } from './pages/misc'

export default function App() {
  const { search } = useLocation()
  const legacy = /[?&](offer|wallet)=/.test(search)

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={legacy ? <LegacyRedirect /> : <Home />} />
        <Route path="katalog" element={<Catalog />} />
        <Route path="panel" element={<Panel />} />
        <Route path="statystyki" element={<Stats />} />
        <Route path="sprzedawca" element={<Seller />} />
        <Route path="oferta/:address" element={<OfferPage />} />
        <Route path="oferta/:address/:tab" element={<OfferPage />} />
        <Route path="portfel/:address" element={<WalletPage />} />
        <Route path="portfel/:address/:tab" element={<WalletPage />} />
        <Route path="konto" element={<Account />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
