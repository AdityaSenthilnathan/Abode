/**
 * Dev seed — wipes and repopulates with a small, coherent dataset:
 *   1 owner (PM), 1 handyman, 2 tenants, 1 property, 3 units (one vacant),
 *   invoices, a payment, a maintenance request + task, a chat, notifications.
 *
 * Runs as the master role (bypasses RLS). Cognito subs are placeholders
 * ("dev-…") that the dev auth shim maps to until real Cognito users exist.
 *
 * Usage: `npm run db:seed`
 */
// Load env the same way the Next app does: `.env.local` wins, `.env` fills gaps.
// (dotenv does not override already-set vars, so the first load takes precedence.)
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const {
  users,
  properties,
  units,
  propertyEmployees,
  inviteCodes,
  invoices,
  payments,
  maintenanceRequests,
  tasks,
  conversations,
  messages,
  notifications,
} = schema;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required to seed");

  const pool = new Pool({
    connectionString: url,
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
  });
  const db = drizzle(pool, { schema, casing: "snake_case" });

  try {
    console.log("→ Truncating tables …");
    await pool.query(`truncate table
      users, properties, units, property_employees, invite_codes,
      payment_methods, invoices, payments, maintenance_requests,
      tasks, task_receipts, conversations, messages, notifications
      restart identity cascade`);

    console.log("→ Inserting users …");
    const [owner] = await db
      .insert(users)
      .values({ cognitoSub: "dev-owner", role: "owner", email: "owner@abode.dev", fullName: "Olivia Owner" })
      .returning();
    const [handyman] = await db
      .insert(users)
      .values({ cognitoSub: "dev-handyman", role: "employee", email: "handyman@abode.dev", fullName: "Hank Handyman" })
      .returning();
    const [tina] = await db
      .insert(users)
      .values({ cognitoSub: "dev-tenant", role: "tenant", email: "tenant@abode.dev", fullName: "Tina Tenant" })
      .returning();
    const [tom] = await db
      .insert(users)
      .values({ cognitoSub: "dev-tenant2", role: "tenant", email: "tenant2@abode.dev", fullName: "Tom Tenant" })
      .returning();

    console.log("→ Inserting property + units …");
    const [maple] = await db
      .insert(properties)
      .values({
        ownerId: owner.id,
        name: "Maple Court",
        address: "123 Maple St, New York, NY",
        lat: "40.7128000",
        lng: "-74.0060000",
      })
      .returning();

    const [unit101] = await db
      .insert(units)
      .values({ propertyId: maple.id, unitNumber: "101", tenantId: tina.id, rentAmountCents: 200000, status: "occupied" })
      .returning();
    const [unit102] = await db
      .insert(units)
      .values({ propertyId: maple.id, unitNumber: "102", tenantId: tom.id, rentAmountCents: 180000, status: "occupied" })
      .returning();
    await db
      .insert(units)
      .values({ propertyId: maple.id, unitNumber: "103", rentAmountCents: 195000, status: "vacant" });

    await db.insert(propertyEmployees).values({ propertyId: maple.id, employeeId: handyman.id, jobCount: 3 });

    await db.insert(inviteCodes).values({
      code: "ABODE-TENANT-103",
      kind: "tenant",
      ownerId: owner.id,
      propertyId: maple.id,
    });

    console.log("→ Inserting invoices + a payment …");
    const [rent101] = await db
      .insert(invoices)
      .values({ unitId: unit101.id, type: "rent", amountCents: 200000, dueDate: "2026-06-01", status: "unpaid", description: "June rent" })
      .returning();
    await db.insert(invoices).values({
      unitId: unit101.id, type: "water", amountCents: 4500, dueDate: "2026-06-05", status: "paid", description: "Water — June",
    });
    await db.insert(invoices).values({
      unitId: unit102.id, type: "rent", amountCents: 180000, dueDate: "2026-05-01", status: "late", description: "May rent",
    });
    await db.insert(payments).values({
      invoiceId: rent101.id, amountCents: 4500, status: "succeeded", stripePaymentIntentId: "pi_dev_water_101",
    });

    console.log("→ Inserting a maintenance request + task + chat …");
    const [req] = await db
      .insert(maintenanceRequests)
      .values({
        unitId: unit101.id,
        submittedBy: tina.id,
        description: "Kitchen faucet is leaking under the sink.",
        urgency: "high",
        status: "received",
      })
      .returning();

    await db.insert(tasks).values({
      requestId: req.id,
      assignedTo: handyman.id,
      propertyId: maple.id,
      title: "Fix leaking kitchen faucet — Unit 101",
      description: "Tenant reports a leak under the sink.",
      deadline: "2026-06-12",
      status: "open",
    });

    const [convo] = await db
      .insert(conversations)
      .values({ participantA: owner.id, participantB: tina.id, type: "owner_tenant" })
      .returning();
    await db.insert(messages).values({ conversationId: convo.id, senderId: tina.id, body: "Hi, the faucet is still leaking — any update?" });

    console.log("→ Inserting notifications …");
    await db.insert(notifications).values([
      { recipientId: owner.id, type: "urgent", title: "Rent overdue", body: "Unit 102 — May rent is late.", entityType: "invoice" },
      { recipientId: owner.id, type: "info", title: "New maintenance request", body: "Unit 101 — leaking faucet (high).", entityType: "request", entityId: req.id },
      { recipientId: tina.id, type: "info", title: "Request received", body: "We received your faucet request.", entityType: "request", entityId: req.id },
    ]);

    console.log("✓ Seed complete.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("✗ Seed failed:", err);
  process.exit(1);
});
