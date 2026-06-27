import "server-only";
import { randomBytes } from "node:crypto";
import { and, count, eq, isNull } from "drizzle-orm";
import { asAdmin } from "@/server/db/rls";
import { inviteCodes, properties, propertyEmployees, units, users } from "@db/schema";
import type { Role } from "@/server/auth/session";

// Unambiguous alphabet (no 0/O/1/I/L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function genCode(): string {
  const b = randomBytes(6);
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return `ABODE-${s}`;
}

/** Create the local users row mirroring a Cognito identity. Trusted (bypasses RLS). */
export async function createUserRecord(opts: {
  cognitoSub: string;
  email: string;
  role: Role;
  fullName?: string | null;
}) {
  return asAdmin(async (tx) => {
    const [u] = await tx
      .insert(users)
      .values({
        cognitoSub: opts.cognitoSub,
        email: opts.email,
        role: opts.role,
        fullName: opts.fullName ?? null,
      })
      .returning();
    return u;
  });
}

/** Owner creates a property they own — the first step a new owner must take. */
export async function createProperty(
  ownerId: string,
  opts: { name: string; address?: string | null; lat?: number | null; lng?: number | null },
) {
  return asAdmin(async (tx) => {
    const [row] = await tx
      .insert(properties)
      .values({
        ownerId,
        name: opts.name,
        address: opts.address ?? null,
        // numeric columns take string values; keep the geocoded coords so the
        // handyman map can pin this property accurately.
        lat: opts.lat != null ? String(opts.lat) : null,
        lng: opts.lng != null ? String(opts.lng) : null,
      })
      .returning();
    return row;
  });
}

/** Owner adds a unit to a property they own. Ownership is re-checked here. */
export async function createUnit(
  ownerId: string,
  opts: { propertyId: string; unitNumber: string; rentAmountCents?: number | null },
) {
  return asAdmin(async (tx) => {
    const [owned] = await tx
      .select({ id: properties.id })
      .from(properties)
      .where(and(eq(properties.id, opts.propertyId), eq(properties.ownerId, ownerId)))
      .limit(1);
    if (!owned) throw new Error("Property not found");
    const [row] = await tx
      .insert(units)
      .values({
        propertyId: opts.propertyId,
        unitNumber: opts.unitNumber,
        rentAmountCents: opts.rentAmountCents ?? null,
      })
      .returning();
    return row;
  });
}

/** Load a property the owner owns, with a unit count, for the delete-confirm screen. */
export async function getOwnedProperty(ownerId: string, propertyId: string) {
  return asAdmin(async (tx) => {
    const [prop] = await tx
      .select()
      .from(properties)
      .where(and(eq(properties.id, propertyId), eq(properties.ownerId, ownerId)))
      .limit(1);
    if (!prop) return null;
    const [u] = await tx.select({ n: count() }).from(units).where(eq(units.propertyId, propertyId));
    return { property: prop, unitCount: Number(u?.n ?? 0) };
  });
}

/** Delete a property the owner owns. Cascades to its units, invoices, requests, codes. */
export async function deleteProperty(ownerId: string, propertyId: string) {
  return asAdmin(async (tx) => {
    const deleted = await tx
      .delete(properties)
      .where(and(eq(properties.id, propertyId), eq(properties.ownerId, ownerId)))
      .returning({ id: properties.id });
    if (deleted.length === 0) throw new Error("Property not found");
  });
}

/** Load a unit the owner owns (via its property), for the delete-confirm screen. */
export async function getOwnedUnit(ownerId: string, unitId: string) {
  return asAdmin(async (tx) => {
    const [row] = await tx
      .select({ unit: units, propertyName: properties.name, ownerId: properties.ownerId })
      .from(units)
      .innerJoin(properties, eq(properties.id, units.propertyId))
      .where(eq(units.id, unitId))
      .limit(1);
    if (!row || row.ownerId !== ownerId) return null;
    return { unit: row.unit, propertyName: row.propertyName };
  });
}

/** Delete a unit the owner owns. Cascades to its invoices, requests, and codes. */
export async function deleteUnit(ownerId: string, unitId: string) {
  return asAdmin(async (tx) => {
    const [row] = await tx
      .select({ id: units.id, ownerId: properties.ownerId })
      .from(units)
      .innerJoin(properties, eq(properties.id, units.propertyId))
      .where(eq(units.id, unitId))
      .limit(1);
    if (!row || row.ownerId !== ownerId) throw new Error("Unit not found");
    await tx.delete(units).where(eq(units.id, unitId));
  });
}

