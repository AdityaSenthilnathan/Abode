"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "@/server/auth/guard";
import { assertCodeValid, redeemEmployeeCode } from "@/server/services/onboarding";

export type JoinPropertyState = { ok: boolean; error?: string; propertyName?: string };

const codeSchema = z.object({ code: z.string().trim().min(1, "Enter the code from your manager") });

/**
 * A logged-in worker joins another property by redeeming an employer code. This
 * is the same code an owner generates per property; redeeming several lets one
 * worker serve multiple apartments and multiple managers. Idempotent — a code
 * already redeemed for this worker just no-ops at the DB level.
 */
export async function joinPropertyAction(
  _prev: JoinPropertyState,
  formData: FormData,
): Promise<JoinPropertyState> {
  const u = await assertRole("employee");
  const parsed = codeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const code = parsed.data.code.toUpperCase();
  try {
    await assertCodeValid(code, "employee");
    const inv = await redeemEmployeeCode(code, u.id);
    // New property → new map pins + job feed once work is assigned.
    revalidatePath("/jobs");
    revalidatePath("/map");
    return { ok: true, propertyName: inv.propertyName ?? undefined };
  } catch (e) {
    const msg = (e as Error)?.message;
    return { ok: false, error: msg && msg.length < 160 ? msg : "Couldn't join with that code." };
  }
}
