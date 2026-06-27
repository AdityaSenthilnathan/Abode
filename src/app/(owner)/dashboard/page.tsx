import Link from "next/link";
import {
  Banknote,
  Building2,
  CreditCard,
  DoorOpen,
  Receipt,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { assertRole } from "@/server/auth/guard";
import { ownerPortfolio, ownerStats, type PortfolioProperty, type PortfolioUnit } from "@/server/services/owner";
import { formatCents } from "@/lib/utils";
import { NotConnected } from "@/components/not-connected";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge, Card, EmptyState, SectionHeader } from "@/components/ui";
import { PropertyStaticMap } from "@/components/owner/property-static-map";

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
        <Icon className="h-4 w-4 text-muted" />
      </div>
      <div className={`mt-2 text-2xl font-semibold tracking-tight ${tone ?? ""}`}>{value}</div>
    </>
  );
  if (href) {
    return (
      <Link href={href}>
        <Card className="p-4 transition hover:border-brand/40 hover:bg-surface-2">{inner}</Card>
      </Link>
    );
  }
  return <Card className="p-4">{inner}</Card>;
}

function UnitChip({ propertyId, u }: { propertyId: string; u: PortfolioUnit }) {
  return (
    <Link
      href={`/properties#prop-${propertyId}`}
      className="group flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-2/40 px-3 py-2 transition hover:border-brand/40 hover:bg-surface-2"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${u.status === "occupied" ? "bg-emerald-500" : "bg-muted/40"}`}
          />
          <span className="whitespace-nowrap font-medium">Unit {u.unitNumber}</span>
        </div>
        <div className="truncate text-xs text-muted">{u.tenantName ?? "Vacant"}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {u.openRequests > 0 && (
          <Badge tone="warning" className="gap-1">
            <Wrench className="h-3 w-3" />
            {u.openRequests}
          </Badge>
        )}
        {u.unpaidCount > 0 && (
          <Badge tone="danger" className="gap-1">
            <CreditCard className="h-3 w-3" />
            {u.unpaidCount}
          </Badge>
        )}
      </div>
    </Link>
  );
}

function PropertyCard({ p, token }: { p: PortfolioProperty; token?: string }) {
  return (
    <Card id={`prop-${p.id}`} className="h-full overflow-hidden scroll-mt-24">
      {/* h-full on the row so the map column stretches to the (grid-equalized)
          card height — keeps every property's map filling its box uniformly. */}
      <div className="flex h-full flex-col sm:flex-row">
        <PropertyStaticMap
          lat={p.lat}
          lng={p.lng}
          token={token}
          className="h-32 w-full shrink-0 border-b border-line sm:h-auto sm:w-48 sm:border-b-0 sm:border-r"
          alt={`Map of ${p.name}`}
        />
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-semibold tracking-tight">{p.name}</h3>
              {p.address && <p className="truncate text-sm text-muted">{p.address}</p>}
            </div>
            <Link
              href={`/properties#prop-${p.id}`}
              className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-brand transition hover:bg-brand/10"
            >
              Manage →
            </Link>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral" className="gap-1 normal-case">
              <DoorOpen className="h-3 w-3" />
              {p.occupied}/{p.units.length} occupied
            </Badge>
            <Badge tone="success" className="gap-1 normal-case">
              <Banknote className="h-3 w-3" />
              {formatCents(p.monthlyRentCents)}/mo
            </Badge>
            {p.openRequests > 0 && (
              <Link href="/fix-it" className="transition hover:brightness-95" title="View open fixes">
                <Badge tone="warning" className="gap-1 normal-case">
                  <Wrench className="h-3 w-3" />
                  {p.openRequests} open fix{p.openRequests === 1 ? "" : "es"}
                </Badge>
              </Link>
            )}
            {p.unpaidCount > 0 && (
              <Link href="/payments" className="transition hover:brightness-95" title="View unpaid invoices">
                <Badge tone="danger" className="gap-1 normal-case">
                  <CreditCard className="h-3 w-3" />
                  {p.unpaidCount} unpaid
                </Badge>
              </Link>
            )}
          </div>

          {p.units.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No units yet — add one from Properties.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {p.units.map((u) => (
                <UnitChip key={u.id} propertyId={p.id} u={u} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default async function OwnerDashboard() {
  const user = await assertRole("owner");
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  let portfolio: PortfolioProperty[] = [];
  let stats: Awaited<ReturnType<typeof ownerStats>> | null = null;
  let dbReady = true;
  try {
    [portfolio, stats] = await Promise.all([ownerPortfolio(user.id), ownerStats(user.id)]);
  } catch {
    dbReady = false;
  }

  if (!dbReady || !stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <NotConnected />
      </div>
    );
  }

  const unitCount = portfolio.reduce((s, p) => s + p.units.length, 0);

  return (
    <div className="space-y-8">
      <AutoRefresh />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">Your portfolio at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi
          label="Revenue (paid)"
          value={formatCents(stats.revenueCents)}
          icon={TrendingUp}
          tone="text-emerald-600 dark:text-emerald-400"
        />
        <Kpi label="Expenses" value={formatCents(stats.expensesCents)} icon={Receipt} />
        <Kpi
          label="Open fixes"
          value={String(stats.openFixes)}
          icon={Wrench}
          tone={stats.openFixes ? "text-orange-600 dark:text-orange-400" : ""}
          href="/fix-it"
        />
        <Kpi
          label="Unpaid"
          value={String(stats.unpaidCount)}
          icon={CreditCard}
          tone={stats.unpaidCount ? "text-red-600 dark:text-red-400" : ""}
          href="/payments"
        />
        <Kpi label="Staff" value={String(stats.employeeCount)} icon={Users} />
      </div>

      <section className="space-y-3">
        <SectionHeader
          title="Properties"
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
            hint="Add your first property to start tracking units, tenants, and revenue."
            action={
              <Link
                href="/properties"
                className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:brightness-110"
              >
                Add a property
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {portfolio.map((p) => (
              <PropertyCard key={p.id} p={p} token={token} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
