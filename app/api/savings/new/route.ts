import { prisma } from "@/lib/server/prisma";
import { error, json, readJson } from "@/lib/server/http";
import { buildGoalData } from "@/lib/server/savings-data";
import { withProgress } from "@/lib/server/savings";

export async function POST(req: Request) {
  const built = await buildGoalData(await readJson(req));
  if (!built.ok) return error(built.message, 422);

  const goal = await prisma.savingsGoal.create({ data: built.data });
  return json(await withProgress(goal.id), 201);
}
