import { notFound } from "next/navigation";
import SavingsGoalForm from "@/components/Savings/SavingsGoalForm";
import type { SavingsGoalInterface } from "@/components/Savings/Savings.interface";
import { getSavingsGoalJson } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function EditSavingsGoalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const goal = (/^\d+$/.test(id)
    ? await getSavingsGoalJson(Number(id))
    : null) as unknown as SavingsGoalInterface | null;
  if (!goal) notFound();

  return (
    <SavingsGoalForm
      // On dérive accountId / categoryId à plat, ce que SavingsGoalForm
      // attend pour préremplir AccountPicker / CategoryPicker.
      initialData={{
        ...goal,
        accountId: goal.account?.id,
        categoryId: goal.category?.id,
      }}
      title={`Edit: ${goal.name}`}
    />
  );
}
