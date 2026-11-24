import { json, notFound } from "@/lib/server/http";
import { getStatisticsView } from "@/lib/server/statistics";

export async function GET(req: Request, { params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  if (!/^\d{4}$/.test(year)) return notFound();
  const groupBy = new URL(req.url).searchParams.get("groupBy") ?? "category";
  return json(await getStatisticsView(parseInt(year, 10), groupBy));
}
