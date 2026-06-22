"use client";
import { useState, type ComponentType, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Auth input fields — a leading icon, soft glass surface, and a brand focus
 * ring. Shared by the login + signup forms so every auth screen feels the
 * same. PasswordField adds an inline show/hide toggle.
 */

type Icon = ComponentType<{ className?: string }>;
type FieldProps = InputHTMLAttributes<HTMLInputElement> & { icon: Icon };

const base =
  "w-full rounded-xl border border-line bg-surface/60 py-2.5 pl-10 text-sm text-foreground outline-none backdrop-blur transition placeholder:text-muted/70 focus:border-brand/60 focus:ring-2 focus:ring-brand/20";

export function TextField({ icon: Icon, className, ...props }: FieldProps) {
  return (
    <div className="group relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted transition-colors group-focus-within:text-brand" />
      <input {...props} className={cn(base, "pr-3", className)} />
    </div>
  );
}

export function PasswordField({ icon: Icon, className, ...props }: FieldProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="group relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted transition-colors group-focus-within:text-brand" />
      <input
        {...props}
        type={show ? "text" : "password"}
        className={cn(base, "pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted transition hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
