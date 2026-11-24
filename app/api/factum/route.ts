import { prisma } from "@/lib/server/prisma";
import { error, json, readJson } from "@/lib/server/http";
import { hubApps, hubUrl } from "@/lib/server/hub";
import { FACTUM_APP_ID, fetchFeed, getLink, windowFor } from "@/lib/server/factum";

export const dynamic = "force-dynamic";

/** État du lien : lien actuel et applications du hub. */
export async function GET() {
  const [link, apps, hub] = await Promise.all([getLink(), hubApps(), hubUrl()]);
  return json({
    link,
    hubFound: !!hub,
    hubIds: apps.map((a) => a.id).filter((id) => id !== "budget"),
    defaultAppId: FACTUM_APP_ID,
  });
}

/** Lier : on vérifie d'abord que Factum fournit bien ses factures. */
export async function POST(req: Request) {
  const b = await readJson(req);
  const appId = typeof b?.appId === "string" ? b.appId.trim().toLowerCase().slice(0, 41) : "";
  if (!/^[a-z0-9][a-z0-9-]*$/.test(appId)) return error("Indiquez l'identifiant de Factum dans Triviae (minuscules, chiffres et tirets).");
  try {
    await fetchFeed(appId, windowFor(new Date().getFullYear()).from, windowFor(new Date().getFullYear()).to);
  } catch (e) {
    return error(e instanceof Error ? e.message : "Factum injoignable.", 422);
  }
  const link = await prisma.factumConnection.upsert({ where: { id: 1 }, create: { id: 1, appId }, update: { appId } });
  return json({ link }, 201);
}

/** Délier : les lignes déjà ajoutées au budget restent, simplement détachées de Factum. */
export async function DELETE() {
  await prisma.$transaction([
    prisma.budget.updateMany({ where: { factumInvoiceId: { not: null } }, data: { factumInvoiceId: null } }),
    prisma.factumConnection.deleteMany({}),
  ]);
  return json({ ok: true });
}
