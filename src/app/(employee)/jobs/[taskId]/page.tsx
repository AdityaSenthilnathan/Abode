import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  CheckCircle2,
  ClipboardList,
  FileText,
  MapPin,
  MessageSquare,
  Receipt,
  Wrench,
} from "lucide-react";
import { assertRole } from "@/server/auth/guard";
import { jobDetail } from "@/server/services/handyman";
import { Card } from "@/components/ui";
import {
  acceptJobAction,
  declineJobAction,
  openJobChatAction,
  submitCompletionAction,
  submitEstimateAction,
} from "@/actions/handyman";
import { ReceiptUpload } from "@/components/handyman/receipt-upload";
import { JobLocationMap } from "@/components/handyman/job-location-map";
import { formatCents } from "@/lib/utils";
import { AutoRefresh } from "@/components/auto-refresh";

const input =
  "rounded-lg border border-black/15 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/20";

export default async function JobDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const user = await assertRole("employee");
  const d = await jobDetail(user.id, taskId);
  if (!d) notFound();
  const t = d.task;
  const approved = t.estimateApprovedAt != null;

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const lat = d.property?.lat != null ? Number(d.property.lat) : null;
  const lng = d.property?.lng != null ? Number(d.property.lng) : null;
  const showMap = !!token && lat != null && lng != null;

  // Project timeline — each step is reached once its condition holds.
  const steps = [
    {
      label: "Assigned",
      icon: ClipboardList,
      reached: true,
      detail: `${d.ownerName ? `By ${d.ownerName} · ` : ""}${t.createdAt.toLocaleDateString()}`,
    },
    {
      label: "Accepted",
      icon: Wrench,
      reached: t.status !== "open",
      detail: t.status !== "open" ? "Job accepted" : "Awaiting your acceptance",
    },
    {
      label: "Estimate sent",
      icon: FileText,
      reached: t.estimateCents != null,
      detail: t.estimateCents != null ? `${formatCents(t.estimateCents)} sent` : "Not sent yet",
    },
    {
      label: "Estimate approved",
      icon: CheckCircle2,
      reached: t.estimateApprovedAt != null,
      detail:
        t.estimateApprovedAt != null
          ? `Approved ${t.estimateApprovedAt.toLocaleDateString()}`
          : "Awaiting manager approval",
    },
    {
      label: "Work completed",
      icon: Receipt,
      reached: t.finalCostCents != null,
      detail: t.finalCostCents != null ? `Final cost ${formatCents(t.finalCostCents)}` : "In progress",
    },
    {
      label: "Signed off",
      icon: BadgeCheck,
      reached: t.status === "done",
      detail: t.status === "done" ? "Manager signed off — job closed" : "Awaiting sign-off",
    },
  ];
  const current = steps.map((s) => s.reached).lastIndexOf(true);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <AutoRefresh />
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to jobs
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title ?? "Job"}</h1>
          <p className="text-sm opacity-60">
            {d.property?.name}
            {d.property?.address ? ` · ${d.property.address}` : ""}
          </p>
        </div>
        <form action={openJobChatAction}>
          <input type="hidden" name="taskId" value={t.id} />
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium transition hover:bg-surface-2">
            <MessageSquare className="h-4 w-4" />
            Chat with manager &amp; tenant
          </button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        {/* left: details + workflow */}
        <div className="space-y-6">
          <section className="grid gap-1 rounded-xl border border-black/10 p-4 text-sm dark:border-white/15">
            <div><span className="opacity-60">Manager:</span> {d.ownerName ?? "—"}</div>
            {d.unitNumber && <div><span className="opacity-60">Unit:</span> {d.unitNumber}</div>}
            {d.tenantName && <div><span className="opacity-60">Tenant:</span> {d.tenantName}</div>}
            {d.requestDesc && <div><span className="opacity-60">Reported:</span> {d.requestDesc}</div>}
            {d.mediaUrls.length > 0 && <div className="opacity-60">{d.mediaUrls.length} attachment(s) from tenant</div>}
            <div><span className="opacity-60">Status:</span> <span className="capitalize">{t.status}</span></div>
          </section>

          {/* project timeline */}
          <Card className="p-5">
            <div className="mb-4 text-sm font-semibold tracking-tight">Project timeline</div>
            <ol>
              {steps.map((s, i) => {
                const Icon = s.icon;
                return (
                  <li key={s.label} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                          s.reached ? "border-brand bg-brand text-brand-foreground" : "border-line bg-surface text-muted"
                        }`}
                      >
                        {i < current ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </span>
                      {i < steps.length - 1 && (
                        <span className={`my-1 w-px flex-1 ${i < current ? "bg-brand" : "bg-line"}`} />
                      )}
                    </div>
                    <div className={i === steps.length - 1 ? "" : "pb-6"}>
                      <div className={`font-medium ${s.reached ? "" : "text-muted"}`}>{s.label}</div>
                      {s.detail && <div className="mt-0.5 text-sm text-muted">{s.detail}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          {/* workflow */}
          {t.status === "open" && (
        <section className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="flex-1 text-sm">This job is waiting for you. Accept it to send an estimate.</p>
          <form action={acceptJobAction}>
            <input type="hidden" name="taskId" value={t.id} />
            <button className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-semibold text-background transition hover:opacity-90">
              Accept job
            </button>
          </form>
          <form action={declineJobAction}>
            <input type="hidden" name="taskId" value={t.id} />
            <button className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-surface-2">
              Decline
            </button>
          </form>
        </section>
      )}

      {t.status === "accepted" && t.estimateCents == null && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Send an estimate</h2>
          <form action={submitEstimateAction} className="space-y-3 rounded-xl border border-line bg-surface p-4">
            <input type="hidden" name="taskId" value={t.id} />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">$</span>
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="Estimate amount"
                required
                className={`${input} w-40`}
              />
            </div>
            <textarea
              name="message"
              rows={3}
              placeholder="Add a message to the manager (optional)"
              className={`${input} w-full resize-none`}
            />
            <div className="flex justify-end">
              <button className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-semibold text-background transition hover:opacity-90">
                Submit estimate
              </button>
            </div>
          </form>
        </section>
      )}

      {t.status === "accepted" && t.estimateCents != null && !approved && (
        <p className="rounded-xl border border-black/10 p-4 text-sm dark:border-white/15">
          Estimate <strong>{formatCents(t.estimateCents)}</strong> submitted — awaiting the manager&apos;s approval.
        </p>
      )}

      {t.status === "accepted" && approved && (
        <section className="space-y-4">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
            Estimate {formatCents(t.estimateCents)} approved — go ahead.
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-medium">Receipts</h2>
            {d.receipts.length === 0 ? (
              <p className="text-sm opacity-60">No receipts yet. Add at least one to complete the job.</p>
            ) : (
              <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
                {d.receipts.map((r) => (
                  <li key={r.id} className="flex items-center justify-between p-3 text-sm">
                    <span>{r.description || "Receipt"}</span>
                    <span className="font-medium">{formatCents(r.amountCents)}</span>
                  </li>
                ))}
              </ul>
            )}
            <ReceiptUpload taskId={t.id} />
          </div>

          {t.finalCostCents == null ? (
            d.receipts.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-lg font-medium">Mark complete</h2>
                <form action={submitCompletionAction} className="flex items-end gap-2">
                  <input type="hidden" name="taskId" value={t.id} />
                  <input name="finalCost" type="number" step="0.01" min="0" placeholder="Final cost $" required className={`${input} w-36`} />
                  <button className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background">Submit completion</button>
                </form>
              </section>
            )
          ) : (
            <p className="rounded-xl border border-black/10 p-4 text-sm dark:border-white/15">
              Completion submitted ({formatCents(t.finalCostCents)}) — awaiting the manager&apos;s sign-off.
            </p>
          )}
        </section>
      )}

      {t.status === "done" && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
          ✅ Completed — final cost {formatCents(t.finalCostCents)}.
        </p>
      )}
        </div>

        {/* right: location map */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="h-64 overflow-hidden rounded-xl border border-line lg:h-[26rem]">
            {showMap ? (
              <JobLocationMap token={token!} lat={lat!} lng={lng!} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1 bg-surface-2 p-4 text-center text-sm text-muted">
                <MapPin className="h-5 w-5" />
                {d.property?.address ?? "Location unavailable"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
