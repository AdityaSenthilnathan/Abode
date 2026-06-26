"use client";
import { useState, type ReactNode } from "react";
import { Check, Receipt as ReceiptIcon, X } from "lucide-react";
import { formatCents } from "@/lib/utils";

export interface HistoryItem {
  id: string;
  amountCents: number;
  paidAt: string; // ISO
  status: string;
  invoiceType: string;
  invoiceDescription: string | null;
  brand: string | null;
  last4: string | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
function methodLabel(p: HistoryItem) {
  return p.last4 ? `${p.brand ?? "Card"} •••• ${p.last4}` : null;
}

export function PaymentHistory({ items }: { items: HistoryItem[] }) {
  const [open, setOpen] = useState<HistoryItem | null>(null);
  if (items.length === 0) {
    return <p className="text-sm text-muted">No payments yet — your receipts will show up here.</p>;
  }
  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {items.map((p) => {
          const method = methodLabel(p);
          return (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-medium capitalize">{p.invoiceType}</div>
                  <div className="text-xs text-muted">
                    Paid {fmtDate(p.paidAt)}
                    {method ? ` · ${method}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{formatCents(p.amountCents)}</span>
                <button
                  type="button"
                  onClick={() => setOpen(p)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium transition hover:bg-surface-2"
                >
                  <ReceiptIcon className="h-3.5 w-3.5" /> Receipt
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {open && <ReceiptModal item={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function ReceiptModal({ item, onClose }: { item: HistoryItem; onClose: () => void }) {
  const receiptNo = `RCPT-${item.id.slice(0, 8).toUpperCase()}`;
  const method = methodLabel(item);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-lg font-semibold tracking-tight">Receipt</div>
            <div className="text-xs text-muted">{receiptNo}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt"
            className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="my-5 flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 py-3 text-emerald-600 dark:text-emerald-400">
          <Check className="h-5 w-5" />
          <span className="font-semibold">
            {item.status === "succeeded" ? "Payment successful" : `Payment ${item.status}`}
          </span>
        </div>

        <dl className="space-y-2.5 text-sm">
          <ReceiptRow k="Amount" v={formatCents(item.amountCents)} strong />
          <ReceiptRow
            k="For"
            v={
              <span className="capitalize">
                {item.invoiceType}
                {item.invoiceDescription ? ` — ${item.invoiceDescription}` : ""}
              </span>
            }
          />
          <ReceiptRow k="Date" v={fmtDate(item.paidAt)} />
          <ReceiptRow k="Method" v={method ?? "—"} />
          <ReceiptRow k="Receipt #" v={receiptNo} />
        </dl>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition hover:brightness-110"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function ReceiptRow({ k, v, strong }: { k: string; v: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className={strong ? "font-semibold" : ""}>{v}</dd>
    </div>
  );
}
