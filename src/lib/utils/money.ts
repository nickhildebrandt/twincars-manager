/**
 * Money helpers — keep all calculations in plain numbers but always round
 * to 2 decimals at the boundaries.
 */

/**
 * Round a number to 2 decimals using half-away-from-zero rounding.
 * @param value the raw amount
 * @returns the rounded amount
 */
export const roundMoney = (value: number): number => {
  const sign = value < 0 ? -1 : 1
  return (sign * Math.round(Math.abs(value) * 100)) / 100
}

/**
 * Calculate gross from net using a VAT rate expressed as 0..1 (e.g. 0.19).
 */
export const grossFromNet = (net: number, rate: number): number =>
  roundMoney(net * (1 + rate))

/**
 * Calculate net from gross using a VAT rate expressed as 0..1 (e.g. 0.19).
 */
export const netFromGross = (gross: number, rate: number): number =>
  roundMoney(gross / (1 + rate))

/**
 * Calculate VAT amount from a net total and a rate.
 */
export const taxFromNet = (net: number, rate: number): number =>
  roundMoney(net * rate)

/**
 * Apply a discount percentage (0..100) to an amount.
 */
export const applyDiscount = (
  amount: number,
  discountPercent: number
): number => roundMoney(amount * (1 - discountPercent / 100))

/**
 * Format a number as a German Euro string (e.g. 1.234,56 €).
 */
export const formatEuro = (value: number): string =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
