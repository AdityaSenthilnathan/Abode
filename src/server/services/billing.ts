import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { asAdmin, withUser, type DbTx } from "@/server/db/rls";
import { invoices, notifications, paymentMethods, payments, properties, units, users } from "@db/schema";

const PAYABLE = ["unpaid", "late", "deferred"] as const;

export function listInvoices(userId: string) {
  return withUser(userId, (tx) => tx.select().from(invoices).orderBy(desc(invoices.dueDate)));
}

export function listMyPaymentMethods(userId: string) {
  return withUser(userId, (tx) =>
    tx.select().from(paymentMethods).orderBy(desc(paymentMethods.createdAt)),
  );
}

export interface SimulatedCard {
  brand?: string | null;
  last4?: string | null;
  expMonth?: number | null;
  expYear?: number | null;
}

/**
 * Save a simulated card without Stripe, so the saved-card UI and the
 * pay-with-card flow are exercisable in the demo. We persist only the
 * non-sensitive bits the tenant typed (brand / last4 / expiry) — never a real
 * PAN or CVC — under a synthetic `pm_sim_*` id. Gated by the caller on
 * simulatePayments(), so it never runs once real Stripe keys exist.
 */
export async function addSimulatedPaymentMethod(userId: string, card: SimulatedCard = {}) {
  return asAdmin((tx) =>
    tx.insert(paymentMethods).values({
      userId,
      type: "card",
      stripePmId: `pm_sim_${randomUUID()}`,
      brand: card.brand ?? "Visa",
      last4: card.last4 ?? "4242",
      expMonth: card.expMonth ?? 12,
      expYear: card.expYear ?? 2030,
    }),
  );
}

/**
 * Demo helper: drop a fresh unpaid invoice onto the tenant's unit so the pay /
 * request-to-pay-later flows are easy to exercise. Random utility-ish type and
 * amount so repeated clicks make distinct rows. Gated by the caller on
 * simulatePayments(), so it never runs once real Stripe keys exist.
 */
/** Today + leadDays as a YYYY-MM-DD cutoff (inclusive) — the autopay charge window. */
function chargeCutoff(leadDays: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + Math.max(0, leadDays));
  return d.toISOString().slice(0, 10);
}

/**
 * Autopay charge pass (simulated): settle every outstanding invoice that has
 * reached its charge window — due on/before today + leadDays. Invoices further
 * out are left untouched until their window arrives.
 */
async function autopayChargeWithin(tx: DbTx, userId: string, leadDays: number, cardId: string) {
  const cutoff = chargeCutoff(leadDays);
  const rows = await tx
    .select({ id: invoices.id, amountCents: invoices.amountCents, dueDate: invoices.dueDate })
    .from(invoices)
    .innerJoin(units, eq(units.id, invoices.unitId))
    .where(and(eq(units.tenantId, userId), inArray(invoices.status, [...PAYABLE])));
  const due = rows.filter((r) => r.dueDate <= cutoff);
  if (due.length === 0) return;
  await tx.insert(payments).values(
    due.map((r) => ({
      invoiceId: r.id,
      amountCents: r.amountCents,
      status: "succeeded" as const,
      paymentMethodId: cardId,
    })),
  );
  await tx.update(invoices).set({ status: "paid" }).where(
    inArray(
      invoices.id,
      due.map((r) => r.id),
    ),
  );
}

const TEST_INVOICE_TYPES = ["water", "power", "other"] as const;
export async function addTestInvoice(userId: string) {
  return asAdmin(async (tx) => {
    const [unit] = await tx
      .select({ id: units.id })
      .from(units)
      .where(eq(units.tenantId, userId))
      .limit(1);
    if (!unit) throw new Error("No unit assigned");
    const type = TEST_INVOICE_TYPES[Math.floor(Math.random() * TEST_INVOICE_TYPES.length)];
    const amountCents = (5 + Math.floor(Math.random() * 40)) * 500; // $25–$220, $5 steps
    const dueDate = new Date().toISOString().slice(0, 10);
    const [u] = await tx
      .select({ autopay: users.autopayEnabled, lead: users.autopayLeadDays })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const [card] = await tx
      .select({ id: paymentMethods.id })
      .from(paymentMethods)
      .where(eq(paymentMethods.userId, userId))
      .limit(1);
    // Autopay settles it on arrival only if it's already within the charge window.
    const autopaid = Boolean(u?.autopay && card && dueDate <= chargeCutoff(u?.lead ?? 0));
    const [inv] = await tx
      .insert(invoices)
      .values({
        unitId: unit.id,
        type,
        amountCents,
        dueDate,
        status: autopaid ? "paid" : "unpaid",
        description: "Test charge",
      })
      .returning({ id: invoices.id });
    if (autopaid) {
      await tx.insert(payments).values({
        invoiceId: inv.id,
        amountCents,
        status: "succeeded",
        paymentMethodId: card!.id,
      });
    }
  });
}

