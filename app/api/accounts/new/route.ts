import { prisma } from "@/lib/server/prisma";
import { error, json, readJson } from "@/lib/server/http";
import { serializeAccount } from "@/lib/server/serialize";
import { toCents } from "@/lib/server/money";

export async function POST(req: Request) {
  const data = await readJson(req);
  if (!data || typeof data.name !== "string" || data.name.trim() === "") {
    return error("Le nom du compte est obligatoire.", 400);
  }

  const account = await prisma.account.create({
    data: {
      name: data.name,
      currency: data.currency ?? "EUR",
      balanceCents: toCents(data.balance ?? "0"),
    },
  });
  return json(serializeAccount(account), 201);
}
