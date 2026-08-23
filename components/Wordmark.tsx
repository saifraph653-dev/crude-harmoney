// The cross mark from the Atlas piece, reused as the brand device so the
// site and the garments carry the same symbol. Inline SVG (not an <img>)
// so it inherits currentColor and needs no extra request.
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="-190 -190 380 380"
      className={className}
      role="img"
      aria-label="Crude Harmony"
      fill="currentColor"
    >
      <path d="M-26 -150 L26 -150 L26 -58 L118 -58 L118 -6 L26 -6 L26 150 L-26 150 L-26 -6 L-118 -6 L-118 -58 L-26 -58 Z" />
      <path d="M0 -178 L22 -150 L-22 -150 Z" />
      <path d="M0 178 L22 150 L-22 150 Z" />
      <path d="M-146 -32 L-118 -58 L-118 -6 Z" />
      <path d="M146 -32 L118 -58 L118 -6 Z" />
      <path d="M0 -46 L36 -10 L0 26 L-36 -10 Z" />
    </svg>
  );
}
