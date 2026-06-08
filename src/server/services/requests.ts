import "server-only";
import { desc } from "drizzle-orm";
import { withUser } from "@/server/db/rls";
import { maintenanceRequests, units } from "@db/schema";

export type Urgency = "low" | "med" | "high" | "urgent";

/** Tenant files a maintenance request against their own unit (RLS-scoped). */
export async function createRequest(
  userId: string,
  input: { description: string; urgency: Urgency; mediaKeys: string[] },
) {
  return withUser(userId, async (tx) => {
    const [unit] = await tx.select().from(units).limit(1); // RLS → tenant's own unit
    if (!unit) throw new Error("No unit is assigned to your account yet.");
    const [req] = await tx
      .insert(maintenanceRequests)
      .values({
        unitId: unit.id,
        submittedBy: userId,
        description: input.description,
        urgency: input.urgency,
        mediaUrls: input.mediaKeys,
      })
      .returning();
    return req;
  });
}

export async function listMyRequests(userId: string) {
  return withUser(userId, (tx) =>
    tx.select().from(maintenanceRequests).orderBy(desc(maintenanceRequests.createdAt)),
  );
}
