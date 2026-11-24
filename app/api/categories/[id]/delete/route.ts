import { prisma } from "@/lib/server/prisma";
import { error, isForeignKeyError, json, notFound, parseId } from "@/lib/server/http";

async function remove(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null || !(await prisma.category.findUnique({ where: { id }, select: { id: true } }))) {
    return notFound();
  }
  try {
    // Ses lignes de budget sont supprimées avec elle ; ses sous-catégories
    // remontent au premier niveau.
    await prisma.category.delete({ where: { id } });
  } catch (e) {
    if (isForeignKeyError(e)) {
      return error(
        "Cette catégorie est encore utilisée par des transactions, abonnements ou objectifs d'épargne.",
        409,
      );
    }
    throw e;
  }
  return json({ deleted: true });
}

export { remove as DELETE, remove as POST };
