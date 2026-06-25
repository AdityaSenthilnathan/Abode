import "server-only";
import { eq } from "drizzle-orm";
import { asAdmin, withUser } from "@/server/db/rls";
import { invoices, properties, propertyEmployees, tasks, units, users } from "@db/schema";
import { getPayoutCard, type PayoutCard } from "./earnings";
import { listEmployeeProperties } from "./onboarding";

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

export interface AccountContact {
  fullName: string | null;
  email: string;
}

export interface HandymanAccountProperty {
  id: string;
  name: string;
  address: string | null;
  managerName: string | null;
  managerEmail: string | null;
}

export interface HandymanAccount {
  properties: HandymanAccountProperty[];
  /** Deduped property managers the worker reports to (one row per manager). */
  managers: AccountContact[];
  stats: { activeJobs: number; completedJobs: number; totalEarnedCents: number };
  payout: PayoutCard | null;
}

/**
 * Everything a handyman sees on their account page: the properties they're
 * linked to (and who manages each), lifetime job stats, and their saved payout
 * method. Job + payout reads run as the worker (RLS, filtered to assignedTo);
 * the property + manager directory comes from listEmployeeProperties (asAdmin) —
 * the same trusted directory lookup the Jobs page already relies on.
 */
export async function getHandymanAccount(userId: string): Promise<HandymanAccount> {
  const [props, taskRows, payout] = await Promise.all([
    listEmployeeProperties(userId),
    withUser(userId, (tx) =>
      tx
        .select({ status: tasks.status, finalCostCents: tasks.finalCostCents })
        .from(tasks)
        .where(eq(tasks.assignedTo, userId)),
    ),
    getPayoutCard(userId),
  ]);

  let activeJobs = 0;
  let completedJobs = 0;
  let totalEarnedCents = 0;
  for (const t of taskRows) {
    if (t.status === "done") {
      completedJobs += 1;
      totalEarnedCents += t.finalCostCents ?? 0;
    } else {
      activeJobs += 1;
    }
  }

  const propertyList: HandymanAccountProperty[] = props.map((p) => ({
    id: p.propertyId,
    name: p.name,
    address: p.address,
    managerName: p.ownerName,
    managerEmail: p.ownerEmail,
  }));

  // One contact per manager — a worker can hold several properties under the same manager.
  const seen = new Set<string>();
  const managers: AccountContact[] = [];
  for (const p of props) {
    if (!p.ownerEmail || seen.has(p.ownerEmail)) continue;
    seen.add(p.ownerEmail);
    managers.push({ fullName: p.ownerName, email: p.ownerEmail });
  }

  return {
    properties: propertyList,
    managers,
    stats: { activeJobs, completedJobs, totalEarnedCents },
    payout,
  };
}
