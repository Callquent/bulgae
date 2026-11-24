import { prisma } from "@/lib/server/prisma";
import { json, notFound, parseId } from "@/lib/server/http";
import { budgetInclude, serializeBudget } from "@/lib/server/serialize";

export async function POST(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const id = parseId((await params).key);
  const budget = id === null ? null : await prisma.budget.findUnique({ where: { id } });
  if (!budget) return notFound();

  const txIds = [budget.approvedTransactionId, budget.approvedDestinationTransactionId].filter(
    (v): v is number => v !== null,
  );

  await prisma.$transaction([
    prisma.budget.update({
      where: { id: budget.id },
      data: { approvedAt: null, approvedTransactionId: null, approvedDestinationTransactionId: null },
    }),
    prisma.transaction.deleteMany({ where: { id: { in: txIds } } }),
  ]);

  const updated = await prisma.budget.findUniqueOrThrow({ where: { id: budget.id }, include: budgetInclude });
  return json(serializeBudget(updated));
}
