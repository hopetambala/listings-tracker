/**
 * Format a number as a currency string with commas
 * @param amount - The numerical value to format
 * @returns Formatted string (e.g., "450000" → "450,000")
 */
export function formatPrice(amount: number): string {
  return amount.toLocaleString('en-US')
}
