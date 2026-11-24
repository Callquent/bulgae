import { prisma } from "@/lib/server/prisma";
import { error, json, notFound, parseId, readJson } from "@/lib/server/http";
import { serializeCategory } from "@/lib/server/serialize";
import { assertTransferUnique, resolveParentId, validatePayload } from "@/lib/server/categories";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  const existing = id === null ? null : await prisma.category.findUnique({ where: { id } });
  if (!existing) return notFound();

  const data = await readJson(req);
  const invalid = validatePayload(data);
  if (invalid) return error(invalid, 400);

  const conflict = await assertTransferUnique(data!.transactionType, existing.id);
  if (conflict) return error(conflict, 409);

  let parentId = existing.parentId;
  if ("parentId" in data!) {
    try {
      parentId = await resolveParentId(data!.parentId, existing.id);
    } catch (e) {
      return error((e as Error).message, 400);
    }
  }

  const category = await prisma.category.update({
    where: { id: existing.id },
    data: {
      name: data!.name.trim(),
      transactionType: data!.transactionType,
      description: data!.description ?? null,
      parentId,
    },
  });
  return json(serializeCategory(category));
}
