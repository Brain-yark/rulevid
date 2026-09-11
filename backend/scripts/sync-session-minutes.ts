import { prisma } from '../src/db';

async function main() {
  const sessionId = '776d6321-8e86-4000-a4db-181ef4c786d2';

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      facilitator: true,
      usageRecords: true,
    },
  });

  if (!session) {
    console.log(`Session ${sessionId} not found.`);
    return;
  }

  console.log(`Found session "${session.title}" (current totalMinutes: ${session.totalMinutes})`);

  const previousMinutes = session.totalMinutes;
  const newMinutes = 20; // Exact Agora RTC reported participant-minutes
  const diffMinutes = newMinutes - previousMinutes;

  // 1. Update session totalMinutes and participantCount
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      totalMinutes: newMinutes,
      participantCount: 2,
    },
  });
  console.log(`Updated session ${sessionId} to totalMinutes=${newMinutes}, participantCount=2`);

  // 2. Update UsageRecord if exists
  if (session.usageRecords.length > 0) {
    for (const record of session.usageRecords) {
      await prisma.usageRecord.update({
        where: { id: record.id },
        data: {
          minutesUsed: newMinutes,
          costToFacilitator: parseFloat((newMinutes * (record.ratePerMinute || 0.003)).toFixed(4)),
        },
      });
      console.log(`Updated UsageRecord ${record.id} to minutesUsed=${newMinutes}`);
    }
  }

  // 3. Update Transaction description if exists
  const transaction = await prisma.transaction.findFirst({
    where: {
      userId: session.facilitatorId,
      description: { contains: session.title },
    },
  });
  if (transaction) {
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        description: `Usage deduction for session: "${session.title}" (${newMinutes} min)`,
      },
    });
    console.log(`Updated Transaction ${transaction.id} description.`);
  }

  // 4. Deduct the difference (+9 minutes) from host's packageMinutesUsed
  if (diffMinutes > 0) {
    await prisma.user.update({
      where: { id: session.facilitatorId },
      data: {
        packageMinutesUsed: { increment: diffMinutes },
      },
    });
    console.log(`Deducted ${diffMinutes} additional minutes from host ${session.facilitatorId} package balance.`);
  }

  console.log('Session minutes successfully synchronized with Agora!');
}

main()
  .catch((e) => {
    console.error('Migration error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
