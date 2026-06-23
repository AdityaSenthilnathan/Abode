import "server-only";
import { eq } from "drizzle-orm";
import { asAdmin, withUser } from "@/server/db/rls";
import { invoices, properties, propertyEmployees, units, users } from "@db/schema";

export interface TenantContact {
  id: string;
  fullName: string | null;
  email: string;
}

export interface TenantAccount {
  unit: { unitNumber: string; rentAmountCents: number | null; status: string };
  property: { name: string; address: string | null };
  /** The tenant's property manager (owner of the property). */
  manager: TenantContact | null;
  /** Maintenance staff assigned to the tenant's property. */
  maintenance: TenantContact[];
  /** Outstanding balance across unpaid/late invoices, in cents. */
  balanceCents: number;
}

/**
 * Everything a tenant sees on their account page: their home (unit + property),
 * lease basics, current balance, and who to contact (property manager + the
 * maintenance staff on their property).
 *
 * Ownership is enforced by RLS: the unit/property/invoice selects run as the
 * tenant, so they can only ever resolve the tenant's *own* home. The manager +
 * maintenance lookup then runs via asAdmin because tenants can't read other
 * `users` / `property_employees` rows under RLS — safe here because we only
 * reach it after RLS confirmed this property belongs to the tenant (same shape
 * as `requestDetail()` in services/requests.ts).
 */
export async function getTenantAccount(userId: string): Promise<TenantAccount | null> {
  const base = await withUser(userId, async (tx) => {
    const [unit] = await tx.select().from(units).limit(1); // RLS → tenant's own unit
    if (!unit) return null;
    const [property] = await tx
      .select({
        id: properties.id,
        name: properties.name,
        address: properties.address,
        ownerId: properties.ownerId,
      })
      .from(properties)
      .where(eq(properties.id, unit.propertyId))
      .limit(1);
    if (!property) return null;
    const inv = await tx
      .select({ amountCents: invoices.amountCents, status: invoices.status })
      .from(invoices);
    const balanceCents = inv
      .filter((i) => i.status === "unpaid" || i.status === "late")
      .reduce((sum, i) => sum + i.amountCents, 0);
    return { unit, property, balanceCents };
  });
  if (!base) return null;

  const { unit, property, balanceCents } = base;

  const directory = await asAdmin(async (tx) => {
    const [manager] = await tx
      .select({ id: users.id, fullName: users.fullName, email: users.email })
      .from(users)
      .where(eq(users.id, property.ownerId))
      .limit(1);
    const maintenance = await tx
      .select({ id: users.id, fullName: users.fullName, email: users.email })
      .from(propertyEmployees)
      .innerJoin(users, eq(users.id, propertyEmployees.employeeId))
      .where(eq(propertyEmployees.propertyId, property.id));
    return { manager: manager ?? null, maintenance };
  });

  return {
    unit: {
      unitNumber: unit.unitNumber,
      rentAmountCents: unit.rentAmountCents,
      status: unit.status,
    },
    property: { name: property.name, address: property.address },
    manager: directory.manager,
    maintenance: directory.maintenance,
    balanceCents,
  };
}
