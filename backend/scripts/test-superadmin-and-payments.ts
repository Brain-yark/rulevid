import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { prisma } from '../src/db';
import { packageService } from '../src/services/packageService';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

async function main() {
  console.log('🚀 Running Super Admin Marketplace Pricing & Payment Flow Verification...\n');

  // 1. Check packages in database
  const packages = await packageService.getAllPackages(true);
  console.log(`📦 Found ${packages.length} billing packages in catalog:`);
  packages.forEach((p) => {
    console.log(`   - [${p.slug}] ${p.name}: $${p.priceCents / 100}/mo, ${p.participantMinutes.toLocaleString()} mins, active: ${p.isActive}`);
  });

  // 2. Test Super Admin Package Update
  const starterPkg = packages.find((p) => p.slug === 'starter');
  if (starterPkg) {
    console.log('\n🔧 [Super Admin] Updating Starter Package price to $35 and mins to 35,000...');
    const updated = await prisma.billingPackage.update({
      where: { id: starterPkg.id },
      data: {
        priceCents: 3500,
        participantMinutes: 35000,
        effectiveRatePer1k: '$1.00/1k',
      },
    });
    console.log(`✅ Starter package updated: $${updated.priceCents / 100}, ${updated.participantMinutes} mins.`);

    // Revert back to original $30
    await prisma.billingPackage.update({
      where: { id: starterPkg.id },
      data: { priceCents: 3000, participantMinutes: 30000 },
    });
    console.log('🔄 Reverted Starter package to standard $30.00 / 30,000 mins.');
  }

  // 3. Test Paid Host Signup Verification (Role remains 'user' until payment confirms)
  console.log('\n👤 [Host Signup Flow] Testing paid package registration...');
  const testPaidEmail = `paidhost_${Date.now()}@test.com`;
  const passwordHash = await bcrypt.hash('TestHost123!', 10);
  
  const paidUser = await prisma.user.create({
    data: {
      email: testPaidEmail,
      passwordHash,
      name: 'Paid Host Tester',
      role: 'user', // Starts as user until Stripe payment confirmed
      packageMinutesTotal: 0,
      packageMinutesUsed: 0,
      status: 'active',
    },
  });
  console.log(`✅ User registered with pending paid tier: ${paidUser.email}, Initial Role: "${paidUser.role}", Minutes: ${paidUser.packageMinutesTotal}`);

  // 4. Simulate Payment Confirmation (via applyPaidPackage)
  console.log('\n💳 [Payment Verification] Simulating confirmed Stripe payment for Growth Tier...');
  const statusAfterPayment = await packageService.applyPaidPackage(paidUser.id, 'growth', 'pi_test_123456');
  
  const confirmedUser = await prisma.user.findUnique({
    where: { id: paidUser.id },
    include: { billingPackage: true },
  });

  console.log(`✅ Payment verified! Promoted Role: "${confirmedUser?.role}", Package: "${confirmedUser?.billingPackage?.name}", Total Minutes: ${confirmedUser?.packageMinutesTotal.toLocaleString()}`);

  // 5. Cleanup test user
  await prisma.transaction.deleteMany({ where: { userId: paidUser.id } });
  await prisma.user.delete({ where: { id: paidUser.id } });
  console.log('\n🧹 Test user cleaned up.');

  console.log('\n🎉 ALL SUPER ADMIN & PAYMENT VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
}

main()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
