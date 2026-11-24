import { error, json, notFound } from "@/lib/server/http";
import { findBudgetsForLabel } from "@/lib/server/statistics";

// Détail mois par mois des budgets d'une catégorie (ou d'un parent et de ses
// sous-catégories) : clic sur une part du camembert / ligne du tableau.
export async function GET(req: Request, { params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  if (!/^\d{4}$/.test(year)) return notFound();

  const sp = new URL(req.url).searchParams;
  const label = sp.get("label");
  if (!label) return error("Le paramètre label est requis.", 400);

  const groupBy = sp.get("groupBy") ?? "category";
  return json({ budgets: await findBudgetsForLabel(parseInt(year, 10), label, groupBy !== "subcategory") });
}
