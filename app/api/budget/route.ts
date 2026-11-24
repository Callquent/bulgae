import { json } from "@/lib/server/http";
import { getBudgetYearView } from "@/lib/server/views";

export async function GET() {
  return json(await getBudgetYearView(0));
}
