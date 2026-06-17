"use client";
import { useState } from "react";
import Link from "next/link";
import { createUnitAction } from "@/actions/invites";
import { formatCents } from "@/lib/utils";

type Unit = {
  id: string;
  unitNumber: string;
  rentAmountCents: number | null;
  status: string;
};

type Property = {
  id: string;
  name: string;
  address: string | null;
};

export function PropertyCard({ property, units }: { property: Property; units: Unit[] }) {
  const [managing, setManaging] = useState(false);

  return (
    <div className="rounded-xl border border-black/10 p-3 dark:border-white/15">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{property.name}</span>
        {property.address && <span className="text-xs opacity-50">{property.address}</span>}
      </div>

      {units.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {units.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-2 rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/15"
            >
              <span>
                Unit {u.unitNumber}
                {u.rentAmountCents != null && (
                  <span className="opacity-50"> · {formatCents(u.rentAmountCents)}</span>
                )}
                <span className="opacity-50"> · {u.status}</span>
              </span>
              {managing && (
                <Link
                  href={`/invites/units/${u.id}/delete`}
                  className="text-red-600 hover:underline"
                  aria-label={`Delete unit ${u.unitNumber}`}
                >
                  ✕
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      <form action={createUnitAction} className="mt-2 flex flex-wrap items-end gap-2">
        <input type="hidden" name="propertyId" value={property.id} />
        <input
          name="unitNumber"
          required
          placeholder="Unit #"
          className="w-24 rounded-md border border-black/15 bg-transparent px-2.5 py-1.5 text-sm dark:border-white/20"
        />
        <input
          name="rent"
          type="number"
          required
          min="0"
          step="0.01"
          placeholder="Rent $/mo"
          className="w-28 rounded-md border border-black/15 bg-transparent px-2.5 py-1.5 text-sm dark:border-white/20"
        />
        <button className="rounded-md border border-black/15 px-2.5 py-1.5 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
          Add unit
        </button>
      </form>

      <div className="mt-3 flex items-center gap-3 border-t border-black/5 pt-3 dark:border-white/10">
        <button
          type="button"
          onClick={() => setManaging((m) => !m)}
          className="rounded-md border border-black/15 px-2.5 py-1.5 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          {managing ? "Done" : "Manage / remove"}
        </button>
        {managing && (
          <Link
            href={`/invites/properties/${property.id}/delete`}
            className="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700"
          >
            Delete property
          </Link>
        )}
      </div>
    </div>
  );
}
