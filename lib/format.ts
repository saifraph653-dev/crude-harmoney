/**
 * Money for display.
 *
 * Minor units are dropped when a price is a whole riyal, which every price
 * in the catalogue currently is: "QAR 180" reads like a price tag, "QAR
 * 180.00" reads like an invoice line, and six of them stacked in a grid
 * made the collection look like a spreadsheet. A price with fils still
 * shows them, so nothing is silently rounded away.
 */
export function formatPrice(cents: number, currency: string): string {
  const hasMinorUnits = cents % 100 !== 0;
  return new Intl.NumberFormat("en-QA", {
    style: "currency",
    currency,
    minimumFractionDigits: hasMinorUnits ? 2 : 0,
    maximumFractionDigits: hasMinorUnits ? 2 : 0,
  }).format(cents / 100);
}
