import { prisma } from "@/lib/server/prisma";
import { json, notFound, parseId } from "@/lib/server/http";

async function remove(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const id = parseId((await params).key);
  if (id === null || !(await prisma.budget.findUnique({ where: { id }, select: { id: true } }))) {
    return notFound();
  }
  await prisma.budget.delete({ where: { id } });
  return json({ deleted: true });
}

export { remove as DELETE, remove as POST };
