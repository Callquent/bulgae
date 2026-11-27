import { prisma } from "./prisma";
import { toCents } from "./money";
import { hubApps, hubUrl } from "./hub";

// ---------------------------------------------------------------------------------------------
// Contrat de Factum (modèle : le flux « agenda » des applications liées à l'agenda) :
//
//   GET /api/budget?from=YYYY-MM-DD&to=YYYY-MM-DD
//   -> { invoices: [{ id, company, amount, date, reference?, path? }] }
//
// Le budget ne copie rien tout seul : depuis un mois, on choisit les factures à ajouter comme lignes de budget.
// ---------------------------------------------------------------------------------------------

export const FACTUM_APP_ID = "factum";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type FeedInvoice = { id: string; company: string; amountCents: number; date: string; reference: string };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Revérifie champ par champ ce qui vient de Factum : rien n'est repris tel quel. */
export function sanitizeFeed(raw: unknown): FeedInvoice[] {
  const list = raw && typeof raw === "object" ? (raw as { invoices?: unknown }).invoices : undefined;
  if (!Array.isArray(list)) throw new Error("Réponse inattendue : le flux doit contenir une liste « invoices ».");
  const out: FeedInvoice[] = [];
  for (const item of list.slice(0, 5000)) {
    const i = (item ?? {}) as Record<string, unknown>;
    const id = text(typeof i.id === "number" ? String(i.id) : i.id, 40);
    const company = text(i.company, 120);
    const amountCents = toCents(typeof i.amount === "number" ? i.amount : NaN);
    const date = typeof i.date === "string" && ISO_DATE.test(i.date) && !Number.isNaN(Date.parse(i.date)) ? i.date : "";
    if (!id || !company || !date || amountCents <= 0 || amountCents > 1e11) continue;
    out.push({ id, company, amountCents, date, reference: text(i.reference, 80) });
  }
  return out;
}

/** Lit les factures de Factum entre `from` et `to` (plage de 800 jours maximum). */
export async function fetchFeed(appId: string, from: string, to: string): Promise<FeedInvoice[]> {
  const hub = await hubUrl();
  if (!hub) throw new Error("Triviae est introuvable depuis le budget (variable HUB_URL à définir si le port est inhabituel).");
  let res: Response;
  try {
    res = await fetch(`${hub}/apps/${appId}/api/budget?from=${from}&to=${to}`, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
      headers: { accept: "application/json" },
    });
  } catch {
    throw new Error("Factum injoignable (est-il démarré ?).");
  }
  if (res.status === 404) {
    const ids = (await hubApps()).map((a) => a.id);
    if (!ids.includes(appId)) {
      throw new Error(`Aucune application « ${appId} » dans Triviae (trouvées : ${ids.join(", ") || "aucune"}). Corrigez l'identifiant.`);
    }
    throw new Error("Factum n'a pas de flux /api/budget : mettez-le à jour avec la version qui le fournit.");
  }
  if (!res.ok) throw new Error(`Factum a répondu « erreur ${res.status} ».`);
  if (!(res.headers.get("content-type") ?? "").includes("json")) throw new Error("Réponse inattendue (ce n'est pas du JSON).");
  return sanitizeFeed(await res.json());
}

/** Plage lue pour un mois affiché : de janvier de l'année précédente à décembre de l'année affichée. */
export const windowFor = (year: number) => ({ from: `${year - 1}-01-01`, to: `${year}-12-31` });

export const invoiceLabel = (i: Pick<FeedInvoice, "company" | "reference">) => (i.reference ? `${i.company} — ${i.reference}` : i.company);

// Le lien se choisit dans Triviae (page « Liens » : « Budget reçoit des factures de Factum »).
// - Triviae a un lien : on l'utilise, et l'ancienne liaison de la base est effacée (reprise faite).
// - Triviae injoignable ou sans lien : on garde l'ancienne liaison de la base, si elle existe, pour ne rien perdre.
// Quand le lien est retiré dans Triviae, plus rien n'est lié.
export type FactumLink = { appId: string };

export async function getLink(): Promise<FactumLink | null> {
  const hub = await hubUrl();
  if (hub) {
    try {
      const id = process.env.TRIVIAE_APP_ID || "budget";
      const res = await fetch(`${hub}/hub/links/for/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(1500), cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { links?: unknown; managed?: unknown };
        if (Array.isArray(data.links)) {
          const hit = data.links.find((l) => !!l && typeof l === "object" && (l as { feed?: unknown }).feed === "budget" && typeof (l as { provider?: unknown }).provider === "string") as { provider: string } | undefined;
          if (hit) {
            await prisma.factumConnection.deleteMany({}).catch(() => undefined);
            return { appId: hit.provider };
          }
          if (data.managed === true) {
            // liens gérés dans Triviae et aucun pour le budget : l'ancienne liaison est abandonnée
            await prisma.factumConnection.deleteMany({}).catch(() => undefined);
            return null;
          }
        }
      }
    } catch {
      /* Triviae injoignable : on retombe sur l'ancienne liaison */
    }
  }
  return prisma.factumConnection.findUnique({ where: { id: 1 } });
}

/** Vrai tant que la liaison vient encore de la base du budget (à reprendre dans Triviae). */
export const legacyLink = () => prisma.factumConnection.findUnique({ where: { id: 1 } });
