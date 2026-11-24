import { buildRecurringBase, toCents } from "./subscription-data";

/** Validation + conversion du payload d'un objectif d'épargne. */
export async function buildGoalData(data: Record<string, any> | null) {
  const base = await buildRecurringBase(data);
  if (!base.ok) return base;
  if (data!.targetAmount === undefined || data!.targetAmount === null) {
    return { ok: false as const, message: "Le montant cible est obligatoire." };
  }
  if (data!.contributionAmount === undefined || data!.contributionAmount === null) {
    return { ok: false as const, message: "Le montant du versement est obligatoire." };
  }
  return {
    ok: true as const,
    data: {
      ...base.data,
      targetAmountCents: toCents(data!.targetAmount),
      contributionAmountCents: toCents(data!.contributionAmount),
      status: data!.status ?? "active",
    },
  };
}
