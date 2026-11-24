import { prisma } from "./prisma";
import { budgetInclude } from "./serialize";
import { now } from "./dates";
import { centsToNumber } from "./money";
import { byName } from "./dates";
import { loadActiveSubscriptions, dueForPeriod, syncBudgetLinesForYear, type ActiveSub } from "./subscriptions";
import { loadActiveGoals, goalsDueForPeriod, getContributedCents } from "./savings";

// ─── Lecture ─────────────────────────────────────────────────────────────

/** Postes budgétaires d'un mois, triés par nom de catégorie. */
export async function findByPeriod(year: number, month: number) {
  const rows = await prisma.budget.findMany({
    where: { year, month },
    include: budgetInclude,
  });
  return rows.sort((a, b) => byName(a.category, b.category) || a.id - b.id);
}

/**
 * Recalcule actualAmount de toutes les lignes d'un mois à partir des
 * transactions réelles. À appeler après chaque ajout/modification/suppression
 * de transaction.
 *  - income   : somme des crédits de la catégorie
 *  - expense  : somme des débits de la catégorie
 *  - transfer : débits sur le compte expéditeur + crédits sur le compte
 *               destinataire (il faut distinguer par compte)
 */
export async function refreshActualAmounts(year: number, month: number): Promise<void> {
  const [budgets, txs] = await Promise.all([
    prisma.budget.findMany({ where: { year, month }, include: { category: true } }),
    prisma.transaction.findMany({ where: { year, month } }),
  ]);

  for (const mb of budgets) {
    const type = mb.category.transactionType;
    let total = 0;
    for (const t of txs) {
      if (t.categoryId !== mb.categoryId) continue;
      const ok =
        (type === "income" && t.type === "credit") ||
        (type === "expense" && t.type === "debit") ||
        (type === "transfer" && t.type === "debit" && t.accountId === mb.accountId) ||
        (type === "transfer" && t.type === "credit" && t.accountId === mb.destinationAccountId);
      if (ok) total += t.amountCents;
    }
    if (total !== mb.actualAmountCents) {
      await prisma.budget.update({ where: { id: mb.id }, data: { actualAmountCents: total } });
    }
  }
}

/** Bilan annuel : net (income − expense, virements ignorés) prévu vs réalisé par mois. */
export async function findAnnualSummary(year: number) {
  const budgets = await prisma.budget.findMany({ where: { year }, include: { category: true } });
  const byMonth = new Map<number, { month: number; total_planned: number; total_actual: number }>();

  for (const b of budgets) {
    let row = byMonth.get(b.month);
    if (!row) {
      row = { month: b.month, total_planned: 0, total_actual: 0 };
      byMonth.set(b.month, row);
    }
    const t = b.category.transactionType;
    const sign = t === "income" ? 1 : t === "transfer" ? 0 : -1;
    row.total_planned += sign * centsToNumber(b.plannedAmountCents);
    row.total_actual += sign * centsToNumber(b.actualAmountCents);
  }

  return [...byMonth.values()].sort((a, b) => a.month - b.month);
}

/** Totaux mensuels prévus/réalisés pour un type de catégorie (expense par défaut). */
export async function findYearlyMonthlyTotals(year: number, type = "expense") {
  const budgets = await prisma.budget.findMany({
    where: { year, category: { transactionType: type } },
  });
  const byMonth = new Map<number, { month: number; planned: number; actual: number }>();
  for (const b of budgets) {
    const row = byMonth.get(b.month) ?? { month: b.month, planned: 0, actual: 0 };
    row.planned += centsToNumber(b.plannedAmountCents);
    row.actual += centsToNumber(b.actualAmountCents);
    byMonth.set(b.month, row);
  }
  return [...byMonth.values()].sort((a, b) => a.month - b.month);
}

// ─── Vue annuelle : agrégats ─────────────────────────────────────────────

type IE = { income: number; expense: number };
type Counter = { total: number; approved: number };
type Nested<T> = Record<number, Record<string, T>>;

export interface PlannedTotals {
  plannedByAccount: Nested<IE>;
  allPlannedByAccount: Nested<IE>;
  approvalByAccount: Nested<Counter>;
}

/**
 * Agrège toutes les lignes de budget de l'année par compte et par mois.
 *  - plannedByAccount    : lignes NON approuvées (projection future)
 *  - allPlannedByAccount : TOUTES les lignes (« month_planned_net » complet)
 *  - approvalByAccount   : compteurs { total, approved } par compte/mois
 */
