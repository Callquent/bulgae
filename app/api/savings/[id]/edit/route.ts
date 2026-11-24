import { prisma } from "@/lib/server/prisma";
import { error, json, notFound, parseId, readJson } from "@/lib/server/http";
import { buildGoalData } from "@/lib/server/savings-data";
import { refreshLinkedBudgetLines, withProgress } from "@/lib/server/savings";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null || !(await prisma.savingsGoal.findUnique({ where: { id }, select: { id: true } }))) {
    return notFound();
  }

  const built = await buildGoalData(await readJson(req));
  if (!built.ok) return error(built.message, 422);

  const goal = await prisma.savingsGoal.update({ where: { id }, data: built.data });

  // Répercute le changement sur les lignes budget déjà générées (mois
  // courant et futurs, non approuvées).
  await refreshLinkedBudgetLines(goal);

  return json(await withProgress(goal.id));
}
