import { prisma } from "@/lib/server/prisma";
import { error, json, readJson } from "@/lib/server/http";
import { serializeCategory } from "@/lib/server/serialize";
import { assertTransferUnique, resolveParentId, validatePayload } from "@/lib/server/categories";

export async function POST(req: Request) {
  const data = await readJson(req);

  const invalid = validatePayload(data);
  if (invalid) return error(invalid, 400);

  const conflict = await assertTransferUnique(data!.transactionType, null);
  if (conflict) return error(conflict, 409);

  let parentId: number | null;
  try {
    parentId = await resolveParentId(data!.parentId, null);
  } catch (e) {
    return error((e as Error).message, 400);
  }

  const category = await prisma.category.create({
    data: {
      name: data!.name.trim(),
      transactionType: data!.transactionType,
      description: data!.description ?? null,
      parentId,
    },
  });
  return json(serializeCategory(category), 201);
}
