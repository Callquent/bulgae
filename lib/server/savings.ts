import { prisma } from "./prisma";
import { goalInclude, serializeGoal } from "./serialize";
import { byName, now } from "./dates";
import { isDueForPeriod } from "./recurrence";
import { centsToNumber } from "./money";

export type ActiveGoal = Awaited<ReturnType<typeof loadActiveGoals>>[number];

export async function loadActiveGoals() {
  const goals = await prisma.savingsGoal.findMany({
    where: { status: "active" },
    include: goalInclude,
  });
  return goals.sort(byName);
}

export function goalsDueForPeriod(goals: ActiveGoal[], year: number, month: number): ActiveGoal[] {
  return goals.filter((g) => isDueForPeriod(g, year, month));
}

export async function findActiveForPeriod(year: number, month: number) {
  return goalsDueForPeriod(await loadActiveGoals(), year, month);
}

export async function findAllWithRelations() {
  const goals = await prisma.savingsGoal.findMany({ include: goalInclude });
  return goals.sort((a, b) => a.status.localeCompare(b.status) || byName(a, b));
}

/**
 * Somme (en centimes) des actualAmount de toutes les lignes de budget liées
 * à l'objectif, tous mois et tous statuts d'approbation confondus.
 */
export async function getContributedCents(goalId: number): Promise<number> {
  const res = await prisma.budget.aggregate({
    where: { sourceSavingsGoalId: goalId },
    _sum: { actualAmountCents: true },
  });
  return res._sum.actualAmountCents ?? 0;
}

/**
 * Répercute les modifications d'un objectif sur ses lignes de budget déjà
 * générées : lignes NON approuvées, du mois courant et des mois futurs.
 * Une ligne qui n'est plus due est supprimée.
 */
export async function refreshLinkedBudgetLines(goal: {
  id: number;
  name: string;
  categoryId: number;
  accountId: number;
  contributionAmountCents: number;
  status: string;
  startDate: Date;
  endDate: Date | null;
  frequency: string;
}) {
  const { year: cy, month: cm } = now();
  const lines = await prisma.budget.findMany({ where: { sourceSavingsGoalId: goal.id } });

  for (const mb of lines) {
    if (mb.approvedAt !== null) continue;
    if (mb.year < cy || (mb.year === cy && mb.month < cm)) continue;

    if (goal.status !== "active" || !isDueForPeriod(goal, mb.year, mb.month)) {
      await prisma.budget.delete({ where: { id: mb.id } });
      continue;
    }

    await prisma.budget.update({
      where: { id: mb.id },
      data: {
        label: goal.name,
        categoryId: goal.categoryId,
        accountId: goal.accountId,
        plannedAmountCents: goal.contributionAmountCents,
        actualAmountCents: goal.contributionAmountCents,
      },
    });
  }
}

/** Objectif sérialisé + champs de progression calculés (jamais persistés). */
export async function withProgress(goalId: number) {
  const goal = await prisma.savingsGoal.findUniqueOrThrow({ where: { id: goalId }, include: goalInclude });
  const contributed = centsToNumber(await getContributedCents(goal.id));
  const target = centsToNumber(goal.targetAmountCents);

  return {
    ...serializeGoal(goal),
    contributedAmount: contributed,
    remainingAmount: Math.max(0, target - contributed),
    progressPercentage: target > 0 ? Math.min(100, Math.round((contributed / target) * 1000) / 10) : 0,
  };
}