export async function buildPlannedTotals(year: number): Promise<PlannedTotals> {
  const plannedByAccount: Nested<IE> = {};
  const allPlannedByAccount: Nested<IE> = {};
  const approvalByAccount: Nested<Counter> = {};

  const ie = (store: Nested<IE>, m: number, aid: string): IE => {
    store[m] ??= {};
    return (store[m][aid] ??= { income: 0, expense: 0 });
  };

  const applyEntry = (m: number, aid: string, isCredit: boolean, amount: number, approved: boolean) => {
    approvalByAccount[m] ??= {};
    const c = (approvalByAccount[m][aid] ??= { total: 0, approved: 0 });
    c.total++;
    if (approved) c.approved++;
    ie(allPlannedByAccount, m, aid)[isCredit ? "income" : "expense"] += amount;
  };

  const budgets = await prisma.budget.findMany({ where: { year }, include: { category: true } });

  for (const mb of budgets) {
    const m = mb.month;
    const type = mb.category.transactionType;
    const planned = centsToNumber(mb.plannedAmountCents);
    const actual = centsToNumber(mb.actualAmountCents);
    const approved = mb.approvedAt !== null;
    // Montant du mois : le RÉALISÉ dès qu'il existe (ligne approuvée ou déjà
    // des transactions), le prévu sinon.
    const monthAmount = approved || actual > 0 ? actual : planned;

    const srcAid = mb.accountId !== null ? String(mb.accountId) : "all";
    const isTransfer = type === "transfer" && mb.destinationAccountId !== null;
    const dstAid = isTransfer ? String(mb.destinationAccountId) : null;

    if (isTransfer) {
      // Une seule ligne, deux comptes : sortie sur account, entrée sur destinationAccount.
      applyEntry(m, srcAid, false, monthAmount, approved);
      applyEntry(m, dstAid!, true, monthAmount, approved);
    } else {
      applyEntry(m, srcAid, type === "income", monthAmount, approved);
    }

    // Projection cumulative : uniquement les lignes non approuvées (les
    // approuvées ont déjà leurs transactions dans le solde réel).
    if (approved) continue;

    if (isTransfer) {
      ie(plannedByAccount, m, srcAid).expense += monthAmount;
      ie(plannedByAccount, m, dstAid!).income += monthAmount;
    } else {
      ie(plannedByAccount, m, srcAid)[type === "income" ? "income" : "expense"] += monthAmount;
    }
  }

  return { plannedByAccount, allPlannedByAccount, approvalByAccount };
}

/** Mouvements réels (crédit/débit) par compte puis par mois. */
export async function buildTransactionMovements(year: number) {
  const txs = await prisma.transaction.findMany({
    where: { year },
    select: { accountId: true, month: true, type: true, amountCents: true },
  });
  const out: Record<number, Record<number, { credit: number; debit: number }>> = {};
  for (const t of txs) {
    out[t.accountId] ??= {};
    const cell = (out[t.accountId][t.month] ??= { credit: 0, debit: 0 });
    cell[t.type === "credit" ? "credit" : "debit"] += centsToNumber(t.amountCents);
  }
  return out;
}

/** Abonnements actifs dus, distribués par compte puis par mois. */
export function buildSubscriptionMovements(subs: ActiveSub[], year: number) {
  const out: Record<number, Record<number, number>> = {};
  for (let m = 1; m <= 12; m++) {
    for (const sub of dueForPeriod(subs, year, m)) {
      out[sub.accountId] ??= {};
      out[sub.accountId][m] = (out[sub.accountId][m] ?? 0) + centsToNumber(sub.amountCents);
    }
  }
  return out;
}

export interface Starting {
  net: Record<string, number>;
  planned: Record<string, number>;
}

/**
 * Soldes cumulés de base (réel + planifié) hérités de l'année précédente —
 * uniquement pour une année future.
 */
export async function buildStartingBalances(year: number, currentYear: number): Promise<Starting> {
  const net: Record<string, number> = {};
  const planned: Record<string, number> = {};
  if (year <= currentYear) return { net, planned };

  const prevTxs = await prisma.transaction.findMany({
    where: { year: { lte: year - 1 } },
    select: { accountId: true, type: true, amountCents: true },
  });
  for (const t of prevTxs) {
    const k = String(t.accountId);
    net[k] = (net[k] ?? 0) + (t.type === "credit" ? 1 : -1) * centsToNumber(t.amountCents);
  }

  const prevBudgets = await prisma.budget.findMany({ where: { year: year - 1 }, include: { category: true } });
  for (const mb of prevBudgets) {
    const amt = centsToNumber(mb.plannedAmountCents);
    const src = mb.accountId !== null ? String(mb.accountId) : "all";
    if (mb.category.transactionType === "transfer" && mb.destinationAccountId !== null) {
      const dst = String(mb.destinationAccountId);
      planned[src] = (planned[src] ?? 0) - amt;
      planned[dst] = (planned[dst] ?? 0) + amt;
    } else {
      planned[src] = (planned[src] ?? 0) + (mb.category.transactionType === "income" ? amt : -amt);
    }
  }
  return { net, planned };
}

export interface MonthBalance {
  balance: number;
  balance_projected: number;
  credit: number;
  debit: number;
  subs: number;
  planned_net: number;
  month_planned_net: number;
  month_all_approved: boolean;
}

/**
 * Pour chaque compte et chaque mois : solde réel cumulé, solde projeté
 * (réel + planifié non approuvé) et indicateurs annexes.
 */
