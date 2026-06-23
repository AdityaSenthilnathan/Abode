import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
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
import { Card, SectionHeader, Badge, button } from "@/components/ui";
import { NotConnected } from "@/components/not-connected";
import { TextSizeControl } from "@/components/tenant/text-size";

function initials(name: string | null, email: string): string {
  const base = (name ?? email).trim();
  const parts = base.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || base[0]?.toUpperCase() || "?";
}

/** A labelled fact row inside an info card. */
function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-3.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted">{label}</div>
        <div className="mt-0.5 font-medium break-words">{children}</div>
      </div>
    </div>
  );
}

/** A person you can reach — manager or maintenance — with a message shortcut. */
function ContactRow({
  icon: Icon,
  role,
  name,
  email,
}: {
  icon: ComponentType<{ className?: string }>;
  role: string;
  name: string | null;
  email: string;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
        {initials(name, email)}
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface bg-surface-2 text-muted">
          <Icon className="h-3 w-3" />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{name ?? email}</div>
        <div className="truncate text-xs text-muted">
          {role} · {email}
        </div>
      </div>
      <Link href="/messages" className={`${button.secondary} shrink-0`}>
        Message
      </Link>
    </div>
  );
}

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
      <Card className="flex items-center gap-4 p-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-accent text-lg font-semibold text-brand-foreground shadow-sm">
          {initials(user.fullName, user.email)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-semibold">{user.fullName ?? "Tenant"}</div>
          <div className="truncate text-sm text-muted">{user.email}</div>
        </div>
        <Badge tone="brand" className="gap-1">
          <CircleUser className="h-3.5 w-3.5" /> Tenant
        </Badge>
      </Card>

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
