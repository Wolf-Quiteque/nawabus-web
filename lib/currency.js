/**
 * Formats an amount in Kwanzas using Angolan conventions: 10.000,00 Kz
 * (dot for thousands, comma for decimals)
 */
export function formatKz(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '0,00 Kz';

  const [intPart, decPart] = Math.abs(value).toFixed(2).split('.');
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = value < 0 ? '-' : '';

  return `${sign}${withThousands},${decPart} Kz`;
}

/** Same as formatKz but returns 'Gratuito' for zero amounts. */
export function formatKzOrFree(amount) {
  return Number(amount) === 0 ? 'Gratuito' : formatKz(amount);
}
