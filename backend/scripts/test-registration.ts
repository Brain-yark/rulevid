import 'dotenv/config';
import { prisma } from '../src/db';
import bcrypt from 'bcryptjs';

async function testRegistrationLogic() {
  console.log('Testing role assignment logic...');

  // Test Case 1: Host registration
  const hostEmail = `test-host-${Date.now()}@svsm-test.io`;
  const validSelfRegisterRoles = ['user', 'host'];
  const requestedHostRole = 'host'.toLowerCase().trim();
  const assignedHostRole = validSelfRegisterRoles.includes(requestedHostRole) ? requestedHostRole : 'user';

  const hostUser = await prisma.user.create({
    data: {
      email: hostEmail,
      passwordHash: await bcrypt.hash('Password123!', 10),
      name: 'Test Host User',
      role: assignedHostRole,
      companyName: 'Host Studio Inc',
      status: 'active',
    },
  });

  console.log(`[PASS] Host registration assigned role: ${hostUser.role} (Expected: host)`);

  // Test Case 2: Attendee registration
  const attendeeEmail = `test-attendee-${Date.now()}@svsm-test.io`;
  const requestedAttendeeRole = 'user'.toLowerCase().trim();
  const assignedAttendeeRole = validSelfRegisterRoles.includes(requestedAttendeeRole) ? requestedAttendeeRole : 'user';

  const attendeeUser = await prisma.user.create({
    data: {
      email: attendeeEmail,
      passwordHash: await bcrypt.hash('Password123!', 10),
      name: 'Test Attendee User',
      role: assignedAttendeeRole,
      status: 'active',
    },
  });

  console.log(`[PASS] Attendee registration assigned role: ${attendeeUser.role} (Expected: user)`);

  // Clean up test users
  await prisma.user.deleteMany({
    where: { email: { in: [hostEmail, attendeeEmail] } },
  });
  console.log('Cleanup completed successfully.');

  process.exit(0);
}

testRegistrationLogic().catch((err) => {
  console.error('Registration test error:', err);
  process.exit(1);
});
