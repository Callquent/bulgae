import { prisma } from "@/lib/server/prisma";
import { error, json, readJson } from "@/lib/server/http";
import { serializeTransaction, txInclude } from "@/lib/server/serialize";
import { buildTransactionData } from "@/lib/server/transactions";
import { refreshActualAmounts } from "@/lib/server/budget";

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return error("Requête invalide.", 400);

  const built = await buildTransactionData(body, false);
  if (!built.ok) return error(built.message, 422);

  const tx = await prisma.transaction.create({ data: built.data as any, include: txInclude });
  await refreshActualAmounts(tx.year, tx.month);

  return json(serializeTransaction(tx), 201);
}
