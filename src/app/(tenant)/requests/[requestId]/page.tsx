import Link from "next/link";
import { notFound } from "next/navigation";
import { assertRole } from "@/server/auth/guard";
import { requestDetail } from "@/server/services/requests";

const STATUS: Record<string, string> = {
  received: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  working: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};
const STEPS = ["received", "working", "done"] as const;
const STEP_LABEL: Record<(typeof STEPS)[number], string> = {
  received: "Received",
  working: "In progress",
  done: "Resolved",
};

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const user = await assertRole("tenant");
  const d = await requestDetail(user.id, requestId);
  if (!d) notFound();
  const r = d.request;
  const currentStep = STEPS.indexOf(r.status as (typeof STEPS)[number]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/requests" className="text-sm opacity-60 hover:opacity-100">
          ← Requests
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Request</h1>
        <p className="text-sm opacity-60">Filed {r.createdAt.toLocaleDateString()}</p>
      </div>

      <section className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/15">
        <p>{r.description}</p>
        <div className="flex items-center gap-3 text-xs">
          <span className="capitalize opacity-60">{r.urgency} priority</span>
          <span className={`rounded-full px-2 py-0.5 capitalize ${STATUS[r.status] ?? ""}`}>
            {r.status}
          </span>
        </div>
      </section>

      {/* status timeline */}
      <ol className="flex items-center gap-2 text-sm">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className={i <= currentStep ? "font-medium" : "opacity-40"}>{STEP_LABEL[s]}</span>
            {i < STEPS.length - 1 && <span className="opacity-30">→</span>}
          </li>
        ))}
      </ol>

      {/* assignment / resolution */}
      <section className="grid gap-1 rounded-xl border border-black/10 p-4 text-sm dark:border-white/15">
        {d.handymanName ? (
          <div>
            <span className="opacity-60">Assigned to:</span> {d.handymanName}
          </div>
        ) : (
          <div className="opacity-60">Not yet assigned — your manager will schedule this.</div>
        )}
        {r.status === "done" && (
          <div className="text-emerald-700 dark:text-emerald-300">✅ Resolved</div>
        )}
      </section>

      {/* tenant's uploaded media */}
      {d.media.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Your attachments</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {d.media.map((m, i) =>
              m.isVideo ? (
                <video
                  key={i}
                  src={m.url}
                  controls
                  className="aspect-square w-full rounded-lg border border-black/10 object-cover dark:border-white/15"
                />
              ) : (
                <a key={i} href={m.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.url}
                    alt={`Attachment ${i + 1}`}
                    className="aspect-square w-full rounded-lg border border-black/10 object-cover dark:border-white/15"
                  />
                </a>
              ),
            )}
          </div>
        </section>
      )}

      <Link
        href="/messages"
        className="inline-block text-sm underline opacity-70 hover:opacity-100"
      >
        Message your manager
      </Link>
    </div>
  );
}
