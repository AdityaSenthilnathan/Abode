import { CreditCard } from "lucide-react";
import { assertRole } from "@/server/auth/guard";
import { devBypass } from "@/server/config";
import { listInvoices, listMyPaymentMethods } from "@/server/services/billing";
import { stripeConfigured } from "@/server/stripe";
import { payInvoiceAction, payLaterAction } from "@/actions/billing";
import { PaymentMethods } from "@/components/tenant/payment-methods";
import { formatCents } from "@/lib/utils";
import { NotConnected } from "@/components/not-connected";
import { Badge, Card, EmptyState, SectionHeader, invoiceTone } from "@/components/ui";

const payBtn =
  "inline-flex items-center justify-center rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground transition hover:brightness-110";
const laterBtn =
  "inline-flex items-center justify-center rounded-lg border border-line px-3 py-1.5 text-xs font-medium transition hover:bg-surface-2";

export default async function DuesPage() {
  const user = await assertRole("tenant");
  let invoices: Awaited<ReturnType<typeof listInvoices>> = [];
  let methods: Awaited<ReturnType<typeof listMyPaymentMethods>> = [];
  let dbReady = true;
  try {
    [invoices, methods] = await Promise.all([listInvoices(user.id), listMyPaymentMethods(user.id)]);
  } catch {
    dbReady = false;
  }
  const firstMethod = methods[0]?.id ?? null;
  // Offline dev: no Stripe → still allow paying (records the payment directly).
  const canDevPay = !stripeConfigured() && devBypass();

  if (!dbReady) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Dues</h1>
        <NotConnected />
      </div>
    );
  }

  const payable = invoices.filter((i) => i.status === "unpaid" || i.status === "late");
  const balanceCents = payable.reduce((s, i) => s + i.amountCents, 0);

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
        <div className="text-sm text-muted">
          {payable.length
            ? `${payable.length} unpaid invoice${payable.length > 1 ? "s" : ""}`
            : "You're all caught up 🎉"}
        </div>
      </Card>

      <section className="space-y-3">
        <SectionHeader title="Invoices" />
        {invoices.length === 0 ? (
          <EmptyState icon={CreditCard} title="No invoices" hint="Nothing is due right now." />
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {invoices.map((inv) => {
              const isPayable = inv.status === "unpaid" || inv.status === "late";
              return (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="font-medium capitalize">{inv.type}</div>
                    <div className="mt-0.5 text-xs text-muted">Due {inv.dueDate}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{formatCents(inv.amountCents)}</span>
                    <Badge tone={invoiceTone(inv.status)}>{inv.status}</Badge>
                    {isPayable && (
                      <div className="flex gap-2">
                        {(firstMethod || canDevPay) && (
                          <form action={payInvoiceAction}>
                            <input type="hidden" name="invoiceId" value={inv.id} />
                            {firstMethod && (
                              <input type="hidden" name="paymentMethodId" value={firstMethod} />
                            )}
                            <button className={payBtn}>Pay</button>
                          </form>
                        )}
                        <form action={payLaterAction}>
                          <input type="hidden" name="invoiceId" value={inv.id} />
                          <button className={laterBtn}>Pay later</button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader title="Payment methods" />
        <Card className="p-5">
          <PaymentMethods saved={methods} devAdd={canDevPay} />
        </Card>
      </section>
    </div>
  );
}
