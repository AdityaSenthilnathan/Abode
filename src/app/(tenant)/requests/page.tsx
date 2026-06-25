import Link from "next/link";
import { ChevronRight, Paperclip, Plus, Wrench } from "lucide-react";
import { assertRole } from "@/server/auth/guard";
import { listMyRequests } from "@/server/services/requests";
import { NotConnected } from "@/components/not-connected";
import { Badge, Card, EmptyState, button, requestTone } from "@/components/ui";
import { AutoRefresh } from "@/components/auto-refresh";

const URGENCY: Record<string, string> = {
  low: "text-muted",
  med: "text-muted",
  high: "text-orange-600 dark:text-orange-400",
  urgent: "font-medium text-red-600 dark:text-red-400",
};

export default async function RequestsPage() {
  const user = await assertRole("tenant");
  let rows: Awaited<ReturnType<typeof listMyRequests>> = [];
  let dbReady = true;
  try {
    rows = await listMyRequests(user.id);
  } catch {
    dbReady = false;
  }

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Requests</h1>
          <p className="mt-1 text-sm text-muted">Track your maintenance requests.</p>
        </div>
        <Link href="/requests/new" className={button.primary}>
          <Plus className="h-4 w-4" /> New request
        </Link>
      </div>

      {!dbReady ? (
        <NotConnected />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No requests yet"
          hint="Something broken? Report it and we'll get it fixed."
          action={
            <Link href="/requests/new" className={button.secondary}>
              <Plus className="h-4 w-4" /> New request
            </Link>
          }
        />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/requests/${r.id}`}
              className="flex items-center justify-between gap-4 p-4 transition hover:bg-surface-2"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{r.description}</div>
                <div className="mt-1 flex items-center gap-3 text-xs">
                  <span className={`capitalize ${URGENCY[r.urgency]}`}>{r.urgency} priority</span>
                  {r.mediaUrls.length > 0 && (
                    <span className="flex items-center gap-1 text-muted">
                      <Paperclip className="h-3 w-3" />
                      {r.mediaUrls.length}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={requestTone(r.status)}>{r.status}</Badge>
                <ChevronRight className="h-4 w-4 text-muted" />
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
