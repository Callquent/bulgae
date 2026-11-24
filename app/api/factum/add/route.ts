import { prisma } from "@/lib/server/prisma";
import { error, json, readJson } from "@/lib/server/http";
import { fetchFeed, getLink, invoiceLabel, windowFor } from "@/lib/server/factum";

export const dynamic = "force-dynamic";

/** Ajoute les factures choisies comme lignes de budget (prévu = réalisé = montant) dans le mois affiché. */
export async function POST(req: Request) {
  const b = await readJson(req);
  if (!b) return error("Requête invalide.");
  const ids: string[] = Array.isArray(b.invoiceIds) ? b.invoiceIds.filter((v: unknown): v is string => typeof v === "string") : [];
  const year = Number(b.year);
  const month = Number(b.month);
  if (ids.length === 0) return error("Choisissez au moins une facture.");
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return error("Période invalide.");

  const account = await prisma.account.findUnique({ where: { id: Number(b.accountId) } });
  if (!account) return error("Choisissez un compte.");
  const category = await prisma.category.findUnique({ where: { id: Number(b.categoryId) } });
  if (!category || category.transactionType !== "expense") return error("Choisissez une catégorie de dépense.");

  const link = await getLink();
  if (!link) return error("Factum n'est pas lié.", 409);
  let feed;
  try {
    const { from, to } = windowFor(year);
    feed = await fetchFeed(link.appId, from, to);
  } catch (e) {
    return error(e instanceof Error ? e.message : "Factum injoignable.", 422);
  }

  // Les montants viennent de Factum (jamais du navigateur) ; une facture déjà ajoutée est ignorée.
  const wanted = new Set(ids);
  const already = new Set(
    (await prisma.budget.findMany({ where: { factumInvoiceId: { in: ids } }, select: { factumInvoiceId: true } })).map((x) => x.factumInvoiceId),
  );
  const toAdd = feed.filter((i) => wanted.has(i.id) && !already.has(i.id));
  if (toAdd.length === 0) return error("Ces factures sont déjà dans le budget (ou introuvables dans Factum).", 409);

  await prisma.$transaction(
    toAdd.map((i) =>
      prisma.budget.create({
        data: {
          label: invoiceLabel(i),
          categoryId: category.id,
          accountId: account.id,
          year,
          month,
          plannedAmountCents: i.amountCents,
          actualAmountCents: i.amountCents,
          factumInvoiceId: i.id,
        },
      }),
    ),
  );
  return json({ added: toAdd.length }, 201);
}
