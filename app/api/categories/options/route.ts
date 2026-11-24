import { json } from "@/lib/server/http";

export async function GET() {
  return json({
    transactionTypes: [
      { value: "expense", label: "Dépense (sortie)" },
      { value: "income", label: "Recette (entrée)" },
      { value: "transfer", label: "Virement interne" },
    ],
  });
}
