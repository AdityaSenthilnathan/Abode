import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, CheckCircle2, Inbox, MessageSquare, Wrench } from "lucide-react";
import { assertRole } from "@/server/auth/guard";
import { requestDetail } from "@/server/services/requests";
import { getOrCreateOwnerConversation } from "@/server/services/messaging";
import { Badge, Card, button, requestTone } from "@/components/ui";
import { AutoRefresh } from "@/components/auto-refresh";

const STEPS = [
  { key: "received", label: "Received", icon: Inbox },
  { key: "working", label: "In progress", icon: Wrench },
  { key: "done", label: "Resolved", icon: CheckCircle2 },
] as const;

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
  const current = STEPS.findIndex((s) => s.key === r.status);

  // Link straight to the owner↔tenant thread; fall back to the inbox if it can't
  // be resolved (e.g. unit lost its manager).
  let convoHref = "/messages";
  try {
    convoHref = `/messages/${await getOrCreateOwnerConversation(user.id)}`;
  } catch {
    /* keep the inbox fallback */
  }

  const stepDetail = (key: string): string | null => {
    if (key === "received") return `Filed ${r.createdAt.toLocaleDateString()}`;
    if (key === "working") {
      if (current < 1) return "Awaiting assignment by your manager";
      const bits = [d.handymanName ? `Assigned to ${d.handymanName}` : "Being scheduled"];
      if (d.task?.scheduledAt) bits.push(`Scheduled ${d.task.scheduledAt.toLocaleString()}`);
      else if (d.task?.deadline) bits.push(`Target ${d.task.deadline}`);
      return bits.join(" · ");
    }
    if (key === "done") return current >= 2 ? "Marked resolved" : "Pending";
    return null;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <AutoRefresh />
      <div>
        <Link href="/requests" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Requests
        </Link>
        <div className="mt-3 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Maintenance request</h1>
          <Badge tone={requestTone(r.status)}>{r.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted">Filed {r.createdAt.toLocaleDateString()}</p>
      </div>

      <Card className="space-y-3 p-5">
        <p className="leading-relaxed">{r.description}</p>
        <Badge tone={r.urgency === "urgent" || r.urgency === "high" ? "danger" : "neutral"}>
          {r.urgency} priority
        </Badge>
      </Card>

      {/* progress timeline */}
      <Card className="p-5">
        <ol>
          {STEPS.map((s, i) => {
            const reached = i <= current;
            const detail = stepDetail(s.key);
            return (
              <li key={s.key} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                      reached
                        ? "border-brand bg-brand text-brand-foreground"
                        : "border-line bg-surface text-muted"
                    }`}
                  >
                    {i < current ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span className={`my-1 w-px flex-1 ${i < current ? "bg-brand" : "bg-line"}`} />
                  )}
                </div>
                <div className={`pb-6 ${i === STEPS.length - 1 ? "pb-0" : ""}`}>
                  <div className={`font-medium ${reached ? "" : "text-muted"}`}>{s.label}</div>
                  {detail && <div className="mt-0.5 text-sm text-muted">{detail}</div>}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      {/* tenant's uploaded media */}
      {d.media.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted">Your attachments</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {d.media.map((m, i) =>
              m.isVideo ? (
                <video
                  key={i}
                  src={m.url}
                  controls
                  className="aspect-square w-full rounded-xl border border-line object-cover"
                />
              ) : (
                <a key={i} href={m.url} target="_blank" rel="noreferrer" className="group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.url}
                    alt={`Attachment ${i + 1}`}
                    className="aspect-square w-full rounded-xl border border-line object-cover transition group-hover:opacity-90"
                  />
                </a>
              ),
            )}
          </div>
        </section>
      )}

      <Link href={convoHref} className={button.secondary}>
        <MessageSquare className="h-4 w-4" /> Message your manager
      </Link>
    </div>
  );
}
