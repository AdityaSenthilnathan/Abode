import Link from "next/link";
import {
  MapPin,
  Building2,
  ScrollText,
  UserRound,
  HardHat,
  Wallet,
  Type,
  BadgeCheck,
  Home,
  CircleUser,
  Sun,
} from "lucide-react";
import { assertRole } from "@/server/auth/guard";
import { getTenantAccount } from "@/server/services/account";
import { formatCents } from "@/lib/utils";
import { Card, SectionHeader, Badge } from "@/components/ui";
import { NotConnected } from "@/components/not-connected";
import { TextSizeControl } from "@/components/tenant/text-size";
import { AccountProfileHeader, ContactRow, Row } from "@/components/account-ui";

export default async function SettingsPage() {
  const user = await assertRole("tenant");

  let data: Awaited<ReturnType<typeof getTenantAccount>> = null;
  let dbReady = true;
  try {
    data = await getTenantAccount(user.id);
  } catch {
    dbReady = false;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-muted">Your home, your people, and how Abode looks to you.</p>
      </header>

      {/* profile */}
      <AccountProfileHeader
        name={user.fullName}
        email={user.email}
        fallback="Tenant"
        badge={
          <Badge tone="brand" className="gap-1">
            <CircleUser className="h-3.5 w-3.5" /> Tenant
          </Badge>
        }
      />

      {!dbReady ? (
        <NotConnected />
      ) : !data ? (
        <Card className="p-6 text-muted">
          No home is linked to your account yet. Ask your property manager for a unit code.
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* your home */}
          <section className="space-y-3">
            <SectionHeader title="Your home" icon={Home} />
            <Card className="divide-y divide-line overflow-hidden">
              <Row icon={Building2} label="Property">
                {data.property.name}
              </Row>
              <Row icon={MapPin} label="Location">
                {data.property.address ?? "Address not on file"}
              </Row>
              <Row icon={Home} label="Unit">
                <span className="flex items-center gap-2">
                  Unit {data.unit.unitNumber}
                  <Badge tone={data.unit.status === "occupied" ? "success" : "neutral"}>
                    {data.unit.status}
                  </Badge>
                </span>
              </Row>
            </Card>
          </section>

          {/* your lease */}
          <section className="space-y-3">
            <SectionHeader title="Your lease" icon={ScrollText} />
            <Card className="divide-y divide-line overflow-hidden">
              <Row icon={Wallet} label="Monthly rent">
                {data.unit.rentAmountCents != null
                  ? `${formatCents(data.unit.rentAmountCents)} / month`
                  : "Not set"}
              </Row>
              <Row icon={BadgeCheck} label="Current balance">
                {data.balanceCents > 0 ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-amber-600 dark:text-amber-400">
                      {formatCents(data.balanceCents)} due
                    </span>
                    <Link href="/dues" className="text-sm font-medium text-brand hover:underline">
                      Pay now →
                    </Link>
                  </span>
                ) : (
                  <span className="text-accent-2">All caught up</span>
                )}
              </Row>
              <Row icon={ScrollText} label="Agreement">
                Month-to-month · Unit {data.unit.unitNumber}
              </Row>
            </Card>
          </section>

          {/* your people */}
          <section className="space-y-3 lg:col-span-2">
            <SectionHeader title="Your people" icon={UserRound} />
            <Card className="divide-y divide-line overflow-hidden">
              {data.manager && (
                <ContactRow
                  icon={UserRound}
                  role="Property manager"
                  name={data.manager.fullName}
                  email={data.manager.email}
                  toUserId={data.manager.id}
                />
              )}
              {data.maintenance.length > 0 ? (
                data.maintenance.map((m) => (
                  <ContactRow
                    key={m.id}
                    icon={HardHat}
                    role="Maintenance"
                    name={m.fullName}
                    email={m.email}
                    toUserId={m.id}
                  />
                ))
              ) : (
                <div className="px-5 py-3.5 text-sm text-muted">
                  No maintenance staff assigned to your property yet.
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
