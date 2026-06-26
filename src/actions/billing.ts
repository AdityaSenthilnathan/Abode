"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertRole } from "@/server/auth/guard";
import { simulatePayments } from "@/server/config";
import {
  addSimulatedPaymentMethod,
  addTestInvoice,
  listMyPaymentMethods,
  payAllPayableSimulated,
  payInvoiceSimulated,
  requestPayLater,
  setAutopay,
  setAutopayLeadDays,
} from "@/server/services/billing";
import { getOrCreateOwnerConversation } from "@/server/services/messaging";
import {
  createSetupIntent,
  payInvoiceWithStripe,
  recordPaymentMethodFromSetupIntent,
  stripeConfigured,
} from "@/server/stripe";

/**
 * Tenant requests to pay an invoice later. Records the request (marks it
 * deferred + notifies the owner), then drops the tenant into the owner chat
 * with a prewritten, editable draft they send themselves — instead of the old
 * one-click "Pay later" that silently deferred with no conversation.
 */
export async function requestPayLaterAction(formData: FormData) {
  const user = await assertRole("tenant");
  const invoiceId = String(formData.get("invoiceId"));
  const draft =
    String(formData.get("draft") ?? "").trim() ||
    "Hi! Would it be possible to pay this invoice in the next cycle?";
  await requestPayLater(user.id, invoiceId);
  let conversationId: string | null = null;
  try {
    conversationId = await getOrCreateOwnerConversation(user.id);
  } catch {
    // No owner on file — fall back to the inbox.
  }
  revalidatePath("/dues");
  redirect(conversationId ? `/messages/${conversationId}?draft=${encodeURIComponent(draft)}` : "/messages");
}

const simCardSchema = z.object({
  brand: z.string().trim().min(1).max(20).optional(),
  last4: z.string().regex(/^\d{4}$/, "last4 must be 4 digits").optional(),
  expMonth: z.coerce.number().int().min(1).max(12).optional(),
  expYear: z.coerce.number().int().min(2000).max(2100).optional(),
});
export type SimCardInput = z.infer<typeof simCardSchema>;

/**
 * Simulated (no-Stripe) add-card for the demo. Persists only the brand/last4/
 * expiry the tenant typed — never a PAN or CVC. No-ops once real Stripe keys are
 * configured (simulatePayments() turns off).
 */
export async function addSimulatedCardAction(input: SimCardInput) {
  const user = await assertRole("tenant");
  if (!simulatePayments()) return;
  const card = simCardSchema.parse(input ?? {});
  await addSimulatedPaymentMethod(user.id, card);
  revalidatePath("/dues");
}

/** Demo-only: add a test invoice to the tenant's unit so dues flows are testable. */
export async function addTestInvoiceAction() {
  const user = await assertRole("tenant");
  if (!simulatePayments()) return;
  await addTestInvoice(user.id);
  revalidatePath("/dues");
  revalidatePath("/home");
}

/** Pay every outstanding invoice at once. */
export async function payAllAction() {
  const user = await assertRole("tenant");
  if (!simulatePayments()) return; // demo path; per-invoice Pay covers real Stripe
  const [method] = await listMyPaymentMethods(user.id);
  await payAllPayableSimulated(user.id, method?.id ?? null);
  revalidatePath("/dues");
  revalidatePath("/home");
}

/** Turn automatic payments on/off for the tenant. */
export async function setAutopayAction(enabled: boolean) {
  const user = await assertRole("tenant");
  if (!simulatePayments()) return;
  await setAutopay(user.id, Boolean(enabled));
  revalidatePath("/dues");
  revalidatePath("/home");
}

/** Set how many days before the due date autopay charges (0 = on the due date). */
export async function setAutopayLeadDaysAction(days: number) {
  const user = await assertRole("tenant");
  if (!simulatePayments()) return;
  await setAutopayLeadDays(user.id, Number(days) || 0);
  revalidatePath("/dues");
  revalidatePath("/home");
}

export async function createSetupIntentAction(): Promise<string | null> {
  const user = await assertRole("tenant");
  if (!stripeConfigured()) return null;
  return createSetupIntent(user.id);
}

export async function confirmCardAction(setupIntentId: string) {
  const user = await assertRole("tenant");
  await recordPaymentMethodFromSetupIntent(setupIntentId, user.id);
  revalidatePath("/dues");
}

export async function payInvoiceAction(formData: FormData) {
  const user = await assertRole("tenant");
  const invoiceId = String(formData.get("invoiceId"));
  if (stripeConfigured()) {
    await payInvoiceWithStripe(user.id, invoiceId, String(formData.get("paymentMethodId")));
  } else if (simulatePayments()) {
    // No Stripe → record the payment directly so the flow is demoable.
    await payInvoiceSimulated(user.id, invoiceId);
  } else {
    return; // no Stripe and not a demo box — nothing we can charge
  }
  revalidatePath("/dues");
}
