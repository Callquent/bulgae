import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Données de démonstration — `npm run db:seed` */
async function main() {
  if ((await prisma.account.count()) > 0) {
    console.log("La base contient déjà des comptes : seed ignoré.");
    return;
  }

  const [livretA, ccp, porteMonnaie] = await Promise.all([
    prisma.account.create({ data: { name: "Livret A", balanceCents: 350000 } }),
    prisma.account.create({ data: { name: "Compte CCP", balanceCents: 120000 } }),
    prisma.account.create({ data: { name: "Porte-monnaie", balanceCents: 8000 } }),
  ]);

  const cat = (name: string, transactionType: string, description: string) =>
    prisma.category.create({ data: { name, transactionType, description } });

  const salaire = await cat("Salaire", "income", "Salaire mensuel net");
  const courses = await cat("Courses", "expense", "Alimentation et produits du quotidien");
  await cat("Abonnement transport", "expense", "Abonnement annuel (Navigo, TER, etc.)");
  await cat("Abonnement mobile", "expense", "Abonnement mobile mensuel");
  await cat("Abonnement internet", "expense", "Abonnement internet mensuel");
  await cat("Électricité", "expense", "Facture fournisseur électricité");
  await cat("Assurance habitation", "expense", "Cotisation assurance habitation");
  await cat("Crédit habitation", "expense", "Crédit habitation");
  const virement = await cat("Virement", "transfer", "Virements entre vos propres comptes — créée automatiquement.");

  const tx = (accountId: number, categoryId: number, amountCents: number, type: string, date: string, label: string) => {
    const d = new Date(`${date}T00:00:00Z`);
    return prisma.transaction.create({
      data: {
        accountId, categoryId, amountCents, type, label,
        transactionDate: d, year: d.getUTCFullYear(), month: d.getUTCMonth() + 1,
      },
    });
  };

  await tx(ccp.id, salaire.id, 160000, "credit", "2026-05-30", "Salaire mai 2026");
  await tx(ccp.id, courses.id, 21000, "debit", "2026-05-14", "Courses mai 2026");
  await tx(livretA.id, virement.id, 30000, "credit", "2026-05-01", "Virement Livret A mai 2026");
  void porteMonnaie;

  console.log("Données de démonstration créées.");
}

main().finally(() => prisma.$disconnect());
