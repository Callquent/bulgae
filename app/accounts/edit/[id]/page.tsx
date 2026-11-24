import { notFound } from "next/navigation";
import AccountForm from "@/components/Account/AccountForm";
import { getAccountJson } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function AccountEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = /^\d+$/.test(id) ? await getAccountJson(Number(id)) : null;
  if (!data) notFound();

  return <AccountForm title={`Modifier « ${data.name} »`} initialData={data} />;
}
