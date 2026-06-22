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
    if (us.length === 0) return [];

    // Batch what used to be two queries *per unit* (tenant name + open-request
    // count) into one query each — avoids the N+1 round-trips that dominated
    // the owner dashboard's load time.
    const tenantIds = [...new Set(us.map((u) => u.tenantId).filter((id): id is string => !!id))];
    const unitIds = us.map((u) => u.id);

    const tenantRows = tenantIds.length
      ? await tx
          .select({ id: users.id, fullName: users.fullName, email: users.email })
          .from(users)
          .where(inArray(users.id, tenantIds))
      : [];
    const openRows = await tx
      .select({ unitId: maintenanceRequests.unitId, n: count() })
      .from(maintenanceRequests)
      .where(and(inArray(maintenanceRequests.unitId, unitIds), ne(maintenanceRequests.status, "done")))
      .groupBy(maintenanceRequests.unitId);

    const nameById = new Map(tenantRows.map((t) => [t.id, t.fullName ?? t.email ?? null] as const));
    const openById = new Map(openRows.map((o) => [o.unitId, Number(o.n)] as const));

    return us
      .map((u) => ({
        unit: u,
        tenantName: u.tenantId ? nameById.get(u.tenantId) ?? null : null,
        openRequests: openById.get(u.id) ?? 0,
      }))
      .sort((a, b) => b.unit.unitNumber.localeCompare(a.unit.unitNumber, undefined, { numeric: true }));
  });
}

/** Headline dashboard metrics (all RLS-scoped to this owner). */
export async function ownerStats(ownerId: string) {
  return withUser(ownerId, async (tx) => {
    // Collapse the five single-metric queries into three by computing both
    // invoice metrics in one pass and both task metrics in another with FILTER.
    // (Queries in one transaction share a connection and run serially, so fewer
    // statements = fewer round-trips.)
    const [inv] = await tx
      .select({
        revenue: sql<number>`coalesce(sum(${invoices.amountCents}) filter (where ${invoices.status} = 'paid'), 0)`,
        unpaid: sql<number>`count(*) filter (where ${invoices.status} in ('unpaid', 'late'))`,
      })
      .from(invoices);
    const [tk] = await tx
      .select({
        openFixes: sql<number>`count(*) filter (where ${tasks.status} <> 'done')`,
        expenses: sql<number>`coalesce(sum(${tasks.finalCostCents}) filter (where ${tasks.status} = 'done'), 0)`,
      })
      .from(tasks);
    const [emp] = await tx.select({ n: count() }).from(propertyEmployees);
    return {
      revenueCents: Number(inv?.revenue ?? 0),
      unpaidCount: Number(inv?.unpaid ?? 0),
      openFixes: Number(tk?.openFixes ?? 0),
      expensesCents: Number(tk?.expenses ?? 0),
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
      const [req] = await tx
        .update(maintenanceRequests)
        .set({ status: "working" })
        .where(eq(maintenanceRequests.id, opts.requestId))
        .returning({ submittedBy: maintenanceRequests.submittedBy });
      // Close the loop back to the tenant who filed the request.
      if (req) {
        await tx.insert(notifications).values({
          recipientId: req.submittedBy,
          type: "info",
          title: "Maintenance underway",
          body: opts.title,
          entityType: "request",
          entityId: opts.requestId,
        });
      }
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
    await tx.update(tasks).set({ status: "done", completedAt: new Date() }).where(eq(tasks.id, taskId));
    if (row.task.requestId) {
      const [req] = await tx
        .update(maintenanceRequests)
        .set({ status: "done" })
        .where(eq(maintenanceRequests.id, row.task.requestId))
        .returning({ submittedBy: maintenanceRequests.submittedBy });
      // Tell the tenant their request is resolved.
      if (req) {
        await tx.insert(notifications).values({
          recipientId: req.submittedBy,
          type: "success",
          title: "Request resolved",
          body: row.task.title ?? "",
          entityType: "request",
          entityId: row.task.requestId,
        });
      }
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
