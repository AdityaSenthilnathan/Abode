import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
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

/** Employee redeems an employer code → linked to the property. */
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
    return inv;
  });
}
