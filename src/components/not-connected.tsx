import { TriangleAlert } from "lucide-react";

/** Shown by role pages when the database isn't reachable yet (pre-provisioning). */
export function NotConnected() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div>
        <div className="font-medium">Database not connected yet</div>
        <p className="mt-1 text-muted">
          Provision dev infra, set <code>DATABASE_URL</code> in <code>.env.local</code>, then run{" "}
          <code>npm run db:migrate &amp;&amp; npm run db:seed</code>.
        </p>
      </div>
    </div>
  );
}
