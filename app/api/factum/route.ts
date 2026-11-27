import { json } from "@/lib/server/http";
import { getLink } from "@/lib/server/factum";

export const dynamic = "force-dynamic";

/** État du lien avec Factum (lecture seule : le lien se crée dans Triviae > Liens). */
export async function GET() {
  return json({ link: await getLink() });
}