/** PM generates a one-time code tying a vacant unit they own to a future tenant. */
export async function generateTenantCode(ownerId: string, unitId: string) {
  return asAdmin(async (tx) => {
    const [owned] = await tx
      .select({ id: units.id })
      .from(units)
      .innerJoin(properties, eq(properties.id, units.propertyId))
      .where(and(eq(units.id, unitId), eq(properties.ownerId, ownerId)))
      .limit(1);
    if (!owned) throw new Error("Unit not found");
    const [row] = await tx
      .insert(inviteCodes)
      .values({ code: genCode(), kind: "tenant", ownerId, unitId })
      .returning();
    return row;
  });
}

/** PM generates a code linking a future employee to a property they own. */
export async function generateEmployeeCode(ownerId: string, propertyId: string) {
  return asAdmin(async (tx) => {
    const [owned] = await tx
      .select({ id: properties.id })
      .from(properties)
      .where(and(eq(properties.id, propertyId), eq(properties.ownerId, ownerId)))
      .limit(1);
    if (!owned) throw new Error("Property not found");
    const [row] = await tx
      .insert(inviteCodes)
      .values({ code: genCode(), kind: "employee", ownerId, propertyId })
      .returning();
    return row;
  });
}

/** Validate a code exists and is unredeemed, before we create the Cognito user. */
export async function assertCodeValid(code: string, kind: "tenant" | "employee") {
  return asAdmin(async (tx) => {
    const [inv] = await tx
      .select()
      .from(inviteCodes)
      .where(and(eq(inviteCodes.code, code), eq(inviteCodes.kind, kind), isNull(inviteCodes.redeemedAt)))
      .limit(1);
    if (!inv)
      throw new Error(kind === "tenant" ? "Invalid or already-used unit code" : "Invalid or already-used employer code");
    // The code must point at the thing it'll attach to, or redemption fails *after*
    // we've already created the account — leaving an orphan user. Reject up front.
    if (kind === "tenant" && !inv.unitId) throw new Error("This unit code isn't linked to a unit. Ask your manager for a new one.");
    if (kind === "employee" && !inv.propertyId)
      throw new Error("This employer code isn't linked to a property. Ask your manager for a new one.");
    return inv;
  });
}

/** Tenant redeems a unit code → occupies the unit. */
export async function redeemTenantCode(code: string, userId: string) {
  return asAdmin(async (tx) => {
    const [inv] = await tx
      .select()
      .from(inviteCodes)
      .where(and(eq(inviteCodes.code, code), eq(inviteCodes.kind, "tenant"), isNull(inviteCodes.redeemedAt)))
      .limit(1);
    if (!inv || !inv.unitId) throw new Error("Invalid or already-used unit code");
    await tx.update(units).set({ tenantId: userId, status: "occupied" }).where(eq(units.id, inv.unitId));
    await tx.update(inviteCodes).set({ redeemedBy: userId, redeemedAt: new Date() }).where(eq(inviteCodes.id, inv.id));
    return inv;
  });
}

/**
 * Employee redeems an employer code → linked to the property. A worker can hold
 * links to many properties (across many managers) at once — the join is
 * many-to-many and the insert is idempotent, so redeeming again is harmless.
 * Returns the invite plus the property's name for a friendly confirmation.
 */
export async function redeemEmployeeCode(code: string, userId: string) {
  return asAdmin(async (tx) => {
    const [inv] = await tx
      .select()
      .from(inviteCodes)
      .where(and(eq(inviteCodes.code, code), eq(inviteCodes.kind, "employee"), isNull(inviteCodes.redeemedAt)))
      .limit(1);
    if (!inv || !inv.propertyId) throw new Error("Invalid or already-used employer code");
    await tx
      .insert(propertyEmployees)
      .values({ propertyId: inv.propertyId, employeeId: userId })
      .onConflictDoNothing();
    await tx.update(inviteCodes).set({ redeemedBy: userId, redeemedAt: new Date() }).where(eq(inviteCodes.id, inv.id));
    const [prop] = await tx.select({ name: properties.name }).from(properties).where(eq(properties.id, inv.propertyId)).limit(1);
    return { ...inv, propertyName: prop?.name ?? null };
  });
}

/** Properties this worker is currently linked to, with the owning manager's name. */
export async function listEmployeeProperties(employeeId: string) {
  return asAdmin((tx) =>
    tx
      .select({
        propertyId: properties.id,
        name: properties.name,
        address: properties.address,
        ownerId: properties.ownerId,
        ownerName: users.fullName,
        ownerEmail: users.email,
        jobCount: propertyEmployees.jobCount,
      })
      .from(propertyEmployees)
      .innerJoin(properties, eq(properties.id, propertyEmployees.propertyId))
      .leftJoin(users, eq(users.id, properties.ownerId))
      .where(eq(propertyEmployees.employeeId, employeeId))
      .orderBy(properties.name),
  );
}
