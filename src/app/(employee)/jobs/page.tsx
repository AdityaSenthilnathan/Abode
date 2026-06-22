import { assertRole } from "@/server/auth/guard";
import { listJobs } from "@/server/services/handyman";
import { JobsList, type JobCard } from "@/components/handyman/jobs-list";
import { NotConnected } from "@/components/not-connected";

export default async function JobsPage() {
  const user = await assertRole("employee");
  let rows: Awaited<ReturnType<typeof listJobs>> = [];
  let dbReady = true;
  try {
    rows = await listJobs(user.id);
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="text-sm opacity-60">Accept work, send estimates, and log completion.</p>
      </div>

      {!dbReady ? (
        <NotConnected />
      ) : jobs.length === 0 ? (
        <p className="text-sm opacity-60">No jobs assigned yet.</p>
      ) : (
        <JobsList jobs={jobs} />
      )}
    </div>
  );
}
