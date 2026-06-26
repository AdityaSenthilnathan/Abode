"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { setAutopayAction, setAutopayLeadDaysAction } from "@/actions/billing";

const PRESETS = [
  { days: 0, label: "On the due date" },
  { days: 5, label: "5 days before" },
];

export function AutopayToggle({
  enabled,
  leadDays,
  cardLabel,
}: {
  enabled: boolean;
  leadDays: number;
  cardLabel: string | null;
}) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [lead, setLead] = useState(leadDays);
  const [custom, setCustom] = useState(PRESETS.some((p) => p.days === leadDays) ? "" : String(leadDays));
  const [pending, start] = useTransition();
  const canEnable = Boolean(cardLabel);
  const isCustom = !PRESETS.some((p) => p.days === lead);

  function toggle() {
    if (pending || (!on && !canEnable)) return;
    const next = !on;
    setOn(next); // optimistic
    start(async () => {
      await setAutopayAction(next);
      router.refresh();
    });
  }

  function commitLead(days: number) {
    const v = Math.max(0, Math.min(60, Math.round(days) || 0));
    setLead(v);
    setCustom(PRESETS.some((p) => p.days === v) ? "" : String(v));
    start(async () => {
      await setAutopayLeadDaysAction(v);
      router.refresh();
    });
  }

  const desc = on
    ? `Invoices are paid automatically${cardLabel ? ` with ${cardLabel}` : ""}.`
    : canEnable
      ? "Pay every invoice on its due date — hands-free."
      : "Add a card to turn on autopay.";

  const pill = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
      active ? "border-brand bg-brand/10 text-brand" : "border-line hover:bg-surface-2"
    }`;

  return (
    <div className="rounded-xl border border-line bg-surface-2/40 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              on ? "bg-brand/15 text-brand" : "bg-foreground/[0.06] text-muted"
            }`}
          >
            <Zap className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-medium">Automatic payments</div>
            <div className="mt-0.5 text-xs text-muted">{desc}</div>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Toggle automatic payments"
          disabled={pending || (!on && !canEnable)}
          onClick={toggle}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
            on ? "bg-brand" : "bg-line"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
              on ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {on && (
        <div className="mt-4 border-t border-line/70 pt-3">
          <div className="mb-2 text-xs font-medium text-muted">When to charge</div>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                type="button"
                disabled={pending}
                onClick={() => commitLead(p.days)}
                className={pill(lead === p.days)}
              >
                {p.label}
              </button>
            ))}
            <div
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 ${
                isCustom ? "border-brand bg-brand/10" : "border-line"
              }`}
            >
              <input
                type="text"
                inputMode="numeric"
                aria-label="Custom days before due date"
                placeholder="0"
                value={custom}
                disabled={pending}
                onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 2))}
                onBlur={() => custom !== "" && commitLead(Number(custom))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-8 bg-transparent text-center text-xs outline-none"
              />
              <span className="text-xs text-muted">days before</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
