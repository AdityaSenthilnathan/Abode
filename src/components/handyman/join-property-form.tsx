"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Plus, X } from "lucide-react";
import { joinPropertyAction, type JoinPropertyState } from "@/actions/employee";

const initial: JoinPropertyState = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Joining…" : "Join"}
    </button>
  );
}

/** Lets a worker join another property by entering an employer code from a manager. */
export function JoinPropertyForm() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(joinPropertyAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the input after a successful join so the next code starts fresh.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold transition hover:bg-surface-2"
      >
        <Plus className="h-3.5 w-3.5" />
        Join a property
      </button>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold">Join a property</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="grid h-6 w-6 place-items-center rounded-md text-muted transition hover:bg-surface-2 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <form ref={formRef} action={action} className="flex items-center gap-2">
        <input
          name="code"
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="ABODE-XXXXXX"
          className="min-w-0 flex-1 rounded-lg border border-line bg-background px-2.5 py-1.5 text-xs tracking-wide uppercase outline-none focus:border-foreground/30"
        />
        <SubmitButton />
      </form>
      {state.ok ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5" />
          Joined {state.propertyName ?? "the property"}. New jobs will appear here.
        </p>
      ) : state.error ? (
        <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{state.error}</p>
      ) : (
        <p className="mt-2 text-xs text-muted">Ask the manager for the property&apos;s employer code.</p>
      )}
    </div>
  );
}
