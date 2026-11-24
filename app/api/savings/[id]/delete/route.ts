import { prisma } from "@/lib/server/prisma";
import { json, notFound, parseId } from "@/lib/server/http";

async function remove(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null || !(await prisma.savingsGoal.findUnique({ where: { id }, select: { id: true } }))) {
    return notFound();
  }
  await prisma.$transaction([
    prisma.budget.deleteMany({ where: { sourceSavingsGoalId: id, approvedAt: null } }),
    prisma.savingsGoal.delete({ where: { id } }),
  ]);
  return json({ deleted: true });
}

export { remove as DELETE, remove as POST };
