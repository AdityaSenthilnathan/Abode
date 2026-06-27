import { Briefcase, CheckCircle2, ClipboardList, Inbox, Wrench } from "lucide-react";
import { assertRole } from "@/server/auth/guard";
import { fixItBoard } from "@/server/services/owner";
import { acceptCompletionAction, approveEstimateAction, assignTaskAction } from "@/actions/owner";
import { formatCents } from "@/lib/utils";
import { NotConnected } from "@/components/not-connected";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge, Card, EmptyState, SectionHeader, type Tone } from "@/components/ui";

const input =
  "rounded-lg border border-line bg-surface-2/50 px-2.5 py-1.5 text-sm outline-none transition focus:border-brand/50";

function urgencyTone(u: string): Tone {
  return u === "urgent" ? "danger" : u === "high" ? "warning" : u === "med" ? "info" : "neutral";
}
function taskTone(s: string): Tone {
  return s === "done" ? "success" : s === "accepted" ? "warning" : "info";
}

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

  const activeJobs = board.tasks.filter(({ task }) => task.status !== "done").length;
  // Things the owner must act on: open requests still waiting to be assigned to a
  // handyman, plus jobs with an estimate to approve or a completion to accept.
  const needsAction =
    board.requests.length +
    board.tasks.filter(
      ({ task }) =>
        (task.estimateCents != null && task.estimateApprovedAt == null) ||
        (task.finalCostCents != null && task.status !== "done"),
    ).length;

  return (
    <div className="space-y-8">
      <AutoRefresh />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Fix-it</h1>
        <p className="mt-1 text-sm text-muted">Assign open requests to handymen and track jobs.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Open requests</span>
            <Inbox className="h-4 w-4 text-muted" />
          </div>
          <div className={`mt-2 text-2xl font-semibold ${board.requests.length ? "text-orange-600 dark:text-orange-400" : ""}`}>
            {board.requests.length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Active jobs</span>
            <Briefcase className="h-4 w-4 text-muted" />
          </div>
          <div className="mt-2 text-2xl font-semibold">{activeJobs}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Needs your action</span>
            <CheckCircle2 className="h-4 w-4 text-muted" />
          </div>
          <div className={`mt-2 text-2xl font-semibold ${needsAction ? "text-brand" : ""}`}>{needsAction}</div>
        </Card>
      </div>

      <section className="space-y-3">
        <SectionHeader title="Open requests" icon={Wrench} />
        {board.requests.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No open requests" hint="New tenant requests will appear here to assign." />
        ) : (
          <div className="space-y-3">
            {board.requests.map(({ req, unitNumber, propertyId, propertyName, handymen }) => (
              <Card key={req.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{req.description}</div>
                    <div className="mt-0.5 text-xs text-muted">
                      Unit {unitNumber} · {propertyName}
                    </div>
                  </div>
                  <Badge tone={urgencyTone(req.urgency)}>{req.urgency} priority</Badge>
                </div>
                {handymen.length === 0 ? (
                  <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                    No handymen on this property yet — add one from <strong>Invites</strong>.
                  </p>
                ) : (
                  <form action={assignTaskAction} className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
                    <input type="hidden" name="requestId" value={req.id} />
                    <input type="hidden" name="propertyId" value={propertyId} />
                    <input
                      name="title"
                      defaultValue={req.description.slice(0, 80)}
                      className={`${input} min-w-[12rem] flex-1`}
                    />
                    <select name="assignedTo" className={input}>
                      {handymen.map((h, i) => (
                        <option key={h.id} value={h.id}>
                          {(h.name ?? h.email) + (i === 0 ? " — most used" : ` (${h.jobCount} jobs)`)}
                        </option>
                      ))}
                    </select>
                    <input type="date" name="deadline" className={input} />
                    <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:brightness-110 active:scale-[.99]">
                      Give task
                    </button>
                  </form>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader title="Jobs" icon={ClipboardList} />
        {board.tasks.length === 0 ? (
          <EmptyState icon={Briefcase} title="No jobs yet" hint="Assigned tasks show up here with their status." />
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {board.tasks.map(({ task, propertyName, assigneeName }) => (
              <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="truncate font-medium">{task.title ?? "Task"}</div>
                  <div className="mt-0.5 text-xs text-muted">
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
                      <button className="rounded-lg bg-brand px-2.5 py-1.5 text-xs font-semibold text-brand-foreground shadow-sm transition hover:brightness-110">
                        Approve {formatCents(task.estimateCents)}
                      </button>
                    </form>
                  )}
                  {task.finalCostCents != null && task.status !== "done" && (
                    <form action={acceptCompletionAction}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <button className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700">
                        Accept {formatCents(task.finalCostCents)}
                      </button>
                    </form>
                  )}
                  <Badge tone={taskTone(task.status)}>{task.status}</Badge>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
