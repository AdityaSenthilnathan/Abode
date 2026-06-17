import Link from "next/link";
import { desc, isNull } from "drizzle-orm";
import { assertRole } from "@/server/auth/guard";
import { withUser } from "@/server/db/rls";
import { units, invoices, maintenanceRequests, notifications } from "@db/schema";
import { formatCents } from "@/lib/utils";
import { NotConnected } from "@/components/not-connected";

const INVOICE_BADGE: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  unpaid: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  late: "bg-red-500/15 text-red-700 dark:text-red-300",
  deferred: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300",
};
const REQUEST_BADGE: Record<string, string> = {
  received: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  working: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};
const card =
  "rounded-xl border border-black/10 p-4 transition-colors hover:bg-black/[0.03] dark:border-white/15 dark:hover:bg-white/5";

async function loadHome(userId: string) {
  // RLS scopes every query to this tenant's own unit / invoices / requests / notifications.
  return withUser(userId, async (tx) => {
    const u = await tx.select().from(units).limit(1);
    const inv = await tx.select().from(invoices).orderBy(desc(invoices.dueDate));
    const reqs = await tx
      .select()
      .from(maintenanceRequests)
      .orderBy(desc(maintenanceRequests.createdAt));
    const unread = await tx.select({ id: notifications.id }).from(notifications).where(isNull(notifications.readAt));
    return { unit: u[0] ?? null, invoices: inv, requests: reqs, unreadCount: unread.length };
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

  if (!dbReady || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">My home</h1>
        <NotConnected />
      </div>
    );
  }

  const payable = data.invoices.filter((i) => i.status === "unpaid" || i.status === "late");
  const balanceCents = payable.reduce((sum, i) => sum + i.amountCents, 0);
  const openRequests = data.requests.filter((r) => r.status !== "done");
  const recentRequests = data.requests.slice(0, 4);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">My home</h1>
        {data.unit ? (
          <p className="mt-1 text-sm opacity-70">
            Unit {data.unit.unitNumber} · Rent {formatCents(data.unit.rentAmountCents)}/mo
          </p>
        ) : (
          <p className="mt-1 text-sm opacity-60">No unit assigned yet.</p>
        )}
      </section>

      {/* quick stats */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/dues" className={card}>
          <div className="text-sm opacity-60">Balance due</div>
          <div className="mt-1 text-2xl font-semibold">{formatCents(balanceCents)}</div>
          <div className={`mt-1 text-xs ${payable.length ? "text-amber-600 dark:text-amber-400" : "opacity-60"}`}>
            {payable.length ? `${payable.length} to pay — pay now →` : "All caught up"}
          </div>
        </Link>
        <Link href="/requests" className={card}>
          <div className="text-sm opacity-60">Open requests</div>
          <div className="mt-1 text-2xl font-semibold">{openRequests.length}</div>
          <div className="mt-1 text-xs opacity-60">
            {openRequests.length ? "View status →" : "Nothing open"}
          </div>
        </Link>
        <Link href="/notifications" className={card}>
          <div className="text-sm opacity-60">Notifications</div>
          <div className="mt-1 text-2xl font-semibold">{data.unreadCount}</div>
          <div className="mt-1 text-xs opacity-60">{data.unreadCount ? "Unread →" : "All read"}</div>
        </Link>
      </section>

      {/* maintenance summary */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Maintenance</h2>
          <Link href="/requests/new" className="text-sm underline opacity-70 hover:opacity-100">
            New request
          </Link>
        </div>
        {recentRequests.length > 0 ? (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {recentRequests.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/requests/${r.id}`}
                  className="flex items-center justify-between gap-4 p-4 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <div className="truncate">{r.description}</div>
                    <div className="mt-0.5 text-xs capitalize opacity-60">{r.urgency} priority</div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs capitalize ${REQUEST_BADGE[r.status] ?? ""}`}
                  >
                    {r.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm opacity-60">No maintenance requests yet.</p>
        )}
      </section>

      {/* dues */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Dues</h2>
          {payable.length > 0 && (
            <Link href="/dues" className="text-sm underline opacity-70 hover:opacity-100">
              Pay dues →
            </Link>
          )}
        </div>
        {data.invoices.length > 0 ? (
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
