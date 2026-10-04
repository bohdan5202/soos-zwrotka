import { StrictMode } from 'react'
import { BrowserRouter } from 'react-router'
import { createRoot } from 'react-dom/client'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import '@solana/wallet-adapter-react-ui/styles.css'
import './index.css'
import './classic.css'
import App from './App.tsx'

// Publiczny RPC devnetu ma niskie limity. Na demo warto ustawić własny w app/.env.local:
// VITE_RPC_URL=https://devnet.helius-rpc.com/?api-key=...
const RPC = import.meta.env.VITE_RPC_URL || 'https://api.devnet.solana.com'

// Phantom wykrywany przez Wallet Standard, lista adapterów może być pusta.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ConnectionProvider endpoint={RPC}>
        <WalletProvider wallets={[]} autoConnect>
          <WalletModalProvider>
            <App />
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </BrowserRouter>
  </StrictMode>,
)
