/**
 * RuleVid Database Seeder
 * Direct pg-based seed — no adapter complexity
 */
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const DATABASE_URL = 'postgresql://admin:password@localhost:5433/svsm?schema=public';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('\n🌱 Seeding RuleVid database...\n');

  const accounts = [
    {
      email: 'superadmin@svsm.io',
      password: 'SuperAdmin@2026!',
      name: 'Super Administrator',
      role: 'super_admin',
      companyName: null,
    },
    {
      email: 'host@rulevid.io',
      password: 'Host@Demo2026!',
      name: 'Demo Host',
      role: 'host',
      companyName: 'RuleVid Studios',
    },
    {
      email: 'user@rulevid.io',
      password: 'User@Demo2026!',
      name: 'Demo Attendee',
      role: 'user',
      companyName: null,
    },
  ];

  for (const acc of accounts) {
    const hash = await bcrypt.hash(acc.password, 10);
    const id = require('crypto').randomUUID();

    // Check if user already exists
    const existing = await client.query('SELECT id FROM "User" WHERE email = $1', [acc.email]);

    if (existing.rows.length > 0) {
      // Update password and role
      await client.query(
        `UPDATE "User" SET "passwordHash"=$1, role=$2, status='active', "emailVerified"=true WHERE email=$3`,
        [hash, acc.role, acc.email]
      );
      console.log(`♻️  Updated: ${acc.email}  (${acc.role})`);
    } else {
      // Insert fresh
      await client.query(
        `INSERT INTO "User" (id, email, "passwordHash", name, role, "companyName", status, "emailVerified", "pricingTier", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, 'active', true, 'standard', NOW(), NOW())`,
        [id, acc.email, hash, acc.name, acc.role, acc.companyName]
      );
      console.log(`✅ Created: ${acc.email}  (${acc.role})  →  ${acc.password}`);
    }
  }

  console.log('\n🎉 Seeding complete! You can now log in to RuleVid.\n');
  console.log('─────────────────────────────────────────────────');
  console.log('  superadmin@svsm.io  /  SuperAdmin@2026!');
  console.log('  host@rulevid.io     /  Host@Demo2026!');
  console.log('  user@rulevid.io     /  User@Demo2026!');
  console.log('─────────────────────────────────────────────────\n');

  await client.end();
}

main().catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); });
