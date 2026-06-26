import Link from "next/link";
import { desc, isNull } from "drizzle-orm";
import { ArrowRight, Bell, ChevronRight, CreditCard, Plus, Wrench } from "lucide-react";
import { assertRole } from "@/server/auth/guard";
import { withUser } from "@/server/db/rls";
import { units, invoices, maintenanceRequests, notifications } from "@db/schema";
import { formatCents } from "@/lib/utils";
import { NotConnected } from "@/components/not-connected";
import {
  Badge,
  Card,
  DueLabel,
  EmptyState,
  SectionHeader,
  button,
  byInvoiceUrgency,
  invoiceTone,
  requestTone,
} from "@/components/ui";

async function loadHome(userId: string) {
  // RLS scopes every query to this tenant's own unit / invoices / requests / notifications.
  return withUser(userId, async (tx) => {
    const u = await tx.select().from(units).limit(1);
    const inv = await tx.select().from(invoices).orderBy(desc(invoices.dueDate));
    const reqs = await tx
      .select()
      .from(maintenanceRequests)
      .orderBy(desc(maintenanceRequests.createdAt));
    const unread = await tx.select({ id: notifications.id }).from(notifications).where(isNull(notifications.readAt));
    return { unit: u[0] ?? null, invoices: inv, requests: reqs, unreadCount: unread.length };
  });
}

export default async function TenantHome() {
  const user = await assertRole("tenant");

  let data: Awaited<ReturnType<typeof loadHome>> | null = null;
  let dbReady = true;
  try {
    data = await loadHome(user.id);
  } catch {
    dbReady = false;
  }

  if (!dbReady || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">My home</h1>
        <NotConnected />
      </div>
    );
  }

  const firstName = (user.fullName ?? "").split(" ")[0] || "there";
  const outstanding = data.invoices.filter((i) => i.status !== "paid");
  const balanceCents = outstanding.reduce((sum, i) => sum + i.amountCents, 0);
  const openRequests = data.requests.filter((r) => r.status !== "done");
  const recentRequests = data.requests.slice(0, 4);
  const recentInvoices = data.invoices.slice().sort(byInvoiceUrgency).slice(0, 4);

  const stats = [
    {
      href: "/dues",
      icon: CreditCard,
      label: "Balance due",
      value: formatCents(balanceCents),
      hint: outstanding.length ? `${outstanding.length} to pay` : "All caught up",
      alert: outstanding.length > 0,
    },
    {
      href: "/requests",
      icon: Wrench,
      label: "Open requests",
      value: String(openRequests.length),
      hint: openRequests.length ? "In progress" : "Nothing open",
      alert: false,
    },
    {
      href: "/notifications",
      icon: Bell,
      label: "Notifications",
      value: String(data.unreadCount),
      hint: data.unreadCount ? "Unread" : "All read",
      alert: data.unreadCount > 0,
    },
  ];

  return (
    <div className="space-y-8">
      {/* hero */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Welcome back, {firstName}</h1>
          {data.unit ? (
            <p className="mt-1 text-muted">
              Unit {data.unit.unitNumber} · Rent {formatCents(data.unit.rentAmountCents)}/mo
            </p>
          ) : (
            <p className="mt-1 text-muted">No unit assigned yet.</p>
          )}
        </div>
        <Link href="/requests/new" className={button.primary}>
          <Plus className="h-4 w-4" /> New request
        </Link>
      </section>

      {/* quick stats */}
      <section className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.href} href={s.href} className="group">
            <Card className="flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  s.alert ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-brand/10 text-brand"
                }`}
              >
                <s.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-muted">{s.label}</div>
                <div className="text-2xl font-semibold tracking-tight">{s.value}</div>
                <div className={`text-xs ${s.alert ? "text-amber-600 dark:text-amber-400" : "text-muted"}`}>
                  {s.hint}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
            </Card>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* dues */}
        <section className="space-y-3">
          <SectionHeader
            title="Dues"
            icon={CreditCard}
            action={
              <Link href="/dues" className={button.ghost}>
                {outstanding.length > 0 ? "Pay dues" : "View all"}
              </Link>
            }
          />
          {recentInvoices.length > 0 ? (
            <Card className="divide-y divide-line overflow-hidden">
              {recentInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <div className="font-medium capitalize">{inv.type}</div>
                    <div className="mt-0.5 text-xs">
                      <DueLabel dueDate={inv.dueDate} status={inv.status} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{formatCents(inv.amountCents)}</span>
                    <Badge tone={invoiceTone(inv.status)}>{inv.status}</Badge>
                  </div>
                </div>
              ))}
            </Card>
          ) : (
            <EmptyState icon={CreditCard} title="You're all caught up" hint="No dues right now." />
          )}
        </section>

        {/* maintenance */}
        <section className="space-y-3">
          <SectionHeader
            title="Maintenance"
            icon={Wrench}
            action={
              <Link href="/requests" className={button.ghost}>
                View all
              </Link>
            }
          />
          {recentRequests.length > 0 ? (
            <Card className="divide-y divide-line overflow-hidden">
              {recentRequests.map((r) => (
                <Link
                  key={r.id}
                  href={`/requests/${r.id}`}
                  className="flex items-center justify-between gap-3 p-4 transition hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{r.description}</div>
                    <div className="mt-0.5 text-xs capitalize text-muted">{r.urgency} priority</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={requestTone(r.status)}>{r.status}</Badge>
                    <ChevronRight className="h-4 w-4 text-muted" />
                  </div>
                </Link>
              ))}
            </Card>
          ) : (
            <EmptyState
              icon={Wrench}
              title="No maintenance requests yet"
              hint="Report an issue and track it here."
              action={
                <Link href="/requests/new" className={button.secondary}>
                  <Plus className="h-4 w-4" /> New request
                </Link>
              }
            />
          )}
        </section>
      </div>
    </div>
  );
}
