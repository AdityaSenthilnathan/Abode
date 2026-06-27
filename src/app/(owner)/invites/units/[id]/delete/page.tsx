import Link from "next/link";
import { notFound } from "next/navigation";
import { assertRole } from "@/server/auth/guard";
import { getOwnedUnit } from "@/server/services/onboarding";
import { deleteUnitAction } from "@/actions/invites";

export default async function DeleteUnitPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await assertRole("owner");
  const { id } = await params;
  const data = await getOwnedUnit(user.id, id);
  if (!data) notFound();
  const { unit, propertyName } = data;
  const occupied = unit.tenantId != null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Delete unit?</h1>
        <p className="text-sm opacity-60">This can&apos;t be undone.</p>
      </div>

      <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm">
        <p>
          You&apos;re about to permanently delete{" "}
          <span className="font-medium">
            Unit {unit.unitNumber}
          </span>{" "}
          in <span className="font-medium">{propertyName}</span>.
        </p>
        <p className="opacity-80">
          This will also remove its invoices, payments, maintenance requests, and any invite codes
          for this unit.
        </p>
        {occupied && (
          <p className="font-medium text-red-700 dark:text-red-400">
            ⚠ This unit currently has a tenant assigned — they will lose access to it.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <form action={deleteUnitAction}>
          <input type="hidden" name="unitId" value={unit.id} />
          <button className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
            Yes, delete unit
          </button>
        </form>
        <Link
          href="/properties"
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
