import type { Prisma } from "@prisma/client";
import { fromCents } from "./money";
import { fmtDate } from "./dates";

// ── Includes réutilisables ────────────────────────────────────────────────
export const txInclude = { account: true, category: true } satisfies Prisma.TransactionInclude;
export const subInclude = { account: true, category: true } satisfies Prisma.SubscriptionInclude;
export const goalInclude = { account: true, category: true } satisfies Prisma.SavingsGoalInclude;
export const budgetInclude = {
  category: true,
  account: true,
  destinationAccount: true,
  sourceSubscription: { include: subInclude },
  sourceSavingsGoal: { include: goalInclude },
} satisfies Prisma.BudgetInclude;

type Account = Prisma.AccountGetPayload<object>;
type Category = Prisma.CategoryGetPayload<object>;
type Tx = Prisma.TransactionGetPayload<{ include: typeof txInclude }>;
type Sub = Prisma.SubscriptionGetPayload<{ include: typeof subInclude }>;
type Goal = Prisma.SavingsGoalGetPayload<{ include: typeof goalInclude }>;
type BudgetRow = Prisma.BudgetGetPayload<{ include: typeof budgetInclude }>;

// ── Sérialiseurs (mêmes formes JSON que l'ancien backend Symfony) ─────────
export const serializeAccount = (a: Account) => ({
  id: a.id,
  name: a.name,
  currency: a.currency,
  balance: fromCents(a.balanceCents),
});

export const serializeCategory = (c: Category) => ({
  id: c.id,
  name: c.name,
  transactionType: c.transactionType,
  description: c.description,
  parentId: c.parentId,
});

export const serializeTransaction = (t: Tx) => ({
  id: t.id,
  account: serializeAccount(t.account),
  category: serializeCategory(t.category),
  amount: fromCents(t.amountCents),
  type: t.type,
  transactionDate: fmtDate(t.transactionDate),
  year: t.year,
  month: t.month,
  label: t.label,
  notes: t.notes,
});

export const serializeSubscription = (s: Sub) => ({
  id: s.id,
  name: s.name,
  account: serializeAccount(s.account),
  category: serializeCategory(s.category),
  amount: fromCents(s.amountCents),
  frequency: s.frequency,
  dayOfMonth: s.dayOfMonth,
  startDate: fmtDate(s.startDate),
  endDate: fmtDate(s.endDate),
  status: s.status,
  notes: s.notes,
});

export const serializeGoal = (g: Goal) => ({
  id: g.id,
  name: g.name,
  account: serializeAccount(g.account),
  category: serializeCategory(g.category),
  targetAmount: fromCents(g.targetAmountCents),
  contributionAmount: fromCents(g.contributionAmountCents),
  frequency: g.frequency,
  status: g.status,
  startDate: fmtDate(g.startDate),
  endDate: fmtDate(g.endDate),
  dayOfMonth: g.dayOfMonth,
  notes: g.notes,
});

export const serializeBudget = (b: BudgetRow) => ({
  id: b.id,
  category: serializeCategory(b.category),
  label: b.label,
  account: b.account ? serializeAccount(b.account) : null,
  destinationAccount: b.destinationAccount ? serializeAccount(b.destinationAccount) : null,
  year: b.year,
  month: b.month,
  plannedAmount: fromCents(b.plannedAmountCents),
  actualAmount: fromCents(b.actualAmountCents),
  approvedAt: fmtDate(b.approvedAt),
  sourceSubscription: b.sourceSubscription ? serializeSubscription(b.sourceSubscription) : null,
  sourceSavingsGoal: b.sourceSavingsGoal ? serializeGoal(b.sourceSavingsGoal) : null,
  isApproved: b.approvedAt !== null,
});
