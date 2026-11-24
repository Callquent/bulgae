import { json } from "@/lib/server/http";
import { serializeSubscription } from "@/lib/server/serialize";
import { findAllWithRelations } from "@/lib/server/subscriptions";

export async function GET() {
  const subs = await findAllWithRelations();
  return json({ subscriptions: subs.map(serializeSubscription) });
}
