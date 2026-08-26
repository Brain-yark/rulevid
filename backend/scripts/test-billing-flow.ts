import 'dotenv/config';
import { prisma } from '../src/db';
import { packageService } from '../src/services/packageService';

async function runTest() {
  console.log('🧪 Starting Billing Module Verification Test...\n');

  try {
    // 1. Verify Package Catalog
    console.log('1. Verifying Package Catalog in Marketplace...');
    const packages = await packageService.getAllPackages();
    console.log(`Found ${packages.length} active packages:`);
    packages.forEach((pkg) => {
      console.log(` - [${pkg.name.toUpperCase()}] Slug: ${pkg.slug} | Price: $${pkg.priceCents / 100} | Minutes: ${pkg.participantMinutes.toLocaleString()} | Rate: ${pkg.effectiveRatePer1k} | Covers: ${pkg.roughlyCovers}`);
    });

    if (packages.length < 4) {
      throw new Error(`Expected at least 4 packages, found ${packages.length}`);
    }

    // 2. Create or find test user
    console.log('\n2. Testing Host Subscription & Free Tier Selection...');
    let testUser = await prisma.user.findUnique({ where: { email: 'billing_test@svsm.io' } });
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: 'billing_test@svsm.io',
          passwordHash: 'dummy_hash',
          name: 'Billing Test User',
          role: 'user', // Starts as attendee
          status: 'active',
          packageMinutesTotal: 0,
          packageMinutesUsed: 0,
        },
      });
    }

    // Test Free Package Subscription
    const freeSub = await packageService.subscribeFreePackage(testUser.id);
    console.log('✅ Subscribed to Free Tier. Result:', {
      hasPackage: freeSub.status.hasPackage,
      packageName: freeSub.status.package?.name,
      totalMinutes: freeSub.status.packageMinutesTotal,
      remaining: freeSub.status.packageMinutesRemaining,
      percentRemaining: freeSub.status.percentRemaining,
      daysUntilReset: freeSub.status.daysUntilReset,
    });

    // 3. Test Consumption & Low-Balance Detection (20% Threshold)
    console.log('\n3. Testing In-Stream Consumption & Low-Balance Threshold...');
    
    // Deduct 2,450 minutes out of 3,000 (leaves 550 mins = 18.3% < 20% threshold)
    const consumedResult = await packageService.consumeParticipantMinutes(testUser.id, 2450);
    console.log('Consumption result (after 2,450 mins used):', consumedResult);

    if (!consumedResult.isLowBalance) {
      throw new Error(`Expected isLowBalance to be true at ${consumedResult.percentRemaining}%, got false`);
    }
    console.log(`✅ Low balance threshold correctly triggered at ${consumedResult.percentRemaining}% remaining!`);

    // 4. Test In-Stream Live Audience Calculation
    console.log('\n4. Testing Live Audience Balance & Warning Message generation...');
    const audienceSize = 50; // 50 attendees
    const liveCheck = await packageService.checkHostLiveBalance(testUser.id, audienceSize);
    console.log('Live Check Report:', {
      audienceSize: liveCheck.audienceSize,
      minutesRemaining: liveCheck.packageMinutesRemaining,
      percentRemaining: `${liveCheck.percentRemaining}%`,
      estimatedMinutesLeft: `${liveCheck.estimatedMinutesLeft} mins (~${(liveCheck.estimatedMinutesLeft / 60).toFixed(1)} hrs)`,
      warningMessage: liveCheck.warningMessage,
    });

    if (!liveCheck.warningMessage || !liveCheck.warningMessage.includes('Low on minutes')) {
      throw new Error('Expected low balance warning message to be generated');
    }
    console.log('✅ Warning message format verified:', liveCheck.warningMessage);

    // 5. Test Depletion and Zero-Balance
    console.log('\n5. Testing Depletion (0 minutes remaining)...');
    const depletedResult = await packageService.consumeParticipantMinutes(testUser.id, 600);
    console.log('Depleted state:', depletedResult);
    if (!depletedResult.isDepleted) {
      throw new Error('Expected isDepleted to be true');
    }
    console.log('✅ Balance depletion correctly detected at 0 minutes');

    // 6. Test Super Admin Package Modification
    console.log('\n6. Testing Super Admin Package Updates...');
    const starterPkg = packages.find((p) => p.slug === 'starter');
    if (starterPkg) {
      const updatedStarter = await prisma.billingPackage.update({
        where: { id: starterPkg.id },
        data: {
          roughlyCovers: '~10 events of 50 attendees/hr (Updated by Super Admin)',
        },
      });
      console.log(`✅ Super Admin updated package "${updatedStarter.name}": roughlyCovers = "${updatedStarter.roughlyCovers}"`);
    }

    console.log('\n🎉 ALL BILLING MODULE TESTS PASSED SUCCESSFULLY!\n');
  } catch (error: any) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
