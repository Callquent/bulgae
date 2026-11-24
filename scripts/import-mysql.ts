/**
 * Importe les données de l'ancienne base MySQL (backend Symfony) dans la base
 * SQLite de Prisma, en conservant les identifiants.
 *
 *   MYSQL_URL="mysql://user:motdepasse@127.0.0.1:3306/app" npm run db:import-mysql
 *
 * Prérequis : `npm run db:push` déjà exécuté, base SQLite vide.
 */
import mysql from "mysql2/promise";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const cents = (v: unknown) => Math.round(parseFloat(String(v ?? "0")) * 100);
const day = (v: unknown) => (v ? new Date(`${String(v).slice(0, 10)}T00:00:00Z`) : null);
const stamp = (v: unknown) => (v ? new Date(`${String(v).replace(" ", "T")}Z`) : null);
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

async function main() {
  const url = process.env.MYSQL_URL;
  if (!url) throw new Error("Variable MYSQL_URL manquante.");
  if ((await prisma.account.count()) > 0 || (await prisma.category.count()) > 0) {
    throw new Error("La base SQLite n'est pas vide : import annulé.");
  }

  const db = await mysql.createConnection({ uri: url, dateStrings: true });
  const rows = async (table: string): Promise<any[]> => (await db.query(`SELECT * FROM \`${table}\` ORDER BY id`))[0] as any[];

  const accounts = await rows("account");
  await prisma.account.createMany({
    data: accounts.map((r) => ({
      id: r.id, name: r.name, currency: r.currency ?? "EUR",
      balanceCents: cents(r.balance), createdAt: stamp(r.created_at) ?? new Date(),
    })),
  });

  const categories = await rows("category");
  await prisma.category.createMany({
    data: categories.map((r) => ({
      id: r.id, name: r.name, transactionType: r.transaction_type, description: r.description,
    })),
  });
  for (const r of categories.filter((c) => c.parent_id)) {
    await prisma.category.update({ where: { id: r.id }, data: { parentId: r.parent_id } });
  }

  await prisma.transaction.createMany({
    data: (await rows("transaction")).map((r) => ({
      id: r.id, accountId: r.account_id, categoryId: r.category_id, amountCents: cents(r.amount),
      type: r.type, transactionDate: day(r.transaction_date)!, year: r.year, month: r.month,
      label: r.label ?? "", notes: r.notes, createdAt: stamp(r.created_at) ?? new Date(),
    })),
  });

  await prisma.subscription.createMany({
    data: (await rows("subscription")).map((r) => ({
      id: r.id, name: r.name, accountId: r.account_id, categoryId: r.category_id,
      amountCents: cents(r.amount), frequency: r.frequency, dayOfMonth: num(r.day_of_month),
      startDate: day(r.start_date)!, endDate: day(r.end_date), status: r.status ?? "active",
      notes: r.notes, createdAt: stamp(r.created_at) ?? new Date(),
    })),
  });

  await prisma.savingsGoal.createMany({
    data: (await rows("savings_goal")).map((r) => ({
      id: r.id, name: r.name, accountId: r.account_id, categoryId: r.category_id,
      targetAmountCents: cents(r.target_amount), contributionAmountCents: cents(r.contribution_amount),
      frequency: r.frequency, status: r.status, startDate: day(r.start_date)!, endDate: day(r.end_date),
      dayOfMonth: num(r.day_of_month), notes: r.notes,
    })),
  });

  await prisma.budget.createMany({
    data: (await rows("monthly_budget")).map((r) => ({
      id: r.id, categoryId: r.category_id, label: r.label, accountId: r.account_id,
      destinationAccountId: r.destination_account_id, year: r.year, month: r.month,
      plannedAmountCents: cents(r.planned_amount), actualAmountCents: cents(r.actual_amount),
      approvedAt: stamp(r.approved_at), approvedTransactionId: r.approved_transaction_id,
      approvedDestinationTransactionId: r.approved_destination_transaction_id,
      sourceSubscriptionId: r.source_subscription_id, sourceSavingsGoalId: r.source_savings_goal_id,
    })),
  });

  await db.end();
  console.log(
    `Import terminé : ${accounts.length} comptes, ${categories.length} catégories, ` +
      `${await prisma.transaction.count()} transactions, ${await prisma.subscription.count()} abonnements, ` +
      `${await prisma.savingsGoal.count()} objectifs, ${await prisma.budget.count()} lignes de budget.`,
  );
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
