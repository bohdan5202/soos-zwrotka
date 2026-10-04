import { StrictMode } from 'react'
import { BrowserRouter } from 'react-router'
import { createRoot } from 'react-dom/client'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import '@solana/wallet-adapter-react-ui/styles.css'
import './index.css'
import './classic.css'
import App from './App.tsx'

// RPC idzie przez naszego pośrednika /api/rpc (funkcja Vercel, lokalnie proxy Vite):
// adres z kluczem jest w RPC_URL po stronie serwera, nie w kodzie przeglądarki.
const RPC = `${window.location.origin}/api/rpc`
// Potwierdzenia transakcji (signatureSubscribe) wymagają WebSocketu, którego funkcja nie obsługuje:
// publiczny WebSocket devnetu, bez klucza. Można nadpisać w VITE_WS_URL.
const WS = import.meta.env.VITE_WS_URL || 'wss://api.devnet.solana.com'

// Phantom wykrywany przez Wallet Standard, lista adapterów może być pusta.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ConnectionProvider endpoint={RPC} config={{ commitment: 'confirmed', wsEndpoint: WS }}>
        <WalletProvider wallets={[]} autoConnect>
          <WalletModalProvider>
            <App />
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </BrowserRouter>
  </StrictMode>,
)
