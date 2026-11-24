// Lecture d'une entité sérialisée : partagé entre les route handlers
// (/api/...) et les pages serveur d'édition (appel direct, sans HTTP).
import { prisma } from "./prisma";
import {
  budgetInclude, subInclude, txInclude,
  serializeAccount, serializeBudget, serializeCategory,
  serializeSubscription, serializeTransaction,
} from "./serialize";
import { withProgress } from "./savings";

export async function getAccountJson(id: number) {
  const a = await prisma.account.findUnique({ where: { id } });
  return a ? serializeAccount(a) : null;
}

export async function getCategoryJson(id: number) {
  const c = await prisma.category.findUnique({ where: { id } });
  return c ? serializeCategory(c) : null;
}

export async function getTransactionJson(id: number) {
  const t = await prisma.transaction.findUnique({ where: { id }, include: txInclude });
  return t ? serializeTransaction(t) : null;
}

export async function getSubscriptionJson(id: number) {
  const s = await prisma.subscription.findUnique({ where: { id }, include: subInclude });
  return s ? serializeSubscription(s) : null;
}

export async function getBudgetJson(id: number) {
  const b = await prisma.budget.findUnique({ where: { id }, include: budgetInclude });
  return b ? serializeBudget(b) : null;
}

export async function getSavingsGoalJson(id: number) {
  const exists = await prisma.savingsGoal.findUnique({ where: { id }, select: { id: true }, });
  return exists ? withProgress(id) : null;
}

