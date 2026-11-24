import { notFound } from "next/navigation";
import BudgetForm from "@/components/Budget/BudgetForm";
import { getBudgetJson } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function BudgetEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = /^\d+$/.test(id) ? await getBudgetJson(Number(id)) : null;
  if (!data) notFound();

  return (
    <BudgetForm
      title={
        data.isApproved
          ? `Budget verrouillé — ${data.label ?? ""}`
          : "Modifier le budget"
      }
      initialData={data as any}
    />
  );
}
