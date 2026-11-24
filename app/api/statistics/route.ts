import { json } from "@/lib/server/http";
import { getStatisticsView } from "@/lib/server/statistics";

export async function GET(req: Request) {
  const groupBy = new URL(req.url).searchParams.get("groupBy") ?? "category";
  return json(await getStatisticsView(0, groupBy));
}
