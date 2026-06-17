"use server";
import { revalidatePath } from "next/cache";
import { assertRole } from "@/server/auth/guard";
import { devBypass } from "@/server/config";
import { addDevPaymentMethod, payInvoiceDev, requestPayLater } from "@/server/services/billing";
import {
  createSetupIntent,
  payInvoiceWithStripe,
  recordPaymentMethodFromSetupIntent,
  stripeConfigured,
} from "@/server/stripe";

export async function payLaterAction(formData: FormData) {
  const user = await assertRole("tenant");
  await requestPayLater(user.id, String(formData.get("invoiceId")));
  revalidatePath("/dues");
}

/** DEV ONLY: add a fake saved card when Stripe isn't configured locally. */
export async function addDevCardAction() {
  const user = await assertRole("tenant");
  if (stripeConfigured() || !devBypass()) return;
  await addDevPaymentMethod(user.id);
  revalidatePath("/dues");
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
  } else if (devBypass()) {
    // No Stripe locally → record the payment directly so the flow is demoable.
    await payInvoiceDev(user.id, invoiceId);
  } else {
    return; // no Stripe and not a dev box — nothing we can charge
  }
  revalidatePath("/dues");
}
