"use server";
import { revalidatePath } from "next/cache";
import { assertRole } from "@/server/auth/guard";
import { generateEmployeeCode, generateTenantCode } from "@/server/services/onboarding";

export async function generateTenantCodeAction(formData: FormData) {
  const owner = await assertRole("owner");
  const unitId = String(formData.get("unitId"));
  await generateTenantCode(owner.id, unitId);
  revalidatePath("/invites");
}

export async function generateEmployeeCodeAction(formData: FormData) {
  const owner = await assertRole("owner");
  const propertyId = String(formData.get("propertyId"));
  await generateEmployeeCode(owner.id, propertyId);
  revalidatePath("/invites");
}
