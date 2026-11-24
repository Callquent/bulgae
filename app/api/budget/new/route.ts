import { prisma } from "@/lib/server/prisma";
import { error, json, readJson } from "@/lib/server/http";
import { budgetInclude, serializeBudget } from "@/lib/server/serialize";
import { buildBudgetData } from "@/lib/server/budget-data";

export async function POST(req: Request) {
  const built = await buildBudgetData(await readJson(req));
  if (!built.ok) return error(built.message, built.status);

  const budget = await prisma.budget.create({ data: built.data, include: budgetInclude });
  return json(serializeBudget(budget), 201);
}
