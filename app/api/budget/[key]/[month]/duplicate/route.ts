import { prisma } from "@/lib/server/prisma";
import { json, notFound } from "@/lib/server/http";
import { findByPeriod } from "@/lib/server/budget";

// Duplique les lignes du mois vers le mois suivant (sans doublon par catégorie).
export async function POST(_req: Request, { params }: { params: Promise<{ key: string; month: string }> }) {
  const { key, month: monthParam } = await params;
  if (!/^\d{4}$/.test(key) || !/^\d{1,2}$/.test(monthParam)) return notFound();
  const year = parseInt(key, 10);
  const month = parseInt(monthParam, 10);

  const next = new Date(Date.UTC(year, month, 1)); // mois + 1
  const nextYear = next.getUTCFullYear();
  const nextMonth = next.getUTCMonth() + 1;
  let count = 0;

  for (const source of await findByPeriod(year, month)) {
    const exists = await prisma.budget.findFirst({
      where: { categoryId: source.categoryId, year: nextYear, month: nextMonth },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.budget.create({
      data: {
        categoryId: source.categoryId,
        accountId: source.accountId,
        destinationAccountId: source.destinationAccountId,
        year: nextYear,
        month: nextMonth,
        plannedAmountCents: source.plannedAmountCents,
      },
    });
    count++;
  }
  return json({ duplicated: count, year: nextYear, month: nextMonth });
}
