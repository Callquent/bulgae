import { prisma } from "./prisma";
import { toCents } from "./money";

type Result<T> = { ok: true; data: T } | { ok: false; message: string; status: number };

/** Convertit le payload d'une ligne de budget (création / édition) en données Prisma. */
export async function buildBudgetData(data: Record<string, any> | null): Promise<Result<{
  label: string | null; categoryId: number; accountId: number; destinationAccountId: number | null;
  year: number; month: number; plannedAmountCents: number; actualAmountCents: number;
}>> {
  if (!data) return { ok: false, message: "Requête invalide.", status: 400 };

  const category = data.categoryId ? await prisma.category.findUnique({ where: { id: Number(data.categoryId) } }) : null;
  if (!category) return { ok: false, message: "Catégorie introuvable.", status: 422 };

  const account = data.accountId ? await prisma.account.findUnique({ where: { id: Number(data.accountId) } }) : null;
  if (!account) return { ok: false, message: "Un compte est requis.", status: 422 };

  let destinationAccountId: number | null = null;
  if (data.destinationAccountId) {
    const dest = await prisma.account.findUnique({ where: { id: Number(data.destinationAccountId) } });
    if (!dest) return { ok: false, message: "Compte destinataire introuvable.", status: 422 };
    if (dest.id === account.id) {
      return { ok: false, message: "Le compte expéditeur et le compte destinataire doivent être différents.", status: 422 };
    }
    destinationAccountId = dest.id;
  }

  const year = parseInt(data.year, 10);
  const month = parseInt(data.month, 10);
  if (!year || !month || month < 1 || month > 12) return { ok: false, message: "Période invalide.", status: 422 };
  if (data.plannedAmount === undefined || data.plannedAmount === null) {
    return { ok: false, message: "Le montant prévu est obligatoire.", status: 422 };
  }

  return {
    ok: true,
    data: {
      label: data.label ?? null,
      categoryId: category.id,
      accountId: account.id,
      destinationAccountId,
      year,
      month,
      plannedAmountCents: toCents(data.plannedAmount),
      actualAmountCents: toCents(data.actualAmount ?? data.plannedAmount),
    },
  };
}

/** Format français d'un montant : 1 234,56 */
export function formatFr(n: number): string {
  const [int, dec] = Math.abs(n).toFixed(2).split(".");
  return `${n < 0 ? "-" : ""}${int.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${dec}`;
}
