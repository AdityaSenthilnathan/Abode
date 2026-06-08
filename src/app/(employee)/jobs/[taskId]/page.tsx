import Link from "next/link";
import { notFound } from "next/navigation";
import { assertRole } from "@/server/auth/guard";
import { jobDetail } from "@/server/services/handyman";
import { submitCompletionAction, submitEstimateAction } from "@/actions/handyman";
import { ReceiptUpload } from "@/components/handyman/receipt-upload";
import { formatCents } from "@/lib/utils";

const input =
  "rounded-lg border border-black/15 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/20";

export default async function JobDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const user = await assertRole("employee");
  const d = await jobDetail(user.id, taskId);
  if (!d) notFound();
  const t = d.task;
  const approved = t.estimateApprovedAt != null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.title ?? "Job"}</h1>
        <p className="text-sm opacity-60">
          {d.property?.name}
          {d.property?.address ? ` · ${d.property.address}` : ""}
        </p>
      </div>

      <section className="grid gap-1 rounded-xl border border-black/10 p-4 text-sm dark:border-white/15">
        <div><span className="opacity-60">Manager:</span> {d.ownerName ?? "—"}</div>
        {d.unitNumber && <div><span className="opacity-60">Unit:</span> {d.unitNumber}</div>}
        {d.tenantName && <div><span className="opacity-60">Tenant:</span> {d.tenantName}</div>}
        {d.requestDesc && <div><span className="opacity-60">Reported:</span> {d.requestDesc}</div>}
        {d.mediaUrls.length > 0 && <div className="opacity-60">{d.mediaUrls.length} attachment(s) from tenant</div>}
        <div><span className="opacity-60">Status:</span> <span className="capitalize">{t.status}</span></div>
      </section>

      {/* workflow */}
      {t.status === "open" && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          Accept this job from the <Link href="/jobs" className="underline">Jobs</Link> list to begin.
        </p>
      )}

      {t.status === "accepted" && t.estimateCents == null && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Send an estimate</h2>
          <form action={submitEstimateAction} className="flex items-end gap-2">
            <input type="hidden" name="taskId" value={t.id} />
            <input name="amount" type="number" step="0.01" min="0" placeholder="Estimate $" required className={`${input} w-36`} />
            <button className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background">Submit estimate</button>
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
  );
}
