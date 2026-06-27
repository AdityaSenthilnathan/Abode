import Link from "next/link";
import { AlertTriangle, Bell, Check, CheckCircle2, Info } from "lucide-react";
import { requireUser } from "@/server/auth/guard";
import type { Role } from "@/server/auth/session";
import { listNotifications } from "@/server/services/notifications";
import { ownerNotifications, ownerPropertyOptions } from "@/server/services/owner";
import { markReadAction } from "@/actions/owner";
import { NotConnected } from "@/components/not-connected";
import { Card, EmptyState, type Tone } from "@/components/ui";
import { OwnerNotifications } from "./owner-notifications";

type Notif = Awaited<ReturnType<typeof listNotifications>>[number];

const TYPE: Record<string, { icon: typeof Info; tone: Tone }> = {
  urgent: { icon: AlertTriangle, tone: "danger" },
  success: { icon: CheckCircle2, tone: "success" },
  info: { icon: Info, tone: "info" },
};
const ICON_BG: Record<Tone, string> = {
  danger: "bg-red-500/15 text-red-600 dark:text-red-400",
  success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  info: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  brand: "bg-brand/10 text-brand",
  neutral: "bg-foreground/[0.06] text-muted",
};

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

function Row({ n, href }: { n: Notif; href: string | null }) {
  const meta = TYPE[n.type] ?? TYPE.info;
  const Icon = meta.icon;
  const body = (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ICON_BG[meta.tone]}`}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
          <span className="font-medium">{n.title}</span>
        </div>
        {n.body && <p className="mt-0.5 text-sm text-muted">{n.body}</p>}
        <p className="mt-1 text-xs text-muted">{n.createdAt.toLocaleDateString()}</p>
      </div>
    </div>
  );

  return (
    <div className={`flex items-start justify-between gap-3 p-4 ${n.readAt ? "opacity-60" : ""}`}>
      {href ? (
        <Link href={href} className="min-w-0 flex-1 transition hover:opacity-80">
          {body}
        </Link>
      ) : (
        body
      )}
      {!n.readAt && (
        <form action={markReadAction}>
          <input type="hidden" name="id" value={n.id} />
          <button
            title="Mark read"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            <Check className="h-4 w-4" />
          </button>
        </form>
      )}
    </div>
  );
}

export default async function NotificationsPage() {
  const user = await requireUser();

  // Owners get the property-filterable view; their notifications are tagged with
  // the property (and unit) each one concerns.
  if (user.role === "owner") {
    let ownerNotifs: Awaited<ReturnType<typeof ownerNotifications>> = [];
    let ownerProps: Awaited<ReturnType<typeof ownerPropertyOptions>> = [];
    let ownerDbReady = true;
    try {
      [ownerNotifs, ownerProps] = await Promise.all([
        ownerNotifications(user.id),
        ownerPropertyOptions(user.id),
      ]);
    } catch {
      ownerDbReady = false;
    }
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-muted">Updates across your properties — filter by building below.</p>
        </div>
        {!ownerDbReady ? (
          <NotConnected />
        ) : ownerNotifs.length === 0 ? (
          <EmptyState icon={Bell} title="You're all caught up" hint="New updates will show up here." />
        ) : (
          <OwnerNotifications notifs={ownerNotifs} properties={ownerProps} />
        )}
      </div>
    );
  }

  let all: Notif[] = [];
  let dbReady = true;
  try {
    all = await listNotifications(user.id);
  } catch {
    dbReady = false;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Notifications</h1>
        <p className="mt-1 text-sm text-muted">Updates on your requests, dues, and messages.</p>
      </div>
      {!dbReady ? (
        <NotConnected />
      ) : all.length === 0 ? (
        <EmptyState icon={Bell} title="You're all caught up" hint="New updates will show up here." />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {all.map((n) => (
            <Row key={n.id} n={n} href={notifHref(user.role, n)} />
          ))}
        </Card>
      )}
    </div>
  );
}
