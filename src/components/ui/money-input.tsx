"use client";
import { useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const field =
  "rounded-lg border border-line bg-background text-sm outline-none transition focus:border-brand";

/**
 * Dollar-amount input with a themed up/down stepper.
 *
 * The native `type=number` spinner is an OS control that can't be recolored, so
 * we hide it and render our own chevron buttons. The `<input>` itself carries the
 * border (it's the focused element) so the global `:focus-visible` ring hugs the
 * visible box; the `$` prefix and stepper sit absolutely on top of it.
 */
export function MoneyInput({
  name,
  placeholder,
  required,
  defaultValue,
  step = "0.01",
  min = "0",
  widthClass = "w-28",
}: {
  name: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | number;
  step?: string;
  min?: string;
  widthClass?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  function bump(dir: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    if (dir > 0) el.stepUp();
    else el.stepDown();
    // Let forms / listeners see the programmatic change.
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.focus();
  }

  return (
    <div className={`relative ${widthClass}`}>
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted">
        $
      </span>
      <input
        ref={ref}
        name={name}
        type="number"
        step={step}
        min={min}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        className={`${field} w-full py-1.5 pl-5 pr-7 [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none`}
      />
      <div className="absolute inset-y-1 right-1 flex w-5 flex-col overflow-hidden rounded-md">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Increase amount"
          onClick={() => bump(1)}
          className="flex flex-1 items-center justify-center text-muted transition hover:bg-surface-2 hover:text-brand active:bg-surface-2"
        >
          <ChevronUp className="h-3 w-3" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Decrease amount"
          onClick={() => bump(-1)}
          className="flex flex-1 items-center justify-center text-muted transition hover:bg-surface-2 hover:text-brand active:bg-surface-2"
        >
          <ChevronDown className="h-3 w-3" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
