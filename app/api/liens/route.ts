import { json } from "@/lib/server/http";
import { legacyLink } from "@/lib/server/factum";

export const dynamic = "force-dynamic";

/**
 * Liens du budget avec les autres applications, lus par la page « Liens » de Triviae.
 * Factum fournit ses factures au budget : direction « in » (le budget reçoit).
 * Les liens se créent dans Triviae : ici ne reste déclarée que l'ancienne liaison de la base, à reprendre dans Triviae
 * (Liens > « Les reprendre dans Triviae »). Une fois reprise, elle est effacée et la liste est vide.
 */
export async function GET() {
  try {
    const link = await legacyLink();
    if (!link) return json({ links: [] });
    return json({ links: [{ app: link.appId, label: "Factures ajoutées au budget", direction: "in" }] });
  } catch {
    return json({ links: [] });
  }
}
