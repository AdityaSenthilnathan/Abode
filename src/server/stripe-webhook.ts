import "server-only";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { asAdmin } from "@/server/db/rls";
import { invoices, notifications, paymentMethods, payments, units } from "@db/schema";
import { getStripe } from "./stripe";

/**
 * Webhook is the source of truth for payment state. All handlers are idempotent
 * (Stripe retries and can deliver out of order).
 */
export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "setup_intent.succeeded":
      await savePaymentMethod(event.data.object as Stripe.SetupIntent);
      break;
    case "payment_intent.succeeded":
      await markInvoicePaid(event.data.object as Stripe.PaymentIntent);
      break;
    case "payment_intent.payment_failed":
      await notifyFailure(event.data.object as Stripe.PaymentIntent);
      break;
    default:
      break;
  }
}

async function savePaymentMethod(si: Stripe.SetupIntent) {
  const userId = si.metadata?.userId;
  const pmId = typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id;
  if (!userId || !pmId) return;
  const stripe = getStripe();
  if (!stripe) return;
  const pm = await stripe.paymentMethods.retrieve(pmId);
  await asAdmin(async (tx) => {
    const exists = await tx
      .select({ id: paymentMethods.id })
      .from(paymentMethods)
      .where(eq(paymentMethods.stripePmId, pmId))
      .limit(1);
    if (exists.length) return;
    await tx.insert(paymentMethods).values({
      userId,
      type: "card",
      stripePmId: pmId,
      brand: pm.card?.brand ?? null,
      last4: pm.card?.last4 ?? null,
      expMonth: pm.card?.exp_month ?? null,
      expYear: pm.card?.exp_year ?? null,
    });
  });
}

async function markInvoicePaid(pi: Stripe.PaymentIntent) {
  const invoiceId = pi.metadata?.invoiceId;
  if (!invoiceId) return;
  await asAdmin(async (tx) => {
    const dup = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.stripePaymentIntentId, pi.id))
      .limit(1);
    if (dup.length) return;
    await tx
      .insert(payments)
      .values({
        invoiceId,
        amountCents: pi.amount_received || pi.amount,
        status: "succeeded",
        stripePaymentIntentId: pi.id,
      })
      .onConflictDoNothing();
    await tx.update(invoices).set({ status: "paid" }).where(eq(invoices.id, invoiceId));
  });
}

async function notifyFailure(pi: Stripe.PaymentIntent) {
  const invoiceId = pi.metadata?.invoiceId;
  if (!invoiceId) return;
  await asAdmin(async (tx) => {
    const [row] = await tx
      .select({ tenantId: units.tenantId })
      .from(invoices)
      .innerJoin(units, eq(units.id, invoices.unitId))
      .where(eq(invoices.id, invoiceId))
      .limit(1);
    if (row?.tenantId) {
      await tx.insert(notifications).values({
        recipientId: row.tenantId,
        type: "urgent",
        title: "Payment failed",
        body: "Your payment didn't go through — please try another card.",
        entityType: "invoice",
        entityId: invoiceId,
      });
    }
  });
}
