import { Client } from 'pg';
import 'dotenv/config';

async function run() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5433/svsm?schema=public';
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to PostgreSQL for Billing Migration');

  try {
    // 1. Create BillingPackage table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS "BillingPackage" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "slug" TEXT UNIQUE NOT NULL,
        "participantMinutes" INTEGER NOT NULL,
        "priceCents" INTEGER NOT NULL,
        "effectiveRatePer1k" TEXT,
        "roughlyCovers" TEXT,
        "overageBlockCents" INTEGER NOT NULL DEFAULT 1000,
        "overageBlockMinutes" INTEGER NOT NULL DEFAULT 10000,
        "description" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "isCustom" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ BillingPackage table verified/created');

    // 2. Add new columns to User table
    await client.query(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripePaymentMethodId" TEXT;
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "billingPackageId" TEXT REFERENCES "BillingPackage"("id") ON DELETE SET NULL;
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "packageMinutesTotal" INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "packageMinutesUsed" INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "packageCycleStartedAt" TIMESTAMP(3);
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "packageCycleExpiresAt" TIMESTAMP(3);
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "overageConsent" BOOLEAN NOT NULL DEFAULT false;
    `);
    console.log('✅ User billing columns added');

    // 3. Create OverageCharge table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS "OverageCharge" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "sessionId" TEXT,
        "amountCents" INTEGER NOT NULL,
        "minutesCredited" INTEGER NOT NULL,
        "stripePaymentIntentId" TEXT,
        "status" TEXT NOT NULL DEFAULT 'succeeded',
        "receiptUrl" TEXT,
        "description" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ OverageCharge table verified/created');

    // 4. Seed standard packages if empty
    const packages = [
      {
        id: 'pkg-free-001',
        name: 'Free',
        slug: 'free',
        participantMinutes: 3000,
        priceCents: 0,
        effectiveRatePer1k: '—',
        roughlyCovers: '~1 small event (e.g. 1hr, 50 attendees)',
        overageBlockCents: 1000,
        overageBlockMinutes: 10000,
        description: 'Ideal for trial and single small events.',
        isActive: true,
        isCustom: false,
      },
      {
        id: 'pkg-starter-002',
        name: 'Starter',
        slug: 'starter',
        participantMinutes: 30000,
        priceCents: 3000, // $30
        effectiveRatePer1k: '$1.00/1k',
        roughlyCovers: '~10 events of 50 attendees/hr',
        overageBlockCents: 1000,
        overageBlockMinutes: 10000,
        description: 'For growing creators and community hosts.',
        isActive: true,
        isCustom: false,
      },
      {
        id: 'pkg-growth-003',
        name: 'Growth',
        slug: 'growth',
        participantMinutes: 150000,
        priceCents: 13000, // $130
        effectiveRatePer1k: '$0.87/1k',
        roughlyCovers: '~50 events of 50 attendees/hr',
        overageBlockCents: 1000,
        overageBlockMinutes: 10000,
        description: 'For active hosts and weekly masterclasses.',
        isActive: true,
        isCustom: false,
      },
      {
        id: 'pkg-scale-004',
        name: 'Scale',
        slug: 'scale',
        participantMinutes: 750000,
        priceCents: 0, // Custom negotiated
        effectiveRatePer1k: 'negotiated',
        roughlyCovers: 'high-volume hosts & enterprise organizations',
        overageBlockCents: 1000,
        overageBlockMinutes: 10000,
        description: 'Enterprise scale, custom negotiated rates, dedicated support.',
        isActive: true,
        isCustom: true,
      },
    ];

    for (const pkg of packages) {
      await client.query(`
        INSERT INTO "BillingPackage" (
          "id", "name", "slug", "participantMinutes", "priceCents", "effectiveRatePer1k", 
          "roughlyCovers", "overageBlockCents", "overageBlockMinutes", "description", "isActive", "isCustom", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
        ON CONFLICT ("slug") DO UPDATE SET
          "name" = EXCLUDED."name",
          "participantMinutes" = EXCLUDED."participantMinutes",
          "priceCents" = EXCLUDED."priceCents",
          "effectiveRatePer1k" = EXCLUDED."effectiveRatePer1k",
          "roughlyCovers" = EXCLUDED."roughlyCovers",
          "overageBlockCents" = EXCLUDED."overageBlockCents",
          "overageBlockMinutes" = EXCLUDED."overageBlockMinutes",
          "description" = EXCLUDED."description",
          "isActive" = EXCLUDED."isActive",
          "isCustom" = EXCLUDED."isCustom",
          "updatedAt" = CURRENT_TIMESTAMP;
      `, [
        pkg.id,
        pkg.name,
        pkg.slug,
        pkg.participantMinutes,
        pkg.priceCents,
        pkg.effectiveRatePer1k,
        pkg.roughlyCovers,
        pkg.overageBlockCents,
        pkg.overageBlockMinutes,
        pkg.description,
        pkg.isActive,
        pkg.isCustom,
      ]);
    }
    console.log('✅ Billing packages seeded successfully');

  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    await client.end();
  }
}

run();
