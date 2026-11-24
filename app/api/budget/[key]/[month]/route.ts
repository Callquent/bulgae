import { json, notFound } from "@/lib/server/http";
import { getBudgetMonthView } from "@/lib/server/views";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string; month: string }> }) {
  const { key, month } = await params;
  if (!/^\d{4}$/.test(key) || !/^\d{1,2}$/.test(month)) return notFound();
  return json(await getBudgetMonthView(parseInt(key, 10), parseInt(month, 10)));
}
