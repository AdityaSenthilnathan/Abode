import Link from "next/link";
import type { ReactNode } from "react";
import {
  Building2,
  DoorOpen,
  HardHat,
  Home,
  MapPin,
  ScrollText,
  Sun,
  Type,
  UserRound,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { assertRole } from "@/server/auth/guard";
import { getOwnerAccount } from "@/server/services/account";
import { formatCents } from "@/lib/utils";
import { Badge, Card, SectionHeader, button } from "@/components/ui";
import { NotConnected } from "@/components/not-connected";
import { TextSizeControl } from "@/components/tenant/text-size";
import { AccountProfileHeader, ContactRow, Row } from "@/components/account-ui";

/** A single headline number in the "Business at a glance" card. */
function StatTile({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="px-5 py-4">
      <div className={`text-2xl font-semibold tracking-tight ${accent ?? ""}`}>{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}

export default async function OwnerAccountPage() {
  const user = await assertRole("owner");

  let data: Awaited<ReturnType<typeof getOwnerAccount>> | null = null;
  let dbReady = true;
  try {
    data = await getOwnerAccount(user.id);
  } catch {
    dbReady = false;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-muted">Your portfolio, your team, and how the business is doing.</p>
      </header>

      <AccountProfileHeader
        name={user.fullName}
        email={user.email}
        fallback="Owner"
        badge={
          <Badge tone="brand" className="gap-1">
            <ScrollText className="h-3.5 w-3.5" /> Owner
          </Badge>
        }
      />

      {!dbReady || !data ? (
        <NotConnected />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* business at a glance */}
          <section className="space-y-3 lg:col-span-2">
            <SectionHeader title="Business at a glance" icon={Wallet} />
            <Card className="grid grid-cols-2 divide-x divide-y divide-line overflow-hidden sm:grid-cols-4 sm:divide-y-0">
              <StatTile
                label="Revenue"
                value={formatCents(data.stats.revenueCents)}
                accent="text-emerald-600 dark:text-emerald-400"
              />
              <StatTile
                label="Unpaid"
                value={data.stats.unpaidCount}
                accent={data.stats.unpaidCount > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
              />
              <StatTile label="Expenses" value={formatCents(data.stats.expensesCents)} />
              <StatTile
                label="Open fix-its"
                value={data.stats.openFixes}
                accent={data.stats.openFixes > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
              />
            </Card>
            <p className="px-1 text-xs text-muted">
              {data.stats.openFixes > 0 ? (
                <Link href="/fix-it" className="font-medium text-brand hover:underline">
                  Review open work →
                </Link>
              ) : (
                "Lifetime totals across every property you manage."
              )}
            </p>
          </section>

          {/* your portfolio */}
          <section className="space-y-3 lg:col-span-2">
            <SectionHeader
              title="Your portfolio"
              icon={Building2}
              action={
                <Link href="/invites" className={button.secondary}>
                  Manage
                </Link>
              }
            />
            <Card className="grid grid-cols-2 divide-x divide-line overflow-hidden sm:grid-cols-4">
              <StatTile label="Properties" value={data.portfolio.propertyCount} />
              <StatTile label="Units" value={data.portfolio.unitCount} />
              <StatTile label="Occupied" value={data.portfolio.occupiedCount} />
              <StatTile label="Vacant" value={data.portfolio.vacantCount} />
            </Card>
            <Card className="max-h-[30rem] divide-y divide-line overflow-y-auto">
              {data.portfolio.properties.length === 0 ? (
                <div className="px-5 py-3.5 text-sm text-muted">
                  No properties yet. Add your first one from{" "}
                  <Link href="/invites" className="font-medium text-brand hover:underline">
                    Invites
                  </Link>
                  .
                </div>
              ) : (
                data.portfolio.properties.map((p) => (
                  <Row key={p.id} icon={Building2} label={`${p.occupiedCount}/${p.unitCount} units occupied`}>
                    {p.name}
                    {p.address && (
                      <span className="mt-0.5 flex items-center gap-1 text-sm font-normal text-muted">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {p.address}
                      </span>
                    )}
                  </Row>
                ))
              )}
            </Card>
          </section>

          {/* tenants */}
          <section className="space-y-3">
            <SectionHeader title="Tenants" icon={Users} />
            <Card className="divide-y divide-line overflow-hidden">
              <Row icon={Home} label="Occupied units">
                {data.portfolio.occupiedCount} of {data.portfolio.unitCount}
              </Row>
              <Row icon={UserRound} label="Tenants housed">
                {data.portfolio.tenantCount}
              </Row>
              <Row icon={DoorOpen} label="Vacancies">
                <span className="flex items-center gap-2">
                  {data.portfolio.vacantCount}
                  <Link href="/dashboard" className="text-sm font-medium text-brand hover:underline">
                    View grid →
                  </Link>
                </span>
              </Row>
            </Card>
          </section>

          {/* team summary */}
          <section className="space-y-3">
            <SectionHeader title="Maintenance team" icon={Wrench} />
            <Card className="divide-y divide-line overflow-hidden">
              <Row icon={HardHat} label="Staff working across your properties">
                {data.team.length} {data.team.length === 1 ? "worker" : "workers"}
              </Row>
              <Row icon={ScrollText} label="Jobs handled">
                {data.team.reduce((sum, m) => sum + m.jobCount, 0)}
              </Row>
            </Card>
          </section>

          {/* your team */}
          <section className="space-y-3 lg:col-span-2">
            <SectionHeader
              title="Your team"
              icon={UserRound}
              action={
                data.team.length > 0 ? (
                  <Badge tone="neutral">
                    {data.team.length} {data.team.length === 1 ? "person" : "people"}
                  </Badge>
                ) : undefined
              }
            />
            <Card className="divide-y divide-line overflow-hidden">
              {data.team.length > 0 ? (
                data.team.map((m) => (
                  <ContactRow
                    key={m.email}
                    icon={HardHat}
                    role={`Maintenance · ${m.jobCount} ${m.jobCount === 1 ? "job" : "jobs"}`}
                    name={m.fullName}
                    email={m.email}
                  />
                ))
              ) : (
                <div className="px-5 py-3.5 text-sm text-muted">
                  No maintenance staff yet — share an employer code from{" "}
                  <Link href="/invites" className="font-medium text-brand hover:underline">
                    Invites
                  </Link>{" "}
                  to add workers.
                </div>
              )}
            </Card>
          </section>

          {/* display & accessibility */}
          <section className="space-y-3 lg:col-span-2">
            <SectionHeader title="Display" icon={Type} />
            <Card className="space-y-4 p-5">
              <div>
                <div className="flex items-center gap-2 font-medium">
                  <Type className="h-4 w-4 text-muted" /> Text size
                </div>
                <p className="mt-1 text-sm text-muted">
                  Make everything bigger and easier to read. Your choice is remembered on this device.
                </p>
              </div>
              <TextSizeControl />
              <p className="flex items-center gap-2 border-t border-line pt-4 text-sm text-muted">
                <Sun className="h-4 w-4" />
                Prefer light or dark? Use the toggle in the top bar.
              </p>
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}
