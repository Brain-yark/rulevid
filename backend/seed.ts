/**
 * RuleVid Database Seeder
 * Restores the essential super admin account and test accounts.
 * Run with: npx ts-node seed.ts
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import process from 'process';
import { prisma } from './src/db';

async function main() {
  console.log('🌱 Seeding RuleVid database...\n');

  // ── Super Admin ──────────────────────────────────────────────
  const superAdminPassword = await bcrypt.hash('SuperAdmin@2026!', 10);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@svsm.io' },
    update: {},
    create: {
      email: 'superadmin@svsm.io',
      passwordHash: superAdminPassword,
      name: 'Super Administrator',
      role: 'super_admin',
      status: 'active',
      emailVerified: true,
      pricingTier: 'standard',
    },
  });
  console.log(`✅ Super Admin:  ${superAdmin.email}  (password: SuperAdmin@2026!)`);

  // ── Demo Host ─────────────────────────────────────────────────
  const hostPassword = await bcrypt.hash('Host@Demo2026!', 10);
  const host = await prisma.user.upsert({
    where: { email: 'host@rulevid.io' },
    update: {},
    create: {
      email: 'host@rulevid.io',
      passwordHash: hostPassword,
      name: 'Demo Host',
      role: 'host',
      companyName: 'RuleVid Studios',
      status: 'active',
      emailVerified: true,
      pricingTier: 'standard',
    },
  });
  console.log(`✅ Demo Host:    ${host.email}  (password: Host@Demo2026!)`);

  // ── Demo Attendee ─────────────────────────────────────────────
  const userPassword = await bcrypt.hash('User@Demo2026!', 10);
  const attendee = await prisma.user.upsert({
    where: { email: 'user@rulevid.io' },
    update: {},
    create: {
      email: 'user@rulevid.io',
      passwordHash: userPassword,
      name: 'Demo Attendee',
      role: 'user',
      status: 'active',
      emailVerified: true,
      pricingTier: 'standard',
    },
  });
  // ── Seed Marketplace Packages ─────────────────────────────────
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
      description: 'Perfect for getting started, testing RuleVid, and hosting small interactive sessions.',
      isActive: true,
      isCustom: false,
    },
    {
      id: 'pkg-starter-002',
      name: 'Starter',
      slug: 'starter',
      participantMinutes: 30000,
      priceCents: 3000,
      effectiveRatePer1k: '$1.00/1k',
      roughlyCovers: '~10 events of 50 attendees/hr',
      overageBlockCents: 1000,
      overageBlockMinutes: 10000,
      description: 'Ideal for growing community hosts, creators, and recurring weekly meetups.',
      isActive: true,
      isCustom: false,
    },
    {
      id: 'pkg-growth-003',
      name: 'Growth',
      slug: 'growth',
      participantMinutes: 150000,
      priceCents: 13000,
      effectiveRatePer1k: '$0.87/1k',
      roughlyCovers: '~50 events of 50 attendees/hr',
      overageBlockCents: 1000,
      overageBlockMinutes: 10000,
      description: 'Best value for high-volume masterclasses, workshops, and multi-track conferences.',
      isActive: true,
      isCustom: false,
    },
    {
      id: 'pkg-scale-004',
      name: 'Scale',
      slug: 'scale',
      participantMinutes: 750000,
      priceCents: 0,
      effectiveRatePer1k: 'negotiated',
      roughlyCovers: 'high-volume enterprise hosts',
      overageBlockCents: 1000,
      overageBlockMinutes: 10000,
      description: 'Custom tailored enterprise infrastructure with dedicated bitrate allocation & custom SLA.',
      isActive: true,
      isCustom: true,
    },
  ];

  for (const pkg of packages) {
    await prisma.billingPackage.upsert({
      where: { slug: pkg.slug },
      update: {},
      create: pkg,
    });
  }
  console.log('✅ Billing Packages: 4 standard tiers seeded (Free, Starter, Growth, Scale)');

  console.log('\n🎉 Seeding complete. You can now log in to RuleVid.\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
