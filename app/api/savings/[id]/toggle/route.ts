import { prisma } from "@/lib/server/prisma";
import { json, notFound, parseId } from "@/lib/server/http";
import { withProgress } from "@/lib/server/savings";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  const goal = id === null ? null : await prisma.savingsGoal.findUnique({ where: { id } });
  if (!goal) return notFound();

  const wasActive = goal.status === "active";
  // Même règle que pour les abonnements : on ne retire que les lignes
  // générées pour CET objectif et pas encore approuvées.
  if (wasActive) {
    await prisma.budget.deleteMany({ where: { sourceSavingsGoalId: goal.id, approvedAt: null } });
  }
  await prisma.savingsGoal.update({ where: { id: goal.id }, data: { status: wasActive ? "inactive" : "active" } });

  return json(await withProgress(goal.id));
}
