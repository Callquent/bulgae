import { prisma } from "@/lib/server/prisma";
import { error, isForeignKeyError, json, notFound, parseId } from "@/lib/server/http";

async function remove(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null || !(await prisma.account.findUnique({ where: { id }, select: { id: true } }))) {
    return notFound();
  }
  try {
    // Les transactions du compte sont supprimées avec lui (cascade).
    await prisma.account.delete({ where: { id } });
  } catch (e) {
    if (isForeignKeyError(e)) {
      return error(
        "Ce compte est encore utilisé par des lignes de budget, abonnements ou objectifs d'épargne.",
        409,
      );
    }
    throw e;
  }
  return json({ deleted: true });
}

export { remove as DELETE, remove as POST };
