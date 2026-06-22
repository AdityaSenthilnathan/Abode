/**
 * Additive demo data for the handyman Earnings dashboard. Does NOT truncate —
 * it adds two more properties (owned by the seeded owner), links the seeded
 * handyman to them, and inserts a spread of completed, paid-out jobs across the
 * last year so the charts have real data. Idempotent: skips if already run.
 *
 * Usage: npx tsx scripts/seed-earnings.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import * as schema from "../db/schema";

const { users, properties, propertyEmployees, tasks } = schema;
const day = 86_400_000;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const pool = new Pool({
    connectionString: url,
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
  });
  const db = drizzle(pool, { schema, casing: "snake_case" });

  try {
    const [owner] = await db.select().from(users).where(eq(users.email, "owner@abode.dev")).limit(1);
    const [hank] = await db.select().from(users).where(eq(users.email, "handyman@abode.dev")).limit(1);
    if (!owner || !hank) throw new Error("Run `npm run db:seed` first (owner/handyman not found)");

    // Idempotency guard.
    const [existing] = await db.select().from(properties).where(eq(properties.name, "Oak Ridge Villas")).limit(1);
    if (existing) {
      console.log("✓ Earnings demo data already present — nothing to do.");
      return;
    }

    console.log("→ Adding demo properties …");
    const [maple] = await db.select().from(properties).where(eq(properties.name, "Maple Court")).limit(1);
    const [oak] = await db
      .insert(properties)
      .values({ ownerId: owner.id, name: "Oak Ridge Villas", address: "88 Oak Ridge Rd, New York, NY", lat: "40.7300000", lng: "-73.9900000" })
      .returning();
    const [pine] = await db
      .insert(properties)
      .values({ ownerId: owner.id, name: "Pine View Apartments", address: "12 Pine View Ave, New York, NY", lat: "40.7000000", lng: "-74.0100000" })
      .returning();

    console.log("→ Linking handyman to properties …");
    for (const p of [maple, oak, pine]) {
      if (!p) continue;
      const [link] = await db
        .select()
        .from(propertyEmployees)
        .where(and(eq(propertyEmployees.propertyId, p.id), eq(propertyEmployees.employeeId, hank.id)))
        .limit(1);
      if (!link) {
        await db.insert(propertyEmployees).values({ propertyId: p.id, employeeId: hank.id, jobCount: 3 });
      }
    }

    console.log("→ Inserting completed jobs …");
    const demo = [
      { prop: maple, title: "Replace kitchen faucet cartridge", amount: 18500, daysAgo: 4 },
      { prop: maple, title: "Patch & paint hallway drywall", amount: 9200, daysAgo: 11 },
      { prop: oak, title: "Service rooftop HVAC unit", amount: 42000, daysAgo: 19 },
      { prop: oak, title: "Re-grout master bathroom tile", amount: 27500, daysAgo: 47 },
      { prop: pine, title: "Replace leaking water heater", amount: 51000, daysAgo: 69 },
      { prop: maple, title: "Rewire faulty outlet — Unit 102", amount: 13400, daysAgo: 108 },
      { prop: pine, title: "Install new garbage disposal", amount: 22000, daysAgo: 188 },
      { prop: oak, title: "Repaint stairwell & landings", amount: 88000, daysAgo: 300 },
    ];

    const now = Date.now();
    for (const d of demo) {
      if (!d.prop) continue;
      const completedAt = new Date(now - d.daysAgo * day);
      await db.insert(tasks).values({
        propertyId: d.prop.id,
        assignedTo: hank.id,
        title: d.title,
        status: "done",
        estimateCents: d.amount,
        estimateApprovedAt: new Date(now - (d.daysAgo + 2) * day),
        finalCostCents: d.amount,
        completedAt,
      });
    }

    console.log(`✓ Added ${demo.length} completed jobs across 3 properties.`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
