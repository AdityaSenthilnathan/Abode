"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole } from "@/server/auth/guard";
import {
  createProperty,
  createUnit,
  deleteProperty,
  deleteUnit,
  generateEmployeeCode,
  generateTenantCode,
} from "@/server/services/onboarding";

const idSchema = z.string().uuid();

const propertySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  address: z.string().trim().min(1, "Address is required").max(240),
});

export async function createPropertyAction(formData: FormData) {
  const owner = await assertRole("owner");
  const parsed = propertySchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
  });
  if (!parsed.success) return;
  await createProperty(owner.id, {
    name: parsed.data.name,
    address: parsed.data.address,
  });
  revalidatePath("/invites");
}

const unitSchema = z.object({
  propertyId: z.string().uuid(),
  unitNumber: z.string().trim().min(1, "Unit number is required").max(40),
  // Rent in dollars; stored as integer cents per the money convention.
  rent: z.coerce.number().nonnegative().max(1_000_000),
});

export async function createUnitAction(formData: FormData) {
  const owner = await assertRole("owner");
  const parsed = unitSchema.safeParse({
    propertyId: formData.get("propertyId"),
    unitNumber: formData.get("unitNumber"),
    rent: formData.get("rent"),
  });
  if (!parsed.success) return;
  await createUnit(owner.id, {
    propertyId: parsed.data.propertyId,
    unitNumber: parsed.data.unitNumber,
    rentAmountCents: Math.round(parsed.data.rent * 100),
  });
  revalidatePath("/invites");
}

export async function deletePropertyAction(formData: FormData) {
  const owner = await assertRole("owner");
  const id = idSchema.safeParse(formData.get("propertyId"));
  if (!id.success) return;
  await deleteProperty(owner.id, id.data);
  revalidatePath("/invites");
  redirect("/invites");
}

export async function deleteUnitAction(formData: FormData) {
  const owner = await assertRole("owner");
  const id = idSchema.safeParse(formData.get("unitId"));
  if (!id.success) return;
  await deleteUnit(owner.id, id.data);
  revalidatePath("/invites");
  redirect("/invites");
}

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
