import "server-only";
import { and, count, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { asAdmin, withUser } from "@/server/db/rls";
import {
  conversations,
  invoices,
  maintenanceRequests,
  notifications,
  properties,
  propertyEmployees,
  tasks,
  units,
  users,
} from "@db/schema";

/** Apartment grid: owner's units (RLS-scoped) with tenant name + open-request count, high→low. */
export async function ownerGrid(ownerId: string) {
  return withUser(ownerId, async (tx) => {
    const us = await tx.select().from(units);
    const out = [];
    for (const u of us) {
      let tenantName: string | null = null;
      if (u.tenantId) {
        const [t] = await tx
          .select({ fullName: users.fullName, email: users.email })
          .from(users)
          .where(eq(users.id, u.tenantId))
          .limit(1);
        tenantName = t?.fullName ?? t?.email ?? null;
      }
      const [open] = await tx
        .select({ n: count() })
        .from(maintenanceRequests)
        .where(and(eq(maintenanceRequests.unitId, u.id), ne(maintenanceRequests.status, "done")));
      out.push({ unit: u, tenantName, openRequests: Number(open?.n ?? 0) });
    }
    return out.sort((a, b) =>
      b.unit.unitNumber.localeCompare(a.unit.unitNumber, undefined, { numeric: true }),
    );
  });
}

/** Headline dashboard metrics (all RLS-scoped to this owner). */
export async function ownerStats(ownerId: string) {
  return withUser(ownerId, async (tx) => {
    const [rev] = await tx
      .select({ s: sql<number>`coalesce(sum(${invoices.amountCents}),0)` })
      .from(invoices)
      .where(eq(invoices.status, "paid"));
    const [unpaid] = await tx
      .select({ n: count() })
      .from(invoices)
      .where(inArray(invoices.status, ["unpaid", "late"]));
    const [openFixes] = await tx.select({ n: count() }).from(tasks).where(ne(tasks.status, "done"));
    const [exp] = await tx
      .select({ s: sql<number>`coalesce(sum(${tasks.finalCostCents}),0)` })
      .from(tasks)
      .where(eq(tasks.status, "done"));
    const [emp] = await tx.select({ n: count() }).from(propertyEmployees);
    return {
      revenueCents: Number(rev?.s ?? 0),
      unpaidCount: Number(unpaid?.n ?? 0),
      openFixes: Number(openFixes?.n ?? 0),
      expensesCents: Number(exp?.s ?? 0),
      employeeCount: Number(emp?.n ?? 0),
    };
  });
}

/** Open maintenance requests + all tasks, for the fix-it dashboard. */
export async function listOpenWork(ownerId: string) {
  return withUser(ownerId, async (tx) => {
    const requests = await tx
      .select()
      .from(maintenanceRequests)
      .where(ne(maintenanceRequests.status, "done"))
      .orderBy(desc(maintenanceRequests.createdAt));
    const allTasks = await tx.select().from(tasks).orderBy(desc(tasks.createdAt));
    return { requests, tasks: allTasks };
  });
}

/** Handymen assigned to a property, most-used first (job_count desc). */
export async function rankedHandymen(ownerId: string, propertyId: string) {
  return withUser(ownerId, (tx) =>
    tx
      .select({
        id: users.id,
        name: users.fullName,
        email: users.email,
        jobCount: propertyEmployees.jobCount,
      })
      .from(propertyEmployees)
      .innerJoin(users, eq(users.id, propertyEmployees.employeeId))
      .where(eq(propertyEmployees.propertyId, propertyId))
      .orderBy(desc(propertyEmployees.jobCount)),
  );
}

/** "Give Task": create+assign a task, bump the handyman's job_count, open a chat, notify. */
export async function assignTask(
  ownerId: string,
  opts: { requestId?: string; propertyId: string; assignedTo: string; title: string; deadline?: string | null },
) {
  return asAdmin(async (tx) => {
    const [prop] = await tx
      .select()
      .from(properties)
      .where(and(eq(properties.id, opts.propertyId), eq(properties.ownerId, ownerId)))
      .limit(1);
    if (!prop) throw new Error("Property not found");

    const [task] = await tx
      .insert(tasks)
      .values({
        requestId: opts.requestId ?? null,
        propertyId: opts.propertyId,
        assignedTo: opts.assignedTo,
        title: opts.title,
        deadline: opts.deadline ?? null,
        status: "open",
      })
      .returning();

    if (opts.requestId) {
      await tx
        .update(maintenanceRequests)
        .set({ status: "working" })
        .where(eq(maintenanceRequests.id, opts.requestId));
    }
    await tx
      .update(propertyEmployees)
      .set({ jobCount: sql`${propertyEmployees.jobCount} + 1` })
      .where(and(eq(propertyEmployees.propertyId, opts.propertyId), eq(propertyEmployees.employeeId, opts.assignedTo)));

    // One owner↔handyman thread per pair — reuse it across tasks so the
    // messages inbox doesn't show the same handyman once per assigned job.
    const [existingConvo] = await tx
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.type, "owner_handyman"),
          or(
            and(eq(conversations.participantA, ownerId), eq(conversations.participantB, opts.assignedTo)),
            and(eq(conversations.participantA, opts.assignedTo), eq(conversations.participantB, ownerId)),
          ),
        ),
      )
      .limit(1);
    if (!existingConvo) {
      await tx
        .insert(conversations)
        .values({ participantA: ownerId, participantB: opts.assignedTo, type: "owner_handyman", taskId: task.id });
    }

    await tx.insert(notifications).values({
      recipientId: opts.assignedTo,
      type: "info",
      title: "New job assigned",
      body: opts.title,
      entityType: "task",
      entityId: task.id,
    });
    return task;
  });
}

