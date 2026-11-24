import { prisma } from "@/lib/server/prisma";
import { error, json, readJson } from "@/lib/server/http";
import { toCents, fromCents } from "@/lib/server/money";

/**
 * POST /api/ai-search/budget — crée une ligne de budget depuis l'assistant IA.
 * Body : { categoryId, year, month, plannedAmount, label?, accountId? }
 */
export async function POST(req: Request) {
  const data = await readJson(req);
  if (!data) return error("Corps JSON invalide.", 400);

  const categoryId = data.categoryId ?? null;
  const year = data.year !== undefined ? parseInt(data.year, 10) : null;
  const month = data.month !== undefined ? parseInt(data.month, 10) : null;
  const plannedAmount = data.plannedAmount ?? null;

  if (!categoryId || !year || !month || plannedAmount === null) {
    return error("Champs obligatoires manquants : categoryId, year, month, plannedAmount.", 400);
  }
  if (month < 1 || month > 12) return error("Mois invalide (1-12).", 400);
  if (Number(plannedAmount) < 0) return error("Le montant prévu doit être positif.", 400);

  const category = await prisma.category.findUnique({ where: { id: Number(categoryId) } });
  if (!category) return error(`Catégorie introuvable (id=${categoryId}).`, 404);

  let accountId: number | null = null;
  if (data.accountId) {
    const account = await prisma.account.findUnique({ where: { id: Number(data.accountId) } });
    if (!account) return error(`Compte introuvable (id=${data.accountId}).`, 404);
    accountId = account.id;
  }

  const label = data.label !== undefined && data.label !== "" ? String(data.label) : null;

  const existing = await prisma.budget.findFirst({ where: { categoryId: category.id, year, month, label } });
  if (existing) {
    return error(`Une ligne budget existe déjà pour ${category.name} — ${month}/${year}.`, 409, {
      existing: { id: existing.id, plannedAmount: fromCents(existing.plannedAmountCents) },
    });
  }

  const budget = await prisma.budget.create({
    data: { categoryId: category.id, year, month, plannedAmountCents: toCents(plannedAmount), label, accountId },
  });

  return json(
    {
      id: budget.id,
      categoryId: category.id,
      categoryName: category.name,
      year: budget.year,
      month: budget.month,
      plannedAmount: fromCents(budget.plannedAmountCents),
      actualAmount: fromCents(budget.actualAmountCents),
      label: budget.label,
    },
    201,
  );
}
