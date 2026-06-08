import "server-only";
import Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { config } from "@/server/config";
import { asAdmin } from "@/server/db/rls";
import { invoices, paymentMethods, payments, properties, units, users } from "@db/schema";

let _stripe: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (_stripe === undefined) _stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null;
  return _stripe;
}
export function stripeConfigured(): boolean {
  return Boolean(config.stripe.secretKey);
}

export async function ensureStripeCustomer(userId: string): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  return asAdmin(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!u) throw new Error("User not found");
    if (u.stripeCustomerId) return u.stripeCustomerId;
    const customer = await stripe.customers.create({
      email: u.email,
      name: u.fullName ?? undefined,
      metadata: { userId },
    });
    await tx.update(users).set({ stripeCustomerId: customer.id }).where(eq(users.id, userId));
    return customer.id;
  });
}

/** SetupIntent to save a card (PAN never touches our server). */
export async function createSetupIntent(userId: string): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const customer = await ensureStripeCustomer(userId);
  const si = await stripe.setupIntents.create({
    customer,
    usage: "off_session",
    payment_method_types: ["card"],
    metadata: { userId },
  });
  return si.client_secret;
}

export async function recordPaymentMethodFromSetupIntent(setupIntentId: string, userId: string) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const si = await stripe.setupIntents.retrieve(setupIntentId);
  const pmId = typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id;
  if (!pmId) throw new Error("No payment method on setup intent");
  const pm = await stripe.paymentMethods.retrieve(pmId);
  return asAdmin((tx) =>
    tx.insert(paymentMethods).values({
      userId,
      type: "card",
      stripePmId: pmId,
      brand: pm.card?.brand ?? null,
      last4: pm.card?.last4 ?? null,
      expMonth: pm.card?.exp_month ?? null,
      expYear: pm.card?.exp_year ?? null,
    }),
  );
}

/** Charge a saved card for an invoice. Verifies the invoice belongs to the tenant. */
export async function payInvoiceWithStripe(
  userId: string,
  invoiceId: string,
  paymentMethodDbId: string,
): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const customer = await ensureStripeCustomer(userId);
  return asAdmin(async (tx) => {
    const [row] = await tx
      .select({ inv: invoices })
      .from(invoices)
      .innerJoin(units, eq(units.id, invoices.unitId))
      .where(and(eq(invoices.id, invoiceId), eq(units.tenantId, userId)))
      .limit(1);
    if (!row) throw new Error("Invoice not found");
    const [pm] = await tx
      .select()
      .from(paymentMethods)
      .where(and(eq(paymentMethods.id, paymentMethodDbId), eq(paymentMethods.userId, userId)))
      .limit(1);
    if (!pm) throw new Error("Payment method not found");

    const pi = await stripe.paymentIntents.create({
      amount: row.inv.amountCents,
      currency: "usd",
      customer,
      payment_method: pm.stripePmId,
      off_session: true,
      confirm: true,
      metadata: { invoiceId },
    });
    if (pi.status === "succeeded") {
      await tx
        .insert(payments)
        .values({
          invoiceId,
          paymentMethodId: pm.id,
          amountCents: row.inv.amountCents,
          status: "succeeded",
          stripePaymentIntentId: pi.id,
        })
        .onConflictDoNothing();
      await tx.update(invoices).set({ status: "paid" }).where(eq(invoices.id, invoiceId));
    }
    return pi.status;
  });
}

// re-exported for the webhook handler (M5)
export { properties };
