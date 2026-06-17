"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { addDevCardAction, confirmCardAction, createSetupIntentAction } from "@/actions/billing";

const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = pk ? loadStripe(pk) : null;

export interface SavedMethod {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}

function CardForm({ onDone }: { onDone: () => void }) {
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
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button
        disabled={busy}
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save card"}
      </button>
    </form>
  );
}

export function PaymentMethods({ saved, devAdd = false }: { saved: SavedMethod[]; devAdd?: boolean }) {
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-3">
      {saved.length > 0 ? (
        <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
          {saved.map((m) => (
            <li key={m.id} className="flex items-center justify-between p-3 text-sm">
              <span className="capitalize">
                {m.brand ?? "card"} •••• {m.last4 ?? "????"}
              </span>
              <span className="opacity-50">
                {m.expMonth}/{m.expYear}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm opacity-60">No saved cards.</p>
      )}

      {!stripePromise ? (
        devAdd ? (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await addDevCardAction();
              router.refresh();
              setBusy(false);
            }}
            className="rounded-lg border border-black/15 px-4 py-2 text-sm hover:bg-black/5 disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10"
          >
            {busy ? "Adding…" : "Add a test card"}
          </button>
        ) : (
          <p className="text-sm opacity-60">Card payments aren&apos;t enabled yet (Stripe keys needed).</p>
        )
      ) : !clientSecret ? (
        <button
          onClick={async () => {
            const cs = await createSetupIntentAction();
            if (cs) setClientSecret(cs);
          }}
          className="rounded-lg border border-black/15 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Add a card
        </button>
      ) : (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <CardForm
            onDone={() => {
              setClientSecret(null);
              router.refresh();
            }}
          />
        </Elements>
      )}
    </div>
  );
}
