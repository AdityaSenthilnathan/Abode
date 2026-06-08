import { desc, eq } from "drizzle-orm";
import { assertRole } from "@/server/auth/guard";
import { withUser } from "@/server/db/rls";
import { inviteCodes, properties, units } from "@db/schema";
import { generateEmployeeCodeAction, generateTenantCodeAction } from "@/actions/invites";
import { NotConnected } from "@/components/not-connected";

async function load(userId: string) {
  return withUser(userId, async (tx) => {
    const props = await tx.select().from(properties).orderBy(properties.name);
    const vacant = await tx.select().from(units).where(eq(units.status, "vacant")).orderBy(desc(units.unitNumber));
    const codes = await tx.select().from(inviteCodes).orderBy(desc(inviteCodes.createdAt));
    return { props, vacant, codes };
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
        <h1 className="text-2xl font-semibold tracking-tight">Invite codes</h1>
        <p className="text-sm opacity-60">Generate codes for new tenants and maintenance staff.</p>
      </div>

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
            {data.codes.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                <code className="font-mono">{c.code}</code>
                <span className="capitalize opacity-60">{c.kind}</span>
                <span className={c.redeemedAt ? "text-emerald-600" : "opacity-50"}>
                  {c.redeemedAt ? "redeemed" : "unused"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
