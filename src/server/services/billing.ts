import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { asAdmin, withUser, type DbTx } from "@/server/db/rls";
import { invoices, notifications, paymentMethods, properties, units } from "@db/schema";

export function listInvoices(userId: string) {
  return withUser(userId, (tx) => tx.select().from(invoices).orderBy(desc(invoices.dueDate)));
}

export function listMyPaymentMethods(userId: string) {
  return withUser(userId, (tx) =>
    tx.select().from(paymentMethods).orderBy(desc(paymentMethods.createdAt)),
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
