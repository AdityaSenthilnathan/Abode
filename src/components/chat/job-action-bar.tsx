"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { formatCents } from "@/lib/utils";
import { ReceiptUpload } from "@/components/handyman/receipt-upload";
import type { ConversationJob } from "@/server/services/messaging";
import {
  chatAcceptCompletionAction,
  chatAcceptJobAction,
  chatApproveEstimateAction,
  chatDeclineJobAction,
  chatSubmitCompletionAction,
  chatSubmitEstimateAction,
} from "@/actions/job-chat";

const field = "rounded-lg border border-line bg-background px-2.5 py-1.5 text-sm outline-none transition focus:border-brand";
const primaryBtn =
  "rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-brand-foreground transition hover:brightness-110";
const ghostBtn = "rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-surface-2";

function Waiting({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
      {children}
    </div>
  );
}

const STATUS: Record<ConversationJob["status"], { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-300" },
  accepted: { label: "In progress", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300" },
  done: { label: "Done", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
};

export function JobActionBar({
  job,
  role,
  conversationId,
}: {
  job: ConversationJob;
  role: string;
  conversationId: string;
}) {
  const isOwner = role === "owner";
  const isEmployee = role === "employee";
  const ids = (
    <>
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="taskId" value={job.taskId} />
    </>
  );

  let action: ReactNode;
  if (job.status === "done") {
    action = (
      <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
        ✅ Job complete{job.finalCostCents != null ? ` · ${formatCents(job.finalCostCents)}` : ""}
      </div>
    );
  } else if (job.status === "open") {
    action = isEmployee ? (
      <div className="flex gap-2">
        <form action={chatAcceptJobAction}>
          {ids}
          <button className={primaryBtn}>Accept job</button>
        </form>
        <form action={chatDeclineJobAction}>
          {ids}
          <button className={ghostBtn}>Decline</button>
        </form>
      </div>
    ) : (
      <Waiting>Waiting for the handyman to accept.</Waiting>
    );
  } else if (job.estimateCents == null) {
    action = isEmployee ? (
      <form action={chatSubmitEstimateAction} className="flex items-center gap-2">
        {ids}
        <span className="text-sm text-muted">$</span>
        <input name="amount" type="number" step="0.01" min="0" placeholder="Estimate" required className={`${field} w-28`} />
        <button className={primaryBtn}>Send estimate</button>
      </form>
    ) : (
      <Waiting>Waiting for the handyman&apos;s estimate.</Waiting>
    );
  } else if (!job.estimateApproved) {
    action = isOwner ? (
      <div className="flex items-center gap-2">
        <span className="text-sm">
          Estimate <strong>{formatCents(job.estimateCents)}</strong>
        </span>
        <form action={chatApproveEstimateAction}>
          {ids}
          <button className={primaryBtn}>Approve</button>
        </form>
      </div>
    ) : (
      <Waiting>Estimate {formatCents(job.estimateCents)} sent — awaiting approval.</Waiting>
    );
  } else if (job.finalCostCents == null) {
    action = isEmployee ? (
      <div className="space-y-2.5">
        <div>
          <div className="mb-1 text-xs font-medium text-muted">
            Receipts {job.receiptCount > 0 ? `· ${job.receiptCount} added` : "· add at least one to finish"}
          </div>
          <ReceiptUpload taskId={job.taskId} />
        </div>
        {job.receiptCount > 0 && (
          <form action={chatSubmitCompletionAction} className="flex items-center gap-2 border-t border-line pt-2.5">
            {ids}
            <span className="text-sm text-muted">$</span>
            <input name="finalCost" type="number" step="0.01" min="0" placeholder="Final cost" required className={`${field} w-28`} />
            <button className={primaryBtn}>Mark finished</button>
          </form>
        )}
      </div>
    ) : (
      <Waiting>Estimate approved — the handyman is working on it.</Waiting>
    );
  } else {
    action = isOwner ? (
      <div className="flex items-center gap-2">
        <span className="text-sm">
          Completion <strong>{formatCents(job.finalCostCents)}</strong>
        </span>
        <form action={chatAcceptCompletionAction}>
          {ids}
          <button className={primaryBtn}>Accept &amp; close</button>
        </form>
      </div>
    ) : (
      <Waiting>Completion {formatCents(job.finalCostCents)} submitted — awaiting sign-off.</Waiting>
    );
  }

  const s = STATUS[job.status];
  return (
    <div className="border-b border-line bg-surface-2/40 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Job</div>
          {isEmployee ? (
            <Link href={`/jobs/${job.taskId}`} className="block truncate text-sm font-semibold hover:underline">
              {job.title ?? "Maintenance task"}
            </Link>
          ) : (
            <div className="truncate text-sm font-semibold">{job.title ?? "Maintenance task"}</div>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
      </div>
      <div className="mt-2">{action}</div>
    </div>
  );
}
