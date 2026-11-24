import { prisma } from "@/lib/server/prisma";
import { json } from "@/lib/server/http";
import { serializeCategory } from "@/lib/server/serialize";
import { byName } from "@/lib/server/dates";
import { findOrCreateTransferCategory } from "@/lib/server/categories";

export async function GET() {
  // Auto-provisioning : une catégorie Virement existe toujours.
  await findOrCreateTransferCategory();

  const categories = (await prisma.category.findMany()).sort(
    (a, b) => a.transactionType.localeCompare(b.transactionType) || byName(a, b),
  );

  const grouped: Record<string, ReturnType<typeof serializeCategory>[]> = {};
  for (const c of categories) (grouped[c.transactionType] ??= []).push(serializeCategory(c));

  return json({ grouped });
}
