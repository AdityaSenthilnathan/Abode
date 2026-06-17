import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { asAdmin, withUser, type DbTx } from "@/server/db/rls";
import { invoices, notifications, paymentMethods, payments, properties, units } from "@db/schema";

export function listInvoices(userId: string) {
  return withUser(userId, (tx) => tx.select().from(invoices).orderBy(desc(invoices.dueDate)));
}

export function listMyPaymentMethods(userId: string) {
  return withUser(userId, (tx) =>
    tx.select().from(paymentMethods).orderBy(desc(paymentMethods.createdAt)),
  );
}

/**
 * DEV ONLY: save a fake test card without Stripe, so the saved-card UI and the
 * pay-with-card flow are exercisable offline. Gated by the caller on devBypass()
 * + the absence of Stripe, so it never runs in production.
 */
export async function addDevPaymentMethod(userId: string) {
  return asAdmin((tx) =>
    tx.insert(paymentMethods).values({
      userId,
      type: "card",
      stripePmId: `pm_dev_${randomUUID()}`,
      brand: "Visa",
      last4: "4242",
      expMonth: 12,
      expYear: 2030,
    }),
  );
}

async function ownedInvoice(tx: DbTx, invoiceId: string, tenantId: string) {
  const [row] = await tx
    .select({ inv: invoices, ownerId: properties.ownerId })
    .from(invoices)
    .innerJoin(units, eq(units.id, invoices.unitId))
    .innerJoin(properties, eq(properties.id, units.propertyId))
    .where(and(eq(invoices.id, invoiceId), eq(units.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

/**
 * DEV ONLY: mark an invoice paid without Stripe (no saved card needed), so the
 * pay flow is demoable offline. Records a succeeded payment row and flips the
 * invoice to paid. The caller (payInvoiceAction) gates this on devBypass() and
 * the absence of Stripe, so it never runs in production.
 */
export async function payInvoiceDev(userId: string, invoiceId: string) {
  return asAdmin(async (tx) => {
    const row = await ownedInvoice(tx, invoiceId, userId);
    if (!row) throw new Error("Invoice not found");
    await tx.insert(payments).values({
      invoiceId,
      amountCents: row.inv.amountCents,
      status: "succeeded",
    });
    await tx.update(invoices).set({ status: "paid" }).where(eq(invoices.id, invoiceId));
  });
}

/** Tenant asks to defer an invoice; marks it deferred and notifies the owner. */
export async function requestPayLater(userId: string, invoiceId: string) {
  return asAdmin(async (tx) => {
    const row = await ownedInvoice(tx, invoiceId, userId);
    if (!row) throw new Error("Invoice not found");
    await tx.update(invoices).set({ status: "deferred" }).where(eq(invoices.id, invoiceId));
    await tx.insert(notifications).values({
      recipientId: row.ownerId,
      type: "info",
      title: "Pay-later requested",
      body: `A tenant asked to defer their ${row.inv.type} bill of $${(row.inv.amountCents / 100).toFixed(2)}.`,
      entityType: "invoice",
      entityId: invoiceId,
    });
  });
}
