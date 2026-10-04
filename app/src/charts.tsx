import { useState } from 'react'
import { fmtZl } from './program'

// ---------- Wykres liniowy z kursorem (jedna seria, jedna oś) ----------

/** Zaokrągla w górę do „ładnej” wartości osi: 1, 2, 5 × 10^n. */
function niceCeil(v: number) {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  for (const m of [1, 2, 5, 10]) if (m * p >= v) return m * p
  return 10 * p
}

type XY = { x: number; y: number }
type Marker = { x: number; label: string }

export function LineChart({
  points, xFmt, yFmt, markers = [], step = false, height = 200, width = 640, ariaLabel, area = false,
}: {
  points: XY[]
  xFmt: (x: number) => string
  yFmt: (y: number) => string
  markers?: Marker[]
  step?: boolean
  height?: number
  width?: number
  ariaLabel: string
  area?: boolean
}) {
  const W = width
  const H = height
  const P = { l: 70, r: 16, t: 14, b: 26 }
  const [hi, setHi] = useState<number | null>(null)
  if (points.length < 2) return <p className="muted small">Za mało danych do wykresu.</p>

  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const yMax = niceCeil(Math.max(...ys) * 1.05)
  const sx = (x: number) => P.l + ((x - xMin) / (xMax - xMin || 1)) * (W - P.l - P.r)
  const sy = (y: number) => P.t + (1 - y / yMax) * (H - P.t - P.b)

  let d = ''
  points.forEach((p, i) => {
    d += i === 0 ? `M${sx(p.x)},${sy(p.y)}` : step ? `H${sx(p.x)}V${sy(p.y)}` : `L${sx(p.x)},${sy(p.y)}`
  })
  const areaD = `${d}V${sy(0)}H${sx(points[0].x)}Z`
  const ticks = [0, yMax / 2, yMax]

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    let best = 0
    points.forEach((p, i) => {
      if (Math.abs(sx(p.x) - x) < Math.abs(sx(points[best].x) - x)) best = i
    })
    setHi(best)
  }
  const h = hi !== null ? points[hi] : null

  return (
    <div className="chart-wrap" onMouseLeave={() => setHi(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} onMouseMove={onMove}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={sy(t)} y2={sy(t)} className="grid" />
            <text x={P.l - 8} y={sy(t) + 4} className="axis" textAnchor="end">{yFmt(t)}</text>
          </g>
        ))}
        <text x={P.l} y={H - 6} className="axis">{xFmt(xMin)}</text>
        <text x={W - P.r} y={H - 6} className="axis" textAnchor="end">{xFmt(xMax)}</text>
        {markers.map((m) => (
          <g key={m.label}>
            <line x1={sx(m.x)} x2={sx(m.x)} y1={P.t} y2={H - P.b} className="floor" />
            <text x={sx(m.x) + 4} y={P.t + 10} className="axis">{m.label}</text>
          </g>
        ))}
        {area && <path d={areaD} className="area" />}
        <path d={d} className="price-line" />
        {h && (
          <>
            <line x1={sx(h.x)} x2={sx(h.x)} y1={P.t} y2={H - P.b} className="crosshair" />
            <circle cx={sx(h.x)} cy={sy(h.y)} r={5} className="point" />
          </>
        )}
      </svg>
      {h && (
        <div className="tooltip" style={{ left: `${(sx(h.x) / W) * 100}%`, top: `${(sy(h.y) / H) * 100}%` }}>
          {xFmt(h.x)} → <b>{yFmt(h.y)}</b>
        </div>
      )}
    </div>
  )
}

// ---------- Gdzie są pieniądze: jeden pasek skumulowany ----------

export type Segment = { label: string; value: bigint; cls: string; hint: string }

export function MoneySplit({ segments }: { segments: Segment[] }) {
  const [hi, setHi] = useState<number | null>(null)
  const total = segments.reduce((s, x) => s + x.value, 0n)
  if (total === 0n) return <p className="muted small">Brak sprzedaży.</p>
  return (
    <div className="split">
      <div className="split-bar" onMouseLeave={() => setHi(null)}>
        {segments.map((s, i) =>
          s.value > 0n ? (
            <div
              key={s.label}
              className={`seg ${s.cls} ${hi !== null && hi !== i ? 'dim' : ''}`}
              style={{ flexGrow: Number(s.value) }}
              onMouseEnter={() => setHi(i)}
              title={`${s.label}: ${fmtZl(s.value)}`}
            />
          ) : null,
        )}
      </div>
      <ul className="split-legend">
        {segments.map((s, i) => (
          <li key={s.label} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}>
            <i className={`sw-box ${s.cls}`} />
            <span className="split-label">{s.label}</span>
            <b>{fmtZl(s.value)}</b>
            <span className="muted small">{Math.round((Number(s.value) * 100) / Number(total))}% · {s.hint}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------- Harmonogram odblokowania rezerwy ----------

export type UnlockRow = { key: string; label: string; amount: bigint; secsLeft: number; owed: bigint }

export function UnlockSchedule({ rows }: { rows: UnlockRow[] }) {
  if (rows.length === 0) return <p className="muted small">Brak aktywnych gwarancji: cała rezerwa jest rozliczona.</p>
  const max = rows.reduce((m, r) => (r.amount > m ? r.amount : m), 1n)
  return (
    <ul className="unlock">
      {rows.map((r) => (
        <li key={r.key}>
          <span className="unlock-label">{r.label}</span>
          <div className="unlock-track">
            <div className="unlock-bar" style={{ width: `${(Number(r.amount) / Number(max)) * 100}%` }} />
          </div>
          <span className="unlock-value">
            <b>{fmtZl(r.amount)}</b>
            <span className="muted small">
              {r.secsLeft > 0 ? `odblokuje się ${fmtIn(r.secsLeft)}` : 'gotowe do rozliczenia'}
              {r.owed > 0n && ` · ${fmtZl(r.owed)} dla kupującego`}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export function fmtIn(secs: number) {
  if (secs <= 0) return 'teraz'
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return d > 0 ? `za ${d} d ${h} h` : h > 0 ? `za ${h} h ${m} min` : m > 0 ? `za ${m} min` : `za ${secs} s`
}
