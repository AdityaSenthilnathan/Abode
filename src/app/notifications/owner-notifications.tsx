"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, Building2, Check, CheckCircle2, Info } from "lucide-react";
import { markReadAction } from "@/actions/owner";
import { Card, EmptyState, type Tone } from "@/components/ui";

export type OwnerNotif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: Date | string | null;
  createdAt: Date | string;
  propertyId: string | null;
  propertyName: string | null;
  unitNumber: string | null;
};

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

function ownerHref(n: OwnerNotif): string | null {
  if ((n.entityType === "request" || n.entityType === "task") && n.entityId) return "/fix-it";
  return null;
}

function Row({ n }: { n: OwnerNotif }) {
  const meta = TYPE[n.type] ?? TYPE.info;
  const Icon = meta.icon;
  const href = ownerHref(n);
  const tag = [n.propertyName, n.unitNumber ? `Unit ${n.unitNumber}` : null].filter(Boolean).join(" · ");
  const read = !!n.readAt;
  const body = (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ICON_BG[meta.tone]}`}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {!read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
          <span className="font-medium">{n.title}</span>
        </div>
        {n.body && <p className="mt-0.5 text-sm text-muted">{n.body}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
          {tag && (
            <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.05] px-2 py-0.5">
              <Building2 className="h-3 w-3" />
              {tag}
            </span>
          )}
          <span>{new Date(n.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`flex items-start justify-between gap-3 p-4 ${read ? "opacity-60" : ""}`}>
      {href ? (
        <Link href={href} className="min-w-0 flex-1 transition hover:opacity-80">
          {body}
        </Link>
      ) : (
        body
      )}
      {!read && (
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

export function OwnerNotifications({
  notifs,
  properties = [],
}: {
  notifs: OwnerNotif[];
  properties?: { id: string; name: string }[];
}) {
  const [property, setProperty] = useState<string>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Filter chips = all of the owner's properties (so a building with no
  // notifications yet, like a freshly added one, still shows up), unioned with
  // any property referenced by a notification just in case.
  const propertyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of properties) seen.set(p.id, p.name);
    for (const n of notifs) if (n.propertyId && n.propertyName && !seen.has(n.propertyId)) seen.set(n.propertyId, n.propertyName);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [notifs, properties]);

  const unreadCount = useMemo(() => notifs.filter((n) => !n.readAt).length, [notifs]);

  const filtered = notifs.filter((n) => {
    if (property !== "all" && n.propertyId !== property) return false;
    if (unreadOnly && n.readAt) return false;
    return true;
  });

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-medium transition ${
      active ? "bg-brand text-brand-foreground shadow-sm" : "border border-line bg-surface text-muted hover:bg-surface-2"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setProperty("all")} className={chip(property === "all")}>
          All properties
        </button>
        {propertyOptions.map((p) => (
          <button key={p.id} type="button" onClick={() => setProperty(p.id)} className={chip(property === p.id)}>
            {p.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setUnreadOnly((v) => !v)}
          className={`${chip(unreadOnly)} ml-auto`}
        >
          Unread{unreadCount ? ` (${unreadCount})` : ""}
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Bell} title="Nothing here" hint="No notifications match this filter." />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {filtered.map((n) => (
            <Row key={n.id} n={n} />
          ))}
        </Card>
      )}
    </div>
  );
}
