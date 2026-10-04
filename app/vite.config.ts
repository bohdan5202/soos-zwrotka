import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// web3.js potrzebuje Buffer w przeglądarce.
// /api/rpc: w produkcji funkcja Vercel (api/rpc.ts), lokalnie proxy Vite do RPC_URL z app/.env.
// RPC_URL nie ma prefiksu VITE_, więc klucz nie trafia do kodu przeglądarki.
export default defineConfig(({ mode }) => {
  const rpc = new URL(loadEnv(mode, process.cwd(), '').RPC_URL || 'https://api.devnet.solana.com')
  return {
    plugins: [react(), nodePolyfills({ include: ['buffer'], globals: { Buffer: true } })],
    server: {
      host: true,
      proxy: {
        '/api/rpc': {
          target: rpc.origin,
          changeOrigin: true,
          rewrite: () => `${rpc.pathname}${rpc.search}`,
        },
      },
    },
  }
})
