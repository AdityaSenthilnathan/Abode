import { assertRole } from "@/server/auth/guard";
import { listInvoices, listMyPaymentMethods } from "@/server/services/billing";
import { payInvoiceAction, payLaterAction } from "@/actions/billing";
import { PaymentMethods } from "@/components/tenant/payment-methods";
import { formatCents } from "@/lib/utils";
import { NotConnected } from "@/components/not-connected";

const BADGE: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  unpaid: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  late: "bg-red-500/15 text-red-700 dark:text-red-300",
  deferred: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300",
};

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

  if (!dbReady) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dues</h1>
        <NotConnected />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Dues</h1>
        {invoices.length === 0 ? (
          <p className="text-sm opacity-60">You&apos;re all caught up.</p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {invoices.map((inv) => {
              const payable = inv.status === "unpaid" || inv.status === "late";
              return (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="font-medium capitalize">{inv.type}</div>
                    <div className="mt-0.5 text-sm opacity-60">Due {inv.dueDate}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatCents(inv.amountCents)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${BADGE[inv.status] ?? ""}`}>
                      {inv.status}
                    </span>
                    {payable && (
                      <div className="flex gap-2">
                        {firstMethod && (
                          <form action={payInvoiceAction}>
                            <input type="hidden" name="invoiceId" value={inv.id} />
                            <input type="hidden" name="paymentMethodId" value={firstMethod} />
                            <button className="rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background">
                              Pay
                            </button>
                          </form>
                        )}
                        <form action={payLaterAction}>
                          <input type="hidden" name="invoiceId" value={inv.id} />
                          <button className="rounded-md border border-black/15 px-2.5 py-1.5 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
                            Pay later
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Payment methods</h2>
        <PaymentMethods saved={methods} />
      </section>
    </div>
  );
}
