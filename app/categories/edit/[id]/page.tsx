import { notFound } from "next/navigation";
import CategoryForm from "@/components/Category/CategoryForm";
import { getCategoryJson } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function CategoryEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = /^\d+$/.test(id) ? await getCategoryJson(Number(id)) : null;
  if (!data) notFound();

  return (
    <CategoryForm
      title={`Modifier « ${data.name} »`}
      initialData={{ ...data, description: data.description ?? "" }}
    />
  );
}
