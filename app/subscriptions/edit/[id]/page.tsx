import { notFound } from "next/navigation";
import SubscriptionForm from "@/components/Subscription/SubscriptionForm";
import { getSubscriptionJson } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function SubscriptionEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = /^\d+$/.test(id) ? await getSubscriptionJson(Number(id)) : null;
  if (!data) notFound();

  return (
    <SubscriptionForm
      title={`Modifier « ${data.name} »`}
      initialData={{
        id: data.id,
        name: data.name,
        accountId: data.account.id,
        categoryId: data.category.id,
        amount: data.amount,
        frequency: data.frequency as "monthly" | "yearly" | "quarterly" | "occasional",
        startDate: data.startDate ?? undefined,
        endDate: data.endDate ?? null,
        dayOfMonth: data.dayOfMonth,
        status: data.status as "active" | "inactive",
        notes: data.notes ?? undefined,
      }}
    />
  );
}
