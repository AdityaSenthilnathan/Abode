"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole } from "@/server/auth/guard";
import { geocodeAddress, mapboxToken } from "@/server/services/geocode";
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
  // Coordinates the client captured from a verified Mapbox suggestion. Optional
  // here because we re-verify server-side; they're a hint, not the source of truth.
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export type CreatePropertyState = { ok: boolean; error?: string };

export async function createPropertyAction(
  _prev: CreatePropertyState,
  formData: FormData,
): Promise<CreatePropertyState> {
  const owner = await assertRole("owner");
  const parsed = propertySchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
    lat: formData.get("lat") || undefined,
    lng: formData.get("lng") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Enter a property name and address." };

  let { address, lat, lng } = parsed.data;

  // When Mapbox is configured, the address must resolve to a real location —
  // this is the hard gate: no existing place, no property. We re-geocode here
  // (rather than trusting the client's coords) and store Mapbox's canonical
  // address + coordinates so the handyman map pins it correctly later.
  if (mapboxToken()) {
    const geo = await geocodeAddress(address);
    if (!geo) {
      return {
        ok: false,
        error: "We couldn't find that address on the map. Pick a suggestion or check the street, city, and state.",
      };
    }
    address = geo.formattedAddress;
    lat = geo.lat;
    lng = geo.lng;
  }

  await createProperty(owner.id, { name: parsed.data.name, address, lat, lng });
  revalidatePath("/properties");
  revalidatePath("/dashboard");
  revalidatePath("/invites");
  return { ok: true };
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
  revalidatePath("/properties");
  revalidatePath("/dashboard");
  revalidatePath("/invites");
}

export async function deletePropertyAction(formData: FormData) {
  const owner = await assertRole("owner");
  const id = idSchema.safeParse(formData.get("propertyId"));
  if (!id.success) return;
  await deleteProperty(owner.id, id.data);
  revalidatePath("/properties");
  revalidatePath("/dashboard");
  revalidatePath("/invites");
  redirect("/properties");
}

export async function deleteUnitAction(formData: FormData) {
  const owner = await assertRole("owner");
  const id = idSchema.safeParse(formData.get("unitId"));
  if (!id.success) return;
  await deleteUnit(owner.id, id.data);
  revalidatePath("/properties");
  revalidatePath("/dashboard");
  revalidatePath("/invites");
  redirect("/properties");
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
