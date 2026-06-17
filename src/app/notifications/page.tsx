import Link from "next/link";
import { requireUser } from "@/server/auth/guard";
import type { Role } from "@/server/auth/session";
import { listNotifications } from "@/server/services/notifications";
import { markReadAction } from "@/actions/owner";
import { NotConnected } from "@/components/not-connected";

type Notif = Awaited<ReturnType<typeof listNotifications>>[number];

/** Where a notification should take each role when clicked (null = not linkable). */
function notifHref(role: Role, n: Notif): string | null {
  if (!n.entityType || !n.entityId) return null;
  if (n.entityType === "request") {
    if (role === "tenant") return `/requests/${n.entityId}`;
    if (role === "owner") return "/fix-it";
  }
  if (n.entityType === "task") {
    if (role === "employee") return `/jobs/${n.entityId}`;
    if (role === "owner") return "/fix-it";
  }
  return null;
}

const SECTIONS: { type: "urgent" | "success" | "info"; label: string; cls: string }[] = [
  { type: "urgent", label: "Urgent", cls: "text-red-600 dark:text-red-400" },
  { type: "success", label: "Success", cls: "text-emerald-600 dark:text-emerald-400" },
  { type: "info", label: "Info", cls: "opacity-80" },
];

function Row({ n, href }: { n: Notif; href: string | null }) {
  const content = (
    <div className="min-w-0">
      <div className="font-medium">{n.title}</div>
      {n.body && <div className="text-sm opacity-70">{n.body}</div>}
    </div>
  );
  return (
    <li className={`flex items-start justify-between gap-4 p-3 ${n.readAt ? "opacity-50" : ""}`}>
      {href ? (
        <Link href={href} className="min-w-0 flex-1 hover:opacity-80">
          {content}
        </Link>
      ) : (
        content
      )}
      {!n.readAt && (
        <form action={markReadAction}>
          <input type="hidden" name="id" value={n.id} />
          <button className="shrink-0 rounded-md border border-black/15 px-2 py-1 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
            Mark read
          </button>
        </form>
      )}
    </li>
  );
}

export default async function NotificationsPage() {
  const user = await requireUser();
  let all: Notif[] = [];
  let dbReady = true;
  try {
    all = await listNotifications(user.id);
  } catch {
    dbReady = false;
  }

  if (!dbReady) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <NotConnected />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
      {SECTIONS.map((s) => {
        const items = all.filter((n) => n.type === s.type);
        if (items.length === 0) return null;
        return (
          <section key={s.type} className="space-y-2">
            <h2 className={`text-sm font-semibold uppercase tracking-wide ${s.cls}`}>{s.label}</h2>
            <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
              {items.map((n) => (
                <Row key={n.id} n={n} href={notifHref(user.role, n)} />
              ))}
            </ul>
          </section>
        );
      })}
      {all.length === 0 && <p className="text-sm opacity-60">No notifications.</p>}
    </div>
  );
}
