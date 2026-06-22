import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { asAdmin, withUser } from "@/server/db/rls";
import { conversations, maintenanceRequests, messages, properties, taskReceipts, tasks, units, users } from "@db/schema";
import type { Task } from "@db/schema";

/**
 * Per-conversation "waiting on" status, from the handyman's perspective.
 *  - tone "orange" → the other person is waiting on YOU (action needed)
 *  - tone "green"  → YOU are waiting on them
 */
export interface WaitStatus {
  tone: "orange" | "green";
  label: string;
}

function handymanWait(task: Task, otherIsTenant: boolean): WaitStatus | null {
  if (task.status === "done") return null;
  if (otherIsTenant) return { tone: "orange", label: "Tenant is waiting on the repair" };
  // owner / manager — follow the job workflow
  if (task.status === "open") return { tone: "orange", label: "Waiting for you to accept the job" };
  if (task.estimateCents == null) return { tone: "orange", label: "Waiting for you to send an estimate" };
  if (task.estimateApprovedAt == null) return { tone: "green", label: "Waiting for them to approve your estimate" };
  if (task.finalCostCents == null) return { tone: "orange", label: "Waiting for you to complete the job" };
  return { tone: "green", label: "Waiting for them to sign off" };
}

export interface ConversationListItem {
  id: string;
  otherName: string;
  otherRole: string | null;
  lastBody: string | null;
  taskId: string | null;
  taskTitle: string | null;
  wait: WaitStatus | null;
}

/** Conversation list enriched with the other party, last message, and (handyman) waiting status. */
export async function listConversationsForUser(userId: string, role: string): Promise<ConversationListItem[]> {
  // Seeing the inbox = the messages reached you → mark them delivered.
  await markDelivered(userId);
  return withUser(userId, async (tx) => {
    const convos = await tx.select().from(conversations);

    // Load linked tasks once (only the handyman view derives a workflow status).
    const taskMap = new Map<string, Task>();
    const taskIds = convos.map((c) => c.taskId).filter((id): id is string => !!id);
    if (role === "employee" && taskIds.length) {
      const ts = await tx.select().from(tasks).where(inArray(tasks.id, taskIds));
      for (const t of ts) taskMap.set(t.id, t);
    }

    const out: (ConversationListItem & { lastAt: number })[] = [];
    for (const c of convos) {
      const otherId = c.participantA === userId ? c.participantB : c.participantA;
      const [other] = await tx
        .select({ fullName: users.fullName, email: users.email, role: users.role })
        .from(users)
        .where(eq(users.id, otherId))
        .limit(1);
      const [last] = await tx
        .select()
        .from(messages)
        .where(eq(messages.conversationId, c.id))
        .orderBy(desc(messages.sentAt))
        .limit(1);

      const task = c.taskId ? taskMap.get(c.taskId) : undefined;
      const wait = role === "employee" && task ? handymanWait(task, other?.role === "tenant") : null;

      out.push({
        id: c.id,
        otherName: other?.fullName ?? other?.email ?? "Conversation",
        otherRole: other?.role ?? null,
        lastBody: last?.body ?? null,
        taskId: c.taskId,
        taskTitle: task?.title ?? null,
        wait,
        lastAt: last?.sentAt ? new Date(last.sentAt).getTime() : 0,
      });
    }
    out.sort((a, b) => b.lastAt - a.lastAt);
    return out.map(({ lastAt: _lastAt, ...rest }) => rest);
  });
}

/** Conversations the user is in, with the other participant + last message. */
export async function listConversations(userId: string) {
  return withUser(userId, async (tx) => {
    const convos = await tx.select().from(conversations);
    const out = [];
    for (const c of convos) {
      const otherId = c.participantA === userId ? c.participantB : c.participantA;
      const [other] = await tx
        .select({ id: users.id, fullName: users.fullName, email: users.email, role: users.role })
        .from(users)
        .where(eq(users.id, otherId))
        .limit(1);
      const [last] = await tx
        .select()
        .from(messages)
        .where(eq(messages.conversationId, c.id))
        .orderBy(desc(messages.sentAt))
        .limit(1);
      out.push({ conversation: c, other, last });
    }
    return out.sort((a, b) => {
      const ta = a.last?.sentAt ? new Date(a.last.sentAt).getTime() : 0;
      const tb = b.last?.sentAt ? new Date(b.last.sentAt).getTime() : 0;
      return tb - ta;
    });
  });
}

