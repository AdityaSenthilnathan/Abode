import { assertRole } from "@/server/auth/guard";
import { withUser } from "@/server/db/rls";
import { properties } from "@db/schema";
import { PropertyMap } from "@/components/handyman/property-map";
import { NotConnected } from "@/components/not-connected";

function loadProps(userId: string) {
  return withUser(userId, (tx) => tx.select().from(properties));
}

export default async function MapPage() {
  const user = await assertRole("employee");
  let props: Awaited<ReturnType<typeof loadProps>> = [];
  let dbReady = true;
  try {
    props = await loadProps(user.id);
  } catch {
    dbReady = false;
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapProps = props
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({ id: p.id, name: p.name, address: p.address, lat: Number(p.lat), lng: Number(p.lng) }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Map</h1>
        <p className="text-sm opacity-60">Where your jobs are.</p>
      </div>

      {!dbReady ? (
        <NotConnected />
      ) : token && mapProps.length > 0 ? (
        <PropertyMap token={token} properties={mapProps} />
      ) : (
        <div className="space-y-3">
          {!token && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              Add <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> to <code>.env.local</code> for the interactive map.
            </p>
          )}
          {props.length === 0 ? (
            <p className="text-sm opacity-60">No properties yet.</p>
          ) : (
            <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
              {props.map((p) => (
                <li key={p.id} className="p-3">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm opacity-60">
                    {p.address ?? "—"}
                    {p.lat != null ? ` · ${Number(p.lat).toFixed(4)}, ${Number(p.lng).toFixed(4)}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
