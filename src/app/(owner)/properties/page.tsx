import { Building2, Plus } from "lucide-react";
import { assertRole } from "@/server/auth/guard";
import { ownerPortfolio, type PortfolioProperty } from "@/server/services/owner";
import { createPropertyAction } from "@/actions/invites";
import { NotConnected } from "@/components/not-connected";
import { AutoRefresh } from "@/components/auto-refresh";
import { Collapsible } from "@/components/collapsible";
import { AddPropertyForm } from "@/components/owner/add-property-form";
import { PropertyManageCard } from "@/components/owner/property-manage-card";
import { PortfolioMap } from "@/components/owner/portfolio-map";
import { EmptyState, SectionHeader } from "@/components/ui";

export default async function PropertiesPage() {
  const user = await assertRole("owner");
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  let portfolio: PortfolioProperty[] = [];
  let dbReady = true;
  try {
    portfolio = await ownerPortfolio(user.id);
  } catch {
    dbReady = false;
  }

  if (!dbReady) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Properties</h1>
        <NotConnected />
      </div>
    );
  }

  const mapProps = portfolio
    .filter((p): p is PortfolioProperty & { lat: number; lng: number } => p.lat != null && p.lng != null)
    .map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      unitCount: p.units.length,
      occupied: p.occupied,
      openRequests: p.openRequests,
    }));
  const unitCount = portfolio.reduce((s, p) => s + p.units.length, 0);

  return (
    <div className="space-y-8">
      <AutoRefresh />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Properties</h1>
        <p className="mt-1 text-sm text-muted">Manage your buildings, units, and tenants.</p>
      </div>

      {token && mapProps.length > 0 && <PortfolioMap token={token} properties={mapProps} />}

      <Collapsible
        icon={<Plus className="h-[18px] w-[18px]" />}
        title="Add a property"
        subtitle="Search a real address — only map-verified locations can be added."
        defaultOpen={portfolio.length === 0}
      >
        <AddPropertyForm action={createPropertyAction} token={token} />
      </Collapsible>

      <section className="space-y-3">
        <SectionHeader
          title="Your properties"
          icon={Building2}
          action={
            <span className="text-sm text-muted">
              {portfolio.length} propert{portfolio.length === 1 ? "y" : "ies"} · {unitCount} unit
              {unitCount === 1 ? "" : "s"}
            </span>
          }
        />
        {portfolio.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No properties yet"
            hint="Use “Add a property” above to register your first building."
          />
        ) : (
          <div className="space-y-4">
            {portfolio.map((p) => (
              <PropertyManageCard key={p.id} property={p} token={token} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