export function buildAccountBalances(
  accounts: { id: number; balanceCents: number }[],
  year: number,
  currentYear: number,
  currentMonth: number,
  txMovements: Awaited<ReturnType<typeof buildTransactionMovements>>,
  subMovements: ReturnType<typeof buildSubscriptionMovements>,
  totals: PlannedTotals,
  starting: Starting,
): Record<number, Record<number, MonthBalance>> {
  const { plannedByAccount, allPlannedByAccount, approvalByAccount } = totals;
  const zero: IE = { income: 0, expense: 0 };
  const zeroC: Counter = { total: 0, approved: 0 };
  const result: Record<number, Record<number, MonthBalance>> = {};

  for (const account of accounts) {
    const aid = account.id;
    const key = String(aid);
    const balance = centsToNumber(account.balanceCents) + (starting.net[key] ?? 0);
    let cumNet = 0;
    let cumPlannedNet = (starting.planned[key] ?? 0) + (starting.planned["all"] ?? 0);
    result[aid] = {};

    for (let m = 1; m <= 12; m++) {
      const credit = txMovements[aid]?.[m]?.credit ?? 0;
      const debit = txMovements[aid]?.[m]?.debit ?? 0;
      const subs = subMovements[aid]?.[m] ?? 0;
      cumNet += credit - debit;

      const pAccount = plannedByAccount[m]?.[key] ?? zero;
      const pAll = plannedByAccount[m]?.["all"] ?? zero;
      const isCurrentOrFuture = year > currentYear || (year === currentYear && m >= currentMonth);
      if (isCurrentOrFuture) {
        cumPlannedNet += pAccount.income + pAll.income - (pAccount.expense + pAll.expense);
      }

      const apAll = allPlannedByAccount[m]?.["all"] ?? zero;
      const apAccount = allPlannedByAccount[m]?.[key] ?? zero;
      const monthPlannedNet = apAccount.income + apAll.income - (apAccount.expense + apAll.expense);

      const apvAccount = approvalByAccount[m]?.[key] ?? zeroC;
      const apvAll = approvalByAccount[m]?.["all"] ?? zeroC;
      const totalBudgets = apvAccount.total + apvAll.total;
      const approvedBudgets = apvAccount.approved + apvAll.approved;

      result[aid][m] = {
        balance: balance + cumNet,
        balance_projected: balance + cumNet + cumPlannedNet,
        credit,
        debit,
        subs,
        planned_net: cumPlannedNet,
        month_planned_net: monthPlannedNet,
        month_all_approved: totalBudgets > 0 && totalBudgets === approvedBudgets,
      };
    }
  }
  return result;
}

/**
 * Solde projeté cumulé d'UN compte à la fin d'un mois — même calcul que
 * « balance_projected » de la vue annuelle.
 */
export async function getProjectedBalanceForMonth(
  account: { id: number; balanceCents: number },
  year: number,
  month: number,
): Promise<number> {
  const { year: cy, month: cm } = now();
  const [totals, txMovements, subs, starting] = await Promise.all([
    buildPlannedTotals(year),
    buildTransactionMovements(year),
    loadActiveSubscriptions(),
    buildStartingBalances(year, cy),
  ]);
  const balances = buildAccountBalances(
    [account], year, cy, cm, txMovements, buildSubscriptionMovements(subs, year), totals, starting,
  );
  return balances[account.id]?.[month]?.balance_projected ?? centsToNumber(account.balanceCents);
}

// ─── Synchronisation des objectifs d'épargne ─────────────────────────────

/**
 * Crée les lignes de budget des objectifs d'épargne dus sur (year, month) —
 * mais PAS si le solde projeté du compte, une fois le versement déduit,
 * serait négatif. Création ligne par ligne : le calcul du mois suivant
 * dépend des lignes déjà décidées sur les mois précédents.
 */
export async function syncSavingsGoalLinesForMonth(year: number, month: number, goals?: Awaited<ReturnType<typeof loadActiveGoals>>): Promise<number> {
  const due = goalsDueForPeriod(goals ?? (await loadActiveGoals()), year, month);
  let created = 0;

  for (const goal of due) {
    const exists = await prisma.budget.findFirst({
      where: { sourceSavingsGoalId: goal.id, year, month },
      select: { id: true },
    });
    if (exists) continue;

    // Plafonne au reste à épargner : le total ne dépasse jamais targetAmount.
    const remaining = goal.targetAmountCents - (await getContributedCents(goal.id));
    if (remaining <= 0) continue;
    const contributionCents = Math.min(goal.contributionAmountCents, remaining);

    const projected = await getProjectedBalanceForMonth(goal.account, year, month);
    if (projected - centsToNumber(contributionCents) < 0) continue;

    await prisma.budget.create({
      data: {
        categoryId: goal.categoryId,
        accountId: goal.accountId,
        year,
        month,
        label: goal.name,
        plannedAmountCents: contributionCents,
        actualAmountCents: contributionCents,
        sourceSavingsGoalId: goal.id,
      },
    });
    created++;
  }
  return created;
}

export async function syncSavingsGoalLinesForYear(year: number): Promise<number> {
  const goals = await loadActiveGoals();
  let created = 0;
  for (let m = 1; m <= 12; m++) created += await syncSavingsGoalLinesForMonth(year, m, goals);
  return created;
}

export { syncBudgetLinesForYear };
