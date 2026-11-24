import { prisma } from "@/lib/server/prisma";
import { error, json, notFound, parseId, readJson } from "@/lib/server/http";
import { budgetInclude, serializeBudget } from "@/lib/server/serialize";
import { buildBudgetData } from "@/lib/server/budget-data";

export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const id = parseId((await params).key);
  const existing = id === null ? null : await prisma.budget.findUnique({ where: { id } });
  if (!existing) return notFound();

  if (existing.approvedAt !== null) return error("Ligne verrouillée car approuvée.", 409);

  const built = await buildBudgetData(await readJson(req));
  if (!built.ok) return error(built.message, built.status);

  const budget = await prisma.budget.update({ where: { id: existing.id }, data: built.data, include: budgetInclude });
  return json(serializeBudget(budget));
}
