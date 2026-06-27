import { CheckCircle2, CreditCard } from "lucide-react";
import { assertRole } from "@/server/auth/guard";
import { ownerOutstanding, type OutstandingInvoice } from "@/server/services/owner";
import { formatCents } from "@/lib/utils";
import { NotConnected } from "@/components/not-connected";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge, Card, DueLabel, EmptyState, invoiceTone } from "@/components/ui";

export default async function PaymentsPage() {
  const user = await assertRole("owner");
  let rows: OutstandingInvoice[] = [];
  let dbReady = true;
  try {
    rows = await ownerOutstanding(user.id);
  } catch {
    dbReady = false;
  }

  if (!dbReady) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <NotConnected />
      </div>
    );
  }

  const total = rows.reduce((s, r) => s + r.amountCents, 0);

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Payments</h1>
        <p className="mt-1 text-sm text-muted">Outstanding rent and utility invoices across your units.</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Nothing outstanding" hint="Every invoice across your units is paid." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Outstanding</span>
                <CreditCard className="h-4 w-4 text-muted" />
              </div>
              <div className="mt-2 text-2xl font-semibold text-red-600 dark:text-red-400">{formatCents(total)}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Invoices</span>
              </div>
              <div className="mt-2 text-2xl font-semibold">{rows.length}</div>
            </Card>
          </div>

          <Card className="divide-y divide-line overflow-hidden">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="font-medium">
                    {formatCents(r.amountCents)} <span className="capitalize text-muted">· {r.type}</span>
                  </div>
                  <div className="truncate text-xs text-muted">
                    {r.tenantName ?? "No tenant"} · {r.propertyName} · Unit {r.unitNumber}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-sm">
                  <DueLabel dueDate={r.dueDate} status={r.status} />
                  <Badge tone={invoiceTone(r.status)}>{r.status}</Badge>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
