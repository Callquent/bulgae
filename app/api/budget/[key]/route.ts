// [key] = année (GET /api/budget/2026) ou id de ligne pour les actions POST
// (/api/budget/12/approve…). Le détail d'une ligne est sur /api/budget/line/12.
import { json, notFound } from "@/lib/server/http";
import { getBudgetYearView } from "@/lib/server/views";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!/^\d{4}$/.test(key)) return notFound();
  return json(await getBudgetYearView(parseInt(key, 10)));
}
