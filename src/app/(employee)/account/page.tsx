import Link from "next/link";
import type { ReactNode } from "react";
import {
  Building2,
  CreditCard,
  HardHat,
  MapPin,
  Sun,
  Type,
  UserRound,
  Wallet,
  Wrench,
} from "lucide-react";
import { assertRole } from "@/server/auth/guard";
import { getHandymanAccount } from "@/server/services/account";
import { formatCents } from "@/lib/utils";
import { Badge, Card, SectionHeader, button } from "@/components/ui";
import { NotConnected } from "@/components/not-connected";
import { TextSizeControl } from "@/components/tenant/text-size";
import { AccountProfileHeader, ContactRow, Row } from "@/components/account-ui";

/** A single headline number in the "Your work" card. */
function StatTile({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="px-5 py-4">
      <div className={`text-2xl font-semibold tracking-tight ${accent ?? ""}`}>{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}

export default async function HandymanAccountPage() {
  const user = await assertRole("employee");

  let data: Awaited<ReturnType<typeof getHandymanAccount>> | null = null;
  let dbReady = true;
  try {
    data = await getHandymanAccount(user.id);
  } catch {
    dbReady = false;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-muted">Where you work, your jobs, and how you get paid.</p>
      </header>

      <AccountProfileHeader
        name={user.fullName}
        email={user.email}
        fallback="Handyman"
        badge={
          <Badge tone="brand" className="gap-1">
            <HardHat className="h-3.5 w-3.5" /> Handyman
          </Badge>
        }
      />

      {!dbReady || !data ? (
        <NotConnected />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* where you work */}
          <section className="space-y-3 lg:col-span-2">
            <SectionHeader
              title="Where you work"
              icon={Building2}
              action={
                data.properties.length > 0 ? (
                  <Badge tone="neutral">
                    {data.properties.length} {data.properties.length === 1 ? "property" : "properties"}
                  </Badge>
                ) : undefined
              }
            />
            <Card className="max-h-[30rem] divide-y divide-line overflow-y-auto">
              {data.properties.length === 0 ? (
                <div className="px-5 py-3.5 text-sm text-muted">
                  You&apos;re not linked to any properties yet. Use{" "}
                  <Link href="/jobs" className="font-medium text-brand hover:underline">
                    Join a property
                  </Link>{" "}
                  with a code from a manager.
                </div>
              ) : (
                data.properties.map((p) => (
                  <Row
                    key={p.id}
                    icon={Building2}
                    label={p.managerName ? `Managed by ${p.managerName}` : "Property"}
                  >
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

          {/* your work */}
          <section className="space-y-3 lg:col-span-2">
            <SectionHeader title="Your work" icon={Wrench} />
            <Card className="grid grid-cols-3 divide-x divide-line overflow-hidden">
              <StatTile label="Active" value={data.stats.activeJobs} />
              <StatTile label="Completed" value={data.stats.completedJobs} />
              <StatTile
                label="Earned"
                value={formatCents(data.stats.totalEarnedCents)}
                accent="text-emerald-600 dark:text-emerald-400"
              />
            </Card>
            <p className="px-1 text-xs text-muted">Lifetime totals across every property you work for.</p>
          </section>

          {/* payout */}
          <section className="space-y-3 lg:col-span-2">
            <SectionHeader title="Payout" icon={Wallet} />
            <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
              {data.payout ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.06] text-muted">
                      <CreditCard className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="font-medium capitalize">
                        {data.payout.brand ?? "Card"} •••• {data.payout.last4 ?? "————"}
                      </div>
                      {data.payout.expMonth != null && data.payout.expYear != null && (
                        <div className="text-xs text-muted">
                          Expires {String(data.payout.expMonth).padStart(2, "0")}/{data.payout.expYear}
                        </div>
                      )}
                    </div>
                  </div>
                  <Link href="/earnings" className={button.secondary}>
                    Manage
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted">
                    No payout method yet — add one to get paid for completed jobs.
                  </p>
                  <Link href="/earnings" className={button.secondary}>
                    Add payout method
                  </Link>
                </>
              )}
            </Card>
          </section>

          {/* your managers */}
          <section className="space-y-3 lg:col-span-2">
            <SectionHeader title="Your managers" icon={UserRound} />
            <Card className="divide-y divide-line overflow-hidden">
              {data.managers.length > 0 ? (
                data.managers.map((m) => (
                  <ContactRow
                    key={m.email}
                    icon={UserRound}
                    role="Property manager"
                    name={m.fullName}
                    email={m.email}
                    toUserId={m.id}
                  />
                ))
              ) : (
                <div className="px-5 py-3.5 text-sm text-muted">
                  No managers yet — join a property to connect with one.
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
