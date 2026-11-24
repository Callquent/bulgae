import { prisma } from "@/lib/server/prisma";
import { error, json, notFound, parseId } from "@/lib/server/http";
import { getContributedCents, withProgress } from "@/lib/server/savings";

// L'objectif a atteint son montant cible : on le marque « utilisable »
// (completed). Il n'est plus synchronisé ; ses lignes de budget restent.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  const goal = id === null ? null : await prisma.savingsGoal.findUnique({ where: { id } });
  if (!goal) return notFound();

  if ((await getContributedCents(goal.id)) + 1 < goal.targetAmountCents) {
    return error("Le montant cible n'est pas encore atteint.", 422);
  }

  await prisma.savingsGoal.update({ where: { id: goal.id }, data: { status: "completed" } });
  return json(await withProgress(goal.id));
}
