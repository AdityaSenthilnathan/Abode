import Link from "next/link";
import { notFound } from "next/navigation";
import { assertRole } from "@/server/auth/guard";
import { getOwnedProperty } from "@/server/services/onboarding";
import { deletePropertyAction } from "@/actions/invites";

export default async function DeletePropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await assertRole("owner");
  const { id } = await params;
  const data = await getOwnedProperty(user.id, id);
  if (!data) notFound();
  const { property, unitCount } = data;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Delete property?</h1>
        <p className="text-sm opacity-60">This can&apos;t be undone.</p>
      </div>

      <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm">
        <p>
          You&apos;re about to permanently delete <span className="font-medium">{property.name}</span>
          {property.address ? ` (${property.address})` : ""}.
        </p>
        <p className="opacity-80">
          This will also remove{" "}
          <span className="font-medium">
            {unitCount} unit{unitCount === 1 ? "" : "s"}
          </span>{" "}
          and everything tied to them — tenant assignments, invoices, payments, maintenance
          requests, and any invite codes for this property.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <form action={deletePropertyAction}>
          <input type="hidden" name="propertyId" value={property.id} />
          <button className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
            Yes, delete property
          </button>
        </form>
        <Link
          href="/invites"
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
