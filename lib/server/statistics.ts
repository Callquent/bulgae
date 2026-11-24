import { prisma } from "./prisma";
import { centsToNumber } from "./money";
import { findAnnualSummary, findYearlyMonthlyTotals } from "./budget";
import { MONTHS, now } from "./dates";

const cmp = (a: string, b: string) => a.localeCompare(b, "fr", { sensitivity: "base" });

/**
 * Total prévu et réalisé par catégorie de dépense sur l'année. Avec
 * groupByParent, les sous-catégories sont regroupées sous leur parent.
 */
export async function findYearlyCategorySummary(year: number, groupByParent = true) {
  const budgets = await prisma.budget.findMany({
    where: { year, category: { transactionType: "expense" } },
    include: { category: { include: { parent: true } } },
  });

  if (!groupByParent) {
    const perCategory = new Map<number, { category_name: string; planned: number; actual: number }>();
    for (const b of budgets) {
      const row = perCategory.get(b.categoryId) ?? { category_name: b.category.name, planned: 0, actual: 0 };
      row.planned += centsToNumber(b.plannedAmountCents);
      row.actual += centsToNumber(b.actualAmountCents);
      perCategory.set(b.categoryId, row);
    }
    return [...perCategory.values()].sort((a, b) => cmp(a.category_name, b.category_name));
  }

  const grouped = new Map<string, { category_name: string; planned: number; actual: number }>();
  for (const b of budgets) {
    const label = b.category.parent?.name ?? b.category.name;
    const row = grouped.get(label) ?? { category_name: label, planned: 0, actual: 0 };
    row.planned += centsToNumber(b.plannedAmountCents);
    row.actual += centsToNumber(b.actualAmountCents);
    grouped.set(label, row);
  }
  return [...grouped.values()].sort((a, b) => cmp(a.category_name, b.category_name));
}

/**
 * Budgets mois par mois d'une catégorie (ou d'une catégorie parente et de
 * ses sous-catégories si groupByParent).
 */
export async function findBudgetsForLabel(year: number, label: string, groupByParent = true) {
  const budgets = await prisma.budget.findMany({
    where: { year, category: { transactionType: "expense" } },
    include: { category: { include: { parent: true } } },
  });

  return budgets
    .filter((b) =>
      groupByParent
        ? b.category.parent?.name === label || (!b.category.parent && b.category.name === label)
        : b.category.name === label,
    )
    .sort((a, b) => cmp(a.category.name, b.category.name) || a.month - b.month)
    .map((b) => ({
      category_name: b.category.name,
      label: b.label,
      month: b.month,
      planned: centsToNumber(b.plannedAmountCents),
      actual: centsToNumber(b.actualAmountCents),
      approved: b.approvedAt !== null,
    }));
}

// ─── Vue statistiques complète ───────────────────────────────────────────

const twelve = () => Array.from({ length: 12 }, () => 0);

function monthlyArrays(rows: { month: number; planned: number; actual: number }[]) {
  const planned = twelve();
  const actual = twelve();
  for (const r of rows) {
    planned[r.month - 1] = r.planned;
    actual[r.month - 1] = r.actual;
  }
  return { planned, actual };
}

export async function getStatisticsView(requestedYear: number, groupBy: string) {
  const { year: currentYear } = now();
  const year = requestedYear || currentYear;

  const summary = await findYearlyCategorySummary(year, groupBy !== "subcategory");
  const plannedChart: Record<string, number> = {};
  const actualChart: Record<string, number> = {};
  const categories: string[] = [];
  for (const row of summary) {
    categories.push(row.category_name);
    plannedChart[row.category_name] = row.planned;
    actualChart[row.category_name] = row.actual;
  }

  const expenses = monthlyArrays(await findYearlyMonthlyTotals(year, "expense"));
  const incomes = monthlyArrays(await findYearlyMonthlyTotals(year, "income"));

  // Bilan net mensuel (income − expense)
  const netPlanned = twelve();
  const netActual = twelve();
  for (const r of await findAnnualSummary(year)) {
    netPlanned[r.month - 1] = r.total_planned;
    netActual[r.month - 1] = r.total_actual;
  }

  return {
    year,
    currentYear,
    availableYears: [currentYear - 2, currentYear - 1, currentYear, currentYear + 1],
    groupBy,
    plannedChart,
    actualChart,
    categories,
    summary,
    plannedMonthly: expenses.planned,
    actualMonthly: expenses.actual,
    netPlannedMonthly: netPlanned,
    netActualMonthly: netActual,
    plannedIncomeMonthly: incomes.planned,
    actualIncomeMonthly: incomes.actual,
    monthNames: Object.values(MONTHS),
  };
}
