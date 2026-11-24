import { prisma } from "./prisma";

export const TRANSACTION_TYPES = ["income", "expense", "transfer"] as const;
const DEFAULT_TRANSFER_NAME = "Virement";

/**
 * Garantit qu'une catégorie de type Virement existe toujours. Cherchée par
 * transactionType (et non par nom) : si l'utilisateur la renomme, elle reste
 * « la » catégorie virement et n'est pas recréée en double.
 */
export async function findOrCreateTransferCategory() {
  const existing = await prisma.category.findFirst({ where: { transactionType: "transfer" } });
  if (existing) return existing;
  return prisma.category.create({
    data: {
      name: DEFAULT_TRANSFER_NAME,
      transactionType: "transfer",
      description: "Virements entre vos propres comptes — créée automatiquement.",
    },
  });
}

export function validatePayload(data: Record<string, any> | null): string | null {
  if (!data) return "Requête invalide.";
  if (typeof data.name !== "string" || data.name.trim() === "") {
    return "Le nom de la catégorie est obligatoire.";
  }
  if (!TRANSACTION_TYPES.includes(data.transactionType)) return "Type de transaction invalide.";
  return null;
}

/** Une seule catégorie Virement doit exister. */
export async function assertTransferUnique(transactionType: string, currentId: number | null): Promise<string | null> {
  if (transactionType !== "transfer") return null;
  const existing = await prisma.category.findFirst({ where: { transactionType: "transfer" } });
  if (existing && existing.id !== currentId) {
    return "Une catégorie de virement existe déjà, elle ne peut pas être dupliquée.";
  }
  return null;
}

/**
 * Résout et valide la catégorie parente : refuse un parent inexistant, une
 * catégorie parente d'elle-même, ou un de ses propres descendants (boucle).
 * Retourne l'id du parent (ou null), ou lève une Error avec le message.
 */
export async function resolveParentId(parentId: unknown, currentId: number | null): Promise<number | null> {
  if (parentId === null || parentId === undefined || parentId === "") return null;
  const pid = Number(parentId);

  if (pid === currentId) throw new Error("Une catégorie ne peut pas être sa propre sous-catégorie.");

  const parent = await prisma.category.findUnique({ where: { id: pid } });
  if (!parent) throw new Error("Catégorie parente introuvable.");

  if (currentId !== null) {
    let ancestor: typeof parent | null = parent;
    while (ancestor) {
      if (ancestor.id === currentId) throw new Error("Déplacement impossible : créerait une boucle.");
      ancestor = ancestor.parentId
        ? await prisma.category.findUnique({ where: { id: ancestor.parentId } })
        : null;
    }
  }
  return pid;
}
