import { json, notFound, parseId } from "@/lib/server/http";
import { getAccountJson } from "@/lib/server/queries";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  const account = id === null ? null : await getAccountJson(id);
  return account ? json(account) : notFound();
}
