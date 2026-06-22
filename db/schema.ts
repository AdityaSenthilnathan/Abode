/**
 * Abode database schema (Drizzle ORM, PostgreSQL).
 *
 * Mirrors the data model from the project schema diagram, adapted for:
 *  - AWS Cognito  → `users.cognito_sub` replaces a stored password hash
 *  - Stripe       → `users.stripe_customer_id`, `payments.stripe_payment_intent_id`
 *  - money is stored in integer **cents** everywhere (no floats)
 *
 * Column names are written camelCase in TS and emitted snake_case in SQL
 * via the `casing: 'snake_case'` option (set in drizzle.config.ts and the db client).
 *
 * Row-Level Security policies are NOT defined here — see db/policies.sql, which is
 * applied by db/migrate.ts after the generated schema migrations.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ enums */

export const userRole = pgEnum("user_role", ["owner", "employee", "tenant"]);
export const unitStatus = pgEnum("unit_status", ["vacant", "occupied"]);
export const paymentMethodType = pgEnum("payment_method_type", ["card", "bank", "wallet"]);
export const invoiceType = pgEnum("invoice_type", ["rent", "water", "power", "other"]);
export const invoiceStatus = pgEnum("invoice_status", ["unpaid", "paid", "late", "deferred"]);
export const requestUrgency = pgEnum("request_urgency", ["low", "med", "high", "urgent"]);
export const requestStatus = pgEnum("request_status", ["received", "working", "done"]);
export const taskStatus = pgEnum("task_status", ["open", "accepted", "done"]);
export const conversationType = pgEnum("conversation_type", ["owner_tenant", "owner_handyman", "handyman_tenant"]);
export const notificationType = pgEnum("notification_type", ["urgent", "success", "info"]);
export const inviteKind = pgEnum("invite_kind", ["tenant", "employee"]);
export const paymentStatus = pgEnum("payment_status", ["succeeded", "pending", "failed"]);

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

/* ------------------------------------------------------------------ auth */

export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  cognitoSub: text().notNull().unique(),
  role: userRole().notNull(),
  email: text().notNull().unique(),
  fullName: text(),
  avatarUrl: text(),
  stripeCustomerId: text(),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------ properties */

export const properties = pgTable(
  "properties",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    address: text(),
    lat: numeric({ precision: 10, scale: 7 }),
    lng: numeric({ precision: 10, scale: 7 }),
    createdAt: createdAt(),
  },
  (t) => [index("properties_owner_id_idx").on(t.ownerId)],
);

export const units = pgTable(
  "units",
  {
    id: uuid().primaryKey().defaultRandom(),
    propertyId: uuid()
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    unitNumber: text().notNull(),
    tenantId: uuid().references(() => users.id, { onDelete: "set null" }),
    rentAmountCents: integer(),
    status: unitStatus().notNull().default("vacant"),
    createdAt: createdAt(),
  },
  (t) => [
    index("units_tenant_id_idx").on(t.tenantId),
    index("units_property_id_idx").on(t.propertyId),
  ],
);

export const propertyEmployees = pgTable(
  "property_employees",
  {
    propertyId: uuid()
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    employeeId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobCount: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.propertyId, t.employeeId] }),
    index("property_employees_employee_id_idx").on(t.employeeId),
  ],
);

/**
 * Onboarding codes. A PM ("owner") generates:
 *  - kind=tenant   → tied to a vacant unit; a tenant redeems it to occupy that unit
 *  - kind=employee → tied to a property (or all of the owner's, if null); a handyman
 *                    redeems it to be linked via property_employees
 */
