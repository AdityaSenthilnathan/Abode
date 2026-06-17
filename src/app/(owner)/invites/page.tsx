import { desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { assertRole } from "@/server/auth/guard";
import { withUser } from "@/server/db/rls";
import { inviteCodes, properties, units, users } from "@db/schema";
import {
  createPropertyAction,
  generateEmployeeCodeAction,
  generateTenantCodeAction,
} from "@/actions/invites";
import { NotConnected } from "@/components/not-connected";
import { PropertyCard } from "@/components/owner/property-card";

async function load(userId: string) {
  return withUser(userId, async (tx) => {
    const props = await tx.select().from(properties).orderBy(properties.name);
    const allUnits = await tx.select().from(units).orderBy(desc(units.unitNumber));
    // Property is on the code directly (employee codes) or via the unit (tenant codes).
    const redeemer = alias(users, "redeemer");
    const codes = await tx
      .select({
        id: inviteCodes.id,
        code: inviteCodes.code,
        kind: inviteCodes.kind,
        redeemedAt: inviteCodes.redeemedAt,
        unitNumber: units.unitNumber,
        propertyName: properties.name,
        tenantName: redeemer.fullName,
        tenantEmail: redeemer.email,
      })
      .from(inviteCodes)
      .leftJoin(units, eq(units.id, inviteCodes.unitId))
      .leftJoin(
        properties,
        eq(properties.id, sql`coalesce(${inviteCodes.propertyId}, ${units.propertyId})`),
      )
      .leftJoin(redeemer, eq(redeemer.id, inviteCodes.redeemedBy))
      .orderBy(desc(inviteCodes.createdAt));
    const unitsByProp = new Map<string, typeof allUnits>();
    for (const u of allUnits) {
      const list = unitsByProp.get(u.propertyId) ?? [];
      list.push(u);
      unitsByProp.set(u.propertyId, list);
    }
    const vacant = allUnits.filter((u) => u.status === "vacant");
    return { props, unitsByProp, vacant, codes };
  });
}

export default async function InvitesPage() {
  const user = await assertRole("owner");
  let data: Awaited<ReturnType<typeof load>> | null = null;
  try {
    data = await load(user.id);
  } catch {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Invite codes</h1>
        <NotConnected />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Properties & invites</h1>
        <p className="text-sm opacity-60">Add properties and units, then generate codes for tenants and staff.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Your properties</h2>

        <form
          action={createPropertyAction}
          className="flex flex-wrap items-end gap-2 rounded-xl border border-black/10 p-3 dark:border-white/15"
        >
          <label className="flex flex-col gap-1 text-xs">
            <span className="opacity-60">Property name</span>
            <input
              name="name"
              required
              placeholder="Maple Court"
              className="rounded-md border border-black/15 bg-transparent px-2.5 py-1.5 text-sm dark:border-white/20"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs">
            <span className="opacity-60">Address</span>
            <input
              name="address"
              required
              placeholder="123 Main St"
              className="rounded-md border border-black/15 bg-transparent px-2.5 py-1.5 text-sm dark:border-white/20"
            />
          </label>
          <button className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background">
            Add property
          </button>
        </form>

        {data.props.length === 0 ? (
          <p className="text-sm opacity-60">No properties yet — add your first one above.</p>
        ) : (
          <div className="space-y-3">
            {data.props.map((p) => (
              <PropertyCard key={p.id} property={p} units={data.unitsByProp.get(p.id) ?? []} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Tenant codes — vacant units</h2>
        {data.vacant.length === 0 ? (
          <p className="text-sm opacity-60">No vacant units.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.vacant.map((u) => (
              <form
                key={u.id}
                action={generateTenantCodeAction}
                className="flex items-center justify-between rounded-xl border border-black/10 p-3 dark:border-white/15"
              >
                <span className="font-medium">Unit {u.unitNumber}</span>
                <input type="hidden" name="unitId" value={u.id} />
                <button className="rounded-md border border-black/15 px-2.5 py-1.5 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
                  Generate code
                </button>
              </form>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Employee codes — properties</h2>
        {data.props.length === 0 ? (
          <p className="text-sm opacity-60">No properties yet.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.props.map((p) => (
              <form
                key={p.id}
                action={generateEmployeeCodeAction}
                className="flex items-center justify-between rounded-xl border border-black/10 p-3 dark:border-white/15"
              >
                <span className="font-medium">{p.name}</span>
                <input type="hidden" name="propertyId" value={p.id} />
                <button className="rounded-md border border-black/15 px-2.5 py-1.5 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
                  Generate code
                </button>
              </form>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Generated codes</h2>
        {data.codes.length === 0 ? (
          <p className="text-sm opacity-60">None yet.</p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {data.codes.map((c) => {
              const location = [
                c.propertyName,
                c.unitNumber ? `Unit ${c.unitNumber}` : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={c.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                  <div className="min-w-0">
                    <code className="font-mono">{c.code}</code>
                    {location && <div className="text-xs opacity-60">{location}</div>}
                  </div>
                  <span className="capitalize opacity-60">{c.kind}</span>
                  {c.redeemedAt ? (
                    <span className="text-right text-emerald-600">
                      {c.tenantName || c.tenantEmail ? (
                        <>joined · {c.tenantName ?? c.tenantEmail}</>
                      ) : (
                        "redeemed"
                      )}
                    </span>
                  ) : (
                    <span className="opacity-50">unused</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
