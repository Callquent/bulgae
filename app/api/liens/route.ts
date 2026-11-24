import { json } from "@/lib/server/http";
import { getLink } from "@/lib/server/factum";

export const dynamic = "force-dynamic";

/**
 * Liens du budget avec les autres applications, lus par la page « Liens » de Triviae.
 * Factum fournit ses factures au budget : direction « in » (le budget reçoit).
 * Sans application liée (Configuration > Factum), la liste est vide.
 */
export async function GET() {
  try {
    const link = await getLink();
    if (!link) return json({ links: [] });
    return json({ links: [{ app: link.appId, label: "Factures ajoutées au budget", direction: "in" }] });
  } catch {
    return json({ links: [] });
  }
}