export interface AutopaySettings {
  enabled: boolean;
  leadDays: number;
}

/** The tenant's autopay settings: on/off + how many days before the due date to charge. */
export async function getAutopaySettings(userId: string): Promise<AutopaySettings> {
  return asAdmin(async (tx) => {
    const [u] = await tx
      .select({ enabled: users.autopayEnabled, leadDays: users.autopayLeadDays })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return { enabled: u?.enabled ?? false, leadDays: u?.leadDays ?? 0 };
  });
}

/** Past payments (receipts) for the tenant, newest first. */
export async function listPaymentHistory(userId: string) {
  return asAdmin((tx) =>
    tx
      .select({
        id: payments.id,
        amountCents: payments.amountCents,
        paidAt: payments.paidAt,
        status: payments.status,
        invoiceType: invoices.type,
        invoiceDescription: invoices.description,
        brand: paymentMethods.brand,
        last4: paymentMethods.last4,
      })
      .from(payments)
      .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
      .innerJoin(units, eq(units.id, invoices.unitId))
      .leftJoin(paymentMethods, eq(paymentMethods.id, payments.paymentMethodId))
      .where(eq(units.tenantId, userId))
      .orderBy(desc(payments.paidAt)),
  );
}

/**
 * Pay every outstanding invoice on the tenant's unit in one shot (simulated).
 * Records succeeded payments and flips the invoices to paid. Returns the count.
 */
export async function payAllPayableSimulated(userId: string, paymentMethodId?: string | null): Promise<number> {
  return asAdmin(async (tx) => {
    const rows = await tx
      .select({ id: invoices.id, amountCents: invoices.amountCents })
      .from(invoices)
      .innerJoin(units, eq(units.id, invoices.unitId))
      .where(and(eq(units.tenantId, userId), inArray(invoices.status, [...PAYABLE])));
    if (rows.length === 0) return 0;
    await tx.insert(payments).values(
      rows.map((r) => ({
        invoiceId: r.id,
        amountCents: r.amountCents,
        status: "succeeded" as const,
        paymentMethodId: paymentMethodId ?? null,
      })),
    );
    await tx.update(invoices).set({ status: "paid" }).where(
      inArray(
        invoices.id,
        rows.map((r) => r.id),
      ),
    );
    return rows.length;
  });
}

/**
 * Turn autopay on/off. When turning on with a card on file, settle anything
 * already within the charge window right away. Simulated — caller gates on
 * simulatePayments().
 */
export async function setAutopay(userId: string, enabled: boolean) {
  return asAdmin(async (tx) => {
    await tx.update(users).set({ autopayEnabled: enabled }).where(eq(users.id, userId));
    if (!enabled) return;
    const [u] = await tx
      .select({ lead: users.autopayLeadDays })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const [card] = await tx
      .select({ id: paymentMethods.id })
      .from(paymentMethods)
      .where(eq(paymentMethods.userId, userId))
      .limit(1);
    if (card) await autopayChargeWithin(tx, userId, u?.lead ?? 0, card.id);
  });
}

/** Set how many days before the due date autopay charges, then re-run the pass. */
export async function setAutopayLeadDays(userId: string, leadDays: number) {
  const days = Math.max(0, Math.min(60, Math.round(leadDays) || 0));
  return asAdmin(async (tx) => {
    await tx.update(users).set({ autopayLeadDays: days }).where(eq(users.id, userId));
    const [u] = await tx
      .select({ enabled: users.autopayEnabled })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!u?.enabled) return;
    const [card] = await tx
      .select({ id: paymentMethods.id })
      .from(paymentMethods)
      .where(eq(paymentMethods.userId, userId))
      .limit(1);
    if (card) await autopayChargeWithin(tx, userId, days, card.id);
  });
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
 * Mark an invoice paid without Stripe (no saved card needed), so the pay flow is
 * demoable. Records a succeeded payment row and flips the invoice to paid. The
 * caller (payInvoiceAction) gates this on simulatePayments(), so it never runs
 * once real Stripe keys exist.
 */
export async function payInvoiceSimulated(userId: string, invoiceId: string) {
  return asAdmin(async (tx) => {
    const row = await ownedInvoice(tx, invoiceId, userId);
    if (!row) throw new Error("Invoice not found");
    const [card] = await tx
      .select({ id: paymentMethods.id })
      .from(paymentMethods)
      .where(eq(paymentMethods.userId, userId))
      .limit(1);
    await tx.insert(payments).values({
      invoiceId,
      amountCents: row.inv.amountCents,
      status: "succeeded",
      paymentMethodId: card?.id ?? null,
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
