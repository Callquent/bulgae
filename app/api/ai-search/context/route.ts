import { prisma } from "@/lib/server/prisma";
import { json } from "@/lib/server/http";
import { fromCents } from "@/lib/server/money";
import { byName, fmtDate, now } from "@/lib/server/dates";
import { txInclude } from "@/lib/server/serialize";
import { findAllWithRelations } from "@/lib/server/subscriptions";
import { findByPeriod } from "@/lib/server/budget";

/**
 * GET /api/ai-search/context — fournit au moteur NLP du front toutes les
 * données nécessaires en un seul appel, sérialisées de façon plate.
 * Paramètre optionnel : tx_months (1-36, défaut 12).
 */
export async function GET(req: Request) {
  const raw = parseInt(new URL(req.url).searchParams.get("tx_months") ?? "12", 10);
  const txMonths = Math.max(1, Math.min(36, Number.isFinite(raw) ? raw : 12));
  const { year: toYear, month: toMonth } = now();

  // Transactions des N derniers mois (bornes year*100+month inclusives)
  const fromIndex = toYear * 12 + (toMonth - 1) - txMonths;
  const fromPeriod = Math.floor(fromIndex / 12) * 100 + ((fromIndex % 12) + 1);
  const toPeriod = toYear * 100 + toMonth;

  const allTxs = await prisma.transaction.findMany({ include: txInclude, orderBy: [{ transactionDate: "desc" }, { id: "desc" }] });
  const transactions = allTxs
    .filter((t) => t.year * 100 + t.month >= fromPeriod && t.year * 100 + t.month <= toPeriod)
    .map((t) => ({
      id: t.id,
      label: t.label,
      amount: fromCents(t.amountCents),
      type: t.type,
      transactionDate: fmtDate(t.transactionDate),
      year: t.year,
      month: t.month,
      category: { id: t.category.id, name: t.category.name, transactionType: t.category.transactionType },
      account: { id: t.account.id, name: t.account.name },
    }));

  const subscriptions = (await findAllWithRelations()).map((s) => ({
    id: s.id,
    name: s.name,
    amount: fromCents(s.amountCents),
    frequency: s.frequency,
    status: s.status,
    startDate: fmtDate(s.startDate),
    endDate: fmtDate(s.endDate),
    notes: s.notes,
    category: { name: s.category.name, transactionType: s.category.transactionType },
    account: { id: s.account.id, name: s.account.name },
  }));

  const accounts = (await prisma.account.findMany()).sort(byName).map((a) => ({
    id: a.id,
    name: a.name,
    balance: fromCents(a.balanceCents),
    currency: a.currency,
  }));

  // Budgets mensuels : année précédente + année courante
  const monthlyBudgets = [];
  for (const year of [toYear - 1, toYear]) {
    for (let month = 1; month <= 12; month++) {
      for (const b of await findByPeriod(year, month)) {
        monthlyBudgets.push({
          id: b.id,
          year: b.year,
          month: b.month,
          plannedAmount: fromCents(b.plannedAmountCents),
          actualAmount: fromCents(b.actualAmountCents),
          label: b.label,
          isApproved: b.approvedAt !== null,
          category: { name: b.category.name, transactionType: b.category.transactionType },
          account: b.account ? { id: b.account.id, name: b.account.name } : null,
        });
      }
    }
  }

  // Catégories : income, puis expense, puis transfer (chacune triée par nom)
  const cats = await prisma.category.findMany();
  const categories = ["income", "expense", "transfer"].flatMap((type) =>
    cats
      .filter((c) => c.transactionType === type)
      .sort(byName)
      .map((c) => ({ id: c.id, name: c.name, transactionType: c.transactionType })),
  );

  return json({ transactions, subscriptions, accounts, monthlyBudgets, categories });
}