/**
 * Mark the other participant's messages in a conversation as read by `userId`
 * (and delivered if not already). Uses asAdmin: RLS only lets a user write rows
 * they sent, but read receipts flip the recipient's columns on the sender's rows.
 */
export async function markRead(userId: string, conversationId: string) {
  return asAdmin((tx) =>
    tx
      .update(messages)
      .set({ readAt: new Date(), deliveredAt: sql`coalesce(${messages.deliveredAt}, now())` })
      .where(
        and(eq(messages.conversationId, conversationId), ne(messages.senderId, userId), isNull(messages.readAt)),
      ),
  );
}

/** Mark every incoming, not-yet-delivered message across the user's conversations as delivered. */
export async function markDelivered(userId: string) {
  return asAdmin((tx) =>
    tx
      .update(messages)
      .set({ deliveredAt: new Date() })
      .where(
        and(
          ne(messages.senderId, userId),
          isNull(messages.deliveredAt),
          inArray(
            messages.conversationId,
            tx
              .select({ id: conversations.id })
              .from(conversations)
              .where(or(eq(conversations.participantA, userId), eq(conversations.participantB, userId))),
          ),
        ),
      ),
  );
}

/** A full thread (messages + the other party's name). Null if not a participant (RLS). */
export async function getThread(userId: string, conversationId: string) {
  return withUser(userId, async (tx) => {
    const [c] = await tx.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (!c) return null;
    const otherId = c.participantA === userId ? c.participantB : c.participantA;
    const [other] = await tx
      .select({ fullName: users.fullName, email: users.email })
      .from(users)
      .where(eq(users.id, otherId))
      .limit(1);
    // Viewing the thread = reading the other party's messages.
    await markRead(userId, conversationId);
    const msgs = await tx
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.sentAt));
    return { conversation: c, otherName: other?.fullName ?? other?.email ?? "Conversation", messages: msgs };
  });
}

export interface ConversationJob {
  taskId: string;
  title: string | null;
  status: "open" | "accepted" | "done";
  estimateCents: number | null;
  estimateApproved: boolean;
  finalCostCents: number | null;
  receiptCount: number;
}

/** The job (task) a conversation is about, with enough state to drive the in-chat workflow. Null if the chat isn't task-linked. */
export async function getConversationJob(userId: string, conversationId: string): Promise<ConversationJob | null> {
  return withUser(userId, async (tx) => {
    const [c] = await tx.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (!c?.taskId) return null;
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, c.taskId)).limit(1);
    if (!task) return null;
    const receipts = await tx.select({ id: taskReceipts.id }).from(taskReceipts).where(eq(taskReceipts.taskId, c.taskId));
    return {
      taskId: task.id,
      title: task.title,
      status: task.status,
      estimateCents: task.estimateCents,
      estimateApproved: task.estimateApprovedAt != null,
      finalCostCents: task.finalCostCents,
      receiptCount: receipts.length,
    };
  });
}

export async function sendMessage(userId: string, conversationId: string, body: string) {
  return withUser(userId, (tx) =>
    tx.insert(messages).values({ conversationId, senderId: userId, body }).returning(),
  );
}

