// Les dates « jour » sont toujours manipulées en UTC (minuit) pour éviter
// tout décalage lié au fuseau horaire du serveur.

export function parseDate(input: string | Date): Date {
  if (input instanceof Date) return input;
  return new Date(`${String(input).slice(0, 10)}T00:00:00Z`);
}

export function fmtDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export function firstDayOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

export function lastDayOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0));
}

export function now() {
  const d = new Date();
  return { date: d, year: d.getFullYear(), month: d.getMonth() + 1 };
}

export const MONTHS: Record<number, string> = {
  1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril", 5: "Mai", 6: "Juin",
  7: "Juillet", 8: "Août", 9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre",
};

export const FREQUENCIES: Record<string, string> = {
  monthly: "mensuelle",
  yearly: "annuelle",
  quarterly: "trimestrielle",
  occasional: "occasionnel",
};

const MONTHS_LOWER = [
  "", "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export function periodLabel(year: number, month: number): string {
  return `${MONTHS_LOWER[month] ?? ""} ${year}`;
}

export function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
}
