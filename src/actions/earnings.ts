"use server";
import { revalidatePath } from "next/cache";
import { assertRole } from "@/server/auth/guard";
import { addPayoutCard } from "@/server/services/earnings";

/** Card-network guess from the leading digits (display only — no real processing). */
function brandFromNumber(digits: string): string {
  if (/^4/.test(digits)) return "Visa";
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "Amex";
  if (/^6/.test(digits)) return "Discover";
  return "Card";
}

export async function addPayoutCardAction(formData: FormData) {
  const u = await assertRole("employee");
  const digits = String(formData.get("number") ?? "").replace(/\D/g, "");
  const exp = String(formData.get("exp") ?? ""); // MM/YY
  if (digits.length < 4) return;
  const [mm, yy] = exp.split("/").map((s) => s.trim());
  const expMonth = Number(mm) || 1;
  const expYear = yy ? 2000 + Number(yy) : new Date().getFullYear() + 3;
  await addPayoutCard(u.id, {
    brand: brandFromNumber(digits),
    last4: digits.slice(-4),
    expMonth,
    expYear,
  });
  revalidatePath("/earnings");
}
