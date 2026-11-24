import { json, notFound, parseId } from "@/lib/server/http";
import { getSubscriptionJson } from "@/lib/server/queries";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  const sub = id === null ? null : await getSubscriptionJson(id);
  return sub ? json(sub) : notFound();
}
