import { requireUser } from "@/server/auth/guard";
import { listNotifications } from "@/server/services/notifications";
import { markReadAction } from "@/actions/owner";
import { NotConnected } from "@/components/not-connected";

type Notif = Awaited<ReturnType<typeof listNotifications>>[number];

const SECTIONS: { type: "urgent" | "success" | "info"; label: string; cls: string }[] = [
  { type: "urgent", label: "Urgent", cls: "text-red-600 dark:text-red-400" },
  { type: "success", label: "Success", cls: "text-emerald-600 dark:text-emerald-400" },
  { type: "info", label: "Info", cls: "opacity-80" },
];

function Row({ n }: { n: Notif }) {
  return (
    <li className={`flex items-start justify-between gap-4 p-3 ${n.readAt ? "opacity-50" : ""}`}>
      <div className="min-w-0">
        <div className="font-medium">{n.title}</div>
        {n.body && <div className="text-sm opacity-70">{n.body}</div>}
      </div>
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
                <Row key={n.id} n={n} />
              ))}
            </ul>
          </section>
        );
      })}
      {all.length === 0 && <p className="text-sm opacity-60">No notifications.</p>}
    </div>
  );
}