/** Find or create the owner↔tenant conversation for a tenant. */
export async function getOrCreateOwnerConversation(tenantId: string): Promise<string> {
  return asAdmin(async (tx) => {
    const [row] = await tx
      .select({ ownerId: properties.ownerId })
      .from(units)
      .innerJoin(properties, eq(properties.id, units.propertyId))
      .where(eq(units.tenantId, tenantId))
      .limit(1);
    if (!row) throw new Error("No manager found for your unit");
    const ownerId = row.ownerId;
    const [existing] = await tx
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.type, "owner_tenant"),
          or(
            and(eq(conversations.participantA, ownerId), eq(conversations.participantB, tenantId)),
            and(eq(conversations.participantA, tenantId), eq(conversations.participantB, ownerId)),
          ),
        ),
      )
      .limit(1);
    if (existing) return existing.id;
    const [c] = await tx
      .insert(conversations)
      .values({ participantA: ownerId, participantB: tenantId, type: "owner_tenant" })
      .returning();
    return c.id;
  });
}

/** Handyman↔tenant conversation (one per pair), linked to the job that prompted it. */
export async function getOrCreateHandymanTenantConversation(
  handymanId: string,
  tenantId: string,
  taskId: string,
): Promise<string> {
  return asAdmin(async (tx) => {
    const [existing] = await tx
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.type, "handyman_tenant"),
          or(
            and(eq(conversations.participantA, handymanId), eq(conversations.participantB, tenantId)),
            and(eq(conversations.participantA, tenantId), eq(conversations.participantB, handymanId)),
          ),
        ),
      )
      .limit(1);
    if (existing) {
      if (!existing.taskId && taskId) {
        await tx.update(conversations).set({ taskId }).where(eq(conversations.id, existing.id));
      }
      return existing.id;
    }
    const [c] = await tx
      .insert(conversations)
      .values({ participantA: handymanId, participantB: tenantId, type: "handyman_tenant", taskId })
      .returning();
    return c.id;
  });
}

/** Ensure the handyman has both the manager and tenant conversations for a job. */
export async function ensureJobConversations(handymanId: string, taskId: string): Promise<void> {
  const info = await asAdmin(async (tx) => {
    const [t] = await tx
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.assignedTo, handymanId)))
      .limit(1);
    if (!t) return null;
    const [prop] = await tx
      .select({ ownerId: properties.ownerId })
      .from(properties)
      .where(eq(properties.id, t.propertyId))
      .limit(1);
    let tenantId: string | null = null;
    if (t.requestId) {
      const [r] = await tx
        .select({ tenantId: units.tenantId })
        .from(maintenanceRequests)
        .innerJoin(units, eq(units.id, maintenanceRequests.unitId))
        .where(eq(maintenanceRequests.id, t.requestId))
        .limit(1);
      tenantId = r?.tenantId ?? null;
    }
    return { ownerId: prop?.ownerId ?? null, tenantId };
  });
  if (!info) throw new Error("Job not found");
  if (info.ownerId) await getOrCreateTaskConversation(info.ownerId, handymanId, taskId);
  if (info.tenantId) await getOrCreateHandymanTenantConversation(handymanId, info.tenantId, taskId);
}

/** Post a message from the handyman into the manager (owner↔handyman) chat for a task. */
export async function messageManagerForTask(handymanId: string, taskId: string, body: string): Promise<void> {
  await ensureJobConversations(handymanId, taskId);
  await withUser(handymanId, async (tx) => {
    const [c] = await tx
      .select()
      .from(conversations)
      .where(and(eq(conversations.type, "owner_handyman"), eq(conversations.taskId, taskId)))
      .limit(1);
    if (c) await tx.insert(messages).values({ conversationId: c.id, senderId: handymanId, body });
  });
}

/** Owner↔handyman conversation for a task (created when a task is assigned). */
export async function getOrCreateTaskConversation(ownerId: string, handymanId: string, taskId: string): Promise<string> {
  return asAdmin(async (tx) => {
    const [existing] = await tx
      .select()
      .from(conversations)
      .where(and(eq(conversations.type, "owner_handyman"), eq(conversations.taskId, taskId)))
      .limit(1);
    if (existing) return existing.id;
    const [c] = await tx
      .insert(conversations)
      .values({ participantA: ownerId, participantB: handymanId, type: "owner_handyman", taskId })
      .returning();
    return c.id;
  });
}
