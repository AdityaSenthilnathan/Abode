import { Building2 } from "lucide-react";
import { assertRole } from "@/server/auth/guard";
import { listJobs } from "@/server/services/handyman";
import { listEmployeeProperties } from "@/server/services/onboarding";
import { JobsList, type JobCard } from "@/components/handyman/jobs-list";
import { JoinPropertyForm } from "@/components/handyman/join-property-form";
import { NotConnected } from "@/components/not-connected";
import { AutoRefresh } from "@/components/auto-refresh";

export default async function JobsPage() {
  const user = await assertRole("employee");
  let rows: Awaited<ReturnType<typeof listJobs>> = [];
  let connected: Awaited<ReturnType<typeof listEmployeeProperties>> = [];
  let dbReady = true;
  try {
    [rows, connected] = await Promise.all([listJobs(user.id), listEmployeeProperties(user.id)]);
  } catch {
    dbReady = false;
  }

  const jobs: JobCard[] = rows.map((r) => ({
    id: r.task.id,
    title: r.task.title,
    propertyName: r.propertyName,
    propertyAddress: r.propertyAddress,
    lat: r.lat != null ? Number(r.lat) : null,
    lng: r.lng != null ? Number(r.lng) : null,
    urgency: r.urgency,
    status: r.task.status,
    deadline: r.task.deadline,
    estimateCents: r.task.estimateCents,
    finalCostCents: r.task.finalCostCents,
  }));

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-sm opacity-60">Accept work, send estimates, and log completion.</p>
        </div>
        <JoinPropertyForm />
      </div>

      {dbReady && connected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted">Working for</span>
          {connected.map((p) => (
            <span
              key={p.propertyId}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium"
            >
              <Building2 className="h-3 w-3 text-muted" />
              {p.name}
              {(p.ownerName ?? p.ownerEmail) && (
                <span className="text-muted">· {p.ownerName ?? p.ownerEmail}</span>
              )}
            </span>
          ))}
        </div>
      )}

      {!dbReady ? (
        <NotConnected />
      ) : jobs.length === 0 ? (
        <p className="text-sm opacity-60">
          {connected.length === 0
            ? "You're not linked to any properties yet. Use “Join a property” with a code from your manager."
            : "No jobs assigned yet."}
        </p>
      ) : (
        <JobsList jobs={jobs} />
      )}
    </div>
  );
}
