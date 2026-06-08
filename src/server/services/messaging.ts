import "server-only";
import { and, asc, desc, eq, or } from "drizzle-orm";
import { asAdmin, withUser } from "@/server/db/rls";
import { conversations, messages, properties, units, users } from "@db/schema";

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
    const msgs = await tx
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.sentAt));
    return { conversation: c, otherName: other?.fullName ?? other?.email ?? "Conversation", messages: msgs };
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
