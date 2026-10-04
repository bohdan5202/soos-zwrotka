import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// web3.js potrzebuje Buffer w przeglądarce.
export default defineConfig({
  plugins: [react(), nodePolyfills({ include: ['buffer'], globals: { Buffer: true } })],
  server: { host: true },
})
