import { prisma } from "./prisma";
import { subInclude } from "./serialize";
import { byName } from "./dates";
import { isDueForPeriod } from "./recurrence";

export type ActiveSub = Awaited<ReturnType<typeof loadActiveSubscriptions>>[number];

/** Tous les abonnements actifs (avec compte et catégorie), triés par nom. */
export async function loadActiveSubscriptions() {
  const subs = await prisma.subscription.findMany({
    where: { status: "active" },
    include: subInclude,
  });
  return subs.sort(byName);
}

/** Filtre en mémoire les abonnements réellement dus sur (year, month). */
export function dueForPeriod(subs: ActiveSub[], year: number, month: number): ActiveSub[] {
  return subs.filter((s) => isDueForPeriod(s, year, month));
}

export async function findActiveForPeriod(year: number, month: number) {
  return dueForPeriod(await loadActiveSubscriptions(), year, month);
}

export async function findAllWithRelations() {
  const subs = await prisma.subscription.findMany({ include: subInclude });
  // status ASC puis name ASC
  return subs.sort((a, b) => a.status.localeCompare(b.status) || byName(a, b));
}

/**
 * Crée les lignes de budget manquantes pour les abonnements dus sur le mois
 * (création uniquement, ne touche pas aux lignes existantes).
 */
export async function syncBudgetLines(year: number, month: number, subs?: ActiveSub[]): Promise<number> {
  const due = dueForPeriod(subs ?? (await loadActiveSubscriptions()), year, month);

  // Les tests d'existence sont faits avant toute création, comme le flush
  // différé de l'ancienne version : deux abonnements partageant la même
  // catégorie/compte ont chacun leur ligne.
  const toCreate = [];
  for (const sub of due) {
    const exists = await prisma.budget.findFirst({
      where: { categoryId: sub.categoryId, accountId: sub.accountId, year, month },
      select: { id: true },
    });
    if (!exists) toCreate.push(sub);
  }

  for (const sub of toCreate) {
    await prisma.budget.create({
      data: {
        categoryId: sub.categoryId,
        accountId: sub.accountId,
        year,
        month,
        plannedAmountCents: sub.amountCents,
        actualAmountCents: sub.amountCents,
        sourceSubscriptionId: sub.id,
      },
    });
  }
  return toCreate.length;
}

export async function syncBudgetLinesForYear(year: number): Promise<number> {
  const subs = await loadActiveSubscriptions();
  let synced = 0;
  for (let m = 1; m <= 12; m++) synced += await syncBudgetLines(year, m, subs);
  return synced;
}
