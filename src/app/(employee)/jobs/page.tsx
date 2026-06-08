import { desc } from "drizzle-orm";
import { assertRole } from "@/server/auth/guard";
import { withUser } from "@/server/db/rls";
import { tasks } from "@db/schema";
import { formatCents } from "@/lib/utils";
import { NotConnected } from "@/components/not-connected";

async function loadTasks(userId: string) {
  // RLS scopes this to tasks assigned to this employee or on their properties.
  return withUser(userId, (tx) => tx.select().from(tasks).orderBy(desc(tasks.createdAt)));
}

export default async function EmployeeJobs() {
  const user = await assertRole("employee");

  let rows: Awaited<ReturnType<typeof loadTasks>> = [];
  let dbReady = true;
  try {
    rows = await loadTasks(user.id);
  } catch {
    dbReady = false;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="text-sm opacity-60">Work orders assigned to you.</p>
      </div>

      {!dbReady ? (
        <NotConnected />
      ) : rows.length === 0 ? (
        <p className="text-sm opacity-60">No jobs yet.</p>
      ) : (
        <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
          {rows.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="truncate font-medium">{t.title ?? "Untitled task"}</div>
                <div className="mt-0.5 text-sm opacity-60">
                  {t.deadline ? `Due ${t.deadline}` : "No deadline"}
                  {t.estimateCents != null ? ` · Est. ${formatCents(t.estimateCents)}` : ""}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs capitalize text-blue-700 dark:text-blue-300">
                {t.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
