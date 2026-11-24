// Les montants sont stockés en centimes (Int). L'API expose des chaînes
// décimales « 12.50 » comme le faisait le backend Symfony.

export function toCents(input: string | number | null | undefined): number {
  if (input === null || input === undefined || input === "") return 0;
  const n = typeof input === "number" ? input : parseFloat(String(input).replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function centsToNumber(cents: number): number {
  return cents / 100;
}
