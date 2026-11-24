// [key] = id de la transaction (GET /api/transactions/12)
// ou année (GET /api/transactions/2026/7, voir [month]/route.ts).
import { json, notFound, parseId } from "@/lib/server/http";
import { getTransactionJson } from "@/lib/server/queries";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const id = parseId((await params).key);
  const tx = id === null ? null : await getTransactionJson(id);
  return tx ? json(tx) : notFound();
}
