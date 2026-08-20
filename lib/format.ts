export function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-QA", { style: "currency", currency }).format(cents / 100);
}
