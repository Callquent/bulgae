import { prisma } from "@/lib/server/prisma";
import { error, json } from "@/lib/server/http";
import { serializeAccount } from "@/lib/server/serialize";
import { byName } from "@/lib/server/dates";
import { fetchFeed, getLink, windowFor } from "@/lib/server/factum";
import { fromCents } from "@/lib/server/money";

export const dynamic = "force-dynamic";

/** Factures de Factum proposées pour un mois (celles déjà ajoutées au budget sont signalées), + comptes et catégories de dépense. */
export async function GET(req: Request) {
  const year = Number(new URL(req.url).searchParams.get("year"));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return error("Année invalide.");
  const link = await getLink();
  if (!link) return error("Factum n'est pas lié : dans Triviae, page Liens, liez le budget à Factum.", 409);

  const { from, to } = windowFor(year);
  let invoices;
  try {
    invoices = await fetchFeed(link.appId, from, to);
  } catch (e) {
    return error(e instanceof Error ? e.message : "Factum injoignable.", 422);
  }
  const [added, accounts, categories] = await Promise.all([
    prisma.budget.findMany({ where: { factumInvoiceId: { not: null } }, select: { factumInvoiceId: true } }),
    prisma.account.findMany(),
    prisma.category.findMany({ where: { transactionType: "expense" } }),
  ]);
  const done = new Set(added.map((b) => b.factumInvoiceId));
  return json({
    invoices: invoices
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((i) => ({ id: i.id, company: i.company, amount: fromCents(i.amountCents), date: i.date, reference: i.reference, added: done.has(i.id) })),
    accounts: accounts.sort(byName).map(serializeAccount),
    categories: categories.sort(byName).map((c) => ({ id: c.id, name: c.name })),
  });
}
