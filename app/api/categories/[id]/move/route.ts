import { prisma } from "@/lib/server/prisma";
import { error, json, notFound, parseId, readJson } from "@/lib/server/http";
import { serializeCategory } from "@/lib/server/serialize";
import { resolveParentId } from "@/lib/server/categories";

// Drag & drop de /categories : déplace une catégorie sous une autre (ou la
// remonte au premier niveau si parentId est null).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  const existing = id === null ? null : await prisma.category.findUnique({ where: { id } });
  if (!existing) return notFound();

  const data = (await readJson(req)) ?? {};
  let parentId: number | null;
  try {
    parentId = await resolveParentId(data.parentId, existing.id);
  } catch (e) {
    return error((e as Error).message, 400);
  }

  const category = await prisma.category.update({ where: { id: existing.id }, data: { parentId } });
  return json(serializeCategory(category));
}
