import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { asAdmin, withUser } from "@/server/db/rls";
import { paymentMethods, properties, tasks } from "@db/schema";

export interface Earning {
  taskId: string;
  title: string | null;
  propertyName: string;
  amountCents: number;
  /** ISO string of when the job was signed off. */
  completedAt: string;
}

/** Completed, paid-out jobs for a handyman — the basis for the earnings dashboard. */
export async function listCompletedEarnings(handymanId: string): Promise<Earning[]> {
  return withUser(handymanId, async (tx) => {
    const rows = await tx
      .select({
        taskId: tasks.id,
        title: tasks.title,
        propertyName: properties.name,
        amountCents: tasks.finalCostCents,
        completedAt: tasks.completedAt,
      })
      .from(tasks)
      .innerJoin(properties, eq(properties.id, tasks.propertyId))
      .where(
        and(
          eq(tasks.assignedTo, handymanId),
          eq(tasks.status, "done"),
          isNotNull(tasks.finalCostCents),
          isNotNull(tasks.completedAt),
        ),
      )
      .orderBy(desc(tasks.completedAt));
    return rows.map((r) => ({
      taskId: r.taskId,
      title: r.title,
      propertyName: r.propertyName,
      amountCents: r.amountCents ?? 0,
      completedAt: (r.completedAt as Date).toISOString(),
    }));
  });
}

export interface PayoutCard {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}

/** The handyman's saved payout card (most recent), if any. */
export async function getPayoutCard(handymanId: string): Promise<PayoutCard | null> {
  return withUser(handymanId, async (tx) => {
    const [pm] = await tx
      .select({ brand: paymentMethods.brand, last4: paymentMethods.last4, expMonth: paymentMethods.expMonth, expYear: paymentMethods.expYear })
      .from(paymentMethods)
      .where(eq(paymentMethods.userId, handymanId))
      .orderBy(desc(paymentMethods.createdAt))
      .limit(1);
    return pm ?? null;
  });
}

/**
 * DEV ONLY: save a payout card without Stripe. Captures the entered brand/last4/
 * expiry so the saved-card UI is exercisable offline; real Stripe slots in later.
 */
export async function addPayoutCard(
  handymanId: string,
  card: { brand: string; last4: string; expMonth: number; expYear: number },
) {
  return asAdmin(async (tx) => {
    await tx.update(paymentMethods).set({ isDefault: false }).where(eq(paymentMethods.userId, handymanId));
    await tx.insert(paymentMethods).values({
      userId: handymanId,
      type: "card",
      stripePmId: `pm_dev_${randomUUID()}`,
      brand: card.brand,
      last4: card.last4,
      expMonth: card.expMonth,
      expYear: card.expYear,
      isDefault: true,
    });
  });
}
