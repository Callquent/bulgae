import { json, notFound, parseId } from "@/lib/server/http";
import { getBudgetJson } from "@/lib/server/queries";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  const budget = id === null ? null : await getBudgetJson(id);
  return budget ? json(budget) : notFound();
}
