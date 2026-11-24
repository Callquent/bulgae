import { notFound } from "next/navigation";
import TransactionForm from "@/components/Transaction/TransactionForm";
import { getTransactionJson } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function TransactionEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = /^\d+$/.test(id) ? await getTransactionJson(Number(id)) : null;
  if (!data) notFound();

  return <TransactionForm title="Modifier la transaction" initialData={data as any} />;
}
