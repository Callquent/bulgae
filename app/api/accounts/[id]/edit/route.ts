import { prisma } from "@/lib/server/prisma";
import { error, json, notFound, parseId, readJson } from "@/lib/server/http";
import { serializeAccount } from "@/lib/server/serialize";
import { toCents } from "@/lib/server/money";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  const existing = id === null ? null : await prisma.account.findUnique({ where: { id } });
  if (!existing) return notFound();

  const data = await readJson(req);
  if (!data || typeof data.name !== "string" || data.name.trim() === "") {
    return error("Le nom du compte est obligatoire.", 400);
  }

  const account = await prisma.account.update({
    where: { id: existing.id },
    data: {
      name: data.name,
      currency: data.currency ?? "EUR",
      balanceCents: data.balance !== undefined && data.balance !== null ? toCents(data.balance) : existing.balanceCents,
    },
  });
  return json(serializeAccount(account));
}
