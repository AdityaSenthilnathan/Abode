import { desc } from "drizzle-orm";
import { assertRole } from "@/server/auth/guard";
import { withUser } from "@/server/db/rls";
import { units, invoices } from "@db/schema";
import { formatCents } from "@/lib/utils";
import { NotConnected } from "@/components/not-connected";

const INVOICE_BADGE: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  unpaid: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  late: "bg-red-500/15 text-red-700 dark:text-red-300",
  deferred: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300",
};

async function loadHome(userId: string) {
  // RLS scopes both queries to this tenant's own unit + invoices.
  return withUser(userId, async (tx) => {
    const u = await tx.select().from(units).limit(1);
    const inv = await tx.select().from(invoices).orderBy(desc(invoices.dueDate));
    return { unit: u[0] ?? null, invoices: inv };
  });
}

export default async function TenantHome() {
  const user = await assertRole("tenant");

  let data: Awaited<ReturnType<typeof loadHome>> | null = null;
  let dbReady = true;
  try {
    data = await loadHome(user.id);
  } catch {
    dbReady = false;
  }

  if (!dbReady) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">My home</h1>
        <NotConnected />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">My home</h1>
        {data?.unit ? (
          <p className="mt-1 text-sm opacity-70">
            Unit {data.unit.unitNumber} · Rent {formatCents(data.unit.rentAmountCents)}/mo
          </p>
        ) : (
          <p className="mt-1 text-sm opacity-60">No unit assigned yet.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Dues</h2>
        {data && data.invoices.length > 0 ? (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {data.invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <div className="font-medium capitalize">{inv.type}</div>
                  <div className="mt-0.5 text-sm opacity-60">Due {inv.dueDate}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{formatCents(inv.amountCents)}</span>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-xs capitalize " +
                      (INVOICE_BADGE[inv.status] ?? INVOICE_BADGE.deferred)
                    }
                  >
                    {inv.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm opacity-60">No dues. You&apos;re all caught up.</p>
        )}
      </section>
    </div>
  );
}
