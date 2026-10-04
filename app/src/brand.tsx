export const BRAND = 'Zwrotka'
export const TAGLINE = 'Kup teraz, nie stracisz na promocji'

/** Pieczęć: szeryfowe „Z” w podwójnym okręgu, w kolorze tekstu. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="11.75" fill="none" stroke="currentColor" strokeWidth="0.75" />
      <text
        x="16"
        y="21.6"
        textAnchor="middle"
        fontFamily="Fraunces, Georgia, serif"
        fontSize="16"
        fontWeight="500"
        fill="currentColor"
      >
        Z
      </text>
    </svg>
  )
}
