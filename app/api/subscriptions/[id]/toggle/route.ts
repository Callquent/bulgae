import { prisma } from "@/lib/server/prisma";
import { json, notFound, parseId } from "@/lib/server/http";
import { serializeSubscription, subInclude } from "@/lib/server/serialize";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  const sub = id === null ? null : await prisma.subscription.findUnique({ where: { id } });
  if (!sub) return notFound();

  const wasActive = sub.status === "active";

  // On ne retire QUE les lignes générées automatiquement par CET abonnement
  // (lien sourceSubscription) et non approuvées — jamais une ligne saisie à
  // la main, même si elle partage la même catégorie/compte.
  if (wasActive) {
    await prisma.budget.deleteMany({ where: { sourceSubscriptionId: sub.id, approvedAt: null } });
  }

  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: wasActive ? "inactive" : "active" },
    include: subInclude,
  });
  return json(serializeSubscription(updated));
}
