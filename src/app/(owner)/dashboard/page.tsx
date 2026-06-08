import { desc } from "drizzle-orm";
import { assertRole } from "@/server/auth/guard";
import { withUser } from "@/server/db/rls";
import { units } from "@db/schema";
import { formatCents } from "@/lib/utils";
import { NotConnected } from "@/components/not-connected";

async function loadUnits(userId: string) {
  // RLS scopes this to units in properties this owner owns.
  return withUser(userId, (tx) => tx.select().from(units).orderBy(desc(units.unitNumber)));
}

export default async function OwnerDashboard() {
  const user = await assertRole("owner");

  let rows: Awaited<ReturnType<typeof loadUnits>> = [];
  let dbReady = true;
  try {
    rows = await loadUnits(user.id);
  } catch {
    dbReady = false;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Properties</h1>
        <p className="text-sm opacity-60">Units across your properties, highest number first.</p>
      </div>

      {!dbReady ? (
        <NotConnected />
      ) : rows.length === 0 ? (
        <p className="text-sm opacity-60">No units yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((u) => (
            <div
              key={u.id}
              className="rounded-xl border border-black/10 p-4 dark:border-white/15"
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-medium">Unit {u.unitNumber}</span>
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-xs " +
                    (u.status === "occupied"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300")
                  }
                >
                  {u.status}
                </span>
              </div>
              <div className="mt-2 text-sm opacity-70">Rent {formatCents(u.rentAmountCents)}/mo</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
