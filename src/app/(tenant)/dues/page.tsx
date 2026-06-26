import { CreditCard, Plus, Zap } from "lucide-react";
import { assertRole } from "@/server/auth/guard";
import { simulatePayments } from "@/server/config";
import {
  getAutopaySettings,
  listInvoices,
  listMyPaymentMethods,
  listPaymentHistory,
} from "@/server/services/billing";
import {
  addTestInvoiceAction,
  payAllAction,
  payInvoiceAction,
  requestPayLaterAction,
} from "@/actions/billing";
import { PaymentMethods } from "@/components/tenant/payment-methods";
import { AutopayToggle } from "@/components/tenant/autopay-toggle";
import { PaymentHistory } from "@/components/tenant/payment-history";
import { CollapsibleSection } from "@/components/tenant/collapsible-section";
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
  relativeDue,
} from "@/components/ui";

const payBtn =
  "inline-flex items-center justify-center rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground transition hover:brightness-110";
const laterBtn =
  "inline-flex items-center justify-center rounded-lg border border-line px-3 py-1.5 text-xs font-medium transition hover:bg-surface-2";
const payAllBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-sm transition hover:brightness-110";

/** Friendly, editable message the tenant lands on in the owner chat. */
function payLaterDraft(inv: { type: string; amountCents: number; dueDate: string }): string {
  return `Hi! Would it be possible to pay the ${inv.type} invoice of ${formatCents(inv.amountCents)} (due ${inv.dueDate}) in the next cycle? I'll make sure to settle it then — thank you!`;
}

/** "Autopay in 7 days" — when this invoice will be auto-charged (due date − lead). */
function autopayHint(dueDate: string, leadDays: number): string {
  const d = new Date(`${dueDate}T00:00:00`);
  d.setDate(d.getDate() - leadDays);
  const { days } = relativeDue(d.toISOString().slice(0, 10));
  return days <= 0 ? "Autopay today" : days === 1 ? "Autopay tomorrow" : `Autopay in ${days} days`;
}

export default async function DuesPage() {
  const user = await assertRole("tenant");
  let invoices: Awaited<ReturnType<typeof listInvoices>> = [];
  let methods: Awaited<ReturnType<typeof listMyPaymentMethods>> = [];
  let autopaySettings: Awaited<ReturnType<typeof getAutopaySettings>> = { enabled: false, leadDays: 0 };
  let history: Awaited<ReturnType<typeof listPaymentHistory>> = [];
  let dbReady = true;
  try {
    [invoices, methods, autopaySettings, history] = await Promise.all([
      listInvoices(user.id),
      listMyPaymentMethods(user.id),
      getAutopaySettings(user.id),
      listPaymentHistory(user.id),
    ]);
  } catch {
    dbReady = false;
  }
  const firstMethod = methods[0]?.id ?? null;
  const firstCardLabel = methods[0]
    ? `${methods[0].brand ?? "Card"} •••• ${methods[0].last4 ?? "????"}`
    : null;
  const autopay = autopaySettings.enabled;
  const leadDays = autopaySettings.leadDays;
  // No Stripe → simulated demo mode: allow adding cards and paying directly.
  const sim = simulatePayments();

  if (!dbReady) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Dues</h1>
        <NotConnected />
      </div>
    );
  }

  const outstanding = invoices.filter((i) => i.status !== "paid").sort(byInvoiceUrgency);
  const balanceCents = outstanding.reduce((s, i) => s + i.amountCents, 0);
  const showPayAll =
    (sim || Boolean(firstMethod)) && (autopay ? outstanding.length >= 1 : outstanding.length >= 2);
  const historyItems = history.map((h) => ({ ...h, paidAt: h.paidAt.toISOString() }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dues</h1>
        <p className="mt-1 text-sm text-muted">Pay rent and utilities, or ask to defer.</p>
      </div>

      {/* balance summary */}
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <CreditCard className="h-6 w-6" />
          </span>
          <div>
            <div className="text-sm text-muted">Balance due</div>
            <div className="text-3xl font-semibold tracking-tight">{formatCents(balanceCents)}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-4">
          <span className="text-sm text-muted">
            {!outstanding.length
              ? autopay
                ? "Autopay on ⚡"
                : "You're all caught up 🎉"
              : autopay
                ? `${outstanding.length} scheduled ⚡`
                : `${outstanding.length} invoice${outstanding.length > 1 ? "s" : ""} due`}
          </span>
          {showPayAll && (
            <form action={payAllAction}>
              <button className={payAllBtn}>Pay all · {formatCents(balanceCents)}</button>
            </form>
          )}
        </div>
      </Card>

      <CollapsibleSection
        title="Invoices"
        count={outstanding.length}
        action={
          sim ? (
            <form action={addTestInvoiceAction}>
              <button className={button.ghost} title="Demo: add an unpaid invoice to test with">
                <Plus className="h-3.5 w-3.5" /> Add test invoice
              </button>
            </form>
          ) : undefined
        }
      >
        {outstanding.length === 0 ? (
          <EmptyState icon={CreditCard} title="You're all caught up 🎉" hint="No invoices due right now." />
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {outstanding.map((inv) => {
              const canRequestLater = inv.status === "unpaid" || inv.status === "late";
              return (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="font-medium capitalize">{inv.type}</div>
                    <div className="mt-0.5 text-xs">
                      <DueLabel dueDate={inv.dueDate} status={inv.status} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{formatCents(inv.amountCents)}</span>
                    <Badge tone={invoiceTone(inv.status)}>{inv.status}</Badge>
                    {autopay ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">
                        <Zap className="h-3 w-3" /> {autopayHint(inv.dueDate, leadDays)}
                      </span>
                    ) : (
                      <div className="flex flex-wrap justify-end gap-2">
                        {(firstMethod || sim) && (
                          <form action={payInvoiceAction}>
                            <input type="hidden" name="invoiceId" value={inv.id} />
                            {firstMethod && (
                              <input type="hidden" name="paymentMethodId" value={firstMethod} />
                            )}
                            <button className={payBtn}>Pay</button>
                          </form>
                        )}
                        {canRequestLater && (
                          <form action={requestPayLaterAction}>
                            <input type="hidden" name="invoiceId" value={inv.id} />
                            <input type="hidden" name="draft" value={payLaterDraft(inv)} />
                            <button className={laterBtn}>Request to pay later</button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Payment history" count={historyItems.length}>
        <PaymentHistory items={historyItems} />
      </CollapsibleSection>

      <section className="space-y-3">
        <SectionHeader title="Payment methods" />
        <Card className="space-y-4 p-5">
          <PaymentMethods saved={methods} simulate={sim} />
          {sim && <AutopayToggle enabled={autopay} leadDays={leadDays} cardLabel={firstCardLabel} />}
        </Card>
      </section>
    </div>
  );
}
