import { useMemo, useState } from 'react'
import { fmtZl, type Offer, type Purchase } from './program'

type Pt = { ts: number; price: bigint }

const W = 640
const H = 220
const PAD = { l: 64, r: 16, t: 16, b: 28 }

const fmtTime = (ts: number) =>
  new Date(ts * 1000).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Schodkowy wykres ceny w czasie + kropki sprzedaży + linia floor. */
export function PriceChart({
  offer, purchases, createdAt, now, initialPrice = null,
}: { offer: Offer; purchases: Purchase[]; createdAt: number | null; now: number; initialPrice?: bigint | null }) {
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null)

  const model = useMemo(() => {
    const initial =
      initialPrice ??
      (offer.history.length === 0
        ? offer.price
        : purchases.find((p) => p.firstChange === 0)?.paid ?? null)
    const steps: Pt[] = []
    const t0 = createdAt ?? Number(offer.history[0]?.ts ?? purchases[0]?.boughtAt ?? now)
    if (initial !== null) steps.push({ ts: t0, price: initial })
    for (const h of offer.history) steps.push({ ts: Number(h.ts), price: h.price })
    const sales = purchases.map((p) => ({ ts: Number(p.boughtAt), price: p.paid }))

    const tMin = Math.min(t0, ...sales.map((s) => s.ts))
    const tMax = Math.max(now, tMin + 60)
    const prices = [...steps.map((s) => s.price), ...sales.map((s) => s.price), offer.floor].map(Number)
    // Okrągłe wartości osi: wielokrotności 50 zł (5 000 000 lamportów).
    const STEP = 5_000_000
    const pMax = Math.ceil((Math.max(...prices) * 1.05) / STEP) * STEP
    const pMin = Math.max(0, Math.floor((Math.min(...prices) * 0.9) / STEP) * STEP)
    const x = (ts: number) => PAD.l + ((ts - tMin) / (tMax - tMin)) * (W - PAD.l - PAD.r)
    const y = (p: number) => PAD.t + (1 - (p - pMin) / (pMax - pMin || 1)) * (H - PAD.t - PAD.b)

    let path = ''
    steps.forEach((s, i) => {
      const sx = x(s.ts)
      const sy = y(Number(s.price))
      path += i === 0 ? `M${sx},${sy}` : `H${sx}V${sy}`
    })
    if (steps.length) path += `H${x(tMax)}`

    const ticks = [pMin, (pMin + pMax) / 2, pMax].map((v) => ({ v, y: y(v) }))
    return { steps, sales, x, y, path, ticks, tMin, tMax }
  }, [offer, purchases, createdAt, now, initialPrice])

  const { steps, sales, x, y, path, ticks, tMin } = model

  return (
    <figure className="chart">
      <figcaption>
        <span className="legend"><i className="sw line" /> Cena</span>
        <span className="legend"><i className="sw dot" /> Sprzedaż</span>
        <span className="legend"><i className="sw dash" /> Floor (dostajesz od razu)</span>
      </figcaption>
      <div className="chart-wrap" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Historia ceny i sprzedaży">
          {ticks.map((t) => (
            <g key={t.v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} className="grid" />
              <text x={PAD.l - 8} y={t.y + 4} className="axis" textAnchor="end">
                {fmtZl(BigInt(Math.round(t.v)))}
              </text>
            </g>
          ))}
          <text x={PAD.l} y={H - 6} className="axis">{fmtTime(tMin)}</text>
          <text x={W - PAD.r} y={H - 6} className="axis" textAnchor="end">teraz</text>
          <line
            x1={PAD.l} x2={W - PAD.r} y1={y(Number(offer.floor))} y2={y(Number(offer.floor))}
            className="floor"
          />
          <path d={path} className="price-line" />
          {steps.map((s, i) => (
            <circle
              key={`s${i}`} cx={x(s.ts)} cy={y(Number(s.price))} r={14} className="hit"
              onMouseEnter={() => setHover({ x: x(s.ts), y: y(Number(s.price)), text: `${i === 0 ? 'Cena startowa' : 'Zmiana ceny'}: ${fmtZl(s.price)} · ${fmtTime(s.ts)}` })}
            />
          ))}
          {sales.map((s, i) => (
            <g key={`p${i}`}>
              <circle cx={x(s.ts)} cy={y(Number(s.price))} r={5} className="sale" />
              <circle
                cx={x(s.ts)} cy={y(Number(s.price))} r={14} className="hit"
                onMouseEnter={() => setHover({ x: x(s.ts), y: y(Number(s.price)), text: `Sprzedaż za ${fmtZl(s.price)} · ${fmtTime(s.ts)}` })}
              />
            </g>
          ))}
        </svg>
        {hover && (
          <div className="tooltip" style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%` }}>
            {hover.text}
          </div>
        )}
      </div>
      {steps.length === 0 && <p className="muted small">Cena startowa nieznana: wykres zacznie się od pierwszej zmiany.</p>}
    </figure>
  )
}
