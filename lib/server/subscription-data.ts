import { prisma } from "./prisma";
import { parseDate } from "./dates";
import { toCents } from "./money";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

const FREQUENCIES = ["monthly", "yearly", "quarterly", "occasional"];

/** Validation + conversion du payload commun aux abonnements et objectifs d'épargne. */
export async function buildRecurringBase(data: Record<string, any> | null): Promise<Result<{
  name: string; accountId: number; categoryId: number; frequency: string;
  startDate: Date; endDate: Date | null; dayOfMonth: number | null; notes: string | null;
}>> {
  if (!data) return { ok: false, message: "Requête invalide." };
  if (typeof data.name !== "string" || data.name.trim() === "") return { ok: false, message: "Le nom est obligatoire." };
  if (!FREQUENCIES.includes(data.frequency)) return { ok: false, message: "Fréquence invalide." };
  if (!data.startDate) return { ok: false, message: "La date de début est obligatoire." };

  const startDate = parseDate(data.startDate);
  const endDate = data.endDate ? parseDate(data.endDate) : null;
  if (Number.isNaN(startDate.getTime()) || (endDate && Number.isNaN(endDate.getTime()))) {
    return { ok: false, message: "Date invalide." };
  }

  const account = data.accountId ? await prisma.account.findUnique({ where: { id: Number(data.accountId) } }) : null;
  if (!account) return { ok: false, message: "Compte introuvable." };
  const category = data.categoryId ? await prisma.category.findUnique({ where: { id: Number(data.categoryId) } }) : null;
  if (!category) return { ok: false, message: "Catégorie introuvable." };

  return {
    ok: true,
    data: {
      name: data.name,
      accountId: account.id,
      categoryId: category.id,
      frequency: data.frequency,
      startDate,
      endDate,
      dayOfMonth: data.dayOfMonth ? Number(data.dayOfMonth) : null,
      notes: data.notes ?? null,
    },
  };
}

export { toCents };