/** Everything the fix-it board needs: open requests (with their property's ranked
 *  handymen for the Give-Task form) and all tasks. RLS-scoped to the owner. */
export async function fixItBoard(ownerId: string) {
  return withUser(ownerId, async (tx) => {
    const reqs = await tx
      .select({
        req: maintenanceRequests,
        unitNumber: units.unitNumber,
        propertyId: properties.id,
        propertyName: properties.name,
      })
      .from(maintenanceRequests)
      .innerJoin(units, eq(units.id, maintenanceRequests.unitId))
      .innerJoin(properties, eq(properties.id, units.propertyId))
      .where(eq(maintenanceRequests.status, "received"))
      .orderBy(desc(maintenanceRequests.createdAt));

    const hands = await tx
      .select({
        propertyId: propertyEmployees.propertyId,
        id: users.id,
        name: users.fullName,
        email: users.email,
        jobCount: propertyEmployees.jobCount,
      })
      .from(propertyEmployees)
      .innerJoin(users, eq(users.id, propertyEmployees.employeeId))
      .orderBy(desc(propertyEmployees.jobCount));

    const allTasks = await tx
      .select({ task: tasks, propertyName: properties.name, assigneeName: users.fullName })
      .from(tasks)
      .innerJoin(properties, eq(properties.id, tasks.propertyId))
      .leftJoin(users, eq(users.id, tasks.assignedTo))
      .orderBy(desc(tasks.createdAt));

    const byProp = new Map<string, { id: string; name: string | null; email: string; jobCount: number }[]>();
    for (const h of hands) {
      const list = byProp.get(h.propertyId) ?? [];
      list.push({ id: h.id, name: h.name, email: h.email, jobCount: h.jobCount });
      byProp.set(h.propertyId, list);
    }

    return {
      requests: reqs.map((r) => ({ ...r, handymen: byProp.get(r.propertyId) ?? [] })),
      tasks: allTasks,
    };
  });
}

/** Owner approves a handyman's estimate → unblocks the work. */
export function approveEstimate(ownerId: string, taskId: string) {
  return asAdmin(async (tx) => {
    const [row] = await tx
      .select({ task: tasks, ownerId: properties.ownerId })
      .from(tasks)
      .innerJoin(properties, eq(properties.id, tasks.propertyId))
      .where(eq(tasks.id, taskId))
      .limit(1);
    if (!row || row.ownerId !== ownerId) throw new Error("Task not found");
    await tx.update(tasks).set({ estimateApprovedAt: new Date() }).where(eq(tasks.id, taskId));
    if (row.task.assignedTo) {
      await tx.insert(notifications).values({
        recipientId: row.task.assignedTo,
        type: "success",
        title: "Estimate approved",
        body: row.task.title ?? "",
        entityType: "task",
        entityId: taskId,
      });
    }
  });
}

/** Owner accepts completion → task done (+ originating request done) → payout notice. */
export function acceptCompletion(ownerId: string, taskId: string) {
  return asAdmin(async (tx) => {
    const [row] = await tx
      .select({ task: tasks, ownerId: properties.ownerId })
      .from(tasks)
      .innerJoin(properties, eq(properties.id, tasks.propertyId))
      .where(eq(tasks.id, taskId))
      .limit(1);
    if (!row || row.ownerId !== ownerId) throw new Error("Task not found");
    await tx.update(tasks).set({ status: "done" }).where(eq(tasks.id, taskId));
    if (row.task.requestId) {
      await tx
        .update(maintenanceRequests)
        .set({ status: "done" })
        .where(eq(maintenanceRequests.id, row.task.requestId));
    }
    if (row.task.assignedTo) {
      await tx.insert(notifications).values({
        recipientId: row.task.assignedTo,
        type: "success",
        title: "Job approved & paid",
        body: row.task.title ?? "",
        entityType: "task",
        entityId: taskId,
      });
    }
  });
}
