import Link from "next/link";
import { assertRole } from "@/server/auth/guard";
import { listMyRequests } from "@/server/services/requests";
import { NotConnected } from "@/components/not-connected";

const STATUS: Record<string, string> = {
  received: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  working: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};
const URGENCY: Record<string, string> = {
  low: "opacity-60",
  med: "opacity-80",
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Requests</h1>
          <p className="text-sm opacity-60">Track your maintenance requests.</p>
        </div>
        <Link
          href="/requests/new"
          className="shrink-0 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          New request
        </Link>
      </div>

      {!dbReady ? (
        <NotConnected />
      ) : rows.length === 0 ? (
        <p className="text-sm opacity-60">No requests yet.</p>
      ) : (
        <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/requests/${r.id}`}
                className="flex items-start justify-between gap-4 p-4 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <div className="min-w-0">
                  <div className="truncate">{r.description}</div>
                  <div className="mt-1 text-xs opacity-60">
                    <span className={URGENCY[r.urgency]}>{r.urgency} priority</span>
                    {r.mediaUrls.length > 0 ? ` · ${r.mediaUrls.length} attachment(s)` : ""}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs capitalize ${STATUS[r.status] ?? ""}`}
                >
                  {r.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
