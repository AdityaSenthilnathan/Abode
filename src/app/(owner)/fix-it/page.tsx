import { assertRole } from "@/server/auth/guard";
import { fixItBoard } from "@/server/services/owner";
import { acceptCompletionAction, approveEstimateAction, assignTaskAction } from "@/actions/owner";
import { formatCents } from "@/lib/utils";
import { NotConnected } from "@/components/not-connected";

const input =
  "rounded-lg border border-black/15 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/20";

export default async function FixItPage() {
  const user = await assertRole("owner");
  let board: Awaited<ReturnType<typeof fixItBoard>> | null = null;
  let dbReady = true;
  try {
    board = await fixItBoard(user.id);
  } catch {
    dbReady = false;
  }

  if (!dbReady || !board) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Fix-it</h1>
        <NotConnected />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Fix-it</h1>
        <p className="text-sm opacity-60">Assign open requests to handymen and track jobs.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Open requests</h2>
        {board.requests.length === 0 ? (
          <p className="text-sm opacity-60">No open requests. 🎉</p>
        ) : (
          <div className="space-y-3">
            {board.requests.map(({ req, unitNumber, propertyId, propertyName, handymen }) => (
              <div key={req.id} className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/15">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{req.description}</div>
                    <div className="mt-0.5 text-xs opacity-60">
                      Unit {unitNumber} · {propertyName} · {req.urgency} priority
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs capitalize text-blue-700 dark:text-blue-300">
                    {req.status}
                  </span>
                </div>
                {handymen.length === 0 ? (
                  <p className="text-xs opacity-60">
                    No handymen on this property yet — add one from <strong>Invites</strong>.
                  </p>
                ) : (
                  <form action={assignTaskAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="requestId" value={req.id} />
                    <input type="hidden" name="propertyId" value={propertyId} />
                    <input name="title" defaultValue={req.description.slice(0, 80)} className={`${input} min-w-[12rem] flex-1`} />
                    <select name="assignedTo" className={input}>
                      {handymen.map((h, i) => (
                        <option key={h.id} value={h.id}>
                          {(h.name ?? h.email) + (i === 0 ? " ⭐ most used" : ` (${h.jobCount} jobs)`)}
                        </option>
                      ))}
                    </select>
                    <input type="date" name="deadline" className={input} />
                    <button className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background">
                      Give task
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Tasks</h2>
        {board.tasks.length === 0 ? (
          <p className="text-sm opacity-60">No tasks yet.</p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {board.tasks.map(({ task, propertyName, assigneeName }) => (
              <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="truncate font-medium">{task.title ?? "Task"}</div>
                  <div className="mt-0.5 text-xs opacity-60">
                    {propertyName} · {assigneeName ?? "unassigned"}
                    {task.deadline ? ` · due ${task.deadline}` : ""}
                    {task.estimateCents != null ? ` · est. ${formatCents(task.estimateCents)}` : ""}
                    {task.finalCostCents != null ? ` · final ${formatCents(task.finalCostCents)}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {task.estimateCents != null && task.estimateApprovedAt == null && (
                    <form action={approveEstimateAction}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <button className="rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background">
                        Approve {formatCents(task.estimateCents)}
                      </button>
                    </form>
                  )}
                  {task.finalCostCents != null && task.status !== "done" && (
                    <form action={acceptCompletionAction}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <button className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white">
                        Accept {formatCents(task.finalCostCents)}
                      </button>
                    </form>
                  )}
                  <span className="rounded-full bg-zinc-500/15 px-2 py-0.5 text-xs capitalize">{task.status}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
