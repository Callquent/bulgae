import { prisma } from "@/lib/server/prisma";
import { json } from "@/lib/server/http";
import { serializeAccount } from "@/lib/server/serialize";
import { byName } from "@/lib/server/dates";

export async function GET() {
  const accounts = (await prisma.account.findMany()).sort(byName);
  return json({ accounts: accounts.map(serializeAccount) });
}
