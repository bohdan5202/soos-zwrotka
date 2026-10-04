// Pośrednik JSON-RPC (funkcja Vercel): adres dostawcy z kluczem zostaje na serwerze
// w zmiennej RPC_URL (bez prefiksu VITE_, więc nie trafia do kodu przeglądarki).
// Przepuszczamy tylko metody, których używa frontend.

const ALLOWED = new Set([
  'getAccountInfo',
  'getBalance',
  'getBlockHeight',
  'getBlockTime',
  'getEpochInfo',
  'getFeeForMessage',
  'getGenesisHash',
  'getHealth',
  'getLatestBlockhash',
  'getMinimumBalanceForRentExemption',
  'getMultipleAccounts',
  'getProgramAccounts',
  'getRecentPrioritizationFees',
  'getSignaturesForAddress',
  'getSignatureStatuses',
  'getSlot',
  'getTransaction',
  'getVersion',
  'isBlockhashValid',
  'sendTransaction',
  'simulateTransaction',
])
const MAX_BODY = 64 * 1024
const MAX_BATCH = 20

const rpcError = (status: number, message: string) =>
  new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32600, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export async function POST(request: Request): Promise<Response> {
  const upstream = process.env.RPC_URL
  if (!upstream) return rpcError(500, 'RPC_URL is not configured')

  // Przeglądarki z innych stron odrzucamy (curl i tak przejdzie, ale tylko po dozwolone metody).
  const origin = request.headers.get('origin')
  if (origin && new URL(origin).host !== new URL(request.url).host) return rpcError(403, 'Origin not allowed')

  const text = await request.text()
  if (text.length > MAX_BODY) return rpcError(413, 'Request too large')
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return rpcError(400, 'Invalid JSON')
  }
  const calls = Array.isArray(body) ? body : [body]
  const ok =
    calls.length > 0 &&
    calls.length <= MAX_BATCH &&
    calls.every((c) => typeof c === 'object' && c !== null && ALLOWED.has(String((c as { method?: unknown }).method)))
  if (!ok) return rpcError(403, 'Method not allowed')

  const res = await fetch(upstream, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text })
  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  })
}