export const inviteCodes = pgTable(
  "invite_codes",
  {
    id: uuid().primaryKey().defaultRandom(),
    code: text().notNull().unique(),
    kind: inviteKind().notNull(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    unitId: uuid().references(() => units.id, { onDelete: "cascade" }),
    propertyId: uuid().references(() => properties.id, { onDelete: "cascade" }),
    redeemedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    redeemedAt: timestamp({ withTimezone: true }),
    expiresAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("invite_codes_owner_id_idx").on(t.ownerId)],
);

/* -------------------------------------------------------------- financials */

export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: paymentMethodType().notNull(),
    stripePmId: text().notNull(),
    brand: text(),
    last4: text(),
    expMonth: integer(),
    expYear: integer(),
    isDefault: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("payment_methods_user_id_idx").on(t.userId)],
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid().primaryKey().defaultRandom(),
    unitId: uuid()
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    type: invoiceType().notNull(),
    amountCents: integer().notNull(),
    dueDate: date().notNull(),
    status: invoiceStatus().notNull().default("unpaid"),
    description: text(),
    createdAt: createdAt(),
  },
  (t) => [index("invoices_unit_id_status_idx").on(t.unitId, t.status)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid().primaryKey().defaultRandom(),
    invoiceId: uuid()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    paymentMethodId: uuid().references(() => paymentMethods.id, { onDelete: "set null" }),
    amountCents: integer().notNull(),
    status: paymentStatus().notNull().default("succeeded"),
    stripePaymentIntentId: text().unique(),
    paidAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_invoice_id_idx").on(t.invoiceId)],
);

/* ------------------------------------------------------------- maintenance */

export const maintenanceRequests = pgTable(
  "maintenance_requests",
  {
    id: uuid().primaryKey().defaultRandom(),
    unitId: uuid()
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    submittedBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    description: text().notNull(),
    mediaUrls: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    urgency: requestUrgency().notNull().default("med"),
    status: requestStatus().notNull().default("received"),
    createdAt: createdAt(),
  },
  (t) => [index("maintenance_requests_unit_id_idx").on(t.unitId)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid().primaryKey().defaultRandom(),
    requestId: uuid().references(() => maintenanceRequests.id, { onDelete: "set null" }),
    assignedTo: uuid().references(() => users.id, { onDelete: "set null" }),
    propertyId: uuid()
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    title: text(),
    description: text(),
    deadline: date(),
    scheduledAt: timestamp({ withTimezone: true }),
    status: taskStatus().notNull().default("open"),
    estimateCents: integer(),
    estimateApprovedAt: timestamp({ withTimezone: true }),
    finalCostCents: integer(),
    completedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("tasks_assigned_to_idx").on(t.assignedTo),
    index("tasks_property_id_idx").on(t.propertyId),
  ],
);

export const taskReceipts = pgTable(
  "task_receipts",
  {
    id: uuid().primaryKey().defaultRandom(),
    taskId: uuid()
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    fileUrl: text().notNull(),
    amountCents: integer().notNull(),
    description: text(),
    uploadedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("task_receipts_task_id_idx").on(t.taskId)],
);

/* --------------------------------------------------------------- messaging */

export const conversations = pgTable(
  "conversations",
  {
    id: uuid().primaryKey().defaultRandom(),
    participantA: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    participantB: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: conversationType().notNull(),
    taskId: uuid().references(() => tasks.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("conversations_participant_a_idx").on(t.participantA),
    index("conversations_participant_b_idx").on(t.participantB),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid().primaryKey().defaultRandom(),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text().notNull(),
    sentAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    deliveredAt: timestamp({ withTimezone: true }),
    readAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("messages_conversation_id_sent_at_idx").on(t.conversationId, t.sentAt)],
);

/* ----------------------------------------------------------- notifications */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    recipientId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationType().notNull(),
    title: text().notNull(),
    body: text(),
    entityType: text(),
    entityId: uuid(),
    readAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_recipient_id_read_at_idx").on(t.recipientId, t.readAt)],
);

/* --------------------------------------------------------- inferred types */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Property = typeof properties.$inferSelect;
export type Unit = typeof units.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type MaintenanceRequest = typeof maintenanceRequests.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
