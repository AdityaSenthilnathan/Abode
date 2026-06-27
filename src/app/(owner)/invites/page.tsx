import Link from "next/link";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Building2, DoorOpen, KeyRound, Ticket, Users } from "lucide-react";
import { assertRole } from "@/server/auth/guard";
import { withUser } from "@/server/db/rls";
import { inviteCodes, properties, units, users } from "@db/schema";
import { generateEmployeeCodeAction, generateTenantCodeAction } from "@/actions/invites";
import { NotConnected } from "@/components/not-connected";
import { Collapsible } from "@/components/collapsible";
import { Badge } from "@/components/ui";

async function load(userId: string) {
  return withUser(userId, async (tx) => {
    const props = await tx.select().from(properties).orderBy(properties.name);
    const allUnits = await tx.select().from(units).orderBy(desc(units.unitNumber));
    // Property is on the code directly (employee codes) or via the unit (tenant codes).
    const redeemer = alias(users, "redeemer");
    const codes = await tx
      .select({
        id: inviteCodes.id,
        code: inviteCodes.code,
        kind: inviteCodes.kind,
        redeemedAt: inviteCodes.redeemedAt,
        unitNumber: units.unitNumber,
        propertyName: properties.name,
        tenantName: redeemer.fullName,
        tenantEmail: redeemer.email,
      })
      .from(inviteCodes)
      .leftJoin(units, eq(units.id, inviteCodes.unitId))
      .leftJoin(
        properties,
        eq(properties.id, sql`coalesce(${inviteCodes.propertyId}, ${units.propertyId})`),
      )
      .leftJoin(redeemer, eq(redeemer.id, inviteCodes.redeemedBy))
      .orderBy(desc(inviteCodes.createdAt));
    // The current unredeemed tenant code per unit (if any) — so a vacant unit
    // shows its existing code instead of offering to mint a duplicate.
    const pendingTenantCodes = await tx
      .select({ unitId: inviteCodes.unitId, code: inviteCodes.code })
      .from(inviteCodes)
      .where(and(eq(inviteCodes.kind, "tenant"), isNull(inviteCodes.redeemedAt)));
    const codeByUnit = new Map<string, string>();
    for (const c of pendingTenantCodes) if (c.unitId) codeByUnit.set(c.unitId, c.code);

    const propNameById = new Map(props.map((p) => [p.id, p.name]));
    const vacant = allUnits
      .filter((u) => u.status === "vacant")
      .map((u) => ({
        ...u,
        propertyName: propNameById.get(u.propertyId) ?? null,
        pendingCode: codeByUnit.get(u.id) ?? null,
      }));
    return { props, vacant, codes };
  });
}

export default async function InvitesPage() {
  const user = await assertRole("owner");
  let data: Awaited<ReturnType<typeof load>> | null = null;
  try {
    data = await load(user.id);
  } catch {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Invites</h1>
        <NotConnected />
      </div>
    );
  }

  const unusedCodes = data.codes.filter((c) => !c.redeemedAt).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Invites</h1>
        <p className="mt-1 text-sm text-muted">
          Generate join codes for tenants and staff. Manage the buildings themselves in{" "}
          <Link href="/properties" className="font-medium text-brand hover:underline">
            Properties
          </Link>
          .
        </p>
      </div>

      {/* ── Tenant codes ──────────────────────────────────────────── */}
      <Collapsible
        icon={<DoorOpen className="h-[18px] w-[18px]" />}
        title="Invite a tenant"
        subtitle="Generate a code for a vacant unit — the tenant redeems it to move in."
        defaultOpen={data.vacant.length > 0}
        badge={
          <Badge tone={data.vacant.length ? "warning" : "neutral"}>
            {data.vacant.length} vacant
          </Badge>
        }
      >
        {data.vacant.length === 0 ? (
          <p className="text-sm text-muted">No vacant units right now.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.vacant.map((u) => (
              <form
                key={u.id}
                action={generateTenantCodeAction}
                className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-2/40 p-3"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">Unit {u.unitNumber}</span>
                  {u.propertyName && (
                    <span className="block truncate text-xs text-muted">{u.propertyName}</span>
                  )}
                </span>
                <input type="hidden" name="unitId" value={u.id} />
                {u.pendingCode ? (
                  <code className="shrink-0 rounded-md bg-brand/10 px-2 py-1 font-mono text-xs text-brand">
                    {u.pendingCode}
                  </code>
                ) : (
                  <button className="shrink-0 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium transition hover:bg-surface-2">
                    Generate
                  </button>
                )}
              </form>
            ))}
          </div>
        )}
      </Collapsible>

      {/* ── Employee codes ────────────────────────────────────────── */}
      <Collapsible
        icon={<Users className="h-[18px] w-[18px]" />}
        title="Invite staff"
        subtitle="Generate a code that links a handyman to one of your properties."
        badge={
          <Badge tone="neutral">
            {data.props.length} propert{data.props.length === 1 ? "y" : "ies"}
          </Badge>
        }
      >
        {data.props.length === 0 ? (
          <p className="text-sm text-muted">
            No properties yet — add one in{" "}
            <Link href="/properties" className="font-medium text-brand hover:underline">
              Properties
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.props.map((p) => (
              <form
                key={p.id}
                action={generateEmployeeCodeAction}
                className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-2/40 p-3"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Building2 className="h-4 w-4 shrink-0 text-muted" />
                  <span className="truncate font-medium">{p.name}</span>
                </span>
                <input type="hidden" name="propertyId" value={p.id} />
                <button className="shrink-0 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium transition hover:bg-surface-2">
                  Generate
                </button>
              </form>
            ))}
          </div>
        )}
      </Collapsible>

      {/* ── Generated codes ───────────────────────────────────────── */}
      <Collapsible
        icon={<KeyRound className="h-[18px] w-[18px]" />}
        title="All codes"
        subtitle="Every code you've generated, newest first."
        badge={
          <Badge tone="neutral">
            {unusedCodes} unused · {data.codes.length} total
          </Badge>
        }
      >
        {data.codes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-muted">
            <Ticket className="h-6 w-6" />
            <p className="text-sm">No codes generated yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {data.codes.map((c) => {
              const location = [c.propertyName, c.unitNumber ? `Unit ${c.unitNumber}` : null]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <code className="font-mono font-medium">{c.code}</code>
                    {location && <div className="truncate text-xs text-muted">{location}</div>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={c.kind === "tenant" ? "info" : "brand"}>{c.kind}</Badge>
                    {c.redeemedAt ? (
                      <Badge tone="success">
                        {c.tenantName || c.tenantEmail
                          ? `joined · ${c.tenantName ?? c.tenantEmail}`
                          : "redeemed"}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">unused</Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Collapsible>
    </div>
  );
}
