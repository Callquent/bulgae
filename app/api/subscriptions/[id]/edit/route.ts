import { prisma } from "@/lib/server/prisma";
import { error, json, notFound, parseId, readJson } from "@/lib/server/http";
import { serializeSubscription, subInclude } from "@/lib/server/serialize";
import { buildRecurringBase, toCents } from "@/lib/server/subscription-data";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null || !(await prisma.subscription.findUnique({ where: { id }, select: { id: true } }))) {
    return notFound();
  }

  const data = await readJson(req);
  const base = await buildRecurringBase(data);
  if (!base.ok) return error(base.message, 422);
  if (data!.amount === undefined || data!.amount === null) return error("Le montant est obligatoire.", 422);

  const sub = await prisma.subscription.update({
    where: { id },
    data: { ...base.data, amountCents: toCents(data!.amount), status: data!.status ?? "active" },
    include: subInclude,
  });
  return json(serializeSubscription(sub));
}
