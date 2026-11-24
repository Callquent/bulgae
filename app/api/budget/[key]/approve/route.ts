import { prisma } from "@/lib/server/prisma";
import { error, json, notFound, parseId } from "@/lib/server/http";
import { budgetInclude, serializeBudget } from "@/lib/server/serialize";
import { periodLabel } from "@/lib/server/dates";
import { centsToNumber } from "@/lib/server/money";
import { getProjectedBalanceForMonth } from "@/lib/server/budget";
import { formatFr } from "@/lib/server/budget-data";

export async function POST(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const id = parseId((await params).key);
  const budget = id === null ? null : await prisma.budget.findUnique({
    where: { id },
    include: { category: true, account: true },
  });
  if (!budget) return notFound();

  if (budget.approvedAt !== null) return error("Cette ligne est déjà approuvée.", 409);
  if (!budget.account) {
    return error("Veuillez d'abord associer un compte à cette ligne budgétaire avant d'approuver.", 422);
  }

  const categoryType = budget.category.transactionType;
  const txDate = new Date(Date.UTC(budget.year, budget.month - 1, 1));
  const period = periodLabel(budget.year, budget.month);
  const label = budget.label ?? `${budget.category.name} — ${period}`;

  // Une ligne générée par un objectif d'épargne ne doit pas mettre le compte
  // à découvert : on vérifie le solde PROJETÉ cumulé jusqu'au mois de la ligne
  // (même calcul que la vue annuelle), pas le solde réel d'aujourd'hui.
  if (budget.sourceSavingsGoalId !== null) {
    const projected = await getProjectedBalanceForMonth(budget.account, budget.year, budget.month);
    if (projected < 0) {
      return error(
        `Solde insuffisant sur ${budget.account.name} : selon les prévisions jusqu'à ${period}, ` +
          `ce versement d'épargne de ${formatFr(centsToNumber(budget.actualAmountCents))}€ laisserait le compte à ` +
          `${formatFr(projected)}€. Réduisez le montant, alimentez le compte, ou mettez l'objectif en pause.`,
        422,
      );
    }
  }

  const base = {
    categoryId: budget.categoryId,
    amountCents: budget.actualAmountCents,
    transactionDate: txDate,
    year: budget.year,
    month: budget.month,
    label,
  };

  if (categoryType === "transfer") {
    if (budget.destinationAccountId === null) {
      return error("Veuillez indiquer le compte destinataire de ce virement avant d'approuver.", 422);
    }
    // Un virement génère deux transactions : débit sur l'expéditeur, crédit sur le destinataire.
    await prisma.$transaction(async (tx) => {
      const debit = await tx.transaction.create({ data: { ...base, accountId: budget.accountId!, type: "debit" } });
      const credit = await tx.transaction.create({ data: { ...base, accountId: budget.destinationAccountId!, type: "credit" } });
      await tx.budget.update({
        where: { id: budget.id },
        data: { approvedAt: new Date(), approvedTransactionId: debit.id, approvedDestinationTransactionId: credit.id },
      });
    });
  } else {
    await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: { ...base, accountId: budget.accountId!, type: categoryType === "income" ? "credit" : "debit" },
      });
      await tx.budget.update({
        where: { id: budget.id },
        data: { approvedAt: new Date(), approvedTransactionId: created.id },
      });
    });
  }

  const updated = await prisma.budget.findUniqueOrThrow({ where: { id: budget.id }, include: budgetInclude });
  return json(serializeBudget(updated));
}
