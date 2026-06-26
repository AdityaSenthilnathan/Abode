"use client";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Lock, Plus } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { addSimulatedCardAction, confirmCardAction, createSetupIntentAction } from "@/actions/billing";
import { Badge, button } from "@/components/ui";

const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = pk ? loadStripe(pk) : null;

export interface SavedMethod {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm tabular-nums outline-none transition placeholder:text-muted/50 focus:border-brand focus:ring-2 focus:ring-brand/20";
const labelCls = "mb-1 block text-xs font-medium text-muted";

/* -------------------------------------------------------- card helpers (sim) */
function detectBrand(num: string): string {
  const n = num.replace(/\D/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  if (/^(6011|65|64[4-9])/.test(n)) return "Discover";
  return "Card";
}

/** Standard Luhn checksum — every well-known test card passes. */
function luhnValid(num: string): boolean {
  const n = num.replace(/\D/g, "");
  if (n.length < 13) return false;
  let sum = 0;
  let dbl = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = Number(n[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

function formatNumber(raw: string, brand: string): string {
  const max = brand === "Amex" ? 15 : 16;
  const n = raw.replace(/\D/g, "").slice(0, max);
  if (brand === "Amex") {
    return [n.slice(0, 4), n.slice(4, 10), n.slice(10, 15)].filter(Boolean).join(" ");
  }
  return n.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(raw: string): string {
  const n = raw.replace(/\D/g, "").slice(0, 4);
  return n.length <= 2 ? n : `${n.slice(0, 2)}/${n.slice(2)}`;
}

/* ------------------------------------------------------------- card preview */
function CardPreview({
  brand,
  number,
  name,
  expiry,
}: {
  brand: string;
  number: string;
  name: string;
  expiry: string;
}) {
  return (
    <div className="relative aspect-[1.586/1] w-full max-w-[22rem] overflow-hidden rounded-2xl bg-gradient-to-br from-brand via-accent to-accent-3 p-5 text-brand-foreground shadow-lg shadow-brand/20">
      {/* soft light wash */}
      <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/20 blur-2xl" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="h-7 w-10 rounded-md bg-white/30 ring-1 ring-white/40" aria-hidden />
          <span className="text-sm font-semibold tracking-wide opacity-90">{brand}</span>
        </div>
        <div className="font-mono text-lg tracking-[0.12em] drop-shadow-sm">
          {number || "•••• •••• •••• ••••"}
        </div>
        <div className="flex items-end justify-between gap-3 text-xs">
          <span className="min-w-0 truncate uppercase tracking-wide opacity-90">
            {name || "CARDHOLDER NAME"}
          </span>
          <span className="shrink-0 tabular-nums opacity-90">{expiry || "MM/YY"}</span>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------- simulated (no-Stripe) add card */
function SimulatedCardForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const brand = useMemo(() => detectBrand(number), [number]);
  const digits = number.replace(/\D/g, "");

  function fillTestCard() {
    setName("Demo Tenant");
    setNumber("4242 4242 4242 4242");
    setExpiry("12/30");
    setCvc("123");
    setErr(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const [mm, yy] = expiry.split("/");
    const month = Number(mm);
    const year = yy ? 2000 + Number(yy) : NaN;

    if (!luhnValid(digits)) return setErr("Enter a valid card number.");
    if (!(month >= 1 && month <= 12)) return setErr("Check the expiry month.");
    if (!(year >= 2000)) return setErr("Check the expiry year.");
    if (new Date(year, month, 1) <= new Date()) return setErr("That card looks expired.");
    if (cvc.replace(/\D/g, "").length < 3) return setErr("Enter the 3–4 digit security code.");

    setBusy(true);
    setErr(null);
    try {
      await addSimulatedCardAction({
        brand,
        last4: digits.slice(-4),
        expMonth: month,
        expYear: year,
      });
      onDone();
    } catch {
      setErr("Could not save card. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <CardPreview brand={brand} number={formatNumber(number, brand)} name={name} expiry={expiry} />

      <div className="grid gap-3">
        <div>
          <label className={labelCls} htmlFor="sim-name">
            Cardholder name
          </label>
          <input
            id="sim-name"
            className={inputCls}
            placeholder="Jane Tenant"
            value={name}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="sim-number">
            Card number
          </label>
          <input
            id="sim-number"
            inputMode="numeric"
            className={inputCls}
            placeholder="1234 5678 9012 3456"
            value={formatNumber(number, brand)}
            autoComplete="off"
            onChange={(e) => setNumber(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="sim-exp">
              Expiry
            </label>
            <input
              id="sim-exp"
              inputMode="numeric"
              className={inputCls}
              placeholder="MM/YY"
              value={expiry}
              autoComplete="off"
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="sim-cvc">
              CVC
            </label>
            <input
              id="sim-cvc"
              inputMode="numeric"
              className={inputCls}
              placeholder="123"
              value={cvc}
              autoComplete="off"
              onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </div>
        </div>
      </div>

      {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={button.primary}>
          {busy ? "Saving…" : "Save card"}
        </button>
        <button type="button" onClick={onCancel} className={button.secondary}>
          Cancel
        </button>
        <button
          type="button"
          onClick={fillTestCard}
          className="ml-auto text-xs font-medium text-brand underline-offset-2 hover:underline"
        >
          Use a test card
        </button>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Lock className="h-3.5 w-3.5" />
        Demo mode — no real card is charged or stored.
      </p>
    </form>
  );
}

/* ---------------------------------------------------- real Stripe card entry */
function StripeCardForm({ onDone }: { onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setErr(null);
    const { error, setupIntent } = await stripe.confirmSetup({ elements, redirect: "if_required" });
    if (error) {
      setErr(error.message ?? "Could not save card");
      setBusy(false);
      return;
    }
    if (setupIntent?.id) {
      await confirmCardAction(setupIntent.id);
      onDone();
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <PaymentElement />
      {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
      <button type="submit" disabled={busy} className={button.primary}>
        {busy ? "Saving…" : "Save card"}
      </button>
    </form>
  );
}

/* ---------------------------------------------------------------- list + add */
function SavedCard({ m }: { m: SavedMethod }) {
  const exp =
    m.expMonth && m.expYear
      ? `${String(m.expMonth).padStart(2, "0")}/${String(m.expYear).slice(-2)}`
      : null;
  return (
    <li className="flex items-center justify-between gap-3 p-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-12 items-center justify-center rounded-md bg-gradient-to-br from-brand to-accent text-brand-foreground">
          <CreditCard className="h-4 w-4" />
        </span>
        <div>
          <div className="text-sm font-medium capitalize">
            {m.brand ?? "Card"} •••• {m.last4 ?? "????"}
          </div>
          {exp && <div className="text-xs text-muted">Expires {exp}</div>}
        </div>
      </div>
      <Badge tone="neutral">Saved</Badge>
    </li>
  );
}

export function PaymentMethods({ saved, simulate = false }: { saved: SavedMethod[]; simulate?: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const done = () => {
    setAdding(false);
    setClientSecret(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {saved.length > 0 ? (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {saved.map((m) => (
            <SavedCard key={m.id} m={m} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No saved cards.</p>
      )}

      {/* Real Stripe path */}
      {stripePromise ? (
        !clientSecret ? (
          <button
            type="button"
            className={button.secondary}
            onClick={async () => {
              const cs = await createSetupIntentAction();
              if (cs) setClientSecret(cs);
            }}
          >
            <Plus className="h-4 w-4" /> Add a card
          </button>
        ) : (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <StripeCardForm onDone={done} />
          </Elements>
        )
      ) : simulate ? (
        /* Simulated (no-Stripe) demo path */
        adding ? (
          <SimulatedCardForm onDone={done} onCancel={() => setAdding(false)} />
        ) : (
          <button type="button" className={button.secondary} onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add a card
          </button>
        )
      ) : (
        <p className="text-sm text-muted">Card payments aren&apos;t enabled yet (Stripe keys needed).</p>
      )}
    </div>
  );
}
