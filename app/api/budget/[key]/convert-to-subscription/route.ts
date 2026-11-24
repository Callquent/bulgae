import { prisma } from "@/lib/server/prisma";
import { error, json, notFound, parseId, readJson } from "@/lib/server/http";
import { serializeSubscription, subInclude } from "@/lib/server/serialize";
import { parseDate } from "@/lib/server/dates";

export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const id = parseId((await params).key);
  const budget = id === null ? null : await prisma.budget.findUnique({ where: { id }, include: { category: true } });
  if (!budget) return notFound();

  // Une ligne déjà liée à un abonnement ne peut pas en générer un second :
  // deux abonnements se disputeraient la même ligne lors des synchros.
  if (budget.sourceSubscriptionId !== null) return error("Cette ligne est déjà liée à un abonnement.", 409);
  if (budget.accountId === null) return error("Un compte est requis pour créer un abonnement.", 422);
  // Un abonnement ne porte qu'un compte : pas d'équivalent pour un virement.
  if (budget.category.transactionType === "transfer") {
    return error("Une ligne de virement ne peut pas être convertie en abonnement.", 422);
  }

  const data = (await readJson(req)) ?? {};

  // Le mois de la ligne devient le mois de départ de l'abonnement.
  const subscription = await prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.create({
      data: {
        name: data.name ?? budget.label ?? budget.category.name,
        amountCents: budget.plannedAmountCents,
        frequency: data.frequency ?? "monthly",
        status: "active",
        startDate: new Date(Date.UTC(budget.year, budget.month - 1, 1)),
        endDate: data.endDate ? parseDate(data.endDate) : null,
        dayOfMonth: data.dayOfMonth ? Number(data.dayOfMonth) : null,
        notes: data.notes ?? null,
        accountId: budget.accountId!,
        categoryId: budget.categoryId,
      },
      include: subInclude,
    });
    // La prochaine synchro reconnaîtra la ligne et ne créera pas de doublon.
    await tx.budget.update({ where: { id: budget.id }, data: { sourceSubscriptionId: sub.id } });
    return sub;
  });

  return json(serializeSubscription(subscription), 201);
}
