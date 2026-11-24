import { prisma } from "@/lib/server/prisma";
import { error, json, notFound, parseId, readJson } from "@/lib/server/http";
import { serializeTransaction, txInclude } from "@/lib/server/serialize";
import { buildTransactionData } from "@/lib/server/transactions";
import { refreshActualAmounts } from "@/lib/server/budget";

export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const id = parseId((await params).key);
  const existing = id === null ? null : await prisma.transaction.findUnique({ where: { id } });
  if (!existing) return notFound();

  const body = await readJson(req);
  if (!body) return error("Requête invalide.", 400);

  const built = await buildTransactionData(body, true);
  if (!built.ok) return error(built.message, 422);

  const tx = await prisma.transaction.update({ where: { id: existing.id }, data: built.data as any, include: txInclude });

  await refreshActualAmounts(existing.year, existing.month);
  if (existing.year !== tx.year || existing.month !== tx.month) await refreshActualAmounts(tx.year, tx.month);

  return json(serializeTransaction(tx));
}
