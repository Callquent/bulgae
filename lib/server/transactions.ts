import { prisma } from "./prisma";
import { parseDate } from "./dates";
import { toCents } from "./money";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

/**
 * Convertit le payload JSON en données Prisma. `partial` = édition : seuls
 * les champs présents sont modifiés. Maintient year/month synchronisés avec
 * la date de la transaction.
 */
export async function buildTransactionData(
  data: Record<string, any>,
  partial: boolean,
): Promise<Result<Record<string, any>>> {
  const out: Record<string, any> = {};

  if (data.transactionDate) {
    const d = parseDate(data.transactionDate);
    if (Number.isNaN(d.getTime())) return { ok: false, message: "Date invalide." };
    out.transactionDate = d;
    out.year = d.getUTCFullYear();
    out.month = d.getUTCMonth() + 1;
  }
  if (data.accountId) {
    const account = await prisma.account.findUnique({ where: { id: Number(data.accountId) } });
    if (!account) return { ok: false, message: "Compte introuvable." };
    out.accountId = account.id;
  }
  if (data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: Number(data.categoryId) } });
    if (!category) return { ok: false, message: "Catégorie introuvable." };
    out.categoryId = category.id;
  }
  if (data.type !== undefined && data.type !== null) {
    if (data.type !== "credit" && data.type !== "debit") return { ok: false, message: "Type de transaction invalide." };
    out.type = data.type;
  }
  if (data.amount !== undefined && data.amount !== null) out.amountCents = toCents(data.amount);
  if ("label" in data) out.label = data.label || "";
  if ("notes" in data) out.notes = data.notes || null;

  if (!partial) {
    for (const [field, label] of [
      ["transactionDate", "La date"], ["accountId", "Le compte"], ["categoryId", "La catégorie"],
      ["type", "Le type"], ["amountCents", "Le montant"],
    ] as const) {
      if (out[field] === undefined) return { ok: false, message: `${label} est obligatoire.` };
    }
    out.label ??= "";
  }
  return { ok: true, data: out };
}
