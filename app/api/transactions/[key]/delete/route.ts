import { prisma } from "@/lib/server/prisma";
import { json, notFound, parseId } from "@/lib/server/http";
import { refreshActualAmounts } from "@/lib/server/budget";

async function remove(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const id = parseId((await params).key);
  const tx = id === null ? null : await prisma.transaction.findUnique({ where: { id } });
  if (!tx) return notFound();

  await prisma.transaction.delete({ where: { id: tx.id } });
  await refreshActualAmounts(tx.year, tx.month);

  return json({ year: tx.year, month: tx.month });
}

export { remove as DELETE, remove as POST };
