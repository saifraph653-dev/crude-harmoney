// The brand device is the name, set in type.
//
// It used to be an ornate flared cross -- the same mark the garments carried
// before the collection was redesigned. Keeping it as the site logo left the
// brand identified by a gothic crucifix it has no claim to, which is exactly
// the borrowed-luxury signal the label should avoid. Independent houses
// overwhelmingly sign with their name; so does this one.
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block leading-none font-semibold whitespace-nowrap uppercase ${className}`}
      style={{ letterSpacing: "0.24em" }}
    >
      Crude Harmony
    </span>
  );
}
