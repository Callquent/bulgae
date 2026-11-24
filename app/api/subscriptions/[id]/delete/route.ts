import { prisma } from "@/lib/server/prisma";
import { json, notFound, parseId } from "@/lib/server/http";

async function remove(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null || !(await prisma.subscription.findUnique({ where: { id }, select: { id: true } }))) {
    return notFound();
  }

  // Les lignes approuvées sont conservées (historique) : leur
  // sourceSubscription passe à NULL (onDelete SetNull).
  await prisma.$transaction([
    prisma.budget.deleteMany({ where: { sourceSubscriptionId: id, approvedAt: null } }),
    prisma.subscription.delete({ where: { id } }),
  ]);
  return json({ deleted: true });
}

export { remove as DELETE, remove as POST };
