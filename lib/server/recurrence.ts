import { firstDayOfMonth, lastDayOfMonth } from "./dates";

/**
 * Détermine si une échéance récurrente (abonnement ou objectif d'épargne)
 * tombe sur le mois demandé, selon le nombre de mois écoulés depuis son
 * début : mensuel = tous les mois, trimestriel = tous les 3 mois, annuel =
 * tous les 12 mois, occasionnel = une seule fois (mois de départ).
 */
export function isDueInMonth(startDate: Date, frequency: string, year: number, month: number): boolean {
  const monthsSinceStart =
    (year - startDate.getUTCFullYear()) * 12 + (month - (startDate.getUTCMonth() + 1));

  if (monthsSinceStart < 0) return false;

  switch (frequency) {
    case "quarterly":
      return monthsSinceStart % 3 === 0;
    case "yearly":
      return monthsSinceStart % 12 === 0;
    case "occasional":
      return monthsSinceStart === 0;
    default:
      return true; // 'monthly' et toute valeur inconnue
  }
}

/** startDate ≤ dernier jour du mois ET (endDate nulle OU ≥ premier jour du mois). */
export function overlapsMonth(
  item: { startDate: Date; endDate: Date | null },
  year: number,
  month: number,
): boolean {
  const first = firstDayOfMonth(year, month);
  const last = lastDayOfMonth(year, month);
  if (item.startDate > last) return false;
  if (item.endDate !== null && item.endDate < first) return false;
  return true;
}

export function isDueForPeriod(
  item: { startDate: Date; endDate: Date | null; frequency: string },
  year: number,
  month: number,
): boolean {
  return overlapsMonth(item, year, month) && isDueInMonth(item.startDate, item.frequency, year, month);
}
