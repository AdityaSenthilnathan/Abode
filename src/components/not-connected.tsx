/** Shown by role pages when the database isn't reachable yet (pre-provisioning). */
export function NotConnected() {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
      <div className="font-medium">Database not connected yet</div>
      <p className="mt-1 opacity-80">
        Provision dev infra, set <code>DATABASE_URL</code> in <code>.env.local</code>, then run{" "}
        <code>npm run db:migrate &amp;&amp; npm run db:seed</code>.
      </p>
    </div>
  );
}
