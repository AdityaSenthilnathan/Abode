"use server";
import { revalidatePath } from "next/cache";
import { assertRole } from "@/server/auth/guard";
import { requestPayLater } from "@/server/services/billing";
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
  if (!stripeConfigured()) return;
  await payInvoiceWithStripe(
    user.id,
    String(formData.get("invoiceId")),
    String(formData.get("paymentMethodId")),
  );
  revalidatePath("/dues");
}
