import { assertRole } from "@/server/auth/guard";
import { ownerGrid, ownerStats } from "@/server/services/owner";
import { formatCents } from "@/lib/utils";
import { NotConnected } from "@/components/not-connected";

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
      <div className={`text-2xl font-semibold ${accent ?? ""}`}>{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide opacity-60">{label}</div>
    </div>
  );
}

export default async function OwnerDashboard() {
  const user = await assertRole("owner");
  let grid: Awaited<ReturnType<typeof ownerGrid>> = [];
  let stats: Awaited<ReturnType<typeof ownerStats>> | null = null;
  let dbReady = true;
  try {
    [grid, stats] = await Promise.all([ownerGrid(user.id), ownerStats(user.id)]);
  } catch {
    dbReady = false;
  }

  if (!dbReady || !stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <NotConnected />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm opacity-60">Your portfolio at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Revenue (paid)" value={formatCents(stats.revenueCents)} accent="text-emerald-600 dark:text-emerald-400" />
        <Stat label="Expenses" value={formatCents(stats.expensesCents)} />
        <Stat label="Open fixes" value={String(stats.openFixes)} accent={stats.openFixes ? "text-orange-600 dark:text-orange-400" : ""} />
        <Stat label="Unpaid" value={String(stats.unpaidCount)} accent={stats.unpaidCount ? "text-red-600 dark:text-red-400" : ""} />
        <Stat label="Staff" value={String(stats.employeeCount)} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Units</h2>
        {grid.length === 0 ? (
          <p className="text-sm opacity-60">No units yet — add a property to get started.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grid.map(({ unit, tenantName, openRequests }) => (
              <div key={unit.id} className="rounded-xl border border-black/10 p-4 dark:border-white/15">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-medium">Unit {unit.unitNumber}</span>
                  {openRequests > 0 && (
                    <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-xs text-orange-700 dark:text-orange-300">
                      {openRequests} open
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm opacity-70">{tenantName ?? "Vacant"}</div>
                <div className="mt-1 text-xs opacity-50">{formatCents(unit.rentAmountCents)}/mo · {unit.status}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
