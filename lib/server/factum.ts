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

export const getLink = () => prisma.factumConnection.findUnique({ where: { id: 1 } });
