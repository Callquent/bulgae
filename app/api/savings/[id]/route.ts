import { json, notFound, parseId } from "@/lib/server/http";
import { getSavingsGoalJson } from "@/lib/server/queries";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  const goal = id === null ? null : await getSavingsGoalJson(id);
  return goal ? json(goal) : notFound();
}
