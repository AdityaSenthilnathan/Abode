"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Banknote, CreditCard, DoorOpen, Plus, Settings2, Ticket, Trash2, Wrench } from "lucide-react";
import { createUnitAction } from "@/actions/invites";
import { formatCents } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { PropertyStaticMap } from "./property-static-map";

type Unit = {
  id: string;
  unitNumber: string;
  rentAmountCents: number | null;
  status: string;
  tenantName: string | null;
  openRequests: number;
  unpaidCount: number;
};

type Property = {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  units: Unit[];
  occupied: number;
  monthlyRentCents: number;
  openRequests: number;
  unpaidCount: number;
};

const inputCls =
  "rounded-lg border border-line bg-surface-2/50 px-2.5 py-1.5 text-sm outline-none transition focus:border-brand/50";

export function PropertyManageCard({ property: p, token }: { property: Property; token?: string }) {
  const [managing, setManaging] = useState(false);

  return (
    <div
      id={`prop-${p.id}`}
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm shadow-black/[0.03] dark:shadow-black/20"
    >
      <div className="flex flex-col sm:flex-row">
        <PropertyStaticMap
          lat={p.lat}
          lng={p.lng}
          token={token}
          className="h-28 w-full shrink-0 border-b border-line sm:h-auto sm:w-44 sm:border-b-0 sm:border-r"
          alt={`Map of ${p.name}`}
        />
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-semibold tracking-tight">{p.name}</h3>
              {p.address && <p className="truncate text-sm text-muted">{p.address}</p>}
            </div>
            <button
              type="button"
              onClick={() => setManaging((m) => !m)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                managing
                  ? "border-brand/40 bg-brand/10 text-brand"
                  : "border-line text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <Settings2 className="h-3.5 w-3.5" />
              {managing ? "Done" : "Manage"}
            </button>
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
                  {p.openRequests} open
                  <ArrowUpRight className="h-3 w-3 opacity-70" />
                </Badge>
              </Link>
            )}
            {p.unpaidCount > 0 && (
              <Link href="/payments" className="transition hover:brightness-95" title="View unpaid invoices">
                <Badge tone="danger" className="gap-1 normal-case">
                  <CreditCard className="h-3 w-3" />
                  {p.unpaidCount} unpaid
                  <ArrowUpRight className="h-3 w-3 opacity-70" />
                </Badge>
              </Link>
            )}
          </div>

          {p.units.length > 0 && (
            <div className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line">
              {p.units.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Unit {u.unitNumber}</span>
                      <Badge tone={u.status === "occupied" ? "success" : "neutral"}>{u.status}</Badge>
                    </div>
                    <div className="truncate text-xs text-muted">
                      {u.tenantName ?? "No tenant"}
                      {u.rentAmountCents != null && ` · ${formatCents(u.rentAmountCents)}/mo`}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
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
                    {managing && (
                      <Link
                        href={`/invites/units/${u.id}/delete`}
                        aria-label={`Delete unit ${u.unitNumber}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-red-600 transition hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <form action={createUnitAction} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="propertyId" value={p.id} />
            <input name="unitNumber" required placeholder="Unit #" className={`${inputCls} w-24`} />
            <input
              name="rent"
              type="number"
              required
              min="0"
              step="0.01"
              placeholder="Rent $/mo"
              className={`${inputCls} w-28`}
            />
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm font-medium transition hover:bg-surface-2">
              <Plus className="h-3.5 w-3.5" />
              Add unit
            </button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
            <Link
              href="/invites"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-foreground"
            >
              <Ticket className="h-3.5 w-3.5" />
              Invite codes
            </Link>
            {managing && (
              <Link
                href={`/invites/properties/${p.id}/delete`}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete property
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
