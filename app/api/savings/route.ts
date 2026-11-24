import { json } from "@/lib/server/http";
import { findAllWithRelations, withProgress } from "@/lib/server/savings";

export async function GET() {
  const goals = await findAllWithRelations();
  return json({ savingsGoals: await Promise.all(goals.map((g) => withProgress(g.id))) });
}
