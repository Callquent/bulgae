import { prisma } from "./prisma";
import {
  serializeAccount, serializeBudget, serializeGoal, serializeSubscription,
  serializeTransaction, txInclude,
} from "./serialize";
import { byName, FREQUENCIES, MONTHS, now, periodLabel } from "./dates";
import { centsToNumber } from "./money";
import {
  buildAccountBalances, buildPlannedTotals, buildStartingBalances,
  buildSubscriptionMovements, buildTransactionMovements, findAnnualSummary,
  findByPeriod, syncBudgetLinesForYear, syncSavingsGoalLinesForMonth,
  syncSavingsGoalLinesForYear,
} from "./budget";
import {
  dueForPeriod, loadActiveSubscriptions, syncBudgetLines,
} from "./subscriptions";
import { findActiveForPeriod as findGoalsForPeriod } from "./savings";

export async function findAllAccountsOrdered() {
  const accounts = await prisma.account.findMany();
  return accounts.sort(byName);
}

// ─── Transactions d'un mois ──────────────────────────────────────────────

export async function getTransactionsByMonth(year: number, month: number) {
  const { year: nowYear, month: nowMonth } = now();
  const [txs, accounts] = await Promise.all([
    prisma.transaction.findMany({
      where: { year, month },
      include: txInclude,
      orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
    }),
    findAllAccountsOrdered(),
  ]);

  let totalCredit = 0;
  let totalDebit = 0;
  const byAccount = new Map(
    accounts.map((a) => [
      a.id,
      {
        account: serializeAccount(a),
        credit: 0,
        debit: 0,
        balanceEnd: centsToNumber(a.balanceCents),
        transactions: [] as ReturnType<typeof serializeTransaction>[],
      },
    ]),
  );

  for (const tx of txs) {
    const row = byAccount.get(tx.accountId)!;
    const amount = centsToNumber(tx.amountCents);
    if (tx.type === "credit") {
      totalCredit += amount;
      row.credit += amount;
      row.balanceEnd += amount;
    } else {
      totalDebit += amount;
      row.debit += amount;
      row.balanceEnd -= amount;
    }
    row.transactions.push(serializeTransaction(tx));
  }

  return {
    year,
    month,
    nowYear,
    nowMonth,
    totalCredit,
    totalDebit,
    byAccount: [...byAccount.values()],
    transactions: txs.map(serializeTransaction),
  };
}

// ─── Vue annuelle du budget ──────────────────────────────────────────────

export async function getBudgetYearView(requestedYear: number) {
  const { year: currentYear, month: currentMonth } = now();
  // Sans année demandée : année courante, ou la suivante en décembre (la vue
  // annuelle sert surtout à préparer le budget à venir).
  const year = requestedYear !== 0 ? requestedYear : currentMonth === 12 ? currentYear + 1 : currentYear;

  await syncBudgetLinesForYear(year);
  await syncSavingsGoalLinesForYear(year);

  const summaryByMonth: Record<number, unknown> = {};
  for (const row of await findAnnualSummary(year)) summaryByMonth[row.month] = row;

  const [totals, accounts, txMovements, subs, starting] = await Promise.all([
    buildPlannedTotals(year),
    findAllAccountsOrdered(),
    buildTransactionMovements(year),
    loadActiveSubscriptions(),
    buildStartingBalances(year, currentYear),
  ]);

  const accountBalances = buildAccountBalances(
    accounts, year, currentYear, currentMonth, txMovements,
    buildSubscriptionMovements(subs, year), totals, starting,
  );

  return {
    year,
    currentYear,
    currentMonth,
    availableYears: Array.from({ length: 4 }, (_, i) => currentYear - 1 + i),
    accounts: accounts.map(serializeAccount),
    summary: summaryByMonth,
    accountBalances,
    monthNames: MONTHS,
  };
}

// ─── Vue mensuelle du budget ─────────────────────────────────────────────

export async function getBudgetMonthView(year: number, month: number) {
  const accounts = await findAllAccountsOrdered();
  const subscriptions = dueForPeriod(await loadActiveSubscriptions(), year, month);
  const savingsGoals = await findGoalsForPeriod(year, month);

  await syncBudgetLines(year, month);
  await syncSavingsGoalLinesForMonth(year, month);

  const budgets = await findByPeriod(year, month);
  const monthTxs = await prisma.transaction.findMany({ where: { year, month } });

  const txByAccount: Record<number, { credit: number; debit: number; subs: number; savings: number }> = {};
  const cell = (aid: number) => (txByAccount[aid] ??= { credit: 0, debit: 0, subs: 0, savings: 0 });
  for (const a of accounts) cell(a.id);

  for (const tx of monthTxs) cell(tx.accountId)[tx.type === "credit" ? "credit" : "debit"] += centsToNumber(tx.amountCents);
  for (const sub of subscriptions) {
    const c = cell(sub.accountId);
    c.debit += centsToNumber(sub.amountCents);
    c.subs += centsToNumber(sub.amountCents);
  }
  for (const goal of savingsGoals) {
    const c = cell(goal.accountId);
    c.debit += centsToNumber(goal.contributionAmountCents);
    c.savings += centsToNumber(goal.contributionAmountCents);
  }

  const { year: nowYear, month: nowMonth } = now();
  return {
    year,
    month,
    nowYear,
    nowMonth,
    periodLabel: `${MONTHS[month] ?? ""} ${year}`,
    accounts: accounts.map(serializeAccount),
    txByAccount,
    subscriptions: subscriptions.map(serializeSubscription),
    savingsGoals: savingsGoals.map(serializeGoal),
    budgets: budgets.map(serializeBudget),
    monthNames: MONTHS,
    frequencyLabels: FREQUENCIES,
  };
}

export { periodLabel };
