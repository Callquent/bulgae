import { json, notFound, parseId } from "@/lib/server/http";
import { getCategoryJson } from "@/lib/server/queries";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  const category = id === null ? null : await getCategoryJson(id);
  return category ? json(category) : notFound();
}
