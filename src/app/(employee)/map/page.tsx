import { assertRole } from "@/server/auth/guard";
import { mapProperties } from "@/server/services/handyman";
import { PropertyMap } from "@/components/handyman/property-map";
import { NotConnected } from "@/components/not-connected";

export default async function MapPage() {
  const user = await assertRole("employee");
  let mapProps: Awaited<ReturnType<typeof mapProperties>> = [];
  let dbReady = true;
  try {
    mapProps = await mapProperties(user.id);
  } catch {
    dbReady = false;
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

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
          {mapProps.length === 0 ? (
            <p className="text-sm opacity-60">No properties with a location yet.</p>
          ) : (
            <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
              {mapProps.map((p) => (
                <li key={p.id} className="p-3">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm opacity-60">{p.address ?? "—"}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
