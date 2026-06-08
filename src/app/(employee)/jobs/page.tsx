import Link from "next/link";
import { assertRole } from "@/server/auth/guard";
import { listJobs } from "@/server/services/handyman";
import { acceptJobAction, declineJobAction } from "@/actions/handyman";
import { formatCents } from "@/lib/utils";
import { NotConnected } from "@/components/not-connected";

const STATUS: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  accepted: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export default async function JobsPage() {
  const user = await assertRole("employee");
  let rows: Awaited<ReturnType<typeof listJobs>> = [];
  let dbReady = true;
  try {
    rows = await listJobs(user.id);
  } catch {
    dbReady = false;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="text-sm opacity-60">Accept work, send estimates, and log completion.</p>
      </div>

      {!dbReady ? (
        <NotConnected />
      ) : rows.length === 0 ? (
        <p className="text-sm opacity-60">No jobs assigned yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map(({ task, propertyName }) => (
            <div key={task.id} className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/jobs/${task.id}`} className="font-medium hover:underline">
                    {task.title ?? "Maintenance task"}
                  </Link>
                  <div className="mt-0.5 text-xs opacity-60">
                    {propertyName}
                    {task.deadline ? ` · due ${task.deadline}` : ""}
                    {task.finalCostCents != null ? ` · final ${formatCents(task.finalCostCents)}` : ""}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs capitalize ${STATUS[task.status] ?? ""}`}>
                  {task.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {task.status === "open" && (
                  <>
                    <form action={acceptJobAction}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <button className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background">
                        Accept
                      </button>
                    </form>
                    <form action={declineJobAction}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <button className="rounded-md border border-black/15 px-3 py-1.5 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
                        Decline
                      </button>
                    </form>
                  </>
                )}
                <Link href={`/jobs/${task.id}`} className="text-xs underline opacity-70 hover:opacity-100">
                  Details →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
